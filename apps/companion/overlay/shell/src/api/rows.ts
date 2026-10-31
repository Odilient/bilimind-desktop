// The generic collections: writes with the few rules a plain save cannot express, filters, and the wire shape.
//   deadlines  always carry a source; a hand edit of a tracked field records one with its change
//   items      a PATCH with `snapshot` compacts the document
//   cards      a new card is ts-fsrs's empty card, due now
//   sessions   a class may not end before it starts
//   subjects   deleting a course tombstones everything filed under it
//   topics     deleting a topic tombstones its checks and leaves deadlines' scopes
//   goals      deleting a goal keeps its courses, released from it
import { computeReadiness } from '../../../app/companion/readiness.ts'
import { lessonsDone } from './lessons/attempts.ts'
import { dropCourse } from './lessons/blocks.ts'
import { Invalid, RULES, UUID, validate } from './rules.ts'
import { wireTime, type Collection, type Row, type Store } from './store.ts'
import { zoneFor } from './zone.ts'

type Writable = keyof typeof RULES

const TRACKED = ['kind', 'title', 'due_at', 'all_day', 'weight_pct', 'location', 'status', 'scope_note']
const BY_HAND = 'Added by you.'
const EDITED_BY_HAND = 'Changed by you.'
const STARTER_REF = 'starter:'

export const ORIGIN = 'app://bilimind'

export function emptyFsrs(at = Date.now()): Record<string, unknown> {
  return { due: new Date(at).toISOString(), stability: 0, difficulty: 0, elapsed_days: 0, scheduled_days: 0, learning_steps: 0, reps: 0, lapses: 0, state: 0 }
}

/** The input every computation on rows reads. */
export function worldOf(store: Store) {
  return {
    topics: store.live('topics') as any[],
    sessions: store.live('sessions') as any[],
    // A finished lesson is study, dated when it was finished, which is what the readiness code reads made things for.
    items: [...store.live('items'), ...store.recs('node').filter((n) => n.progress?.completed_at && n.topic_id)
      .map((n) => ({ id: `lesson:${n.id}`, kind: 'page', source: 'made', topic_id: n.topic_id, session_id: null, updated_at: n.progress.completed_at, deleted_at: null }))] as any[],
    cards: store.live('cards') as any[],
    checks: store.live('checks') as any[],
    deadlines: store.live('deadlines') as any[],
    lessonsDone: lessonsDone(store),
  }
}

/** A row as the SPA's types describe it: what is derived goes on, what is private comes off. */
export function wire(collection: Collection, row: Row): Row {
  if (collection === 'items') return { ...row, file_url: row.meta?.path ? `${ORIGIN}/api/companion-files/${row.id}` : null }
  if (collection === 'subjects') return { ...row, sample: String(row.source_ref ?? '').startsWith(STARTER_REF) }
  if (collection === 'checks') {
    // What would give the answer away stays here until it's marked, when `revealed` carries it.
    const { expected: _expected, rubric: _rubric, material: _material, ...rest } = row
    return rest as Row
  }
  if (collection === 'connections') {
    const { token, ...rest } = row
    return { ...rest, has_token: token != null }
  }
  return row
}

function nextPosition(store: Store, collection: Collection, same: (row: Row) => boolean): number {
  return Math.max(-1, ...store.live(collection).filter(same).map((r) => Number(r.position) || 0)) + 1
}

/** What a create leaves out: each rule's default, null for the rest, then what needs working out. */
function withDefaults(store: Store, collection: Writable, data: Record<string, any>): Record<string, any> {
  const row: Record<string, any> = {}
  for (const [field, rule] of Object.entries(RULES[collection])) row[field] = field in data ? data[field] : rule.def ?? null
  const now = Date.now()
  switch (collection) {
    case 'goals':
      row.timezone ??= zoneFor(store)
      break
    case 'subjects':
      row.position ??= nextPosition(store, 'subjects', () => true)
      break
    case 'topics':
      row.position ??= nextPosition(store, 'topics', (t) => t.subject_id === row.subject_id && (t.parent_id ?? null) === (row.parent_id ?? null))
      break
    case 'items':
      row.position ??= nextPosition(store, 'items', (i) => (i.subject_id ?? null) === (row.subject_id ?? null) && (i.parent_id ?? null) === (row.parent_id ?? null))
      break
    case 'plan-tasks':
      row.generated_at = wireTime(now)
      break
    case 'signals':
      row.applied_at = null
      break
  }
  return row
}

/** Null means empty where the row can't hold null. */
function notNull(collection: Writable, row: Record<string, any>, data: Record<string, any>): void {
  const empty: Record<string, () => unknown> = collection === 'items'
    ? { title: () => '', meta: () => ({}) }
    : collection === 'cards'
      ? { back: () => '', fsrs: () => emptyFsrs(), due_at: () => wireTime(Date.now()) }
      : collection === 'connections' ? { meta: () => ({}) } : {}
  for (const [field, make] of Object.entries(empty)) if (field in data && data[field] === null) row[field] = make()
}

function assertCoherent(collection: Writable, row: Row): void {
  if (collection === 'sessions' && Date.parse(row.ends_at) < Date.parse(row.starts_at)) {
    throw new Invalid({ ends_at: ['A class cannot end before it starts.'] })
  }
}

/** What readiness said on the due date (now, when that hasn't come), or null with nothing checked by then. */
function readinessSaid(store: Store, deadline: Row): number | null {
  const now = Date.now()
  const at = deadline.due_at && Date.parse(deadline.due_at) < now ? Date.parse(deadline.due_at) : now
  const readiness = computeReadiness(deadline as never, worldOf(store) as never, at)
  return readiness.checked > 0 ? readiness.percent : null
}

function settle(deadline: Row): Row {
  return { ...deadline, tentative: (deadline.confidence === 'heard' || deadline.confidence === 'shared') && !deadline.confirmed }
}

function sourceRow(deadlineId: string, source: Record<string, any>, confidence: string, change: unknown): Row {
  const now = wireTime(Date.now())
  return {
    id: crypto.randomUUID(),
    deadline_id: deadlineId,
    kind: source.kind ?? 'user',
    confidence: source.confidence ?? confidence,
    evidence: String(source.evidence ?? ''),
    url: source.url ?? null,
    item_id: source.item_id ?? null,
    at_seconds: source.at_seconds ?? null,
    observed_at: source.observed_at ? wireTime(source.observed_at) : now,
    change: change ?? null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }
}

/** Times compared as instants and booleans as booleans, so "09:00+05:00" and "04:00Z" are no change. */
function comparable(field: string, value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (field === 'due_at') return wireTime(value as string)
  if (field === 'all_day') return Boolean(value)
  if (field === 'weight_pct') return Number(value)
  return String(value)
}

function createDeadline(store: Store, id: string, data: Record<string, any>): Row {
  const row: Row = { ...withDefaults(store, 'deadlines', data), id, readiness_said: null }
  const given = row.sources as Record<string, any>[]
  row.sources = (given.length ? given : [{ kind: 'user', confidence: row.confidence, evidence: BY_HAND }])
    .map((source) => sourceRow(id, source, row.confidence, null))
  if (row.grade !== null) row.readiness_said = readinessSaid(store, row)
  return store.put('deadlines', settle(row))
}

function updateDeadline(store: Store, row: Row, data: Record<string, any>): Row {
  const { sources: _history, ...patch } = data
  const change: Record<string, { from: unknown; to: unknown }> = {}
  for (const field of TRACKED) {
    if (!(field in patch)) continue
    const from = comparable(field, row[field])
    const to = comparable(field, patch[field])
    if (from !== to) change[field] = { from, to }
  }
  const next: Row = { ...row, ...patch }
  if (Object.keys(change).length) {
    next.sources = [...row.sources, sourceRow(row.id, { kind: 'user', confidence: 'own', evidence: EDITED_BY_HAND }, 'own', change)]
  }
  if ('grade' in patch && patch.grade !== row.grade) {
    if (patch.grade === null) next.readiness_said = null
    else if (row.grade === null) next.readiness_said = readinessSaid(store, next)
  }
  return store.put('deadlines', settle(next))
}

function compact(store: Store, itemId: string, snapshot: string | null, mergedThrough: string | null | undefined): void {
  store.db.prepare('INSERT INTO item_snapshots (item_id, snapshot) VALUES (?, ?) ON CONFLICT (item_id) DO UPDATE SET snapshot = excluded.snapshot').run(itemId, snapshot)
  if (!mergedThrough) return
  // An update that arrived while the client was merging is later than this one and survives, so nothing is lost.
  const last = store.db.prepare('SELECT seq FROM item_updates WHERE item_id = ? AND id = ?').get(itemId, mergedThrough) as { seq: number } | undefined
  if (last) store.db.prepare('DELETE FROM item_updates WHERE item_id = ? AND seq <= ?').run(itemId, last.seq)
}

export function createRow(store: Store, collection: Writable, data: Record<string, any>): Row {
  const id = (data.id as string | undefined) ?? crypto.randomUUID()
  if (collection === 'deadlines') return createDeadline(store, id, data)
  const { snapshot, merged_through: mergedThrough, ...fields } = data
  const row = withDefaults(store, collection, fields)
  delete row.snapshot
  delete row.merged_through
  if (collection === 'cards') {
    row.back ??= ''
    row.fsrs ??= emptyFsrs()
    row.due_at ??= wireTime(Date.now())
  }
  if (collection === 'items') {
    row.title ??= ''
    row.meta ??= {}
  }
  if (collection === 'connections') row.meta ??= {}
  const next: Row = { ...row, id }
  assertCoherent(collection, next)
  const saved = store.put(collection, next)
  if (collection === 'items' && snapshot !== undefined) compact(store, id, snapshot, mergedThrough)
  return saved
}

export function updateRow(store: Store, collection: Writable, row: Row, data: Record<string, any>): Row {
  if (collection === 'deadlines') return updateDeadline(store, row, data)
  const { snapshot, merged_through: mergedThrough, ...fields } = data
  if (collection === 'items' && snapshot !== undefined) compact(store, row.id, snapshot, mergedThrough)
  const next: Row = { ...row, ...fields }
  notNull(collection, next, fields)
  assertCoherent(collection, next)
  return store.put(collection, next)
}

export function deleteRow(store: Store, collection: Writable, row: Row): void {
  if (collection === 'subjects') {
    for (const child of ['slots', 'sessions', 'items', 'topics', 'deadlines', 'cards', 'plan-tasks', 'checks'] as const) {
      for (const r of store.live(child)) if (r.subject_id === row.id) store.bury(child, r)
    }
    for (const course of store.recs('course')) if (course.settings?.companion_subject_id === row.id) dropCourse(store, course)
  }
  if (collection === 'topics') {
    for (const check of store.live('checks')) if (check.topic_id === row.id) store.bury('checks', check)
    for (const d of store.live('deadlines')) {
      if (d.topic_ids?.includes(row.id)) store.put('deadlines', { ...d, topic_ids: d.topic_ids.filter((id: string) => id !== row.id) })
    }
  }
  if (collection === 'goals') {
    for (const s of store.live('subjects')) if (s.goal_id === row.id) store.put('subjects', { ...s, goal_id: null })
  }
  store.bury(collection, row)
}

// ---------- reading a list ----------

const FILTERS: Record<Collection, string[]> = {
  goals: ['kind', 'status'],
  subjects: ['goal_id', 'source', 'format', 'code'],
  slots: ['subject_id', 'kind', 'weekday'],
  sessions: ['subject_id', 'slot_id', 'topic_id', 'week', 'cancelled'],
  items: ['subject_id', 'session_id', 'topic_id', 'parent_id', 'kind', 'source', 'pinned'],
  topics: ['subject_id', 'parent_id', 'source'],
  deadlines: ['subject_id', 'kind', 'status', 'confidence'],
  cards: ['subject_id', 'topic_id', 'item_id', 'kind', 'suspended'],
  'plan-tasks': ['date', 'subject_id', 'deadline_id', 'topic_id', 'kind'],
  signals: ['status', 'channel', 'subject_id', 'item_id'],
  connections: ['kind', 'status'],
  checks: ['batch_id', 'purpose', 'subject_id', 'topic_id', 'deadline_id', 'result'],
}
const BOOLEAN_FILTERS = ['cancelled', 'pinned', 'suspended']
const RANGES: Partial<Record<Collection, string>> = { sessions: 'starts_at', deadlines: 'due_at', cards: 'due_at', 'plan-tasks': 'date', checks: 'asked_at' }

/** A time from a query string. A `+` in an unencoded offset arrives as a space. */
export function instantOf(value: string): number | null {
  const at = Date.parse(value.trim().replace(/ (\d{2}:?\d{2})$/, '+$1'))
  return Number.isNaN(at) ? null : at
}

const by = (a: unknown, b: unknown) => (a === b ? 0 : a === null || a === undefined ? 1 : b === null || b === undefined ? -1 : a < b ? -1 : 1)
const time = (v: unknown) => (typeof v === 'string' ? Date.parse(v) : null)

function compare(collection: Collection): (a: Row, b: Row) => number {
  switch (collection) {
    case 'subjects': case 'items': case 'topics': return (a, b) => by(a.position, b.position) || by(a.created_at, b.created_at) || by(a.id, b.id)
    case 'slots': return (a, b) => by(a.weekday, b.weekday) || by(a.starts_at, b.starts_at) || by(a.id, b.id)
    case 'sessions': return (a, b) => by(time(a.starts_at), time(b.starts_at)) || by(a.id, b.id)
    case 'deadlines': case 'cards': return (a, b) => by(time(a.due_at), time(b.due_at)) || by(a.id, b.id)
    case 'plan-tasks': return (a, b) => by(a.date, b.date) || by(a.position, b.position) || by(a.id, b.id)
    case 'signals': return (a, b) => by(b.created_at, a.created_at) || by(a.id, b.id)
    case 'checks': return (a, b) => by(time(a.asked_at), time(b.asked_at)) || by(a.id, b.id)
    default: return (a, b) => by(a.created_at, b.created_at) || by(a.id, b.id)
  }
}

export function listRows(store: Store, collection: Collection, params: URLSearchParams): Row[] {
  let rows = store.live(collection)
  for (const column of ['id', ...FILTERS[collection]]) {
    const value = params.get(column)
    if (value === null) continue
    if (value === 'null') rows = rows.filter((r) => r[column] === null || r[column] === undefined)
    else if (BOOLEAN_FILTERS.includes(column)) {
      const on = ['1', 'true', 'on', 'yes'].includes(value.toLowerCase())
      rows = rows.filter((r) => Boolean(r[column]) === on)
    } else rows = rows.filter((r) => String(r[column]) === value)
  }
  const range = RANGES[collection]
  if (range) {
    const bound = (name: string, keep: (a: number | string, b: number | string) => boolean) => {
      const raw = params.get(name)
      if (raw === null) return
      const at = instantOf(raw)
      if (at === null) return
      if (range === 'date') {
        const day = raw.trim().slice(0, 10)
        rows = rows.filter((r) => keep(r.date, day))
      } else rows = rows.filter((r) => r[range] && keep(Date.parse(r[range]), at))
    }
    bound('from', (a, b) => a >= b)
    bound('to', (a, b) => a <= b)
  }
  return rows.sort(compare(collection)).map((r) => wire(collection, r))
}

// ---------- the door ----------

export function isWritable(collection: string): collection is Writable {
  return collection in RULES
}

const liveExists = (store: Store) => (c: Collection, id: string) => store.get(c, id) !== null

export function validated(store: Store, collection: Writable, input: Record<string, unknown>, creating: boolean): Record<string, any> {
  const data = validate(collection, input, creating, liveExists(store))
  if (creating && typeof input.id === 'string') {
    if (!UUID.test(input.id)) throw new Invalid({ id: ['The id field must be a valid UUID.'] })
    data.id = input.id
  }
  return data
}
