// What a client may write to each collection: the hosted API's validation table, as data. Only the fields named here
// are ever stored, so unknown keys (the SPA PATCHes whole rows back) are dropped rather than refused. A field that is
// not `nul` refuses null; `def` is what a create without it gets.
import { validZone } from './zone.ts'
import { wireTime, type Collection } from './store.ts'

export class Invalid extends Error {
  constructor(public errors: Record<string, string[]>) {
    super(Object.values(errors).flat()[0] ?? 'Some of those details need fixing.')
  }
}

export interface Field {
  check?: (value: any) => boolean
  req?: boolean
  nul?: boolean
  def?: unknown
  /** A live row of this collection. */
  ref?: Collection
  norm?: (value: any) => unknown
}
type Opts = Pick<Field, 'req' | 'nul' | 'def'>

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/

const isDay = (v: unknown) => typeof v === 'string' && DAY.test(v) && !Number.isNaN(Date.parse(v))
const isInstant = (v: unknown) => typeof v === 'string' && !Number.isNaN(Date.parse(v))
const isInt = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max
const isUrl = (v: unknown, max: number) => {
  if (typeof v !== 'string' || v.length > max) return false
  try { return Boolean(new URL(v)) } catch { return false }
}
const isObj = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v)

const text = (max: number, o: Opts = {}): Field => ({ ...o, check: (v) => typeof v === 'string' && v.length <= max })
const oneOf = (list: readonly string[], o: Opts = {}): Field => ({ ...o, check: (v) => list.includes(v) })
const int = (min: number, max: number, o: Opts = {}): Field => ({ ...o, check: (v) => isInt(v, min, max) })
const num = (min: number, max: number, o: Opts = {}): Field => ({ ...o, check: (v) => typeof v === 'number' && v >= min && v <= max })
const bool = (o: Opts = {}): Field => ({ ...o, check: (v) => typeof v === 'boolean' })
const day = (o: Opts = {}): Field => ({ ...o, check: isDay })
const instant = (o: Opts = {}): Field => ({ ...o, check: isInstant, norm: wireTime })
const clock = (o: Opts = {}): Field => ({ ...o, check: (v) => typeof v === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(v), norm: (v: string) => v.slice(0, 5) })
const url = (max: number, o: Opts = {}): Field => ({ ...o, check: (v) => isUrl(v, max) })
const ref = (collection: Collection, o: Opts = {}): Field => ({ ...o, ref: collection })
const obj = (o: Opts = {}): Field => ({ ...o, check: isObj })
const list = (max: number, item: (v: any) => boolean, o: Opts = {}): Field => ({ ...o, check: (v) => Array.isArray(v) && v.length <= max && v.every(item) })

const NUL = { nul: true }
const CONFIDENCES = ['official', 'heard', 'shared', 'own']
const COLORS = ['db', 'net', 'prg', 'mth', 'seg', 'eng', 'ita', 'c8']
const SOURCE_KINDS = ['moodle', 'teams', 'canvas', 'ics', 'email', 'transcript', 'share', 'classmate', 'user', 'photo', 'pdf']
const FACT_TYPES = ['deadline.create', 'deadline.update', 'deadline.cancel', 'session.cancel', 'session.move', 'slot.create', 'note']

export const RULES: Record<Exclude<Collection, 'checks'>, Record<string, Field>> = {
  goals: {
    title: text(200, { req: true }),
    kind: oneOf(['term', 'self'], { req: true }),
    starts_on: day(NUL),
    ends_on: day(NUL),
    weeks: list(60, (w) => isObj(w) && isInt(w.n, 0, 60) && isDay(w.starts_on), NUL),
    breaks: list(20, (b) => isObj(b) && isDay(b.starts_on) && isDay(b.ends_on), NUL),
    exam_period: { nul: true, check: (v) => isObj(v) && isDay(v.starts_on) && isDay(v.ends_on) },
    finish_kind: oneOf(['exam', 'project', 'date'], NUL),
    finish_label: text(200, NUL),
    sessions_per_week: int(1, 21, NUL),
    minutes_per_session: int(5, 480, NUL),
    timezone: { check: validZone },
    status: oneOf(['active', 'done', 'archived'], { def: 'active' }),
  },
  subjects: {
    goal_id: ref('goals', NUL),
    title: text(200, { req: true }),
    code: text(40, NUL),
    color: { def: 'c8', check: (v) => COLORS.includes(v) || (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v)) },
    lecturer: text(200, NUL),
    source: oneOf(['moodle', 'canvas', 'teams', 'ics', 'manual', 'generated', 'public', 'import'], { def: 'manual' }),
    source_ref: text(500, NUL),
    source_url: url(2000, NUL),
    format: oneOf(['weeks', 'path'], { def: 'weeks' }),
    generated_course_id: { nul: true, check: (v) => Number.isInteger(v) },
    recording_allowed: bool({ def: true }),
    position: int(0, 2 ** 31),
    archived_at: instant(NUL),
    group_name: text(60, NUL),
    try_first: bool({ def: false }),
  },
  slots: {
    subject_id: ref('subjects', { req: true }),
    kind: oneOf(['lecture', 'tutorial', 'lab', 'seminar', 'lesson', 'study'], { req: true }),
    weekday: int(1, 7, { req: true }),
    starts_at: clock({ req: true }),
    ends_at: clock({ req: true }),
    location: text(200, NUL),
    valid_from: day(NUL),
    valid_until: day(NUL),
    source_ref: text(500, NUL),
  },
  sessions: {
    subject_id: ref('subjects', { req: true }),
    slot_id: ref('slots', NUL),
    title: text(200, { req: true }),
    number: int(0, 1000, NUL),
    starts_at: instant({ req: true }),
    ends_at: instant({ req: true }),
    location: text(200, NUL),
    week: int(0, 60, NUL),
    topic_id: ref('topics', NUL),
    cancelled: bool({ def: false }),
    source_ref: text(500, NUL),
  },
  items: {
    subject_id: ref('subjects', NUL),
    session_id: ref('sessions', NUL),
    topic_id: ref('topics', NUL),
    parent_id: ref('items', NUL),
    kind: oneOf(['page', 'board', 'file', 'recording', 'photo', 'link'], { req: true }),
    title: text(500, NUL),
    preview: text(5000, NUL),
    meta: obj(NUL),
    source: oneOf(['made', 'moodle', 'canvas', 'ics', 'email', 'share', 'generated', 'import'], { def: 'made' }),
    source_ref: text(500, NUL),
    position: int(0, 2 ** 31),
    pinned: bool({ def: false }),
    // Compaction: the client's merged Yjs state, and the last update it already contains. Never part of the row.
    snapshot: { nul: true, check: (v) => typeof v === 'string' && v.length <= 16_000_000 && BASE64.test(v) },
    merged_through: { nul: true, check: (v) => typeof v === 'string' && UUID.test(v) },
  },
  topics: {
    subject_id: ref('subjects', { req: true }),
    parent_id: ref('topics', NUL),
    title: text(300, { req: true }),
    position: int(0, 2 ** 31),
    summary: text(5000, NUL),
    source: oneOf(['extracted', 'generated', 'manual', 'moodle'], { def: 'manual' }),
    weight: num(0, 1000, NUL),
    node_id: { nul: true, check: (v) => Number.isInteger(v) },
  },
  deadlines: {
    subject_id: ref('subjects', { req: true }),
    kind: oneOf(['assignment', 'quiz', 'lab', 'midterm', 'final', 'exam', 'project', 'presentation', 'milestone', 'other'], { req: true }),
    title: text(300, { req: true }),
    due_at: instant(NUL),
    all_day: bool({ def: false }),
    weight_pct: num(0, 100, NUL),
    location: text(200, NUL),
    status: oneOf(['upcoming', 'submitted', 'done', 'missed', 'cancelled'], { def: 'upcoming' }),
    confidence: oneOf(CONFIDENCES, { def: 'own' }),
    confirmed: bool({ def: false }),
    scope_note: text(2000, NUL),
    grade: { nul: true, check: (v) => typeof v === 'number' },
    source_ref: text(500, NUL),
    topic_ids: list(200, (id) => typeof id === 'string' && UUID.test(id), { def: [] }),
    sources: list(20, (s) => isObj(s) && SOURCE_KINDS.includes(s.kind) && CONFIDENCES.includes(s.confidence), { def: [] }),
  },
  cards: {
    subject_id: ref('subjects', NUL),
    topic_id: ref('topics', NUL),
    item_id: ref('items', NUL),
    kind: oneOf(['basic', 'cloze', 'question'], { def: 'basic' }),
    front: text(5000, { req: true }),
    back: text(10000, NUL),
    source_quote: text(5000, NUL),
    fsrs: obj(NUL),
    due_at: instant(NUL),
    last_review_at: instant(NUL),
    suspended: bool({ def: false }),
  },
  'plan-tasks': {
    date: day({ req: true }),
    subject_id: ref('subjects', NUL),
    deadline_id: ref('deadlines', NUL),
    topic_id: ref('topics', NUL),
    item_id: ref('items', NUL),
    kind: oneOf(['review', 'read', 'practice', 'prepare', 'lesson', 'work', 'own', 'check'], { req: true }),
    title: text(300, { req: true }),
    detail: text(1000, NUL),
    minutes: int(1, 600, { req: true }),
    position: int(0, 2 ** 31, { def: 0 }),
    done_at: instant(NUL),
  },
  signals: {
    channel: oneOf(['email', 'share', 'transcript', 'ics', 'moodle', 'photo', 'pdf', 'telegram', 'manual'], { req: true }),
    raw_excerpt: text(20000, { req: true }),
    item_id: ref('items', NUL),
    at_seconds: int(0, 2 ** 31, NUL),
    subject_id: ref('subjects', NUL),
    facts: list(50, (f) => isObj(f) && FACT_TYPES.includes(f.type), { def: [] }),
    confidence: oneOf(CONFIDENCES, { req: true }),
    // Applying writes the rows, so a status edit could only claim it had happened.
    status: oneOf(['pending', 'dismissed'], { def: 'pending' }),
  },
  connections: {
    kind: oneOf(['ics', 'moodle', 'email', 'teams'], { req: true }),
    label: text(200, { req: true }),
    url: url(2000, NUL),
    site_url: url(2000, NUL),
    token: text(4096, NUL),
    status: oneOf(['ok', 'error', 'pending'], { def: 'pending' }),
    last_synced_at: instant(NUL),
    error: text(2000, NUL),
    meta: obj(NUL),
  },
}

/**
 * The fields a request may set, checked. Strings are trimmed and an empty one is null, as the hosted API's middleware
 * does. `exists` answers whether a referenced row is live.
 */
export function validate(
  collection: keyof typeof RULES,
  input: Record<string, unknown>,
  creating: boolean,
  exists: (c: Collection, id: string) => boolean,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const errors: Record<string, string[]> = {}
  const bad = (field: string, why: string) => { errors[field] = [why] }

  for (const [field, rule] of Object.entries(RULES[collection])) {
    if (!(field in input)) {
      if (creating && rule.req) bad(field, `The ${field} field is required.`)
      continue
    }
    let value = input[field]
    if (typeof value === 'string') value = value.trim()
    if (value === '' || value === undefined) value = null

    if (value === null) {
      if (rule.nul) out[field] = null
      else bad(field, `The ${field} field is required.`)
    } else if (rule.ref) {
      if (typeof value === 'string' && UUID.test(value) && exists(rule.ref, value)) out[field] = value
      else bad(field, `The selected ${field} is invalid.`)
    } else if (rule.check && !rule.check(value)) {
      bad(field, `The ${field} field is invalid.`)
    } else {
      out[field] = rule.norm ? rule.norm(value) : value
    }
  }

  // A scope may name only live topics of this person's.
  if (Array.isArray(out.topic_ids) && (out.topic_ids as string[]).some((id) => !exists('topics', id))) {
    bad('topic_ids', 'The selected topic_ids is invalid.')
  }
  if (Object.keys(errors).length) throw new Invalid(errors)
  return out
}
