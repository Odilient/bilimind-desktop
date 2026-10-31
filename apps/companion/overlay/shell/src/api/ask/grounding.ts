// What the chat reads before it answers. Always the learner right now: date, courses, the next three weeks of
// deadlines, today's plan and classes, which is what lets "what should I do tonight?" be answered from their week.
// Then, before anything else, what they attached; then the material by scope (what's on screen, its course, or all).
// Material is chosen in two passes because reading is the expensive part: items are ranked by title and preview, the
// best few are read, and those excerpts are ranked and cut to the budget. What can be cited is exactly what was shown.
//
// Ids in actions are aliases (S1 a course, T4 a topic, D2 a deadline): a model copies "T4" correctly every time and a
// uuid only most of the time, and an alias it invents resolves to nothing instead of to the wrong row.
import { lessonDigest } from '@bilimind/engine/prompts/expand'
import { computeReadiness } from '../../../../app/companion/readiness.ts'
import { clock as clockOf, dayKey, dayLabel, longDayLabel, mondayOf, shiftDay } from '../../../../app/companion/time.ts'
import { tasksFor } from '../planner.ts'
import { worldOf } from '../rows.ts'
import type { Row, Store } from '../store.ts'
import { UUID } from '../rules.ts'
import { dayStart } from '../zone.ts'
import { headerOf, materialReader, placeOf, scoreOf, termsOf, type Cite, type Excerpt } from './material.ts'

export interface AskInput {
  message: string
  threadId: string | null
  quote: string | null
  scope: 'here' | 'course' | 'everything'
  kind: string
  label: string | null
  subjectId: string | null
  itemId: string | null
  topicId: string | null
  nodeId: number | null
  courseId: number | null
  deadlineId: string | null
  excerpt: string | null
  attachments: Record<string, any>[]
  intent: 'course' | 'attempt' | 'stuck' | null
}

export interface Alias { kind: 'subject' | 'topic' | 'deadline'; id: string; subject_id: string | null; title: string }

export interface Grounding {
  learner: string
  focus: string
  excerpts: Excerpt[]
  cites: Record<string, Cite>
  aliases: Record<string, Alias>
  zone: string
  now: number
  attached: number
  unread: string[]
  tryFirst: Record<string, string>
  tryFirstEverywhere: boolean
  focusSubjectId: string | null
}

export const EXCERPT_CHARS = 16_000
const LESSON_CHARS = 12_000
const BUDGET = { here: 5000, course: 14_000, everything: 14_000 }
const ITEMS = { here: 6, course: 10, everything: 12 }
const MAX_FILES = 6
const DEADLINE_DAYS = 21
const MAX_DEADLINES = 10
const MAX_READINESS = 6
const MAX_TOPICS = 90
const BRIEF_CHARS = 300
const MATERIAL_KINDS = ['file', 'recording', 'page', 'link']
const HAND_IN_KINDS = ['assignment', 'lab', 'project', 'presentation']
const SCHOOL_SOURCES = ['moodle', 'canvas', 'teams', 'ics', 'import']
const DAY = 86_400_000
const at = (iso: string) => Date.parse(iso)

class AliasBook {
  rows: Record<string, Alias> = {}
  private byId = new Map<string, string>()
  private next: Record<string, number> = {}

  name(kind: Alias['kind'], id: string, subjectId: string | null, title: string): string {
    const known = this.byId.get(id)
    if (known) return known
    this.next[kind] = (this.next[kind] ?? 0) + 1
    const alias = `${{ subject: 'S', topic: 'T', deadline: 'D' }[kind]}${this.next[kind]}`
    this.rows[alias] = { kind, id, subject_id: subjectId, title }
    this.byId.set(id, alias)
    return alias
  }

  tag(id: string): string {
    const alias = this.byId.get(id)
    return alias ? ` {${alias}}` : ''
  }

  title(id: string | null | undefined): string | null {
    const alias = id ? this.byId.get(id) : undefined
    return alias ? this.rows[alias]!.title : null
  }
}

const whenFull = (iso: string) => `${dayLabel(dayKey(iso))}, ${clockOf(iso)}`

function sessionLine(s: Row, aliases: AliasBook, timeOnly: boolean): string {
  return `${timeOnly ? clockOf(s.starts_at) : whenFull(s.starts_at)}–${clockOf(s.ends_at)} ${s.title}${s.location ? ` (${s.location})` : ''} · ${aliases.title(s.subject_id) ?? 'a course'}`
}

function deadlineLine(store: Store, d: Row, aliases: AliasBook, withReadiness: boolean, world: ReturnType<typeof worldOf>, now: number): string {
  aliases.name('deadline', d.id, d.subject_id, d.title)
  let ready: string | null = null
  // Readiness is proof, so 0% with nothing checked would read as "knows nothing"; it is "not checked yet".
  if (withReadiness) {
    const r = computeReadiness(d as never, world as never, now)
    ready = r.checked === 0 ? 'not checked yet' : `${r.percent}% ready, checked ${r.checked} of ${r.total} topics`
  }
  const handIn = HAND_IN_KINDS.includes(d.kind)
  const brief = handIn && d.scope_note?.trim() ? String(d.scope_note).replace(/\s+/gu, ' ').trim().slice(0, BRIEF_CHARS) : ''
  return `${d.title} (${d.kind})${aliases.tag(d.id)} · ${aliases.title(d.subject_id) ?? 'a course'}`
    + (d.due_at ? ` · due ${d.all_day ? dayLabel(dayKey(d.due_at)) : whenFull(d.due_at)}` : '')
    + (d.weight_pct != null ? ` · ${Number(Number(d.weight_pct).toFixed(1))}% of the grade` : '')
    + (d.tentative ? ' · not confirmed yet' : '')
    + (ready ? ` · readiness: ${ready}` : '')
    + (handIn ? ' · graded work they hand in' : '')
    + (brief ? ` · brief: ${brief}` : '')
}

function weekLine(store: Store, now: number): string {
  const today = dayKey(now)
  for (const term of store.live('goals').filter((g) => g.kind === 'term' && g.status === 'active' && g.weeks)) {
    const weeks: { n: number; starts_on: string }[] = Array.isArray(term.weeks) ? term.weeks : []
    const current = weeks.filter((w) => w?.starts_on <= today).at(-1)
    if (current && (!term.ends_on || term.ends_on >= today)) {
      const exams = term.exam_period?.starts_on && term.exam_period.starts_on <= today ? ', the exam period' : ''
      return ` Week ${current.n} of ${weeks.length} of ${term.title}${exams}.`
    }
  }
  return ''
}

function describe(store: Store, s: Row, tag: string): string {
  const kind = s.format === 'path' ? 'self-study path' : SCHOOL_SOURCES.includes(s.source) ? 'university course, by week' : 'course, by week'
  const goal = s.goal_id ? store.get('goals', s.goal_id) : null
  const finish = goal ? `${goal.finish_label ?? ''}${goal.ends_on ? ` (${dayLabel(goal.ends_on)})` : ''}`.trim() : ''
  const pace = goal?.kind === 'self' && goal.sessions_per_week != null && goal.minutes_per_session != null ? `${goal.sessions_per_week} × ${goal.minutes_per_session} min a week` : null
  return `${s.title}${s.code ? ` (${s.code})` : ''}${tag} · ${kind}${finish ? ` · finish line: ${finish}` : ''}${pace ? ` · pace: ${pace}` : ''}${s.try_first ? ' · "Make me try first" is on' : ''}`
}

function learnerBlock(store: Store, subjects: Row[], aliases: AliasBook, tryFirstEverywhere: boolean, zone: string, now: number, world: ReturnType<typeof worldOf>): string {
  const today = dayKey(now)
  const lines = [`Now: ${longDayLabel(today)} ${today.slice(0, 4)}, ${clockOf(new Date(now))} (${zone}).${weekLine(store, now)}`, '']
  lines.push(subjects.length ? 'Their courses:' : 'Courses: none yet.')
  for (const s of subjects) lines.push(`- ${describe(store, s, aliases.tag(s.id))}`)
  if (tryFirstEverywhere) lines.push('They turned on "Make me try first" for everything.')

  const deadlines = store.live('deadlines')
    .filter((d) => d.status === 'upcoming' && d.due_at && at(d.due_at) > now && at(d.due_at) <= now + DEADLINE_DAYS * DAY)
    .sort((a, b) => at(a.due_at) - at(b.due_at))
    .slice(0, MAX_DEADLINES)
  lines.push('', deadlines.length ? 'Deadlines in the next 3 weeks:' : 'Deadlines in the next 3 weeks: none.')
  deadlines.forEach((d, i) => lines.push(`- ${deadlineLine(store, d, aliases, i < MAX_READINESS, world, now)}`))

  const tasks = tasksFor(store, today)
  lines.push('', tasks.length ? `Today's plan (${tasks.reduce((n, t) => n + t.minutes, 0)} min):` : "Today's plan: nothing planned yet.")
  for (const t of tasks) {
    const course = aliases.title(t.subject_id)
    lines.push(`- ${t.done_at ? '[done] ' : ''}${t.title}${course ? ` · ${course}` : ''} · ${t.minutes} min`)
  }

  const start = dayStart(today, zone)
  const classes = store.live('sessions')
    .filter((s) => !s.cancelled && at(s.ends_at) > start && at(s.starts_at) < now + 7 * DAY)
    .sort((a, b) => at(a.starts_at) - at(b.starts_at))
    .slice(0, 6)
  const todays = classes.filter((s) => dayKey(s.starts_at) === today)
  const next = classes.find((s) => at(s.starts_at) > now && !todays.includes(s))
  lines.push('', todays.length ? 'Classes today:' : 'Classes today: none.')
  for (const s of todays) lines.push(`- ${sessionLine(s, aliases, true)}`)
  if (next) lines.push(`Next class after today: ${sessionLine(next, aliases, false)}`)
  return lines.join('\n')
}

const byPlace = (a: Row, b: Row) => (a.position ?? 0) - (b.position ?? 0) || String(a.created_at).localeCompare(String(b.created_at))

function courseBlock(store: Store, subject: Row, aliases: AliasBook, full: boolean, now: number, world: ReturnType<typeof worldOf>): string {
  const lines = [`THE COURSE IN FRONT OF THEM: ${subject.title}${subject.code ? ` (${subject.code})` : ''}${aliases.tag(subject.id)}`]
  const topics = store.live('topics').filter((t) => t.subject_id === subject.id).sort(byPlace).slice(0, MAX_TOPICS * 2)
  if (topics.length) lines.push(subject.format === 'path' ? 'Its path (units and topics, in order):' : 'Its topics (by week):')
  let shown = 0
  for (const root of topics.filter((t) => !t.parent_id)) {
    if (shown >= MAX_TOPICS) {
      lines.push(`- … and ${topics.length - shown} more`)
      break
    }
    aliases.name('topic', root.id, subject.id, root.title)
    lines.push(`- ${root.title}${aliases.tag(root.id)}`)
    shown++
    for (const child of topics.filter((t) => t.parent_id === root.id)) {
      if (shown >= MAX_TOPICS) continue
      aliases.name('topic', child.id, subject.id, child.title)
      lines.push(`  - ${child.title}${aliases.tag(child.id)}`)
      shown++
    }
  }
  if (full) {
    const monday = mondayOf(dayKey(now))
    const sessions = store.live('sessions')
      .filter((s) => s.subject_id === subject.id && !s.cancelled && dayKey(s.starts_at) >= monday && dayKey(s.starts_at) < shiftDay(monday, 14))
      .sort((a, b) => at(a.starts_at) - at(b.starts_at))
      .slice(0, 12)
    if (sessions.length) lines.push('Classes this week and next:')
    for (const s of sessions) {
      const topic = aliases.title(s.topic_id)
      lines.push(`- ${sessionLine(s, aliases, false)}${s.week != null ? ` · week ${s.week}` : ''}${topic ? ` · topic ${topic}` : ''}`)
    }
  }
  const deadlines = store.live('deadlines')
    .filter((d) => d.subject_id === subject.id && d.status === 'upcoming')
    .sort((a, b) => (a.due_at ? at(a.due_at) : Infinity) - (b.due_at ? at(b.due_at) : Infinity))
    .slice(0, 8)
  if (deadlines.length) lines.push('Its upcoming deadlines:')
  for (const d of deadlines) lines.push(`- ${deadlineLine(store, d, aliases, false, world, now)}`)
  return lines.join('\n')
}

function everythingBlock(store: Store, subjects: Row[], aliases: AliasBook): string {
  if (!subjects.length) return ''
  const lines = ['ALL THEIR COURSES, IN SHORT:']
  const all = store.live('topics').sort(byPlace)
  for (const s of subjects) {
    const own = all.filter((t) => t.subject_id === s.id)
    const parents = new Set(own.map((t) => t.parent_id).filter(Boolean))
    const leaves = own.filter((t) => !parents.has(t.id))
    const named = leaves.slice(0, 8).map((t) => t.title)
    lines.push(`- ${s.title}${aliases.tag(s.id)}: ${own.length ? `${leaves.length} topics — ${named.join(', ')}${leaves.length > named.length ? ', …' : ''}` : 'no topics yet'}`)
  }
  return lines.join('\n')
}

function focusSubject(store: Store, input: AskInput, subjects: Row[]): Row | null {
  const ids = [
    input.subjectId,
    input.itemId && UUID.test(input.itemId) ? store.get('items', input.itemId)?.subject_id : null,
    input.topicId && UUID.test(input.topicId) ? store.get('topics', input.topicId)?.subject_id : null,
    input.deadlineId && UUID.test(input.deadlineId) ? store.get('deadlines', input.deadlineId)?.subject_id : null,
  ]
  for (const id of ids) {
    const found = subjects.find((s) => s.id === id)
    if (found) return found
  }
  return null
}

/** What a citation of the screen's own text opens, or null when the screen isn't one thing: it still grounds the answer, uncited. */
function screenTarget(store: Store, input: AskInput, focus: Row | null): Cite | null {
  const label = input.label ?? 'What you have open'
  for (const [kind, collection, id] of [['item', 'items', input.itemId], ['deadline', 'deadlines', input.deadlineId], ['topic', 'topics', input.topicId]] as const) {
    if (id && UUID.test(id) && store.get(collection, id)) return { kind, id, label, at_seconds: null, subject_id: focus?.id ?? null }
  }
  return null
}

function weekTopics(store: Store, input: AskInput, focus: Row | null, now: number): string[] {
  const topics = input.topicId ? [input.topicId] : []
  if (focus) {
    const monday = mondayOf(dayKey(now))
    for (const s of store.live('sessions')) {
      if (s.subject_id === focus.id && s.topic_id && dayKey(s.starts_at) >= monday && dayKey(s.starts_at) < shiftDay(monday, 7)) topics.push(s.topic_id)
    }
  }
  return [...new Set(topics)]
}

/** Best match within the budget, back in reading order (a deck's slides in slide order). */
function pick(excerpts: Excerpt[], terms: string[], week: string[], budget: number, relevantOnly: boolean): Excerpt[] {
  const scored = excerpts.flatMap((excerpt, i) => {
    const words = scoreOf(terms, excerpt.text) + 0.5 * scoreOf(terms, excerpt.title)
    if (relevantOnly && words <= 0) return []
    return [{ excerpt, i, score: words + (excerpt.topicId && week.includes(excerpt.topicId) ? 0.25 : 0) }]
  }).sort((a, b) => b.score - a.score || a.i - b.i)
  const kept: typeof scored = []
  let left = budget
  for (const row of scored) {
    if (row.excerpt.text.length <= left) {
      kept.push(row)
      left -= row.excerpt.text.length
    }
    if (left < 200) break
  }
  return kept.sort((a, b) => a.i - b.i).map((r) => r.excerpt)
}

export type Reader = ReturnType<typeof materialReader>

async function materialFor(store: Store, reader: Reader, input: AskInput, focus: Row | null, subjects: Row[], terms: string[], now: number, status: (t: string) => void, attachedIds: string[]) {
  const scope = input.scope
  if (scope !== 'everything' && !focus) return { excerpts: [] as Excerpt[], items: new Map<string, Row>() }
  const shown = new Set(attachedIds)
  // The open page's words are already shown, and so is everything attached.
  if (input.itemId && input.excerpt) shown.add(input.itemId)
  const ids = new Set(subjects.map((s) => s.id))
  const items = store.live('items')
    .filter((i) => MATERIAL_KINDS.includes(i.kind) && !shown.has(i.id) && (scope === 'everything' ? !i.subject_id || ids.has(i.subject_id) : i.subject_id === focus!.id))
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
    .slice(0, 300)
  if (!items.length) return { excerpts: [] as Excerpt[], items: new Map<string, Row>() }

  const week = weekTopics(store, input, focus, now)
  const relevantOnly = scope === 'here'
  const ranked = items.map((item, i) => {
    const words = 3 * scoreOf(terms, item.title) + scoreOf(terms, String(item.preview ?? '').slice(0, 600))
    return { item, i, words, score: words + (week.includes(item.topic_id) ? 2 : 0) + (item.kind === 'file' || item.kind === 'recording' ? 0.5 : 0) }
  }).filter((r) => !relevantOnly || r.words > 0 || week.includes(r.item.topic_id))
    .sort((a, b) => b.score - a.score || a.i - b.i)

  const chosen: Row[] = []
  let files = 0
  for (const row of ranked) {
    if (chosen.length >= ITEMS[scope]) break
    if (row.item.kind === 'file' && ++files > MAX_FILES) continue
    chosen.push(row.item)
  }
  if (!chosen.length) return { excerpts: [] as Excerpt[], items: new Map<string, Row>() }

  const opened = chosen.find((i) => i.kind === 'file' || i.kind === 'recording')
  status(opened ? `Reading ${String(opened.title).slice(0, 60)}…` : scope === 'everything' ? 'Looking across your courses…' : `Looking through ${String(focus?.title).slice(0, 60)}…`)
  const read = await reader.excerpts(chosen, 60_000, 6000)
  return { excerpts: pick(read, terms, week, BUDGET[scope], relevantOnly), items: new Map(chosen.map((i) => [i.id, i])) }
}

/** A written lesson's prose. Never its questions' keys: `lessonDigest` reads only what a learner already sees. */
function lessonText(store: Store, nodeId: number, courseId: number | null): { title: string; text: string } | null {
  const node = store.rec('node', nodeId)
  if (!node || (courseId !== null && node.course_id !== courseId)) return null
  const blocks = store.recs('block', nodeId).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).slice(0, 60)
  const text = lessonDigest(blocks as never).slice(0, LESSON_CHARS)
  return text.trim() ? { title: node.title, text } : null
}

export async function buildGrounding(store: Store, reader: Reader, input: AskInput, status: (t: string) => void, attached: Record<string, any>[], zone: string, tryFirstEverywhere: boolean, now = Date.now()): Promise<Grounding> {
  const aliases = new AliasBook()
  const subjects = store.live('subjects').sort(byPlace).slice(0, 40)
  for (const s of subjects) aliases.name('subject', s.id, s.id, s.title)

  const world = worldOf(store)
  const focus = focusSubject(store, input, subjects)
  const learner = learnerBlock(store, subjects, aliases, tryFirstEverywhere, zone, now, world)
  const terms = termsOf(input.message, input.quote ?? '')

  let focusText = input.scope === 'everything' ? everythingBlock(store, subjects, aliases)
    : focus ? courseBlock(store, focus, aliases, input.scope === 'course', now, world) : ''
  if (input.scope === 'here' && input.label) focusText = `WHAT IS OPEN ON THEIR SCREEN: ${input.label} (${input.kind})\n\n${focusText}`.trim()

  // First what they attached, then what is on screen.
  const given = await reader.attached(attached, terms, status)
  const screen: [Excerpt, Cite | null][] = [...given.excerpts]
  if (input.excerpt) {
    const limit = input.scope === 'everything' ? 8000 : EXCERPT_CHARS
    screen.push([{ id: '', kind: 'file', itemId: input.itemId ?? '', title: input.label ?? 'On their screen', text: input.excerpt.slice(0, limit) }, screenTarget(store, input, focus)])
  }
  // The lesson behind the screen, when the screen sent little of it.
  if (input.nodeId !== null && (input.excerpt ?? '').length < 500) {
    const lesson = lessonText(store, input.nodeId, input.courseId)
    if (lesson) screen.push([{ id: '', kind: 'file', itemId: '', title: `Lesson · ${lesson.title}`, text: lesson.text }, { kind: 'lesson', id: String(input.nodeId), label: input.label ?? lesson.title, at_seconds: null, subject_id: null }])
  }
  const material = await materialFor(store, reader, input, focus, subjects, terms, now, status, given.itemIds)

  const excerpts: Excerpt[] = []
  const cites: Record<string, Cite> = {}
  const add = (e: Excerpt, cite: Cite | null) => {
    const id = `E${excerpts.length + 1}`
    excerpts.push({ ...e, id })
    if (cite) cites[id] = cite
  }
  for (const [e, cite] of screen) add(e, cite)
  for (const e of material.excerpts) {
    const item = material.items.get(e.itemId)
    const place = placeOf(e)
    add(e, item ? { kind: 'item', id: item.id, label: `${e.title}${place ? ` · ${place}` : ''}`, at_seconds: e.atSeconds ?? null, subject_id: item.subject_id ?? null } : null)
  }

  return {
    learner,
    focus: focusText,
    excerpts,
    cites,
    aliases: aliases.rows,
    zone,
    now,
    attached: given.excerpts.length,
    unread: given.unread,
    tryFirst: Object.fromEntries(subjects.filter((s) => s.try_first).map((s) => [s.id, s.title])),
    tryFirstEverywhere,
    focusSubjectId: focus?.id ?? null,
  }
}

const render = (excerpts: Excerpt[]) => excerpts.map((e) => `${headerOf(e)}\n${e.text}`).join('\n\n')
/** The excerpts as the model reads them. */
export const materialText = (g: Grounding) => render(g.excerpts.slice(g.attached))
export const attachmentsText = (g: Grounding) => render(g.excerpts.slice(0, g.attached))
export const hasAttachments = (g: Grounding) => g.attached > 0 || g.unread.length > 0

/** The row an action's id names: an alias shown to the model, or a raw uuid behind one. "{S1}" with its braces is still S1. */
export function resolveAlias(g: Grounding, kind: Alias['kind'], ref: unknown): Alias | null {
  if (typeof ref !== 'string' || !ref.trim()) return null
  const clean = ref.replace(/^[ \t{}[\]()]+|[ \t{}[\]()]+$/g, '')
  const row = g.aliases[clean.toUpperCase()] ?? Object.values(g.aliases).find((a) => a.id === clean) ?? null
  return row?.kind === kind ? row : null
}
