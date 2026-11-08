/**
 * Making a course out of whatever the learner has (`/app/new`).
 *
 * One sentence and any pile of material — slides, a syllabus, links, pasted
 * text, a Moodle course, a calendar link — go to the server once, and a
 * `CourseProposal` comes back: the course's name and kind, its finish line,
 * a path of units and topics, the deadlines it found, and which sources it
 * actually read. The learner edits that on one screen and presses Create;
 * nothing exists before that press except the uploaded files, which sit in
 * Notes (no course) until the course claims them.
 *
 * This file is the screen's logic, kept out of the SFCs:
 *
 *  - `CourseProposal`, the wire shape both endpoints share (backend
 *    `POST /api/companion/courses/propose` and `POST /api/companion/courses`);
 *  - the composer's attachments and what each one sends;
 *  - uploading with real progress (the API's own `upload` has none);
 *  - creating the rows: through the server, or, for a course made from
 *    scratch, through the store's `upsert`, so the course appears in the
 *    rail, Today and the calendar the moment it exists.
 */
import type { Deadline, DeadlineKind, Goal, Item, Slot, Subject, Topic, Uuid } from './types'
import type { CompanionStore } from './store'
import { dayKey, isoWithOffset } from './time'

/* -------------------------------------------------------------------------- */
/* The contract                                                               */
/* -------------------------------------------------------------------------- */

export interface CourseProposal {
  title: string
  /** `school` → a course by week (`format: 'weeks'`); `self` → a path (`format: 'path'`). */
  kind: 'school' | 'self'
  /** One sentence: what you'll be able to do. */
  summary: string
  finish: { kind: 'exam' | 'project' | 'date' | 'none'; label: string; date: string | null }
  minutes_per_week: number | null
  color: string | null
  /** The cover's picture (`course-icons.ts`); only a course made by hand sends one. */
  icon?: string | null
  units: { title: string; topics: { title: string; summary?: string | null }[] }[]
  deadlines: {
    title: string
    kind: string
    /** `YYYY-MM-DD` for an all-day one, else ISO 8601 with an offset. */
    due_at: string | null
    weight_pct?: number | null
    /** The words it was found in, and the file they came from: sent back as the deadline's source. */
    evidence?: string | null
    item_id?: string | null
  }[]
  /**
   * Every file and link that was sent, read or not (`read: false` = couldn't
   * be read); a link's `label` is the URL exactly as sent, `title` its page's.
   */
  sources: {
    label: string
    kind: 'file' | 'link' | 'text'
    item_id?: string | null
    read?: boolean
    title?: string | null
  }[]
}

export type ProposalUnit = CourseProposal['units'][number]
export type ProposalDeadline = CourseProposal['deadlines'][number]

/** The ways a school's courses come in by themselves ("Connect your school"). */
export type ConnectKind = 'moodle' | 'ics' | 'email' | 'photo'

export interface ProposeBody {
  text?: string
  links?: string[]
  item_ids?: string[]
}

/**
 * The course palette (`--c-<token>` in assets/css/companion.css; the same
 * set `courseColor()` knows). A new course takes the first one no other
 * course wears, so two courses never share a dot by accident.
 */
export const COURSE_PALETTE = ['db', 'net', 'prg', 'mth', 'seg', 'eng', 'ita', 'c8'] as const

export function freeColor(taken: (string | null | undefined)[]): string {
  const used = new Set(taken.map(String))
  return COURSE_PALETTE.find((c) => !used.has(c)) ?? 'c8'
}

/* -------------------------------------------------------------------------- */
/* Attachments                                                                */
/* -------------------------------------------------------------------------- */

export type FileState = 'ready' | 'uploading' | 'done' | 'error'

export interface FileAttachment {
  id: string
  kind: 'file'
  /** Null once restored from the session: the bytes are already on the server by then. */
  file: File | null
  name: string
  size: number
  mime: string
  state: FileState
  /** 0–100 while uploading. */
  progress: number
  /** The Notes item the upload made; what the proposal is asked to read. */
  itemId: Uuid | null
  error: string | null
  /** Refused before upload (too big, a kind nothing can read): never sent. */
  refused: boolean
}

export interface LinkAttachment {
  id: string
  kind: 'link'
  url: string
  domain: string
  title: string | null
  /** A course page on a Moodle: drawn with the cap. */
  moodle: boolean
}

export interface TextAttachment {
  id: string
  kind: 'text'
  title: string
  text: string
  words: number
}

/** One of the learner's Moodle courses, already imported: sent as its outline. */
export interface MoodleAttachment {
  id: string
  kind: 'moodle'
  subjectId: Uuid
  title: string
  outline: string
  detail: string
}

export interface CalendarAttachment {
  id: string
  kind: 'calendar'
  url: string
  domain: string
}

export type Attachment =
  | FileAttachment
  | LinkAttachment
  | TextAttachment
  | MoodleAttachment
  | CalendarAttachment

/** What the file picker offers: documents, slides, sheets, images, plain text. */
export const ACCEPT = [
  'application/pdf', '.pdf',
  '.ppt', '.pptx', '.ppsx', '.key', '.odp',
  '.doc', '.docx', '.odt', '.rtf', '.pages',
  '.xls', '.xlsx', '.csv', '.ods',
  '.txt', '.md', '.markdown', '.html', '.htm', '.epub', '.ics',
  'image/*', '.heic',
].join(',')

/** `ItemController::MAX_UPLOAD_KB` on the server. */
export const MAX_FILE_MB = 50

export type FileKind = 'pdf' | 'slides' | 'doc' | 'sheet' | 'image' | 'text' | 'other'

export function fileKind(name: string, mime = ''): FileKind {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic', 'heif'].includes(ext)) return 'image'
  if (['ppt', 'pptx', 'ppsx', 'key', 'odp'].includes(ext)) return 'slides'
  if (['doc', 'docx', 'odt', 'rtf', 'pages', 'epub'].includes(ext)) return 'doc'
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'sheet'
  if (mime.startsWith('text/') || ['txt', 'md', 'markdown', 'html', 'htm', 'ics'].includes(ext)) return 'text'
  return 'other'
}

export const FILE_LOOK: Record<FileKind, { icon: string; word: string; tone: string }> = {
  pdf: { icon: 'file', word: 'PDF', tone: 'text-danger' },
  slides: { icon: 'layers', word: 'Slides', tone: 'text-warn' },
  doc: { icon: 'page', word: 'Document', tone: 'text-sky-ink' },
  sheet: { icon: 'table', word: 'Sheet', tone: 'text-success' },
  image: { icon: 'image', word: 'Image', tone: 'text-success' },
  text: { icon: 'page', word: 'Text', tone: 'text-text-soft' },
  other: { icon: 'file', word: 'File', tone: 'text-text-soft' },
}

/** Why a file can't go, in a few words, or null when it can. */
export function refusal(file: File): string | null {
  if (file.size > MAX_FILE_MB * 1024 * 1024) return `Too big, ${MAX_FILE_MB} MB at most`
  if (file.size === 0) return 'This file is empty'
  if (fileKind(file.name, file.type) === 'other') return 'BiliMind can\'t read this kind of file'
  return null
}

export function fileAttachment(file: File): FileAttachment {
  const why = refusal(file)
  return {
    id: crypto.randomUUID(),
    kind: 'file',
    file,
    name: file.name,
    size: file.size,
    mime: file.type,
    state: why ? 'error' : 'ready',
    progress: 0,
    itemId: null,
    error: why,
    refused: Boolean(why),
  }
}

export function wordsIn(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

/** "Pasted text" unless its first line reads like a name for it. */
export function textAttachment(text: string, id: string = crypto.randomUUID()): TextAttachment {
  const first = text.trim().split('\n')[0]?.trim() ?? ''
  const title = first && first.length <= 48 && !/[.!?]$/.test(first) ? first : 'Pasted text'
  return { id, kind: 'text', title, text: text.trim(), words: wordsIn(text) }
}

const URL_RE = /\b(?:https?:\/\/|webcal:\/\/|www\.)[^\s<>"')\]]+/gi

/** Every link in a stretch of text, tidied (a trailing full stop is prose, not URL). */
export function linksIn(text: string): string[] {
  const found = text.match(URL_RE) ?? []
  return [...new Set(found.map((u) => u.replace(/[.,;:!?]+$/, '')))]
}

/** A pasted URL as one the browser can open, or null when it isn't one. */
export function normaliseUrl(raw: string): string | null {
  const s = raw.trim().replace(/[.,;:!?]+$/, '')
  if (!s) return null
  const withScheme = /^(https?|webcal):\/\//i.test(s) ? s : `https://${s}`
  try {
    const u = new URL(withScheme)
    if (!u.hostname.includes('.')) return null
    return u.toString()
  } catch {
    return null
  }
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function isCalendarUrl(url: string): boolean {
  return url.length < 0
}

export function isMoodleCourseUrl(url: string, sites: string[] = []): boolean {
  if (/\/course\/view\.php\?id=\d+/i.test(url)) return true
  const host = domainOf(url)
  return sites.some((s) => s && domainOf(s) === host)
}

/**
 * The words a link would be called by, when the address says them: a
 * Wikipedia article's name, a GitHub repository, a video, or the last part
 * of the path made readable. Nothing is fetched for this.
 */
export function titleOfUrl(url: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\./, '')
  const parts = u.pathname.split('/').filter(Boolean)
  if (/wikipedia\.org$/.test(host) && parts[0] === 'wiki' && parts[1]) {
    return decodeURIComponent(parts[1]).replace(/_/g, ' ')
  }
  if (host === 'github.com' && parts.length >= 2) return `${parts[0]}/${parts[1]}`
  if (/youtube\.com$|youtu\.be$/.test(host)) return 'A YouTube video'
  if (/docs\.google\.com$/.test(host)) return parts[0] === 'presentation' ? 'Google Slides' : parts[0] === 'spreadsheets' ? 'Google Sheet' : 'Google Doc'
  if (/\/course\/view\.php/.test(u.pathname)) return 'Moodle course'
  const last = parts[parts.length - 1]
  if (!last || /^\d+$/.test(last) || last.length < 3) return null
  const words = decodeURIComponent(last)
    .replace(/\.(html?|php|aspx?)$/i, '')
    .replace(/[-_+]+/g, ' ')
    .trim()
  if (!words || words.length > 60 || /^[a-f0-9]{16,}$/i.test(words)) return null
  return words[0]!.toUpperCase() + words.slice(1)
}

export function linkAttachment(url: string, moodleSites: string[] = []): LinkAttachment | CalendarAttachment {
  const domain = domainOf(url)
  if (isCalendarUrl(url)) return { id: crypto.randomUUID(), kind: 'calendar', url, domain }
  return {
    id: crypto.randomUUID(),
    kind: 'link',
    url,
    domain,
    title: titleOfUrl(url),
    moodle: isMoodleCourseUrl(url, moodleSites),
  }
}

/**
 * One of the learner's imported Moodle courses, written out as an outline
 * the model can read: its weeks' topics and its deadlines. Its files stay
 * where they are: handing their ids over would re-file them under the new
 * course and empty the Moodle one.
 */
export function moodleAttachment(c: CompanionStore, subject: Subject): MoodleAttachment {
  const topics = c.topics.value.filter((t) => t.subject_id === subject.id)
  const deadlines = c.deadlines.value.filter((d) => d.subject_id === subject.id && d.status !== 'cancelled')
  const files = c.items.value.filter((i) => i.subject_id === subject.id && i.kind === 'file')
  const lines = [
    `Moodle course: ${subject.title}${subject.code ? ` (${subject.code})` : ''}${subject.lecturer ? `, taught by ${subject.lecturer}` : ''}`,
    topics.length ? `Topics: ${topics.map((t) => t.title).join('; ')}` : '',
    deadlines.length
      ? `Deadlines: ${deadlines.map((d) => `${d.title} (${d.kind}${d.due_at ? `, ${d.due_at.slice(0, 10)}` : ''})`).join('; ')}`
      : '',
    files.length ? `Files: ${files.slice(0, 40).map((f) => f.title).join('; ')}` : '',
  ]
  const bits = [
    topics.length ? `${topics.length} topics` : '',
    files.length ? `${files.length} files` : '',
    deadlines.length ? `${deadlines.length} deadlines` : '',
  ].filter(Boolean)
  return {
    id: crypto.randomUUID(),
    kind: 'moodle',
    subjectId: subject.id,
    title: subject.title,
    outline: lines.filter(Boolean).join('\n'),
    detail: bits.join(' · ') || 'Moodle course',
  }
}

/* -------------------------------------------------------------------------- */
/* The request                                                                */
/* -------------------------------------------------------------------------- */

/**
 * What goes to the model. Pasted text and Moodle outlines ride along in
 * `text` under a heading each, so the model can tell the learner's own
 * sentence from the material; calendar links go with the other links.
 */
export function proposeBody(sentence: string, attachments: Attachment[]): ProposeBody {
  // Moodle outlines before pasted text: the server reads the first 60k
  // characters, and a long paste shouldn't push a short outline past that.
  const blocks = [sentence.trim()]
  const pasted: string[] = []
  const links: string[] = []
  const items: string[] = []
  for (const a of attachments) {
    if (a.kind === 'text') pasted.push(`--- Pasted text: ${a.title} ---\n${a.text}`)
    else if (a.kind === 'moodle') blocks.push(`--- ${a.outline}`)
    else if (a.kind === 'link' || a.kind === 'calendar') links.push(a.url)
    else if (a.kind === 'file' && a.itemId) items.push(a.itemId)
  }
  blocks.push(...pasted)
  const text = blocks.filter(Boolean).join('\n\n')
  return {
    ...(text ? { text } : {}),
    ...(links.length ? { links } : {}),
    ...(items.length ? { item_ids: items } : {}),
  }
}

/** Something to build from: words, or one attachment that can actually be sent. */
export function hasMaterial(sentence: string, attachments: Attachment[]): boolean {
  return sentence.trim().length > 0 || attachments.some((a) => a.kind !== 'file' || !a.refused)
}

/* -------------------------------------------------------------------------- */
/* What the building screen says                                              */
/* -------------------------------------------------------------------------- */

export interface BuildStep {
  key: string
  label: string
  /** The attachment this step reads, so its upload's progress can show on it. */
  attachmentId?: string
}

/** One step per source, in the order given, then the three the model does for every course. */
export function buildSteps(sentence: string, attachments: Attachment[]): BuildStep[] {
  const steps: BuildStep[] = []
  if (sentence.trim()) steps.push({ key: 'sentence', label: 'Reading what you wrote' })
  for (const a of attachments) {
    if (a.kind === 'file' && !a.refused) steps.push({ key: a.id, label: `Reading ${a.name}`, attachmentId: a.id })
    else if (a.kind === 'link') steps.push({ key: a.id, label: `Opening ${a.title ?? a.domain}` })
    else if (a.kind === 'text') steps.push({ key: a.id, label: `Reading ${a.title === 'Pasted text' ? 'your pasted text' : a.title}` })
    else if (a.kind === 'moodle') steps.push({ key: a.id, label: `Going through ${a.title} on Moodle` })
    else if (a.kind === 'calendar') steps.push({ key: a.id, label: 'Reading your calendar' })
  }
  steps.push(
    { key: 'deadlines', label: 'Finding the deadlines' },
    { key: 'path', label: 'Drawing your path' },
    { key: 'pace', label: 'Fitting it into your week' },
  )
  return steps
}

/* -------------------------------------------------------------------------- */
/* Uploading, with progress                                                   */
/* -------------------------------------------------------------------------- */

/**
 * `POST /companion/items/upload` through XHR, because `fetch` can't report
 * upload progress and a 30 MB slide deck on campus Wi-Fi needs a bar. Same
 * bearer token and `{ data }` envelope as `useApi`; no subject, so the file
 * lands in Notes until the course is made and claims it.
 */
export function uploadWithProgress(opts: {
  url: string
  token: string | null
  file: File
  onProgress: (percent: number) => void
  signal?: AbortSignal
}): Promise<Item> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', opts.url)
    xhr.setRequestHeader('Accept', 'application/json')
    if (opts.token) xhr.setRequestHeader('Authorization', `Bearer ${opts.token}`)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) opts.onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)))
    }
    xhr.onload = () => {
      let body: { data?: Item; message?: string; errors?: Record<string, string[]> } | null = null
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        body = null
      }
      if (xhr.status >= 200 && xhr.status < 300 && body?.data) {
        opts.onProgress(100)
        resolve(body.data)
        return
      }
      const said = body?.errors ? Object.values(body.errors).flat()[0] : body?.message
      reject(new Error(xhr.status === 413 ? `Too big, ${MAX_FILE_MB} MB at most` : said || 'Didn\'t upload'))
    }
    xhr.onerror = () => reject(new Error('Didn\'t upload. Check the connection'))
    xhr.onabort = () => reject(new DOMException('Cancelled', 'AbortError'))
    opts.signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    const form = new FormData()
    form.append('file', opts.file)
    xhr.send(form)
  })
}

/* -------------------------------------------------------------------------- */
/* Creating the course from rows (a course made from scratch)               */
/* -------------------------------------------------------------------------- */

const DEADLINE_KINDS: DeadlineKind[] = [
  'assignment', 'quiz', 'lab', 'midterm', 'final', 'exam', 'project', 'presentation', 'milestone', 'other',
]

export function deadlineKind(kind: string): DeadlineKind {
  return (DEADLINE_KINDS as string[]).includes(kind) ? (kind as DeadlineKind) : 'other'
}

/**
 * A week's minutes as sessions: about half an hour each, two to six of
 * them, so a busy week still has a rhythm and a big one isn't one long sit.
 */
export function splitMinutes(perWeek: number | null): { sessions: number; minutes: number } {
  const total = perWeek && perWeek > 0 ? perWeek : 120
  const sessions = Math.min(6, Math.max(2, Math.round(total / 30)))
  const minutes = Math.max(15, Math.round(total / sessions / 5) * 5)
  return { sessions, minutes }
}

/** A day key and a clock time as the contract's ISO with offset, in this device's zone. */
export function dueIso(date: string, time = '23:59'): string {
  const [h, m] = time.split(':').map(Number)
  return isoWithOffset(new Date(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), h ?? 23, m ?? 59))
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = (h ?? 0) * 60 + (m ?? 0) + minutes
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/**
 * Study times around the timetable (the old /app/start's rule): the free
 * evenings at 20:00 first, then a later hour on evenings that already have
 * a class, as many as the week's sessions.
 */
export function studyTimes(c: CompanionStore, sessions: number): { weekday: Slot['weekday']; at: string }[] {
  const busy = new Set(c.slots.value.filter((s) => s.starts_at >= '18:00').map((s) => s.weekday))
  const order: Slot['weekday'][] = [1, 3, 4, 6, 2, 5, 7]
  const free = order.filter((d) => !busy.has(d)).map((weekday) => ({ weekday, at: '20:00' }))
  const late = order.filter((d) => busy.has(d)).map((weekday) => ({ weekday, at: '21:00' }))
  return [...free, ...late].slice(0, sessions).sort((a, b) => a.weekday - b.weekday)
}

/**
 * The rows the server's `POST /companion/courses` would make, made here
 * through the store instead: a goal (or the term's, for a school course),
 * the course, its units and topics, its deadlines; the uploaded files
 * re-filed under it and a link item per link. Units go in before their
 * topics so a topic never points at a parent that isn't there yet.
 */
export async function createLocally(
  c: CompanionStore,
  proposal: CourseProposal,
  extra: { itemIds: Uuid[]; links: { url: string; title: string }[] },
): Promise<{ subjectId: Uuid; goalId: Uuid }> {
  const school = proposal.kind === 'school'
  const term = school ? c.termGoal.value : null
  const { sessions, minutes } = splitMinutes(proposal.minutes_per_week)
  const finishKind = proposal.finish.kind === 'none' ? null : proposal.finish.kind

  let goalId = term?.id ?? null
  if (!goalId) {
    goalId = crypto.randomUUID()
    await c.upsert<Goal>('goals', {
      id: goalId,
      title: proposal.title,
      kind: school ? 'term' : 'self',
      starts_on: dayKey(),
      ends_on: proposal.finish.date,
      weeks: null,
      breaks: null,
      exam_period: null,
      finish_kind: finishKind,
      finish_label: proposal.finish.label || null,
      sessions_per_week: school ? null : sessions,
      minutes_per_session: school ? null : minutes,
      timezone: c.goals.value.find((g) => g.status === 'active')?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      status: 'active',
    })
  }

  const subjectId = crypto.randomUUID()
  await c.upsert<Subject>('subjects', {
    id: subjectId,
    goal_id: goalId,
    title: proposal.title,
    code: null,
    color: proposal.color ?? freeColor(c.subjects.value.map((s) => s.color)),
    icon: proposal.icon ?? null,
    lecturer: null,
    source: school ? 'manual' : 'generated',
    source_ref: null,
    source_url: null,
    format: school ? 'weeks' : 'path',
    generated_course_id: null,
    recording_allowed: true,
    position: c.subjects.value.length,
  })

  // A unit with no title (topics typed by hand before any unit) is no row:
  // its topics sit on the path on their own.
  const units = proposal.units.map((u) => ({ unit: u, id: u.title ? crypto.randomUUID() : null }))
  await Promise.all(
    units.flatMap(({ unit, id }, u) =>
      id
        ? [
            c.upsert<Topic>('topics', {
              id,
              subject_id: subjectId,
              parent_id: null,
              title: unit.title,
              position: u * 100,
              summary: null,
              source: 'generated',
              weight: null,
              node_id: null,
            }),
          ]
        : [],
    ),
  )
  await Promise.all(
    units.flatMap(({ unit, id }, u) =>
      unit.topics.map((t, i) =>
        c.upsert<Topic>('topics', {
          id: crypto.randomUUID(),
          subject_id: subjectId,
          parent_id: id,
          title: t.title,
          position: u * 100 + i + 1,
          summary: t.summary ?? null,
          source: 'generated',
          weight: 1,
          node_id: null,
        }),
      ),
    ),
  )

  await Promise.all(
    proposal.deadlines.map((d) =>
      c.upsert<Deadline>('deadlines', {
        id: crypto.randomUUID(),
        subject_id: subjectId,
        kind: deadlineKind(d.kind),
        title: d.title,
        due_at: d.due_at,
        all_day: d.due_at?.length === 10,
        weight_pct: d.weight_pct ?? null,
        location: null,
        status: 'upcoming',
        confidence: 'own',
        confirmed: true,
        scope_note: null,
        grade: null,
        source_ref: null,
        tentative: false,
        topic_ids: [],
        sources: [],
      }),
    ),
  )

  await Promise.all(extra.itemIds.map((id) => c.upsert<Item>('items', { id, subject_id: subjectId })))
  await Promise.all(
    extra.links.map((l, i) =>
      c.upsert<Item>('items', {
        id: crypto.randomUUID(),
        subject_id: subjectId,
        session_id: null,
        topic_id: null,
        parent_id: null,
        kind: 'link',
        title: l.title,
        preview: null,
        meta: { url: l.url },
        source: 'made',
        source_ref: null,
        position: i,
        pinned: false,
      }),
    ),
  )

  return { subjectId, goalId }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * What both ways of creating leave to the client: the study times of a
 * course on a path (so it shows in the calendar and Today plans it), and
 * each pasted text kept as a page in the course, so the syllabus the learner
 * pasted is still there to read, annotate and ask about.
 */
export async function settleCourse(
  c: CompanionStore,
  subjectId: Uuid,
  proposal: CourseProposal,
  texts: TextAttachment[],
): Promise<void> {
  if (proposal.kind === 'self') {
    const { sessions, minutes } = splitMinutes(proposal.minutes_per_week)
    for (const t of studyTimes(c, sessions)) {
      await c.upsert<Slot>('slots', {
        id: crypto.randomUUID(),
        subject_id: subjectId,
        kind: 'study',
        weekday: t.weekday,
        starts_at: t.at,
        ends_at: addMinutes(t.at, minutes),
        location: null,
        valid_from: dayKey(),
        valid_until: proposal.finish.date,
        source_ref: null,
      }).catch(() => undefined)
    }
  }
  for (const [i, t] of texts.entries()) {
    const html = t.text
      .split(/\n{2,}/)
      .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
      .join('')
    await c.upsert<Item>('items', {
      id: crypto.randomUUID(),
      subject_id: subjectId,
      session_id: null,
      topic_id: null,
      parent_id: null,
      kind: 'page',
      title: t.title,
      preview: t.text.slice(0, 160),
      meta: { seed_html: html },
      source: 'made',
      source_ref: null,
      position: i,
      pinned: false,
    }).catch(() => undefined)
  }
}

/* -------------------------------------------------------------------------- */
/* Keeping the draft across a reload                                          */
/* -------------------------------------------------------------------------- */

/**
 * The screen's state in sessionStorage, so a reload on the review (or a
 * detour to connect Moodle) doesn't throw away what was typed and built.
 * Files that never uploaded can't be kept: there are no bytes to keep.
 */
export interface SavedDraft {
  text: string
  attachments: Attachment[]
  proposal: CourseProposal | null
}

const DRAFT_KEY = 'bm:companion-create'

export function saveDraft(draft: SavedDraft): void {
  try {
    const attachments = draft.attachments
      .filter((a) => a.kind !== 'file' || (a.state === 'done' && a.itemId))
      .map((a) => (a.kind === 'file' ? { ...a, file: null } : a))
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, attachments }))
  } catch {
    // Private mode or full: the screen still works, it just won't survive a reload.
  }
}

export function readDraft(): SavedDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as SavedDraft) : null
  } catch {
    return null
  }
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    // Nothing kept, nothing to clear.
  }
}
