import type { AppState, CharacterPromptBlock, SelectedPart, Slot } from '../types'
import { migrateV1ToV2, isV1Version, type V1AppState } from '../data/migrations/v2_0_0'
import { defaultData } from '../data/defaultData'
import { emptySectionsRecord } from '../data/sections'

/** iOS Safari かどうかを判定する */
function isIOSSafari(): boolean {
    const ua = navigator.userAgent
    const isIOS = /iphone|ipad|ipod/i.test(ua)
    const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua)
    return isIOS && isSafari
}

/**
 * AppState 全体を JSON ファイルとしてローカルにダウンロードする
 * 端末・ブラウザ互換性の高い方法 (DOMへの一時追加と遅延revoke) を採用
 */
export function exportToJSON(state: AppState): { isIOS: boolean } {
    const persisted = {
        version: '2.1.0',
        categories: state.categories,
        library: state.library,
        main: state.positive,
        characters: state.characters,
        naturalLanguage: state.naturalLanguage,
        negative: state.negative,
    }
    const json = JSON.stringify(persisted, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const now = new Date()
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`

    const a = document.createElement('a')
    a.href = url
    a.download = `prompt-edit-${ts}.json`
    a.style.display = 'none'

    // Firefox や iOS Safari などでダウンロードを発火させるための確実な方法
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    // 一部のブラウザでファイルの生成・保存完了前にURLが破棄されるのを防ぐため、revoke は少し遅延させる
    setTimeout(() => {
        URL.revokeObjectURL(url)
    }, 10000)

    return { isIOS: isIOSSafari() }
}

// ============================================================
//  バリデーション
// ============================================================

function isValidV1Shape(data: unknown): data is V1AppState {
    if (!data || typeof data !== 'object') return false
    const d = data as Record<string, unknown>
    return (
        typeof d.version === 'string' &&
        Array.isArray(d.categories) &&
        Array.isArray(d.library) &&
        Array.isArray(d.slots)
    )
}

function isValidV2Shape(data: unknown): data is AppState {
    if (!data || typeof data !== 'object') return false
    const d = data as Record<string, unknown>
    return (
        typeof d.version === 'string' &&
        Array.isArray(d.categories) &&
        Array.isArray(d.library) &&
        (!!d.positive || !!d.main) &&
        !!d.negative
    )
}

function cloneDefaultCharacters(): CharacterPromptBlock[] {
    return defaultData.characters.map((c) => ({
        ...c,
        character: [],
        appearance: [],
        outfit: [],
        expression: [],
        action: [],
        item: [],
        other: [],
    }))
}

function normalizeCharacters(raw: unknown): CharacterPromptBlock[] {
    if (!Array.isArray(raw)) return cloneDefaultCharacters()
    return raw.map((item, index) => {
        const c = item as Partial<CharacterPromptBlock>
        return {
            id: typeof c.id === 'string' ? c.id : `character_${index + 1}`,
            label: typeof c.label === 'string' ? c.label : `キャラ${index + 1}`,
            enabled: c.enabled ?? true,
            role: c.role ?? '',
            position: c.position ?? '',
            customPosition: c.customPosition ?? '',
            character: Array.isArray(c.character) ? c.character : [],
            appearance: Array.isArray(c.appearance) ? c.appearance : [],
            outfit: Array.isArray(c.outfit) ? c.outfit : [],
            expression: Array.isArray(c.expression) ? c.expression : [],
            action: Array.isArray(c.action) ? c.action : [],
            item: Array.isArray(c.item) ? c.item : [],
            other: Array.isArray(c.other) ? c.other : [],
        }
    })
}

function isV2_0Version(version: string): boolean {
    return /^2\.0\./.test(version)
}

function collectSectionParts(slot: Slot): SelectedPart[] {
    const allParts: SelectedPart[] = []
    const rawSections = slot.sections as Record<string, unknown>
    for (const value of Object.values(rawSections ?? {})) {
        if (Array.isArray(value)) {
            allParts.push(...value.map((p) => ({ ...(p as SelectedPart) })))
        }
    }
    return allParts
}

function moveAllPartsToOther(slot: Slot, freeText: string): Slot {
    const sections = emptySectionsRecord<SelectedPart>()
    sections.other = collectSectionParts(slot)

    const migrated: Slot = {
        id: slot.id,
        type: slot.type,
        sections,
        freeText,
    }
    if (slot.type === 'positive') {
        migrated.datasetTag = slot.datasetTag ?? ''
        migrated.rating = slot.rating ?? null
    }
    return migrated
}

function normalizeV2State(data: AppState & { main?: Slot }): AppState {
    const d = data as AppState & { main?: Slot }
    const main = d.main ?? d.positive
    const isLegacyV2_0 = isV2_0Version(d.version)

    if (isLegacyV2_0) {
        return {
            version: '2.1.0',
            categories: d.categories,
            library: d.library,
            positive: moveAllPartsToOther(main, ''),
            characters: normalizeCharacters(d.characters),
            naturalLanguage: main.freeText ?? '',
            negative: moveAllPartsToOther(d.negative, d.negative.freeText ?? ''),
        }
    }

    const positive: Slot = {
        ...main,
        freeText: '',
    }

    return {
        version: '2.1.0',
        categories: d.categories,
        library: d.library,
        positive,
        characters: normalizeCharacters(d.characters),
        naturalLanguage:
            typeof d.naturalLanguage === 'string'
                ? d.naturalLanguage
                : main.freeText ?? '',
        negative: d.negative,
    }
}

/**
 * ファイルを読み込み AppState としてパースして返す
 * バリデーションエラー時は例外を投げる
 * 旧形式 (V1.x) を検出した場合は自動的に V2.0.0 にマイグレーションする
 */
export function importFromJSON(file: File): Promise<AppState> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string
                const data = JSON.parse(text) as unknown

                // 旧形式 (V1.x) → マイグレーション
                if (isValidV1Shape(data) && isV1Version(data.version)) {
                    const migrated = migrateV1ToV2(data)
                    resolve(migrated)
                    return
                }

                // V2 形式 → そのまま検証して返す
                if (isValidV2Shape(data)) {
                    resolve(normalizeV2State(data as AppState & { main?: Slot }))
                    return
                }

                reject(
                    new Error(
                        '無効な JSON フォーマットです。必要なキーが不足しています。',
                    ),
                )
            } catch {
                reject(new Error('JSON の解析に失敗しました。ファイルを確認してください。'))
            }
        }
        reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました。'))
        reader.readAsText(file, 'utf-8')
    })
}
