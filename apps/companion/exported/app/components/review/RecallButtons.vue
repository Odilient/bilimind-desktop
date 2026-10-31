<script setup lang="ts">
import type { Recall } from '~/composables/useReviews'
import { RECALL_OPTIONS } from '~/composables/useReviews'

/**
 * The one question every review card asks: how well did you remember this?
 *
 * Four honest answers, never "quality 0–5". They map to SM-2 grades inside the
 * composable; here they are just Again / Hard / Good / Easy with a one-line
 * hint, so the choice reads as a feeling rather than a form field. "Good" is the
 * emphasised default — the answer most reviews get — which keeps the row honest
 * about where the primary action is without hiding the other three.
 */

defineProps<{
  /** A grade is in flight — lock the row so a double-tap can't double-post. */
  submitting?: boolean
  /** Which grade was just pressed, so it can stay lit while the rest dim. */
  pending?: Recall | null
}>()

const emit = defineEmits<{ grade: [recall: Recall] }>()

const tones: Record<Recall, string> = {
  again: 'border-danger-line bg-surface text-danger-text hover:bg-danger-soft',
  hard: 'border-warn-line bg-surface text-warn-text hover:bg-warn-soft',
  good: 'border-transparent bg-inverse text-on-inverse hover:bg-inverse-hover',
  // Lime, not green: on this product "easy" is the same signal as go/done —
  // cobalt's lime pill, carrying ink.
  easy: 'border-transparent bg-lime text-ink hover:bg-[#d2f86a]',
}
</script>

<template>
  <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
    <button
      v-for="option in RECALL_OPTIONS"
      :key="option.value"
      type="button"
      :disabled="submitting"
      :aria-busy="submitting && pending === option.value ? true : undefined"
      class="group relative flex flex-col items-center justify-center gap-0.5 rounded-[16px] border px-3 py-3.5 text-center transition-[background-color,border-color,opacity,transform] duration-150 active:scale-[0.97] disabled:cursor-not-allowed"
      :class="[
        tones[option.value],
        submitting && pending !== option.value ? 'opacity-45' : '',
      ]"
      @click="emit('grade', option.value)"
    >
      <span class="inline-flex items-center gap-1.5 font-display text-[15px] font-semibold tracking-[-0.015em]">
        <UiIcon
          v-if="submitting && pending === option.value"
          name="loader"
          :size="14"
          class="animate-spin-slow"
        />
        {{ option.label }}
      </span>
      <span
        class="text-[11.5px] leading-tight opacity-70"
        :class="option.value === 'good' ? 'text-on-inverse/70' : ''"
      >
        {{ option.hint }}
      </span>
    </button>
  </div>
</template>
