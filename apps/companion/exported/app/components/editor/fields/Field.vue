<script setup lang="ts">
import type { FieldSpec } from '~/components/editor/schema'
import { HINT, INPUT, LABEL } from './classes'
import MarkdownField from './MarkdownField.vue'
import StringListField from './StringListField.vue'
import RecordListField from './RecordListField.vue'
import TableField from './TableField.vue'

/**
 * One field of a block, rendered from its spec. Recursive: a record list's
 * items are made of fields too, so this component is what renders them.
 */
defineOptions({ name: 'EditorField' })

const props = defineProps<{
  spec: FieldSpec
  modelValue: unknown
  /** The whole payload, for fields that read a sibling (a table's columns). */
  siblings?: Record<string, unknown>
  /** Inside a list item: tighter labels, no required marker. */
  nested?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()

const uid = useId()

const text = computed(() => {
  const value = props.modelValue
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  return String(value)
})

const list = computed<unknown[]>(() => (Array.isArray(props.modelValue) ? props.modelValue : []))

const columns = computed<string[]>(() => {
  const key = props.spec.columnsKey
  const value = key ? props.siblings?.[key] : null
  return Array.isArray(value) ? value.map((item) => String(item ?? '')) : []
})

function onText(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement | HTMLTextAreaElement).value)
}

function onNumber(event: Event): void {
  const raw = (event.target as HTMLInputElement).value
  emit('update:modelValue', raw === '' ? null : Number(raw))
}
</script>

<template>
  <div>
    <label
      :for="uid"
      :class="[LABEL, nested && 'text-[11px]']"
    >
      {{ spec.label
      }}<span
        v-if="spec.required && !nested"
        class="font-normal text-text-faint"
      >
        · required</span
      >
    </label>

    <input
      v-if="spec.kind === 'text'"
      :id="uid"
      type="text"
      :class="INPUT"
      :value="text"
      :placeholder="spec.placeholder"
      @input="onText"
    />

    <textarea
      v-else-if="spec.kind === 'textarea' || spec.kind === 'code'"
      :id="uid"
      :class="[INPUT, 'grow', spec.kind === 'code' && 'font-mono text-[12.5px] leading-relaxed']"
      :rows="spec.kind === 'code' ? 6 : 3"
      :value="text"
      :placeholder="spec.placeholder"
      :spellcheck="spec.kind !== 'code'"
      @input="onText"
    />

    <MarkdownField
      v-else-if="spec.kind === 'markdown'"
      :id="uid"
      :model-value="text"
      :placeholder="spec.placeholder"
      @update:model-value="emit('update:modelValue', $event)"
    />

    <input
      v-else-if="spec.kind === 'number'"
      :id="uid"
      type="number"
      :class="[INPUT, 'max-w-[10rem]']"
      :value="text"
      :min="spec.min"
      :max="spec.max"
      @input="onNumber"
    />

    <select
      v-else-if="spec.kind === 'select'"
      :id="uid"
      :class="INPUT"
      :value="text"
      @change="onText"
    >
      <option
        v-for="option in spec.options ?? []"
        :key="option"
        :value="option"
      >
        {{ option }}
      </option>
    </select>

    <StringListField
      v-else-if="spec.kind === 'string-list'"
      :model-value="list"
      :placeholder="spec.placeholder"
      @update:model-value="emit('update:modelValue', $event)"
    />

    <RecordListField
      v-else-if="spec.kind === 'record-list'"
      :spec="spec"
      :model-value="list"
      @update:model-value="emit('update:modelValue', $event)"
    />

    <TableField
      v-else-if="spec.kind === 'table'"
      :columns="columns"
      :model-value="list"
      @update:model-value="emit('update:modelValue', $event)"
    />

    <p
      v-if="spec.hint"
      :class="HINT"
    >
      {{ spec.hint }}
    </p>
  </div>
</template>

<style scoped>
/* Grows with its content so a paragraph never scrolls inside a three-line box. */
textarea.grow {
  field-sizing: content;
  min-height: 4.25rem;
  max-height: 60vh;
  resize: vertical;
}
</style>
