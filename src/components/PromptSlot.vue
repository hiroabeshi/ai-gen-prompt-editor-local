<template>
  <div class="slot-card" :class="`slot-card--${kind}`">
    <!-- スロットヘッダー -->
    <div class="slot-header">
      <div class="slot-header__left">
        <span class="slot-type-badge" :class="kind === 'negative' ? 'badge--neg' : 'badge--pos'">
          {{ kind === 'negative' ? 'NEG' : 'POS' }}
        </span>
        <span class="slot-name">{{ kind === 'negative' ? 'ネガティブ' : 'ポジティブ' }}</span>
      </div>
      <div class="slot-header__actions">
        <button class="icon-btn icon-btn--blue" @click="copyPrompt" :disabled="!promptCopy">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
          <span class="btn-text">プロンプトをコピー</span>
        </button>
      </div>
    </div>

    <!-- プロンプト出力プレビュー -->
    <div class="prompt-preview" :title="promptCopy">
      {{ promptPreview || '\u00A0' }}
    </div>

    <div v-if="kind === 'positive' && characterWarnings.length > 0" class="warning-strip">
      <span v-for="warning in characterWarnings" :key="warning" class="warning-chip">
        {{ warning }}
      </span>
    </div>

    <div v-if="kind === 'positive'" class="slot-tabs">
      <button
        class="slot-tab"
        :class="{ 'slot-tab--active': activePanel === 'main' }"
        @click="activePanel = 'main'"
      >
        全体
      </button>
      <button
        class="slot-tab"
        :class="{ 'slot-tab--active': activePanel === 'characters' }"
        @click="activePanel = 'characters'"
      >
        キャラ
      </button>
    </div>

    <template v-if="showMainPanel">
    <!-- ポジティブ専用: レーティング / データセットタグ -->
    <div v-if="kind === 'positive'" class="slot-meta">
      <div class="meta-row">
        <label class="meta-label">レーティング</label>
        <div class="rating-group">
          <label
            v-for="r in RATINGS"
            :key="r.id"
            class="rating-opt"
            :class="{ 'rating-opt--active': slot.rating === r.id }"
          >
            <input
              type="radio"
              name="rating"
              :value="r.id"
              :checked="slot.rating === r.id"
              @change="store.setRating(r.id)"
            />
            <span>{{ r.label }}</span>
          </label>
          <label
            class="rating-opt"
            :class="{ 'rating-opt--active': slot.rating == null }"
          >
            <input
              type="radio"
              name="rating"
              value=""
              :checked="slot.rating == null"
              @change="store.setRating(null)"
            />
            <span>未指定</span>
          </label>
        </div>
      </div>
      <div class="meta-row">
        <label class="meta-label">データセット</label>
        <select
          class="meta-input"
          :value="slot.datasetTag ?? ''"
          @change="onDatasetChange"
        >
          <option value="">未指定</option>
          <option value="deviantart">deviantart</option>
          <option value="ye-pop">ye-pop</option>
        </select>
      </div>
    </div>

    <!-- セクション単位のパーツリスト -->
    <div class="sections-area">
      <div v-for="sid in mainSectionIds" :key="sid" class="section-block">
        <div class="section-header">
          <span class="section-label">{{ SECTION_LABELS[sid] }}</span>
          <span class="section-count">{{ slot.sections[sid].length }}</span>
          <button
            class="section-add-btn"
            :title="`${SECTION_LABELS[sid]} にパーツを追加`"
            @click="$emit('open-add-part', kind, sid)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
          </button>
        </div>
        <VueDraggable
          :key="`${kind}-${sid}-${remountKey}`"
          :model-value="sectionSnapshots[sid]"
          @update:model-value="(v: SelectedPart[]) => onSectionUpdate(sid, v)"
          :group="{ name: `parts-${kind}`, put: ['library', `parts-${kind}`] }"
          handle=".drag-handle"
          item-key="id"
          :animation="150"
          :remove-on-spill="true"
          @end="(e: any) => onEnd(sid, e)"
          class="draggable-list"
          :class="{ 'draggable-list--empty': slot.sections[sid].length === 0 }"
          ghost-class="drag-ghost"
        >
          <PromptPart
            v-for="element in slot.sections[sid]"
            :key="`${sid}-${element.id}`"
            :part="element"
            :is-selected="selectedInstanceId === element.id"
            @select="(e) => $emit('select-part', element.id, e)"
            @toggle="store.togglePart(kind, element.id)"
            @update-weight="store.setPartWeight(kind, element.id, $event)"
            @remove="store.removePartFromSlot(kind, element.id)"
          />
        </VueDraggable>
        <div v-if="slot.sections[sid].length === 0" class="section-empty" aria-hidden="true">
          ここにドラッグ
        </div>
      </div>
    </div>

    <!-- 自由記述 -->
    <div v-if="kind === 'negative'" class="freetext-block">
      <label class="freetext-label">自由記述（自然言語・追加タグ）</label>
      <textarea
        class="freetext-input"
        :value="slot.freeText"
        @input="onFreeTextInput"
        rows="2"
        placeholder="例: worst quality, bad anatomy"
      ></textarea>
    </div>
    </template>

    <div v-if="kind === 'positive' && activePanel === 'characters'" class="characters-area">
      <div class="characters-toolbar">
        <span class="characters-title">キャラブロック</span>
        <button class="mini-btn" title="キャラを追加" @click="store.addCharacter()">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          キャラを追加
        </button>
      </div>

      <div
        v-for="(character, characterIndex) in store.characters"
        :key="character.id"
        class="character-block"
        :class="{ 'character-block--disabled': !character.enabled }"
      >
        <div class="character-header">
          <label class="character-enabled">
            <input
              type="checkbox"
              :checked="character.enabled"
              @change="updateCharacterEnabled(character.id, $event)"
            />
            <span>出力</span>
          </label>
          <input
            class="character-label-input"
            :value="character.label"
            @input="updateCharacterText(character.id, 'label', $event)"
          />
          <button
            v-if="store.characters.length > 1"
            class="icon-btn icon-btn--danger"
            title="キャラを削除"
            @click="store.removeCharacter(character.id)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
          </button>
        </div>

        <div class="character-meta-grid">
          <label class="character-field">
            <span>role</span>
            <select
              class="meta-input"
              :value="character.role"
              @change="updateCharacterText(character.id, 'role', $event)"
            >
              <option
                v-for="opt in ROLE_OPTIONS"
                :key="opt.value || 'empty'"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
          </label>
          <label class="character-field">
            <span>position</span>
            <select
              class="meta-input"
              :value="character.position"
              @change="updateCharacterPosition(character.id, $event)"
            >
              <option
                v-for="opt in POSITION_OPTIONS"
                :key="opt.value || 'empty'"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
          </label>
          <label v-if="character.position === 'custom'" class="character-field">
            <span>custom</span>
            <input
              class="meta-input"
              :value="character.customPosition"
              placeholder="upper left"
              @input="updateCharacterText(character.id, 'customPosition', $event)"
            />
          </label>
        </div>

        <div class="character-fields">
          <div
            v-for="fieldId in CHARACTER_FIELD_IDS"
            :key="fieldId"
            class="character-part-field"
          >
            <div class="character-field-header">
              <span>{{ CHARACTER_FIELD_LABELS[fieldId] }}</span>
              <span class="section-count">{{ characterParts(character, fieldId).length }}</span>
              <button
                class="section-add-btn"
                :title="`${CHARACTER_FIELD_LABELS[fieldId]} にパーツを追加`"
                @click="openCharacterAdd(character.id, fieldId)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
              </button>
            </div>
            <VueDraggable
              :key="`${character.id}-${fieldId}-${characterRemountKey}`"
              :model-value="characterParts(character, fieldId)"
              @update:model-value="(v: SelectedPart[]) => onCharacterFieldUpdate(character.id, fieldId, v)"
              :group="{ name: 'character-parts', put: ['library', 'character-parts'] }"
              handle=".drag-handle"
              item-key="id"
              :animation="150"
              :remove-on-spill="true"
              @end="(e: any) => onCharacterEnd(character.id, fieldId, e)"
              class="draggable-list character-draggable-list"
              :class="{ 'draggable-list--empty': characterParts(character, fieldId).length === 0 }"
              ghost-class="drag-ghost"
            >
              <PromptPart
                v-for="element in characterParts(character, fieldId)"
                :key="`${fieldId}-${element.id}`"
                :part="element"
                :is-selected="selectedCharacterPartId === element.id"
                @select="() => onCharacterPartSelect(element.id)"
                @toggle="store.toggleCharacterPart(character.id, fieldId, element.id)"
                @update-weight="store.setCharacterPartWeight(character.id, fieldId, element.id, $event)"
                @remove="store.removeCharacterPart(character.id, fieldId, element.id)"
              />
            </VueDraggable>
            <div
              v-if="characterParts(character, fieldId).length === 0"
              class="section-empty"
              aria-hidden="true"
            >
              ここにドラッグ
            </div>
          </div>
        </div>

        <pre class="scoped-preview">{{ scopedPreview(character, characterIndex) || ' ' }}</pre>
      </div>
    </div>

    <div v-if="kind === 'positive'" class="relation-area">
      <label class="freetext-label">自然言語</label>
      <textarea
        class="freetext-input relation-input"
        :value="store.naturalLanguage"
        @input="onNaturalLanguageInput"
        rows="5"
        placeholder="例: The two girls stand on either side of the man."
      ></textarea>
    </div>

    <AddPartToSlotModal
      v-if="characterAddTarget"
      :character-id="characterAddTarget.characterId"
      :character-field-id="characterAddTarget.fieldId"
      :title="characterAddTitle"
      @close="closeCharacterAdd"
      @added="closeCharacterAdd"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import PromptPart from './PromptPart.vue'
import AddPartToSlotModal from './AddPartToSlotModal.vue'
import { usePromptStore } from '../store/promptStore'
import {
  generatePromptFromScene,
  generatePromptFromSlot,
  generateScopedClusterFromCharacter,
} from '../utils/promptGenerator'
import type {
  CharacterFieldId,
  CharacterPosition,
  CharacterPromptBlock,
  SelectedPart,
  Rating,
} from '../types'
import { CHARACTER_FIELD_IDS } from '../types'
import { SECTION_IDS, SECTION_LABELS, type SectionId } from '../data/sections'

type SlotKind = 'positive' | 'negative'

const props = defineProps<{
  kind: SlotKind
  selectedInstanceId: string | null
}>()

const emit = defineEmits<{
  'select-part': [instanceId: string, event: MouseEvent]
  copied: []
  'open-add-part': [kind: SlotKind, sectionId?: SectionId]
}>()

const store = usePromptStore()

const slot = computed(() => store.getSlot(props.kind))
const isPositive = computed(() => props.kind === 'positive')
const activePanel = ref<'main' | 'characters'>('main')
const showMainPanel = computed(() => props.kind === 'negative' || activePanel.value === 'main')
const mainSectionIds = computed<SectionId[]>(() =>
  props.kind === 'positive' ? SECTION_IDS.filter((sid) => sid !== 'character') : [...SECTION_IDS]
)

const RATINGS: { id: Rating; label: string }[] = [
  { id: 'safe', label: 'safe' },
  { id: 'sensitive', label: 'sensitive' },
  { id: 'nsfw', label: 'nsfw' },
  { id: 'explicit', label: 'explicit' },
]

const promptPreview = computed(() =>
  isPositive.value
    ? generatePromptFromScene(
      slot.value,
      store.characters,
      store.naturalLanguage,
      store.library,
      store.categories,
      true,
    )
    : generatePromptFromSlot(slot.value, store.library, store.categories, true)
)

const promptCopy = computed(() =>
  isPositive.value
    ? generatePromptFromScene(
      slot.value,
      store.characters,
      store.naturalLanguage,
      store.library,
    )
    : generatePromptFromSlot(slot.value, store.library)
)

const CHARACTER_FIELD_LABELS: Record<CharacterFieldId, string> = {
  character: 'キャラクター',
  appearance: '外見',
  outfit: '服装',
  expression: '表情',
  action: 'ポーズ・行動',
  item: '持ち物',
  other: 'その他',
}

const POSITION_OPTIONS: { value: CharacterPosition; label: string }[] = [
  { value: '', label: '未指定' },
  { value: 'left', label: 'left' },
  { value: 'center', label: 'center' },
  { value: 'right', label: 'right' },
  { value: 'top', label: 'top' },
  { value: 'bottom', label: 'bottom' },
  { value: 'foreground', label: 'foreground' },
  { value: 'background', label: 'background' },
  { value: 'custom', label: 'custom' },
]

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '未指定' },
  { value: 'girl', label: 'girl' },
  { value: 'boy', label: 'boy' },
  { value: 'woman', label: 'woman' },
  { value: 'man', label: 'man' },
  { value: 'female', label: 'female' },
  { value: 'male', label: 'male' },
  { value: 'other', label: 'other' },
]

const characterWarnings = computed(() => {
  const warnings: string[] = []
  for (const character of store.characters) {
    if (!character.enabled) continue
    if (!character.role.trim()) warnings.push(`${character.label}: role が未指定`)
    const hasPosition =
      character.position === 'custom'
        ? Boolean(character.customPosition?.trim())
        : Boolean(character.position)
    if (!hasPosition) warnings.push(`${character.label}: position が未指定`)
  }
  return warnings
})

// VueDraggable に Pinia の reactive 配列を直接渡すと内部的に splice で
// ミューテートされ、Vue の v-for 再レンダリングと DOM 操作が競合する。
// セクション毎に shallow copy を渡して隔離する。
const sectionSnapshots = computed<Record<SectionId, SelectedPart[]>>(() => {
  const result = {} as Record<SectionId, SelectedPart[]>
  for (const sid of SECTION_IDS) {
    result[sid] = [...slot.value.sections[sid]]
  }
  return result
})

// セクション間ドラッグ後、VueDraggable が残した DOM と Vue の v-for が競合するため、
// key を変更して全セクションを強制再マウントし、Pinia state に基づくクリーンな DOM を再構築する。
const remountKey = ref<number>(0)

function onSectionUpdate(sid: SectionId, newParts: SelectedPart[]): void {
  store.reorderSectionParts(props.kind, sid, newParts)
}

function onEnd(sid: SectionId, evt: any): void {
  const item = evt.item
  // 画面外ドロップ (remove-on-spill) による削除処理
  if (item && !item.parentNode) {
    if (evt.oldIndex !== undefined) {
      const current = slot.value.sections[sid]
      const newParts = [...current]
      newParts.splice(evt.oldIndex, 1)
      store.reorderSectionParts(props.kind, sid, newParts)
    }
    return
  }
  // セクション間ドラッグでは update:model-value のタイミング次第で
  // 同一 id のパーツが複数セクションに残ることがあるため、最終整合性を確保する。
  if (evt.from && evt.to && evt.from !== evt.to) {
    store.dedupeSlotInstances(props.kind)
    // VueDraggable が動かした DOM と Vue の v-for が競合した状態を解消するため、
    // 次ティックで全セクションを強制再マウントする。
    nextTick(() => {
      remountKey.value++
    })
  }
}

function onFreeTextInput(e: Event): void {
  store.setFreeText(props.kind, (e.target as HTMLTextAreaElement).value)
}

function onDatasetChange(e: Event): void {
  store.setDatasetTag((e.target as HTMLSelectElement).value)
}

const selectedCharacterPartId = ref<string | null>(null)
const characterRemountKey = ref<number>(0)
const characterAddTarget = ref<{ characterId: string; fieldId: CharacterFieldId } | null>(null)

const characterAddTitle = computed(() => {
  if (!characterAddTarget.value) return 'キャラへパーツを追加'
  return `${CHARACTER_FIELD_LABELS[characterAddTarget.value.fieldId]} にパーツを追加`
})

function characterParts(
  character: CharacterPromptBlock,
  fieldId: CharacterFieldId,
): SelectedPart[] {
  return character[fieldId]
}

function onCharacterFieldUpdate(
  characterId: string,
  fieldId: CharacterFieldId,
  newParts: SelectedPart[],
): void {
  store.reorderCharacterFieldParts(characterId, fieldId, newParts)
}

function onCharacterEnd(characterId: string, fieldId: CharacterFieldId, evt: any): void {
  const item = evt.item
  if (item && !item.parentNode && evt.oldIndex !== undefined) {
    const character = store.characters.find((c) => c.id === characterId)
    if (!character) return
    const newParts = [...character[fieldId]]
    newParts.splice(evt.oldIndex, 1)
    store.reorderCharacterFieldParts(characterId, fieldId, newParts)
    return
  }
  if (evt.from && evt.to && evt.from !== evt.to) {
    store.dedupeCharacterInstances()
    nextTick(() => {
      characterRemountKey.value++
    })
  }
}

function onCharacterPartSelect(instanceId: string): void {
  selectedCharacterPartId.value =
    selectedCharacterPartId.value === instanceId ? null : instanceId
}

function updateCharacterText(
  characterId: string,
  field: 'label' | 'role' | 'customPosition',
  e: Event,
): void {
  store.updateCharacter(characterId, {
    [field]: (e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value,
  })
}

function updateCharacterPosition(characterId: string, e: Event): void {
  store.updateCharacter(characterId, {
    position: (e.target as HTMLSelectElement).value as CharacterPosition,
  })
}

function updateCharacterEnabled(characterId: string, e: Event): void {
  store.updateCharacter(characterId, {
    enabled: (e.target as HTMLInputElement).checked,
  })
}

function openCharacterAdd(characterId: string, fieldId: CharacterFieldId): void {
  characterAddTarget.value = { characterId, fieldId }
}

function closeCharacterAdd(): void {
  characterAddTarget.value = null
}

function scopedPreview(character: CharacterPromptBlock, index: number): string {
  return generateScopedClusterFromCharacter(
    character,
    index,
    store.library,
    store.categories,
    true,
  )
}

function onNaturalLanguageInput(e: Event): void {
  store.setNaturalLanguage((e.target as HTMLTextAreaElement).value)
}

async function copyPrompt(): Promise<void> {
  if (!promptCopy.value) return
  try {
    await navigator.clipboard.writeText(promptCopy.value)
    emit('copied')
  } catch {
    // clipboard 失敗時は何もしない
  }
}
</script>

<style scoped>
.slot-card {
  background: #111827;
  border: 1px solid #1f2937;
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.slot-card--negative {
  border-top: 2px solid #991b1b;
}

.slot-card--positive {
  border-top: 2px solid #1d4ed8;
}

.slot-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: #1f2937;
  gap: 8px;
}

.slot-header__left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 4px;
}

.slot-type-badge {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 5px;
  border-radius: 4px;
  flex-shrink: 0;
  letter-spacing: 0.03em;
}

.badge--pos {
  background: #1e40af;
  color: #93c5fd;
}

.badge--neg {
  background: #7f1d1d;
  color: #fca5a5;
}

.slot-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: #e5e7eb;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.slot-header__actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.icon-btn {
  background: transparent;
  border: 1px solid #374151;
  color: #9ca3af;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.icon-btn--blue {
  border-color: #1e3a8a;
  color: #93c5fd;
}

.icon-btn--blue:hover:not(:disabled) {
  background: #172554;
  color: #bfdbfe;
  border-color: #1e40af;
}

.prompt-preview {
  font-size: 0.7rem;
  color: #6b7280;
  padding: 6px 10px;
  background: #0f172a;
  white-space: pre-wrap;
  overflow-y: auto;
  max-height: 140px;
  border-bottom: 1px solid #1f2937;
  line-height: 1.45;
}

.warning-strip {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  padding: 6px 10px;
  background: #1c1917;
  border-bottom: 1px solid #292524;
}

.warning-chip {
  color: #fbbf24;
  background: #451a03;
  border: 1px solid #78350f;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 0.68rem;
  font-weight: 600;
}

.slot-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 10px;
  background: #111827;
  border-bottom: 1px solid #1f2937;
}

.slot-tab {
  background: #0f172a;
  border: 1px solid #263244;
  color: #9ca3af;
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
}

.slot-tab:hover {
  background: #1f2937;
  color: #d1d5db;
}

.slot-tab--active {
  background: #172554;
  border-color: #1d4ed8;
  color: #bfdbfe;
}

/* ─── スロットメタ (rating / dataset) ─── */
.slot-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: #0f172a;
  border-bottom: 1px solid #1f2937;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.meta-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: #9ca3af;
  min-width: 78px;
  letter-spacing: 0.02em;
}

.rating-group {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  flex: 1;
}

.rating-opt {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 1px solid #374151;
  border-radius: 99px;
  font-size: 0.72rem;
  color: #9ca3af;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.rating-opt input {
  display: none;
}

.rating-opt:hover {
  background: #1f2937;
  color: #d1d5db;
}

.rating-opt--active {
  background: #312e81;
  color: #c4b5fd;
  border-color: #4c1d95;
}

.meta-input {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 6px;
  padding: 5px 8px;
  font-size: 0.78rem;
  color: #e5e7eb;
  outline: none;
  flex: 1;
  min-width: 120px;
}

.meta-input:focus {
  border-color: #6366f1;
}

/* ─── セクションエリア ─── */
.sections-area {
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section-block {
  border: 1px solid #1f2937;
  border-radius: 6px;
  background: #0f172a;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: #1a2236;
  border-bottom: 1px solid #1f2937;
}

.section-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: #9ca3af;
  flex: 1;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.section-count {
  font-size: 0.65rem;
  color: #6b7280;
  background: #111827;
  padding: 1px 6px;
  border-radius: 99px;
  min-width: 22px;
  text-align: center;
}

.section-add-btn {
  background: transparent;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 3px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: background 0.15s, color 0.15s;
}

.section-add-btn:hover {
  background: #1f2937;
  color: #d1d5db;
}

.draggable-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 4px 6px;
  min-height: 24px;
  position: relative;
}

.draggable-list--empty {
  min-height: 30px;
}

.section-empty {
  font-size: 0.7rem;
  color: #374151;
  text-align: center;
  padding: 0 0 6px;
  pointer-events: none;
  margin-top: -22px;
}

.drag-ghost {
  opacity: 0.3;
}

/* ─── キャラブロック ─── */
.characters-area,
.relation-area {
  padding: 8px 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.characters-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.characters-title {
  font-size: 0.78rem;
  font-weight: 700;
  color: #d1d5db;
}

.mini-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #0f172a;
  border: 1px solid #374151;
  color: #9ca3af;
  border-radius: 5px;
  padding: 5px 8px;
  font-size: 0.74rem;
  cursor: pointer;
}

.mini-btn:hover {
  background: #1f2937;
  color: #e5e7eb;
}

.character-block {
  border: 1px solid #263244;
  border-radius: 7px;
  background: #0f172a;
  overflow: hidden;
}

.character-block--disabled {
  opacity: 0.58;
}

.character-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  background: #1a2236;
  border-bottom: 1px solid #263244;
}

.character-enabled {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #9ca3af;
  font-size: 0.72rem;
  white-space: nowrap;
}

.character-enabled input {
  accent-color: #6366f1;
}

.character-label-input {
  flex: 1;
  min-width: 0;
  background: #111827;
  border: 1px solid #374151;
  border-radius: 5px;
  color: #e5e7eb;
  padding: 5px 7px;
  font-size: 0.8rem;
  font-weight: 700;
  outline: none;
}

.character-label-input:focus {
  border-color: #6366f1;
}

.icon-btn--danger:hover:not(:disabled) {
  background: #450a0a;
  color: #fca5a5;
  border-color: #7f1d1d;
}

.character-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 8px;
  border-bottom: 1px solid #1f2937;
}

.character-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.character-field span {
  color: #9ca3af;
  font-size: 0.68rem;
  font-weight: 700;
}

.character-fields {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  padding: 8px;
}

.character-part-field {
  border: 1px solid #1f2937;
  border-radius: 6px;
  background: #111827;
  overflow: hidden;
}

.character-field-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: #162033;
  border-bottom: 1px solid #1f2937;
}

.character-field-header > span:first-child {
  flex: 1;
  min-width: 0;
  color: #9ca3af;
  font-size: 0.7rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.character-draggable-list {
  min-height: 34px;
}

.character-free-text {
  padding: 0 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.scoped-preview {
  margin: 0;
  padding: 7px 8px;
  background: #020617;
  border-top: 1px solid #1f2937;
  color: #94a3b8;
  font-family: inherit;
  font-size: 0.72rem;
  white-space: pre-wrap;
  line-height: 1.45;
}

.relation-input {
  min-height: 120px;
}

/* ─── 自由記述 ─── */
.freetext-block {
  padding: 8px 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-top: 1px solid #1f2937;
}

.freetext-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: #9ca3af;
  letter-spacing: 0.02em;
}

.freetext-input {
  width: 100%;
  box-sizing: border-box;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 0.78rem;
  color: #e5e7eb;
  outline: none;
  resize: vertical;
  font-family: inherit;
  min-height: 48px;
}

.freetext-input:focus {
  border-color: #6366f1;
}

.freetext-input::placeholder {
  color: #4b5563;
}

@media (max-width: 768px) {
  .btn-text {
    display: none;
  }

  .icon-btn {
    padding: 6px;
  }

  .meta-label {
    min-width: 0;
    flex-basis: 100%;
  }

  .slot-tabs {
    padding: 7px 8px;
  }

  .slot-tab {
    flex: 1;
    padding: 6px 4px;
  }

  .character-meta-grid,
  .character-fields {
    grid-template-columns: 1fr;
  }

  .character-header {
    flex-wrap: wrap;
  }
}
</style>
