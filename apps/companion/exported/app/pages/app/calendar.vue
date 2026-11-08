<script setup lang="ts">
/**
 * The Calendar: the whole page for the week, drawn the way Google and Notion
 * Calendar draw one (`WeekGrid`), with the hours down the left, a column a
 * day, classes at their times in their course's colour and deadlines as rose
 * chips at theirs. What has no time (deadlines due all day, the plan's study
 * blocks, the learner's own tasks) sits in the strip under the dates.
 *
 * It used to be a 750px column of narrow text cards with no hours, where one
 * check's title wrapped into a tower and nothing could be done without
 * leaving the page. Now:
 *  - a block opens a peek beside it (`Peek`): open it, tick it, move it on;
 *  - an empty hour adds a task of your own on that day;
 *  - a study block or task drags to another day still to come. The server
 *    pins a moved plan block (`week-plan.ts`), so the planner plans around it.
 *
 * The head is one row: the week, ‹ Today ›, the week's counts, "Plan my
 * week" and Week · Month · All deadlines. "1 thing from earlier days isn't
 * done · Move to today" sits under it only when something is. The semester
 * strip and the busiest week ahead moved to All deadlines, where the weeks
 * ahead are the question.
 *
 * On a phone, or wherever the page is narrower than a week can be read, the
 * grid is one day, with a strip of the week's days to switch.
 *
 * `?date=2026-10-29` opens the week (and on a phone the day) holding that
 * date; `?view=agenda` opens on every deadline ahead; `?view=month` the month.
 */
import type { Deadline, PlanTask } from '~/companion/types'
import type { CalendarTarget } from '~/companion/calendar-grid'
import type { ConnectKind } from '~/companion/create'
import { useCompanion } from '~/companion/store'
import { moveTask, planDays } from '~/companion/week-plan'
import { useCapture } from '~/companion/capture'
import { dayKey, dayLabel, dayMonthLong, daysBetween, mondayOf, shiftDay, shortDate, weekdayLong, weekdayOf, weekdayShort } from '~/companion/time'

definePageMeta({ layout: 'companion' })

const c = useCompanion()
const capture = useCapture()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()

type View = 'week' | 'month' | 'agenda'
const VIEWS = computed<{ value: View; label: string }[]>(() => [
  { value: 'week', label: t('calendar.views.week') },
  { value: 'month', label: t('calendar.views.month') },
  { value: 'agenda', label: t('calendar.views.agenda') },
])

const view = computed<View>(() => (route.query.view === 'agenda' || route.query.view === 'month' ? route.query.view : 'week'))
function setView(v: View): void {
  void router.replace({ query: { ...route.query, view: v === 'week' ? undefined : v } })
}

/* -- Where the calendar is ------------------------------------------------- */

const today = dayKey()
/** The day in view: its week in the grid, its month in Month, itself on a phone. */
const cursor = ref(today)
const monday = computed(() => mondayOf(cursor.value))
const days = computed(() => Array.from({ length: 7 }, (_, i) => shiftDay(monday.value, i)))
const offset = computed(() => Math.round(daysBetween(mondayOf(today), monday.value) / 7))
const weekNumber = computed(() => c.weekOf(`${monday.value}T12:00:00`))

watch(
  () => route.query.date,
  (d) => {
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) cursor.value = d
  },
  { immediate: true },
)

/** A week either way, or a month in Month (the 1st, so a 31st never skips a short month). */
function step(by: -1 | 1): void {
  if (view.value !== 'month') {
    cursor.value = shiftDay(cursor.value, by * 7)
    return
  }
  const [y, m] = cursor.value.split('-').map(Number) as [number, number]
  const at = new Date(Date.UTC(y, m - 1 + by, 1))
  cursor.value = at.toISOString().slice(0, 10)
}

function weekName(n: number | null): string | null {
  if (!n || n < 1 || n > 16) return null
  return n > 14 ? `exam week ${n - 14}` : `week ${n}`
}

/** "2–8 November", "30 Oct – 5 Nov", "November 2026", or "All deadlines". */
const heading = computed(() => {
  if (view.value === 'agenda') return 'All deadlines'
  if (view.value === 'month') {
    return new Date(`${cursor.value.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }
  const [a, b] = [days.value[0]!, days.value[6]!]
  return a.slice(0, 7) === b.slice(0, 7) ? `${+a.slice(8, 10)}–${dayMonthLong(b)}` : `${shortDate(a)} – ${shortDate(b)}`
})

/** "4 classes, 2 deadlines and 2 hr of study": the week in one line. */
const summary = computed(() => {
  const week = days.value
  const classes = c.sessions.value.filter((s) => !s.cancelled && week.includes(dayKey(s.starts_at))).length
  const due = c.deadlines.value.filter((d) => d.due_at && d.status === 'upcoming' && week.includes(dayKey(d.due_at))).length
  const study = c.planTasks.value
    .filter((t) => t.date && week.includes(t.date) && (t.date >= today || t.done_at))
    .reduce((sum, t) => sum + t.minutes, 0)
  const parts = [
    classes ? t('calendar.classes', classes) : '',
    due ? t('calendar.deadlines', due) : '',
    study ? t('calendar.summary.studyOf', { time: minutesLabel(study) }) : '',
  ].filter(Boolean)
  if (!parts.length) return offset.value === 0 ? t('calendar.summary.nothingThisWeek') : t('calendar.summary.nothingOn')
  return parts.length > 1 ? t('calendar.summary.and', { list: parts.slice(0, -1).join(', '), last: parts.at(-1) }) : parts[0]!
})

/* -- One day on a phone ------------------------------------------------------ */

const root = ref<HTMLElement | null>(null)
/** Narrower than seven readable columns: the page's own width, since the sidebar and the assistant take from it. */
const narrow = ref(false)
let watcher: ResizeObserver | null = null
onMounted(() => {
  if (!root.value) return
  watcher = new ResizeObserver(([entry]) => (narrow.value = (entry?.contentRect.width ?? 1000) < 640))
  watcher.observe(root.value)
})
onBeforeUnmount(() => watcher?.disconnect())

const gridDays = computed(() => (narrow.value ? [cursor.value] : days.value))

function dueCount(day: string): number {
  return c.deadlines.value.filter((d) => d.due_at && d.status === 'upcoming' && dayKey(d.due_at) === day).length
}

/* -- Peeks, adds and moves ----------------------------------------------------- */

const peeked = ref<{ target: CalendarTarget; at: DOMRect } | null>(null)

/* Integrations: the subscription link and the timetable-link flow, opened in place. */
const calendarApps = ref(false)
const connecting = ref<ConnectKind | null>(null)
const ghost = computed(() => {
  const t = peeked.value?.target
  return t?.kind === 'add' && t.minute !== null ? { day: t.day, minute: t.minute } : null
})

const isPast = (day: string): boolean => daysBetween(today, day) < 0

/** "today", "tomorrow", "Wednesday" in this week; a date in any other. */
function dayWord(day: string): string {
  const diff = daysBetween(today, day)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  return diff > 0 && diff < 7 ? weekdayLong(weekdayOf(day)) : dayLabel(day)
}

/** To another day, an hour (`time`), or back to the day's strip (`time` null); undefined keeps the hour. */
async function move(t: PlanTask, day: string, time?: string | null): Promise<void> {
  const from = t.date
  const fromTime = t.starts_at ?? null
  try {
    await moveTask(c, t, day, time)
  } catch {
    return // the store has said it couldn't be saved, and put the block back
  }
  const at = time === undefined ? fromTime : time
  toast.success({
    title: day === from
      ? at ? `Moved to ${at}` : 'Time cleared'
      : `Moved to ${dayWord(day)}${at ? ` at ${at}` : ''}`,
    body: t.kind === 'own' || day === from ? undefined : 'It stays there when the plan is redone.',
    duration: 5000,
    action: from
      ? {
          label: 'Undo',
          handler: () => {
            const now = c.get('plan_tasks', t.id)
            if (now) void moveTask(c, now, from, fromTime)
          },
        }
      : undefined,
  })
}

/** Left from earlier days and not done: Today's quiet count, with its one fix. */
const behind = computed(() => c.planTasks.value.filter((t) => t.date !== null && t.date < today && !t.done_at))
const catchingUp = ref(false)
async function catchUp(): Promise<void> {
  if (catchingUp.value) return
  catchingUp.value = true
  const moving = [...behind.value]
  try {
    for (const t of moving) await moveTask(c, t, today)
    toast.success(t('calendar.behind.movedSuccess', moving.length))
  } catch {
    // The store has said which one couldn't be saved.
  } finally {
    catchingUp.value = false
  }
}

/** "Plan my week": the days left in the week shown, planned again around what was moved. */
const planning = ref(false)
const planLabel = computed(() => (offset.value === 0 ? t('calendar.plan.myWeek') : offset.value === 1 ? t('calendar.plan.nextWeek') : t('calendar.plan.thatWeek')))
const canPlan = computed(() => days.value.some((d) => !isPast(d)))
async function planWeek(): Promise<void> {
  if (planning.value) return
  planning.value = true
  try {
    await planDays(c, days.value)
    toast.success({ title: offset.value === 0 ? t('calendar.plan.planned') : t('calendar.plan.plannedThat'), body: t('calendar.plan.plannedBody') })
  } catch {
    toast.error(t('calendar.plan.planError'))
  } finally {
    planning.value = false
  }
}

/** A day picked in Month: its week in the grid. */
function openDay(day: string): void {
  cursor.value = day
  setView('week')
}

/* -- The weeks ahead (All deadlines) ------------------------------------------- */

function pickWeek(n: number): void {
  const term = c.termGoal.value
  if (!term?.starts_on) return
  openDay(shiftDay(term.starts_on, (n - 1) * 7))
}

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

const agenda = computed(() => {
  const groups: { label: string; items: Deadline[] }[] = []
  for (const d of c.deadlines.value) {
    if (d.status !== 'upcoming' || !d.due_at || Date.parse(d.due_at) < Date.now()) continue
    const n = c.weekOf(d.due_at)
    const name = weekName(n)
    const label = n && n <= 16 ? (n === c.currentWeek.value ? 'This week' : name!.charAt(0).toUpperCase() + name!.slice(1)) : 'Later'
    const last = groups.at(-1)
    if (last?.label === label) last.items.push(d)
    else groups.push({ label, items: [d] })
  }
  return groups
})

const termLine = computed(() => {
  const n = c.currentWeek.value
  return [c.termGoal.value?.title ?? 'Your semester', n && n <= 14 ? `week ${n} of 14` : ''].filter(Boolean).join(' · ')
})
</script>

<template>
  <div
    ref="root"
    class="flex min-h-0 flex-1 flex-col"
  >
    <ShellPageHead
      title="Calendar"
      bar-only
    />

    <!-- One row: where you are, how to move, what the week holds, what to show. -->
    <header class="@container flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border-rule px-4 py-3 lg:px-5">
      <div class="flex min-w-0 items-baseline gap-2">
        <h1
          class="font-display text-[21px] leading-tight font-semibold tracking-[-0.03em] whitespace-nowrap text-text"
          :title="view === 'week' ? summary : undefined"
        >
          <span class="sr-only">Calendar, </span>{{ heading }}
        </h1>
        <span
          v-if="view === 'week' && weekName(weekNumber)"
          class="text-[13.5px] font-medium whitespace-nowrap text-text-muted"
        >{{ weekName(weekNumber) }}</span>
      </div>

      <div
        v-if="view !== 'agenda'"
        class="flex items-center gap-1"
      >
        <UiBtn
          variant="ghost"
          size="sm"
          square
          icon="chevron-left"
          :label="view === 'month' ? t('calendar.nav.prevMonth') : t('calendar.nav.prevWeek')"
          @click="step(-1)"
        />
        <UiBtn
          variant="secondary"
          size="sm"
          :disabled="view === 'month' ? cursor.slice(0, 7) === today.slice(0, 7) : narrow ? cursor === today : offset === 0"
          @click="cursor = today"
        >
          {{ t('calendar.nav.today') }}
        </UiBtn>
        <UiBtn
          variant="ghost"
          size="sm"
          square
          icon="chevron-right"
          :label="view === 'month' ? t('calendar.nav.nextMonth') : t('calendar.nav.nextWeek')"
          @click="step(1)"
        />
      </div>

      <!-- Only when the row has room for it; otherwise it is the heading's tooltip. -->
      <p
        v-if="view === 'week' && c.status.ready"
        class="min-w-0 truncate text-[13.5px] text-text-muted @max-[940px]:hidden"
      >
        {{ summary }}
      </p>

      <span class="flex-1" />

      <!-- Integrations: this calendar in theirs, a timetable from theirs into this one. -->
      <UiBtn
        variant="ghost"
        size="sm"
        square
        icon="link"
        :label="t('calendar.sync.addBtn')"
        :title="t('calendar.sync.addTitle')"
        @click="calendarApps = true"
      />

      <UiBtn
        v-if="view === 'week' && canPlan"
        variant="secondary"
        size="sm"
        icon="calendar"
        :loading="planning"
        :title="planLabel"
        @click="planWeek"
      >
        <!-- Its icon alone when the row is short of room, so the head stays one row. -->
        <span class="@max-[700px]:sr-only">{{ planLabel }}</span>
      </UiBtn>

      <div
        class="inline-flex rounded-full bg-surface-track p-[3px]"
        role="tablist"
        aria-label="Show"
      >
        <button
          v-for="v in VIEWS"
          :key="v.value"
          type="button"
          role="tab"
          :aria-selected="view === v.value"
          class="h-7 cursor-pointer rounded-full px-3 text-[13px] font-semibold whitespace-nowrap transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
          :class="view === v.value ? 'bg-surface text-text shadow-segment' : 'text-text-muted hover:text-text'"
          @click="setView(v.value)"
        >
          {{ v.label }}
        </button>
      </div>

    </header>

    <!-- Falling behind is one quiet line with one fix, never a week of leftovers. -->
    <p
      v-if="view === 'week' && offset === 0 && behind.length"
      class="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border-rule bg-accent-soft px-4 py-2 text-[13.5px] text-text-body lg:px-5"
    >
      {{ t('calendar.behind.line', behind.length) }}
      <button
        type="button"
        class="cursor-pointer font-semibold text-text underline underline-offset-4 hover:no-underline disabled:opacity-50"
        :disabled="catchingUp"
        @click="catchUp"
      >
        {{ t('calendar.behind.moveToToday') }}
      </button>
    </p>

    <div
      v-if="!c.status.ready"
      class="grid gap-3 p-5"
      aria-busy="true"
      aria-label="Loading the calendar"
    >
      <div class="cp-skel h-6 w-40" />
      <div class="cp-skel h-[420px] rounded-[16px]" />
    </div>

    <template v-else-if="view === 'week'">
      <!-- A phone: the week's days as a strip, the grid one day. -->
      <ol
        v-if="narrow"
        class="grid shrink-0 grid-cols-7 gap-1 border-b border-border-rule px-2 py-2"
        aria-label="Days"
      >
        <li
          v-for="day in days"
          :key="day"
        >
          <button
            type="button"
            class="grid w-full cursor-pointer justify-items-center gap-0.5 rounded-[10px] py-1.5 transition-colors"
            :class="day === cursor ? 'bg-surface-track' : 'hover:bg-[rgb(var(--wash-rgb)/0.04)]'"
            :aria-pressed="day === cursor"
            @click="cursor = day"
          >
            <span
              class="text-[11.5px] font-medium"
              :class="day === today ? 'text-accent-strong' : 'text-text-muted'"
            >{{ weekdayShort(day) }}</span>
            <span
              class="grid size-7 place-items-center rounded-full font-display text-[15px] font-semibold"
              :class="day === today ? 'bg-accent text-on-accent' : 'text-text'"
            >{{ +day.slice(8) }}</span>
            <span
              class="size-1.5 rounded-full"
              :class="dueCount(day) ? 'bg-rose' : 'bg-transparent'"
              aria-hidden="true"
            />
          </button>
        </li>
      </ol>

      <div
        v-if="!c.sessions.value.length"
        class="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border-rule px-4 py-2.5 text-[13.5px] text-text-muted lg:px-5"
      >
        {{ t('calendar.timetable.notice') }}
        <button
          type="button"
          class="cursor-pointer font-semibold text-text underline underline-offset-4 hover:no-underline"
          @click="connecting = 'ics'"
        >
          {{ t('calendar.timetable.add') }}
        </button>
      </div>

      <CompanionCalendarWeekGrid
        :days="gridDays"
        :ghost="ghost"
        @peek="(target, at) => (peeked = { target, at })"
        @move="move"
      />
    </template>

    <CompanionCalendarMonth
      v-else-if="view === 'month'"
      :month="cursor"
      @pick="openDay"
    />

    <!-- Everything ahead, by week, under the semester at a glance. -->
    <div
      v-else
      class="om-scroll min-h-0 flex-1 overflow-y-auto"
    >
      <div class="mx-auto grid w-full max-w-[860px] content-start gap-10 px-4 pt-6 pb-20 sm:px-6 lg:px-8">
        <section
          v-if="c.termGoal.value?.starts_on"
          class="grid gap-3"
          aria-labelledby="cal-term"
        >
          <h2
            id="cal-term"
            class="t-head text-[19px]"
          >
            {{ termLine }}
          </h2>
          <p class="text-[14.5px] text-text-muted">
            {{ t('calendar.agenda.termDesc') }}
          </p>
          <CompanionSemesterStrip
            :shown="c.currentWeek.value"
            @pick="pickWeek"
          />
          <p
            v-if="crowded"
            class="text-[15px] leading-relaxed text-text-body"
          >
            <b class="font-semibold text-text">{{ t('calendar.agenda.busyTitle', { n: crowded.n }) }}</b>
            {{ t('calendar.agenda.busyBody', { list: crowded.list.map((d) => `${d.title} (${c.subjectOf(d)?.title})`).join(', ') }) }}
            <button
              type="button"
              class="cursor-pointer font-semibold whitespace-nowrap text-brand hover:underline"
              @click="pickWeek(crowded.n)"
            >
              {{ t('calendar.agenda.seeWeek', { n: crowded.n }) }}
            </button>
          </p>
        </section>

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
          :title="t('calendar.agenda.nothingDue')"
          :description="t('calendar.agenda.nothingDueDesc')"
          class="py-12"
        >
          <UiBtn
            variant="secondary"
            size="lg"
            @click="capture.show('paste')"
          >
            {{ t('calendar.agenda.pasteBtn') }}
          </UiBtn>
        </UiEmptyState>
      </div>
    </div>

    <CompanionCalendarPeek
      v-if="peeked"
      :target="peeked.target"
      :at="peeked.at"
      @close="peeked = null"
      @move="move"
    />

    <UiModal
      v-model:open="calendarApps"
      :title="t('calendar.sync.addBtn')"
      :description="t('calendar.sync.modalDesc')"
    >
      <CompanionIntegrationsCalendarApps @bring="calendarApps = false; connecting = 'ics'" />
    </UiModal>
    <CompanionCreateConnectModal
      :kind="connecting"
      @close="connecting = null"
    />
  </div>
</template>
