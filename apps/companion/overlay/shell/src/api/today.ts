// `GET /today`, and the pace of a self-study goal: "B1 by 1 June needs 4 sessions a week; you're doing 3". A session is
// a day worked on the goal: a done plan task for one of its courses, or a class with a tutor that took place. Whole
// weeks, so a Monday morning does not read as behind.
import { computeReadiness } from '../../../app/companion/readiness.ts'
import { dayKey, mondayOf, shiftDay } from '../../../app/companion/time.ts'
import { ensure } from './planner.ts'
import { wire, worldOf } from './rows.ts'
import type { Row, Store } from './store.ts'
import { dayEnd, dayStart, validZone } from './zone.ts'

const DAY = 86_400_000
const WEEK = 7 * DAY
const DUE_SOON_DAYS = 7
const DUE_SOON_LIMIT = 5
const NEXT_SESSION_DAYS = 7
const LOOKBACK_WEEKS = 3

const at = (iso: string) => Date.parse(iso)

export function paceFor(store: Store, goal: Row, now: number) {
  const perWeek = goal.sessions_per_week ?? 0
  if (goal.kind !== 'self' || goal.status !== 'active' || perWeek <= 0 || !goal.starts_on || !goal.ends_on) return null

  const zone = validZone(goal.timezone) ? goal.timezone : 'UTC'
  const today = dayKey(now)
  const startsOn = dayStart(goal.starts_on, zone)
  const endsOn = dayEnd(goal.ends_on, zone)
  const thisMonday = mondayOf(today)
  const mondayAt = dayStart(thisMonday, zone)

  const subjects = store.live('subjects').filter((s) => s.goal_id === goal.id).map((s) => s.id)
  const days = new Set<string>()
  for (const t of store.live('plan-tasks')) {
    if (subjects.includes(t.subject_id) && t.done_at && t.date >= goal.starts_on && t.date <= today) days.add(t.date)
  }
  const study = new Set(store.live('slots').filter((s) => s.kind === 'study').map((s) => s.id))
  const slots = new Set(store.live('slots').map((s) => s.id))
  for (const s of store.live('sessions')) {
    const tutored = s.slot_id === null || (slots.has(s.slot_id) && !study.has(s.slot_id))
    if (subjects.includes(s.subject_id) && !s.cancelled && at(s.starts_at) >= startsOn && at(s.ends_at) <= now && tutored) days.add(dayKey(s.starts_at))
  }

  const done = days.size
  const planned = perWeek * Math.max(1 / 7, (endsOn - startsOn) / WEEK)
  const elapsedWeeks = mondayAt > startsOn ? Math.floor(Math.round((mondayAt - startsOn) / DAY) / 7) : 0
  const expected = perWeek * elapsedWeeks
  const weeksLeft = Math.max(1 / 7, (endsOn - now) / WEEK)
  const needed = Math.round(Math.max(0, planned - done) / weeksLeft)

  const lookback = Math.min(LOOKBACK_WEEKS, elapsedWeeks)
  let actual = perWeek
  if (lookback > 0) {
    const from = shiftDay(thisMonday, -7 * lookback)
    actual = Math.round([...days].filter((d) => d >= from && d < thisMonday).length / lookback)
  }

  const deficit = expected - done
  const weeksBehind = deficit > 0 ? Math.floor(deficit / perWeek) : 0
  return {
    goal_id: goal.id,
    status: weeksBehind >= 1 ? 'behind' : -deficit >= perWeek ? 'ahead' : 'on',
    weeks_behind: weeksBehind,
    sessions_per_week_needed: needed,
    sessions_per_week_actual: actual,
  }
}

export function todayView(store: Store, date: string, zone: string, now = Date.now()) {
  const from = Math.max(now, dayStart(date, zone))
  const classes = store.live('sessions').filter((s) => !s.cancelled).sort((a, b) => at(a.starts_at) - at(b.starts_at))

  const nowSession = date !== dayKey(now) ? undefined : classes.find((s) => at(s.starts_at) <= now && at(s.ends_at) > now)
  const nextSession = classes.find((s) => at(s.starts_at) > from && at(s.starts_at) <= from + NEXT_SESSION_DAYS * DAY)

  const world = worldOf(store)
  const dueSoon = store.live('deadlines')
    .filter((d) => d.status === 'upcoming' && d.due_at && at(d.due_at) > from && at(d.due_at) <= from + DUE_SOON_DAYS * DAY)
    .sort((a, b) => at(a.due_at) - at(b.due_at))
    .slice(0, DUE_SOON_LIMIT)
    .map((deadline) => ({ deadline, readiness: computeReadiness(deadline as never, world as never, now).percent }))

  const tasks = ensure(store, date, now)

  // A course of one's own that was archived stops being paced, as it stops being planned.
  const subjects = store.live('subjects')
  const pace = store.live('goals')
    .filter((g) => g.kind === 'self' && g.status === 'active' && !subjects.some((s) => s.goal_id === g.id && s.archived_at))
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .map((g) => paceFor(store, g, now))
    .filter(Boolean)

  const until = dayEnd(date, zone)
  return {
    date,
    now_session: nowSession ? wire('sessions', nowSession) : null,
    next_session: nextSession ? wire('sessions', nextSession) : null,
    due_soon: dueSoon,
    plan: { minutes: tasks.reduce((sum, t) => sum + t.minutes, 0), tasks },
    reviews_due: store.live('cards').filter((c) => !c.suspended && c.kind !== 'question' && at(c.due_at) <= until).length,
    inbox_count: store.live('signals').filter((s) => s.status === 'pending').length,
    pace,
  }
}
