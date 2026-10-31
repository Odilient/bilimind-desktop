/**
 * Readiness from proof, and progress along a path, computed from the rows on
 * this device.
 *
 * Done means remembered. A topic counts as known only
 * once the learner has answered questions on it cold: a few days after they
 * last studied it, with no notes and no assistant. Its readiness is the pass
 * rate of those checks over the last six weeks, recent ones counting more,
 * the whole fading as the newest gets old. A topic never checked has no
 * number at all ("not checked yet") rather than a guess, and over a deadline
 * it counts as 0, so the figure only rises when something is shown to have
 * stuck. Cards, notes and classes are the work; they decide *when* a topic
 * can be checked, never how ready it is.
 *
 * The server owns the same rule (`Readiness.php`) and the two must agree number for number. This copy exists because
 * the demo has no server, the path and the Topics tab need a figure for every
 * topic rather than one deadline, and a check just answered has to move the
 * number on screen at once, offline included. The one difference is written
 * lessons: the server counts one marked complete as study, at the time it was
 * marked; the device only knows *that* it was, not when, so it leaves it out
 * (the server's answer to `POST /checks` is what decides a sitting anyway).
 *
 * What was here before (seen × practised × FSRS recall, and a projection of
 * what 25 minutes of cards would do) measured familiarity, which is exactly
 * what AI-assisted study inflates. `topicSignal` survives only as the *work*
 * signal: how much of a topic the learner has met, which is what moves a
 * path along.
 */
import type { Card, Check, Deadline, Item, Readiness, Session, Topic, TopicCheckState } from './types'
import { fsrs } from 'ts-fsrs'
import { dayKey } from './time'

const scheduler = fsrs()
const DAY = 86_400_000

/** Days without study before a topic can be checked: long enough to have to remember it. */
export const COLD_DAYS = 3
/**
 * …or this, when a deadline whose scope holds it is due within CLOSE_DAYS, or
 * when its last counted check was missed while sure: a confident error comes
 * back sooner.
 */
export const COLD_DAYS_CLOSE = 1
export const CLOSE_DAYS = 3
/** A check counts toward readiness for this long after it was answered. */
export const WINDOW_DAYS = 42
/** A check's weight halves every this many days. */
export const HALF_LIFE_DAYS = 14
/** A topic checked longer ago than this is due again, and its number starts to fade. */
export const REFRESH_DAYS = 14
/** Over this many days past REFRESH_DAYS the fade reaches its floor of a half. */
export const FADE_DAYS = 56

/** A cold sitting: at most 4 topics, 2 questions each. `prepare` asks 3; `teach` is one explanation. */
export const SITTING_TOPICS = 4
export const QUESTIONS_PER_TOPIC = 2
export const PREPARE_QUESTIONS = 3
export const MINUTES_PER_QUESTION = 1.5
export const MINUTES_PER_EXPLAIN = 4

/** The practice suggestion: due or new cards in scope, at 40 s each. */
export const PRACTICE_CARDS = 30
export const SECONDS_PER_CARD = 40

export interface ReadinessInput {
  topics: Topic[]
  sessions: Session[]
  items: Item[]
  cards: Card[]
  checks: Check[]
  /** Which topics are close: a deadline due within CLOSE_DAYS makes its scope checkable sooner. */
  deadlines: Deadline[]
  /** Written lessons marked complete (node ids): a topic whose lesson is done is met. */
  lessonsDone?: ReadonlySet<number>
}

/** One topic's row in a `Readiness`, and what `topicCheck` answers on its own. */
export type TopicCheck = Readiness['topics'][number]

const SCORE = { right: 1, partly: 0.5, wrong: 0 } as const

/* -------------------------------------------------------------------------- */
/* Scope                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A deadline's topics as the server reads them: a unit stands for its topics,
 * and a deadline naming nothing is about the whole course (a final usually
 * is), so it takes every leaf topic of its subject.
 */
export function scopeOf(deadline: Pick<Deadline, 'subject_id' | 'topic_ids'>, topics: Topic[]): Topic[] {
  const live = topics.filter((t) => !t.deleted_at)
  const parents = new Set(live.map((t) => t.parent_id).filter(Boolean))
  if (!deadline.topic_ids.length) {
    return live.filter((t) => t.subject_id === deadline.subject_id && !parents.has(t.id))
  }
  const out = new Map<string, Topic>()
  for (const id of deadline.topic_ids) {
    const children = live.filter((t) => t.parent_id === id)
    for (const t of children.length ? children : live.filter((x) => x.id === id)) out.set(t.id, t)
  }
  return [...out.values()]
}

/** Topics in the scope of a deadline due within CLOSE_DAYS: they turn cold after one day, not three. */
function closeTopics(deadlines: Deadline[], topics: Topic[], now: number): Set<string> {
  const out = new Set<string>()
  for (const d of deadlines) {
    if (d.deleted_at || d.status !== 'upcoming' || !d.due_at) continue
    const due = Date.parse(d.due_at)
    if (due <= now || due - now > CLOSE_DAYS * DAY) continue
    for (const t of scopeOf(d, topics)) out.add(t.id)
  }
  return out
}

/* -------------------------------------------------------------------------- */
/* One topic                                                                  */
/* -------------------------------------------------------------------------- */

const MADE: Item['kind'][] = ['page', 'board', 'recording', 'photo']

function latest(a: number | null, b: number | null): number | null {
  if (a === null) return b
  if (b === null) return a
  return Math.max(a, b)
}

function at(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isNaN(t) || t > now ? null : t
}

/**
 * The last time the learner studied a topic: reviewed one of its cards,
 * made or edited something on it (or in one of its classes), sat a class on
 * it, or answered a check on it. A check is study too, which is why the same
 * topic can't be checked again the next morning.
 */
function lastStudied(topic: Topic, input: ReadinessInput, now: number): number | null {
  let last: number | null = null
  const held = new Set<string>()
  for (const s of input.sessions) {
    if (s.topic_id !== topic.id || s.cancelled || s.deleted_at) continue
    const ended = at(s.ends_at, now)
    if (ended === null) continue
    held.add(s.id)
    last = latest(last, ended)
  }
  for (const c of input.cards) {
    if (c.topic_id === topic.id && c.subject_id && !c.suspended && !c.deleted_at) last = latest(last, at(c.last_review_at, now))
  }
  for (const i of input.items) {
    if (i.deleted_at || i.source !== 'made') continue
    if (i.topic_id === topic.id || (i.session_id && held.has(i.session_id))) last = latest(last, at(i.updated_at ?? i.created_at, now))
  }
  for (const c of input.checks) {
    if (c.topic_id === topic.id && !c.deleted_at) last = latest(last, at(c.answered_at, now))
  }
  return last
}

/** A check that counts: cold, marked, and answered in the last WINDOW_DAYS. */
export function counts(check: Check, now = Date.now()): boolean {
  if (!check.cold || !check.result || check.deleted_at) return false
  const t = at(check.answered_at, now)
  return t !== null && now - t <= WINDOW_DAYS * DAY
}

/**
 * Where one topic stands: its check percent (null until a check counts),
 * its state, when it was last studied and when it can next be checked. The
 * weight is the topic's own; `computeReadiness` puts it over the scope.
 */
export function topicCheck(topic: Topic, input: ReadinessInput, now = Date.now(), deadlines = input.deadlines): TopicCheck {
  return topicRow(topic, input, now, closeTopics(deadlines, input.topics, now).has(topic.id))
}

function topicRow(topic: Topic, input: ReadinessInput, now: number, close: boolean): TopicCheck {
  const studied = lastStudied(topic, input, now)
  const counted = input.checks
    .filter((c) => c.topic_id === topic.id && counts(c, now))
    .sort((a, b) => Date.parse(a.answered_at!) - Date.parse(b.answered_at!))
  const newest = counted.at(-1)
  const soon = close || (newest?.result === 'wrong' && newest.confidence === 'sure')
  const opens = studied === null ? null : studied + (soon ? COLD_DAYS_CLOSE : COLD_DAYS) * DAY

  let percent: number | null = null
  if (newest) {
    let sum = 0
    let weights = 0
    for (const c of counted) {
      const w = 0.5 ** ((now - Date.parse(c.answered_at!)) / DAY / HALF_LIFE_DAYS)
      sum += w * SCORE[c.result!]
      weights += w
    }
    const age = (now - Date.parse(newest.answered_at!)) / DAY
    const fade = age <= REFRESH_DAYS ? 1 : Math.max(0.5, 1 - (age - REFRESH_DAYS) / FADE_DAYS)
    percent = Math.round(100 * (sum / weights) * fade)
  }

  const state: TopicCheckState = newest
    ? newest.result === 'right' ? 'checked' : 'missed'
    : studied !== null ? 'unchecked' : 'unstudied'

  const cards = input.cards.filter((c) => c.topic_id === topic.id && c.subject_id && !c.suspended && !c.deleted_at)
  return {
    topic_id: topic.id,
    title: topic.title,
    weight: topic.weight ?? 1,
    percent,
    state,
    checks: counted.length,
    right: counted.filter((c) => c.result === 'right').length,
    partly: counted.filter((c) => c.result === 'partly').length,
    last_checked_at: newest?.answered_at ?? null,
    last_studied_at: studied === null ? null : new Date(studied).toISOString(),
    checkable_at: opens !== null && opens > now ? new Date(opens).toISOString() : null,
    practiced: cards.length ? round2(cards.filter((c) => c.last_review_at).length / cards.length) : 0,
  }
}

/**
 * Due for a check: studied, cold now, and either never checked, missed last
 * time, or checked so long ago that it's time to see whether it held.
 */
export function dueForCheck(t: TopicCheck, now = Date.now()): boolean {
  if (!t.last_studied_at || t.checkable_at) return false
  if (t.state === 'unchecked' || t.state === 'missed') return true
  return t.state === 'checked' && !!t.last_checked_at && now - Date.parse(t.last_checked_at) > REFRESH_DAYS * DAY
}

/**
 * When this topic opens for a check: the moment it turns cold, if a check is
 * wanted then (unproven, missed, or last right more than REFRESH_DAYS before
 * that moment); otherwise null. A topic checked well last week turns cold in
 * days but opens nothing. The server's `opens_at` is the earliest of these.
 */
export function opensAt(t: TopicCheck): string | null {
  return t.checkable_at && dueForCheck({ ...t, checkable_at: null }, Date.parse(t.checkable_at)) ? t.checkable_at : null
}

/** Questions and minutes for a sitting: 1.5 minutes a question, 4 for an explanation, rounded up. */
export function sittingSize(topics: number, purpose: Check['purpose']): { questions: number; minutes: number } {
  if (purpose === 'teach') return { questions: 1, minutes: MINUTES_PER_EXPLAIN }
  const questions = purpose === 'prepare'
    ? PREPARE_QUESTIONS
    : Math.min(SITTING_TOPICS, topics) * QUESTIONS_PER_TOPIC
  return { questions, minutes: Math.ceil(questions * MINUTES_PER_QUESTION) }
}

/* -------------------------------------------------------------------------- */
/* One deadline                                                               */
/* -------------------------------------------------------------------------- */

/** Cards in a deadline's scope that are due by the end of the window. */
export function dueCardsFor(topicIds: string[], cards: Card[], until = Date.now()): Card[] {
  const scope = new Set(topicIds)
  return cards
    .filter((c) => !c.deleted_at && !c.suspended && c.topic_id && scope.has(c.topic_id) && Date.parse(c.due_at) <= until)
    .sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at))
}

export function computeReadiness(deadline: Deadline, input: ReadinessInput, now = Date.now()): Readiness {
  const scope = scopeOf(deadline, input.topics)
  const close = closeTopics(input.deadlines, input.topics, now)
  const raw = scope.map((t) => Math.max(0, t.weight ?? 1))
  const total = raw.reduce((a, b) => a + b, 0)
  const rows = scope.map((t, i) => ({
    ...topicRow(t, input, now, close.has(t.id)),
    weight: total > 0 ? raw[i]! / total : 1 / scope.length,
  }))

  const ids = new Set(scope.map((t) => t.id))
  const sure = input.checks.filter((c) => c.topic_id && ids.has(c.topic_id) && c.confidence && counts(c, now))
  const calibration = sure.length >= 5
    ? {
        answered: sure.length,
        sure: sure.filter((c) => c.confidence === 'sure').length,
        right: sure.filter((c) => c.confidence === 'sure' && c.result === 'right').length,
      }
    : null

  const due = rows.filter((r) => dueForCheck(r, now)).length
  // Never reviewed, or due by the end of the as-of day in the learner's zone.
  const today = dayKey(now)
  const practise = input.cards.filter(
    (c) => c.topic_id && ids.has(c.topic_id) && c.subject_id && !c.suspended && !c.deleted_at &&
      (!c.last_review_at || dayKey(c.due_at) <= today),
  ).length
  const cards = Math.min(PRACTICE_CARDS, practise)

  return {
    percent: Math.round(rows.reduce((sum, r) => sum + r.weight * (r.percent ?? 0), 0)),
    checked: rows.filter((r) => r.checks > 0).length,
    total: rows.length,
    topics: rows.map((r) => ({ ...r, weight: round2(r.weight) })),
    calibration,
    suggestion: {
      check: due ? { topics: due, ...sittingSize(due, 'cold') } : { topics: 0, questions: 0, minutes: 0 },
      practice: { cards, minutes: Math.ceil((cards * SECONDS_PER_CARD) / 60 / 5) * 5 },
    },
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/* -------------------------------------------------------------------------- */
/* The work signal                                                            */
/* -------------------------------------------------------------------------- */

export interface TopicSignal {
  seen: number
  practiced: number
  recall: number
  percent: number
}

/** Probability of recalling a card now, 0–1. Never-reviewed cards recall nothing. */
export function retrievability(card: Card, now = Date.now()): number {
  if (!card.last_review_at) return 0
  try {
    const r = scheduler.get_retrievability(card.fsrs as never, new Date(now), false)
    return Number.isFinite(r) ? Math.max(0, Math.min(1, r)) : 0
  } catch {
    return 0
  }
}

/**
 * How much of a topic the learner has met. A class on it that has happened
 * counts most when they took something away from it (notes, a recording, a
 * photo); a topic whose cards are all known counts as met even without a
 * class, which is how a placement check skips what you know. So does one
 * whose written lesson the learner marked complete.
 */
export function seenFraction(topic: Topic, input: Pick<ReadinessInput, 'sessions' | 'items' | 'cards' | 'lessonsDone'>, now = Date.now()): number {
  if (topic.node_id && input.lessonsDone?.has(topic.node_id)) return 1
  const held = input.sessions.filter(
    (s) => s.topic_id === topic.id && !s.cancelled && !s.deleted_at && Date.parse(s.starts_at) <= now,
  )
  const cards = input.cards.filter((c) => c.topic_id === topic.id && !c.deleted_at && !c.suspended)
  const allKnown = cards.length > 0 && cards.every((c) => c.last_review_at)
  if (held.length) {
    const ids = new Set(held.map((s) => s.id))
    const tookAway = input.items.some(
      (i) => !i.deleted_at && MADE.includes(i.kind) && ((i.session_id && ids.has(i.session_id)) || i.topic_id === topic.id),
    )
    return tookAway ? 1 : 0.6
  }
  if (allKnown) return 1
  const anyMaterial = input.items.some((i) => !i.deleted_at && i.topic_id === topic.id)
  return anyMaterial ? 0.3 : 0
}

/**
 * The work done on a topic, not what is known: seen × (¼ + ¾ × practised ×
 * recall). It moves a path along and orders what to look at next; readiness
 * never reads it.
 */
export function topicSignal(topic: Topic, input: Pick<ReadinessInput, 'sessions' | 'items' | 'cards' | 'lessonsDone'>, now = Date.now()): TopicSignal {
  const seen = seenFraction(topic, input, now)
  const cards = input.cards.filter((c) => c.topic_id === topic.id && !c.deleted_at && !c.suspended)
  const reviewed = cards.filter((c) => c.last_review_at)
  const practiced = cards.length ? reviewed.length / cards.length : 0
  const recall = reviewed.length ? reviewed.reduce((sum, c) => sum + retrievability(c, now), 0) / reviewed.length : 0
  const percent = Math.round(100 * seen * (0.25 + 0.75 * practiced * recall))
  return { seen, practiced, recall, percent }
}

/* -------------------------------------------------------------------------- */
/* Progress along a path                                                      */
/* -------------------------------------------------------------------------- */

export type TopicState = 'done' | 'now' | 'next' | 'later'

export interface PathStep {
  topic: Topic
  /** Where the learner is on the path: done, the one now, planned next, later. Not what they know. */
  state: TopicState
  /** The session it is (or was) planned for. */
  session: Session | null
  /** What they know: the topic's check percent, null until a check counts. */
  percent: number | null
  check: TopicCheckState
}

/**
 * A course's topics in path order, units left out. Positions may count from
 * zero inside each unit (the API does) or run across the course (the demo
 * does), so the unit's own position sorts first either way.
 */
export function pathOrder(subjectTopics: Topic[]): Topic[] {
  const byId = new Map(subjectTopics.map((t) => [t.id, t]))
  const unitPos = (t: Topic) => (t.parent_id ? (byId.get(t.parent_id)?.position ?? 0) : -1)
  return subjectTopics
    .filter((t) => !t.deleted_at && (t.parent_id || !subjectTopics.some((c) => c.parent_id === t.id)))
    .sort((a, b) => unitPos(a) - unitPos(b) || a.position - b.position)
}

/**
 * Where a self-study learner is on the path. Done is a topic met (a lesson
 * held, or placed out of); now is the first one not done; next are those
 * already given a session in the plan; the rest are later. Time files
 * everything here too: the plan is the timetable's study slots. Beside that
 * progress, each step carries what the checks say about it.
 */
export function pathSteps(subjectTopics: Topic[], input: ReadinessInput, now = Date.now()): PathStep[] {
  const leaves = pathOrder(subjectTopics)
  const close = closeTopics(input.deadlines, input.topics, now)
  let foundNow = false
  return leaves.map((topic) => {
    const sessions = input.sessions
      .filter((s) => s.topic_id === topic.id && !s.cancelled && !s.deleted_at)
      .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
    const held = sessions.find((s) => Date.parse(s.ends_at) <= now)
    const upcoming = sessions.find((s) => Date.parse(s.ends_at) > now) ?? null
    let state: TopicState
    if (seenFraction(topic, input, now) >= 1) state = 'done'
    else if (!foundNow) {
      state = 'now'
      foundNow = true
    } else state = upcoming ? 'next' : 'later'
    const check = topicRow(topic, input, now, close.has(topic.id))
    return { topic, state, session: held ?? upcoming, percent: check.percent, check: check.state }
  })
}
