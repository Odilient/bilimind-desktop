<script setup lang="ts">
import type { DraftBlock } from '~/composables/useLessonEditor'
import { BLOCK_EDIT_SCHEMA } from './schema'
import EditorField from './fields/Field.vue'

/**
 * The form for one block, rendered from `BLOCK_EDIT_SCHEMA`. It knows nothing
 * about any particular type: the schema says which fields exist and the field
 * component says how each kind is edited.
 */
const props = defineProps<{ block: DraftBlock }>()

const emit = defineEmits<{
  /** The new payload, and which field changed (for undo coalescing). */
  update: [payload: Record<string, unknown>, field: string]
}>()

const specs = computed(() => BLOCK_EDIT_SCHEMA[props.block.type] ?? [])

function set(key: string, value: unknown): void {
  emit('update', { ...props.block.payload, [key]: value }, key)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <EditorField
      v-for="spec in specs"
      :key="spec.key"
      :spec="spec"
      :model-value="block.payload[spec.key]"
      :siblings="block.payload"
      @update:model-value="set(spec.key, $event)"
    />

    <p
      v-if="specs.length === 0"
      class="text-[13px] leading-relaxed text-text-muted"
    >
      This part is written by the model. Ask for what you want changed and it will be rewritten
      — your progress and past answers are kept.
    </p>
  </div>
</template>
