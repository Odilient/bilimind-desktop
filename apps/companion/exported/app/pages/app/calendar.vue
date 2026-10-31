<script setup lang="ts">
/**
 * The Calendar. One question: what does this week look like?
 *
 * The week comes first, with the way to move through it right above: the
 * previous and next week, and back to this one. Things due and classes are
 * told apart at a glance: a deadline is a tinted block that says "Due 09:00"
 * and how ready the learner is; a class is a plain line with its time, its
 * course and its room. On a wide screen the week is seven columns split by
 * hairlines; on a phone or a narrow window it is a day-by-day list.
 *
 * The semester sits underneath, calm: a strip of weeks with how much is due
 * in each, one tap from any of them, and the planner's warning in one
 * sentence while there is still time to start. "All deadlines" swaps the week for everything ahead.
 *
 * It used to open on a cobalt strip of tiny columns and an amber banner, with
 * the week in boxed cards below; the eye had nowhere to land.
 *
 * `?date=2026-10-29` opens the week holding that day (notes link here);
 * `?view=agenda` opens on every deadline ahead (Today's "All deadlines").
 *
 * The head is the companion's masthead, as on Today: the term and its week
 * as the eyebrow, and one line on what this week holds, so the page answers
 * its question before the grid is read.
 */
import type { Deadline, Session } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { readyWords } from '~/companion/words'
import { useCapture } from '~/companion/capture'
import { courseColor } from '~/companion/colors'
import { clock, dayKey, daysBetween, longDayLabel, mondayOf, shiftDay, shortDate, weekdayShort } from '~/companion/time'

definePageMeta({ layout: 'companion' })

const c = useCompanion()
const capture = useCapture()
const route = useRoute()
const router = useRouter()

const VIEWS = [
  { value: 'week', label: 'Week' },
  { value: 'agenda', label: 'All deadlines' },
] as const

const view = computed(() => (route.query.view === 'agenda' ? 'agenda' : 'week'))
function setView(v: 'week' | 'agenda'): void {
  void router.replace({ query: { ...route.query, view: v === 'week' ? undefined : v } })
}

/* -- One week ------------------------------------------------------------ */

const today = dayKey()
const offset = ref(0)
const monday = computed(() => shiftDay(mondayOf(today), offset.value * 7))
const days = computed(() => Array.from({ length: 7 }, (_, i) => shiftDay(monday.value, i)))
const weekNumber = computed(() => c.weekOf(`${monday.value}T12:00:00`))

function weeksFromNow(day: string): number {
  return Math.round((Date.parse(mondayOf(day)) - Date.parse(mondayOf(today))) / (7 * 86_400_000))
}

const focusDay = computed(() => {
  const d = route.query.date
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
})
watch(
  focusDay,
  (d) => {
    if (!d) return
    offset.value = weeksFromNow(d)
    void nextTick(() => document.getElementById(`day-${d}`)?.scrollIntoView({ block: 'start' }))
  },
  { immediate: true },
)

function sessionsOn(day: string): Session[] {
  return c.sessions.value
    .filter((s) => dayKey(s.starts_at) === day)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
}
function dueOn(day: string): Deadline[] {
  return c.deadlines.value
    .filter((d) => d.due_at && d.status !== 'cancelled' && dayKey(d.due_at) === day)
    .sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!))
}
function isPast(day: string): boolean {
  return daysBetween(today, day) < 0
}
function dueTime(d: Deadline): string {
  return d.all_day ? '' : clock(d.due_at!)
}
function readyOf(d: Deadline): string {
  const r = c.readinessOf(d)
  return readyWords(r.checked ? r.percent : null)
}

function weekName(n: number | null): string | null {
  if (!n || n < 1 || n > 16) return null
  return n > 14 ? `Exam week ${n - 14}` : `Week ${n}`
}

const weekTitle = computed(() => {
  if (offset.value === 0) return 'This week'
  if (offset.value === 1) return 'Next week'
  if (offset.value === -1) return 'Last week'
  return weekName(weekNumber.value) ?? `Week of ${shortDate(monday.value)}`
})

const weekRange = computed(() => {
  const range = `${shortDate(monday.value)} – ${shortDate(shiftDay(monday.value, 6))}`
  const name = Math.abs(offset.value) <= 1 ? weekName(weekNumber.value) : null
  return [range, name?.toLowerCase()].filter(Boolean).join(' · ')
})

/** "4 classes and 2 deadlines this week": the masthead's line. */
const summary = computed(() => {
  const thisWeek = days.value
  const classes = c.sessions.value.filter((s) => !s.cancelled && thisWeek.includes(dayKey(s.starts_at))).length
  const due = c.deadlines.value.filter(
    (d) => d.due_at && d.status === 'upcoming' && thisWeek.includes(dayKey(d.due_at)),
  ).length
  if (!classes && !due) return offset.value === 0 ? 'Nothing on this week' : ''
  const parts = [classes ? plural(classes, 'class', 'classes') : '', due ? plural(due, 'deadline') : '']
  const when = offset.value === 0 ? 'this week' : offset.value === 1 ? 'next week' : offset.value === -1 ? 'last week' : 'that week'
  return `${parts.filter(Boolean).join(' and ')} ${when}`
})

const termLine = computed(() => {
  const n = c.currentWeek.value
  return [c.termGoal.value?.title ?? 'Your semester', n && n <= 14 ? `week ${n} of 14` : ''].filter(Boolean).join(' · ')
})

function pickWeek(n: number): void {
  const term = c.termGoal.value
  if (!term?.starts_on) return
  offset.value = weeksFromNow(shiftDay(term.starts_on, (n - 1) * 7))
  setView('week')
  void nextTick(() => document.getElementById('week-view')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

/* -- The busiest week ahead ---------------------------------------------- */

const crowded = computed(() => {
  const now = c.currentWeek.value ?? 0
  const byWeek = new Map<number, Deadline[]>()
  for (const d of c.deadlines.value) {
    if (d.status !== 'upcoming' || !d.due_at || d.kind === 'milestone' && c.subjectOf(d)?.format === 'path') continue
    const n = c.weekOf(d.due_at)
    if (!n || n <= now || n > 14) continue
    byWeek.set(n, [...(byWeek.get(n) ?? []), d])
  }
  const [n, list] = [...byWeek.entries()].sort((a, b) => b[1].length - a[1].length || a[0] - b[0])[0] ?? [null, []]
  return n && list.length >= 3 ? { n, list } : null
})

/* -- Everything ahead ---------------------------------------------------- */

const agenda = computed(() => {
  const groups: { label: string; items: Deadline[] }[] = []
  for (const d of c.deadlines.value) {
    if (d.status !== 'upcoming' || !d.due_at || Date.parse(d.due_at) < Date.now()) continue
    const n = c.weekOf(d.due_at)
    const label = n && n <= 16 ? (n === c.currentWeek.value ? 'This week' : weekName(n)!) : 'Later'
    const last = groups.at(-1)
    if (last?.label === label) last.items.push(d)
    else groups.push({ label, items: [d] })
  }
  return groups
})
</script>

<template>
  <div class="pb-20">
    <CompanionShellMasthead
      title="Calendar"
      :eyebrow="termLine"
      :subtitle="summary"
    >
      <template #actions>
        <div
          class="inline-flex rounded-full bg-surface-track p-1"
          role="tablist"
          aria-label="Show"
        >
          <button
            v-for="v in VIEWS"
            :key="v.value"
            type="button"
            role="tab"
            :aria-selected="view === v.value"
            class="h-9 cursor-pointer rounded-full px-4 text-[13.5px] font-semibold whitespace-nowrap transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            :class="view === v.value ? 'bg-surface text-text shadow-segment' : 'text-text-muted hover:text-text'"
            @click="setView(v.value)"
          >
            {{ v.label }}
          </button>
        </div>
      </template>
    </CompanionShellMasthead>

    <div class="mx-auto grid w-full max-w-[1120px] content-start gap-10 px-4 pt-5 sm:px-6 lg:gap-12 lg:px-8 lg:pt-8">
      <!-- The same switch on a phone, under the line, full width. -->
      <div
        class="flex rounded-full bg-surface-track p-1 lg:hidden"
        role="tablist"
        aria-label="Show"
      >
        <button
          v-for="v in VIEWS"
          :key="v.value"
          type="button"
          role="tab"
          :aria-selected="view === v.value"
          class="h-10 flex-1 cursor-pointer rounded-full px-5 text-[14.5px] font-semibold whitespace-nowrap transition-colors duration-150"
          :class="view === v.value ? 'bg-surface text-text shadow-segment' : 'text-text-muted hover:text-text'"
          @click="setView(v.value)"
        >
          {{ v.label }}
        </button>
      </div>

      <div
        v-if="!c.status.ready"
        class="grid gap-3"
        aria-busy="true"
        aria-label="Loading the calendar"
      >
        <div class="cp-skel h-6 w-40" />
        <div class="cp-skel h-[300px] rounded-[16px]" />
      </div>

      <template v-else-if="view === 'week'">
        <section
          id="week-view"
          class="grid scroll-mt-4 gap-4"
          aria-labelledby="cal-week"
        >
          <header class="flex flex-wrap items-center justify-between gap-3">
            <div class="grid gap-0.5">
              <h2
                id="cal-week"
                class="t-head text-[19px]"
              >
                {{ weekTitle }}
              </h2>
              <p class="text-[14px] text-text-muted">
                {{ weekRange }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <UiBtn
                v-if="offset !== 0"
                variant="secondary"
                size="lg"
                @click="offset = 0"
              >
                This week
              </UiBtn>
              <UiBtn
                variant="secondary"
                size="lg"
                square
                icon="chevron-left"
                label="Previous week"
                @click="offset--"
              />
              <UiBtn
                variant="secondary"
                size="lg"
                square
                icon="chevron-right"
                label="Next week"
                @click="offset++"
              />
            </div>
          </header>

          <div
            v-if="!c.sessions.value.length"
            class="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[18px] bg-surface p-4 shadow-[inset_0_0_0_1px_var(--border)]"
          >
            <span class="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
              <UiIcon
                name="calendar"
                :size="18"
              />
            </span>
            <p class="min-w-0 flex-1 text-[14.5px] leading-snug text-text-body">
              Exam dates from a timetable PDF show up here.
            </p>
            <UiBtn
              to="/app/connect"
              variant="secondary"
              size="lg"
            >
              Add an exam timetable
            </UiBtn>
          </div>

          <!-- Wide: seven columns, split by hairlines. -->
          <ol class="hidden border-y border-border-rule min-[1280px]:grid min-[1280px]:grid-cols-7 min-[1280px]:divide-x min-[1280px]:divide-border-rule">
            <li
              v-for="day in days"
              :key="day"
              class="grid min-h-[320px] min-w-0 content-start gap-1 px-1.5 pt-3 pb-5"
              :class="isPast(day) ? 'opacity-55' : ''"
              :aria-label="longDayLabel(day)"
            >
              <h3 class="mb-2 flex items-center gap-1.5 px-2">
                <span
                  class="text-[14px]"
                  :class="day === today ? 'font-semibold text-cobalt' : 'font-medium text-text-muted'"
                >{{ weekdayShort(day) }}</span>
                <span
                  class="t-head grid size-8 place-items-center rounded-full text-[17px]"
                  :class="day === today ? 'bg-cobalt text-white dark:bg-brand-strong' : 'text-text'"
                >{{ +day.slice(8) }}</span>
              </h3>

              <NuxtLink
                v-for="d in dueOn(day)"
                :key="d.id"
                :to="`/app/d/${d.id}`"
                class="grid min-w-0 gap-0.5 rounded-[12px] bg-cobalt-soft px-2.5 py-2 transition-colors hover:bg-brand-line"
              >
                <span class="flex items-center gap-1 text-[13px] font-semibold text-cobalt">
                  <CompanionIcon
                    name="flag"
                    :size="13"
                    :stroke="2"
                  />
                  Due {{ dueTime(d) }}
                </span>
                <span class="text-[14.5px] leading-snug font-semibold text-text">{{ d.title }}</span>
                <span class="flex min-w-0 items-center gap-1.5 text-[13px] text-text-muted">
                  <span
                    class="size-2 shrink-0 rounded-full"
                    :style="{ background: courseColor(c.subjectOf(d)?.color) }"
                  />
                  <span class="truncate">{{ c.subjectOf(d)?.title }}</span>
                </span>
                <span class="text-[13px] text-text-soft">{{ d.tentative ? 'not confirmed' : readyOf(d) }}</span>
              </NuxtLink>

              <NuxtLink
                v-for="s in sessionsOn(day)"
                :key="s.id"
                :to="`/app/courses/${s.subject_id}`"
                class="grid min-w-0 gap-0.5 rounded-[12px] px-2.5 py-2 transition-colors hover:bg-surface-mute"
                :class="s.cancelled ? 'opacity-55' : ''"
                :title="[c.subjectOf(s)?.title, s.title, s.location].filter(Boolean).join(' · ')"
              >
                <span class="text-[13px] font-semibold text-text-muted">{{ s.cancelled ? 'Cancelled' : `${clock(s.starts_at)}–${clock(s.ends_at)}` }}</span>
                <span
                  class="text-[14.5px] leading-snug font-medium text-text"
                  :class="s.cancelled ? 'line-through' : ''"
                >{{ s.title }}</span>
                <span class="flex min-w-0 items-center gap-1.5 text-[13px] text-text-muted">
                  <span
                    class="size-2 shrink-0 rounded-full"
                    :style="{ background: courseColor(c.subjectOf(s)?.color) }"
                  />
                  <span class="truncate">{{ c.subjectOf(s)?.title }}</span>
                </span>
                <span
                  v-if="s.location"
                  class="truncate text-[13px] text-text-muted"
                >{{ s.location }}</span>
              </NuxtLink>

              <p
                v-if="!sessionsOn(day).length && !dueOn(day).length"
                class="px-2.5 text-[14px] text-text-faint"
              >
                Free
              </p>
            </li>
          </ol>

          <!-- Narrow: the same week, day by day. -->
          <ol class="grid max-w-[760px] gap-8 min-[1280px]:hidden">
            <li
              v-for="day in days"
              :id="`day-${day}`"
              :key="day"
              class="grid scroll-mt-4 gap-2"
              :class="isPast(day) ? 'opacity-55' : ''"
            >
              <h3 class="flex items-baseline gap-2">
                <span class="t-head text-[17px]">{{ longDayLabel(day) }}</span>
                <span
                  v-if="day === today"
                  class="text-[14px] font-semibold text-cobalt"
                >Today</span>
              </h3>

              <NuxtLink
                v-for="d in dueOn(day)"
                :key="d.id"
                :to="`/app/d/${d.id}`"
                class="group -mx-2 flex items-center gap-4 rounded-[14px] bg-cobalt-soft px-2 py-3 transition-colors hover:bg-brand-line"
              >
                <span class="grid w-[64px] shrink-0 leading-tight">
                  <span class="flex items-center gap-1 text-[15px] font-semibold text-cobalt">
                    <CompanionIcon
                      name="flag"
                      :size="14"
                      :stroke="2"
                    />
                    Due
                  </span>
                  <span class="text-[13px] text-cobalt">{{ dueTime(d) }}</span>
                </span>
                <span class="grid min-w-0 flex-1 gap-0.5">
                  <span class="truncate text-[16px] leading-snug font-semibold text-text">{{ d.title }}</span>
                  <span class="flex min-w-0 items-center gap-1.5 text-[13.5px] text-text-muted">
                    <span
                      class="size-2 shrink-0 rounded-full"
                      :style="{ background: courseColor(c.subjectOf(d)?.color) }"
                    />
                    <span class="truncate">{{ [c.subjectOf(d)?.title, d.tentative ? 'not confirmed' : null].filter(Boolean).join(' · ') }}</span>
                  </span>
                </span>
                <span class="shrink-0 text-[14px] font-medium text-text-soft">{{ readyOf(d) }}</span>
                <CompanionIcon
                  name="chevron-right"
                  :size="18"
                  class="shrink-0 text-text-faint transition-colors group-hover:text-text-soft"
                />
              </NuxtLink>

              <ul
                v-if="sessionsOn(day).length"
                class="divide-y divide-border-rule border-y border-border-rule"
              >
                <li
                  v-for="s in sessionsOn(day)"
                  :key="s.id"
                >
                  <NuxtLink
                    :to="`/app/courses/${s.subject_id}`"
                    class="group -mx-2 flex items-center gap-4 rounded-[12px] px-2 py-3 transition-colors hover:bg-surface-mute"
                    :class="s.cancelled ? 'opacity-55' : ''"
                  >
                    <span class="grid w-[64px] shrink-0 leading-tight">
                      <span class="text-[15px] font-semibold text-text">{{ clock(s.starts_at) }}</span>
                      <span class="text-[13px] text-text-muted">{{ clock(s.ends_at) }}</span>
                    </span>
                    <span class="grid min-w-0 flex-1 gap-0.5">
                      <span
                        class="truncate text-[16px] leading-snug font-medium text-text"
                        :class="s.cancelled ? 'line-through' : ''"
                      >{{ s.title }}</span>
                      <span class="flex min-w-0 items-center gap-1.5 text-[13.5px] text-text-muted">
                        <span
                          class="size-2 shrink-0 rounded-full"
                          :style="{ background: courseColor(c.subjectOf(s)?.color) }"
                        />
                        <span class="truncate">{{ [c.subjectOf(s)?.title, s.location, s.cancelled ? 'cancelled' : null].filter(Boolean).join(' · ') }}</span>
                      </span>
                    </span>
                    <CompanionIcon
                      name="chevron-right"
                      :size="18"
                      class="shrink-0 text-text-faint transition-colors group-hover:text-text-soft"
                    />
                  </NuxtLink>
                </li>
              </ul>

              <p
                v-if="!sessionsOn(day).length && !dueOn(day).length"
                class="border-y border-border-rule py-3 text-[15px] text-text-faint"
              >
                Nothing on
              </p>
            </li>
          </ol>
        </section>

        <section
          v-if="c.termGoal.value?.starts_on"
          class="grid gap-3"
          aria-labelledby="cal-term"
        >
          <header class="flex items-baseline justify-between gap-3">
            <h2
              id="cal-term"
              class="t-head text-[19px]"
            >
              The semester
            </h2>
            <button
              type="button"
              class="text-[14px] font-semibold text-cobalt hover:underline"
              @click="setView('agenda')"
            >
              All deadlines
            </button>
          </header>
          <p class="text-[15px] text-text-muted">
            How much is due each week. Tap a week to see it.
          </p>
          <CompanionSemesterStrip
            :shown="weekNumber"
            @pick="pickWeek"
          />
          <p
            v-if="crowded"
            class="max-w-[760px] text-[15px] leading-relaxed text-text-body"
          >
            <b class="font-semibold text-text">Week {{ crowded.n }} is the busiest:</b>
            {{ crowded.list.map((d) => `${d.title} (${c.subjectOf(d)?.title})`).join(', ') }}.
            Your daily plan starts on them before it arrives.
            <button
              type="button"
              class="font-semibold whitespace-nowrap text-cobalt hover:underline"
              @click="pickWeek(crowded.n)"
            >
              See week {{ crowded.n }}
            </button>
          </p>
        </section>
      </template>

      <!-- Everything ahead, by week. -->
      <div
        v-else
        class="grid max-w-[760px] gap-10"
      >
        <CompanionBox
          v-for="g in agenda"
          :key="g.label"
          :label="g.label"
        >
          <div class="divide-y divide-border-rule border-y border-border-rule">
            <CompanionDeadlineRow
              v-for="d in g.items"
              :key="d.id"
              :deadline="d"
            />
          </div>
        </CompanionBox>
        <UiEmptyState
          v-if="!agenda.length"
          icon="calendar"
          title="Nothing due from here on"
          description="Dates arrive from Moodle, your email and the lectures. Or paste a message that mentions one."
          class="py-12"
        >
          <UiBtn
            variant="secondary"
            size="lg"
            @click="capture.show('paste')"
          >
            Paste a message
          </UiBtn>
        </UiEmptyState>
      </div>
    </div>
  </div>
</template>
