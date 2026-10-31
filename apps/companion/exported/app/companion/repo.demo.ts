/**
 * The companion with no server: the mockup semester in memory.
 *
 * Every method of `CompanionRepo` is implemented the way the server is meant
 * to behave, closely enough that a screen built against this works against
 * the real API unchanged: applying a signal writes a source row with the
 * evidence and the change; reviewing a card moves its due date; Today, the
 * plan and readiness are computed from the rows rather than canned.
 *
 * The world survives a reload within the tab (sessionStorage), so a page made
 * in the demo is still there after F5; a new day builds a new world, because
 * "week 8 is now" only holds for the day it was built.
 *
 * `?demo=new` runs the same repo on a different world: a brand-new account
 * holding only the starter kit (`starter-demo.ts`).
 *
 * Checks are acted out too (`checks-demo.ts`): questions written from the
 * topic's cards and notes, marked by overlap with the answer kept back, an
 * unfinished sitting resumed, and a class of fourteen for Kamila's courses.
 */
import type { CompanionRepo } from './repo'
import type {
  Card,
  Check,
  CheckSitting,
  ClassView,
  CollectionName,
  Connection,
  Deadline,
  DocState,
  Goal,
  GoalDraft,
  Item,
  PlanTask,
  Row,
  Session,
  Signal,
  SignalFact,
  Slot,
  Snapshot,
  Subject,
  Today,
  Topic,
  Uuid,
} from './types'
import { bridgeLessons, buildDemoSeed, sid, type DemoWorld } from './demo-seed'
import { buildStarterWorld } from './starter-demo'
import { companionDemoKind } from '~/utils/companionDemo'
import { computeReadiness, dueCardsFor, opensAt, pathSteps, scopeOf, sittingSize, SITTING_TOPICS, topicCheck } from './readiness'
import { pickDue } from './checks'
import { followUpFor, markAnswer, neighbourOf, writeQuestions, type DemoQuestion } from './checks-demo'
import { clock, dayKey, daysBetween, isoWithOffset, mondayOf, nowIso, shiftDay, weekdayLong, weekdayOf, whenLabel } from './time'

type Key = Exclude<keyof Snapshot, 'server_time'>

const KEYS: Record<CollectionName, Key> = {
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

const STORE_KEY = 'bm:companion-demo-world'
const DOCS_KEY = 'bm:companion-demo-docs'

let world: DemoWorld | null = null
let docs: Record<Uuid, DocState> = {}
let saveTimer: ReturnType<typeof setTimeout> | null = null

function load(): DemoWorld {
  const today = dayKey()
  // `?demo=new` is a different world from Kamila's, never one carried over.
  const kind = companionDemoKind() === 'new' ? 'new' : undefined
  if (world && world.seed_day === today && world.kind === kind) return world
  world = null
  if (import.meta.client) {
    try {
      const raw = sessionStorage.getItem(STORE_KEY)
      const saved = raw ? (JSON.parse(raw) as DemoWorld) : null
      if (saved && saved.seed_day === today && saved.kind === kind) {
        world = saved
        // A world saved in the tab before checks existed.
        world.checks ??= []
        docs = JSON.parse(sessionStorage.getItem(DOCS_KEY) || '{}') as Record<Uuid, DocState>
        bridgeLessons(world.subjects, world.topics)
      }
    } catch {
      world = null
    }
  }
  if (!world) {
    // The new account comes with today's plan written, as the server's does.
    world = kind ? buildStarterWorld() : buildDemoSeed()
    docs = {}
    if (!kind) planFor(world, today, false)
  }
  return world
}

function save(): void {
  if (!import.meta.client) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(world))
      sessionStorage.setItem(DOCS_KEY, JSON.stringify(docs))
    } catch {
      // Quota or private mode: the demo simply forgets on reload.
    }
  }, 300)
}

/** A little latency, so loading states are real states and not a flash. */
function later<T>(value: T, ms = 60): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(clone(value)), ms))
}

function asDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T)
}

function uuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : sid(`rand:${Math.random()}:${Date.now()}`)
}

function live<T extends Row>(rows: T[]): T[] {
  return rows.filter((r) => !r.deleted_at)
}

function touch<T extends Row>(row: T): T {
  row.updated_at = nowIso()
  return row
}

/* -------------------------------------------------------------------------- */
/* Derived: tentative, pace, the plan                                         */
/* -------------------------------------------------------------------------- */

function settle(deadline: Deadline): void {
  deadline.tentative =
    (deadline.confidence === 'heard' || deadline.confidence === 'shared') && !deadline.confirmed
}

function paceFor(w: DemoWorld, goal: Goal): Today['pace'][number] {
  const spw = goal.sessions_per_week ?? 4
  const subjectIds = new Set(w.subjects.filter((s) => s.goal_id === goal.id && !s.deleted_at).map((s) => s.id))
  const now = Date.now()
  const from = now - 21 * 86_400_000
  const past = live(w.sessions).filter(
    (s) => subjectIds.has(s.subject_id) && Date.parse(s.ends_at) <= now && Date.parse(s.starts_at) >= from,
  )
  const held = past.filter((s) => !s.cancelled).length
  const skipped = past.length - held
  const slots = live(w.slots).filter((s) => subjectIds.has(s.subject_id)).length
  // Extra slots beyond the plan's weekly number win the missed ones back over
  // the next four weeks; a later finish line buys a week per week it moved.
  const extra = Math.max(0, slots - spw) * 4
  const moved = goal.ends_on && goal.id === sid('goal:ita')
    ? Math.floor((Date.parse(goal.ends_on) - Date.parse(w.ita_original_end)) / (7 * 86_400_000))
    : 0
  const behind = Math.max(0, Math.round(Math.max(0, skipped - extra) / spw) - Math.max(0, moved))
  return {
    goal_id: goal.id,
    status: behind > 0 ? 'behind' : 'on',
    weeks_behind: behind,
    sessions_per_week_needed: spw,
    sessions_per_week_actual: Math.round(held / 3),
  }
}

/**
 * Today's plan, worked backwards from what is due:
 * a check when anything is due for one, the cards for the nearest assessment
 * with work in it, a second look at what the last check missed, tonight's
 * lesson on the self-study path, a start on the next piece of coursework, and
 * a look at the slides for the next class. Ticked tasks and the learner's
 * own survive a rebuild. Same words as Planner.php.
 */
function planFor(w: DemoWorld, date: string, keepDone = true): void {
  const now = Date.now()
  const generated = nowIso()
  // The learner's own tasks stay too, ticked or not: they are not the plan's.
  const kept = w.plan_tasks.filter((t) => t.date === date && !t.deleted_at && (t.kind === 'own' || (keepDone && t.done_at)))
  // What the new plan drops is tombstoned, not forgotten, so a screen holding
  // the old plan (the store, through `changes`) drops it too.
  const dropped = w.plan_tasks.filter((t) => t.date === date && !t.deleted_at && !kept.includes(t))
  w.plan_tasks = w.plan_tasks
    .filter((t) => t.date !== date || kept.includes(t))
    .concat(dropped.map((t) => ({ ...t, deleted_at: generated, updated_at: generated })))
  const tasks: TaskDraft[] = []

  const upcoming = live(w.deadlines)
    .filter((d) => d.status === 'upcoming' && d.due_at && Date.parse(d.due_at) > now)
    .sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!))
  // The second line says why a task is on the list (when, what it covers),
  // never the course: the row shows that itself. Same words as Planner.php.
  const detail = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ') || null
  const dueWords = (d: Deadline) => {
    const when = whenLabel(d.due_at!, d.all_day)
    if (d.kind === 'final') return `final exam ${when}`
    return ['quiz', 'midterm', 'exam'].includes(d.kind) ? `${d.kind} ${when}` : `due ${when}`
  }

  // A check first, when anything is due: it's short, and it's the measurement.
  const onShelf = (id: string) => live(w.subjects).some((s) => s.id === id && !s.archived_at)
  const due = pickDue(w, { onShelf }, now).slice(0, SITTING_TOPICS)
  if (due.length) {
    const names = due.map((p) => p.topic.title)
    const size = sittingSize(due.length, 'cold')
    const shared = upcoming.find((d) => {
      const scope = new Set(scopeOf(d, w.topics).map((t) => t.id))
      return due.every((p) => scope.has(p.topic.id))
    })
    tasks.push({
      subject_id: new Set(due.map((p) => p.topic.subject_id)).size === 1 ? due[0]!.topic.subject_id : null,
      deadline_id: shared?.id ?? null,
      topic_id: due[0]!.topic.id,
      item_id: null,
      kind: 'check',
      title: `Check yourself on ${names.length > 2 ? `${names.slice(0, 2).join(', ')} and ${names.length - 2} more` : names.join(' and ')}`,
      detail: `${size.questions} questions · no notes, no help`,
      minutes: size.minutes,
    })
  }

  const toReview = upcoming.find((d) => Date.parse(d.due_at!) - now < 10 * 86_400_000 && dueCardsFor(d.topic_ids, w.cards, now + 86_400_000).length)
  if (toReview) {
    const n = Math.min(30, dueCardsFor(toReview.topic_ids, w.cards, now + 86_400_000).length)
    tasks.push({
      subject_id: toReview.subject_id,
      deadline_id: toReview.id,
      topic_id: null,
      item_id: null,
      kind: 'review',
      title: `Review ${n} flashcard${n === 1 ? '' : 's'} for ${toReview.title}`,
      detail: detail(dueWords(toReview), toReview.scope_note),
      minutes: Math.max(5, Math.round(n * 0.65)),
    })
  }

  tasks.push(...missedTasks(w, now).slice(0, 2))

  for (const goal of live(w.goals).filter((g) => g.kind === 'self' && g.status === 'active')) {
    const subject = live(w.subjects).find((s) => s.goal_id === goal.id)
    if (!subject) continue
    const steps = pathSteps(live(w.topics).filter((t) => t.subject_id === subject.id), w, now)
    const step = steps.find((s) => s.state === 'now')
    if (!step) continue
    const lesson = step.session?.number
    tasks.push({
      subject_id: subject.id,
      deadline_id: null,
      topic_id: step.topic.id,
      item_id: null,
      kind: 'lesson',
      title: lesson ? `Lesson ${lesson}: ${step.topic.title}` : step.topic.title,
      detail: step.session && dayKey(step.session.starts_at) === date ? clock(step.session.starts_at) : null,
      minutes: Math.max(10, (goal.minutes_per_session ?? 25) - 5),
    })
  }

  const work = upcoming.find(
    (d) => ['lab', 'assignment', 'project'].includes(d.kind) && Date.parse(d.due_at!) - now < 6 * 86_400_000,
  )
  if (work) {
    tasks.push({
      subject_id: work.subject_id,
      deadline_id: work.id,
      topic_id: work.topic_ids[0] ?? null,
      item_id: null,
      kind: 'work',
      title: `Start ${work.title}`,
      detail: detail(dueWords(work), work.weight_pct != null ? `${work.weight_pct}% of the grade` : null),
      minutes: 15,
    })
  }

  const nextClass = live(w.sessions)
    .filter((s) => !s.cancelled && Date.parse(s.starts_at) > now && Date.parse(s.starts_at) - now < 30 * 3_600_000)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
    .find((s) => live(w.items).some((i) => i.session_id === s.id && i.kind === 'file'))
  if (nextClass) {
    const file = live(w.items).find((i) => i.session_id === nextClass.id && i.kind === 'file')!
    tasks.push({
      subject_id: nextClass.subject_id,
      deadline_id: null,
      topic_id: nextClass.topic_id,
      item_id: file.id,
      kind: 'read',
      title: `Skim the slides before ${nextClass.title}`,
      detail: detail(`class ${whenLabel(nextClass.starts_at)}`, file.title),
      minutes: 10,
    })
  }

  tasks.forEach((t, i) => {
    // A task already ticked today stays; its fresh twin is dropped. One check
    // a day, whatever it covers; a second look is per topic.
    const twin = (k: PlanTask) =>
      k.kind === t.kind && (t.kind === 'check' || (k.subject_id === t.subject_id && (t.kind !== 'read' || k.topic_id === t.topic_id)))
    if (kept.some(twin)) return
    const id = sid(`plan:${date}:${t.kind}:${t.subject_id}:${t.deadline_id}${t.kind === 'read' ? `:${t.topic_id}` : ''}`)
    w.plan_tasks = w.plan_tasks.filter((x) => x.id !== id)
    w.plan_tasks.push({
      id,
      created_at: generated,
      updated_at: generated,
      deleted_at: null,
      date,
      position: i,
      done_at: null,
      generated_at: generated,
      ...t,
    })
  })
}

type TaskDraft = Omit<PlanTask, 'id' | 'position' | 'generated_at' | 'date' | 'done_at'>

/**
 * After a miss: a topic whose latest counted check was missed, and that
 * hasn't been studied since (the check itself not counted), gets a second
 * look, with where to read. A topic first met in that check gets a start.
 * The most recent misses first.
 */
function missedTasks(w: DemoWorld, now: number): TaskDraft[] {
  const parents = new Set(w.topics.map((t) => t.parent_id).filter(Boolean))
  const out: (TaskDraft & { at: number })[] = []
  for (const topic of live(w.topics)) {
    if (parents.has(topic.id)) continue
    const row = topicCheck(topic, w, now)
    if (row.state !== 'missed' || !row.last_checked_at) continue
    const checked = Date.parse(row.last_checked_at)
    const studied = topicCheck(topic, { ...w, checks: [] }, now).last_studied_at
    if (studied && Date.parse(studied) > checked) continue
    const key = dayKey(row.last_checked_at)
    const ago = daysBetween(key, dayKey(now))
    const day = ago === 0 ? 'today\'s' : ago === 1 ? 'yesterday\'s' : ago < 7 ? `${weekdayLong(weekdayOf(key))}'s` : 'an earlier'
    const material = live(w.items).filter((i) => i.topic_id === topic.id)
    const where = (material.find((i) => i.kind === 'file' && /^L\d/.test(i.title)) ?? material.find((i) => i.kind === 'file') ?? material[0])?.title
    out.push({
      at: checked,
      subject_id: topic.subject_id,
      deadline_id: null,
      topic_id: topic.id,
      item_id: null,
      kind: 'read',
      title: studied ? `Go back over ${topic.title}` : `Start on ${topic.title}`,
      detail: studied ? [`Missed in ${day} check`, where].filter(Boolean).join(' · ') : `New to you in ${day} check`,
      minutes: 15,
    })
  }
  return out.sort((a, b) => b.at - a.at).map(({ at: _at, ...task }) => task)
}

/**
 * Hand a self-study course's untaken topics to its upcoming study sessions,
 * in path order. Runs after a slot is added or the path changes, which is
 * what "one tap and the plan redraws" means in rows.
 */
function reflowPath(w: DemoWorld, subjectId: Uuid): void {
  const now = Date.now()
  const topics = live(w.topics).filter((t) => t.subject_id === subjectId)
  const steps = pathSteps(topics, w, now)
  const future = live(w.sessions)
    .filter((s) => s.subject_id === subjectId && !s.cancelled && Date.parse(s.ends_at) > now)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
  const open = steps.filter((s) => s.state !== 'done').map((s) => s.topic.id)
  const held = live(w.sessions).filter((s) => s.subject_id === subjectId && !s.cancelled && Date.parse(s.ends_at) <= now && s.number)
  let lesson = held.reduce((max, s) => Math.max(max, s.number ?? 0), 0)
  future.forEach((s, i) => {
    s.topic_id = open[i] ?? null
    lesson++
    s.number = lesson
    s.title = `Lesson ${lesson}`
    touch(s)
  })
}

/** Sessions for a new slot, from its first valid day to sixteen weeks out. */
function sessionsForSlot(w: DemoWorld, slot: Slot): void {
  const today = dayKey()
  const start = slot.valid_from && slot.valid_from > today ? slot.valid_from : today
  const end = shiftDay(today, 7 * 16)
  const term = live(w.goals).find((g) => g.kind === 'term')
  for (let day = start; day <= end; day = shiftDay(day, 1)) {
    if (weekdayOf(day) !== slot.weekday) continue
    if (slot.valid_until && day > slot.valid_until) break
    const startsAt = localAt(day, slot.starts_at)
    if (startsAt.getTime() < Date.now()) continue
    const week = term?.starts_on
      ? Math.floor((Date.parse(mondayOf(day)) - Date.parse(term.starts_on)) / (7 * 86_400_000)) + 1
      : null
    w.sessions.push({
      id: uuid(),
      created_at: nowIso(),
      updated_at: nowIso(),
      deleted_at: null,
      subject_id: slot.subject_id,
      slot_id: slot.id,
      title: slot.kind === 'study' ? 'Study' : slot.kind[0]!.toUpperCase() + slot.kind.slice(1),
      number: null,
      starts_at: isoWithOffset(startsAt),
      ends_at: isoWithOffset(localAt(day, slot.ends_at)),
      location: slot.location,
      week,
      topic_id: null,
      cancelled: false,
      source_ref: null,
    })
  }
  if (slot.kind === 'study') reflowPath(w, slot.subject_id)
}

function localAt(key: string, time: string): Date {
  const [h, m] = time.split(':').map(Number)
  return new Date(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10), h ?? 0, m ?? 0)
}

/* -------------------------------------------------------------------------- */
/* Signals                                                                    */
/* -------------------------------------------------------------------------- */

function applyFact(w: DemoWorld, signal: Signal, fact: SignalFact): void {
  const now = nowIso()
  const payload = fact.payload as Partial<Deadline> & Record<string, unknown>
  const sourceKind = signal.channel === 'transcript' ? 'transcript'
    : signal.channel === 'share' || signal.channel === 'telegram' ? 'share'
    : signal.channel === 'manual' ? 'user'
    : (signal.channel as Deadline['sources'][number]['kind'])

  const addSource = (deadline: Deadline, change: Deadline['sources'][number]['change']) => {
    deadline.sources.push({
      id: uuid(),
      deadline_id: deadline.id,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      kind: sourceKind,
      confidence: signal.confidence,
      evidence: fact.evidence,
      url: null,
      item_id: signal.item_id,
      at_seconds: fact.at_seconds ?? signal.at_seconds,
      observed_at: signal.created_at ?? now,
      change,
    })
  }

  if (fact.type === 'deadline.update' || fact.type === 'deadline.cancel') {
    const d = w.deadlines.find((x) => x.id === fact.target_id)
    if (!d) return
    const change: Record<string, { from: unknown; to: unknown }> = {}
    if (fact.type === 'deadline.cancel') {
      change.status = { from: d.status, to: 'cancelled' }
      d.status = 'cancelled'
    }
    for (const field of ['due_at', 'title', 'scope_note', 'location', 'weight_pct'] as const) {
      if (payload[field] !== undefined && payload[field] !== d[field]) {
        change[field] = { from: d[field], to: payload[field] }
        ;(d as unknown as Record<string, unknown>)[field] = payload[field]
      }
    }
    // A weaker source can move a date, but the date then reads as tentative
    // until something official agrees; an official one confirms outright.
    if (signal.confidence === 'official') d.confirmed = true
    else if (Object.keys(change).length) {
      d.confidence = signal.confidence
      d.confirmed = false
    }
    settle(d)
    addSource(d, Object.keys(change).length ? change : null)
    touch(d)
    return
  }

  if (fact.type === 'deadline.create') {
    const subjectId = fact.subject_guess.id ?? signal.subject_id
    if (!subjectId) return
    const d: Deadline = {
      id: uuid(),
      created_at: now,
      updated_at: now,
      deleted_at: null,
      subject_id: subjectId,
      kind: (payload.kind as Deadline['kind']) ?? 'other',
      title: String(payload.title ?? 'Deadline'),
      due_at: (payload.due_at as string) ?? null,
      all_day: false,
      weight_pct: null,
      location: null,
      status: 'upcoming',
      confidence: signal.confidence,
      confirmed: signal.confidence === 'official',
      scope_note: (payload.scope_note as string) ?? null,
      grade: null,
      readiness_said: null,
      source_ref: null,
      tentative: false,
      topic_ids: [],
      sources: [],
    }
    settle(d)
    addSource(d, null)
    w.deadlines.push(d)
    return
  }

  if (fact.type === 'session.cancel' || fact.type === 'session.move') {
    const s = w.sessions.find((x) => x.id === fact.target_id)
    if (!s) return
    if (fact.type === 'session.cancel') s.cancelled = true
    else {
      if (payload.starts_at) s.starts_at = String(payload.starts_at)
      if (payload.ends_at) s.ends_at = String(payload.ends_at)
      if (payload.location) s.location = String(payload.location)
    }
    touch(s)
  }
}

const COURSE_WORDS: [string, RegExp][] = [
  ['db', /\b(databases?|db|csc ?2104|sql)\b/i],
  ['net', /\b(networks?|networking|net ?2201)\b/i],
  ['prg', /\b(programming|prog|prg ?2102|java)\b/i],
  ['mth', /\b(discrete|maths?|mth ?2003)\b/i],
  ['seg', /\b(software eng\w*|seg ?2101|scrum)\b/i],
  ['eng', /\b(academic writing|writing|essay|eng ?1102)\b/i],
  ['ita', /\b(italian|italiano)\b/i],
]

const DAY_WORDS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/**
 * A message pasted or shared in, read the way the parser would read it: which
 * course, what kind of thing, which day and what time. Good enough to make
 * the demo's capture believable for the usual group-chat sentence; anything
 * it can't read becomes a note, which is also what the server does.
 */
function parseText(w: DemoWorld, text: string, channel: Signal['channel'], subjectId?: Uuid): Signal {
  const now = Date.now()
  // A chat export starts each message with "Name · 21:05"; that time is when
  // it was sent, not the time it is about, so it never reaches the parser.
  const body = text
    .split('\n')
    .filter((line) => !/^.{1,40}·\s*\d{1,2}:\d{2}\s*$/.test(line.trim()))
    .join('\n')
  const kindMatch = body.match(/\b(quiz|lab|midterm|final|exam|essay|assignment|project|presentation|problem set)\b\s*(\d+)?/i)
  const kind = kindMatch?.[1]?.toLowerCase()
  const number = kindMatch?.[2]
  // "lab 4 is extended" never names the course; the chat knows which one it
  // is. If exactly one course has an upcoming "Lab 4", that's the course.
  const named = number
    ? live(w.deadlines).filter((d) => d.status === 'upcoming' && d.title.toLowerCase().startsWith(`${kind} ${number}`))
    : []
  const inferred = new Set(named.map((d) => d.subject_id)).size === 1 ? named[0]!.subject_id : null
  const course = subjectId
    ? live(w.subjects).find((s) => s.id === subjectId)
    : live(w.subjects).find((s) => COURSE_WORDS.find(([k, re]) => k === s.color && re.test(body))) ??
      live(w.subjects).find((s) => s.id === inferred)
  const cancel = /\b(cancel+ed|cancel|no (class|lecture|lab)|called off)\b/i.test(body)

  let day: string | null = null
  const today = dayKey()
  if (/\btomorrow\b/i.test(body)) day = shiftDay(today, 1)
  else if (/\b(tonight|today)\b/i.test(body)) day = today
  else {
    const m = body.match(/\b(mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?|sun)(?:day)?\b/i)
    if (m) {
      const target = DAY_WORDS.indexOf(m[1]!.slice(0, 3).toLowerCase()) + 1
      let ahead = (target - weekdayOf(today) + 7) % 7
      if (ahead === 0) ahead = 7
      day = shiftDay(today, ahead)
    }
  }
  let time: string | null = null
  const hm = body.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/)
  const ampm = body.match(/\b(1[0-2]|0?[1-9])\s*(am|pm)\b/i)
  if (ampm) {
    let h = Number(ampm[1]) % 12
    if (ampm[2]!.toLowerCase() === 'pm') h += 12
    time = `${String(h).padStart(2, '0')}:00`
  } else if (hm) time = `${hm[1]!.padStart(2, '0')}:${hm[2]}`
  else if (/\bnoon\b/i.test(body)) time = '12:00'
  else if (/\bmidnight\b/i.test(body)) time = '23:59'
  const due = day ? isoWithOffset(localAt(day, time ?? '23:59')) : null

  const guess = { id: course?.id ?? null, title: course?.title ?? null, code: course?.code ?? null }
  const facts: SignalFact[] = []
  const evidence = body.trim().split('\n').slice(-1)[0]!.slice(0, 280)

  if (cancel && course && !kind) {
    const next = live(w.sessions)
      .filter((s) => s.subject_id === course.id && !s.cancelled && Date.parse(s.starts_at) > now && (!day || dayKey(s.starts_at) === day))
      .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0]
    facts.push({ type: 'session.cancel', subject_guess: guess, target_id: next?.id ?? null, payload: { title: next?.title ?? 'class' }, evidence })
  } else if (kind && course) {
    const label = kind === 'problem set' ? 'Problem set' : kind[0]!.toUpperCase() + kind.slice(1)
    const title = number ? `${label} ${number}` : label
    const existing = live(w.deadlines).find(
      (d) => d.subject_id === course.id && d.status === 'upcoming' && d.title.toLowerCase().startsWith(title.toLowerCase()),
    )
    if (existing) {
      facts.push({
        type: cancel ? 'deadline.cancel' : 'deadline.update',
        subject_guess: guess,
        target_id: existing.id,
        payload: cancel ? { title: existing.title } : { title: existing.title, ...(due ? { due_at: due } : {}) },
        evidence,
      })
    } else {
      const kindValue = (['quiz', 'lab', 'midterm', 'final', 'exam', 'project', 'presentation'].includes(kind) ? kind : 'assignment') as Deadline['kind']
      facts.push({ type: 'deadline.create', subject_guess: guess, target_id: null, payload: { kind: kindValue, title, due_at: due }, evidence })
    }
  } else {
    facts.push({ type: 'note', subject_guess: guess, target_id: null, payload: { text: evidence }, evidence })
  }

  const created = nowIso()
  return {
    id: uuid(),
    created_at: created,
    updated_at: created,
    deleted_at: null,
    channel,
    raw_excerpt: text.trim().slice(0, 1000),
    item_id: null,
    at_seconds: null,
    subject_id: course?.id ?? null,
    facts,
    confidence: channel === 'manual' ? 'own' : channel === 'email' ? 'official' : 'shared',
    status: 'pending',
    applied_at: null,
  }
}

/* -------------------------------------------------------------------------- */
/* One sentence to a course                                                   */
/* -------------------------------------------------------------------------- */

const SELF_UNITS: [string, string[]][] = [
  ['Everyday present', ['-ere and -ire verbs', 'Irregular present', 'Reflexive verbs', 'Possessives', 'Modal verbs', 'Direct object pronouns', 'Daily routine', 'Ci and ne']],
  ['The past', ['Passato prossimo with avere', 'Passato prossimo with essere', 'Irregular participles', 'Imperfetto', 'Passato prossimo or imperfetto', 'Indirect object pronouns', 'Telling a story', 'Time expressions']],
  ['Plans and wishes', ['Futuro semplice', 'Condizionale presente', 'Making plans', 'Polite requests', 'Comparatives', 'Superlatives', 'Travel']],
  ['Opinions', ['Congiuntivo presente', 'Giving an opinion', 'Agreeing and disagreeing', 'Relative pronouns', 'Combined pronouns', 'Si impersonale', 'Work and study']],
  ['Living there', ['Renting a room', 'At the university', 'The doctor and the pharmacy', 'Bureaucracy', 'Making friends', 'Food and markets', 'Getting around', 'Phone calls']],
  ['B1 exam skills', ['Reading longer texts', 'Listening', 'A formal email', 'An opinion piece', 'Describing an experience', 'Arguing a point', 'Mock: reading and listening', 'Mock: writing and speaking']],
]

function draftFromSentence(w: DemoWorld, sentence: string, answers: Record<string, string>): GoalDraft {
  const now = nowIso()
  const head = sentence.split(/[,.;–-]/)[0]!.trim()
  const subjectTitle = head ? head[0]!.toUpperCase() + head.slice(1, 40) : 'Italian'
  const finish = sentence.match(/\bby\s+([A-Z][a-z]+(?:\s+\d{1,2})?|\d{1,2}\s+[A-Z][a-z]+)/)?.[1] ?? 'June'
  const used = new Set(live(w.subjects).map((s) => String(s.color)))
  const color = ['ita', 'c8'].find((c) => !used.has(c)) ?? 'c8'
  const end = (() => {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    const m = months.findIndex((x) => finish.toLowerCase().includes(x))
    const today = dayKey()
    let y = +today.slice(0, 4)
    const month = m >= 0 ? m + 1 : 6
    let key = `${y}-${String(month).padStart(2, '0')}-01`
    if (key <= today) key = `${++y}-${String(month).padStart(2, '0')}-01`
    return key
  })()
  const minutes = Number((answers.time ?? '25').match(/\d+/)?.[0] ?? 25)

  const goal: Goal = {
    id: uuid(),
    created_at: now,
    updated_at: now,
    deleted_at: null,
    title: `${subjectTitle} · by ${finish}`,
    kind: 'self',
    starts_on: dayKey(),
    ends_on: end,
    weeks: null,
    breaks: null,
    exam_period: null,
    finish_kind: /exam|celi|cils|ielts|b1|b2/i.test(sentence + (answers.exam ?? '')) ? 'exam' : 'date',
    finish_label: 'B1 mock exam',
    sessions_per_week: 4,
    minutes_per_session: minutes,
    timezone: live(w.goals)[0]?.timezone ?? 'UTC',
    status: 'active',
  }
  const subject: Subject = {
    id: uuid(),
    created_at: now,
    updated_at: now,
    deleted_at: null,
    goal_id: goal.id,
    title: subjectTitle,
    code: null,
    color,
    lecturer: null,
    source: 'generated',
    source_ref: null,
    source_url: null,
    format: 'path',
    generated_course_id: null,
    recording_allowed: true,
    position: live(w.subjects).length,
    archived_at: null,
    group_name: null,
    try_first: false,
  }
  const topics: Topic[] = []
  SELF_UNITS.forEach(([unit, list], u) => {
    const unitId = uuid()
    topics.push({ id: unitId, created_at: now, updated_at: now, deleted_at: null, subject_id: subject.id, parent_id: null, title: unit, position: u * 100, summary: `Unit ${u + 1}`, source: 'generated', weight: null, node_id: null })
    list.forEach((title, i) => {
      topics.push({ id: uuid(), created_at: now, updated_at: now, deleted_at: null, subject_id: subject.id, parent_id: unitId, title, position: u * 100 + i + 1, summary: null, source: 'generated', weight: 1, node_id: null })
    })
  })
  return { goal, subject, topics }
}

/* -------------------------------------------------------------------------- */
/* The repo                                                                   */
/* -------------------------------------------------------------------------- */

function snapshotOf(w: DemoWorld): Snapshot {
  const { seed_day: _d, ita_original_end: _e, kind: _k, check_keys: _x, check_batches: _b, ...rest } = w
  return { ...rest, server_time: nowIso() }
}

export function createDemoRepo(): CompanionRepo {
  return {
    mode: 'demo',

    bootstrap() {
      const w = load()
      if (!w.plan_tasks.some((t) => t.date === dayKey())) planFor(w, dayKey())
      return later(snapshotOf(w), 180)
    },

    changes(since) {
      const w = load()
      const t = Date.parse(since)
      const out = snapshotOf(w)
      for (const key of Object.values(KEYS)) {
        ;(out[key] as Row[]) = (w[key] as Row[]).filter((r) => Date.parse(r.updated_at ?? '') > t)
      }
      return later(out)
    },

    list<T extends Row>(collection: CollectionName, filter?: Record<string, string | number | boolean>) {
      const rows = live(load()[KEYS[collection]] as Row[]).filter((r) =>
        Object.entries(filter ?? {}).every(([k, v]) => String((r as unknown as Record<string, unknown>)[k]) === String(v)),
      )
      return later(rows as T[])
    },

    upsert<T extends Row>(collection: CollectionName, row: Partial<T> & { id: Uuid }) {
      const w = load()
      const rows = w[KEYS[collection]] as Row[]
      const existing = rows.find((r) => r.id === row.id)
      const now = nowIso()
      let out: Row
      if (existing) {
        Object.assign(existing, row, { updated_at: now })
        out = existing
      } else {
        out = { ...defaults(collection), ...row, created_at: row.created_at ?? now, updated_at: now, deleted_at: null } as Row
        rows.push(out)
        if (collection === 'slots') sessionsForSlot(w, out as Slot)
      }
      if (collection === 'deadlines') settle(out as Deadline)
      if (collection === 'goals' && existing && 'ends_on' in row) {
        const subject = live(w.subjects).find((s) => s.goal_id === out.id)
        if (subject) reflowPath(w, subject.id)
      }
      save()
      return later(out as T)
    },

    remove(collection, id) {
      const w = load()
      const row = (w[KEYS[collection]] as Row[]).find((r) => r.id === id)
      if (row) {
        row.deleted_at = nowIso()
        touch(row)
      }
      save()
      return later(undefined)
    },

    today(date) {
      const w = load()
      const now = Date.now()
      if (!w.plan_tasks.some((t) => t.date === date && !t.deleted_at)) planFor(w, date)
      const sessions = live(w.sessions).filter((s) => !s.cancelled).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
      const nowSession = sessions.find((s) => Date.parse(s.starts_at) <= now && Date.parse(s.ends_at) > now) ?? null
      const nextSession = sessions.find((s) => Date.parse(s.starts_at) > now) ?? null
      const dueSoon = live(w.deadlines)
        .filter((d) => d.status === 'upcoming' && d.due_at && Date.parse(d.due_at) > now && Date.parse(d.due_at) - now < 14 * 86_400_000)
        .sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!))
        .map((deadline) => ({ deadline, readiness: computeReadiness(deadline, w, now).percent }))
      const tasks = live(w.plan_tasks).filter((t) => t.date === date).sort((a, b) => a.position - b.position)
      const endOfDay = localAt(date, '23:59').getTime()
      const today: Today = {
        date,
        now_session: nowSession,
        next_session: nextSession,
        due_soon: dueSoon,
        plan: { minutes: tasks.reduce((sum, t) => sum + t.minutes, 0), tasks },
        reviews_due: live(w.cards).filter((c) => !c.suspended && Date.parse(c.due_at) <= endOfDay).length,
        inbox_count: live(w.signals).filter((s) => s.status === 'pending').length,
        pace: live(w.goals).filter((g) => g.kind === 'self' && g.status === 'active').map((g) => paceFor(w, g)),
      }
      save()
      return later(today, 120)
    },

    rebuildPlan(date) {
      planFor(load(), date)
      save()
      return later(undefined, 300)
    },

    readiness(deadlineId) {
      const w = load()
      const d = w.deadlines.find((x) => x.id === deadlineId)
      if (!d) return Promise.reject(new Error('Not found'))
      return later(computeReadiness(d, w), 120)
    },

    applySignal(id, factIndexes) {
      const w = load()
      const signal = w.signals.find((s) => s.id === id)
      if (!signal) return Promise.reject(new Error('Not found'))
      signal.facts.forEach((fact, i) => {
        if (!factIndexes || factIndexes.includes(i)) applyFact(w, signal, fact)
      })
      signal.status = 'applied'
      signal.applied_at = nowIso()
      touch(signal)
      planFor(w, dayKey())
      save()
      return later(undefined, 200)
    },

    dismissSignal(id) {
      const w = load()
      const signal = w.signals.find((s) => s.id === id)
      if (signal) {
        signal.status = 'dismissed'
        touch(signal)
      }
      save()
      return later(undefined)
    },

    reviewCard(id, review) {
      const w = load()
      const card = w.cards.find((c) => c.id === id)
      if (!card) return Promise.reject(new Error('Not found'))
      card.fsrs = review.fsrs
      card.due_at = review.due_at
      card.last_review_at = review.reviewed_at
      touch(card)
      save()
      return later(card as Card)
    },

    startCheck(body) {
      const w = load()
      const now = Date.now()
      const keys = (w.check_keys ??= {})
      const batches = (w.check_batches ??= {})
      const scope = JSON.stringify([body.purpose, body.deadline_id ?? null, body.subject_id ?? null, [...(body.topic_ids ?? [])].sort()])

      // An unfinished sitting on the same thing, from this week, comes back whole.
      const open = live(w.checks).find(
        (c) => !c.result && batches[c.batch_id] === scope && now - Date.parse(c.asked_at) < 7 * 86_400_000,
      )
      if (open) {
        const sitting: CheckSitting = { batch_id: open.batch_id, checks: live(w.checks).filter((c) => c.batch_id === open.batch_id), opens_at: null }
        return later(sitting, 250)
      }

      const deadline = live(w.deadlines).find((d) => d.id === body.deadline_id) ?? null
      const onShelf = (id: string) => live(w.subjects).some((s) => s.id === id && !s.archived_at)
      const parents = new Set(w.topics.map((t) => t.parent_id).filter(Boolean))
      const named = live(w.topics).filter((t) => body.topic_ids?.includes(t.id))
      const inReach = named.length
        ? named
        : deadline
          ? scopeOf(deadline, w.topics)
          : live(w.topics).filter((t) => !parents.has(t.id) && (body.subject_id ? t.subject_id === body.subject_id : onShelf(t.subject_id)))

      let picked: { topic: Topic; count: number }[]
      if (body.purpose === 'teach') picked = named.slice(0, 1).map((topic) => ({ topic, count: 1 }))
      else if (body.purpose === 'prepare') {
        // What the assessment needs, starting where nothing is proven yet, then the heaviest.
        const ranked = inReach
          .map((topic) => ({ topic, row: topicCheck(topic, w, now) }))
          .sort((a, b) => Number(a.row.state === 'checked') - Number(b.row.state === 'checked') || (b.topic.weight ?? 1) - (a.topic.weight ?? 1))
          .slice(0, 3)
        picked = ranked.map(({ topic }, i) => ({ topic, count: ranked.length === 1 ? 3 : ranked.length === 2 && i === 0 ? 2 : 1 }))
      } else if (named.length) picked = named.slice(0, SITTING_TOPICS).map((topic) => ({ topic, count: 2 }))
      else {
        picked = pickDue(w, { deadlineId: deadline?.id, subjectId: body.subject_id, onShelf }, now)
          .slice(0, SITTING_TOPICS)
          .map(({ topic }) => ({ topic, count: 2 }))
      }

      if (!picked.length) {
        // When the next topic in reach turns cold and is due; null when none is waiting.
        const opens = inReach
          .map((t) => opensAt(topicCheck(t, w, now)))
          .filter((x): x is string => !!x && Date.parse(x) > now)
          .sort()[0] ?? null
        return later<CheckSitting>({ batch_id: null, checks: [], opens_at: opens }, 600)
      }

      // Mixed, not blocked: one question from each topic in turn.
      const asked = nowIso()
      const batch = uuid()
      const drafts = picked.map(({ topic, count }) => ({
        topic,
        row: topicCheck(topic, w, now),
        questions: writeQuestions(
          w,
          topic,
          count,
          body.purpose === 'teach' ? 'explain' : undefined,
          live(w.checks).filter((k) => k.topic_id === topic.id).length,
        ),
      }))
      const order: { topic: Topic; row: (typeof drafts)[number]['row']; q: DemoQuestion }[] = []
      for (let n = 0; order.length < drafts.reduce((sum, d) => sum + d.questions.length, 0); n++) {
        for (const d of drafts) if (d.questions[n]) order.push({ topic: d.topic, row: d.row, q: d.questions[n]! })
      }
      const rows: Check[] = order.map(({ topic, row, q }, i) => {
        const id = uuid()
        keys[id] = q.expected
        // A second apart, as the server staggers them: asked_at is the order to ask in.
        const at = isoWithOffset(new Date(now + i * 1000))
        return {
          id,
          created_at: asked,
          updated_at: asked,
          deleted_at: null,
          batch_id: batch,
          purpose: body.purpose,
          subject_id: topic.subject_id,
          topic_id: topic.id,
          deadline_id: deadline?.id ?? null,
          kind: q.kind,
          prompt: q.prompt,
          source: q.source,
          // Cold: long enough since it was studied, or never studied at all.
          cold: !row.checkable_at,
          studied_days_ago: row.last_studied_at ? Math.floor((now - Date.parse(row.last_studied_at)) / 86_400_000) : null,
          confidence: null,
          answer: null,
          follow_up: null,
          follow_up_answer: null,
          result: null,
          feedback: null,
          revealed: null,
          tempting: null,
          asked_at: at,
          answered_at: null,
          graded_at: null,
        }
      })
      w.checks.push(...rows)
      batches[batch] = scope
      save()
      return later<CheckSitting>({ batch_id: batch, checks: rows, opens_at: null }, 1600)
    },

    answerCheck(id, body) {
      const w = load()
      const check = w.checks.find((c) => c.id === id && !c.deleted_at)
      if (!check) return Promise.reject(new Error('Not found'))
      if (check.result) return later(check)
      const topic = w.topics.find((t) => t.id === check.topic_id) ?? null
      const now = nowIso()

      // Teach-back: the first answer gets the listener's one question, not a mark.
      if (check.kind === 'explain' && !check.follow_up && body.answer.trim()) {
        check.answer = body.answer
        check.confidence = body.confidence ?? null
        check.answered_at = now
        check.follow_up = topic ? followUpFor(topic) : 'A question back: why does it work that way, and not some simpler way?'
        touch(check)
        save()
        return later(check, 1400)
      }

      if (check.kind === 'explain' && check.follow_up) check.follow_up_answer = body.follow_up_answer ?? ''
      else {
        check.answer = body.answer
        check.confidence = body.confidence ?? null
      }
      const said = [check.answer, check.follow_up_answer].filter(Boolean).join(' ')
      const expected = w.check_keys?.[check.id] ?? ''
      const mark = markAnswer({ expected }, said, check.confidence, topic, topic ? neighbourOf(w, topic) : null)
      Object.assign(check, {
        result: mark.result,
        feedback: mark.feedback,
        tempting: mark.tempting,
        revealed: expected,
        answered_at: check.answered_at ?? now,
        graded_at: now,
      })
      touch(check)

      // The sitting's last mark, as on the server: a cold sitting is today's
      // check done, and the plan is rebuilt so each miss joins it at once.
      const sitting = w.checks.filter((c) => c.batch_id === check.batch_id && !c.deleted_at)
      if (sitting.every((c) => c.result)) {
        const today = dayKey()
        if (check.purpose === 'cold') {
          for (const t of w.plan_tasks) {
            if (t.date === today && t.kind === 'check' && !t.done_at && !t.deleted_at) touch(Object.assign(t, { done_at: now }))
          }
        }
        planFor(w, today)
      }
      save()
      // An empty answer is "I don't know": marked at once, no model.
      return later(check, said.trim() ? 700 + Math.round(Math.random() * 900) : 120)
    },

    classOf(deadlineId) {
      const w = load()
      const d = live(w.deadlines).find((x) => x.id === deadlineId)
      if (!d) return Promise.reject(new Error('Not found'))
      const subject = live(w.subjects).find((s) => s.id === d.subject_id)
      const invite = {
        title: `${d.title}${subject ? ` · ${subject.title}` : ''}`,
        text: `I'm getting ready for ${d.title}${subject ? ` in ${subject.title}` : ''} on BiliMind. Join, and we can all see how ready the class is.`,
        url: `${import.meta.client ? window.location.origin : ''}/?ref=class`,
      }
      // Only a course from Moodle can be matched to classmates; Italian on her own has no class.
      if (subject?.source !== 'moodle') {
        return later<ClassView>({ possible: false, members: 1, shown: false, preparing: null, readiness_median: null, hardest: [], sharing: true, invite }, 300)
      }
      const scope = scopeOf(d, w.topics)
      const hardest = scope.slice(-2).reverse().map((t, i) => ({ title: t.title, missed_pct: i ? 41 : 48 }))
      return later<ClassView>({ possible: true, members: 14, shown: true, preparing: 9, readiness_median: 55, hardest, sharing: true, invite }, 300)
    },

    pageDoc(itemId) {
      load()
      return later(docs[itemId] ?? { snapshot: null, updates: [] })
    },

    pushDocUpdate(itemId, update) {
      load()
      const doc = (docs[itemId] ??= { snapshot: null, updates: [] })
      doc.updates.push({ id: uuid(), update, created_at: nowIso() })
      const item = world?.items.find((i) => i.id === itemId)
      if (item) touch(item)
      save()
      return later(undefined, 20)
    },

    async upload(file, where) {
      const w = load()
      const isImage = file.type.startsWith('image/')
      // A small image travels as a data: URL, so it survives a reload with the
      // rest of the demo; anything bigger gets an object URL for this tab only.
      const url = isImage && file.size <= 1_500_000 ? await asDataUrl(file) : URL.createObjectURL(file)
      const item: Item = {
        id: uuid(),
        created_at: nowIso(),
        updated_at: nowIso(),
        deleted_at: null,
        subject_id: where.subject_id ?? null,
        session_id: where.session_id ?? null,
        topic_id: w.sessions.find((s) => s.id === where.session_id)?.topic_id ?? null,
        parent_id: null,
        kind: isImage ? 'photo' : 'file',
        title: file.name,
        preview: null,
        meta: { mime: file.type, size: file.size, path: url, url },
        source: 'made',
        source_ref: null,
        position: w.items.length,
        pinned: false,
      }
      w.items.push(item)
      save()
      return later(item, 400)
    },

    ingestText(text, channel, subjectId) {
      const w = load()
      const signal = parseText(w, text, channel, subjectId)
      // The same news shared twice (two classmates, or a share and a paste)
      // is one signal: hand back the one already waiting.
      const fact = signal.facts[0]
      const twin = fact && fact.type !== 'note'
        ? live(w.signals).find((s) => s.status === 'pending' && s.facts.some((f) =>
          f.type === fact.type && f.target_id === fact.target_id && f.payload.due_at === fact.payload.due_at))
        : undefined
      if (twin) return later([twin], 500)
      w.signals.push(signal)
      save()
      return later([signal], 700)
    },

    ingestIcs(source) {
      const w = load()
      const existing = w.connections.find((c) => c.kind === 'ics')
      const url = 'url' in source ? source.url : null
      const conn: Connection = existing ?? {
        id: uuid(),
        created_at: nowIso(),
        updated_at: nowIso(),
        deleted_at: null,
        kind: 'ics',
        label: 'Timetable feed',
        url,
        site_url: null,
        status: 'ok',
        last_synced_at: nowIso(),
        error: null,
        meta: {},
      }
      if (existing) {
        existing.url = url ?? existing.url
        existing.last_synced_at = nowIso()
        existing.status = 'ok'
        touch(existing)
      } else w.connections.push(conn)
      save()
      return later({ connection: conn, created: { slots: 0, sessions: 0, deadlines: 0 }, updated: live(w.slots).length }, 900)
    },

    ingestFile(file) {
      const w = load()
      const today = dayKey()
      const evidence = `From ${file.name}: a weekly class you don't have yet.`
      const signal: Signal = {
        id: uuid(),
        created_at: nowIso(),
        updated_at: nowIso(),
        deleted_at: null,
        channel: file.type.startsWith('image/') ? 'photo' : 'pdf',
        raw_excerpt: evidence,
        item_id: null,
        at_seconds: null,
        subject_id: sid('subject:seg'),
        facts: [{
          type: 'slot.create',
          subject_guess: { id: sid('subject:seg'), title: 'Software Engineering', code: 'SEG2101' },
          target_id: null,
          payload: { kind: 'lab', weekday: 2, starts_at: '16:00', ends_at: '17:30', location: 'Lab C-110', valid_from: today },
          evidence,
        }],
        confidence: 'shared',
        status: 'pending',
        applied_at: null,
      }
      w.signals.push(signal)
      save()
      return later([signal], 1200)
    },

    goalFromSentence(sentence, answers) {
      const w = load()
      if (!answers || !Object.keys(answers).length) {
        return later<GoalDraft>({
          questions: [
            { id: 'why', question: 'What is it for?', options: ['A semester abroad', 'Work', 'Travel', 'Just because'] },
            { id: 'time', question: 'How long can you study on a normal day?', options: ['15 minutes', '25 minutes', '45 minutes'] },
          ],
        }, 700)
      }
      return later(draftFromSentence(w, sentence, answers), 1400)
    },
  }
}

function defaults(collection: CollectionName): Partial<Row> & Record<string, unknown> {
  switch (collection) {
    case 'items':
      return { subject_id: null, session_id: null, topic_id: null, parent_id: null, preview: null, meta: {}, source: 'made', source_ref: null, position: 0, pinned: false }
    case 'deadlines':
      return { all_day: false, weight_pct: null, location: null, status: 'upcoming', confidence: 'own', confirmed: false, scope_note: null, grade: null, readiness_said: null, source_ref: null, topic_ids: [], sources: [] }
    case 'subjects':
      return { try_first: false }
    case 'sessions':
      return { slot_id: null, number: null, location: null, week: null, topic_id: null, cancelled: false, source_ref: null }
    case 'topics':
      return { parent_id: null, summary: null, source: 'manual', weight: 1, node_id: null }
    case 'slots':
      return { location: null, valid_from: null, valid_until: null, source_ref: null }
    case 'plan-tasks':
      return { subject_id: null, deadline_id: null, topic_id: null, item_id: null, detail: null, done_at: null }
    default:
      return {}
  }
}
