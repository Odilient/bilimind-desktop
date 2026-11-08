<script setup lang="ts">
import type { Assessment, AttemptResponse } from '~/types/api'

/**
 * SPEC §7 `SelfGrader` — the learner asserts completion and the attempt is
 * recorded with `score = null`. No pretend grade, no pretend feedback.
 */
const { t } = useI18n()
defineProps<{
  assessment: Assessment
  disabled?: boolean
}>()

const model = defineModel<AttemptResponse | null>({ default: null })

const completed = ref(false)
const note = ref('')

watch([completed, note], () => {
  model.value = completed.value ? { completed: true, note: note.value.trim() || undefined } : null
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <button
      type="button"
      role="checkbox"
      :aria-checked="completed"
      :disabled="disabled"
      :class="[
        'flex w-full items-start gap-3 rounded-[12px] px-3.5 py-3 text-left transition-[background-color,box-shadow]',
        completed
          ? 'bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--hi-2)]'
          : 'bg-surface shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.12)] hover:shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.22)]',
        disabled && 'cursor-not-allowed opacity-60',
      ]"
      @click="completed = !completed"
    >
      <span
        aria-hidden="true"
        :class="[
          'mt-px grid size-5 shrink-0 place-items-center rounded-[6px]',
          completed
            ? 'bg-accent text-on-accent'
            : 'text-transparent shadow-[inset_0_0_0_1.5px_rgb(var(--wash-rgb)/0.18)]',
        ]"
      >
        <UiIcon
          name="check"
          :size="12"
        />
      </span>
      <span class="min-w-0 flex-1 text-[14px] leading-relaxed font-medium">
        {{ t('check.assess.selfDone') }}
      </span>
    </button>

    <UiTextField
      v-model="note"
      multiline
      :rows="2"
      :maxlength="5000"
      :disabled="disabled || !completed"
      :placeholder="t('check.assess.selfNote')"
      :aria-label="t('check.assess.noteAria')"
    />

    <p class="text-[11.5px] text-text-faint">
      {{ t('check.assess.selfStored') }}
    </p>
  </div>
</template>
