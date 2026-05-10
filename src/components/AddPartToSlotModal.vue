<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal__header">
        <span class="modal__title">{{ title }}</span>
        <button class="icon-btn" @click="$emit('close')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>

      <div class="search-wrap">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <input
          v-model="search"
          class="search-input"
          type="text"
          placeholder="パーツを検索..."
        />
        <button v-if="search" class="search-clear" @click="search = ''">×</button>
      </div>

      <div class="modal__body">
        <div class="category-list">
          <div
            v-for="cat in categories"
            :key="cat.id"
            class="category-group"
          >
            <div
              class="category-header"
              :style="{ borderLeftColor: cat.color }"
              @click="toggleCategory(cat.id)"
            >
              <span class="category-color-dot" :style="{ background: cat.color }"></span>
              <span class="category-name">{{ cat.name }}</span>
              <svg
                class="category-chevron"
                :class="{ 'category-chevron--open': openCategories.has(cat.id) }"
                width="12" height="12" viewBox="0 0 24 24" fill="currentColor"
              >
                <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
              </svg>
            </div>

            <div v-if="openCategories.has(cat.id)" class="parts-list">
              <div
                v-for="element in getPartsWithRandomizer(cat.id)"
                :key="element.id"
                class="library-part"
                :style="{ borderLeftColor: cat.color }"
                @click="addPart(element.id)"
              >
                <template v-if="isRandomizerPartId(element.id)">
                  <span class="randomizer-icon">🎲</span>
                  <span class="library-part__label">{{ element.label }}</span>
                  <span class="library-part__tag library-part__tag--randomizer">RANDOM</span>
                </template>
                <template v-else>
                  <span class="add-icon">+</span>
                  <span class="library-part__label">{{ element.label }}</span>
                  <span class="library-part__tag">{{ element.values.anima }}</span>
                </template>
              </div>

              <div
                v-if="getPartsForCategory(cat.id).length === 0"
                class="parts-empty"
              >
                パーツがありません
              </div>
            </div>
          </div>

          <div v-if="categories.length === 0" class="parts-empty" style="padding: 24px;">
            見つかりませんでした
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { usePromptStore } from '../store/promptStore'
import type { CharacterFieldId, PromptPart } from '../types'
import type { SectionId } from '../data/sections'
import { randomizerPartId, isRandomizerPartId } from '../types'

const props = defineProps<{
  slotKind?: 'positive' | 'negative'
  /** 明示的に追加先 section を指定したい場合。省略時は categoryId から自動解決。 */
  sectionId?: SectionId
  characterId?: string
  characterFieldId?: CharacterFieldId
  title?: string
}>()

const emit = defineEmits<{
  close: []
  added: []
}>()

const store = usePromptStore()
const search = ref('')

const title = computed(() => props.title ?? 'スロットへパーツを追加')

const catParts = ref<Record<string, PromptPart[]>>({})

watch(
  () => [store.library, search.value, store.categories] as const,
  ([library, searchVal, cats]) => {
    const next: Record<string, PromptPart[]> = {}
    for (const cat of cats) {
      const parts = library.filter((p: PromptPart) => p.categoryId === cat.id)
      if (!searchVal) {
        next[cat.id] = parts
      } else {
        const lower = searchVal.toLowerCase()
        next[cat.id] = parts.filter((p: PromptPart) =>
          p.label.toLowerCase().includes(lower) ||
          p.values.anima.toLowerCase().includes(lower)
        )
      }
    }
    catParts.value = next
  },
  { deep: true, immediate: true }
)

const categories = computed(() =>
  store.categories.filter(cat => {
    const parts = catParts.value[cat.id] || []
    return parts.length > 0 || cat.name.toLowerCase().includes(search.value.toLowerCase())
  })
)

function getPartsForCategory(categoryId: string): PromptPart[] {
  return catParts.value[categoryId] || []
}

function getPartsWithRandomizer(categoryId: string): PromptPart[] {
  const cat = store.categories.find(c => c.id === categoryId)
  if (!cat) return getPartsForCategory(categoryId)
  const randPart: PromptPart = {
    id: randomizerPartId(categoryId),
    categoryId,
    label: `${cat.name} @ランダマイザ`,
    values: { anima: '' },
  }
  return [randPart, ...getPartsForCategory(categoryId)]
}

const openCategories = ref(new Set<string>())
// 初期状態で最初のカテゴリを開く
if (store.categories.length > 0) {
  openCategories.value.add(store.categories[0].id)
}

function toggleCategory(id: string): void {
  if (openCategories.value.has(id)) {
    openCategories.value.delete(id)
  } else {
    openCategories.value.add(id)
  }
}

// 検索時は全件開くようにする
watch(search, (newVal) => {
  if (newVal) {
    for (const cat of categories.value) {
      openCategories.value.add(cat.id)
    }
  } else {
    // 検索を空にしたら、最初のカテゴリだけ開いた状態に戻す
    openCategories.value.clear()
    if (store.categories.length > 0) {
      openCategories.value.add(store.categories[0].id)
    }
  }
})

function addPart(partId: string) {
  if (props.characterId && props.characterFieldId) {
    store.addPartToCharacter(props.characterId, props.characterFieldId, partId)
  } else if (props.slotKind) {
    store.addPartToSlot(props.slotKind, partId, props.sectionId)
  }
  emit('added')
  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
  padding: 16px;
}

.modal {
  background: #111827;
  border: 1px solid #374151;
  border-radius: 12px;
  width: 500px;
  max-width: 100%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  animation: modal-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modal-in {
  from { opacity: 0; transform: translateY(10px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid #1f2937;
}

.modal__title {
  font-size: 1rem;
  font-weight: 700;
  color: #e5e7eb;
}

.icon-btn {
  background: transparent;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: color 0.15s;
}

.icon-btn:hover { color: #d1d5db; }

/* 検索 */
.search-wrap {
  position: relative;
  padding: 12px 20px;
  border-bottom: 1px solid #1f2937;
  background: #0f172a;
}
.search-icon {
  position: absolute;
  left: 28px;
  top: 50%;
  transform: translateY(-50%);
  color: #4b5563;
  pointer-events: none;
}
.search-input {
  width: 100%;
  box-sizing: border-box;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 6px;
  padding: 8px 32px 8px 32px;
  font-size: 0.85rem;
  color: #e5e7eb;
  outline: none;
}
.search-input:focus { border-color: #6366f1; }
.search-clear {
  position: absolute;
  right: 28px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: #6b7280;
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
}

/* ボディ */
.modal__body {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 300px;
}

/* カテゴリリスト */
.category-group { border-bottom: 1px solid #1a2236; }
.category-header {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 20px; cursor: pointer;
  border-left: 3px solid transparent; transition: background 0.15s;
  user-select: none;
}
.category-header:hover { background: #1a2236; }
.category-color-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.category-name { flex: 1; font-size: 0.85rem; font-weight: 600; color: #d1d5db; }
.category-chevron { color: #4b5563; transition: transform 0.2s; }
.category-chevron--open { transform: rotate(180deg); }
.parts-list { padding: 4px 16px 6px; }

.library-part {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; margin-bottom: 4px;
  border-radius: 6px; border-left: 2px solid transparent;
  background: #1a2236; cursor: pointer; transition: background 0.15s;
  user-select: none;
}
.library-part:hover { background: #223048; }
.add-icon { color: #6b7280; flex-shrink: 0; font-weight: bold; font-size: 1.1rem; }

.library-part__label { font-size: 0.85rem; color: #d1d5db; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.library-part__tag { font-size: 0.7rem; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px; }

.parts-empty { font-size: 0.8rem; color: #374151; padding: 12px 20px; text-align: center; }

.library-part--randomizer { background: #1a1a2e; border-left-width: 2px; border-style: dashed; border-color: #374151; border-left-style: solid; }
.library-part--randomizer:hover { background: #252540; }
.randomizer-icon { font-size: 0.9rem; flex-shrink: 0; }
.library-part__tag--randomizer { font-size: 0.65rem; font-weight: 700; color: #a78bfa; background: #2e1065; padding: 2px 6px; border-radius: 3px; letter-spacing: 0.05em; }

@media (max-width: 768px) {
  .modal-overlay {
    padding: 8px;
    align-items: flex-start;
  }
  .modal {
    width: 100%;
    margin-top: 8px;
    max-height: calc(100vh - 60px); /* Leave room for mobile nav below */
  }
  .modal__body {
    min-height: auto;
    padding: 12px 8px;
  }
}
</style>
