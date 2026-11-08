<script setup lang="ts">
import type { Assessment, AttemptResponse } from '~/types/api'

/**
 * A 200–400 word brief, graded against its rubric. Submits `{text}`.
 * The word counter tracks the target the generator writes to.
 */
const { t } = useI18n()
const props = defineProps<{
  assessment: Assessment
  disabled?: boolean
}>()

const model = defineModel<AttemptResponse | null>({ default: null })

const text = ref('')

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

const tone = computed(() => {
  if (words.value === 0) return 'text-text-faint'
  if (words.value < 120) return 'text-warn'
  if (words.value > 600) return 'text-warn'
  return 'text-success'
})

const criteria = computed(() => props.assessment.rubric ?? [])
</script>

<template>
  <div class="flex flex-col gap-2">
    <UiTextField
      v-model="text"
      multiline
      :rows="10"
      :maxlength="40000"
      :disabled="disabled"
      :placeholder="t('check.assess.essayPlaceholder')"
      :aria-label="assessment.prompt"
    />

    <div class="flex flex-wrap items-center justify-between gap-2">
      <p :class="['num text-[11.5px]', tone]">
        {{ t('check.assess.words', words) }}
        <span class="text-text-faint">{{ t('check.assess.target') }}</span>
      </p>
      <p
        v-if="criteria.length"
        class="text-[11.5px] text-text-faint"
      >
        {{ t('check.assess.judged', criteria.length) }}
      </p>
    </div>
  </div>
</template>
