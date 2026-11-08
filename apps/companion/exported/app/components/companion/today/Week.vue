<script setup lang="ts">
/**
 * The week on Today (Daylight 2's week plan, sections/07-today.html): seven
 * days from yesterday, each a column of what it holds. A class is a quiet
 * grey block with its time, a deadline a rose one, and a study block of the
 * plan's a block in its course's colour with its minutes, which opens what it
 * is for and, on a desk, drags to another day still to come. The server pins
 * a block moved by hand (`moveTask`, `moved_from`), so the planner leaves it
 * where it was put. The Calendar's week is the same data at full size; this
 * one is the glance.
 *
 * Under it, the one nudge: a study block from an earlier day that wasn't
 * done, said once with one fix ("Move it to tonight") and one way to leave it
 * ("Keep my plan", which quiets it until tomorrow). Several are one count,
 * never a list of debts. A missed block shows struck through on its day.
 *
 * Each block says what it is before its title: a study block an empty ring
 * while it is still to do and a tick once done, a deadline a flag, a class
 * nothing. A one-line key under the grid names the three, because the
 * colours alone didn't tell a learner which blocks were theirs to do.
 */
import { NuxtLink } from '#components'
import type { Deadline, PlanTask, Session } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { courseColor } from '~/companion/colors'
import { moveTask } from '~/companion/week-plan'
import { keepPlan, missedNudge, moveToTonight } from '~/companion/today-pick'
import { clock, dayKey, dayMonthLong, daysBetween, relativeDay, shiftDay, shortDate, weekdayShort } from '~/companion/time'
import { taskHref, useNow } from '~/companion/today-layout'

const { t: tr } = useI18n()
const c = useCompanion()
const toast = useToast()
const now = useNow()

const today = computed(() => dayKey(now.value))
const days = computed(() => Array.from({ length: 7 }, (_, i) => shiftDay(today.value, i - 1)))

/** "6–12 November", or "30 Oct – 5 Nov" across a month. */
const range = computed(() => {
  const [a, b] = [days.value[0]!, days.value[6]!]
  return a.slice(0, 7) === b.slice(0, 7) ? `${+a.slice(8, 10)}–${dayMonthLong(b)}` : `${shortDate(a)} – ${shortDate(b)}`
})

const isPast = (day: string) => daysBetween(today.value, day) < 0

function sessionsOn(day: string): Session[] {
  return c.sessions.value
    .filter((s) => !s.cancelled && dayKey(s.starts_at) === day)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
}
function dueOn(day: string): Deadline[] {
  return c.deadlines.value.filter(
    (d) => d.due_at && d.status !== 'cancelled' && !d.deleted_at && dayKey(d.due_at) === day,
  )
}
function tasksOn(day: string): PlanTask[] {
  return c.planTasks.value.filter((t) => t.date === day).sort((a, b) => a.position - b.position)
}

/** A day's blocks, in the order a day is read: classes by time, then what's due, then study. */
type Block =
  | { kind: 'class'; id: string; title: string; meta: string; to: string }
  | { kind: 'due'; id: string; title: string; meta: string; to: string }
  | { kind: 'study'; id: string; title: string; meta: string; to: string | null; task: PlanTask; missed: boolean }

const MAX = 5

const week = computed(() =>
  days.value.map((day) => {
    const blocks: Block[] = [
      ...sessionsOn(day).map((s) => ({
        kind: 'class' as const,
        id: s.id,
        title: s.title,
        meta: clock(s.starts_at),
        to: `/app/courses/${s.subject_id}?open=${encodeURIComponent(`class:${s.id}`)}`,
      })),
      ...dueOn(day).map((d) => ({
        kind: 'due' as const,
        id: d.id,
        title: d.title,
        meta: d.all_day ? tr('today.week.due') : clock(d.due_at!),
        to: `/app/d/${d.id}`,
      })),
      ...tasksOn(day).map((t) => {
        const missed = isPast(day) && !t.done_at
        return {
          kind: 'study' as const,
          id: t.id,
          title: labelOf(t),
          // A task given an hour on the Calendar says it, as a class does.
          meta: [t.starts_at, minutesLabel(t.minutes), missed && tr('today.week.missed')].filter(Boolean).join(' · '),
          to: taskHref(t, c),
          task: t,
          missed,
        }
      }),
    ]
    return {
      day,
      label: day === today.value ? tr('common.today') : weekdayShort(day),
      date: +day.slice(8, 10),
      past: isPast(day),
      today: day === today.value,
      blocks: blocks.slice(0, MAX),
      more: Math.max(0, blocks.length - MAX),
    }
  }),
)

/*
 * A study block says what kind of work it is in a word or two, on one line
 * ("Check", "Cards"), as the landing's week does; the full title is
 * its tooltip and the pick's. Work toward a deadline is named by the
 * deadline, and a line the learner typed by its own words.
 */
// "Review cards" doesn't fit a seventh of the card: the cards are the review.
const label = (kind: PlanTask['kind']): string => tr(`today.week.kind.${kind}`)
function labelOf(t: PlanTask): string {
  if (t.kind === 'own') return t.title
  if (t.kind === 'work' || t.kind === 'prepare') return c.get('deadlines', t.deadline_id)?.title ?? label(t.kind)
  return label(t.kind)
}

/** The deadline this week is planned around: the next one in it. */
const around = computed(() => {
  const ahead = days.value.filter((d) => !isPast(d)).flatMap(dueOn)
  return ahead.sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!))[0] ?? null
})

function tone(t: PlanTask): Record<string, string> {
  const col = courseColor(c.subjectOf(t)?.color)
  return {
    background: `color-mix(in oklab, ${col} 16%, var(--surface))`,
    color: `color-mix(in oklab, ${col} 55%, var(--text))`,
    boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${col} 42%, transparent)`,
  }
}

/* -- Moving a block ------------------------------------------------------- */

async function move(t: PlanTask, day: string, quiet = false): Promise<void> {
  const from = t.date
  try {
    await moveTask(c, t, day)
  } catch {
    return // the store has said it couldn't be saved, and put the block back
  }
  if (quiet) return
  const word = day === today.value ? tr('today.week.tonight') : relativeDay(day, today.value)
  toast.success({
    title: tr('today.week.movedTo', { when: word }),
    body: t.kind === 'own' ? undefined : tr('today.week.stays'),
    duration: 5000,
    action: from
      ? {
          label: tr('today.plan.undo'),
          handler: () => {
            const back = c.get('plan_tasks', t.id)
            if (back) void moveTask(c, back, from)
          },
        }
      : undefined,
  })
}

const dragged = ref<PlanTask | null>(null)
const dropDay = ref<string | null>(null)

function dragStart(event: DragEvent, t: PlanTask): void {
  if (t.done_at || !event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', t.id)
  dragged.value = t
}
function dragOver(event: DragEvent, day: string): void {
  if (!dragged.value || isPast(day) || day === dragged.value.date) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dropDay.value = day
}
function dropOn(day: string): void {
  const t = dragged.value
  dragEnd()
  if (t && !isPast(day) && day !== t.date) void move(t, day)
}
function dragEnd(): void {
  dragged.value = null
  dropDay.value = null
}

/* -- The nudge ------------------------------------------------------------ */

/*
 * The one nudge is `missedNudge` (companion/today-pick.ts): the study block of
 * the last two days that wasn't done and isn't already on today's plan, the
 * one whose deadline is soonest, said in the landing's words. Older misses
 * (more than two days back) are still offered as one count with one fix, the
 * old Today's "Move to today", so nothing is left behind silently.
 */
const one = computed(() => missedNudge(c, now.value))

// The count's own "Keep my plan": quiet until tomorrow. Not `bm:nudge-kept`,
// which today-pick.ts keeps as a list of task ids.
const KEPT_DAY = 'bm:nudge-kept-day'
const keptDay = ref<string | null>(null)
onMounted(() => {
  try {
    keptDay.value = localStorage.getItem(KEPT_DAY)
  } catch {
    // Private mode: the count shows; Keep my plan still hides it for the visit.
  }
})
const keptOne = ref<string | null>(null)

const behind = computed(() =>
  c.planTasks.value
    .filter((t) => t.date && t.date < today.value && !t.done_at && !t.deleted_at)
    .sort((a, b) => (a.date! < b.date! ? 1 : -1)),
)

const nudge = computed(() => {
  const n = one.value
  if (n && keptOne.value !== n.task.id) {
    return { text: n.text, move: tr('today.week.moveOne'), task: n.task }
  }
  if (!behind.value.length || keptDay.value === today.value) return null
  return {
    text: tr('today.week.behind', behind.value.length),
    move: tr(behind.value.length === 1 ? 'today.week.moveOne' : 'today.week.moveMany'),
    task: null,
  }
})

const moving = ref(false)
async function moveBehind(): Promise<void> {
  const n = nudge.value
  if (moving.value || !n) return
  moving.value = true
  try {
    if (n.task) {
      await moveToTonight(c, n.task)
      toast.success({ title: tr('today.week.movedTonight'), body: tr('today.week.stays') })
    } else {
      const list = [...behind.value]
      for (const t of list) await move(t, today.value, true)
      toast.success({
        title: tr('today.week.blocksMoved', list.length),
        body: tr('today.week.doWhatYouCan'),
      })
    }
  } catch {
    // The store has said it couldn't be saved, and put the blocks back.
  } finally {
    moving.value = false
  }
}

function keep(): void {
  const n = nudge.value
  if (n?.task) {
    keepPlan(n.task)
    keptOne.value = n.task.id
    return
  }
  keptDay.value = today.value
  try {
    localStorage.setItem(KEPT_DAY, today.value)
  } catch {
    // Quiet for this visit only.
  }
}
</script>

<template>
  <!-- A week with nothing in it at all isn't drawn: no empty panels. -->
  <div v-if="week.some((d) => d.blocks.length) || nudge">
    <section
      aria-labelledby="today-week"
      class="overflow-hidden rounded-[18px] bg-surface shadow-[0_0_0_1px_var(--border),var(--shadow-raised)]"
    >
      <!-- The app window's 46px header (`.ui-h`): where you are, and the week. -->
      <header class="flex h-[46px] items-center gap-2 border-b border-border px-3.5 text-[13px] whitespace-nowrap">
        <span class="grid size-[22px] shrink-0 place-items-center rounded-[6px] bg-[rgb(var(--wash-rgb)/0.065)] text-text-soft">
          <UiIcon
            name="calendar"
            :size="13"
          />
        </span>
        <NuxtLink
          to="/app/calendar"
          class="text-text-faint transition-colors hover:text-text"
        >
          {{ tr('today.week.plan') }}
        </NuxtLink>
        <UiIcon
          name="chevron-right"
          :size="13"
          class="shrink-0 text-text-ghost"
        />
        <h2
          id="today-week"
          class="truncate font-bold tracking-[-0.01em]"
        >
          {{ range }}
        </h2>
        <span class="flex-1" />
        <NuxtLink
          v-if="around"
          :to="`/app/d/${around.id}`"
          class="inline-flex min-w-0 items-center gap-1.5 truncate rounded-full px-1 text-[12.5px] font-semibold text-rose-ink hover:underline max-sm:hidden"
        >
          <CompanionIcon
            name="flag"
            :size="13"
            class="shrink-0"
          />
          <span class="truncate">{{ tr('today.week.plannedAround', { title: around.title }) }}</span>
        </NuxtLink>
      </header>

      <!-- Seven columns with hairlines between them; on a phone they scroll. -->
      <div class="om-scroll overflow-x-auto [scrollbar-width:none]">
        <ol class="grid min-w-[560px] grid-cols-7 gap-px bg-border">
          <li
            v-for="d in week"
            :key="d.day"
            :class="[
              'flex min-h-[208px] flex-col gap-1.5 px-1.5 pt-2.5 pb-2 transition-colors duration-200',
              dropDay === d.day
                ? 'bg-sky-soft'
                : d.today
                  ? 'bg-[color-mix(in_oklab,var(--accent-soft)_55%,var(--surface))]'
                  : d.past
                    ? 'bg-surface-mute'
                    : 'bg-surface',
            ]"
            @dragover="dragOver($event, d.day)"
            @dragleave="dropDay === d.day && (dropDay = null)"
            @drop.prevent="dropOn(d.day)"
          >
            <p
              :class="[
                'flex items-baseline gap-1 px-1 pb-1 text-[11.5px] font-bold',
                d.today ? 'text-accent-strong' : 'text-text-faint',
              ]"
            >
              {{ d.label }}
              <span :class="['font-display text-[17px] font-semibold tracking-[-0.02em]', d.past ? 'text-text-faint' : 'text-text']">{{ d.date }}</span>
            </p>

            <template
              v-for="b in d.blocks"
              :key="b.id"
            >
              <NuxtLink
                v-if="b.kind === 'class'"
                :to="b.to"
                class="grid gap-px rounded-[8px] bg-[rgb(var(--wash-rgb)/0.065)] px-[7px] py-1.5 text-[11px] leading-[1.25] text-text-soft transition-colors hover:bg-[rgb(var(--wash-rgb)/0.1)] hover:text-text"
              >
                <b class="line-clamp-3 font-bold [overflow-wrap:anywhere]">{{ b.title }}</b>
                <em class="text-[10px] font-medium not-italic opacity-75">{{ b.meta }}</em>
              </NuxtLink>
              <NuxtLink
                v-else-if="b.kind === 'due'"
                :to="b.to"
                class="grid gap-px rounded-[8px] bg-rose-soft px-[7px] py-1.5 text-[11px] leading-[1.25] text-rose-ink shadow-[inset_0_0_0_1.5px_var(--rose)] transition-shadow hover:shadow-[inset_0_0_0_1.5px_var(--rose),var(--shadow-card)]"
              >
                <b class="line-clamp-3 font-bold [overflow-wrap:anywhere]"><CompanionIcon
                  name="flag"
                  :size="10"
                  :stroke="2.4"
                  class="mr-0.5 inline-block align-[-1px]"
                />{{ b.title }}</b>
                <em class="text-[10px] font-medium not-italic opacity-75">{{ b.meta }}</em>
              </NuxtLink>
              <component
                :is="b.to ? NuxtLink : 'span'"
                v-else
                :to="b.to ?? undefined"
                :draggable="!b.task.done_at && !d.past"
                :title="d.past ? b.task.title : tr('today.week.dragTitle', { title: b.task.title })"
                :class="[
                  'grid grid-cols-[minmax(0,1fr)] gap-px rounded-[8px] px-[7px] py-1.5 text-[11px] leading-[1.25] transition-[box-shadow,opacity] duration-200 select-none',
                  b.missed
                    ? 'text-text-faint shadow-[inset_0_0_0_1.5px_var(--border-strong)]'
                    : !d.past && !b.task.done_at && 'cursor-grab hover:shadow-[inset_0_0_0_1.5px_currentColor,var(--shadow-card)] active:cursor-grabbing',
                  b.task.done_at && 'opacity-60',
                  dragged?.id === b.id && 'opacity-40',
                ]"
                :style="b.missed ? undefined : tone(b.task)"
                @dragstart="dragStart($event, b.task)"
                @dragend="dragEnd"
              >
                <span class="flex min-w-0 items-center gap-1">
                  <!-- To do: an empty ring; done: a tick. -->
                  <UiIcon
                    v-if="b.task.done_at"
                    name="check"
                    :size="10"
                    :stroke="3"
                    class="shrink-0"
                    :aria-label="tr('today.week.done')"
                  />
                  <span
                    v-else
                    class="size-[9px] shrink-0 rounded-full border-[1.5px] border-current opacity-70"
                    aria-hidden="true"
                  />
                  <b :class="['truncate font-bold', (b.missed || b.task.done_at) && 'line-through decoration-current/40']">{{ b.title }}</b>
                </span>
                <em class="text-[10px] font-medium not-italic opacity-75">{{ b.task.done_at ? tr('today.week.done') : b.meta }}</em>
              </component>
            </template>

            <NuxtLink
              v-if="d.more"
              :to="`/app/calendar?date=${d.day}`"
              class="px-1 text-[11px] font-semibold text-text-faint hover:text-text"
            >
              {{ tr('today.week.more', { n: d.more }) }}
            </NuxtLink>
          </li>
        </ol>
      </div>

      <!-- The key: what each kind of block is. -->
      <p class="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-3.5 py-2 text-[11.5px] font-medium text-text-muted">
        <span class="inline-flex items-center gap-1.5">
          <span class="size-2.5 rounded-[3px] bg-[rgb(var(--wash-rgb)/0.12)]" />
          {{ tr('today.week.keyClass') }}
        </span>
        <span class="inline-flex items-center gap-1.5 text-rose-ink">
          <CompanionIcon
            name="flag"
            :size="11"
            :stroke="2.2"
          />
          {{ tr('today.week.keyDue') }}
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span class="size-[9px] rounded-full border-[1.5px] border-current" />
          {{ tr('today.week.keyTodo') }}
        </span>
        <span class="inline-flex items-center gap-1.5">
          <UiIcon
            name="check"
            :size="11"
            :stroke="3"
          />
          {{ tr('today.week.keyDone') }}
        </span>
      </p>

      <!-- The one nudge. -->
      <Transition
        enter-active-class="duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        enter-from-class="opacity-0"
        leave-active-class="duration-200 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-if="nudge"
          class="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-t border-border bg-surface-mute px-3.5 py-3"
        >
          <span class="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-butter-soft text-butter-ink">
            <UiIcon
              name="clock"
              :size="15"
              :stroke="2.1"
            />
          </span>
          <p class="min-w-[220px] flex-1 text-[13px] leading-[1.45] text-text-soft">
            <!-- The landing's nudge: its first sentence in ink, the rest quieter. -->
            <b class="font-semibold text-text">{{ nudge.text.split(/(?<=\.) /)[0] }}</b>
            {{ nudge.text.split(/(?<=\.) /).slice(1).join(' ') }}
          </p>
          <div class="flex items-center gap-1.5">
            <UiBtn
              variant="primary"
              size="sm"
              :loading="moving"
              @click="moveBehind"
            >
              {{ nudge.move }}
            </UiBtn>
            <UiBtn
              variant="ghost"
              size="sm"
              @click="keep"
            >
              {{ tr('today.week.keep') }}
            </UiBtn>
          </div>
        </div>
      </Transition>
    </section>
    <p class="mt-2 hidden items-center justify-center gap-1.5 text-[12px] font-semibold text-text-faint [@media(hover:hover)]:flex">
      {{ tr('today.week.dragHint') }}
    </p>
  </div>
</template>
