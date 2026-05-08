<template>
  <div class="autocomplete-wrap" ref="wrapRef">
    <input
      v-model="inputValue"
      class="field-input"
      :placeholder="placeholder"
      @input="onInput"
      @focus="openDropdown"
      @keydown.down.prevent="moveHighlight(1)"
      @keydown.up.prevent="moveHighlight(-1)"
      @keydown.enter.prevent="selectHighlighted"
      @keydown.escape="showDropdown = false"
      @blur="onBlur"
      autocomplete="off"
    />
    <Transition name="dropdown">
      <ul
        v-if="showDropdown && suggestions.length > 0"
        :class="['autocomplete-dropdown', `autocomplete-dropdown--${dropdownDirection}`]"
      >
        <li
          v-for="(item, i) in suggestions"
          :key="item.tag"
          :class="['autocomplete-item', { 'autocomplete-item--active': i === highlightIndex }]"
          @mousedown.prevent="selectItem(item)"
          @mouseenter="highlightIndex = i"
        >
          <span class="autocomplete-item__label">{{ item.label }}</span>
          <span class="autocomplete-item__tag">{{ item.tag }}</span>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import type { DictEntry } from '../utils/dictionaryService'

const props = defineProps<{
  modelValue: string
  placeholder?: string
  searchFn: (query: string) => DictEntry[]
  debounceMs?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  select: [entry: DictEntry]
  blur: [event: FocusEvent]
}>()

const inputValue = ref(props.modelValue)
const suggestions = ref<DictEntry[]>([])
const showDropdown = ref(false)
const highlightIndex = ref(-1)
const wrapRef = ref<HTMLElement>()
const dropdownDirection = ref<'down' | 'up'>('down')

let debounceTimer: ReturnType<typeof setTimeout> | null = null
const DROPDOWN_MAX_HEIGHT = 260

watch(() => props.modelValue, (v) => {
  if (v !== inputValue.value) inputValue.value = v
})

function onBlur(e: FocusEvent): void {
  emit('blur', e)
}

function onInput(): void {
  emit('update:modelValue', inputValue.value)
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    const q = inputValue.value.trim()
    if (!q) {
      suggestions.value = []
      showDropdown.value = false
      return
    }
    suggestions.value = props.searchFn(q)
    highlightIndex.value = -1
    if (suggestions.value.length > 0) {
      updateDropdownDirection()
      showDropdown.value = true
    } else {
      showDropdown.value = false
    }
  }, props.debounceMs ?? 250)
}

function updateDropdownDirection(): void {
  const wrap = wrapRef.value
  if (!wrap) return

  const rect = wrap.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top
  dropdownDirection.value =
    spaceBelow < DROPDOWN_MAX_HEIGHT + 16 && spaceAbove > spaceBelow ? 'up' : 'down'
}

async function openDropdown(): Promise<void> {
  if (suggestions.value.length === 0) return
  await nextTick()
  updateDropdownDirection()
  showDropdown.value = true
}

function moveHighlight(delta: number): void {
  if (suggestions.value.length === 0) return
  let next = highlightIndex.value + delta
  if (next < 0) next = suggestions.value.length - 1
  if (next >= suggestions.value.length) next = 0
  highlightIndex.value = next
}

function selectHighlighted(): void {
  if (highlightIndex.value >= 0 && highlightIndex.value < suggestions.value.length) {
    selectItem(suggestions.value[highlightIndex.value])
  }
}

function selectItem(entry: DictEntry): void {
  emit('select', entry)
  showDropdown.value = false
  highlightIndex.value = -1
}

// 外部クリックでドロップダウンを閉じる
function onDocClick(e: MouseEvent): void {
  if (wrapRef.value && !wrapRef.value.contains(e.target as Node)) {
    showDropdown.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))
</script>

<style scoped>
.autocomplete-wrap {
  position: relative;
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

.autocomplete-dropdown {
  position: absolute;
  left: 0;
  right: 0;
  max-height: 260px;
  overflow-y: auto;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 6px;
  list-style: none;
  padding: 4px 0;
  margin: 0;
  z-index: 100;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}

.autocomplete-dropdown--down {
  top: calc(100% + 4px);
}

.autocomplete-dropdown--up {
  bottom: calc(100% + 4px);
}

.autocomplete-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background 0.1s;
}

.autocomplete-item:hover,
.autocomplete-item--active {
  background: #374151;
}

.autocomplete-item__label {
  color: #e5e7eb;
}

.autocomplete-item__tag {
  color: #6b7280;
  font-size: 0.72rem;
  margin-left: 8px;
  flex-shrink: 0;
}

/* Transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.12s, transform 0.12s;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
