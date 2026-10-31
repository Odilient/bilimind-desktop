/**
 * Checks, as the screens around them need them: where a check opens, what is
 * due for one, when the next one opens, and how long a sitting takes.
 *
 * A check is "Check yourself": a few questions on topics studied a few days
 * ago, answered in your own words with no notes and no assistant
 *. It has no place of its own in the app. Today's plan, a
 * deadline, a course's Practice view, the end of a lesson and ⌘K all link to
 * the one page, `/app/check`, and all of them build that link here, so the
 * page reads the same query wherever it was opened from:
 *
 *   ?deadline=<id>                       the due topics in its scope
 *   ?subject=<id>                        the due topics of one course
 *   ?topics=<id>,<id>                    these topics
 *   ?purpose=prepare&deadline=<id>       what a new assessment needs (§3.6)
 *   ?purpose=teach&topics=<id>           explain one topic back (§3.4)
 *   ?from=<path>                         where Done goes back to
 *
 * With none, it checks what's due today. The server picks the topics and
 * writes the questions (`POST /checks`); `dueTopics` is the same pick made on
 * the device, so the intro can be drawn before the server has answered.
 */
import type { CompanionStore } from './store'
import type { CheckPurpose, Subject, Topic } from './types'
import { dueForCheck, opensAt, scopeOf, sittingSize as size, topicCheck, type ReadinessInput, type TopicCheck } from './readiness'

export const CHECK_PATH = '/app/check'

/** Is this route the check page (where the assistant steps aside: "no help" has to be true)? */
export function onCheckPage(path: string): boolean {
  return path === CHECK_PATH || path.startsWith(`${CHECK_PATH}/`)
}

export function checkHref(
  opts: { purpose?: CheckPurpose; deadlineId?: string; subjectId?: string; topicIds?: string[]; from?: string } = {},
): string {
  const query = new URLSearchParams()
  if (opts.purpose && opts.purpose !== 'cold') query.set('purpose', opts.purpose)
  if (opts.deadlineId) query.set('deadline', opts.deadlineId)
  if (opts.subjectId) query.set('subject', opts.subjectId)
  if (opts.topicIds?.length) query.set('topics', opts.topicIds.join(','))
  if (opts.from) query.set('from', opts.from)
  const q = query.toString()
  return q ? `${CHECK_PATH}?${q}` : CHECK_PATH
}

/** Questions and minutes for a sitting: "6 questions · about 9 min". */
export function sittingSize(topics: number, purpose: CheckPurpose): { questions: number; minutes: number } {
  return size(topics, purpose)
}

export interface DueTopic {
  topic: Topic
  subject: Subject | null
  /** `new`: never checked; `missed`: missed last time; `refresh`: checked, but a while ago. */
  reason: 'new' | 'missed' | 'refresh'
  lastStudiedAt: string
}

const REASON_ORDER = { missed: 0, new: 1, refresh: 2 } as const

export interface DuePick {
  topic: Topic
  row: TopicCheck
  reason: DueTopic['reason']
}

/**
 * The topics due for a check, in the order the server's cold sitting takes
 * them: those in the nearest deadline's scope first, then the next
 * deadline's, then the rest; inside each, a miss before a first check before
 * a refresh, the longest unstudied first, then the course's own order. A
 * sitting takes the first four.
 * Pure, so the demo's server (`repo.demo.ts`) picks exactly as the screens do.
 */
export function pickDue(
  input: ReadinessInput,
  opts: { deadlineId?: string; subjectId?: string; onShelf?: (subjectId: string) => boolean } = {},
  now = Date.now(),
): DuePick[] {
  const deadline = opts.deadlineId ? input.deadlines.find((d) => d.id === opts.deadlineId && !d.deleted_at) : null
  const parents = new Set(input.topics.map((t) => t.parent_id).filter(Boolean))
  // A unit is never checked, only its topics.
  const candidates = deadline
    ? scopeOf(deadline, input.topics)
    : input.topics.filter(
        (t) =>
          !t.deleted_at &&
          !parents.has(t.id) &&
          (opts.subjectId ? t.subject_id === opts.subjectId : (opts.onShelf?.(t.subject_id) ?? true)),
      )

  // When each topic's nearest upcoming deadline is due: the sitting leans toward what's next.
  const nearest = new Map<string, number>()
  for (const d of input.deadlines) {
    if (d.deleted_at || d.status !== 'upcoming' || !d.due_at || Date.parse(d.due_at) <= now) continue
    const due = Date.parse(d.due_at)
    for (const t of scopeOf(d, input.topics)) nearest.set(t.id, Math.min(nearest.get(t.id) ?? Infinity, due))
  }

  const out: DuePick[] = []
  for (const topic of candidates) {
    const row = topicCheck(topic, input, now)
    if (!dueForCheck(row, now)) continue
    out.push({ topic, row, reason: row.state === 'missed' ? 'missed' : row.state === 'checked' ? 'refresh' : 'new' })
  }
  const rank = (p: DuePick) => nearest.get(p.topic.id) ?? Number.MAX_SAFE_INTEGER
  return out.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      REASON_ORDER[a.reason] - REASON_ORDER[b.reason] ||
      Date.parse(a.row.last_studied_at!) - Date.parse(b.row.last_studied_at!) ||
      a.topic.position - b.topic.position,
  )
}

/** What's due for a check on this device, for the screens: today, one deadline, or one course on the shelf. */
export function dueTopics(c: CompanionStore, opts: { deadlineId?: string; subjectId?: string } = {}): DueTopic[] {
  const shelf = new Set(c.shelf.value.map((s) => s.id))
  const input: ReadinessInput = {
    topics: c.topics.value,
    sessions: c.sessions.value,
    items: c.items.value,
    cards: c.cards.value,
    checks: c.checks.value,
    deadlines: c.deadlines.value,
  }
  return pickDue(input, { ...opts, onShelf: (id) => shelf.has(id) }).map((p) => ({
    topic: p.topic,
    subject: c.get('subjects', p.topic.subject_id),
    reason: p.reason,
    lastStudiedAt: p.row.last_studied_at!,
  }))
}

/** The earliest moment still ahead when one of these topics becomes due for a check, or null. */
export function nextCheckOpens(c: CompanionStore, topicIds: string[]): string | null {
  const now = Date.now()
  let first: string | null = null
  for (const id of topicIds) {
    const row = c.topicCheck(id)
    const due = row ? opensAt(row) : null
    const at = due && Date.parse(due) > now ? due : null
    if (at && (!first || Date.parse(at) < Date.parse(first))) first = at
  }
  return first
}
