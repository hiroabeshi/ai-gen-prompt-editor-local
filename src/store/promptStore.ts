import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type { AppState, Category, PromptPart, SelectedPart, Slot, Rating } from '../types'
import { DEFAULT_PART_WEIGHT, isRandomizerPartId, randomizerPartId, categoryIdFromRandomizer } from '../types'
import { defaultData } from '../data/defaultData'
import {
    SECTION_IDS,
    emptySectionsRecord,
    resolveSection,
    resolveSectionForTag,
    type SectionId,
} from '../data/sections'
import { normalizeAnimaTagForStorage, normalizeDatasetTag } from '../utils/animaTagNormalization'

type SlotKind = 'positive' | 'negative'

function cloneSlot(s: Slot): Slot {
    const sections = emptySectionsRecord<SelectedPart>()
    for (const sid of SECTION_IDS) {
        sections[sid] = (s.sections[sid] ?? []).map((p) => ({ ...p }))
    }
    const base: Slot = {
        id: s.id,
        type: s.type,
        sections,
        freeText: s.freeText ?? '',
    }
    if (s.type === 'positive') {
        base.datasetTag = s.datasetTag ?? ''
        base.rating = s.rating ?? null
    }
    return base
}

export const usePromptStore = defineStore('prompt', () => {
    // ─── State ───────────────────────────────────────────────
    const version = ref<string>(defaultData.version)
    const categories = ref<Category[]>([...defaultData.categories])
    const library = ref<PromptPart[]>([...defaultData.library])
    const positive = ref<Slot>(cloneSlot(defaultData.positive))
    const negative = ref<Slot>(cloneSlot(defaultData.negative))
    const loadCount = ref<number>(0)

    // ─── Getters ─────────────────────────────────────────────
    const getPartsByCategory = computed(() => (categoryId: string) =>
        library.value.filter((p) => p.categoryId === categoryId),
    )

    function getMasterPart(partId: string): PromptPart | undefined {
        if (isRandomizerPartId(partId)) {
            const catId = categoryIdFromRandomizer(partId)
            const cat = categories.value.find((c) => c.id === catId)
            if (!cat) return undefined
            return {
                id: partId,
                categoryId: catId,
                label: `${cat.name} @ランダマイザ`,
                values: { anima: '' },
            }
        }
        return library.value.find((p) => p.id === partId)
    }

    function getSlot(kind: SlotKind): Slot {
        return kind === 'positive' ? positive.value : negative.value
    }

    function forEachSlot(cb: (slot: Slot) => void): void {
        cb(positive.value)
        cb(negative.value)
    }

    function isPartUsedInSlots(partId: string): boolean {
        for (const slot of [positive.value, negative.value]) {
            for (const sid of SECTION_IDS) {
                if (slot.sections[sid].some((p) => p.partId === partId)) return true
            }
        }
        return false
    }

    // ─── Actions: State 初期化 ────────────────────────────────
    function initFromData(state: AppState): void {
        version.value = state.version
        categories.value = state.categories.map((c) => ({ ...c }))
        library.value = state.library.map((p) => ({
            ...p,
            values: { ...p.values, anima: normalizeAnimaTagForStorage(p.values.anima) },
        }))
        positive.value = cloneSlot(state.positive)
        negative.value = cloneSlot(state.negative)
        loadCount.value++
    }

    function getFullState(): AppState {
        return {
            version: version.value,
            categories: categories.value.map((c) => ({ ...c })),
            library: library.value.map((p) => ({ ...p, values: { ...p.values } })),
            positive: cloneSlot(positive.value),
            negative: cloneSlot(negative.value),
        }
    }

    // ─── Actions: カテゴリ ────────────────────────────────────
    function addCategory(name: string, color: string): Category {
        const cat: Category = { id: uuidv4(), name, color }
        categories.value.push(cat)
        return cat
    }

    function updateCategory(id: string, changes: Partial<Omit<Category, 'id'>>): void {
        const cat = categories.value.find((c) => c.id === id)
        if (cat) Object.assign(cat, changes)
    }

    function deleteCategory(id: string): void {
        const partIds = library.value.filter((p) => p.categoryId === id).map((p) => p.id)
        for (const partId of partIds) {
            removePartFromAllSlots(partId)
        }
        removePartFromAllSlots(randomizerPartId(id))
        library.value = library.value.filter((p) => p.categoryId !== id)
        categories.value = categories.value.filter((c) => c.id !== id)
    }

    function reorderCategories(newCategories: Category[]): void {
        categories.value = newCategories
    }

    // ─── Actions: マスターパーツ ──────────────────────────────
    function addPart(
        categoryId: string,
        label: string,
        anima: string,
    ): PromptPart {
        const part: PromptPart = {
            id: uuidv4(),
            categoryId,
            label,
            values: { anima: normalizeAnimaTagForStorage(anima) },
        }
        library.value.push(part)
        return part
    }

    function updatePart(partId: string, changes: Partial<Omit<PromptPart, 'id'>>): void {
        const part = library.value.find((p) => p.id === partId)
        if (!part) return
        if (changes.label !== undefined) part.label = changes.label
        if (changes.categoryId !== undefined) part.categoryId = changes.categoryId
        if (changes.values) {
            part.values = {
                ...part.values,
                ...changes.values,
                anima:
                    changes.values.anima !== undefined
                        ? normalizeAnimaTagForStorage(changes.values.anima)
                        : part.values.anima,
            }
        }
    }

    /**
     * マスターパーツを削除する。
     * 使用中チェックは呼び出し元（UI）で行い、確認済みの場合のみ呼ぶ。
     */
    function deletePart(partId: string): void {
        removePartFromAllSlots(partId)
        library.value = library.value.filter((p) => p.id !== partId)
    }

    function removePartFromAllSlots(partId: string): void {
        forEachSlot((slot) => {
            for (const sid of SECTION_IDS) {
                slot.sections[sid] = slot.sections[sid].filter((p) => p.partId !== partId)
            }
        })
    }

    // ─── Actions: スロット (positive / negative 単一) ──────────
    function setFreeText(kind: SlotKind, text: string): void {
        getSlot(kind).freeText = text
    }

    function setDatasetTag(tag: string): void {
        positive.value.datasetTag = normalizeDatasetTag(tag)
    }

    function setRating(rating: Rating | null): void {
        positive.value.rating = rating
    }

    // ─── Actions: スロット内パーツ ────────────────────────────

    /**
     * 指定 kind のスロットの指定 section にパーツを追加する
     * - 未指定の sectionId はパーツの categoryId から自動解決
     */
    function addPartToSlot(
        kind: SlotKind,
        partId: string,
        sectionId?: SectionId,
        insertIndex?: number,
    ): SelectedPart | undefined {
        const slot = getSlot(kind)

        let resolvedSection: SectionId
        if (sectionId) {
            resolvedSection = sectionId
        } else if (isRandomizerPartId(partId)) {
            const catId = categoryIdFromRandomizer(partId)
            resolvedSection = resolveSection(catId)
        } else {
            const master = library.value.find((p) => p.id === partId)
            if (!master) return undefined
            resolvedSection = resolveSectionForTag(master.categoryId, master.values.anima)
        }

        const inst: SelectedPart = {
            id: uuidv4(),
            partId,
            weight: DEFAULT_PART_WEIGHT,
            enabled: true,
        }
        const list = slot.sections[resolvedSection]
        if (insertIndex !== undefined && insertIndex >= 0 && insertIndex <= list.length) {
            list.splice(insertIndex, 0, inst)
        } else {
            list.push(inst)
        }
        return inst
    }

    function findInstance(
        kind: SlotKind,
        instanceId: string,
    ): { slot: Slot; sectionId: SectionId; part: SelectedPart } | undefined {
        const slot = getSlot(kind)
        for (const sid of SECTION_IDS) {
            const part = slot.sections[sid].find((p) => p.id === instanceId)
            if (part) return { slot, sectionId: sid, part }
        }
        return undefined
    }

    function togglePart(kind: SlotKind, instanceId: string): void {
        const found = findInstance(kind, instanceId)
        if (found) found.part.enabled = !found.part.enabled
    }

    function setPartWeight(kind: SlotKind, instanceId: string, weight: number): void {
        const found = findInstance(kind, instanceId)
        if (found) found.part.weight = Math.round(weight * 100) / 100
    }

    function removePartFromSlot(kind: SlotKind, instanceId: string): void {
        const slot = getSlot(kind)
        for (const sid of SECTION_IDS) {
            slot.sections[sid] = slot.sections[sid].filter((p) => p.id !== instanceId)
        }
    }

    function reorderSectionParts(
        kind: SlotKind,
        sectionId: SectionId,
        newParts: SelectedPart[],
    ): void {
        const slot = getSlot(kind)
        // セクション間ドラッグで他セクションに同一 id のパーツが残らないように除去する。
        // VueDraggable の update:model-value は source / target 双方で発火するが、
        // タイミングによってソース側に幽霊パーツが残ることがあるため防御的に同期する。
        const newIds = new Set(newParts.map((p) => p.id))
        for (const sid of SECTION_IDS) {
            if (sid === sectionId) continue
            const list = slot.sections[sid]
            if (list.some((p) => newIds.has(p.id))) {
                slot.sections[sid] = list.filter((p) => !newIds.has(p.id))
            }
        }
        slot.sections[sectionId] = newParts
    }

    /**
     * スロット内のセクションを走査し、同一 id のパーツが複数セクションに存在する場合は最初の 1 つだけ残す。
     * セクション間ドラッグ直後に最終的な整合性を保証するための保険処理。
     */
    function dedupeSlotInstances(kind: SlotKind): void {
        const slot = getSlot(kind)
        const seen = new Set<string>()
        for (const sid of SECTION_IDS) {
            const list = slot.sections[sid]
            const next: SelectedPart[] = []
            let changed = false
            for (const p of list) {
                if (seen.has(p.id)) {
                    changed = true
                    continue
                }
                seen.add(p.id)
                next.push(p)
            }
            if (changed) slot.sections[sid] = next
        }
    }

    // ─── Actions: AI インポート ───────────────────────────────
    /**
     * AI インポート結果をマージする。
     * - 新規カテゴリ / パーツは追加
     * - section 単位で仕分け済みのパーツを各スロットに追加
     * - freeText は既存値に追記、datasetTag / rating はインポート値がある時のみ上書き
     */
    function mergeAIImportResult(payload: {
        newCategories: Category[]
        newParts: PromptPart[]
        positive: Record<SectionId, SelectedPart[]>
        negative: Record<SectionId, SelectedPart[]>
        positiveFreeText?: string
        negativeFreeText?: string
        datasetTag?: string
        rating?: Rating | null
    }): void {
        categories.value.push(...payload.newCategories)
        library.value.push(
            ...payload.newParts.map((p) => ({
                ...p,
                values: { ...p.values, anima: normalizeAnimaTagForStorage(p.values.anima) },
            })),
        )

        for (const sid of SECTION_IDS) {
            positive.value.sections[sid].push(...payload.positive[sid])
            negative.value.sections[sid].push(...payload.negative[sid])
        }

        if (payload.positiveFreeText) {
            positive.value.freeText = positive.value.freeText
                ? `${positive.value.freeText}\n${payload.positiveFreeText}`
                : payload.positiveFreeText
        }
        if (payload.negativeFreeText) {
            negative.value.freeText = negative.value.freeText
                ? `${negative.value.freeText}\n${payload.negativeFreeText}`
                : payload.negativeFreeText
        }
        if (payload.datasetTag) {
            positive.value.datasetTag = normalizeDatasetTag(payload.datasetTag)
        }
        if (payload.rating !== undefined && payload.rating !== null) {
            positive.value.rating = payload.rating
        }
    }

    return {
        // state
        version,
        categories,
        library,
        positive,
        negative,
        loadCount,
        // getters
        getPartsByCategory,
        getMasterPart,
        getSlot,
        isPartUsedInSlots,
        findInstance,
        // actions
        initFromData,
        getFullState,
        addCategory,
        updateCategory,
        deleteCategory,
        reorderCategories,
        addPart,
        updatePart,
        deletePart,
        setFreeText,
        setDatasetTag,
        setRating,
        addPartToSlot,
        togglePart,
        setPartWeight,
        removePartFromSlot,
        reorderSectionParts,
        dedupeSlotInstances,
        mergeAIImportResult,
    }
})
