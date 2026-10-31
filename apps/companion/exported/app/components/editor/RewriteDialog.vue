<script setup lang="ts">
import { INPUT } from './fields/classes'

/**
 * "Rewrite with AI" for one part. The instruction is optional — an empty
 * request means "a fresh take" — and the presets are the four things people
 * actually ask for.
 */
const props = defineProps<{
  /** The block's label, for the title. */
  label: string
  busy?: boolean
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{ submit: [instruction: string] }>()

const instruction = ref('')

const PRESETS = [
  { label: 'simpler', instruction: 'Simpler. Plain words, shorter sentences, one idea at a time.' },
  { label: 'more concrete', instruction: 'More concrete — a real example instead of a general statement.' },
  { label: 'shorter', instruction: 'Shorter. Cut anything that is not load-bearing.' },
  { label: 'go deeper', instruction: 'Go deeper. Assume I already know the basics.' },
]

watch(open, (isOpen) => {
  if (isOpen) instruction.value = ''
})

function submit(): void {
  if (props.busy) return
  emit('submit', instruction.value)
}
</script>

<template>
  <UiModal
    v-model:open="open"
    size="compact"
    :title="`Rewrite this ${label.toLowerCase() || 'part'}`"
    description="Say what should change. Your progress and past answers are kept."
  >
    <textarea
      v-model="instruction"
      :class="[INPUT, 'mb-3']"
      rows="3"
      autofocus
      placeholder="e.g. make it about bees, add a step for the wiring, fix the second example"
      @keydown.enter.exact.prevent="submit"
    />

    <div class="mb-4 flex flex-wrap gap-1.5">
      <button
        v-for="preset in PRESETS"
        :key="preset.label"
        type="button"
        class="cursor-pointer rounded-full border border-border-strong bg-surface px-3 py-1 text-[12px] font-medium text-text-soft transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand"
        @click="instruction = preset.instruction"
      >
        {{ preset.label }}
      </button>
    </div>

    <div class="flex justify-end gap-2">
      <UiBtn
        variant="secondary"
        @click="open = false"
        >Cancel</UiBtn
      >
      <UiBtn
        variant="primary"
        icon="sparkles"
        :loading="busy"
        @click="submit"
        >Rewrite</UiBtn
      >
    </div>
  </UiModal>
</template>
