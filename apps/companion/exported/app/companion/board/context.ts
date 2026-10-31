/**
 * What a board knows about where it lives: its course, the assessment it is
 * for (a revision map), and that course's topics, sessions, cards and pages.
 * Templates and the AI map are built from this, so neither starts empty and
 * neither invents anything the course doesn't have.
 */
import type { Card, Deadline, Item, Session, Subject, Topic } from '../types'
import type { CompanionStore } from '../store'

export interface BoardContext {
  subject: Subject | null
  deadline: Deadline | null
  topics: Topic[]
  sessions: Session[]
  cards: Card[]
  items: Item[]
  deadlines: Deadline[]
  me: string
  now: Date
}

/** Kinds you revise for, as opposed to hand in. */
const REVISABLE = new Set(['quiz', 'midterm', 'final', 'exam'])

export function boardContext(store: CompanionStore, subjectId: string | null, deadlineId: string | null): BoardContext {
  const deadline = deadlineId ? store.get('deadlines', deadlineId) : null
  const sid = subjectId ?? deadline?.subject_id ?? null
  const subject = sid ? store.get('subjects', sid) : null
  const of = <T extends { subject_id: string | null }>(rows: T[]) => (sid ? rows.filter((r) => r.subject_id === sid) : [])
  return {
    subject,
    deadline,
    topics: of(store.topics.value),
    sessions: of(store.sessions.value),
    cards: of(store.cards.value),
    items: of(store.items.value),
    deadlines: of(store.deadlines.value),
    me: store.userName.value || 'You',
    now: new Date(),
  }
}

/** The next assessment worth a revision map: in this course if one is given, else anywhere. */
export function nextRevisable(store: CompanionStore, subjectId: string | null): Deadline | null {
  const now = Date.now()
  const list = store.deadlines.value
    .filter((d) => REVISABLE.has(d.kind) && d.status === 'upcoming' && d.due_at && Date.parse(d.due_at) > now)
    .filter((d) => !subjectId || d.subject_id === subjectId)
    .sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!))
  return list[0] ?? null
}

/** The next group piece of work: a project or a presentation. */
export function nextProject(store: CompanionStore, subjectId: string | null): Deadline | null {
  const now = Date.now()
  return store.deadlines.value
    .filter((d) => (d.kind === 'project' || d.kind === 'presentation') && d.status === 'upcoming' && (!d.due_at || Date.parse(d.due_at) > now))
    .filter((d) => !subjectId || d.subject_id === subjectId)
    .sort((a, b) => Date.parse(a.due_at ?? '9999') - Date.parse(b.due_at ?? '9999'))[0] ?? null
}

/** Lectures (or lessons) that have happened, oldest first. */
export function pastLectures(ctx: BoardContext): Session[] {
  const now = ctx.now.getTime()
  return ctx.sessions
    .filter((s) => !s.cancelled && Date.parse(s.starts_at) < now && /^(Lecture|Lesson)/.test(s.title))
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
}

/** "L6", or "L4–5" when a topic ran over two lectures. */
export function lectureLabel(sessions: Session[]): string | undefined {
  const nums = sessions.map((s) => s.number).filter((n): n is number => n !== null).sort((a, b) => a - b)
  if (!nums.length) return undefined
  const first = nums[0]!, last = nums[nums.length - 1]!
  return first === last ? `L${first}` : `L${first}–${last}`
}

/**
 * A card's source quote, shortened for a node: "Lecture 6, slides 8–15" →
 * "L6 · slides 8–15"; "Lecture 7 recording, 47:05" → "L7 47:05".
 */
export function shortSource(quote: string | null | undefined): string | undefined {
  if (!quote) return undefined
  const m = /Lecture (\d+)(?: recording)?,\s*((?:slides?|page)\s*[\d–-]+|\d+:\d{2})/i.exec(quote)
  if (m) return /:\d{2}$/.test(m[2]!) ? `L${m[1]} ${m[2]}` : `L${m[1]} · ${m[2]}`
  const lab = /^(Lab \d+)[^,]*,\s*(page \d+)/i.exec(quote)
  if (lab) return `${lab[1]} · ${lab[2]}`
  return undefined
}

export function weekdayName(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'long' })
}
