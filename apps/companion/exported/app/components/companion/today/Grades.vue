<script setup lang="ts">
/**
 * Grades on Today (Daylight 2's grades card, sections/07-today.html): for
 * each course with a mark in, the grade so far and what the final needs from
 * here, in words, with the one number worth knowing marked in the
 * highlighter. The row opens the course's Grades, where the marks are.
 *
 * The sums are the course page's own (`runningGrade`, `neededOnRest`,
 * `restWords`), so Today and the course never disagree. The aim is the
 * course's own `grade_target`, or 70% until one is set. A course with
 * nothing marked yet isn't listed; with nothing marked anywhere, the card
 * isn't drawn.
 */
import { useCompanion } from '~/companion/store'
import { neededOnRest, restWords, runningGrade } from '~/companion/grades'

const { t } = useI18n()
const c = useCompanion()

/** The aim when a course has none of its own yet: the landing's 70%. Set per course on its Grades. */
const AIM = 70

const rows = computed(() =>
  c.shelf.value.flatMap((s) => {
    const course = c.deadlines.value.filter((d) => d.subject_id === s.id)
    const r = runningGrade(course)
    if (!r) return []
    const target = s.grade_target ?? AIM
    const rest = r.final ? null : neededOnRest(course, target)
    // "So far you have 74% on the 20% that's been marked. To finish on 70%
    // overall, you need about 69% on what's left." The number worth knowing
    // is cut out of the sentence so it can wear the highlighter.
    const words = rest
      ? restWords(rest)
      : r.final
        ? t('today.grades.finished', { n: r.percent })
        : t('today.grades.averaging', { percent: r.percent, n: r.marked }, r.marked)
    const mark = rest?.state === 'reachable' ? `${rest.need}%` : null
    const at = mark ? words.lastIndexOf(mark) : -1
    return [{
      s,
      percent: rest?.sofar ?? r.percent,
      before: at >= 0 ? words.slice(0, at) : words,
      mark: at >= 0 ? mark : null,
      after: at >= 0 ? words.slice(at + mark!.length) : '',
    }]
  }),
)

function tone(p: number): string {
  if (p >= 70) return 'bg-leaf-soft text-leaf-ink'
  if (p >= 50) return 'bg-accent-soft text-accent-strong'
  return 'bg-rose-soft text-rose-ink'
}
</script>

<template>
  <section
    v-if="rows.length"
    aria-labelledby="today-grades"
    class="overflow-hidden rounded-[18px] bg-surface shadow-[0_0_0_1px_var(--border),var(--shadow-raised)]"
  >
    <header class="flex h-[46px] items-center gap-2 border-b border-border px-3.5 text-[13px]">
      <span class="grid size-[22px] shrink-0 place-items-center rounded-[6px] bg-sky-soft text-sky-ink">
        <CompanionIcon
          name="cap"
          :size="13"
          :stroke="2"
        />
      </span>
      <h2
        id="today-grades"
        class="font-bold tracking-[-0.01em]"
      >
        {{ t('today.grades.title') }}
      </h2>
    </header>
    <ul class="grid px-3.5 py-1">
      <li
        v-for="(row, i) in rows"
        :key="row.s.id"
        :class="i > 0 && 'border-t border-border-rule'"
      >
        <NuxtLink
          :to="`/app/courses/${row.s.id}?tab=grades`"
          class="group -mx-1.5 flex items-start gap-3 rounded-[10px] px-1.5 py-3 transition-colors hover:bg-[rgb(var(--wash-rgb)/0.03)]"
        >
          <CompanionCourseCover
            :subject="row.s"
            size="sm"
            :px="30"
          />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[13.5px] font-semibold">{{ row.s.title }}</span>
            <span class="mt-0.5 block text-[13px] leading-[1.5] text-text-soft">
              {{ row.before }}<mark
                v-if="row.mark"
                class="rounded-[3px] bg-accent px-0.5 font-semibold text-on-accent"
              >{{ row.mark }}</mark>{{ row.after }}
            </span>
          </span>
          <span :class="['num mt-0.5 shrink-0 rounded-[8px] px-2.5 py-[3px] text-[12.5px] font-bold', tone(row.percent)]">{{ row.percent }}%</span>
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>
