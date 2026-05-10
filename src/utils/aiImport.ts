import { v4 as uuidv4 } from 'uuid'
import type {
    AIImportData,
    AIImportCategory,
    Category,
    PromptPart,
    SelectedPart,
    Rating,
} from '../types'
import { resolveSectionForTag, SECTION_IDS, type SectionId } from '../data/sections'
import { normalizeAnimaTagForStorage, normalizeDatasetTag } from './animaTagNormalization'

/**
 * AI インポート JSON テキストをパースして検証する
 * マークダウンのコードブロック修飾などを取り除いてからパースを試みる
 */
export function parseAIImportText(text: string): AIImportData {
    const cleanedText = text
        .replace(/^```json\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()

    try {
        const data = JSON.parse(cleanedText) as AIImportData

        if (!data || typeof data !== 'object') {
            throw new Error('無効な JSON データです。')
        }
        if (!Array.isArray(data.library) || !Array.isArray(data.slots)) {
            throw new Error(
                'JSON に "library" または "slots" 配列が含まれていません。AI側で生成が途切れたか、フォーマットが崩れている可能性があります。',
            )
        }
        return data
    } catch (e: any) {
        throw new Error(`AI インポート JSON の解析に失敗しました: ${e.message}`)
    }
}

export type SectionedParts = Record<SectionId, SelectedPart[]>

function emptySectioned(): SectionedParts {
    const result = {} as SectionedParts
    for (const sid of SECTION_IDS) {
        result[sid] = []
    }
    return result
}

function isSectionId(value: unknown): value is SectionId {
    return typeof value === 'string' && (SECTION_IDS as readonly string[]).includes(value)
}

export type AIImportMergeResult = {
    newCategories: Category[]
    newParts: PromptPart[]
    positive: SectionedParts
    negative: SectionedParts
    positiveFreeText: string
    negativeFreeText: string
    datasetTag: string
    rating: Rating | null
}

/**
 * AI インポートデータを既存の categories / library にマージする。
 * - 既存カテゴリと名前が重複する場合は既存カテゴリに Parts を追加する (マージ)
 * - 新規カテゴリの場合は UUIDv4 を付与して追加
 * - パーツは values.anima で既存と照合し、存在すればその ID を流用し、重複を防ぐ
 * - スロットは positive / negative に集約し、各パーツインスタンスを section に仕分ける
 */
export function mergeAIImport(
    importData: AIImportData,
    existingCategories: Category[],
    existingLibrary: PromptPart[],
    resolveConflict: (catName: string) => 'merge' | 'add',
): AIImportMergeResult {
    const newCategories: Category[] = []
    const newParts: PromptPart[] = []

    // ---- 1. カテゴリとパーツの処理 ----
    // anima タグ → { id, categoryId } の対応表
    const partTagToInfoMap = new Map<string, { id: string; categoryId: string }>()
    for (const existing of existingLibrary) {
        const animaTag = normalizeAnimaTagForStorage(existing.values.anima)
        if (!animaTag) continue
        partTagToInfoMap.set(animaTag, {
            id: existing.id,
            categoryId: existing.categoryId,
        })
    }

    for (const importCat of importData.library) {
        const existingCat = existingCategories.find((c) => c.name === importCat.name)
        let targetCategoryId: string

        if (existingCat) {
            const decision = resolveConflict(importCat.name)
            if (decision === 'merge') {
                targetCategoryId = existingCat.id
            } else {
                const newCat = buildCategory(importCat)
                newCat.name = `${importCat.name}(インポート)`
                newCategories.push(newCat)
                targetCategoryId = newCat.id
            }
        } else {
            const newCat = buildCategory(importCat)
            newCategories.push(newCat)
            targetCategoryId = newCat.id
        }

        for (const importPart of importCat.parts) {
            const animaTag = normalizeAnimaTagForStorage(importPart.values.anima)
            if (!animaTag) continue

            const duplicate = partTagToInfoMap.get(animaTag)
            if (duplicate) {
                // 既存または今回追加予定のパーツが既にある
                continue
            }

            const newId = uuidv4()
            partTagToInfoMap.set(animaTag, { id: newId, categoryId: targetCategoryId })
            newParts.push({
                id: newId,
                categoryId: targetCategoryId,
                label: importPart.label,
                values: { anima: animaTag },
            })
        }
    }

    // ---- 2. スロットの処理 (positive / negative の section に仕分け) ----
    const positive = emptySectioned()
    const negative = emptySectioned()
    let positiveFreeText = ''
    let negativeFreeText = ''
    let datasetTag = ''
    let rating: Rating | null = null

    for (const importSlot of importData.slots) {
        const dest = importSlot.type === 'positive' ? positive : negative

        if (importSlot.type === 'positive') {
            if (importSlot.datasetTag) datasetTag = normalizeDatasetTag(importSlot.datasetTag)
            if (importSlot.rating !== undefined) rating = importSlot.rating ?? null
            if (importSlot.freeText) {
                positiveFreeText = positiveFreeText
                    ? `${positiveFreeText}\n${importSlot.freeText}`
                    : importSlot.freeText
            }
        } else if (importSlot.freeText) {
            negativeFreeText = negativeFreeText
                ? `${negativeFreeText}\n${importSlot.freeText}`
                : importSlot.freeText
        }

        for (const part of importSlot.parts) {
            const animaTag = normalizeAnimaTagForStorage(part.values.anima)
            if (!animaTag) continue
            const info = partTagToInfoMap.get(animaTag)
            if (!info) continue
            const sid: SectionId = isSectionId(part.section)
                ? part.section
                : resolveSectionForTag(info.categoryId, animaTag)
            dest[sid].push({
                id: uuidv4(),
                partId: info.id,
                weight: 1.0,
                enabled: true,
            })
        }
    }

    return {
        newCategories,
        newParts,
        positive,
        negative,
        positiveFreeText,
        negativeFreeText,
        datasetTag,
        rating,
    }
}

function buildCategory(importCat: AIImportCategory): Category {
    return {
        id: uuidv4(),
        name: importCat.name,
        color: '#6366f1',
    }
}
