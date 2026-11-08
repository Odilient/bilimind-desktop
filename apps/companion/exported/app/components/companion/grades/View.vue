<script setup lang="ts">
/**
 * A course's Grades, as a view of its home (`?tab=grades`): how am I doing
 * in this course, and what do I need from here?
 *
 *  - The grade so far, in words and one number (`runningGrade`): what's
 *    marked, how much of the grade that is, and what's still to come by
 *    name. A course whose weights don't reach 100% says so, because a grade
 *    over 85% of the course isn't the course's grade.
 *  - Every assessment, one hairline row each, with its weight and its mark
 *    as two quiet fields that read as text until touched (the course
 *    builder's deadline fields do the same). A mark from Moodle says so; one
 *    typed here is the learner's, and Moodle's next mark replaces it.
 *  - "Add an assessment" for what isn't in the deadlines: participation 10%,
 *    a lab average. It is a deadline with no date (`kind: other`), so it
 *    counts here and in the deadline lists, never on Tasks.
 *  - The score the final needs (`ExamTools`, the deadline page's own
 *    section), on the course's final, else its exam, else its heaviest
 *    assessment still to come (`finalOf`).
 *
 *  - Under it (Daylight 2), what the rest of the course needs on average to
 *    finish on the aim (`neededOnRest`, `restWords`), the number in the
 *    highlighter, and the aim itself (`subjects.grade_target`, 70% until the
 *    learner sets one), which Today's grades card reads too.
 *
 * No dashboard: no rings, no bars, no chart of marks. Numbers in words.
 */
import type { Deadline, Subject } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { dayKey, shortDate } from '~/companion/time'
import { fmtNumber } from '~/utils/i18n'
import { kindWord } from '~/companion/words'
import { countsToward, finalOf, gradeFromMoodle, neededOnRest, restWords, runningGrade } from '~/companion/grades'
import { tickedStatus } from '~/companion/tasks'
import { useExport } from '~/companion/export/use-export'

const props = defineProps<{ subject: Subject }>()
const { t } = useI18n()
const c = useCompanion()
const exp = useExport()

const course = computed(() => c.deadlines.value.filter((d) => d.subject_id === props.subject.id))
const rows = computed(() => course.value.filter(countsToward))
const running = computed(() => runningGrade(course.value))
const final = computed(() => finalOf(course.value))

/** "Midterm, Group project and Final exam", "… and 2 more". */
function names(list: Deadline[]): string {
  const titles = list.map((d) => d.title)
  if (titles.length > 3) return t('grades.names.more', { list: titles.slice(0, 3).join(', '), n: titles.length - 3 })
  return titles.length > 1
    ? t('grades.names.and', { list: titles.slice(0, -1).join(', '), last: titles.at(-1) })
    : (titles[0] ?? '')
}

const pct = (n: number): string => `${fmtNumber(Math.round(n * 10) / 10)}%`

const headline = computed(() => {
  const r = running.value
  if (!r) return t('grades.headline.none')
  return t(r.final ? 'grades.headline.final' : 'grades.headline.sofar', { percent: r.percent })
})

const line = computed(() => {
  const r = running.value
  if (!r) return t(rows.value.length ? 'grades.line.waiting' : 'grades.line.empty')
  const marks = t('grades.marks', r.marked)
  if (!r.weighted) return t('grades.line.unweighted', { marks })
  const rest = r.unmarked.length ? ` ${t('grades.line.rest', { weight: pct(r.unmarkedWeight), names: names(r.unmarked) })}` : ''
  return t('grades.line.weighted', { marks, weight: pct(r.markedWeight), rest })
})

/** The weights listed fall short of the whole grade: something isn't here yet. */
const short = computed(() => {
  const total = rows.value.reduce((s, d) => s + (d.weight_pct ?? 0), 0)
  return total > 0 && total < 99.5 ? pct(100 - total) : null
})

/** "Lab · 29 Oct · from Moodle". `other` ("Deadline") says nothing about a participation mark, so it's left out. */
function when(d: Deadline): string {
  return [
    d.kind === 'other' ? null : kindWord(d.kind),
    d.due_at ? shortDate(dayKey(d.due_at)) : null,
    gradeFromMoodle(d) ? t('grades.fromMoodle') : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/* -- Writing a weight or a mark ------------------------------------------------ */

/** The field's number, null when cleared; undefined when it isn't one (0–100). */
function numberIn(input: HTMLInputElement): number | null | undefined {
  const raw = input.value.trim()
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : undefined
}

async function setWeight(d: Deadline, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const value = numberIn(input)
  if (value === undefined || value === d.weight_pct) {
    input.value = d.weight_pct?.toString() ?? ''
    return
  }
  try {
    await c.upsert<Deadline>('deadlines', { id: d.id, weight_pct: value })
  } catch {
    input.value = d.weight_pct?.toString() ?? ''
  }
}

/**
 * A mark on something still upcoming also marks it handed in (or sat), as
 * Moodle's gradebook does: marked work isn't still to do. The server fills
 * `readiness_said` when a grade lands, so the row is read back after.
 */
async function setGrade(d: Deadline, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const value = numberIn(input)
  if (value === undefined || value === d.grade) {
    input.value = d.grade?.toString() ?? ''
    return
  }
  try {
    await c.upsert<Deadline>('deadlines', {
      id: d.id,
      grade: value,
      ...(value !== null && d.status === 'upcoming' ? { status: tickedStatus(d) } : {}),
    })
    void c.sync()
  } catch {
    input.value = d.grade?.toString() ?? ''
  }
}

/* -- Adding one that isn't in the deadlines -------------------------------------- */

const adding = ref(false)
// A number field's v-model hands back a number once typed, '' when empty.
const draft = reactive<{ title: string; weight: string | number; grade: string | number }>({ title: '', weight: '', grade: '' })
const nameField = ref<HTMLInputElement | null>(null)

async function startAdding(): Promise<void> {
  adding.value = true
  await nextTick()
  nameField.value?.focus()
}

function draftNumber(raw: string | number): number | null | undefined {
  if (!String(raw).trim()) return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : undefined
}

const draftOk = computed(
  () => Boolean(draft.title.trim()) && draftNumber(draft.weight) !== undefined && draftNumber(draft.grade) !== undefined,
)

async function add(): Promise<void> {
  if (!draftOk.value) return
  const grade = draftNumber(draft.grade) ?? null
  const row = {
    id: crypto.randomUUID(),
    subject_id: props.subject.id,
    kind: 'other' as const,
    title: draft.title.trim().slice(0, 300),
    due_at: null,
    all_day: false,
    weight_pct: draftNumber(draft.weight) ?? null,
    location: null,
    status: grade === null ? ('upcoming' as const) : ('submitted' as const),
    confidence: 'own' as const,
    confirmed: true,
    scope_note: null,
    grade,
    readiness_said: null,
    source_ref: null,
    tentative: false,
    topic_ids: [],
    sources: [],
  }
  draft.title = ''
  draft.weight = ''
  draft.grade = ''
  nameField.value?.focus()
  try {
    await c.upsert<Deadline>('deadlines', row)
  } catch {
    // The store has said why and taken the row away again.
  }
}

/* -- The aim (Daylight 2): what the rest of the course needs ------------------- */

/** The aim when the course has none of its own yet: the landing's 70%. */
const AIM = 70
const aim = computed(() => props.subject.grade_target ?? AIM)
const rest = computed(() => (running.value && !running.value.final ? neededOnRest(course.value, aim.value) : null))
/** "So far you have 74% on the 20% … you need about 69% on what's left", the need cut out to wear the highlighter. */
const restLine = computed(() => {
  const r = rest.value
  if (!r) return null
  const words = restWords(r)
  const mark = r.state === 'reachable' ? `${r.need}%` : null
  const at = mark ? words.lastIndexOf(mark) : -1
  return at >= 0
    ? { before: words.slice(0, at), mark, after: words.slice(at + mark!.length) }
    : { before: words, mark: null, after: '' }
})

async function setAim(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const value = numberIn(input)
  if (value === undefined || value === (props.subject.grade_target ?? null)) {
    input.value = String(props.subject.grade_target ?? '')
    return
  }
  try {
    await c.upsert<Subject>('subjects', { id: props.subject.id, grade_target: value })
  } catch {
    input.value = String(props.subject.grade_target ?? '')
  }
}

const FIELD =
  'h-9 w-[64px] rounded-[10px] border border-transparent bg-transparent px-2 text-right text-[15px] font-semibold text-text tabular-nums outline-none transition-colors duration-150 placeholder:font-normal placeholder:text-text-ghost hover:border-border focus:border-brand focus:ring-3 focus:ring-brand-line'
</script>

<template>
  <div class="mx-auto grid w-full max-w-[760px] content-start gap-10 px-4 pt-6 pb-20 min-[900px]:px-8">
    <section
      class="grid gap-1.5"
      aria-labelledby="grades-now"
    >
      <h2
        id="grades-now"
        class="font-display text-[18px] font-semibold tracking-[-0.02em]"
      >
        {{ t('grades.yourGrade') }}
      </h2>
      <p class="font-display text-[30px] leading-tight font-semibold tracking-[-0.035em]">
        {{ headline }}
      </p>
      <p class="max-w-[560px] text-[15px] text-text-body">
        {{ line }}
      </p>
      <!-- Daylight 2's grades summary: what the rest needs for the aim, the
           number in the highlighter, and the aim itself, which is yours to set. -->
      <div class="mt-3 flex items-start gap-3 rounded-[12px] bg-surface-mute px-3.5 py-3 shadow-[0_0_0_1px_var(--border)]">
        <span class="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-sky-soft text-sky-ink">
          <CompanionIcon
            name="cap"
            :size="15"
            :stroke="2"
          />
        </span>
        <div class="grid min-w-0 flex-1 gap-2">
          <p
            v-if="restLine"
            class="text-[14px] leading-[1.5] text-text-soft"
          >
            {{ restLine.before }}<mark
              v-if="restLine.mark"
              class="rounded-[3px] bg-accent px-0.5 font-semibold text-on-accent"
            >{{ restLine.mark }}</mark>{{ restLine.after }}
          </p>
          <label class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-text-soft">
            {{ t('grades.aiming') }}
            <span class="inline-flex items-center rounded-[10px] bg-surface shadow-[0_0_0_1px_var(--border-strong)]">
              <input
                :value="subject.grade_target ?? ''"
                type="number"
                inputmode="decimal"
                min="0"
                max="100"
                step="1"
                :placeholder="String(AIM)"
                :aria-label="t('grades.aimLabel')"
                class="h-8 w-[52px] rounded-[10px] bg-transparent pl-2 text-right text-[14px] font-semibold text-text tabular-nums outline-none placeholder:font-normal placeholder:text-text-faint focus:shadow-[0_0_0_3px_var(--brand-line)]"
                @change="setAim"
              >
              <span class="pr-2 pl-0.5 font-semibold text-text-faint">%</span>
            </span>
            {{ subject.grade_target == null ? t('grades.overallUntil') : t('grades.overall') }}
          </label>
        </div>
      </div>
      <p
        v-if="short"
        class="max-w-[560px] text-[14px] text-text-muted"
      >
        {{ t('grades.short', { share: short }) }}
      </p>
    </section>

    <section aria-labelledby="grades-list">
      <header class="mb-1 flex items-end gap-3">
        <h2
          id="grades-list"
          class="flex-1 font-display text-[18px] font-semibold tracking-[-0.02em]"
        >
          {{ t('grades.assessments') }}
        </h2>
        <span
          v-if="rows.length"
          class="flex shrink-0 gap-2 pr-1 text-[12.5px] text-text-faint"
          aria-hidden="true"
        >
          <span class="w-[64px] text-right">{{ t('grades.worth') }}</span>
          <span class="w-[64px] text-right">{{ t('grades.mark') }}</span>
        </span>
      </header>
      <ul
        v-if="rows.length || adding"
        class="divide-y divide-border-rule border-y border-border-rule"
      >
        <li
          v-for="d in rows"
          :key="d.id"
          class="flex min-h-[60px] items-center gap-3 py-2"
        >
          <span class="grid min-w-0 flex-1 gap-0.5">
            <NuxtLink
              :to="`/app/d/${d.id}`"
              class="truncate text-[15.5px] leading-snug font-medium text-text hover:underline"
            >{{ d.title }}</NuxtLink>
            <span
              v-if="when(d)"
              class="truncate text-[13px] text-text-muted"
            >{{ when(d) }}</span>
          </span>
          <span class="flex shrink-0 items-center gap-2 pr-1">
            <span class="flex items-center">
              <input
                :value="d.weight_pct ?? ''"
                type="number"
                inputmode="decimal"
                min="0"
                max="100"
                step="any"
                placeholder="–"
                :aria-label="t('grades.worthOf', { title: d.title })"
                :class="FIELD"
                @change="setWeight(d, $event)"
              >
              <span class="sr-only">%</span>
            </span>
            <span class="flex items-center">
              <input
                :value="d.grade ?? ''"
                type="number"
                inputmode="decimal"
                min="0"
                max="100"
                step="any"
                placeholder="–"
                :aria-label="t('grades.markFor', { title: d.title })"
                :class="[FIELD, d.grade != null && d.grade < 50 && 'text-danger-text']"
                @change="setGrade(d, $event)"
              >
              <span class="sr-only">%</span>
            </span>
          </span>
        </li>
        <li v-if="adding">
          <form
            class="flex flex-wrap items-center gap-2 py-2.5"
            @submit.prevent="add"
          >
            <label
              for="grades-add-name"
              class="sr-only"
            >{{ t('grades.whatItIs') }}</label>
            <input
              id="grades-add-name"
              ref="nameField"
              v-model="draft.title"
              type="text"
              maxlength="300"
              :placeholder="t('grades.participation')"
              class="h-10 min-w-[180px] flex-1 rounded-[12px] bg-surface-sunken px-3 text-[16px] text-text outline-none placeholder:text-text-faint focus:shadow-[inset_0_0_0_2px_var(--brand)] min-[700px]:text-[15px]"
              @keydown.esc="adding = false"
            >
            <input
              v-model="draft.weight"
              type="number"
              inputmode="decimal"
              min="0"
              max="100"
              step="any"
              :placeholder="t('grades.worthPct')"
              :aria-label="t('grades.worthPctLabel')"
              class="h-10 w-[104px] rounded-[12px] bg-surface-sunken px-3 text-[15px] text-text tabular-nums outline-none placeholder:text-text-faint focus:shadow-[inset_0_0_0_2px_var(--brand)]"
            >
            <input
              v-model="draft.grade"
              type="number"
              inputmode="decimal"
              min="0"
              max="100"
              step="any"
              :placeholder="t('grades.markPct')"
              :aria-label="t('grades.markPctLabel')"
              class="h-10 w-[104px] rounded-[12px] bg-surface-sunken px-3 text-[15px] text-text tabular-nums outline-none placeholder:text-text-faint focus:shadow-[inset_0_0_0_2px_var(--brand)]"
            >
            <UiBtn
              type="submit"
              variant="primary"
              :disabled="!draftOk"
            >
              {{ t('grades.add') }}
            </UiBtn>
          </form>
        </li>
      </ul>
      <button
        v-if="!adding"
        type="button"
        class="mt-2 inline-flex h-11 cursor-pointer items-center gap-2 rounded-full pr-4 pl-2.5 text-[14.5px] font-semibold text-brand transition-colors duration-150 outline-none hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand-line"
        @click="startAdding"
      >
        <UiIcon
          name="plus"
          :size="16"
        />
        {{ t('grades.addAssessment') }}
      </button>
    </section>

    <!-- The sum needs weighted marks; without weights the line above asks for them. -->
    <CompanionExamTools
      v-if="final && running?.weighted"
      :deadline="final"
    />
    <p
      v-else-if="final && !running"
      class="text-[14.5px] text-text-muted"
    >
      {{ t('grades.onceMarked', { title: final.title }) }}
    </p>

    <!-- Exports: the course's spreadsheet, whose Grades tab is this list. -->
    <p
      v-if="rows.length"
      class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[14px] text-text-muted"
    >
      {{ t('grades.download') }}
      <button
        type="button"
        class="cursor-pointer font-medium text-text-soft hover:text-text hover:underline"
        @click="exp.spreadsheet(subject.id)"
      >
        {{ t('grades.spreadsheet') }}
      </button>
    </p>
  </div>
</template>
