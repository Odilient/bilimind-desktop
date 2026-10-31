<script setup lang="ts">
import type { Assessment, Attempt, CriterionScore } from '~/types/api'

/**
 * What the learner gets back: the score, whether it passed, the per-criterion
 * rubric breakdown for llm-graded kinds, and — most prominently — the feedback.
 * SPEC §7: "Never returns a bare score."
 */
const props = defineProps<{
  assessment: Assessment
  attempt: Attempt
}>()

/** The backend adds a derived `status` to every attempt payload. */
const status = computed(() => {
  const value = (props.attempt as { status?: unknown }).status
  return typeof value === 'string' ? value : props.attempt.score === null ? 'pending' : 'graded'
})

const maxScore = computed(() => {
  const fromAttempt = (props.attempt as { max_score?: unknown }).max_score
  return typeof fromAttempt === 'number' ? fromAttempt : (props.assessment.max_score ?? 100)
})

const passMark = computed(() => {
  const value = (props.assessment as { pass_score?: unknown }).pass_score
  return typeof value === 'number' ? value : Math.round(maxScore.value * 0.7)
})

const score = computed(() => (typeof props.attempt.score === 'number' ? props.attempt.score : null))

/**
 * Whether the number says anything the headline does not. A multiple-choice
 * answer is right or wrong, and "Passed · 100 / 100 · pass mark 70 · 100% ·
 * Correct." was four ways of saying so. The score earns its line where there is
 * a scale — a rubric-marked answer, or partial credit.
 */
const showScore = computed(
  () =>
    score.value !== null &&
    (props.assessment.grader !== 'deterministic' ||
      (score.value > 0 && score.value < maxScore.value)),
)

const percent = computed(() =>
  score.value === null || maxScore.value <= 0
    ? 0
    : Math.max(0, Math.min(100, Math.round((score.value / maxScore.value) * 100))),
)

const passed = computed(() => props.attempt.passed === true)

const tone = computed(() => {
  if (status.value === 'failed') return 'danger'
  if (props.attempt.passed === null) return 'neutral'
  return passed.value ? 'success' : 'danger'
})

const headline = computed(() => {
  if (status.value === 'queued' || status.value === 'pending') return 'Grading…'
  if (status.value === 'failed') return 'Grading failed'
  if (props.attempt.passed === null) return 'Recorded'
  return passed.value ? 'Passed' : 'Not yet'
})

const criteria = computed<CriterionScore[]>(() => {
  const rows = props.attempt.criterion_scores

  if (!Array.isArray(rows)) return []

  return rows
    .filter((row): row is CriterionScore => Boolean(row) && typeof row === 'object')
    .map((row) => ({
      criterion: String(row.criterion ?? '').trim() || 'Criterion',
      score_0_to_1: Math.max(0, Math.min(1, Number(row.score_0_to_1) || 0)),
      comment: String(row.comment ?? '').trim(),
    }))
})

/** Weight per criterion, from the (answer-key-free) rubric the API does send. */
function weightFor(criterion: string): number | null {
  const row = (props.assessment.rubric ?? []).find(
    (entry) => entry.criterion.toLowerCase() === criterion.toLowerCase(),
  )
  return row && typeof row.weight === 'number' ? row.weight : null
}

const meta = computed<Record<string, unknown>>(() =>
  props.attempt.grader_meta && typeof props.attempt.grader_meta === 'object'
    ? props.attempt.grader_meta
    : {},
)

const fromWorker = computed(() => meta.value.source === 'client_worker')

const barTone = (value: number): string =>
  value >= 0.8 ? 'bg-lime-2' : value >= 0.5 ? 'bg-warn-bright' : 'bg-danger-bright'
</script>

<template>
  <div
    :class="[
      'rounded-[14px] px-4 py-3.5',
      tone === 'success'
        ? 'bg-accent-soft shadow-[inset_0_0_0_1px_var(--accent-line)]'
        : tone === 'danger'
          ? 'bg-danger-soft shadow-[inset_0_0_0_1px_var(--danger-line)]'
          : 'bg-surface-mute shadow-[inset_0_0_0_1px_var(--border)]',
    ]"
    role="status"
    aria-live="polite"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <p
          :class="[
            'flex items-center gap-2 font-display text-[15px] font-semibold tracking-[-0.015em]',
            tone === 'success'
              ? 'text-accent-strong'
              : tone === 'danger'
                ? 'text-danger-text'
                : 'text-text',
          ]"
        >
          <UiIcon
            :name="
              status === 'pending' || status === 'queued'
                ? 'loader'
                : tone === 'success'
                  ? 'check-circle'
                  : tone === 'danger'
                    ? 'alert'
                    : 'check'
            "
            :size="15"
            :class="(status === 'pending' || status === 'queued') && 'animate-spin-slow'"
          />
          {{ headline }}
        </p>
        <p
          v-if="showScore"
          class="num mt-1 text-[12px] text-text-soft"
        >
          {{ score }} / {{ maxScore }} · pass mark {{ passMark }}
        </p>
        <p
          v-else-if="attempt.passed === null && status === 'graded'"
          class="mt-1 text-[12px] text-text-muted"
        >
          Recorded without a score.
        </p>
      </div>

      <UiProgressRing
        v-if="showScore"
        :value="percent"
        :size="46"
        :stroke="4"
        :tone="passed ? 'accent' : 'danger'"
      />
    </div>

    <p
      v-if="attempt.feedback"
      class="mt-2 text-[13.5px] leading-relaxed whitespace-pre-line text-text-body"
    >
      {{ attempt.feedback }}
    </p>

    <div
      v-if="criteria.length"
      class="mt-4"
    >
      <p class="eyebrow-loud mb-2.5 text-text-faint">Rubric</p>
      <ul class="flex flex-col gap-2.5">
        <li
          v-for="(row, index) in criteria"
          :key="index"
        >
          <div class="flex items-baseline justify-between gap-3">
            <p class="min-w-0 text-[13px] font-semibold">
              {{ row.criterion }}
              <span
                v-if="weightFor(row.criterion) !== null"
                class="num text-[11px] font-normal text-text-faint"
                >· weight {{ weightFor(row.criterion) }}</span
              >
            </p>
            <span class="num shrink-0 font-display text-[12.5px] font-semibold text-text"
              >{{ Math.round(row.score_0_to_1 * 100) }}%</span
            >
          </div>
          <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface shadow-[inset_0_0_0_1px_var(--border)]">
            <div
              :class="['h-full rounded-full transition-[width] duration-500', barTone(row.score_0_to_1)]"
              :style="{ width: `${row.score_0_to_1 * 100}%` }"
            />
          </div>
          <p
            v-if="row.comment"
            class="mt-1 text-[12px] leading-relaxed text-text-muted"
          >
            {{ row.comment }}
          </p>
        </li>
      </ul>
    </div>

    <p
      v-if="fromWorker"
      class="mt-3 flex items-center gap-1.5 border-t border-border-rule pt-2.5 text-[11px] text-text-faint"
    >
      <UiIcon
        name="lock"
        :size="11"
      />
      Scored from the test results your browser's sandbox reported — the server ran nothing.
    </p>
  </div>
</template>
