/**
 * Today's two small promises from the landing (07 Today):
 *
 *  - "How long do you have? 10 min / 20 min / 1 hour": the ONE thing worth
 *    doing next, sized to the time there is (`pickFor`).
 *  - The one nudge after a missed day: "You missed yesterday's reading. Quiz 2
 *    is in three days. Do it tonight and you're still on track." with "Move it
 *    to tonight" and "Keep my plan" (`missedNudge`, `moveToTonight`,
 *    `keepPlan`).
 *
 * Both read the day's plan the server's Planner already ranked (the check
 * first, then reviews for what's close, a miss's reading, lessons, deadline
 * work, other reviews), so neither invents a priority of its own: the pick is
 * the first task in that order that fits the time, and the nudge only speaks
 * when yesterday's work isn't already on today's plan (the planner carries most
 * of it over by itself, "without turning anything red").
 */
import type { Deadline, PlanTask } from './types'
import type { CompanionStore } from './store'
import { moveTask } from './week-plan'
import { dayKey, daysBetween, shiftDay, weekdayLong, weekdayOf } from './time'
import { translate } from '~/utils/i18n'

/** The three answers to "How long do you have?". */
export const TIME_CHOICES = [10, 20, 60] as const
export type TimeChoice = (typeof TIME_CHOICES)[number]

/**
 * What a task may be cut down to and still be worth starting: work and a
 * deadline's preparation need a quarter of an hour, a pile of cards five
 * minutes (Planner's floors). A lesson, a check and a miss's reading are
 * sittings and are taken whole or not at all.
 */
const FLOOR: Partial<Record<PlanTask['kind'], number>> = { work: 15, prepare: 15, review: 5, practice: 5 }

export interface Pick {
  task: PlanTask
  /** What it takes in the time given: the task's own minutes, or less when it was cut down. */
  minutes: number
  /** Cut down to fit ("10 of its 25 minutes"). */
  trimmed: boolean
}

function open(t: PlanTask): boolean {
  return !t.done_at && !t.deleted_at && t.kind !== 'own'
}

/** Same work as the server's PlanTask::planKey(). */
function keyOf(t: PlanTask): string {
  return [t.kind, t.deadline_id ?? '', t.topic_id ?? '', t.subject_id ?? ''].join('|')
}

/**
 * The one thing for `minutes`: the first undone task of `tasks` (a day's
 * plan, in the planner's order) that fits whole; failing that, the first that
 * can be cut down to the time. Null when nothing fits, and the screen falls
 * back to what it showed without a time.
 */
export function pickFor(tasks: PlanTask[], minutes: number): Pick | null {
  const left = [...tasks].filter(open).sort((a, b) => a.position - b.position)
  const whole = left.find((t) => t.minutes <= minutes)
  if (whole) return { task: whole, minutes: whole.minutes, trimmed: false }
  const cut = left.find((t) => (FLOOR[t.kind] ?? Infinity) <= minutes)
  return cut ? { task: cut, minutes, trimmed: true } : null
}

/** "Quiz 2 is on Thursday", "Essay 1 is due tomorrow": a deadline said from a day. */
export function dueWords(d: Deadline, today = dayKey()): string | null {
  if (!d.due_at) return null
  const key = dayKey(d.due_at)
  const days = daysBetween(today, key)
  if (days < 0) return null
  const verb = ['assignment', 'lab', 'project', 'presentation'].includes(d.kind) ? 'due' : 'is'
  const at = `today.dw.${verb}`
  const title = d.title
  if (days === 0) return translate(`${at}.today`, { title })
  if (days === 1) return translate(`${at}.tomorrow`, { title })
  if (days < 7) return translate(`${at}.weekday`, { title, day: weekdayLong(weekdayOf(key)) })
  return translate(`${at}.days`, { title, n: days }, days)
}

/* -- The one nudge ----------------------------------------------------------- */

/** How far back a missed task still gets a nudge: yesterday and the day before. */
const LOOK_BACK_DAYS = 2

const KEPT_KEY = 'bm:nudge-kept'


export interface Nudge {
  task: PlanTask
  deadline: Deadline | null
  /** "You missed yesterday's reading. Quiz 2 is in three days. Do it tonight and you're still on track." */
  text: string
}

/*
 * shortcut: "Keep my plan" is remembered on this device only (localStorage),
 * so another device may ask once more; move it to a plan_tasks column if
 * anyone notices.
 */
function kept(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEPT_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

/**
 * The nudge, or null. At most one, ever on screen: the missed task (planned
 * for one of the last two days, never started) whose deadline is soonest,
 * then the latest. Skipped when today's plan already holds the same work, or
 * the learner said "Keep my plan" to it.
 */
export function missedNudge(store: CompanionStore, now = Date.now()): Nudge | null {
  const today = dayKey(now)
  const from = shiftDay(today, -LOOK_BACK_DAYS)
  const tasks = store.planTasks.value
  const planned = new Set(tasks.filter((t) => t.date === today && !t.deleted_at).map(keyOf))
  const skip = new Set(kept())
  const due = (t: PlanTask): number => {
    const d = store.get('deadlines', t.deadline_id)
    return d?.due_at && d.status === 'upcoming' ? Date.parse(d.due_at) : Infinity
  }
  const missed = tasks
    .filter((t) => open(t) && t.date && t.date >= from && t.date < today && !skip.has(t.id) && !planned.has(keyOf(t)))
    .sort((a, b) => due(a) - due(b) || (b.date ?? '').localeCompare(a.date ?? ''))
  const task = missed[0]
  if (!task) return null

  const gap = daysBetween(task.date!, today)
  const deadline = store.get('deadlines', task.deadline_id) ?? null
  const live = deadline?.due_at && deadline.status === 'upcoming' ? deadline : null
  const days = live ? daysBetween(today, dayKey(live.due_at!)) : null
  // One sentence per kind of task, because the noun's gender decides the rest of it in some languages.
  const parts = [
    gap === 1
      ? translate(`today.nudge.yesterday.${task.kind}`)
      : translate(`today.nudge.day.${task.kind}`, { day: weekdayLong(weekdayOf(task.date!)) }),
  ]
  if (live && days != null && days >= 1) {
    parts.push(translate('today.nudge.inDays', { title: live.title, n: days }, days))
    parts.push(translate('today.nudge.onTrack'))
  } else if (live && days === 0) {
    parts.push(translate('today.nudge.today', { title: live.title }), translate('today.nudge.doNow'))
  } else {
    parts.push(translate('today.nudge.noDeadline'))
  }
  return { task, deadline: live, text: parts.join(' ') }
}

/** "Move it to tonight": onto today's plan, pinned there by the server (CollectionWriter). */
export async function moveToTonight(store: CompanionStore, task: PlanTask): Promise<void> {
  await moveTask(store, task, dayKey())
}

/** "Keep my plan": the nudge goes and doesn't come back for this task. */
export function keepPlan(task: PlanTask): void {
  try {
    const ids = [task.id, ...kept()].slice(0, 50)
    localStorage.setItem(KEPT_KEY, JSON.stringify(ids))
  } catch {
    // Storage refused (private window): the nudge simply stays until the task ages out.
  }
}
