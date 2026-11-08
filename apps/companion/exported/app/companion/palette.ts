/**
 * The ⌘K palette: one field that finds anything the learner keeps, does any
 * command, and asks BiliMind whatever it can't find.
 *
 *   const palette = usePalette()
 *   palette.show()            // ⌘K, the rail's Search, a phone bar's search
 *   palette.show('lab 4')     // opened already searching
 *
 * Everything is searched on this device, from the store, as the learner
 * types: courses, lessons, notes, whiteboards, deadlines, files, classes and
 * the app's own commands. Nothing waits on the network, so the list never
 * jumps under the pointer.
 *
 * Empty, it doesn't wait to be asked. "New chat" comes first (it is what
 * New means everywhere now: ⌥Space, the sidebar, the phone), then what it
 * predicts: take notes in the class on now, continue the lesson you were
 * on, check yourself when a topic studied a few days ago has gone cold (and
 * "Check for Quiz 2" for each close deadline with one), practise for the
 * deadline that matters, the notes you touched last, the chats you had last,
 * then the kinds of note you can make. The check rows answer a search for
 * "check" or "test" too; they exist only while something is due, because a
 * check that opens on nothing is a dead end.
 *
 * Typing puts "Ask Bili: …" first, because a question is the one thing a
 * search can't answer; it opens a new chat with the question already asked
 * (`newChatLink({ q })`). Enter still goes to a result when the words plainly
 * name one ("calendar", "sql joins"); a question ("why does…?") goes to the
 * chat. ⌘Enter always asks. Chats are searched by their titles too.
 *
 * Nothing made here is filed by guessing. A new page, whiteboard or file
 * goes to My notes. The one exception says so on the row: on a course's
 * screen there is also "New page in Databases", and the class on now offers
 * "Take notes in Databases · Lecture 8", each naming where it will go.
 *
 * The rows are data (`PaletteRow`): what the row says and an `action` that
 * says what pressing it does. The component (`CompanionPalette`) runs the
 * action, so this file stays plain and testable.
 */
import { computed, ref } from 'vue'
import type { Deadline, Item, Session, Subject, Topic } from './types'
import type { CompanionStore } from './store'
import type { AiThread } from './ai/types'
import { chatPath, newChatLink, type NewChatOptions } from './ai/routes'
import { NEW_NOTE_TYPES, offered, type NewKind } from './notes/new'
import { FOCUS_MIN, useFocus } from './focus'
import { clock, dayKey, dayLabel, relativeDay, untilLabel, whenLabel } from './time'
import { kindWord, itemIcon, readyWords } from './words'
import { checkHref, dueTopics, sittingSize } from './checks'
import { plural } from '../utils/words'
import { translate } from '../utils/i18n'
import {
  classHref,
  classNow,
  deadlinesWithin,
  isStudy,
  itemHref,
  lessonNow,
  notesOf,
  topicHref,
} from './today-layout'

/* -- Open, closed, and what was searched ---------------------------------- */

const open = ref(false)
const query = ref('')

const RECENT_KEY = 'bm:palette-recent'
const RECENT_MAX = 5

function readRecent(): string[] {
  if (!import.meta.client) return []
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? raw.filter((q): q is string => typeof q === 'string').slice(0, RECENT_MAX) : []
  } catch {
    return []
  }
}

const recent = ref<string[]>(readRecent())

export function usePalette() {
  return {
    open,
    query,
    recent: computed(() => recent.value),
    show(seed = '') {
      query.value = seed
      open.value = true
    },
    hide() {
      open.value = false
    },
    toggle() {
      if (open.value) open.value = false
      else {
        query.value = ''
        open.value = true
      }
    },
    /** A search that led somewhere is worth offering again. */
    remember(text: string) {
      const q = text.trim()
      if (q.length < 2) return
      recent.value = [q, ...recent.value.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, RECENT_MAX)
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(recent.value))
      } catch {
        // Private mode: remembered for this tab only.
      }
    },
    forget() {
      recent.value = []
      try {
        localStorage.removeItem(RECENT_KEY)
      } catch {
        // Nothing stored, nothing to clear.
      }
    },
  }
}

/* -- Rows -------------------------------------------------------------------- */

export type PaletteGroup =
  | 'ask'
  | 'suggested'
  | 'create'
  | 'recent'
  | 'chats'
  | 'courses'
  | 'lessons'
  | 'notes'
  | 'boards'
  | 'deadlines'
  | 'files'
  | 'classes'
  | 'commands'

export const GROUP_LABEL: Record<PaletteGroup, string> = {
  get ask() { return translate('palette.group.ask') },
  get suggested() { return translate('palette.group.suggested') },
  get create() { return translate('palette.group.create') },
  get recent() { return translate('palette.group.recent') },
  get chats() { return translate('palette.group.chats') },
  get courses() { return translate('palette.group.courses') },
  get lessons() { return translate('palette.group.lessons') },
  get notes() { return translate('palette.group.notes') },
  get boards() { return translate('palette.group.boards') },
  get deadlines() { return translate('palette.group.deadlines') },
  get files() { return translate('palette.group.files') },
  get classes() { return translate('palette.group.classes') },
  get commands() { return translate('palette.group.commands') },
}

export type CommandId = 'quiet-ai' | 'settings' | 'toggle-ai' | 'focus'

export type PaletteAction =
  | { type: 'go'; to: string }
  /** A new chat with this question already asked. */
  | { type: 'ask'; prompt: string }
  /** A blank new chat (the thread is cleared first). */
  | { type: 'new-chat' }
  /** A new page filed here, opened at once; `title` names it. */
  | { type: 'page'; subjectId: string | null; sessionId: string | null; template: 'blank' | 'lecture'; title?: string }
  | { type: 'capture'; mode: 'menu' | 'record' | 'paste'; subjectId?: string | null; sessionId?: string | null }
  /** One of Notes' "+" kinds (`notes/new.ts`), made in My notes and opened. */
  | { type: 'note'; kind: NewKind; template?: string | null; url?: string }
  | { type: 'file'; itemId: string }
  | { type: 'query'; text: string }
  | { type: 'command'; id: CommandId }

export interface PaletteRow {
  key: string
  group: PaletteGroup
  icon: string
  title: string
  /** Where the query matched the title, as [start, end) pairs, for the bold. */
  marks?: [number, number][]
  /** The quiet second line: the course, a date, why it's suggested. */
  meta?: string
  /** A course colour for the dot before the meta line. */
  color?: string | null
  /** What Enter does, said on the row in front: "Open", "Ask", "Create". */
  verb: string
  /** A shortcut that does the same thing elsewhere: "g k", "⌘J". */
  kbd?: string
  action: PaletteAction
  score: number
}

export interface PaletteSection {
  group: PaletteGroup
  label: string
  rows: PaletteRow[]
}

/* -- Matching ---------------------------------------------------------------- */

function fold(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function joined(marks: [number, number][]): [number, number][] {
  const out: [number, number][] = []
  for (const [a, b] of [...marks].sort((x, y) => x[0] - y[0])) {
    const last = out.at(-1)
    if (last && a <= last[1]) last[1] = Math.max(last[1], b)
    else out.push([a, b])
  }
  return out
}

const BOUNDARY = /[\s\-·:_/(.,'"]/

interface Match {
  score: number
  marks: [number, number][]
}

/**
 * How well `q` names `title`, with `extra` (the course, the room, a kind)
 * as weaker evidence. Null is "not at all".
 *
 *  - the whole query in the title: 100 at the start, 85 at a word, 65 inside
 *  - every word somewhere, the title counting more than the extra: ~50
 *  - only the extra line: 30 ("databases" finds Databases' deadlines too)
 *  - the letters in order: up to 30 ("sqlj" → "SQL joins")
 */
export function match(q: string, title: string, extra = ''): Match | null {
  const needle = fold(q).trim()
  if (!needle) return { score: 1, marks: [] }
  const t = fold(title)
  // A folded title of another length can't be marked by its indexes.
  const markable = t.length === title.length
  const mark = (m: [number, number][]) => (markable ? joined(m) : [])

  const at = t.indexOf(needle)
  if (at >= 0) {
    const word = at === 0 || BOUNDARY.test(t[at - 1]!)
    const score = (at === 0 ? 100 : word ? 85 : 65) + (needle.length === t.length ? 10 : 0) - Math.min(8, at / 6)
    return { score, marks: mark([[at, at + needle.length]]) }
  }

  const x = fold(extra)
  const words = needle.split(/\s+/).filter(Boolean)
  if (words.length > 1) {
    let score = 52
    const marks: [number, number][] = []
    for (const w of words) {
      const i = t.indexOf(w)
      if (i >= 0) {
        marks.push([i, i + w.length])
        score += i === 0 || BOUNDARY.test(t[i - 1]!) ? 6 : 3
      } else if (x.includes(w)) score -= 2
      else return null
    }
    return marks.length ? { score, marks: mark(marks) } : { score: 32, marks: [] }
  }

  if (x.includes(needle)) return { score: 30, marks: [] }
  if (needle.length < 2) return null

  let from = 0
  let last = -1
  let gaps = 0
  const marks: [number, number][] = []
  for (const ch of needle) {
    const j = t.indexOf(ch, from)
    if (j < 0) return null
    if (last >= 0 && j > last + 1) gaps += 1
    marks.push([j, j + 1])
    last = j
    from = j + 1
  }
  if (gaps > needle.length / 2) return null
  return { score: Math.max(6, 30 - gaps * 5), marks: mark(marks) }
}

/**
 * Does the query read as a question rather than a name? Then Enter asks.
 * "sql joins" names a lesson; "why do joins duplicate rows" doesn't.
 */
const QUESTION =
  /^(what|why|how|when|where|who|which|can|could|should|explain|summari[sz]e|quiz|make|write|help|plan|tell|give|is|are|do|does)\b/

export function looksLikeQuestion(q: string): boolean {
  const text = q.trim().toLowerCase()
  if (text.endsWith('?')) return true
  if (QUESTION.test(text)) return true
  return text.split(/\s+/).length >= 5
}

/* -- What the palette knows ------------------------------------------------ */

export interface PaletteContext {
  now: number
  /** Quiet AI: no Ask row, no AI commands. */
  quiet: boolean
  /** The course on screen: offered by name ("New page in Databases"), never assumed. */
  subjectId: string | null
  /** The learner's chats, newest first (`useAiThread().threads`). */
  threads: AiThread[]
}

interface Command {
  id: string
  title: string
  icon: string
  keywords: string
  kbd?: string
  verb?: string
  action: PaletteAction
  ai?: boolean
}

const go = (to: string): PaletteAction => ({ type: 'go', to })

/** A new chat's address as one string, for a `go` row. */
export function chatHref(options: NewChatOptions): string {
  const { path, query } = newChatLink(options)
  const search = new URLSearchParams(query).toString()
  return search ? `${path}?${search}` : path
}

/** The app's own commands, found by their words and a few a learner might use instead. */
function commands(quiet: boolean): Command[] {
  const list: Command[] = [
    {
      id: 'new-chat',
      title: 'New chat',
      icon: 'chat',
      kbd: '⌥Space',
      verb: 'Start',
      keywords: 'ask ai assistant conversation question new',
      action: { type: 'new-chat' },
    },
    { id: 'today', title: 'Go to Today', icon: 'home', kbd: 'g t', keywords: 'home plan day', action: go('/app') },
    // Tasks and grades.
    {
      id: 'tasks',
      title: 'Go to Tasks',
      icon: 'check-circle',
      kbd: 'g d',
      keywords: 'to do todo list deadlines due homework',
      action: go('/app/tasks'),
    },
    {
      id: 'courses',
      title: 'Go to Courses',
      icon: 'workspace',
      kbd: 'g c',
      keywords: 'subjects classes modules',
      action: go('/app/courses'),
    },
    {
      id: 'notes',
      title: 'Go to Notes',
      icon: 'notebook',
      kbd: 'g n',
      keywords: 'pages boards notebook',
      action: go('/app/notes'),
    },
    {
      id: 'calendar',
      title: 'Go to Calendar',
      icon: 'calendar',
      kbd: 'g k',
      keywords: 'week timetable schedule deadlines',
      action: go('/app/calendar'),
    },
    {
      id: 'practice',
      title: 'Practise flashcards',
      icon: 'cards',
      keywords: 'review cards spaced repetition revise',
      action: go('/app/practice'),
    },
    {
      id: 'paste',
      title: 'Paste a message',
      icon: 'paste',
      verb: 'Paste',
      keywords: 'group chat email announcement deadline moved',
      action: { type: 'capture', mode: 'paste' },
    },
    {
      id: 'connect',
      title: 'Integrations',
      icon: 'plug',
      keywords: 'connect your school moodle classroom timetable ics calendar google drive notion youtube quizlet obsidian telegram whatsapp chatgpt claude connected apps',
      action: go('/app/settings?section=integrations'),
    },
    {
      id: 'toggle-ai',
      title: 'Open or close Bili',
      icon: 'spark',
      kbd: '⌘J',
      verb: 'Toggle',
      keywords: 'ai panel assistant chat',
      action: { type: 'command', id: 'toggle-ai' },
      ai: true,
    },
    {
      id: 'quiet-ai',
      title: quiet ? 'Turn Quiet AI off' : 'Turn Quiet AI on',
      icon: 'sliders',
      verb: quiet ? 'Turn off' : 'Turn on',
      keywords: 'hide ai buttons assistant quiet off on',
      action: { type: 'command', id: 'quiet-ai' },
    },
    useFocus().state.value
      ? {
          id: 'focus',
          title: 'Stop the focus timer',
          icon: 'timer',
          verb: 'Stop',
          keywords: 'pomodoro timer focus break end',
          action: { type: 'command', id: 'focus' },
        }
      : {
          id: 'focus',
          title: `Focus for ${FOCUS_MIN} minutes`,
          icon: 'timer',
          verb: 'Start',
          keywords: 'pomodoro timer focus concentrate study session break',
          action: { type: 'command', id: 'focus' },
        },
    {
      id: 'settings',
      title: 'Settings',
      icon: 'settings',
      keywords: 'preferences account time zone sign out usage limits credits billing plan',
      action: { type: 'command', id: 'settings' },
    },
  ]
  return list.filter((c) => !(quiet && c.ai))
}

function subjectLine(store: CompanionStore, row: { subject_id: string | null } | null): string {
  return store.subjectOf(row)?.title ?? 'My notes'
}

function stamp(item: Item): number {
  return Date.parse(item.updated_at ?? item.created_at ?? '') || 0
}

function edited(item: Item, now: number): string {
  const at = item.updated_at ?? item.created_at
  if (!at) return ''
  const rel = relativeDay(dayKey(at), dayKey(now))
  return rel === 'today' ? `edited ${clock(at)}` : `edited ${rel}`
}

/** An archived course is still found by name (that's how it's found again), and says so. */
function courseRow(store: CompanionStore, s: Subject, m: Match): PaletteRow {
  const steps = s.format === 'path' ? store.pathOf(s.id) : []
  const line =
    s.format === 'path'
      ? `Your own course · ${steps.filter((x) => x.state === 'done').length} of ${steps.length} lessons done`
      : [s.code, s.lecturer].filter(Boolean).join(' · ') || 'School course'
  const meta = s.archived_at ? `Archived · ${line}` : line
  return {
    key: `course:${s.id}`,
    group: 'courses',
    icon: s.format === 'path' ? 'flag' : 'workspace',
    title: s.title,
    marks: m.marks,
    meta,
    color: s.color,
    verb: 'Open',
    action: { type: 'go', to: `/app/courses/${s.id}` },
    score: m.score,
  }
}

function lessonRow(store: CompanionStore, t: Topic, m: Match): PaletteRow {
  const unit = store.get('topics', t.parent_id)
  return {
    key: `topic:${t.id}`,
    group: 'lessons',
    icon: t.node_id ? 'book' : 'path',
    title: t.title,
    marks: m.marks,
    meta: [subjectLine(store, t), unit?.title, t.node_id ? null : 'not written yet'].filter(Boolean).join(' · '),
    color: store.subjectOf(t)?.color,
    verb: 'Open',
    action: { type: 'go', to: topicHref(t) },
    score: m.score,
  }
}

function itemRow(store: CompanionStore, item: Item, m: Match, now: number, group?: PaletteGroup): PaletteRow {
  const isDoc = item.kind === 'page' || item.kind === 'board'
  return {
    key: `item:${item.id}`,
    group: group ?? (item.kind === 'page' ? 'notes' : item.kind === 'board' ? 'boards' : 'files'),
    icon: item.kind === 'page' ? 'page' : itemIcon(item),
    title: item.title || (item.kind === 'board' ? 'Untitled whiteboard' : 'Untitled'),
    marks: m.marks,
    meta: [subjectLine(store, item), store.get('sessions', item.session_id)?.title, isDoc ? edited(item, now) : null]
      .filter(Boolean)
      .join(' · '),
    color: store.subjectOf(item)?.color,
    verb: 'Open',
    action: isDoc ? { type: 'go', to: itemHref(item) } : { type: 'file', itemId: item.id },
    score: m.score,
  }
}

function deadlineRow(store: CompanionStore, d: Deadline, m: Match, now: number): PaletteRow {
  const ahead = d.status === 'upcoming' && d.due_at && Date.parse(d.due_at) > now
  return {
    key: `deadline:${d.id}`,
    group: 'deadlines',
    icon: 'flag',
    title: d.title,
    marks: m.marks,
    meta: [
      subjectLine(store, d),
      d.due_at ? whenLabel(d.due_at, d.all_day) : 'no date yet',
      ahead ? deadlineWords(store, d) : null,
      d.tentative ? 'not confirmed' : null,
    ]
      .filter(Boolean)
      .join(' · '),
    color: store.subjectOf(d)?.color,
    verb: 'Open',
    action: { type: 'go', to: `/app/d/${d.id}` },
    // Past and finished deadlines still answer, below the ones ahead.
    score: m.score - (ahead ? 0 : 20),
  }
}

/** Readiness in words, the checks' way: "not checked yet" until something is; null with no scope. */
function deadlineWords(store: CompanionStore, d: Deadline): string | null {
  const r = store.readinessOf(d)
  return r.total ? readyWords(r.checked ? r.percent : null) : null
}

const CHECK_WORDS = 'check test yourself quiz recall remember cold'

/**
 * "Check yourself" while any topic is due a check, then "Check for Quiz 2"
 * for each deadline in the next fortnight whose scope has one due, two at
 * most. Both open `/app/check`, which picks the questions.
 */
function checkRows(store: CompanionStore, now: number): PaletteRow[] {
  const due = dueTopics(store)
  if (!due.length) return []
  const names = due.slice(0, 2).map((d) => d.topic.title)
  const rows: PaletteRow[] = [
    {
      key: 'check',
      group: 'suggested',
      icon: 'check-circle',
      title: 'Check yourself',
      meta: [
        due.length > 2 ? `${names.join(', ')} and ${due.length - 2} more` : names.join(' and '),
        `${sittingSize(due.length, 'cold').questions} questions`,
        'no notes, no help',
      ].join(' · '),
      verb: 'Start',
      action: { type: 'go', to: checkHref() },
      score: 85,
    },
  ]
  for (const d of deadlinesWithin(store, now, 14)) {
    const n = dueTopics(store, { deadlineId: d.id }).length
    if (!n) continue
    rows.push({
      key: `check:${d.id}`,
      group: 'suggested',
      icon: 'check-circle',
      title: `Check for ${d.title}`,
      meta: [store.subjectOf(d)?.title, whenLabel(d.due_at!, d.all_day), `${plural(n, 'topic')} ready to check`]
        .filter(Boolean)
        .join(' · '),
      color: store.subjectOf(d)?.color,
      verb: 'Start',
      action: { type: 'go', to: checkHref({ deadlineId: d.id }) },
      score: 84,
    })
    if (rows.length === 3) break
  }
  return rows
}

function classRow(store: CompanionStore, s: Session, m: Match, now: number): PaletteRow {
  const notes = notesOf(store, s)
  const ended = Date.parse(s.ends_at) <= now
  return {
    key: `class:${s.id}`,
    group: 'classes',
    icon: isStudy(store, s) ? 'book' : 'cap',
    title: s.title,
    marks: m.marks,
    meta: [
      subjectLine(store, s),
      `${dayLabel(dayKey(s.starts_at))} ${clock(s.starts_at)}`,
      s.location,
      notes ? 'your notes' : null,
    ]
      .filter(Boolean)
      .join(' · '),
    color: store.subjectOf(s)?.color,
    verb: notes ? 'Open notes' : ended ? 'Open class' : 'Take notes',
    action: notes
      ? { type: 'go', to: itemHref(notes) }
      : ended
        ? { type: 'go', to: classHref(s) }
        : { type: 'page', subjectId: s.subject_id, sessionId: s.id, template: 'lecture' },
    // The nearer a class is to now, the likelier it is the one meant.
    score: m.score - Math.min(15, Math.abs(Date.parse(s.starts_at) - now) / (2 * 86_400_000)),
  }
}

/** "New chat": the palette's first row, empty or not, with the AI's mark. */
function newChatRow(): PaletteRow {
  return {
    key: 'new-chat',
    group: 'ask',
    icon: 'spark',
    title: 'New chat',
    meta: 'Ask, plan a course, or hand it your files',
    verb: 'Start',
    kbd: '⌥Space',
    action: { type: 'new-chat' },
    score: 0,
  }
}

function chatRow(t: AiThread, m: Match, now: number): PaletteRow {
  const key = dayKey(t.updated_at)
  const rel = relativeDay(key, dayKey(now))
  return {
    key: `chat:${t.id}`,
    group: 'chats',
    icon: 'chat',
    title: t.title || 'New chat',
    marks: m.marks,
    meta: [t.has_proposal ? 'Drafted a course' : 'Chat', rel === 'today' ? clock(t.updated_at) : rel].join(' · '),
    verb: 'Open',
    action: { type: 'go', to: chatPath(t.id) },
    score: m.score,
  }
}

/** What a kind of note is called on its own row, where "Page" alone would read as a result. */
const NOTE_TITLE: Partial<Record<NewKind, string>> = { page: 'New page', board: 'New whiteboard' }

/** Words a learner might type for each kind, besides its name. */
const NOTE_WORDS: Record<NewKind, string> = {
  page: 'note page document write blank',
  board: 'whiteboard board draw canvas sketch',
  upload: 'upload file pdf slides document attach',
  link: 'link url article video website bookmark',
  record: 'record audio lecture class transcript voice microphone',
  photo: 'scan photo camera picture image board',
  draft: 'draft ai write generate note',
  // recording
  screen: 'record screen video slides board demo narrate desktop',
  // imports
  notion: 'notion import export zip pages workspace assignments tracker bring',
}

/** A typed address, so "Add link" can take it as it is. */
function asUrl(q: string): string | null {
  const text = q.trim()
  if (/\s/.test(text)) return null
  if (/^https?:\/\/\S+\.\S+/i.test(text)) return text
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(text) ? `https://${text}` : null
}

/**
 * What can be made, as rows: Notes' "+" kinds in Notes' own words and
 * order (`NEW_NOTE_TYPES`), each going to My notes, and a course, which is
 * planned in the chat. On a course's own screen one more row names it:
 * "New page in Databases". Typing adds the templates ("Cornell page", "Mind
 * map") and, for an address, "Add link". Each comes with the words that
 * find it, so "board" finds the whiteboard.
 */
function makeRows(store: CompanionStore, ctx: PaletteContext, q = ''): { row: PaletteRow; words: string }[] {
  const course = store.get('subjects', ctx.subjectId)
  const url = asUrl(q)
  const rows: { row: PaletteRow; words: string }[] = []
  for (const type of NEW_NOTE_TYPES) {
    if (type.key === 'draft' && ctx.quiet) continue
    // A link needs its address: offered once one has been typed.
    if (type.key === 'link' && !url) continue
    // recording: "Record screen" is the desktop app's alone
    if (!offered(type)) continue
    rows.push({
      words: NOTE_WORDS[type.key],
      row: {
        key: `note:${type.key}`,
        group: 'create',
        icon: type.icon,
        title: type.key === 'link' && url ? `Add link ${url.replace(/^https?:\/\//, '')}` : (NOTE_TITLE[type.key] ?? type.label),
        meta: type.hint,
        verb: type.key === 'upload' || type.key === 'photo' ? 'Choose' : type.key === 'record' || type.key === 'screen' ? 'Record' : 'Create',
        action: { type: 'note', kind: type.key, url: type.key === 'link' ? (url ?? undefined) : undefined },
        score: 0,
      },
    })
    if (type.key === 'page' && course) {
      rows.push({
        words: `note page ${course.title}`,
        row: {
          key: 'new-page-here',
          group: 'create',
          icon: 'page',
          title: `New page in ${course.title}`,
          meta: 'Filed in this course',
          color: course.color,
          verb: 'Create',
          action: { type: 'page', subjectId: course.id, sessionId: null, template: 'blank' },
          score: 0,
        },
      })
    }
    // The templates only answer a search: an empty palette lists kinds, not shapes.
    if (q.trim()) {
      for (const template of type.templates ?? []) {
        const board = type.key === 'board'
        rows.push({
          words: `${template.label} ${type.label} ${NOTE_WORDS[type.key]}`,
          row: {
            key: `note:${type.key}:${template.key}`,
            group: 'create',
            icon: type.icon,
            title: board ? `New ${template.label.toLowerCase()}` : `New ${template.label.toLowerCase()} page`,
            meta: `A ${board ? 'whiteboard' : 'page'} from the ${template.label} template`,
            verb: 'Create',
            action: { type: 'note', kind: type.key, template: template.key },
            score: 0,
          },
        })
      }
    }
  }
  rows.push({
    words: 'course learn goal plan create',
    row: {
      key: 'new-course',
      group: 'create',
      icon: 'plus',
      title: 'New course',
      meta: 'Planned with you in a chat, from a goal, files or your school',
      verb: 'Create',
      action: go(chatHref({ intent: 'course' })),
      score: 0,
    },
  })
  return rows
}

/* -- Building the list ---------------------------------------------------- */

/** The palette with nothing typed: what comes next, and what can be made. */
function predicted(store: CompanionStore, ctx: PaletteContext, recentQueries: string[]): PaletteSection[] {
  const { now } = ctx
  const suggested: PaletteRow[] = []

  const live = classNow(store, now)
  if (live && !isStudy(store, live)) {
    const notes = notesOf(store, live)
    const course = store.subjectOf(live)
    const started = Date.parse(live.starts_at) <= now
    suggested.push({
      key: `take-notes:${live.id}`,
      group: 'suggested',
      icon: 'pencil',
      title: notes ? `Open your notes from ${live.title}` : `Take notes in ${course?.title ?? 'class'} · ${live.title}`,
      meta: [started ? 'In class now' : `Starts ${untilLabel(live.starts_at, now)}`, live.location]
        .filter(Boolean)
        .join(' · '),
      color: course?.color,
      verb: notes ? 'Open' : 'Start',
      action: notes
        ? { type: 'go', to: itemHref(notes) }
        : { type: 'page', subjectId: live.subject_id, sessionId: live.id, template: 'lecture' },
      score: 100,
    })
  }

  const lesson = lessonNow(store, dayKey(now))
  if (lesson) {
    suggested.push({
      key: `continue:${lesson.topic.id}`,
      group: 'suggested',
      icon: 'play',
      title: `Continue ${lesson.topic.title}`,
      meta: [lesson.subject.title, lesson.planned ? "on today's plan" : 'next on your path'].join(' · '),
      color: lesson.subject.color,
      verb: 'Continue',
      action: { type: 'go', to: topicHref(lesson.topic) },
      score: 90,
    })
  }

  suggested.push(...checkRows(store, now))

  const due = deadlinesWithin(store, now, 14)[0]
  if (due?.due_at) {
    suggested.push({
      key: `practice:${due.id}`,
      group: 'suggested',
      icon: 'cards',
      title: `Practice for ${due.title}`,
      meta: [store.subjectOf(due)?.title, whenLabel(due.due_at, due.all_day), deadlineWords(store, due)]
        .filter(Boolean)
        .join(' · '),
      color: store.subjectOf(due)?.color,
      verb: 'Practise',
      action: { type: 'go', to: `/app/practice?deadline=${due.id}` },
      score: 80,
    })
  }

  // Changes that wait for a yes, answered on Today.
  const waiting = store.pendingSignals.value.length
  if (waiting) {
    suggested.push({
      key: 'waiting',
      group: 'suggested',
      icon: 'bell',
      title: waiting === 1 ? '1 thing waiting for your OK' : `${waiting} things waiting for your OK`,
      meta: 'On Today',
      verb: 'Check',
      action: { type: 'go', to: '/app' },
      score: 70,
    })
  }

  const docs = store.items.value
    .filter((i) => i.kind === 'page' || i.kind === 'board')
    .sort((a, b) => stamp(b) - stamp(a))
    .slice(0, 3)
  for (const item of docs) suggested.push(itemRow(store, item, { score: 50, marks: [] }, now, 'suggested'))

  const chats: PaletteRow[] = ctx.threads.slice(0, 3).map((t) => chatRow(t, { score: 0, marks: [] }, now))
  const create = makeRows(store, ctx).map((m) => m.row)

  const sections: PaletteSection[] = [{ group: 'ask', label: GROUP_LABEL.ask, rows: [newChatRow()] }]
  if (suggested.length) sections.push({ group: 'suggested', label: GROUP_LABEL.suggested, rows: suggested })
  if (chats.length) sections.push({ group: 'chats', label: 'Recent chats', rows: chats })
  sections.push({ group: 'create', label: GROUP_LABEL.create, rows: create })
  if (recentQueries.length) {
    sections.push({
      group: 'recent',
      label: GROUP_LABEL.recent,
      rows: recentQueries.slice(0, 3).map((q) => ({
        key: `recent:${q}`,
        group: 'recent' as const,
        icon: 'time',
        title: q,
        verb: 'Search',
        action: { type: 'query' as const, text: q },
        score: 0,
      })),
    })
  }
  return sections
}

const LIMIT: Partial<Record<PaletteGroup, number>> = {
  courses: 4,
  lessons: 5,
  notes: 5,
  boards: 4,
  deadlines: 4,
  files: 4,
  classes: 4,
  chats: 4,
  commands: 5,
}

const ORDER: PaletteGroup[] = [
  'commands',
  'courses',
  'lessons',
  'notes',
  'boards',
  'chats',
  'deadlines',
  'classes',
  'files',
]

/** Everything that answers `q`, grouped, each group in its best-first order. */
function searched(store: CompanionStore, q: string, ctx: PaletteContext): PaletteSection[] {
  const { now } = ctx
  const found: PaletteRow[] = []
  const add = (row: PaletteRow | null) => row && found.push(row)

  for (const s of store.subjects.value) {
    const m = match(q, s.title, [s.code, s.lecturer, store.goalOf(s)?.title].filter(Boolean).join(' '))
    if (m) add(courseRow(store, s, m))
  }
  for (const t of store.topics.value) {
    const m = match(q, t.title, `${subjectLine(store, t)} ${store.get('topics', t.parent_id)?.title ?? ''}`)
    if (m) add(lessonRow(store, t, m))
  }
  for (const item of store.items.value) {
    const kind = item.kind === 'board' ? 'whiteboard board' : item.kind
    const m = match(q, item.title, `${subjectLine(store, item)} ${kind}`)
    if (m) add(itemRow(store, item, m, now))
  }
  for (const d of store.deadlines.value) {
    if (d.status === 'cancelled') continue
    const m = match(q, d.title, `${subjectLine(store, d)} ${kindWord(d.kind)}`)
    if (m) add(deadlineRow(store, d, m, now))
  }
  // Classes repeat every week: only the fortnight either side of today.
  for (const s of store.sessions.value) {
    if (s.cancelled || Math.abs(Date.parse(s.starts_at) - now) > 14 * 86_400_000) continue
    const m = match(q, s.title, `${subjectLine(store, s)} ${s.location ?? ''} ${dayLabel(dayKey(s.starts_at))}`)
    if (m) add(classRow(store, s, m, now))
  }
  for (const t of ctx.threads) {
    const m = match(q, t.title || '', 'chat conversation')
    if (m && m.score > 30) add(chatRow(t, m, now))
  }
  for (const row of checkRows(store, now)) {
    const m = match(q, row.title, CHECK_WORDS)
    if (m) add({ ...row, group: 'commands', marks: m.marks, score: m.score })
  }
  for (const c of commands(ctx.quiet)) {
    const m = match(q, c.title, c.keywords)
    if (!m) continue
    found.push({
      key: `command:${c.id}`,
      group: 'commands',
      icon: c.icon,
      title: c.title,
      marks: m.marks,
      kbd: c.kbd,
      verb: c.verb ?? 'Go',
      action: c.action,
      score: m.score,
    })
  }

  const byGroup = new Map<PaletteGroup, PaletteRow[]>()
  for (const row of found) byGroup.set(row.group, [...(byGroup.get(row.group) ?? []), row])
  const one = byGroup.size === 1
  const sections: PaletteSection[] = [...byGroup.entries()].map(([group, rows]) => ({
    group,
    label: GROUP_LABEL[group],
    rows: rows.sort((a, b) => b.score - a.score).slice(0, one ? 10 : (LIMIT[group] ?? 4)),
  }))
  // The group holding the best answer first; equals keep the usual order.
  sections.sort(
    (a, b) => b.rows[0]!.score - a.rows[0]!.score || ORDER.indexOf(a.group) - ORDER.indexOf(b.group),
  )

  // What can be made: a page by this name (in My notes), and any kind of
  // note or a course whose words were typed ("board", "record", "course").
  // A typed address is a link to add, first.
  const kinds = makeRows(store, ctx, q)
    .map(({ row, words }) => ({ row, m: row.key === 'note:link' ? { score: 200, marks: [] } : match(q, row.title, words) }))
    .filter((x): x is { row: PaletteRow; m: Match } => Boolean(x.m && x.m.score >= 30))
    .sort((a, b) => b.m.score - a.m.score)
    .slice(0, 3)
    .map(({ row, m }) => ({ ...row, marks: m.marks }))
  sections.push({
    group: 'create',
    label: GROUP_LABEL.create,
    rows: [
      ...kinds.filter((row) => row.key === 'note:link'),
      {
        key: 'new-page-named',
        group: 'create',
        icon: 'page',
        title: `New page “${q.trim()}”`,
        meta: 'In My notes',
        verb: 'Create',
        action: { type: 'page', subjectId: null, sessionId: null, template: 'blank', title: q.trim() },
        score: 0,
      },
      ...kinds.filter((row) => row.key !== 'note:page' && row.key !== 'note:link'),
    ],
  })
  return sections
}

/**
 * The palette's whole list for a query: predicted rows when it is empty,
 * otherwise "Ask Bili" first and then everything that matched.
 */
export function paletteSections(
  store: CompanionStore,
  q: string,
  ctx: PaletteContext,
  recentQueries: string[],
): PaletteSection[] {
  if (!q.trim()) return predicted(store, ctx, recentQueries)
  const sections = searched(store, q, ctx)
  if (ctx.quiet) return sections
  return [
    {
      group: 'ask',
      label: GROUP_LABEL.ask,
      rows: [
        {
          key: 'ask',
          group: 'ask',
          icon: 'spark',
          title: `Ask Bili: “${q.trim()}”`,
          meta: 'In a new chat, from all your courses and notes',
          verb: 'Ask',
          kbd: '⌘↵',
          action: { type: 'ask', prompt: q.trim() },
          score: 0,
        },
      ],
    },
    ...sections,
  ]
}

/**
 * Which row Enter should take when the list changes: a result that plainly
 * names what was typed, unless it reads as a question; otherwise the first
 * row (Ask, while typing).
 */
export function defaultIndex(sections: PaletteSection[], q: string): number {
  const rows = sections.flatMap((s) => s.rows)
  if (!q.trim() || looksLikeQuestion(q)) return 0
  const best = rows.reduce<{ i: number; score: number }>(
    (top, row, i) =>
      row.group !== 'ask' && row.group !== 'create' && row.score > top.score ? { i, score: row.score } : top,
    // A word-start match (77–85) or better names a result; a letter run inside a word doesn't.
    { i: 0, score: 76 },
  )
  return best.i
}
