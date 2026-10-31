/**
 * The companion's local copy of everything, shared by every screen.
 *
 * `bootstrap()` runs once; after that a screen reads rows from here, by id or
 * as sorted lists, and never waits on the network to draw. Writes are
 * optimistic: the row changes on screen first, then goes to the repo. If the
 * network is gone the write waits in an outbox and is sent when it comes
 * back; if the
 * server refuses it, the row goes back to what it was and the learner is told.
 *
 * This is the stand-in for PowerSync: `changes(since)` on focus and once a
 * minute, so two devices converge without a socket.
 *
 *   const c = useCompanion()
 *   c.subjects.value            // courses, in rail order (c.shelf: not archived)
 *   c.get('deadlines', id)      // one row, reactive
 *   await c.upsert('items', { id: crypto.randomUUID(), kind: 'page', ... })
 *
 * Every screen stays in step by reading, never by copying. A list or a name
 * is a `computed` over these rows, so a change made anywhere (here, on
 * another screen, on another device) is on every screen at once. Two
 * things make that hold for what a screen has OPEN as well:
 *
 *  - `onGone(key, id, then)`: a screen showing one row (a note, a course)
 *    closes itself when that row is deleted, wherever it was deleted from.
 *    A delete with an Undo (`leave`) counts: the row drops out of every
 *    list and every `get` while the Undo is up, and comes back if pressed.
 *  - the written lessons behind a course (`lessonCourses`) are kept here
 *    too, one copy per course, reloaded after any change to a lesson
 *    (`refreshLessons`). A lesson marked complete counts toward its topic
 *    (`readinessInput`), so the path, a course's progress, Continue, the
 *    Courses card and Today move with it.
 */
import { computed, reactive, ref, watch, type ComputedRef } from 'vue'
import type { Course } from '~/types/api'
import type {
  Card,
  Check,
  CheckConfidence,
  CheckPurpose,
  CheckSitting,
  CollectionName,
  Connection,
  Deadline,
  Goal,
  Item,
  PlanTask,
  Readiness,
  Row,
  Session,
  Signal,
  Slot,
  Snapshot,
  Subject,
  Today,
  Topic,
  Uuid,
} from './types'
import { ApiError, useApi } from '~/composables/useApi'
import { useToast } from '~/composables/useToast'
import { peekCompanionRepo, resetCompanionRepo, useCompanionRepo } from './use-repo'
import type { CompanionRepo } from './repo'
import { clearCompanionTabs } from './tabs'
import { schedule, type RatingValue } from './fsrs'
import { computeReadiness, pathSteps, topicCheck as checkOf, topicSignal, type PathStep, type TopicCheck, type TopicSignal } from './readiness'
import { dayKey, nowIso, setZone, browserZone } from './time'
import { DEMO_USER } from './demo-seed'

export type RowKey = Exclude<keyof Snapshot, 'server_time'>

export const COLLECTION_KEY: Record<CollectionName, RowKey> = {
  goals: 'goals',
  subjects: 'subjects',
  slots: 'slots',
  sessions: 'sessions',
  items: 'items',
  topics: 'topics',
  deadlines: 'deadlines',
  cards: 'cards',
  'plan-tasks': 'plan_tasks',
  signals: 'signals',
  connections: 'connections',
  checks: 'checks',
}

interface RowTypes {
  goals: Goal
  subjects: Subject
  slots: Slot
  sessions: Session
  items: Item
  topics: Topic
  deadlines: Deadline
  cards: Card
  plan_tasks: PlanTask
  signals: Signal
  connections: Connection
  checks: Check
}

const KEYS = Object.values(COLLECTION_KEY)

function emptyRows(): { [K in RowKey]: Record<Uuid, RowTypes[K]> } {
  return {
    goals: {}, subjects: {}, slots: {}, sessions: {}, items: {}, topics: {},
    deadlines: {}, cards: {}, plan_tasks: {}, signals: {}, connections: {}, checks: {},
  }
}

const rows = reactive(emptyRows())
const status = reactive({
  mode: null as 'http' | 'demo' | 'powersync' | null,
  ready: false,
  loading: false,
  error: null as string | null,
  serverTime: null as string | null,
  online: true,
})
const today = ref<Today | null>(null)
const todayLoading = ref(false)

interface Pending {
  collection: CollectionName
  row: Row & { id: Uuid }
  remove?: boolean
}
const OUTBOX_KEY = 'bm:companion-outbox'
const outbox = ref<Pending[]>(readOutbox())

let loading: Promise<void> | null = null
let listening = false
/** Stops the live feed from a repo that pushes (PowerSync's local database). */
let unfollow: (() => void) | null = null

/*
 * The PowerSync repo can do two things the others can't: tell us when its
 * local database changed (a write from another device arrived, or a refused
 * write was rolled back), and tell us which writes the server refused. Both
 * are optional on the interface; this is how the store asks for them.
 */
interface LiveRepo {
  subscribe?: (listener: () => void) => () => void
  onRejected?: (listener: (results: { type: string; id: string; message?: string; errors?: Record<string, string[]> }[]) => void) => () => void
  forget?: () => Promise<void>
}

const TABLE_WORD: Record<string, string> = {
  items: 'a page',
  deadlines: 'a deadline',
  plan_tasks: 'a plan task',
  cards: 'a card review',
  card_reviews: 'a card review',
  sessions: 'a class',
  slots: 'a weekly class',
  goals: 'a goal',
  subjects: 'a course',
  topics: 'a topic',
  signals: 'an inbox item',
  connections: 'a connection',
  checks: 'a check',
  item_updates: 'a page edit',
}

function follow(repo: CompanionRepo): void {
  unfollow?.()
  const live = repo as CompanionRepo & LiveRepo
  const stops: (() => void)[] = []
  if (live.subscribe) stops.push(live.subscribe(() => void sync()))
  if (live.onRejected) {
    stops.push(
      live.onRejected((results) => {
        for (const r of results) {
          const reason = r.message ?? Object.values(r.errors ?? {}).flat()[0] ?? 'the server said no'
          useToast().error({ title: `Couldn't save ${TABLE_WORD[r.type] ?? 'a change'}`, body: reason })
        }
      }),
    )
  }
  unfollow = stops.length ? () => stops.forEach((stop) => stop()) : null
}

function readOutbox(): Pending[] {
  if (!import.meta.client) return []
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]') as Pending[]
  } catch {
    return []
  }
}

function writeOutbox(): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox.value))
  } catch {
    // Nothing to do: the queue still lives in memory for this session.
  }
}

function isOffline(error: unknown): boolean {
  return (
    (typeof navigator !== 'undefined' && navigator.onLine === false) ||
    (error instanceof ApiError && error.isNetwork)
  )
}

function merge(snapshot: Partial<Snapshot>, replace = false): void {
  for (const key of KEYS) {
    const list = snapshot[key] as Row[] | undefined
    if (!list) continue
    const target = rows[key] as Record<Uuid, Row>
    if (replace) for (const id of Object.keys(target)) delete target[id]
    for (const row of list) target[row.id] = row
  }
  if (snapshot.server_time) status.serverTime = snapshot.server_time
}

/** Empty every table in place, so screens holding the reactive object see it go. */
function clearRows(): void {
  for (const key of KEYS) {
    const table = rows[key] as Record<Uuid, Row>
    for (const id of Object.keys(table)) delete table[id]
  }
  for (const id of Object.keys(lessonCourses)) delete lessonCourses[Number(id)]
  lessonTickets.clear()
  leaving.clear()
}

/**
 * Rows on their way out: deleted with an Undo still on screen. Until it goes
 * they are left out of every list and every `get`, as if deleted, so lists
 * drop them and a screen that has one open closes (`onGone`); Undo puts
 * them back untouched. `companion/notes/actions.ts` is what uses it.
 */
const leaving = reactive(new Set<Uuid>())

function leave(ids: Uuid[], on: boolean): void {
  for (const id of ids) {
    if (on) leaving.add(id)
    else leaving.delete(id)
  }
}

function alive(row: Row): boolean {
  return !row.deleted_at && !leaving.has(row.id)
}

function liveList<K extends RowKey>(key: K): ComputedRef<RowTypes[K][]> {
  return computed(() => Object.values(rows[key]).filter(alive) as RowTypes[K][])
}

/* -- Lists, in the order screens draw them ----------------------------- */

const goals = liveList('goals')
const subjects = computed(() =>
  (Object.values(rows.subjects) as Subject[]).filter(alive).sort((a, b) => a.position - b.position),
)
const slots = liveList('slots')
const sessions = computed(() =>
  (Object.values(rows.sessions) as Session[])
    .filter(alive)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)),
)
const topics = computed(() =>
  (Object.values(rows.topics) as Topic[]).filter(alive).sort((a, b) => a.position - b.position),
)
const deadlines = computed(() =>
  (Object.values(rows.deadlines) as Deadline[])
    .filter(alive)
    .sort((a, b) => (a.due_at ? Date.parse(a.due_at) : Infinity) - (b.due_at ? Date.parse(b.due_at) : Infinity)),
)
const items = computed(() =>
  (Object.values(rows.items) as Item[]).filter(alive).sort((a, b) => a.position - b.position),
)
const cards = liveList('cards')
const planTasks = computed(() =>
  (Object.values(rows.plan_tasks) as PlanTask[]).filter(alive).sort((a, b) => a.position - b.position),
)
const signals = computed(() =>
  (Object.values(rows.signals) as Signal[])
    .filter(alive)
    .sort((a, b) => Date.parse(b.created_at ?? '') - Date.parse(a.created_at ?? '')),
)
const connections = liveList('connections')
/** Every check asked, oldest first: a sitting reads in the order it was asked. */
const checks = computed(() =>
  (Object.values(rows.checks) as Check[])
    .filter(alive)
    .sort((a, b) => Date.parse(a.asked_at) - Date.parse(b.asked_at)),
)

/*
 * The shelf is every course not archived: what the Courses page, Today and
 * the planner's lists are drawn from. `subjects` keeps the archived ones too,
 * because an archived course still opens and its notes still say whose they
 * are; it has only left the lists used every day (`companion/shelf.ts`).
 */
const shelf = computed(() => subjects.value.filter((s) => !s.archived_at))
const archivedSubjects = computed(() =>
  subjects.value
    .filter((s) => s.archived_at)
    .sort((a, b) => Date.parse(b.archived_at!) - Date.parse(a.archived_at!)),
)
const schoolSubjects = computed(() => shelf.value.filter((s) => s.format === 'weeks'))
const selfSubjects = computed(() => shelf.value.filter((s) => s.format === 'path'))
const pendingSignals = computed(() => signals.value.filter((s) => s.status === 'pending'))
const termGoal = computed(() => goals.value.find((g) => g.kind === 'term' && g.status === 'active') ?? null)

/* -- Written lessons ---------------------------------------------------- */

/**
 * The old product's written courses behind companion courses
 * (`subjects.generated_course_id`), by course id, with every lesson and its
 * progress: one copy for every screen. Each is loaded once the course is
 * known and again after any change to one of its lessons (written, edited,
 * marked complete: `refreshLessons`, which `companion/lessons.ts` and the
 * course page call). In the demo the same request is answered in memory.
 */
const lessonCourses = reactive<Record<number, Course>>({})
const lessonTickets = new Map<number, number>()

async function refreshLessons(courseId: number): Promise<Course | null> {
  const ticket = (lessonTickets.get(courseId) ?? 0) + 1
  lessonTickets.set(courseId, ticket)
  try {
    const fresh = await useApi().get<Course>(`/courses/${courseId}`)
    // A slower, older answer never overwrites a newer one.
    if (lessonTickets.get(courseId) === ticket) lessonCourses[courseId] = fresh
    return fresh
  } catch {
    return lessonCourses[courseId] ?? null
  }
}

/** Every course's written lessons this device hasn't loaded yet, in the background. */
function primeLessons(): void {
  for (const s of subjects.value) {
    const id = s.generated_course_id
    if (id && !lessonTickets.has(id)) void refreshLessons(id)
  }
}

/** The written lessons marked complete, in every course loaded. */
const lessonsDone = computed(() => {
  const done = new Set<number>()
  for (const course of Object.values(lessonCourses)) {
    for (const node of course.nodes ?? []) if (node.progress?.state === 'completed') done.add(node.id)
  }
  return done
})

/**
 * The rows readiness is computed from, kept as one reactive bundle. Checks
 * are the proof; deadlines say which topics are close (they turn cold after
 * a day, not three); the rest is the study that decides when a check opens.
 */
const readinessInput = computed(() => ({
  topics: topics.value,
  sessions: sessions.value,
  items: items.value,
  cards: cards.value,
  checks: checks.value,
  deadlines: deadlines.value,
  lessonsDone: lessonsDone.value,
}))

/* -- Loading ----------------------------------------------------------- */

async function load(force = false): Promise<void> {
  const repo = useCompanionRepo()
  if (status.mode && status.mode !== repo.mode) {
    // The tab switched between the demo and a real account: nothing carries over.
    unfollow?.()
    unfollow = null
    clearRows()
    status.ready = false
    today.value = null
  }
  status.mode = repo.mode
  if (status.ready && !force) return
  if (loading) return loading
  status.loading = true
  status.error = null
  loading = (async () => {
    try {
      const snapshot = await repo.bootstrap()
      merge(snapshot, true)
      const tz = snapshot.goals.find((g) => g.status === 'active')?.timezone
      setZone(tz || browserZone())
      status.ready = true
      listen()
      follow(repo)
      void flush()
      primeLessons()
      // Bootstrap carries only the cards that are due. Readiness per topic
      // (the Topics tab, every ring outside Today) needs the rest, so fetch
      // them once in the background; the screens are already drawn.
      if (repo.mode === 'http') {
        void repo.list<Card>('cards').then((all) => merge({ cards: all })).catch(() => undefined)
      }
    } catch (error) {
      status.error = error instanceof Error ? error.message : 'Could not load your courses.'
    } finally {
      status.loading = false
      loading = null
    }
  })()
  return loading
}

/** Pull what changed since the last pull, tombstones included. */
async function sync(): Promise<void> {
  if (!status.ready) return
  try {
    const repo = useCompanionRepo()
    // PowerSync's changes() diffs its own versions and ignores `since`.
    merge(await repo.changes(status.serverTime ?? new Date(0).toISOString()))
    primeLessons()
    status.online = true
    await flush()
  } catch (error) {
    if (isOffline(error)) status.online = false
  }
}

function listen(): void {
  if (listening || !import.meta.client) return
  listening = true
  window.addEventListener('focus', () => void sync())
  window.addEventListener('online', () => {
    status.online = true
    void flush()
  })
  window.addEventListener('offline', () => {
    status.online = false
  })
  setInterval(() => {
    if (document.visibilityState === 'visible') void sync()
  }, 60_000)
}

async function flush(): Promise<void> {
  if (!outbox.value.length) return
  const repo = useCompanionRepo()
  const queue = [...outbox.value]
  for (const pending of queue) {
    try {
      if (pending.remove) await repo.remove(pending.collection, pending.row.id)
      else {
        const saved = await repo.upsert(pending.collection, pending.row)
        ;(rows[COLLECTION_KEY[pending.collection]] as Record<Uuid, Row>)[saved.id] = saved
      }
      outbox.value = outbox.value.filter((p) => p !== pending)
    } catch (error) {
      if (isOffline(error)) break
      // Refused for good: drop it rather than retry forever.
      outbox.value = outbox.value.filter((p) => p !== pending)
    }
  }
  writeOutbox()
}

/* -- Writes ------------------------------------------------------------- */

/**
 * Create or change a row, on screen first. Send a full row with a new
 * `crypto.randomUUID()` to create; send `{ id, ...changes }` to edit.
 */
async function upsert<T extends Row>(collection: CollectionName, patch: Partial<T> & { id: Uuid }): Promise<T> {
  const key = COLLECTION_KEY[collection]
  const table = rows[key] as Record<Uuid, Row>
  const before = table[patch.id] ? { ...table[patch.id]! } : undefined
  const next = { ...(before ?? {}), ...patch, updated_at: nowIso() } as Row
  table[patch.id] = next
  // Send the whole row when it already existed, so the http repo knows to
  // PATCH (it reads `created_at`) and the server never sees half a record.
  const outgoing = (before ? { ...next, ...patch } : patch) as Partial<T> & { id: Uuid }
  try {
    const saved = await useCompanionRepo().upsert<T>(collection, outgoing)
    table[saved.id] = saved
    return saved
  } catch (error) {
    if (isOffline(error)) {
      outbox.value.push({ collection, row: next as Row & { id: Uuid } })
      writeOutbox()
      status.online = false
      return next as T
    }
    if (before) table[patch.id] = before
    else delete table[patch.id]
    useToast().error(error instanceof Error ? error.message : 'That change could not be saved.')
    throw error
  }
}

async function remove(collection: CollectionName, id: Uuid): Promise<void> {
  const table = rows[COLLECTION_KEY[collection]] as Record<Uuid, Row>
  const before = table[id] ? { ...table[id]! } : undefined
  if (before) table[id] = { ...before, deleted_at: nowIso() }
  try {
    await useCompanionRepo().remove(collection, id)
  } catch (error) {
    if (isOffline(error) && before) {
      outbox.value.push({ collection, row: before as Row & { id: Uuid }, remove: true })
      writeOutbox()
      return
    }
    if (before) table[id] = before
    throw error
  }
}

async function loadToday(): Promise<Today | null> {
  todayLoading.value = true
  try {
    today.value = await useCompanionRepo().today(dayKey())
    if (today.value) merge({ plan_tasks: today.value.plan.tasks })
  } catch (error) {
    if (!today.value) status.error = error instanceof Error ? error.message : 'Could not load today.'
  } finally {
    todayLoading.value = false
  }
  return today.value
}

async function applySignal(id: Uuid, factIndexes?: number[]): Promise<void> {
  const signal = rows.signals[id]
  if (signal) rows.signals[id] = { ...signal, status: 'applied', applied_at: nowIso() }
  try {
    await useCompanionRepo().applySignal(id, factIndexes)
    await sync()
    void loadToday()
  } catch (error) {
    if (signal) rows.signals[id] = signal
    throw error
  }
}

async function dismissSignal(id: Uuid): Promise<void> {
  const signal = rows.signals[id]
  if (signal) rows.signals[id] = { ...signal, status: 'dismissed' }
  try {
    await useCompanionRepo().dismissSignal(id)
    void loadToday()
  } catch (error) {
    if (signal) rows.signals[id] = signal
    throw error
  }
}

/** Rate a card: FSRS runs here, the server only stores the result. */
async function reviewCard(id: Uuid, rating: RatingValue): Promise<Card | null> {
  const card = rows.cards[id]
  if (!card) return null
  const result = schedule(card, rating)
  const next: Card = { ...card, fsrs: result.fsrs, due_at: result.due_at, last_review_at: result.reviewed_at, updated_at: result.reviewed_at }
  rows.cards[id] = next
  try {
    const saved = await useCompanionRepo().reviewCard(id, result)
    rows.cards[id] = saved
    return saved
  } catch (error) {
    if (isOffline(error)) return next
    throw error
  }
}

async function ingestText(text: string, channel: 'share' | 'manual' | 'email', subjectId?: Uuid): Promise<Signal[]> {
  const out = await useCompanionRepo().ingestText(text, channel, subjectId)
  merge({ signals: out })
  return out
}

/** A timetable photo or an exam PDF through the file parser; its signals join the inbox. */
async function ingestFile(file: File): Promise<Signal[]> {
  const out = await useCompanionRepo().ingestFile(file)
  merge({ signals: out })
  return out
}

/*
 * Checks are written and marked by the server only (`POST /checks`); a client never upserts one. What comes back is put in the store
 * at once, so the deadline's readiness moves the moment a mark arrives,
 * without waiting for the next sync to bring the same row.
 */
async function startCheck(body: { purpose: CheckPurpose; topic_ids?: Uuid[]; deadline_id?: Uuid; subject_id?: Uuid }): Promise<CheckSitting> {
  const sitting = await useCompanionRepo().startCheck(body)
  merge({ checks: sitting.checks })
  return sitting
}

async function answerCheck(
  id: Uuid,
  body: { answer: string; confidence?: CheckConfidence | null; follow_up_answer?: string | null },
): Promise<Check> {
  const check = await useCompanionRepo().answerCheck(id, body)
  merge({ checks: [check] })
  return check
}

/* -- Reading helpers ---------------------------------------------------- */

function get<K extends RowKey>(key: K, id: Uuid | null | undefined): RowTypes[K] | null {
  if (!id) return null
  const row = rows[key][id] as RowTypes[K] | undefined
  return row && alive(row) ? row : null
}

/**
 * For a screen showing one row (a note, a course): `then` runs once that row
 * is gone, deleted here, from another screen or on another device, or on its
 * way out with an Undo. Only a row the store had and lost: an id it never
 * had (still loading, someone else's) isn't gone, moving to another id isn't,
 * and neither is the whole store being emptied (signing out, leaving the
 * demo). Call it in `setup`; the watcher ends with the component.
 */
function onGone<K extends RowKey>(key: K, id: () => Uuid | null | undefined, then: (row: RowTypes[K]) => void): void {
  watch(
    () => [id(), get(key, id())] as const,
    ([nowId, row], [wasId, was]) => {
      if (status.ready && was && !row && nowId === wasId) then(was)
    },
  )
}

function subjectOf(row: { subject_id: Uuid | null } | null | undefined): Subject | null {
  return row ? get('subjects', row.subject_id) : null
}

function goalOf(subject: Subject | null | undefined): Goal | null {
  return subject ? get('goals', subject.goal_id) : null
}

/** Client-side readiness, from the rows on this device. */
function readinessOf(deadline: Deadline): Readiness {
  return computeReadiness(deadline, readinessInput.value)
}

/** One topic's place in the checks, in a deadline readiness row's shape; null for a topic not here. */
function topicCheck(topicId: Uuid): TopicCheck | null {
  const topic = get('topics', topicId)
  return topic ? checkOf(topic, readinessInput.value) : null
}

function topicSignalOf(topic: Topic): TopicSignal {
  return topicSignal(topic, readinessInput.value)
}

function pathOf(subjectId: Uuid): PathStep[] {
  return pathSteps(topics.value.filter((t) => t.subject_id === subjectId), readinessInput.value)
}

/** The term week a day falls in (1–14, 15+ for the exam weeks), or null. */
function weekOf(iso: string): number | null {
  const term = termGoal.value
  if (!term?.starts_on) return null
  const d = Date.parse(dayKey(iso))
  return Math.floor((d - Date.parse(term.starts_on)) / (7 * 86_400_000)) + 1
}

const currentWeek = computed(() => weekOf(new Date().toISOString()))

const userName = computed(() => {
  if (status.mode === 'demo') return DEMO_USER.name
  const user = useState<{ name?: string } | null>('auth:user', () => null).value
  return user?.name?.split(' ')[0] ?? ''
})

/**
 * Sign-out: stop following, wipe the device's copy of this learner (the
 * PowerSync database, the outbox, the open tabs) and empty the store, so the
 * next person to sign in on this browser starts from nothing.
 */
export async function forgetCompanion(): Promise<void> {
  unfollow?.()
  unfollow = null
  const repo = peekCompanionRepo() as (CompanionRepo & LiveRepo) | null
  try {
    await repo?.forget?.()
  } catch {
    // The database may already be closed; the rest still has to go.
  }
  resetCompanionRepo()
  clearRows()
  status.mode = null
  status.ready = false
  status.serverTime = null
  status.error = null
  today.value = null
  outbox.value = []
  try {
    localStorage.removeItem(OUTBOX_KEY)
    // PowerSync's last server answer for Today, kept for offline use.
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('bm:companion-sync-today:')) localStorage.removeItem(key)
    }
  } catch {
    // Nothing stored, nothing to clear.
  }
  clearCompanionTabs()
}

const store = {
  rows,
  status,
  today,
  todayLoading,
  outbox,
  goals,
  subjects,
  shelf,
  archivedSubjects,
  schoolSubjects,
  selfSubjects,
  slots,
  sessions,
  topics,
  deadlines,
  items,
  cards,
  planTasks,
  signals,
  pendingSignals,
  connections,
  checks,
  termGoal,
  currentWeek,
  userName,
  lessonCourses,
  load,
  sync,
  loadToday,
  upsert,
  remove,
  leave,
  refreshLessons,
  applySignal,
  dismissSignal,
  reviewCard,
  ingestText,
  ingestFile,
  startCheck,
  answerCheck,
  get,
  onGone,
  subjectOf,
  goalOf,
  readinessOf,
  topicCheck,
  topicSignalOf,
  pathOf,
  weekOf,
  repo: () => useCompanionRepo(),
}

export type CompanionStore = typeof store

/** The store, loading it on first use. Safe to call from any setup. */
export function useCompanion(): CompanionStore {
  if (import.meta.client) void load()
  return store
}
