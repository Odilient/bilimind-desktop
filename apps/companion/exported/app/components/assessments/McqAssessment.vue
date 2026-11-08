<script setup lang="ts">
import type { Assessment, AttemptResponse } from '~/types/api'

/**
 * Single choice. Submits `{option_id}` — the shape SubmitAttemptRequest expects.
 * The correct option is never in the payload, so nothing here can reveal it.
 */
const { t } = useI18n()
const props = defineProps<{
  assessment: Assessment
  disabled?: boolean
}>()

const model = defineModel<AttemptResponse | null>({ default: null })

const options = computed(() => props.assessment.options ?? [])

const selected = computed<string | null>(() => {
  const value = model.value as { option_id?: unknown } | null
  return typeof value?.option_id === 'string' ? value.option_id : null
})

function choose(id: string): void {
  if (props.disabled) return
  model.value = { option_id: id }
}
</script>

<template>
  <!-- course.html's .opts: answers that look like buttons, two across when they are short. -->
  <div
    :class="['grid gap-2', options.every((o) => o.text.length <= 48) && options.length > 1 && 'sm:grid-cols-2']"
    role="radiogroup"
    :aria-label="assessment.prompt"
  >
    <button
      v-for="(option, index) in options"
      :key="option.id"
      type="button"
      role="radio"
      :aria-checked="selected === option.id"
      :disabled="disabled"
      :class="[
        'flex min-h-[46px] w-full cursor-pointer items-center gap-2.5 rounded-[11px] bg-surface px-3 py-2.5 text-left transition-[box-shadow,transform] duration-200 ease-[var(--ease)]',
        selected === option.id
          ? 'shadow-[0_0_0_1.5px_var(--text),var(--shadow-card)]'
          : 'shadow-[0_0_0_1px_var(--border-strong)] enabled:hover:-translate-y-px enabled:hover:shadow-[0_0_0_1px_var(--text-faint),var(--shadow-card)]',
        disabled && 'cursor-not-allowed opacity-60',
      ]"
      @click="choose(option.id)"
    >
      <span
        :class="[
          'num grid size-6 shrink-0 place-items-center rounded-[7px] text-[12px] font-bold transition-colors duration-200',
          selected === option.id
            ? 'bg-inverse text-on-inverse'
            : 'bg-[rgb(var(--wash-rgb)/0.065)] text-text-soft',
        ]"
        :aria-hidden="true"
      >
        {{ String.fromCharCode(65 + index) }}
      </span>
      <span
        :class="[
          'min-w-0 flex-1 text-[14px] leading-[1.35]',
          selected === option.id ? 'font-medium text-text' : 'text-text-body',
        ]"
        >{{ option.text }}</span
      >
    </button>

    <p
      v-if="options.length === 0"
      class="text-[13px] text-text-faint italic"
    >
      {{ t('check.assess.noOptions') }}
    </p>
  </div>
</template>
