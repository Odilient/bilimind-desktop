// One day's plan tasks, working backwards from what is coming. In order of priority:
//
//   1. REVIEWS FOR WHAT IS CLOSE. Flashcards due by the end of the day whose topic is in the named scope of a quiz or
//      exam within 7 days, one task per deadline; a card in two scopes goes to the sooner one.
//   2. SELF-STUDY PACE. One lesson per self-study goal on its study days (its slots, or a fixed spread of weekdays).
//   3. DEADLINE WORK. Every upcoming deadline in 21 days, by weight x need / days left. For a quiz or exam, need is
//      1 - readiness; for a lab or essay it is 1, because readiness says nothing about a report not yet written.
//   4. OTHER REVIEWS. Due flashcards in no close scope, last.
//
// An archived course is planned for in none of them. The day is capped at preferences.daily_minutes (60), minus what
// is done and what the learner wrote themselves. Work, preparation and reviews shrink to what is left, down to a floor;
// a lesson is a fixed sitting and is skipped rather than cut.
//
// Stable on re-run: a task's identity is what it is for. Done tasks are never touched and satisfy their key for the
// day, a pending task the plan still wants keeps its row and is only written if it changed, and the rest are tombstoned.
//
// Before all of them, today's check when one is due; after the close reviews, going back over what a check found missing.
import { computeReadiness, scopeOf, SITTING_TOPICS, sittingSize, topicCheck } from '../../../app/companion/readiness.ts'
import { clock, currentZone, dayKey, dayLabel, daysBetween, shiftDay, weekdayOf, weekdayShort } from '../../../app/companion/time.ts'
import { dueTopics, leavesOf, standingOf, type Standing } from './proof/checks.ts'
import { worldOf } from './rows.ts'
import { wireTime, type Row, type Store } from './store.ts'
import { dayEnd, dayStart } from './zone.ts'

const DAY = 86_400_000
const DEFAULT_DAILY_MINUTES = 60
const HORIZON_DAYS = 21
const SECONDS_PER_REVIEW = 40
const MAX_REVIEW_MINUTES = 30
const WORK_MINUTES = 25
const MIN_WORK_MINUTES = 15
const MIN_REVIEW_MINUTES = 5
const REVIEW_FOCUS_DAYS = 7
const DEFAULT_WEIGHT_PCT = 10
const RECALL = ['quiz', 'midterm', 'final', 'exam']
const MISS_MINUTES = 15
const MAX_MISSES = 2
/** Study weekdays for a goal with no slots, by sessions per week: no two back to back when they need not be. */
const DEFAULT_STUDY_DAYS: Record<number, number[]> = {
  1: [3], 2: [2, 5], 3: [1, 3, 5], 4: [1, 2, 4, 6], 5: [1, 2, 3, 4, 6], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 7],
}

interface Candidate {
  kind: string
  title: string
  detail: string | null
  minutes: number
  floor: number
  subject_id: string | null
  deadline_id: string | null
  topic_id: string | null
  item_id?: string | null
}

const at = (iso: string) => Date.parse(iso)
const needsRecall = (d: Row) => RECALL.includes(d.kind)
const reviewMinutes = (cards: number) => Math.min(MAX_REVIEW_MINUTES, Math.max(1, Math.ceil((cards * SECONDS_PER_REVIEW) / 60)))
const flashcards = (n: number) => (n === 1 ? 'flashcard' : 'flashcards')
const planKey = (t: Row | Candidate) =>
  [t.kind, t.deadline_id ?? '', t.topic_id ?? '', t.subject_id ?? ''].join('|')
const inOrder = (a: Row, b: Row) =>
  (a.position ?? 0) - (b.position ?? 0) || String(a.created_at).localeCompare(String(b.created_at)) || a.id.localeCompare(b.id)

function detail(parts: (string | null | undefined)[]): string | null {
  return parts.filter(Boolean).join(' · ') || null
}

/** "today 23:59", "tomorrow 09:00", "Thu 09:00" within the week, "Wed 4 Nov 14:00" beyond it. */
function when(d: Row, day: string): string {
  const due = dayKey(d.due_at)
  const days = daysBetween(day, due)
  const word = days === 0 ? 'today' : days === 1 ? 'tomorrow' : days > 1 && days < 7 ? weekdayShort(due) : dayLabel(due)
  return d.all_day ? word : `${word} ${clock(d.due_at)}`
}

/** "quiz Thu 09:00", "final exam Mon 14:00", "due Fri 23:59". */
function dueWords(d: Row, day: string): string {
  const time = when(d, day)
  if (d.kind === 'final') return `final exam ${time}`
  return ['quiz', 'midterm', 'exam'].includes(d.kind) ? `${d.kind} ${time}` : `due ${time}`
}

function reviews(store: Store, shelf: Set<string>, subjects: Row[], until: number, focus: Row[], scopes: Map<string, string[]>, day: string): [Candidate[], Candidate[]] {
  const due = store.live('cards')
    .filter((c) => (c.subject_id === null || shelf.has(c.subject_id)) && !c.suspended && c.kind !== 'question' && at(c.due_at) <= until)
    .sort((a, b) => at(a.due_at) - at(b.due_at) || a.id.localeCompare(b.id))

  const perDeadline = new Map<string, number>()
  const rest: Row[] = []
  for (const card of due) {
    const owner = card.topic_id ? focus.find((d) => scopes.get(d.id)!.includes(card.topic_id)) : undefined
    if (owner) perDeadline.set(owner.id, (perDeadline.get(owner.id) ?? 0) + 1)
    else rest.push(card)
  }

  const scoped = focus.filter((d) => perDeadline.has(d.id)).map((d): Candidate => {
    const count = perDeadline.get(d.id)!
    return {
      kind: 'review',
      title: `Review ${count} ${flashcards(count)} for ${d.title}`,
      detail: detail([dueWords(d, day), d.scope_note]),
      minutes: reviewMinutes(count),
      floor: MIN_REVIEW_MINUTES,
      subject_id: d.subject_id,
      deadline_id: d.id,
      topic_id: null,
    }
  })
  if (!rest.length) return [scoped, []]

  // subject id ('' for the Notebook) => what the detail line calls it.
  const names = new Map(rest.map((c) => [c.subject_id ?? '', subjects.find((s) => s.id === c.subject_id)?.title ?? 'Notebook']))
  const only = names.size === 1 ? [...names.keys()][0] : ''
  return [scoped, [{
    kind: 'review',
    title: `Review ${rest.length} ${flashcards(rest.length)}`,
    // One course is named by the row itself (its dot and title).
    detail: only ? null : [...names.values()].slice(0, 3).join(' · '),
    minutes: reviewMinutes(rest.length),
    floor: MIN_REVIEW_MINUTES,
    subject_id: only || null,
    deadline_id: null,
    topic_id: null,
  }]]
}

/** The earliest study slot's start, null for a study day without a set time, false for no session that day. */
function studyTime(store: Store, goal: Row, subjectIds: string[], date: string): string | null | false {
  const slots = store.live('slots').filter((s) => subjectIds.includes(s.subject_id)).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  if (!slots.length) {
    const days = DEFAULT_STUDY_DAYS[Math.min(7, Math.max(1, goal.sessions_per_week))]!
    return days.includes(weekdayOf(date)) ? null : false
  }
  const today = slots.find((s) => s.weekday === weekdayOf(date) && (!s.valid_from || s.valid_from <= date) && (!s.valid_until || s.valid_until >= date))
  return today ? today.starts_at : false
}

/** The first topic on the path with no done lesson, and its 1-based place among the path's topics. Units aren't lessons. */
function nextTopic(store: Store, subjectId: string): [Row | null, number] {
  const topics = store.live('topics').filter((t) => t.subject_id === subjectId).sort(inOrder)
  const path = topics.filter((t) => !t.parent_id).flatMap((unit) => {
    const children = topics.filter((t) => t.parent_id === unit.id)
    return children.length ? children : [unit]
  })
  const learnt = new Set(store.live('plan-tasks')
    .filter((t) => t.subject_id === subjectId && t.kind === 'lesson' && t.done_at && t.topic_id)
    .map((t) => t.topic_id))
  const index = path.findIndex((t) => !learnt.has(t.id))
  return index < 0 ? [null, 0] : [path[index]!, index + 1]
}

function lessons(store: Store, subjects: Row[], date: string): Candidate[] {
  const out: Candidate[] = []
  const goals = store.live('goals')
    .filter((g) => g.kind === 'self' && g.status === 'active' && g.sessions_per_week !== null)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
  for (const goal of goals) {
    if ((goal.starts_on && goal.starts_on > date) || (goal.ends_on && goal.ends_on < date)) continue
    const own = subjects.filter((s) => s.goal_id === goal.id)
    const subject = own.filter((s) => !s.archived_at).sort(inOrder)[0]
    if (!subject) continue
    const ids = own.map((s) => s.id)
    const worked = store.live('plan-tasks').some((t) => ids.includes(t.subject_id) && t.date === date && t.done_at)
    const time = studyTime(store, goal, ids, date)
    if (worked || time === false) continue
    const [topic, number] = nextTopic(store, subject.id)
    if (!topic) continue
    const minutes = Math.max(5, goal.minutes_per_session || WORK_MINUTES)
    out.push({ kind: 'lesson', title: `Lesson ${number}: ${topic.title}`, detail: time, minutes, floor: minutes, subject_id: subject.id, deadline_id: null, topic_id: topic.id })
  }
  return out
}

function candidates(store: Store, date: string, now: number): Candidate[] {
  const zone = currentZone()
  const until = dayEnd(date, zone)
  const reference = Math.max(now, dayStart(date, zone))
  const day = dayKey(reference)

  const subjects = store.live('subjects')
  const shelf = new Set(subjects.filter((s) => !s.archived_at).map((s) => s.id))
  const world = worldOf(store)
  const horizon = dayEnd(shiftDay(date, HORIZON_DAYS), zone)
  const deadlines = store.live('deadlines')
    .filter((d) => shelf.has(d.subject_id) && d.status === 'upcoming' && d.due_at && at(d.due_at) > reference && at(d.due_at) <= horizon)
    .sort((a, b) => at(a.due_at) - at(b.due_at) || a.id.localeCompare(b.id))

  const scopes = new Map(deadlines.map((d) => [d.id, scopeOf(d as never, world.topics).map((t) => t.id)]))
  // Only a named scope of a close quiz or exam claims today's reviews.
  const focus = deadlines.filter((d) => needsRecall(d) && at(d.due_at) <= reference + REVIEW_FOCUS_DAYS * DAY && d.topic_ids.length > 0)
  const [scoped, other] = reviews(store, shelf, subjects, until, focus, scopes, date)
  const reviewed = new Set(scoped.map((t) => t.deadline_id))

  const work = deadlines.filter((d) => !reviewed.has(d.id)).map((d) => {
    const readiness = needsRecall(d) ? computeReadiness(d as never, world as never, now) : null
    const ready = (readiness?.percent ?? 0) / 100
    const need = readiness ? Math.max(0.1, 1 - ready) : 1
    const percent = Math.round(ready * 100)
    const task: Candidate = {
      kind: readiness ? 'prepare' : 'work',
      title: `${readiness ? 'Prepare for' : 'Work on'} ${d.title}`,
      detail: detail([
        dueWords(d, day),
        d.weight_pct !== null ? `${Number(Number(d.weight_pct).toFixed(1))}% of the grade` : null,
        readiness ? (!readiness.checked ? 'not checked yet' : percent >= 85 ? 'ready' : `${percent}% ready`) : null,
      ]),
      minutes: WORK_MINUTES,
      floor: MIN_WORK_MINUTES,
      subject_id: d.subject_id,
      deadline_id: d.id,
      topic_id: null,
    }
    const daysLeft = Math.max(0.5, (at(d.due_at) - reference) / DAY)
    return { task, score: ((d.weight_pct ?? DEFAULT_WEIGHT_PCT) * need) / daysLeft, due: at(d.due_at) }
  }).sort((a, b) => b.score - a.score || a.due - b.due).map((w) => w.task)

  const standing = standingOf(store, leavesOf(world.topics.filter((t: Row) => shelf.has(t.subject_id))), reference)
  return [...checkTask(store, date, standing, reference), ...scoped, ...misses(store, standing, date, reference), ...lessons(store, subjects, date), ...work, ...other]
}

/** Today's check, or nothing: none due, or one already done today. */
function checkTask(store: Store, date: string, standing: Standing[], now: number): Candidate[] {
  const due = dueTopics(standing, now, SITTING_TOPICS)
  const doneToday = store.live('plan-tasks').some((t) => t.date === date && t.kind === 'check' && t.done_at)
  if (!due.length || doneToday) return []
  const titles = due.map((s) => s.topic.title)
  const { questions, minutes } = sittingSize(due.length, 'cold')
  const subjects = [...new Set(due.map((s) => s.topic.subject_id))]
  const dueDeadlines = [...new Set(due.map((s) => s.nearestDeadline ?? ''))]
  return [{
    kind: 'check',
    title: `Check yourself on ${titles.length > 2 ? `${titles[0]}, ${titles[1]} and ${titles.length - 2} more` : titles.join(' and ')}`,
    detail: `${questions} questions · no notes, no help`,
    minutes,
    floor: minutes,
    subject_id: subjects.length === 1 ? subjects[0]! : null,
    deadline_id: dueDeadlines.length === 1 && dueDeadlines[0] ? dueDeadlines[0] : null,
    topic_id: due[0]!.topic.id,
  }]
}

/** "today's check", "yesterday's check", "Tuesday's check", "the check on 3 Oct". */
function checkDay(answered: string, date: string): string {
  const day = dayKey(answered)
  const days = daysBetween(day, date)
  if (days <= 0) return "today's check"
  if (days === 1) return "yesterday's check"
  if (days < 7) return `${new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })}'s check`
  return `the check on ${dayLabel(day)}`
}

/** Reading for what a check found missing and they haven't gone back over since: at most two, the nearest deadline's first. */
function misses(store: Store, standing: Standing[], date: string, now: number): Candidate[] {
  // What they did since the check, not the check itself: the check would count as study.
  const noChecks = { ...worldOf(store), checks: [] }
  const gone = standing.filter((s) => {
    if (s.check.state !== 'missed' || !s.latest) return false
    const worked = topicCheck(s.topic as never, noChecks as never, now).last_studied_at
    return !worked || at(worked) <= at(s.latest.answered_at)
  }).sort((a, b) => (a.nearestDue === null ? 1 : 0) - (b.nearestDue === null ? 1 : 0) || (a.nearestDue ?? 0) - (b.nearestDue ?? 0) || at(b.latest!.answered_at) - at(a.latest!.answered_at))
  return gone.slice(0, MAX_MISSES).map(({ topic, latest }) => {
    const when = checkDay(latest!.answered_at, date)
    const unseen = latest!.studied_days_ago === null
    const source = typeof latest!.source?.label === 'string' ? latest!.source.label.split(' · ')[0] : null
    return {
      kind: 'read',
      title: `${unseen ? 'Start on' : 'Go back over'} ${topic.title}`,
      detail: unseen ? `New to you in ${when}` : detail([`Missed in ${when}`, source]),
      minutes: MISS_MINUTES,
      floor: MISS_MINUTES,
      subject_id: topic.subject_id,
      deadline_id: null,
      topic_id: topic.id,
      item_id: typeof latest!.source?.item_id === 'string' ? latest!.source.item_id : null,
    }
  })
}

function dailyMinutes(store: Store): number {
  const preference = Number(store.getMeta<{ preferences?: { daily_minutes?: unknown } }>('user')?.preferences?.daily_minutes)
  return preference >= 10 && preference <= 600 ? Math.trunc(preference) : DEFAULT_DAILY_MINUTES
}

export function tasksFor(store: Store, date: string): Row[] {
  return store.live('plan-tasks').filter((t) => t.date === date).sort(inOrder)
}

/** Regenerate a day's plan and return it in order. */
export function rebuild(store: Store, date: string, now = Date.now()): Row[] {
  const existing = tasksFor(store, date)
  const done = existing.filter((t) => t.done_at)
  // A task the learner wrote is neither the plan's to replace nor to delete; it only takes its minutes out of the day.
  const own = existing.filter((t) => t.kind === 'own' && !t.done_at)
  const pending = new Map(existing.filter((t) => !t.done_at && t.kind !== 'own').map((t) => [planKey(t), t]))
  const satisfied = new Set(done.map(planKey))

  const sum = (rows: Row[]) => rows.reduce((total, t) => total + t.minutes, 0)
  let left = dailyMinutes(store) - sum(done) - sum(own)
  const chosen = new Map<string, Candidate>()
  for (const candidate of candidates(store, date, now)) {
    const key = planKey(candidate)
    if (satisfied.has(key) || chosen.has(key)) continue
    let minutes = candidate.minutes
    if (minutes > left) {
      const fits = Math.floor(left / 5) * 5
      if (fits < candidate.floor || fits <= 0) continue
      minutes = fits
    }
    left -= minutes
    chosen.set(key, { ...candidate, minutes })
  }

  let position = 0
  for (const task of [...done].sort(inOrder)) {
    if (task.position !== position) store.put('plan-tasks', { ...task, position })
    position++
  }

  const generated = wireTime(now)
  for (const [key, candidate] of chosen) {
    const task = pending.get(key)
    pending.delete(key)
    const words = {
      date,
      subject_id: candidate.subject_id,
      deadline_id: candidate.deadline_id,
      topic_id: candidate.topic_id,
      item_id: candidate.item_id ?? null,
      kind: candidate.kind,
      title: candidate.title,
      detail: candidate.detail,
      minutes: candidate.minutes,
      position: position++,
    }
    const dirty = !task || (Object.keys(words) as (keyof typeof words)[]).some((k) => task[k] !== words[k])
    if (dirty) store.put('plan-tasks', { ...(task ?? { id: crypto.randomUUID(), done_at: null }), ...words, generated_at: generated })
  }
  for (const stale of pending.values()) store.bury('plan-tasks', stale)

  return tasksFor(store, date)
}

/** A day's plan, built on first sight of the day. A day already written, even one since emptied, is left as it is. */
export function ensure(store: Store, date: string, now = Date.now()): Row[] {
  const written = store.db.prepare(`SELECT 1 FROM rows WHERE collection = 'plan-tasks' AND json_extract(body, '$.date') = ? LIMIT 1`).get(date)
  return written ? tasksFor(store, date) : rebuild(store, date, now)
}
