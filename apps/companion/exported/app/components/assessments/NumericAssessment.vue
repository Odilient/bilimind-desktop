<script setup lang="ts">
import type { Assessment, AttemptResponse } from '~/types/api'

/**
 * EXPAND §1 — one number. Submits `{value}` as typed.
 *
 * `inputmode="decimal"` rather than `type="number"`: a number input silently
 * discards what it cannot parse, so a learner typing "13,04" on a comma-decimal
 * keyboard would submit an empty string and be told they answered nothing. The
 * backend parses both conventions, thousands separators and a trailing unit — so
 * the honest thing here is to send exactly what they typed.
 *
 * The unit comes from `input_hint`, the only part of an answer key the API exposes.
 * It narrows nothing about the value and withholding it turns the question into a
 * guess about which unit we had in mind.
 */
const { t } = useI18n()
const props = defineProps<{
  assessment: Assessment
  disabled?: boolean
}>()

const model = defineModel<AttemptResponse | null>({ default: null })

const unit = computed(() => props.assessment.input_hint?.unit ?? null)

const value = computed<string>({
  get() {
    const current = model.value as { value?: unknown } | null

    return typeof current?.value === 'string' ? current.value : ''
  },
  set(next: string) {
    model.value = next.trim() === '' ? null : { value: next }
  },
})
</script>

<template>
  <div class="flex items-center gap-2">
    <input
      v-model="value"
      type="text"
      inputmode="decimal"
      autocomplete="off"
      spellcheck="false"
      :disabled="disabled"
      :aria-label="assessment.prompt"
      :placeholder="t('check.assess.numericPlaceholder')"
      class="num h-11 w-44 rounded-[14px] border border-border-field bg-surface-mute px-4 font-display text-[16px] font-semibold tabular-nums transition outline-none focus:border-hi-2 focus:bg-surface focus:shadow-[0_0_0_4px_rgb(255_212_71/0.45)] disabled:cursor-not-allowed disabled:opacity-60"
    />
    <span
      v-if="unit"
      class="text-[14px] font-medium text-text-soft"
      >{{ unit }}</span
    >
  </div>
</template>
