<script setup lang="ts">
import type { FieldSpec } from '~/components/editor/schema'
import { GHOST, ICON_BTN } from './classes'

/* Field renders record lists and a record list renders fields: the cycle is
   broken by loading the inner one lazily. */
const EditorField = defineAsyncComponent(() => import('./Field.vue'))

/**
 * A list of items that each have several fields — steps, cards, events.
 * Each item is a small card of fields; the list can reorder, add and remove
 * unless the spec says the length is fixed (researched links keep their
 * count because a person cannot verify a new URL the way research did).
 */
const props = defineProps<{
  spec: FieldSpec
  modelValue: unknown[]
}>()

const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>[]] }>()

const items = computed<Record<string, unknown>[]>(() =>
  props.modelValue.map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : {})),
)

const fields = computed(() => props.spec.item ?? [])

function blank(): Record<string, unknown> {
  const record: Record<string, unknown> = {}
  for (const field of fields.value) {
    record[field.key] = field.kind === 'string-list' || field.kind === 'record-list' ? [] : field.kind === 'number' ? null : ''
  }
  return record
}

function setField(index: number, key: string, value: unknown): void {
  const next = items.value.map((item, i) => (i === index ? { ...item, [key]: value } : item))
  emit('update:modelValue', next)
}

function add(): void {
  emit('update:modelValue', [...items.value, blank()])
}

function removeAt(index: number): void {
  emit('update:modelValue', items.value.filter((_, i) => i !== index))
}

function shift(index: number, delta: number): void {
  const target = index + delta
  if (target < 0 || target >= items.value.length) return
  const next = [...items.value]
  const [item] = next.splice(index, 1)
  if (!item) return
  next.splice(target, 0, item)
  emit('update:modelValue', next)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      v-for="(item, index) in items"
      :key="index"
      class="rounded-[14px] bg-surface-mute p-3 shadow-[inset_0_0_0_1px_var(--border)]"
    >
      <div class="mb-2 flex items-center gap-1">
        <span class="text-[11px] font-medium text-text-faint tabular-nums">{{ index + 1 }}</span>
        <span class="flex-1" />
        <button
          type="button"
          :class="ICON_BTN"
          title="Move up"
          aria-label="Move up"
          :disabled="index === 0"
          @click="shift(index, -1)"
        >
          <UiIcon
            name="chevron-up"
            :size="13"
          />
        </button>
        <button
          type="button"
          :class="ICON_BTN"
          title="Move down"
          aria-label="Move down"
          :disabled="index === items.length - 1"
          @click="shift(index, 1)"
        >
          <UiIcon
            name="chevron-down"
            :size="13"
          />
        </button>
        <button
          v-if="!spec.fixedLength"
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

      <div class="flex flex-col gap-2.5">
        <EditorField
          v-for="field in fields"
          :key="field.key"
          :spec="field"
          :model-value="item[field.key]"
          :siblings="item"
          nested
          @update:model-value="setField(index, field.key, $event)"
        />
      </div>
    </div>

    <button
      v-if="!spec.fixedLength"
      type="button"
      :class="[GHOST, 'self-start']"
      @click="add"
    >
      <UiIcon
        name="plus"
        :size="12"
      />
      Add another
    </button>
  </div>
</template>
