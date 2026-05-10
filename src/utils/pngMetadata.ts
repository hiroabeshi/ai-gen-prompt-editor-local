// ============================================================
//  PNG メタデータ抽出 (Anima / ComfyUI 形式)
//  - tEXt / iTXt チャンクから 'prompt' キー (API 形式 workflow JSON) を取得
//  - KSampler → CLIPTextEncode を辿ってポジ/ネガを抽出
//  - タグをセクション振り分け + library 既存パーツと照合 + 仮パーツ生成
//  (§11.7 準拠)
// ============================================================

import { v4 as uuidv4 } from 'uuid'
import dictionaryRaw from '../data/json/dictionary.json'
import type {
    Category,
    PromptPart,
    SelectedPart,
    Rating,
} from '../types'
import { resolveSectionForTag, SECTION_IDS, type SectionId } from '../data/sections'
import { normalizeAnimaTagForStorage, normalizeDatasetTag } from './animaTagNormalization'

// ─── 定数: Boilerplate 除外 / レーティング / データセット ─────

export const ANIMA_BOILERPLATE_QUALITY = [
    'masterpiece', 'best quality', 'high quality', 'absurdres', 'highres',
    'score_9', 'score_8_up', 'score_7_up', 'score_6_up', 'score_5_up',
    'worst quality', 'low quality', 'bad quality', 'lowres',
    'score_1', 'score_2', 'score_3',
]

export const ANIMA_BOILERPLATE_META = [
    'artist name', 'signature', 'watermark', 'logo',
]

const BOILERPLATE_SET = new Set<string>([
    ...ANIMA_BOILERPLATE_QUALITY.map((t) => t.toLowerCase()),
    ...ANIMA_BOILERPLATE_META.map((t) => t.toLowerCase()),
])

const RATING_SET = new Set<string>(['safe', 'sensitive', 'nsfw', 'explicit'])

const DATASET_TAG_CANDIDATES = ['deviantart', 'ye-pop']

const YEAR_PATTERN = /^year[\s_]+2\d{3}$/i
const PERIOD_SET = new Set(['newest', 'recent', 'mid', 'early', 'old'])

// ─── 型定義 ──────────────────────────────────────────────

export type SectionedParts = Record<SectionId, SelectedPart[]>

export type PNGExtractMeta = {
    steps?: number
    cfg?: number
    sampler?: string
    seed?: number
}

export type PNGExtractResult = {
    newCategories: Category[]
    newParts: PromptPart[]
    positive: SectionedParts
    negative: SectionedParts
    positiveFreeText: string
    negativeFreeText: string
    datasetTag: string
    rating: Rating | null
    positiveExcluded: string[]
    negativeExcluded: string[]
    positivePlacedCount: number
    negativePlacedCount: number
    meta: PNGExtractMeta
    rawPositive: string
    rawNegative: string
}

function emptySectioned(): SectionedParts {
    const result = {} as SectionedParts
    for (const sid of SECTION_IDS) {
        result[sid] = []
    }
    return result
}

// ─── 辞書インデックス (タグ → カテゴリ名) ─────────────────

const dict = dictionaryRaw as unknown as {
    categories: string[]
    tags: Record<string, [string, number]>
}

// normalized tag ('_'区切り, lowercase) → { label, categoryIndex }
const DICT_LOOKUP = new Map<string, { label: string; categoryIndex: number }>()
for (const [tag, tuple] of Object.entries(dict.tags)) {
    DICT_LOOKUP.set(tag.toLowerCase(), { label: tuple[0], categoryIndex: tuple[1] })
}

// ─── PNG チャンク解析 ──────────────────────────────────

function verifyPNGSignature(view: DataView): void {
    if (view.byteLength < 8) throw new Error('PNG ファイルが不正です。')
    if (view.getUint32(0) !== 0x89504e47 || view.getUint32(4) !== 0x0d0a1a0a) {
        throw new Error('PNG 画像ではありません。')
    }
}

/**
 * PNG の tEXt / iTXt チャンクを全走査して keyword → content の Map を返す
 */
export function readAllTextChunks(buffer: ArrayBuffer): Map<string, string> {
    const view = new DataView(buffer)
    verifyPNGSignature(view)

    const result = new Map<string, string>()
    let offset = 8

    while (offset < buffer.byteLength) {
        if (offset + 8 > buffer.byteLength) break
        const length = view.getUint32(offset)
        const type = String.fromCharCode(
            view.getUint8(offset + 4),
            view.getUint8(offset + 5),
            view.getUint8(offset + 6),
            view.getUint8(offset + 7),
        )
        offset += 8
        if (offset + length > buffer.byteLength) break

        if (type === 'tEXt' || type === 'iTXt') {
            const chunk = new Uint8Array(buffer, offset, length)
            let nullIdx = -1
            for (let i = 0; i < chunk.length; i++) {
                if (chunk[i] === 0) {
                    nullIdx = i
                    break
                }
            }
            if (nullIdx !== -1) {
                const keyword = new TextDecoder().decode(chunk.slice(0, nullIdx))
                let content = ''
                if (type === 'tEXt') {
                    content = new TextDecoder().decode(chunk.slice(nullIdx + 1))
                } else {
                    // iTXt ヘッダ: [keyword]\0[compflag(1)][compmethod(1)][lang]\0[trans]\0[content]
                    let pos = nullIdx + 3
                    while (pos < chunk.length && chunk[pos] !== 0) pos++
                    pos++
                    while (pos < chunk.length && chunk[pos] !== 0) pos++
                    pos++
                    content = new TextDecoder().decode(chunk.slice(pos))
                }
                if (!result.has(keyword)) result.set(keyword, content)
            }
        }

        offset += length + 4 // data + CRC
        if (type === 'IEND') break
    }

    return result
}

// ─── ComfyUI ワークフロー走査 ───────────────────────────

type WorkflowNode = { class_type?: string; inputs?: Record<string, any> }
type Workflow = Record<string, WorkflowNode>

function findSamplerNode(workflow: Workflow): WorkflowNode | null {
    for (const node of Object.values(workflow)) {
        const ct = node?.class_type
        if (ct === 'KSampler' || ct === 'KSamplerAdvanced') return node
    }
    return null
}

/**
 * inputs.positive / inputs.negative のリンクを辿って CLIPTextEncode の text を取得
 */
function resolveTextInput(
    workflow: Workflow,
    link: unknown,
    depth = 0,
): string {
    if (depth > 16) return ''
    if (!Array.isArray(link) || link.length < 1) return ''
    const nodeId = String(link[0])
    const node = workflow[nodeId]
    if (!node) return ''
    const inputs = node.inputs ?? {}

    if (typeof inputs.text === 'string') return inputs.text
    if (Array.isArray(inputs.text)) return resolveTextInput(workflow, inputs.text, depth + 1)
    if (typeof inputs.string === 'string') return inputs.string
    if (Array.isArray(inputs.string)) return resolveTextInput(workflow, inputs.string, depth + 1)
    if (typeof inputs.value === 'string') return inputs.value

    return ''
}

// ─── タグ文字列パース ────────────────────────────────

/**
 * `(tag:1.2)` / `((tag))` / 裸 tag を裸タグに戻す
 */
function stripWeight(raw: string): string {
    const t = raw.trim()
    if (!t) return ''
    const m = t.match(/^\((.+?):\s*-?\d+(?:\.\d+)?\)$/s)
    if (m) return stripWeight(m[1])
    if (t.startsWith('(') && t.endsWith(')')) {
        return stripWeight(t.slice(1, -1))
    }
    return t
}

type ParseContext = {
    existingCategories: Category[]
    tagToPart: Map<string, { id: string; categoryId: string }>
    newParts: PromptPart[]
}

function resolveDictionaryCategory(
    animaTag: string,
    existingCategories: Category[],
): string | null {
    const key = normalizeAnimaTagForStorage(animaTag).replace(/\s+/g, '_')
    const hit = DICT_LOOKUP.get(key)
    if (!hit) return null
    const catName = dict.categories[hit.categoryIndex]
    if (!catName) return null
    const cat = existingCategories.find((c) => c.name === catName)
    return cat ? cat.id : null
}

function findArtistCategoryId(cats: Category[]): string {
    const c = cats.find((cat) => cat.id === 'mc_artist')
    if (c) return c.id
    const byName = cats.find((cat) => cat.name.includes('アーティスト') || cat.name.includes('作者'))
    return byName ? byName.id : cats[0]?.id ?? 'mc_unclassified'
}

function ensurePart(
    ctx: ParseContext,
    animaTag: string,
    forceCategoryId?: string,
): { id: string; categoryId: string } {
    const normalizedTag = normalizeAnimaTagForStorage(animaTag)
    const existing = ctx.tagToPart.get(normalizedTag)
    if (existing) return existing

    const categoryId =
        forceCategoryId ??
        resolveDictionaryCategory(normalizedTag, ctx.existingCategories) ??
        'mc_unclassified'

    const id = uuidv4()
    const newPart: PromptPart = {
        id,
        categoryId,
        label: normalizedTag,
        values: { anima: normalizedTag },
    }
    ctx.newParts.push(newPart)
    ctx.tagToPart.set(normalizedTag, { id, categoryId })
    return { id, categoryId }
}

function sectionForTag(rawTag: string, categoryId: string): SectionId {
    if (YEAR_PATTERN.test(rawTag) || PERIOD_SET.has(rawTag.toLowerCase())) {
        return 'quality'
    }
    return resolveSectionForTag(categoryId, rawTag)
}

/**
 * プロンプト文字列 1 本を section 別に仕分ける
 */
function parsePromptToSlot(
    text: string,
    isPositive: boolean,
    ctx: ParseContext,
): {
    sections: SectionedParts
    freeText: string
    datasetTag: string
    rating: Rating | null
    excluded: string[]
    placedCount: number
} {
    const sections = emptySectioned()
    const freeText = ''
    let datasetTag = ''
    let rating: Rating | null = null
    const excluded: string[] = []
    let placedCount = 0

    if (!text) {
        return { sections, freeText, datasetTag, rating, excluded, placedCount }
    }

    // 1行目が既知のデータセットタグなら抽出してボディを切り詰める (positive のみ)
    let body = text
    const firstNewline = text.indexOf('\n')
    if (firstNewline !== -1 && isPositive) {
        const firstLine = text.slice(0, firstNewline).trim()
        const normalizedDatasetTag = normalizeDatasetTag(firstLine)
        if (DATASET_TAG_CANDIDATES.includes(normalizedDatasetTag)) {
            datasetTag = normalizedDatasetTag
            body = text.slice(firstNewline + 1)
        }
    }

    const rawTags = body
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)

    for (const raw of rawTags) {
        const stripped = stripWeight(raw)
        if (!stripped) continue
        const normalized = normalizeAnimaTagForStorage(stripped)
        if (!normalized) continue
        const lower = normalized.toLowerCase()

        // レーティング (positive のみ、最後に出たものを採用)
        if (isPositive && RATING_SET.has(lower)) {
            rating = lower as Rating
            continue
        }

        // アーティストタグ (@ プレフィックス)
        if (normalized.startsWith('@')) {
            const bareTag = normalized.slice(1).trim()
            if (!bareTag) continue
            const info =
                ctx.tagToPart.get(bareTag) ??
                ensurePart(ctx, bareTag, findArtistCategoryId(ctx.existingCategories))
            sections.artist.push({
                id: uuidv4(),
                partId: info.id,
                weight: 1.0,
                enabled: true,
            })
            placedCount++
            continue
        }

        // Boilerplate 除外
        if (BOILERPLATE_SET.has(lower)) {
            excluded.push(normalized)
            continue
        }

        // 通常タグ: library / 辞書 で section を解決
        const info = ctx.tagToPart.get(normalized) ?? ensurePart(ctx, normalized)
        const sid = sectionForTag(normalized, info.categoryId)
        sections[sid].push({
            id: uuidv4(),
            partId: info.id,
            weight: 1.0,
            enabled: true,
        })
        placedCount++
    }

    return { sections, freeText, datasetTag, rating, excluded, placedCount }
}

// ─── 公開 API ────────────────────────────────────────

/**
 * PNG ファイルから ComfyUI 形式のプロンプトメタデータを抽出し、
 * ポジ/ネガをセクション別に仕分けた結果を返す。
 *
 * - `existingLibrary` と anima タグが一致するタグは既存 partId を再利用
 * - 一致しないタグは仮パーツ (label=tag文字列, categoryId=辞書解決または 'mc_unclassified') として newParts に追加
 * - Boilerplate タグは除外
 * - レーティング / アーティスト `@` / 年代タグは専用フィールド / セクションに仕分け
 */
export async function extractPNGMetadata(
    file: File,
    existingLibrary: PromptPart[],
    existingCategories: Category[],
): Promise<PNGExtractResult> {
    const buffer = await file.arrayBuffer()
    const chunks = readAllTextChunks(buffer)

    const promptRaw = chunks.get('prompt')
    if (!promptRaw) {
        throw new Error(
            'ComfyUI から出力された PNG ではないようです（prompt チャンクが見つかりません）。',
        )
    }

    let workflow: Workflow
    try {
        workflow = JSON.parse(promptRaw) as Workflow
    } catch {
        throw new Error('prompt チャンクの JSON 解析に失敗しました。')
    }

    const sampler = findSamplerNode(workflow)
    if (!sampler) {
        throw new Error(
            'ComfyUI の KSampler ノードが見つかりません（未対応のワークフロー構成）。',
        )
    }

    const positiveText = resolveTextInput(workflow, sampler.inputs?.positive)
    const negativeText = resolveTextInput(workflow, sampler.inputs?.negative)

    // 既存 library を anima タグで索引化
    const tagToPart = new Map<string, { id: string; categoryId: string }>()
    for (const p of existingLibrary) {
        const animaTag = normalizeAnimaTagForStorage(p.values.anima)
        if (!animaTag) continue
        tagToPart.set(animaTag, { id: p.id, categoryId: p.categoryId })
    }
    const ctx: ParseContext = {
        existingCategories,
        tagToPart,
        newParts: [],
    }

    const posParsed = parsePromptToSlot(positiveText, true, ctx)
    const negParsed = parsePromptToSlot(negativeText, false, ctx)

    const meta: PNGExtractMeta = {}
    const sinputs = sampler.inputs ?? {}
    if (typeof sinputs.steps === 'number') meta.steps = sinputs.steps
    if (typeof sinputs.cfg === 'number') meta.cfg = sinputs.cfg
    if (typeof sinputs.sampler_name === 'string') meta.sampler = sinputs.sampler_name
    if (typeof sinputs.seed === 'number') meta.seed = sinputs.seed

    return {
        newCategories: [],
        newParts: ctx.newParts,
        positive: posParsed.sections,
        negative: negParsed.sections,
        positiveFreeText: posParsed.freeText,
        negativeFreeText: negParsed.freeText,
        datasetTag: posParsed.datasetTag,
        rating: posParsed.rating,
        positiveExcluded: posParsed.excluded,
        negativeExcluded: negParsed.excluded,
        positivePlacedCount: posParsed.placedCount,
        negativePlacedCount: negParsed.placedCount,
        meta,
        rawPositive: positiveText,
        rawNegative: negativeText,
    }
}
