import type { CharacterPromptBlock, SelectedPart, PromptPart, Slot } from '../types'
import { isRandomizerPartId, categoryIdFromRandomizer } from '../types'
import { SECTION_IDS, type SectionId } from '../data/sections'
import { normalizeAnimaTagForOutput, normalizeDatasetTag } from './animaTagNormalization'

const CHARACTER_FIELD_ORDER = [
    'character',
    'appearance',
    'outfit',
    'expression',
    'action',
    'item',
    'other',
] as const

/**
 * 重み (Weight) を Anima / ComfyUI 記法 `(tag:1.2)` に変換する
 * weight=1.0 は裸のタグをそのまま返す
 * 1.20 → 1.2, 1.00 → 省略 (末尾 0 をトリム)
 */
export function formatByWeight(tag: string, weight: number): string {
    if (Math.abs(weight - 1.0) < 0.001) return tag
    const w = weight.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
    return `(${tag}:${w})`
}

/**
 * ランダマイザ partId からカテゴリ内の全パーツタグを取り出す
 */
function collectRandomizerTags(partId: string, library: PromptPart[]): string[] {
    const catId = categoryIdFromRandomizer(partId)
    const catParts = library.filter((p) => p.categoryId === catId)
    return catParts
        .map((p) => normalizeAnimaTagForOutput(p.values.anima))
        .filter((t) => t !== '')
}

/**
 * ランダマイザのプレビュー用テキストを生成する
 * 例: 🎲[体勢 から1つ]
 */
function buildRandomizerPreview(
    partId: string,
    categories: { id: string; name: string }[],
    library: PromptPart[],
): string {
    const catId = categoryIdFromRandomizer(partId)
    const cat = categories.find((c) => c.id === catId)
    if (!cat) return ''
    const tags = collectRandomizerTags(partId, library)
    if (tags.length === 0) return ''
    return `🎲[${cat.name} から1つ]`
}

/**
 * ランダマイザ partId を展開して 1 つのタグを返す
 * - previewMode: 🎲[xxx から1つ] 形式
 * - !previewMode: クライアント側で 1 つランダム選択して展開
 */
function expandRandomizer(
    partId: string,
    library: PromptPart[],
    categories?: { id: string; name: string }[],
    previewMode?: boolean,
): string {
    if (previewMode && categories) {
        return buildRandomizerPreview(partId, categories, library)
    }
    const tags = collectRandomizerTags(partId, library)
    if (tags.length === 0) return ''
    const idx = Math.floor(Math.random() * tags.length)
    return tags[idx]
}

/**
 * 1 パーツを Anima 形式タグにレンダリングする
 * - enabled=false は '' を返す
 * - artist セクションのパーツは @ プレフィックスを自動付与
 * - ランダマイザは展開
 */
function renderPart(
    p: SelectedPart,
    library: PromptPart[],
    sectionId: SectionId,
    opts: {
        categories?: { id: string; name: string }[]
        previewMode?: boolean
    } = {},
): string {
    if (!p.enabled) return ''

    let tag: string
    if (isRandomizerPartId(p.partId)) {
        tag = expandRandomizer(p.partId, library, opts.categories, opts.previewMode)
    } else {
        const master = library.find((m) => m.id === p.partId)
        tag = master ? master.values.anima : ''
    }

    tag = normalizeAnimaTagForOutput(tag, sectionId)
    if (!tag) return ''

    return formatByWeight(tag, p.weight)
}

function dedupePreserveOrder(tags: string[]): string[] {
    const seen = new Set<string>()
    const result: string[] = []
    for (const tag of tags) {
        const key = tag.trim().toLowerCase()
        if (!key || seen.has(key)) continue
        seen.add(key)
        result.push(tag)
    }
    return result
}

function ensureTrailingPeriod(text: string): string {
    const trimmed = text.trimEnd()
    if (!trimmed) return ''
    return /[.!?。！？]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

function enabledCharacters(characters: CharacterPromptBlock[]): CharacterPromptBlock[] {
    return characters.filter((c) => c.enabled)
}

function roleToCountKind(role: string): 'girl' | 'boy' | 'other' | null {
    const normalized = role.trim().toLowerCase()
    if (['girl', 'woman', 'female'].includes(normalized)) return 'girl'
    if (['boy', 'man', 'male'].includes(normalized)) return 'boy'
    if (['other', 'creature', 'mascot'].includes(normalized)) return 'other'
    return null
}

function buildCountTags(characters: CharacterPromptBlock[]): string[] {
    const counts: Record<'girl' | 'boy' | 'other', number> = {
        girl: 0,
        boy: 0,
        other: 0,
    }
    const order: ('girl' | 'boy' | 'other')[] = []
    for (const character of enabledCharacters(characters)) {
        const kind = roleToCountKind(character.role)
        if (kind) {
            if (!order.includes(kind)) order.push(kind)
            counts[kind]++
        }
    }

    const tags: string[] = []
    for (const kind of order) {
        if (kind === 'girl') tags.push(`${counts.girl}${counts.girl === 1 ? 'girl' : 'girls'}`)
        if (kind === 'boy') tags.push(`${counts.boy}${counts.boy === 1 ? 'boy' : 'boys'}`)
        if (kind === 'other') tags.push(`${counts.other}${counts.other === 1 ? 'other' : 'others'}`)
    }
    return tags
}

function titleCasePhrase(raw: string): string {
    return raw
        .trim()
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
}

function getPositionLabel(character: CharacterPromptBlock): string {
    if (character.position === 'custom') return character.customPosition?.trim() ?? ''
    return character.position.trim()
}

function buildCharacterHeading(character: CharacterPromptBlock, index: number): string {
    const position = getPositionLabel(character)
    const role = character.role.trim().toLowerCase()
    if (position && role) return `${titleCasePhrase(position)} ${role}`
    if (position) return `${titleCasePhrase(position)} character`
    return `Character ${index + 1}`
}

function renderCharacterFieldParts(
    character: CharacterPromptBlock,
    library: PromptPart[],
    opts: {
        categories?: { id: string; name: string }[]
        previewMode?: boolean
    } = {},
): string[] {
    const parts: string[] = []
    for (const fieldId of CHARACTER_FIELD_ORDER) {
        parts.push(
            ...character[fieldId]
                .map((p) => renderPart(p, library, 'other', opts))
                .filter((t) => t !== ''),
        )
    }
    return parts
}

export function generateScopedClusterFromCharacter(
    character: CharacterPromptBlock,
    index: number,
    library: PromptPart[],
    categories?: { id: string; name: string }[],
    previewMode?: boolean,
): string {
    if (!character.enabled) return ''
    const bodyParts: string[] = []
    bodyParts.push(...renderCharacterFieldParts(character, library, { categories, previewMode }))
    const body = dedupePreserveOrder(bodyParts).join(', ')
    if (!body) return ''
    return `${buildCharacterHeading(character, index)}: ${body}.`
}

/**
 * Slot 全体 (sections + freeText + datasetTag + rating) を最終プロンプト文字列に変換する
 * - セクション順 → セクション内パーツ順 → freeText の順で連結
 * - datasetTag があればプロンプト全体の先頭に改行区切りで配置 (Anima 仕様、positive のみ)
 * - rating があれば quality セクション先頭に自動挿入 (positive のみ)
 */
export function generatePromptFromSlot(
    slot: Slot,
    library: PromptPart[],
    categories?: { id: string; name: string }[],
    previewMode?: boolean,
): string {
    const chunks: string[] = []

    for (const sid of SECTION_IDS) {
        const parts: string[] = []

        if (sid === 'quality' && slot.rating) {
            parts.push(slot.rating)
        }

        const rendered = slot.sections[sid]
            .map((p) => renderPart(p, library, sid, { categories, previewMode }))
            .filter((t) => t !== '')
        parts.push(...rendered)

        if (parts.length > 0) chunks.push(parts.join(', '))
    }

    const freeText = slot.freeText.trim()
    if (freeText) chunks.push(freeText)

    const body = chunks.join(', ')
    const datasetTag = normalizeDatasetTag(slot.datasetTag ?? '')
    return datasetTag ? `${datasetTag}\n${body}` : body
}

/**
 * Scene prompt 全体を Anima 向けに組み立てる。
 * 1. 全体タグ列
 * 2. キャラ別 scoped cluster
 * 3. 関係・構図 caption
 */
export function generatePromptFromScene(
    mainSlot: Slot,
    characters: CharacterPromptBlock[],
    naturalLanguage: string,
    library: PromptPart[],
    categories?: { id: string; name: string }[],
    previewMode?: boolean,
): string {
    const chunks: string[] = []
    const autoCounts = buildCountTags(characters)

    for (const sid of SECTION_IDS) {
        if (sid === 'character') continue
        const parts: string[] = []

        if (sid === 'quality' && mainSlot.rating) {
            parts.push(mainSlot.rating)
        }

        const rendered = mainSlot.sections[sid]
            .map((p) => renderPart(p, library, sid, { categories, previewMode }))
            .filter((t) => t !== '')

        if (sid === 'people') {
            parts.push(...(rendered.length > 0 ? rendered : autoCounts))
        } else {
            parts.push(...rendered)
        }

        const deduped = dedupePreserveOrder(parts)
        if (deduped.length > 0) chunks.push(deduped.join(', '))
    }

    const body = chunks.join(', ')
    const datasetTag = normalizeDatasetTag(mainSlot.datasetTag ?? '')
    const mainPrompt = ensureTrailingPeriod(body)
    const globalPrompt = datasetTag
        ? (mainPrompt ? `${datasetTag}\n${mainPrompt}` : datasetTag)
        : mainPrompt

    const clusters = characters
        .map((character, index) =>
            generateScopedClusterFromCharacter(character, index, library, categories, previewMode),
        )
        .filter((cluster) => cluster !== '')
        .join('\n')

    const relationCaption = naturalLanguage.trim()
    return [globalPrompt, clusters, relationCaption].filter((part) => part !== '').join('\n\n')
}
