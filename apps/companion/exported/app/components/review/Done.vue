<script setup lang="ts">
/**
 * The end of a review session. Not a report card — a small, warm full stop.
 *
 * It names what was done, shows the streak if there is one (the whole reason to
 * come back tomorrow), and offers a single way onward. No stats grid, no
 * "accuracy", nothing that turns remembering into a score.
 */

const props = defineProps<{
  /** How many lessons were reviewed this session. */
  reviewed: number
  /** Consecutive days with a review, from `/reviews/stats`. */
  streak?: number
}>()

const { t } = useI18n()

const headline = computed(() =>
  t(props.reviewed === 0 ? 'check.review.nothing' : 'check.review.caughtUp'),
)

const body = computed(() => {
  if (props.reviewed === 0) {
    return t('check.review.comeBack')
  }
  return t('check.review.broughtBack', props.reviewed)
})
</script>

<template>
  <div
    class="rounded-[26px] bg-surface px-6 pt-8 pb-12 text-center shadow-[inset_0_0_0_1px_var(--border),0_40px_80px_-48px_rgb(11_13_16/0.4)]"
  >
    <img
      src="/img/cobalt/obj-trophy.webp"
      alt=""
      aria-hidden="true"
      class="mx-auto size-28 object-contain drop-shadow-[0_24px_30px_rgb(11_13_16/0.18)]"
    >

    <h2 class="t-display mt-3 text-[28px] sm:text-[32px]">
      {{ headline }}
    </h2>
    <p class="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-text-soft">
      {{ body }}
    </p>

    <div
      v-if="streak && streak > 0"
      class="mx-auto mt-5 inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-3 py-1.5 shadow-[inset_0_0_0_1px_var(--warn-line)]"
    >
      <UiIcon
        name="flame"
        :size="15"
        class="text-warn"
      />
      <span class="text-[13px] font-medium text-warn-text">
        {{ t('check.review.streak', streak) }}
      </span>
    </div>

    <div class="mt-7">
      <UiBtn
        to="/"
        variant="primary"
        size="lg"
        trailing-icon="arrow-right"
      >
        {{ t('check.review.backToToday') }}
      </UiBtn>
    </div>
  </div>
</template>
