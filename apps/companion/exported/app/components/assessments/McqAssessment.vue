<script setup lang="ts">
import type { Assessment, AttemptResponse } from '~/types/api'

/**
 * Single choice. Submits `{option_id}` — the shape SubmitAttemptRequest expects.
 * The correct option is never in the payload, so nothing here can reveal it.
 */
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
  <div
    class="flex flex-col gap-1.5"
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
        'flex min-h-[46px] w-full cursor-pointer items-center gap-3 rounded-[12px] px-3.5 py-2.5 text-left transition-[background-color,box-shadow] duration-200',
        selected === option.id
          ? 'bg-surface shadow-[inset_0_0_0_1.5px_var(--ink)]'
          : 'bg-surface shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.12)] hover:bg-surface-mute hover:shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.22)]',
        disabled && 'cursor-not-allowed opacity-60',
      ]"
      @click="choose(option.id)"
    >
      <span
        :class="[
          'num grid size-[22px] shrink-0 place-items-center rounded-full text-[11px] font-semibold',
          selected === option.id
            ? 'bg-inverse text-on-inverse'
            : 'text-text-faint shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.16)]',
        ]"
        :aria-hidden="true"
      >
        {{ String.fromCharCode(65 + index) }}
      </span>
      <span
        :class="[
          'min-w-0 flex-1 text-[14px] leading-snug',
          selected === option.id ? 'font-medium text-text' : 'text-text-body',
        ]"
        >{{ option.text }}</span
      >
    </button>

    <p
      v-if="options.length === 0"
      class="text-[13px] text-text-faint italic"
    >
      This question has no options — regenerate the lesson to repair it.
    </p>
  </div>
</template>
