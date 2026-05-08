import type { SelectedPart, PromptPart, Slot } from '../types'
import { isRandomizerPartId, categoryIdFromRandomizer } from '../types'
import { SECTION_IDS, type SectionId } from '../data/sections'
import { normalizeAnimaTagForOutput, normalizeDatasetTag } from './animaTagNormalization'

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
