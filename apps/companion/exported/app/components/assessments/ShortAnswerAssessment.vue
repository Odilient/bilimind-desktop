<script setup lang="ts">
import type { Assessment, AttemptResponse } from '~/types/api'

/**
 * Two to four sentences, graded against the rubric the generator wrote beside
 * the question. Submits `{text}`.
 */
const props = withDefaults(
  defineProps<{
    assessment: Assessment
    disabled?: boolean
    rows?: number
    placeholder?: string
    maxlength?: number
  }>(),
  { rows: 4, maxlength: 5000 },
)

const model = defineModel<AttemptResponse | null>({ default: null })

const text = ref('')

/** Keep the field in step when the parent restores a previous answer. */
watch(
  model,
  (value) => {
    const next = (value as { text?: unknown } | null)?.text
    if (typeof next === 'string' && next !== text.value) text.value = next
  },
  { immediate: true },
)

watch(text, (value) => {
  model.value = value.trim() === '' ? null : { text: value }
})

const words = computed(() => (text.value.trim() === '' ? 0 : text.value.trim().split(/\s+/).length))
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <UiTextField
      v-model="text"
      multiline
      :rows="rows"
      :maxlength="maxlength"
      :disabled="disabled"
      :placeholder="placeholder ?? 'Answer in two to four sentences.'"
      :aria-label="assessment.prompt"
    />
    <p class="num text-[11.5px] text-text-faint">{{ words }} {{ words === 1 ? 'word' : 'words' }}</p>
  </div>
</template>
