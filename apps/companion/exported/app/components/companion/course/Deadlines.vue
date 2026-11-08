<script setup lang="ts">
import type { Deadline, Subject } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { useCapture } from '~/companion/capture'
import { dayKey, shortDate, untilLabel } from '~/companion/time'
import { kindWord, dueLong, knownBy, readyWords } from '~/companion/words'
import { checkHref } from '~/companion/checks'
import { useExport } from '~/companion/export/use-export'
import { runningGrade } from '~/companion/grades'

/**
 * A course's deadlines, as a view of its home (`?tab=deadlines`).
 *
 *  - The nearest one first, as a card: what it is and its weight, when (and
 *    how long until), how ready the learner is in words (and as a bar once
 *    something is checked: a bar at nothing for "not checked yet" would say
 *    "0%", which is the one thing that phrase is there to avoid), whether
 *    the date is official or only heard, and the one thing to do about it:
 *    a check when topics it covers have gone cold, since only a check moves
 *    readiness, otherwise "Start preparing", practice on what it covers.
 *  - Then the rest coming up, each the shared deadline row with its
 *    readiness, and the date's standing when it isn't official.
 *  - Then what's behind, with the grades, and the weighted average so far in
 *    the heading, because "how am I doing in this course" is the question.
 *    A grade that readiness predicted says what it predicted beside it.
 *  - At the foot, one quiet line to take the same rows away, as a
 *    spreadsheet or a CSV.
 *
 * Nothing here is new data; it is the deadline rows, said plainly. Empty, it
 * says where dates come from and offers the one way to add one by hand:
 * paste the message that has it.
 */
const props = defineProps<{ subject: Subject }>()
const c = useCompanion()
const capture = useCapture()
const exp = useExport()

const now = Date.now()
const deadlines = computed(() => c.deadlines.value.filter((d) => d.subject_id === props.subject.id))
const upcoming = computed(() =>
  deadlines.value.filter((d) => d.status === 'upcoming' && (!d.due_at || Date.parse(d.due_at) > now)),
)
const first = computed(() => upcoming.value[0] ?? null)
const rest = computed(() => upcoming.value.slice(1))
const past = computed(() => deadlines.value.filter((d) => !upcoming.value.includes(d)).reverse())

const firstReady = computed(() => (first.value ? c.readinessOf(first.value) : null))
const scoped = computed(() => Boolean(firstReady.value?.total))
const covers = computed(() =>
  (first.value?.topic_ids ?? []).map((id) => c.get('topics', id)?.title).filter(Boolean).slice(0, 5) as string[],
)

/**
 * The course's running grade: the
 * same number its Grades view and the Courses shelf say, so "how am I doing"
 * never has two answers in one course.
 */
const average = computed(() => {
  const r = runningGrade(deadlines.value)
  return r ? { percent: r.percent, count: r.marked } : null
})

function standing(d: Deadline): string {
  if (d.confidence === 'official' || d.confirmed) return 'Official'
  return knownBy(d) ?? 'Not confirmed yet'
}

function gradeTone(grade: number): string {
  return grade >= 85 ? 'text-success-text' : grade >= 60 ? 'text-text' : 'text-danger-text'
}
</script>

<template>
  <div class="mx-auto grid w-full max-w-[760px] content-start gap-10 px-4 pt-6 pb-20 min-[900px]:px-8">
    <!-- The one that matters now. -->
    <section
      v-if="first"
      class="grid gap-4 rounded-[20px] bg-surface p-5 shadow-[inset_0_0_0_1px_var(--border)] min-[900px]:p-6"
      aria-labelledby="course-next-due"
    >
      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p class="text-[13px] font-semibold text-text-soft">
          Next up · {{ kindWord(first.kind) }}<template v-if="first.weight_pct">
            , {{ first.weight_pct }}% of the grade
          </template>
        </p>
        <span class="flex-1" />
        <span
          class="text-[13px] font-medium"
          :class="standing(first) === 'Official' ? 'text-success-text' : 'text-text-muted'"
        >{{ standing(first) }}</span>
      </div>
      <div class="grid gap-1">
        <h2
          id="course-next-due"
          class="t-head text-[24px]"
        >
          {{ first.title }}
        </h2>
        <p class="text-[14.5px] text-text-body">
          {{ dueLong(first) }}<template v-if="first.due_at">
            · {{ untilLabel(first.due_at) }}
          </template><template v-if="first.location">
            · {{ first.location }}
          </template>
        </p>
        <p
          v-if="first.scope_note"
          class="text-[14px] text-text-muted"
        >
          {{ first.scope_note }}
        </p>
      </div>

      <div
        v-if="scoped"
        class="grid gap-2"
      >
        <div class="flex items-center gap-3">
          <span
            v-if="firstReady?.checked"
            class="h-2 flex-1 overflow-hidden rounded-full bg-surface-track"
          >
            <span
              class="block h-full rounded-full transition-[width] duration-500"
              :class="firstReady.percent >= 85 ? 'bg-leaf' : 'bg-hi-2'"
              :style="{ width: `${Math.max(3, firstReady.percent)}%` }"
            />
          </span>
          <span
            class="shrink-0 text-[14px] font-semibold"
            :class="firstReady?.checked && firstReady.percent >= 85 ? 'text-success-text' : 'text-text'"
          >{{ readyWords(firstReady?.checked ? firstReady.percent : null) }}</span>
        </div>
        <p
          v-if="covers.length"
          class="text-[13.5px] text-text-muted"
        >
          Covers {{ covers.join(', ') }}<template v-if="first.topic_ids.length > covers.length">
            and {{ first.topic_ids.length - covers.length }} more
          </template>
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <UiBtn
          v-if="scoped && firstReady?.suggestion.check.topics"
          :to="checkHref({ deadlineId: first.id })"
          variant="primary"
          size="md"
          trailing-icon="arrow-right"
        >
          Check {{ plural(firstReady.suggestion.check.topics, 'topic') }}
        </UiBtn>
        <UiBtn
          v-else-if="scoped"
          :to="`/app/practice?deadline=${first.id}`"
          variant="primary"
          size="md"
          trailing-icon="arrow-right"
        >
          Start preparing
        </UiBtn>
        <UiBtn
          :to="`/app/d/${first.id}`"
          :variant="scoped ? 'ghost' : 'primary'"
          size="md"
        >
          {{ scoped ? 'What it covers' : 'Open' }}
        </UiBtn>
      </div>
    </section>

    <section
      v-if="rest.length"
      aria-labelledby="course-upcoming"
    >
      <h2
        id="course-upcoming"
        class="t-head mb-2 text-[19px]"
      >
        Coming up
      </h2>
      <ul class="divide-y divide-border-rule border-y border-border-rule">
        <li
          v-for="d in rest"
          :key="d.id"
        >
          <CompanionDeadlineRow
            :deadline="d"
            :with-course="false"
            show-standing
          />
        </li>
      </ul>
    </section>

    <section
      v-if="!upcoming.length"
      class="grid justify-items-start gap-3 rounded-[20px] bg-surface-sunken p-5 min-[900px]:p-6"
    >
      <h2 class="t-head text-[19px]">
        Nothing due
      </h2>
      <p class="max-w-[520px] text-[15px] text-text-body">
        Dates arrive by themselves from Moodle, your email and what's said in class, and each says
        where it came from. Got one in a message? Paste it and BiliMind files it here.
      </p>
      <UiBtn
        variant="secondary"
        size="md"
        @click="capture.show('paste', subject.id)"
      >
        Paste a message with a date
      </UiBtn>
    </section>

    <section
      v-if="past.length"
      aria-labelledby="course-past"
    >
      <header class="mb-2 flex items-baseline justify-between gap-3">
        <h2
          id="course-past"
          class="t-head text-[19px]"
        >
          Behind you
        </h2>
        <span
          v-if="average"
          class="shrink-0 text-[14px] font-medium text-text-muted"
        >Averaging <span :class="['font-semibold', gradeTone(average.percent)]">{{ average.percent }}%</span> over {{ average.count }}</span>
      </header>
      <ul class="divide-y divide-border-rule border-y border-border-rule">
        <li
          v-for="d in past"
          :key="d.id"
        >
          <NuxtLink
            :to="`/app/d/${d.id}`"
            class="group -mx-2 flex min-h-11 items-center gap-4 rounded-[12px] px-2 py-3 transition-colors hover:bg-surface-mute"
          >
            <span class="grid min-w-0 flex-1 gap-0.5">
              <span class="truncate text-[16px] leading-snug font-medium text-text">{{ d.title }}</span>
              <span class="text-[13.5px] text-text-muted">{{ d.due_at ? shortDate(dayKey(d.due_at)) : 'No date' }}{{ d.weight_pct ? ` · ${d.weight_pct}% of the grade` : '' }}{{ d.grade != null && d.readiness_said != null ? ` · readiness said ${d.readiness_said}%` : '' }}</span>
            </span>
            <span
              class="shrink-0 text-[14px] font-semibold"
              :class="d.grade != null ? gradeTone(d.grade) : 'font-medium text-text-muted'"
            >{{ d.grade != null ? `${d.grade}%` : d.status === 'cancelled' ? 'cancelled' : d.status === 'missed' ? 'missed' : 'handed in' }}</span>
            <CompanionIcon
              name="chevron-right"
              :size="18"
              class="shrink-0 text-text-faint transition-colors group-hover:text-text-soft"
            />
          </NuxtLink>
        </li>
      </ul>
    </section>

    <!-- Exports: the same rows, for a spreadsheet of the learner's own. -->
    <p
      v-if="deadlines.length"
      class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[14px] text-text-muted"
    >
      Download these dates and grades:
      <button
        type="button"
        class="cursor-pointer font-medium text-text-soft hover:text-text hover:underline"
        @click="exp.spreadsheet(subject.id)"
      >
        Spreadsheet
      </button>
      <button
        type="button"
        class="cursor-pointer font-medium text-text-soft hover:text-text hover:underline"
        @click="exp.deadlinesCsv(subject.id)"
      >
        CSV
      </button>
    </p>
  </div>
</template>
