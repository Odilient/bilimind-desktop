<script setup lang="ts">
/**
 * The Calendar's days as a time grid, the way Google and Notion Calendar draw
 * them: the hours down the left, a column a day, today washed in the
 * highlighter, a line at the time it is now. Seven columns on a desk, one on
 * a phone (the page passes the days).
 *
 * A class is a block at its times in its course's colour; a deadline with a
 * time is a small rose chip at that time; blocks that overlap share the
 * column side by side (`calendar-grid.ts` `pack`). A task with a time
 * (`starts_at`) is a block at it, `minutes` long, in its course's colour.
 * What has no time sits in the strip under the dates: deadlines due all day,
 * and the plan's study blocks and the learner's own tasks without an hour,
 * one line each. A task drags to an hour (day and time), or to a day's strip
 * (its time cleared), on a day still to come (the page saves it, `moveTask`).
 *
 * Every block opens a peek (`Peek.vue`) rather than leaving the page, and a
 * click on an empty hour offers to add a task on that day.
 */
import type { Deadline, PlanTask, Session } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { courseColor } from '~/companion/colors'
import { translate } from '~/utils/i18n'
import { useNow } from '~/companion/today-layout'
import { clock, dayKey, daysBetween, durationLabel, parts, weekdayShort } from '~/companion/time'
import { DAY_MINUTES, clockOfMinute, drawn, firstView, minuteOfClock, pack, slotAt, type CalendarTarget } from '~/companion/calendar-grid'

const props = defineProps<{
  days: string[]
  /** The empty slot being added to, drawn as a dashed block while its peek is open. */
  ghost?: { day: string; minute: number } | null
}>()
const emit = defineEmits<{
  peek: [target: CalendarTarget, at: DOMRect]
  /** `time` undefined keeps the task's hour, null clears it. */
  move: [task: PlanTask, day: string, time?: string | null]
}>()

const { t: tr } = useI18n()
const c = useCompanion()
const now = useNow()
const today = computed(() => dayKey(now.value))

/** An hour's height; the whole day scrolls inside the grid. */
const HOUR = 48
const px = (minutes: number): number => (minutes / 60) * HOUR
const GUTTER = '52px'
const cols = computed(() => ({ gridTemplateColumns: `${GUTTER} repeat(${props.days.length}, minmax(0, 1fr))` }))

const isPast = (day: string): boolean => daysBetween(today.value, day) < 0

function minuteOf(iso: string): number {
  const p = parts(iso)
  return p.hour * 60 + p.minute
}

/* -- What each day holds --------------------------------------------------- */

interface Timed {
  id: string
  start: number
  end: number
  target: CalendarTarget
}

interface Day {
  day: string
  past: boolean
  timed: (Timed & { col: number; cols: number })[]
  lane: CalendarTarget[]
  study: number
}

function tone(color: string | null | undefined): Record<string, string> {
  const col = courseColor(color)
  return {
    background: `color-mix(in oklab, ${col} 18%, var(--surface))`,
    boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${col} 40%, transparent)`,
  }
}

const grid = computed<Day[]>(() =>
  props.days.map((day) => {
    const past = isPast(day)
    const timed: Timed[] = []
    for (const s of c.sessions.value) {
      if (dayKey(s.starts_at) !== day) continue
      const end = dayKey(s.ends_at) === day ? minuteOf(s.ends_at) : DAY_MINUTES
      timed.push({ id: s.id, ...drawn(minuteOf(s.starts_at), end), target: { kind: 'class', session: s } })
    }
    const lane: CalendarTarget[] = []
    for (const d of c.deadlines.value) {
      if (!d.due_at || d.status === 'cancelled' || d.deleted_at || dayKey(d.due_at) !== day) continue
      if (d.all_day) lane.push({ kind: 'due', deadline: d })
      else timed.push({ id: d.id, ...drawn(minuteOf(d.due_at), minuteOf(d.due_at)), target: { kind: 'due', deadline: d } })
    }
    // A day gone keeps only what was done in it; what wasn't is the page's "Move to today".
    const tasks = c.planTasks.value
      .filter((t) => t.date === day && (!past || t.done_at))
      .sort((a, b) => a.position - b.position)
    for (const t of tasks) {
      if (!t.starts_at) {
        lane.push({ kind: 'task', task: t })
        continue
      }
      const start = minuteOfClock(t.starts_at)
      timed.push({ id: t.id, ...drawn(start, start + t.minutes), target: { kind: 'task', task: t } })
    }
    const lanes = pack(timed)
    return {
      day,
      past,
      timed: timed.map((t) => ({ ...t, ...lanes.get(t.id)! })),
      lane,
      study: tasks.reduce((sum, t) => sum + t.minutes, 0),
    }
  }),
)

/** The strip shows three a day until it's opened, so one busy day can't push the hours off screen. */
const LANE_SHOWN = 3
const laneOpen = ref(false)
const laneMore = computed(() => grid.value.some((d) => d.lane.length > LANE_SHOWN))

function laneLabel(target: CalendarTarget): string {
  if (target.kind === 'due') return translate('calendar.grid.dueTitle', { title: target.deadline.title })
  if (target.kind === 'task') return target.task.title
  return ''
}

function blockStyle(b: Day['timed'][number]): Record<string, string> {
  const width = 100 / b.cols
  return {
    top: `${px(b.start)}px`,
    height: `${px(b.end - b.start) - 2}px`,
    left: `calc(${b.col * width}% + 2px)`,
    width: `calc(${width}% - 4px)`,
    ...(b.target.kind === 'class'
      ? tone(c.subjectOf(b.target.session)?.color)
      : b.target.kind === 'task'
        ? tone(c.subjectOf(b.target.task)?.color)
        : {}),
  }
}

function sessionOf(t: CalendarTarget): Session | null {
  return t.kind === 'class' ? t.session : null
}
function deadlineOf(t: CalendarTarget): Deadline | null {
  return t.kind === 'due' ? t.deadline : null
}
function taskOf(t: CalendarTarget): PlanTask | null {
  return t.kind === 'task' ? t.task : null
}

function peek(target: CalendarTarget, event: MouseEvent): void {
  emit('peek', target, (event.currentTarget as HTMLElement).getBoundingClientRect())
}

/** An empty hour: a new task at that time, the slot snapped to the half hour it was clicked in. */
function addAt(event: MouseEvent, day: string): void {
  const column = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const minute = slotAt(event.clientY - column.top, HOUR)
  emit(
    'peek',
    { kind: 'add', day, minute },
    new DOMRect(column.left, column.top + px(minute), column.width, px(30)),
  )
}

/* -- Now, and where the grid opens ----------------------------------------- */

const nowTop = computed(() => px(minuteOf(new Date(now.value).toISOString())))

const scroller = ref<HTMLElement | null>(null)
onMounted(() => {
  const starts = grid.value.flatMap((d) => d.timed.map((t) => t.start))
  scroller.value?.scrollTo({ top: px(firstView(starts)) })
})

/* -- Dragging a study block or a task: to an hour, or to a day's strip ------ */

const dragged = ref<PlanTask | null>(null)
/** Where it would land: a day, and the minute in the hours or null for the strip. */
const dropAt = ref<{ day: string; minute: number | null } | null>(null)
const dropDay = computed(() => dropAt.value?.day ?? null)
/** How far down the block the pointer took it, so it lands where it's drawn, not by its top edge. */
let grab = 0

function canDrag(t: PlanTask): boolean {
  return !t.done_at && !isPast(t.date ?? today.value)
}
function dragStart(event: DragEvent, t: PlanTask): void {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', t.id)
  dragged.value = t
  grab = t.starts_at ? event.offsetY : 0
}
function dragOver(event: DragEvent, day: string, hours: boolean): void {
  const t = dragged.value
  if (!t || isPast(day)) return
  const minute = hours
    ? slotAt(event.clientY - (event.currentTarget as HTMLElement).getBoundingClientRect().top - grab, HOUR, t.minutes)
    : null
  // The strip of its own day only means something to a task with a time to take off.
  if (!hours && day === t.date && !t.starts_at) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dropAt.value = { day, minute }
}
function drop(): void {
  const t = dragged.value
  const at = dropAt.value
  dragEnd()
  if (!t || !at || isPast(at.day)) return
  const time = at.minute === null ? null : clockOfMinute(at.minute)
  if (at.day !== t.date || time !== (t.starts_at ?? null)) emit('move', t, at.day, time)
}
function dragEnd(): void {
  dragged.value = null
  dropAt.value = null
}

/** "25m", "1h13": a day's study, short enough for a narrow column's head. */
function studyShort(m: number): string {
  return m < 60 ? tr('calendar.grid.mShort', { n: m }) : `${Math.floor(m / 60)}${tr('calendar.grid.hShort')}${m % 60 ? String(m % 60).padStart(2, '0') : ''}`
}

const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`)
</script>

<template>
  <div
    ref="scroller"
    class="om-scroll relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
  >
    <!-- The dates and the untimed strip stay put while the hours scroll. -->
    <div
      class="sticky top-0 z-20 grid border-b border-border-rule bg-surface"
      :style="cols"
    >
      <!-- One day (a phone) has the page's day strip for its head. -->
      <span
        v-if="days.length > 1"
        aria-hidden="true"
      />
      <div
        v-for="d in days.length > 1 ? grid : []"
        :key="`h-${d.day}`"
        class="flex min-w-0 items-center gap-1.5 border-l border-border-rule px-2 pt-2.5 pb-1.5"
      >
        <span
          class="text-[12.5px]"
          :class="d.day === today ? 'font-semibold text-accent-strong' : 'font-medium text-text-muted'"
        >{{ weekdayShort(d.day) }}</span>
        <span
          class="grid size-7 place-items-center rounded-full font-display text-[15px] font-semibold"
          :class="d.day === today ? 'bg-accent text-on-accent' : d.past ? 'text-text-faint' : 'text-text'"
        >{{ +d.day.slice(8) }}</span>
        <span
          v-if="d.study"
          class="ml-auto text-[11.5px] font-medium whitespace-nowrap text-text-faint tabular-nums"
          :title="tr('calendar.grid.ofStudy', { time: durationLabel(d.study * 60) })"
        >{{ studyShort(d.study) }}</span>
      </div>

      <!-- Untimed: deadlines due all day, the plan's study blocks, your own tasks. -->
      <span class="self-start px-1.5 pt-1.5 text-right text-[11px] leading-tight font-medium text-text-faint">{{ tr('calendar.grid.todo') }}</span>
      <ul
        v-for="d in grid"
        :key="`l-${d.day}`"
        class="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-1 border-l border-border-rule px-1 pt-1 pb-1.5 transition-colors"
        :class="dropDay === d.day && dropAt?.minute === null && 'bg-sky-soft'"
        :aria-label="tr('calendar.grid.todoOn', { day: `${weekdayShort(d.day)} ${+d.day.slice(8)}` })"
        @dragover="dragOver($event, d.day, false)"
        @dragleave="dropDay === d.day && (dropAt = null)"
        @drop.prevent="drop"
      >
        <li
          v-for="t in laneOpen ? d.lane : d.lane.slice(0, LANE_SHOWN)"
          :key="t.kind === 'due' ? t.deadline.id : taskOf(t)?.id"
        >
          <button
            type="button"
            :draggable="taskOf(t) ? canDrag(taskOf(t)!) : false"
            :title="laneLabel(t)"
            :class="[
              'flex h-6 w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-[6px] px-1.5 text-left text-[12px] font-medium transition-shadow hover:shadow-card focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
              t.kind === 'due' ? 'bg-rose-soft text-rose-ink' : 'text-text',
              taskOf(t)?.done_at && 'opacity-55',
              taskOf(t) && canDrag(taskOf(t)!) && 'cursor-grab active:cursor-grabbing',
              dragged && dragged.id === taskOf(t)?.id && 'opacity-40',
            ]"
            :style="taskOf(t) ? tone(c.subjectOf(taskOf(t)!)?.color) : undefined"
            @click="peek(t, $event)"
            @dragstart="taskOf(t) && dragStart($event, taskOf(t)!)"
            @dragend="dragEnd"
          >
            <CompanionIcon
              v-if="t.kind === 'due'"
              name="flag"
              :size="11"
              :stroke="2.2"
              class="shrink-0"
            />
            <span
              v-else-if="taskOf(t)?.done_at"
              class="shrink-0 text-leaf-ink"
              
              :aria-label="tr('calendar.grid.done')"
            >✓</span>
            <span
              v-else
              class="num shrink-0 text-[11px] font-semibold text-text-muted"
            >{{ tr('calendar.grid.mShort', { n: taskOf(t)!.minutes }) }}</span>
            <span
              class="truncate"
              :class="taskOf(t)?.done_at && 'line-through'"
            >{{ t.kind === 'due' ? deadlineOf(t)!.title : taskOf(t)!.title }}</span>
          </button>
        </li>
        <li
          v-if="!laneOpen && d.lane.length > LANE_SHOWN"
          class="px-1.5 text-[11.5px] font-semibold text-text-muted"
        >
          <button
            type="button"
            class="cursor-pointer hover:text-text"
            @click="laneOpen = true"
          >
            {{ tr('calendar.grid.more', { n: d.lane.length - LANE_SHOWN }) }}
          </button>
        </li>
      </ul>
      <button
        v-if="laneOpen && laneMore"
        type="button"
        class="col-span-full cursor-pointer py-1 text-[11.5px] font-semibold text-text-muted hover:text-text"
        @click="laneOpen = false"
      >
        {{ tr('calendar.grid.showLess') }}
      </button>
    </div>

    <!-- The hours. -->
    <div
      class="relative grid"
      :style="{ ...cols, height: `${px(DAY_MINUTES)}px` }"
    >
      <ol
        class="relative"
        aria-hidden="true"
      >
        <li
          v-for="(h, i) in HOURS"
          :key="h"
          class="absolute right-2 -translate-y-1/2 text-[11px] font-medium text-text-faint tabular-nums"
          :style="{ top: `${i * HOUR}px` }"
        >
          {{ i ? h : '' }}
        </li>
      </ol>

      <div
        v-for="d in grid"
        :key="`g-${d.day}`"
        class="cal-hours relative min-w-0 cursor-cell border-l border-border-rule transition-colors"
        :class="[
          d.day === today && 'bg-[color-mix(in_oklab,var(--accent-soft)_45%,transparent)]',
        ]"
        :style="{ '--hour': `${HOUR}px` }"
        @click.self="addAt($event, d.day)"
        @dragover="dragOver($event, d.day, true)"
        @dragleave.self="dropDay === d.day && (dropAt = null)"
        @drop.prevent="drop"
      >
        <button
          v-for="b in d.timed"
          :key="b.id"
          type="button"
          :draggable="taskOf(b.target) ? canDrag(taskOf(b.target)!) : false"
          :class="[
            'absolute grid min-w-0 cursor-pointer content-start overflow-hidden rounded-[7px] px-1.5 py-1 text-left transition-shadow hover:z-10 hover:shadow-raised focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
            b.target.kind === 'due' ? 'bg-rose-soft text-rose-ink shadow-[inset_0_0_0_1px_var(--rose)]' : 'text-text',
            d.past && 'opacity-65',
            sessionOf(b.target)?.cancelled && 'opacity-50',
            taskOf(b.target)?.done_at && 'opacity-55',
            taskOf(b.target) && canDrag(taskOf(b.target)!) && 'cursor-grab active:cursor-grabbing',
            dragged && dragged.id === taskOf(b.target)?.id && 'opacity-40',
          ]"
          :style="blockStyle(b)"
          :title="sessionOf(b.target)
            ? [sessionOf(b.target)!.title, c.subjectOf(sessionOf(b.target)!)?.title, sessionOf(b.target)!.location].filter(Boolean).join(' · ')
            : taskOf(b.target)
              ? `${taskOf(b.target)!.starts_at} · ${taskOf(b.target)!.title}`
              : tr('calendar.grid.dueAt', { time: clock(deadlineOf(b.target)!.due_at!), title: deadlineOf(b.target)!.title })"
          @click="peek(b.target, $event)"
          @dragstart="taskOf(b.target) && dragStart($event, taskOf(b.target)!)"
          @dragend="dragEnd"
        >
          <template v-if="sessionOf(b.target)">
            <span
              class="truncate text-[12.5px] leading-tight font-semibold"
              :class="sessionOf(b.target)!.cancelled && 'line-through'"
            >{{ sessionOf(b.target)!.title }}</span>
            <span class="truncate text-[11.5px] leading-tight text-text-muted tabular-nums">
              {{ clock(sessionOf(b.target)!.starts_at) }}–{{ clock(sessionOf(b.target)!.ends_at) }}<template v-if="sessionOf(b.target)!.location"> · {{ sessionOf(b.target)!.location }}</template>
            </span>
            <span
              v-if="b.end - b.start >= 75"
              class="truncate text-[11.5px] leading-tight text-text-muted"
            >{{ c.subjectOf(sessionOf(b.target)!)?.title }}</span>
          </template>
          <template v-else-if="taskOf(b.target)">
            <span
              class="truncate text-[12.5px] leading-tight font-semibold"
              :class="taskOf(b.target)!.done_at && 'line-through'"
            >{{ taskOf(b.target)!.title }}</span>
            <span
              v-if="b.end - b.start >= 40"
              class="truncate text-[11.5px] leading-tight text-text-muted tabular-nums"
            >{{ taskOf(b.target)!.starts_at }} · {{ tr('calendar.grid.min', { n: taskOf(b.target)!.minutes }) }}</span>
          </template>
          <span
            v-else
            class="flex min-w-0 items-center gap-1 text-[11.5px] leading-tight font-semibold"
          >
            <CompanionIcon
              name="flag"
              :size="11"
              :stroke="2.2"
              class="shrink-0"
            />
            <span class="tabular-nums">{{ clock(deadlineOf(b.target)!.due_at!) }}</span>
            <span class="truncate">{{ deadlineOf(b.target)!.title }}</span>
          </span>
        </button>

        <div
          v-if="ghost && ghost.day === d.day"
          class="pointer-events-none absolute inset-x-0.5 rounded-[7px] bg-surface px-1.5 py-1 text-[11.5px] font-semibold text-text-muted shadow-[inset_0_0_0_1.5px_var(--border-strong)]"
          :style="{ top: `${px(ghost.minute)}px`, height: `${px(30) - 2}px` }"
        >
          {{ tr('calendar.peek.newTask') }}
        </div>

        <div
          v-if="dragged && dropAt && dropAt.day === d.day && dropAt.minute !== null"
          class="pointer-events-none absolute inset-x-0.5 z-10 rounded-[7px] bg-sky-soft px-1.5 py-1 text-[11.5px] font-semibold text-text tabular-nums shadow-[inset_0_0_0_1.5px_var(--sky)]"
          :style="{ top: `${px(dropAt.minute)}px`, height: `${px(Math.max(dragged.minutes, 25)) - 2}px` }"
        >
          {{ clockOfMinute(dropAt.minute) }}
        </div>

        <div
          v-if="d.day === today"
          class="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-rose"
          :style="{ top: `${nowTop}px` }"
          aria-hidden="true"
        >
          <span class="absolute -top-[4px] -left-[5px] size-2.5 rounded-full bg-rose" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* An hour line every hour, a fainter one at the half: drawn by the column's own background. */
.cal-hours {
  background-image:
    linear-gradient(to bottom, var(--border-rule) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in oklab, var(--border-rule) 45%, transparent) 1px, transparent 1px);
  background-size: 100% var(--hour), 100% var(--hour);
  background-position: 0 0, 0 calc(var(--hour) / 2);
}
</style>
