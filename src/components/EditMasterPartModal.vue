<template>
  <div class="transparent-overlay" @click.self="$emit('close')">
    <div class="modal" ref="modalRef" :style="{ top: `${adjustedY}px`, left: `${adjustedX}px` }">
      <div class="modal__header">
        <span class="modal__title">マスターパーツ編集</span>
        <button class="icon-btn" @click="$emit('close')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>

      <div class="modal__body">
        <!-- スロットに追加 -->
        <label class="field-label">スロットに追加</label>
        <div class="add-to-slot-group">
          <button class="btn-primary" @click="addToSlot('positive')">
            ポジティブへ
          </button>
          <button class="btn-primary btn-primary--neg" @click="addToSlot('negative')">
            ネガティブへ
          </button>
        </div>

        <div class="divider"></div>

        <label class="field-label">表示ラベル名</label>
        <AutocompleteInput
          v-model="editLabel"
          placeholder="例: 金髪ロング"
          :search-fn="suggestByLabel"
          @select="onSuggestLabelSelect"
          @blur="saveMaster"
        />
        <p class="field-hint">アプリ内で表示される名前</p>

        <label class="field-label mt">Anima タグ</label>
        <AutocompleteInput
          v-model="editAnima"
          placeholder="例: blonde hair, long hair"
          :search-fn="suggestByTag"
          @select="onSuggestTagSelect"
          @blur="saveMaster"
        />
        <p class="field-hint">AI に送信される実際の文字列</p>

        <label class="field-label mt">カテゴリ</label>
        <select class="field-input" v-model="editCategoryId" @change="saveMaster">
          <option v-for="cat in store.categories" :key="cat.id" :value="cat.id">
            {{ cat.name }}
          </option>
        </select>

        <!-- 削除 -->
        <div class="divider"></div>
        <button class="btn-danger" @click="confirmDelete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          マスターから削除
        </button>

        <!-- 削除確認ダイアログ -->
        <div v-if="showDeleteConfirm" class="confirm-box">
          <p class="confirm-msg">
            <strong>{{ editLabel }}</strong> を削除しますか？<br/>
            <span v-if="isUsed" class="confirm-warn">⚠️ このパーツはスロットで使用中です。削除すると全スロットから除去されます。</span>
          </p>
          <div class="confirm-actions">
            <button class="btn-danger btn-sm" @click="doDelete">削除する</button>
            <button class="btn-ghost btn-sm" @click="showDeleteConfirm = false">キャンセル</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, nextTick } from 'vue'
import { usePromptStore } from '../store/promptStore'
import AutocompleteInput from './AutocompleteInput.vue'
import { normalizeTagForAnima, suggestByLabel, suggestByTag, type DictEntry } from '../utils/dictionaryService'
import type { PromptPart } from '../types'

const props = defineProps<{
  partId: string
  x: number
  y: number
}>()

const emit = defineEmits<{
  close: []
  deleted: []
  'added-to-slot': []
}>()

const store = usePromptStore()

const masterPart = computed(() => store.getMasterPart(props.partId) as PromptPart | undefined)

const editLabel = ref('')
const editAnima = ref('')
const editCategoryId = ref('')

const modalRef = ref<HTMLElement | null>(null)
const adjustedX = ref(props.x)
const adjustedY = ref(props.y)

onMounted(() => {
  nextTick(() => {
    if (modalRef.value) {
      const rect = modalRef.value.getBoundingClientRect()
      let newX = props.x
      let newY = props.y
      
      if (newX + rect.width > window.innerWidth) {
        newX = window.innerWidth - rect.width - 16
      }
      if (newY + rect.height > window.innerHeight) {
        newY = window.innerHeight - rect.height - 16
      }
      
      adjustedX.value = Math.max(16, newX)
      adjustedY.value = Math.max(16, newY)
    }
  })
})

watch(
  masterPart,
  (p) => {
    if (p) {
      editLabel.value = p.label
      editAnima.value = p.values.anima
      editCategoryId.value = p.categoryId
    }
  },
  { immediate: true }
)

function saveMaster(): void {
  if (!masterPart.value) return
  editAnima.value = normalizeTagForAnima(editAnima.value)
  store.updatePart(masterPart.value.id, {
    label: editLabel.value,
    categoryId: editCategoryId.value,
    values: {
      anima: editAnima.value,
    },
  })
}

function onSuggestLabelSelect(entry: DictEntry): void {
  editLabel.value = entry.label
  saveMaster()
}

function onSuggestTagSelect(entry: DictEntry): void {
  editAnima.value = normalizeTagForAnima(entry.tag)
  saveMaster()
}

function addToSlot(kind: 'positive' | 'negative'): void {
  if (!masterPart.value) return
  store.addPartToSlot(kind, masterPart.value.id)
  emit('added-to-slot')
  emit('close')
}

const showDeleteConfirm = ref(false)
const isUsed = computed(() =>
  masterPart.value ? store.isPartUsedInSlots(masterPart.value.id) : false
)

function confirmDelete(): void {
  showDeleteConfirm.value = true
}

function doDelete(): void {
  if (!masterPart.value) return
  store.deletePart(masterPart.value.id)
  showDeleteConfirm.value = false
  emit('deleted')
  emit('close')
}
</script>

<style scoped>
.transparent-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
}

.modal {
  position: absolute;
  background: #111827;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  width: 320px;
  max-width: 95vw;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  animation: modal-in 0.15s ease-out;
}

@keyframes modal-in {
  from { opacity: 0; transform: scale(0.95) translateY(-10px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #1f2937;
}

.modal__title {
  font-size: 0.9rem;
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
}

.icon-btn:hover { color: #d1d5db; }

.modal__body {
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.field-label {
  display: block;
  font-size: 0.72rem;
  font-weight: 600;
  color: #9ca3af;
  margin-bottom: 4px;
  letter-spacing: 0.03em;
}

.field-label.mt {
  margin-top: 14px;
}

.field-input {
  width: 100%;
  box-sizing: border-box;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 6px;
  padding: 7px 10px;
  font-size: 0.82rem;
  color: #e5e7eb;
  outline: none;
}

.field-input:focus {
  border-color: #6366f1;
}

.field-hint {
  font-size: 0.68rem;
  color: #4b5563;
  margin: 3px 0 0;
}

.divider {
  height: 1px;
  background: #1f2937;
  margin: 14px 0;
}

.btn-danger {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #450a0a;
  color: #f87171;
  border: 1px solid #7f1d1d;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 0.82rem;
  cursor: pointer;
  width: 100%;
  justify-content: center;
  transition: background 0.15s;
}

.btn-danger:hover {
  background: #7f1d1d;
}

.btn-ghost {
  background: transparent;
  border: 1px solid #374151;
  color: #9ca3af;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-ghost:hover {
  background: #1f2937;
}

.btn-sm {
  padding: 5px 10px;
  font-size: 0.78rem;
}

.confirm-box {
  margin-top: 12px;
  padding: 12px;
  background: #1a0a0a;
  border: 1px solid #7f1d1d;
  border-radius: 8px;
}

.confirm-msg {
  font-size: 0.8rem;
  color: #d1d5db;
  margin: 0 0 10px;
  line-height: 1.5;
}

.confirm-warn {
  color: #fbbf24;
  font-size: 0.75rem;
}

.confirm-actions {
  display: flex;
  gap: 8px;
}

.add-to-slot-group {
  display: flex;
  gap: 8px;
}

.add-to-slot-group > .btn-primary {
  flex: 1;
}

.add-to-slot-select {
  flex: 1;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #4f46e5;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 0.82rem;
  cursor: pointer;
  justify-content: center;
  transition: background 0.15s;
}

.btn-primary:hover:not(:disabled) {
  background: #4338ca;
}

.btn-primary--neg {
  background: #be185d;
}

.btn-primary--neg:hover:not(:disabled) {
  background: #9d174d;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
