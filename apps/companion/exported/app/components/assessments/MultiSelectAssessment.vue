<script setup lang="ts">
import type { Assessment, AttemptResponse } from '~/types/api'

/**
 * Several correct answers. Submits `{option_ids: [...]}`; the backend awards
 * partial credit as |intersection| / |union| (SPEC §7), which the footnote says
 * out loud so guessing everything looks as bad as it is.
 */
const { t } = useI18n()
const props = defineProps<{
  assessment: Assessment
  disabled?: boolean
}>()

const model = defineModel<AttemptResponse | null>({ default: null })

const options = computed(() => props.assessment.options ?? [])

const selected = computed<string[]>(() => {
  const value = model.value as { option_ids?: unknown } | null
  return Array.isArray(value?.option_ids) ? (value.option_ids as string[]) : []
})

function toggle(id: string): void {
  if (props.disabled) return

  const next = selected.value.includes(id)
    ? selected.value.filter((option) => option !== id)
    : [...selected.value, id]

  model.value = next.length > 0 ? { option_ids: next } : null
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      role="checkbox"
      :aria-checked="selected.includes(option.id)"
      :disabled="disabled"
      :class="[
        'flex min-h-[46px] w-full cursor-pointer items-center gap-3 rounded-[12px] px-3.5 py-2.5 text-left transition-[background-color,box-shadow] duration-200',
        selected.includes(option.id)
          ? 'bg-surface shadow-[inset_0_0_0_1.5px_var(--text)]'
          : 'bg-surface shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.12)] hover:bg-surface-mute hover:shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.22)]',
        disabled && 'cursor-not-allowed opacity-60',
      ]"
      @click="toggle(option.id)"
    >
      <span
        aria-hidden="true"
        :class="[
          'grid size-[22px] shrink-0 place-items-center rounded-[7px]',
          selected.includes(option.id)
            ? 'bg-inverse text-on-inverse'
            : 'text-transparent shadow-[inset_0_0_0_1.5px_rgb(var(--wash-rgb)/0.18)]',
        ]"
      >
        <UiIcon
          name="check"
          :size="12"
        />
      </span>
      <span
        :class="[
          'min-w-0 flex-1 text-[14px] leading-snug',
          selected.includes(option.id) ? 'font-medium text-text' : 'text-text-body',
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
    <p
      v-else
      class="mt-1 text-[11.5px] text-text-faint"
    >
      {{ t('check.assess.multiNote') }}
    </p>
  </div>
</template>
