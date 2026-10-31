<script setup lang="ts">
import { GHOST, ICON_BTN, INPUT } from './classes'

/**
 * A list of short texts — key points, deliverables, columns. Enter in a row
 * adds the next one below it, because that is what a list feels like to type.
 */
const props = defineProps<{
  modelValue: unknown[]
  placeholder?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const rows = computed(() => props.modelValue.map((item) => (item === null || item === undefined ? '' : String(item))))

const inputs = ref<HTMLInputElement[]>([])

function update(next: string[], focusIndex: number | null = null): void {
  emit('update:modelValue', next)
  if (focusIndex !== null) {
    void nextTick(() => inputs.value[focusIndex]?.focus())
  }
}

function set(index: number, value: string): void {
  const next = [...rows.value]
  next[index] = value
  update(next)
}

function add(at: number): void {
  const next = [...rows.value]
  next.splice(at, 0, '')
  update(next, at)
}

function removeAt(index: number): void {
  const next = rows.value.filter((_, i) => i !== index)
  update(next.length ? next : [''], Math.max(0, index - 1))
}

function onBackspace(index: number, event: KeyboardEvent): void {
  if (rows.value[index] !== '' || rows.value.length === 1) return
  event.preventDefault()
  removeAt(index)
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div
      v-for="(row, index) in rows"
      :key="index"
      class="flex items-center gap-1.5"
    >
      <span
        class="w-4 shrink-0 text-right text-[11px] text-text-faint tabular-nums"
        aria-hidden="true"
        >{{ index + 1 }}</span
      >
      <input
        ref="inputs"
        type="text"
        :class="INPUT"
        :value="row"
        :placeholder="placeholder"
        @input="set(index, ($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="add(index + 1)"
        @keydown.backspace="onBackspace(index, $event)"
      />
      <button
        type="button"
        :class="ICON_BTN"
        title="Remove"
        aria-label="Remove"
        @click="removeAt(index)"
      >
        <UiIcon
          name="x"
          :size="13"
        />
      </button>
    </div>

    <button
      type="button"
      :class="[GHOST, 'self-start']"
      @click="add(rows.length)"
    >
      <UiIcon
        name="plus"
        :size="12"
      />
      Add another
    </button>
  </div>
</template>
