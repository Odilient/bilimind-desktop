// The offers at the end of an answer, checked before the learner ever sees a button. The model's block is a suggestion
// in a loose shape. What leaves here is the exact shape the SPA draws, with every string trimmed and capped, every
// date real, and every id one of THEIR rows. An action that can't be made right is dropped, never repaired into
// something they didn't ask for, except a bad optional `subject_id`, which becomes the Notebook.
//
// Nothing here changes anything: the learner's press does. `propose_course` is a request to the server and
// `attempt_first` becomes the answer's guard, so neither is ever a card.
import { dayKey, shiftDay } from '../../../../app/companion/time.ts'
import { UUID } from '../rules.ts'
import { wireTime, type Store } from '../store.ts'
import { localInstant } from '../zone.ts'
import { partialJson } from './fence.ts'
import { hasAttachments, resolveAlias, type Grounding } from './grounding.ts'

export const MAX_ACTIONS = 2
const DAY = 86_400_000
const OPEN_PATHS = ['', 'calendar', 'notes', 'practice', 'inbox', 'courses', 'new', 'ask']
const DEADLINE_KINDS = ['assignment', 'quiz', 'lab', 'midterm', 'final', 'exam', 'project', 'presentation', 'milestone', 'other']

type Raw = Record<string, any>

function text(value: unknown, max: number, keepLines = false): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const s = keepLines
    ? String(value).replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim()
    : String(value).replace(/\s+/gu, ' ').trim()
  return s ? s.slice(0, max) : null
}

/** A bare object is one action, and `{"actions": [...]}` is the list a model sometimes wraps it in. */
function listOf(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === 'object') return Array.isArray((raw as Raw).actions) ? (raw as Raw).actions : [raw]
  return []
}

function subjectOf(store: Store, g: Grounding, ref: unknown): string | null {
  const row = resolveAlias(g, 'subject', ref)
  if (row) return row.id
  return typeof ref === 'string' && UUID.test(ref) && store.get('subjects', ref) ? ref : null
}

function topicOf(store: Store, g: Grounding, ref: unknown): { id: string; subject_id: string; title: string } | null {
  const row = resolveAlias(g, 'topic', ref)
  if (row) return { id: row.id, subject_id: String(row.subject_id), title: row.title }
  if (typeof ref !== 'string' || !UUID.test(ref)) return null
  const topic = store.get('topics', ref)
  return topic ? { id: topic.id, subject_id: topic.subject_id, title: topic.title } : null
}

/** "2026-11-02" on the calendar, or null. */
function dateOf(value: unknown): string | null {
  const m = typeof value === 'string' ? value.trim().match(/^(\d{4}-\d{2}-\d{2})/) : null
  if (!m) return null
  const d = new Date(`${m[1]}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === m[1] ? m[1]! : null
}

/** "2026-11-02T09:00" is 09:00 where the learner is; with an offset it is that instant; a bare date is the end of that day. */
function instantOf(value: unknown, zone: string): number | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const day = dateOf(v)
    return day ? localInstant(day, '23:59', zone) : null
  }
  const m = v.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/)
  if (!m || !dateOf(m[1])) return null
  if (m[3]) {
    const at = Date.parse(v.replace(' ', 'T'))
    return Number.isNaN(at) ? null : at
  }
  return localInstant(m[1]!, m[2]!, zone)
}

function branchesOf(raw: unknown, depth: number): Raw[] {
  const out: Raw[] = []
  for (const branch of Array.isArray(raw) ? raw : []) {
    const title = text(branch && typeof branch === 'object' ? branch.title : branch, 120)
    if (!title || out.length >= 12) continue
    const node: Raw = { title }
    const children = depth < 3 && branch && typeof branch === 'object' ? branchesOf(branch.children, depth + 1) : []
    if (children.length) node.children = children
    out.push(node)
  }
  return out
}

function oneAction(store: Store, g: Grounding, a: Raw): Raw | null {
  const today = dayKey(g.now)
  switch (a.type) {
    case 'draw': {
      const brief = typeof a.brief === 'string' ? a.brief.trim() : ''
      if (!brief) return null
      return {
        type: 'draw',
        title: typeof a.title === 'string' ? a.title.trim().slice(0, 120) : '',
        mode: a.mode === '3d' ? '3d' : '2d',
        caption: typeof a.caption === 'string' ? a.caption.trim().slice(0, 240) : '',
        brief: brief.slice(0, 4000),
      }
    }
    case 'create_page': {
      const title = text(a.title, 200)
      const markdown = text(a.markdown, 40_000, true)
      return title && markdown ? { type: 'create_page', title, markdown, subject_id: subjectOf(store, g, a.subject_id) } : null
    }
    case 'create_cards': {
      const cards: Raw[] = []
      for (const card of Array.isArray(a.cards) ? a.cards : []) {
        const front = text(card?.front, 500, true)
        const back = text(card?.back, 1000, true)
        if (front && back && cards.length < 40) cards.push({ front, back })
      }
      if (!cards.length) return null
      const subject = subjectOf(store, g, a.subject_id)
      let topic = topicOf(store, g, a.topic_id)
      // The topic decides the course; a topic of a different course than the one named is no topic.
      if (topic && subject && topic.subject_id !== subject) topic = null
      return { type: 'create_cards', subject_id: topic?.subject_id ?? subject, topic_id: topic?.id ?? null, cards }
    }
    case 'create_board': {
      const title = text(a.title, 200)
      const root = text(a.root, 200) ?? title
      const branches = branchesOf(a.branches, 1)
      return title && root && branches.length ? { type: 'create_board', title, subject_id: subjectOf(store, g, a.subject_id), root, branches } : null
    }
    case 'create_course': {
      const title = text(a.title, 200)
      const topics: string[] = []
      for (const t of Array.isArray(a.topics) ? a.topics : []) {
        const name = text(t && typeof t === 'object' ? t.title : t, 200)
        if (name && topics.length < 60) topics.push(name)
      }
      const finish = dateOf(a.finish_date)
      return title && topics.length ? { type: 'create_course', title, summary: text(a.summary, 500), finish_date: finish && finish > today ? finish : null, topics } : null
    }
    case 'write_lesson': {
      const topic = topicOf(store, g, a.topic_id)
      return topic ? { type: 'write_lesson', topic_id: topic.id, title: text(a.title, 200) ?? topic.title, instruction: text(a.instruction, 500) } : null
    }
    case 'add_tasks': {
      const date = dateOf(a.date)
      if (!date || date < shiftDay(today, -1) || date > shiftDay(today, 60)) return null
      const tasks: Raw[] = []
      for (const task of Array.isArray(a.tasks) ? a.tasks : []) {
        const title = text(task?.title, 300)
        if (!title || tasks.length >= 8) continue
        const minutes = Number.isFinite(Number(task.minutes)) && task.minutes !== null && task.minutes !== '' ? Math.round(Number(task.minutes)) : 25
        tasks.push({ title, minutes: Math.max(5, Math.min(240, minutes)), subject_id: subjectOf(store, g, task.subject_id) })
      }
      return tasks.length ? { type: 'add_tasks', date, tasks } : null
    }
    case 'add_deadline': {
      const subject = subjectOf(store, g, a.subject_id)
      const title = text(a.title, 300)
      const due = instantOf(a.due_at, g.zone)
      const kind = typeof a.kind === 'string' ? a.kind.toLowerCase().trim() : ''
      if (!subject || !title || due === null || due < g.now - DAY || due > g.now + 3 * 366 * DAY) return null
      return { type: 'add_deadline', subject_id: subject, title, kind: DEADLINE_KINDS.includes(kind) ? kind : 'other', due_at: wireTime(due) }
    }
    case 'quiz': {
      const questions: Raw[] = []
      for (const q of Array.isArray(a.questions) ? a.questions : []) {
        const question = text(q?.q ?? q?.question, 600, true)
        const answer = text(q?.a ?? q?.answer, 1200, true)
        if (question && answer && questions.length < 10) questions.push({ q: question, a: answer })
      }
      return questions.length ? { type: 'quiz', subject_id: subjectOf(store, g, a.subject_id), questions } : null
    }
    case 'open': {
      const to = typeof a.to === 'string' ? a.to.trim() : ''
      const label = text(a.label, 80)
      const m = to.match(/^\/app(?:\/([A-Za-z0-9-]+)(?:\/([A-Za-z0-9-]+))?)?\/?$/)
      if (!label || !m) return null
      const place = m[1] ?? ''
      if (!m[2]) return OPEN_PATHS.includes(place) ? { type: 'open', to: place ? `/app/${place}` : '/app', label } : null
      const subject = place === 'courses' ? resolveAlias(g, 'subject', m[2]) : null
      return subject ? { type: 'open', to: `/app/courses/${subject.id}`, label } : null
    }
    case 'draft_course':
      return hasAttachments(g) ? { type: 'draft_course', label: text(a.label, 80) ?? 'Make a course from these' } : null
    default:
      return null
  }
}

export function validateActions(store: Store, g: Grounding, raw: unknown): Raw[] {
  const kept: Raw[] = []
  for (const action of listOf(raw)) {
    if (!action || typeof action !== 'object' || typeof (action as Raw).type !== 'string') continue
    let clean: Raw | null = null
    try { clean = oneAction(store, g, action as Raw) } catch { /* dropped */ }
    if (clean) kept.push(clean)
    if (kept.length === MAX_ACTIONS) break
  }
  return kept
}

/** The model's request to draft a course in this answer, if it made one. */
export function draftRequest(raw: unknown): { revise: boolean; change: string | null } | null {
  for (const action of listOf(raw) as Raw[]) {
    if (action?.type === 'propose_course') return { revise: action.revise === true || action.revise === 'true' || action.revise === 1, change: text(action.change, 300) }
  }
  return null
}

/**
 * The guard of an answer that asked for an attempt. What it guards, most specific first: the deadline it named, when
 * this answer was shown it; "Make me try first" on the course named or in focus, else everywhere; else graded work
 * the model judged a plain hand-in nobody listed.
 */
export function guardOf(g: Grounding, raw: unknown): Raw | null {
  for (const action of listOf(raw) as Raw[]) {
    if (action?.type !== 'attempt_first') continue
    const deadline = resolveAlias(g, 'deadline', action.deadline_id)
    if (deadline) return { reason: 'graded', deadline_id: deadline.id, subject_id: null, title: deadline.title }
    for (const subject of [resolveAlias(g, 'subject', action.subject_id)?.id ?? null, g.focusSubjectId]) {
      if (subject && g.tryFirst[subject]) return { reason: 'try_first', deadline_id: null, subject_id: subject, title: g.tryFirst[subject] }
    }
    return g.tryFirstEverywhere
      ? { reason: 'try_first', deadline_id: null, subject_id: null, title: 'everywhere' }
      : { reason: 'graded', deadline_id: null, subject_id: null, title: 'graded work' }
  }
  return null
}

/**
 * The block while it is being written, for the cards to fill in on screen. Nothing here can be pressed, so it isn't
 * validated: `subject_id` stays out because the block still holds aliases, and a quiz's answers stay out because they
 * are for after the learner has tried.
 */
export function inProgress(block: string): Raw[] {
  const titled = (rows: unknown, key: string): Raw[] => (Array.isArray(rows) ? rows : []).filter((r) => r && typeof r === 'object' && typeof r[key] === 'string' && r[key] !== '')
  const words = (row: Raw, key: string) => (typeof row[key] === 'string' ? row[key] : '')
  const live: Raw[] = []
  const decoded = partialJson(block)
  for (const a of Array.isArray(decoded) ? decoded : decoded && typeof decoded === 'object' ? listOf(decoded) as Raw[] : []) {
    switch (a?.type) {
      case 'create_page': live.push({ type: a.type, title: words(a, 'title'), markdown: words(a, 'markdown') }); break
      case 'create_cards': live.push({ type: a.type, cards: titled(a.cards, 'front').map((c) => ({ front: c.front, back: words(c, 'back') })) }); break
      case 'create_board': live.push({ type: a.type, title: words(a, 'title'), root: words(a, 'root'), branches: titled(a.branches, 'title').map((b) => ({ title: b.title })) }); break
      case 'add_tasks': live.push({ type: a.type, date: words(a, 'date'), tasks: titled(a.tasks, 'title').map((t) => ({ title: t.title, minutes: Math.trunc(Number(t.minutes)) || 0 })) }); break
      case 'quiz': live.push({ type: a.type, questions: titled(a.questions, 'q').map((q) => ({ q: q.q, a: '' })) }); break
    }
  }
  return live
}
