/**
 * Tasks (`/app/tasks`): one answer to "what do I have to do?". Two kinds of
 * thing are on it, side by side:
 *
 *  - the learner's own tasks, `plan_tasks.kind = 'own'`: typed here or on
 *    Today, with a course and a day if they like (both optional: a task with
 *    no day waits under "No date"), a note (`detail`) and a tick. The planner
 *    never writes, moves or deletes one;
 *  - their courses' deadlines with a date: ticked as handed in (or done, for
 *    a test), opened on their own page. Their date is the school's, so it is
 *    never moved from here.
 *
 * What the planner writes (reviews, reading, checks, lessons) is the day's
 * plan, not a to-do the learner keeps: it stays on Today and the Calendar.
 *
 *   taskGroups(c.planTasks.value, c.deadlines.value)   // Overdue … Done
 *   await addTask(c, { text: 'Email Dr. Rahimova 10 min', subject_id, date })
 *   await moveTask(c, task, shiftDay(today, 1))
 *
 * Groups, by the day each falls on in the learner's zone: Overdue, Today,
 * This week (the next six days, so a weekday name is never ambiguous),
 * Later, No date, Done. Two rules keep Overdue from becoming the red wall of
 * debts the old product was told off for:
 *  - a test whose time has passed is over, not overdue: it leaves the list
 *    (its mark goes in the course's Grades);
 *  - a hand-in counts as overdue for two weeks after its date. An LMS keeps
 *    every unsubmitted assignment of the term "upcoming", so a learner who
 *    connects Moodle in week 8 would otherwise open on twenty of them.
 * Done shows what was ticked in the last two weeks, newest first.
 *
 * Nothing here draws or toasts: the page does. The grouping is pure (no
 * store, no clock but `now`), so `scripts/check-tasks-grades.ts` can run it.
 */
import type { ChecklistItem, Deadline, DeadlineKind, IsoDate, PlanTask, Priority, Subject, Uuid } from './types'
import type { CompanionStore } from './store'
import { translate } from '../utils/i18n'
import { clock, dayKey, daysBetween, durationLabel, mondayOf, nowIso, relativeDay, shiftDay, weekdayShort, whenLabel } from './time'

export type TaskGroupKey = 'overdue' | 'today' | 'week' | 'later' | 'none' | 'done'

export type TaskEntry =
  | { kind: 'task'; id: Uuid; day: IsoDate | null; task: PlanTask }
  | { kind: 'deadline'; id: Uuid; day: IsoDate | null; deadline: Deadline }

export interface TaskGroup {
  key: TaskGroupKey
  label: string
  entries: TaskEntry[]
}


const ORDER: TaskGroupKey[] = ['overdue', 'today', 'week', 'later', 'none', 'done']

/** How long after its date an unticked hand-in still shows as overdue. */
export const OVERDUE_DAYS = 14
/** How long a ticked thing stays under Done. */
export const DONE_DAYS = 14

/** Tests are sat, not handed in (`Deadline::RECALL_KINDS` on the server). */
const TESTS = new Set<Deadline['kind']>(['quiz', 'midterm', 'final', 'exam'])

/** What a ticked deadline becomes: a test is done, anything made is handed in. */
export function tickedStatus(d: Deadline): Deadline['status'] {
  return TESTS.has(d.kind) ? 'done' : 'submitted'
}

export function isDone(entry: TaskEntry): boolean {
  return entry.kind === 'task'
    ? Boolean(entry.task.done_at)
    : entry.deadline.status === 'done' || entry.deadline.status === 'submitted'
}

function slot(day: IsoDate | null, today: IsoDate): TaskGroupKey {
  if (!day) return 'none'
  const ahead = daysBetween(today, day)
  if (ahead < 0) return 'overdue'
  if (ahead === 0) return 'today'
  return ahead <= 6 ? 'week' : 'later'
}

/** Where an entry sits on its day: the school's by their time, the learner's own in their order. */
function within(entry: TaskEntry): number {
  return entry.kind === 'deadline' ? Date.parse(entry.deadline.due_at!) : entry.task.position
}

/** Day first (a group's days are all set or all null); on one day the most pressing, then deadlines before own tasks. */
function byDay(a: TaskEntry, b: TaskEntry): number {
  if (a.day !== b.day) return (a.day ?? '') < (b.day ?? '') ? -1 : 1
  if (priorityOf(a) !== priorityOf(b)) return priorityOf(b) - priorityOf(a)
  if (a.kind !== b.kind) return a.kind === 'deadline' ? -1 : 1
  return within(a) - within(b)
}

/** When it was ticked, for Done's newest-first order; a deadline's last change stands in. */
function doneAt(entry: TaskEntry): number {
  const at = entry.kind === 'task' ? entry.task.done_at : (entry.deadline.updated_at ?? entry.deadline.due_at)
  return at ? Date.parse(at) : 0
}

/**
 * Every task and dated deadline, grouped. `tasks` may be all of the plan's
 * rows (only `own` ones are taken), `deadlines` all of the learner's. Empty
 * groups are left out.
 */
export function taskGroups(tasks: PlanTask[], deadlines: Deadline[], now = Date.now()): TaskGroup[] {
  const today = dayKey(now)
  const groups = Object.fromEntries(ORDER.map((key) => [key, [] as TaskEntry[]])) as Record<TaskGroupKey, TaskEntry[]>

  for (const task of tasks) {
    if (task.kind !== 'own' || task.deleted_at) continue
    const entry: TaskEntry = { kind: 'task', id: task.id, day: task.date, task }
    if (task.done_at) {
      if (daysBetween(dayKey(task.done_at), today) <= DONE_DAYS) groups.done.push(entry)
    } else {
      groups[slot(task.date, today)].push(entry)
    }
  }

  for (const d of deadlines) {
    // Undated, cancelled or missed: nothing to do on a day. Undated ones live
    // in their course (Deadlines, Grades), where a date can be given.
    if (!d.due_at || d.deleted_at || d.status === 'cancelled' || d.status === 'missed') continue
    const day = dayKey(d.due_at)
    const ago = daysBetween(day, today)
    const entry: TaskEntry = { kind: 'deadline', id: d.id, day, deadline: d }
    if (d.status === 'done' || d.status === 'submitted') {
      if (ago <= DONE_DAYS) groups.done.push(entry)
      continue
    }
    if (Date.parse(d.due_at) <= now) {
      if (!TESTS.has(d.kind) && ago <= OVERDUE_DAYS) groups.overdue.push(entry)
      continue
    }
    groups[slot(day, today)].push(entry)
  }

  for (const key of ORDER) groups[key].sort(key === 'done' ? (a, b) => doneAt(b) - doneAt(a) : byDay)
  return ORDER.filter((key) => groups[key].length).map((key) => ({ key, label: translate(`tasks.group.${key}`), entries: groups[key] }))
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * The row's "when": "Thu", "Tomorrow", "Thu 29 Oct" for a task, with its
 * time when it has one ("Wed 14:00"); a deadline adds its time ("Thu 23:59").
 * Under Today the day goes without saying, so only the time is said.
 */
export function entryWhen(entry: TaskEntry, group: TaskGroupKey, now = Date.now()): string {
  if (entry.kind === 'task') {
    const { date, starts_at: at } = entry.task
    if (!date) return ''
    if (group === 'today') return at ?? ''
    return [cap(relativeDay(date, dayKey(now))), at].filter(Boolean).join(' ')
  }
  const d = entry.deadline
  if (group === 'today') return d.all_day ? '' : clock(d.due_at!)
  return cap(whenLabel(d.due_at!, d.all_day))
}

/* -- The board ---------------------------------------------------------------- */

/** Tasks as a board (8 Nov 2026): what to do, what's started, what's done. */
export type TaskColumn = 'todo' | 'doing' | 'done'

// Getters, not strings: read when drawn, so they follow the language.
export const COLUMN_LABELS: Record<TaskColumn, string> = {
  get todo() { return translate('tasks.col.todo') },
  get doing() { return translate('tasks.col.doing') },
  get done() { return translate('tasks.col.done') },
}

/** One card: the entry, and the group it fell in, for its date chip. */
export interface BoardCard {
  entry: TaskEntry
  group: TaskGroupKey
}

export function columnOf(entry: TaskEntry): TaskColumn {
  if (isDone(entry)) return 'done'
  return (entry.kind === 'task' ? entry.task.started_at : entry.deadline.started_at) ? 'doing' : 'todo'
}

/**
 * The groups laid out as three columns. They come in date order (Overdue
 * first, No date last), so each column keeps it; Done stays newest first.
 */
export function taskColumns(groups: TaskGroup[]): Record<TaskColumn, BoardCard[]> {
  const columns: Record<TaskColumn, BoardCard[]> = { todo: [], doing: [], done: [] }
  for (const group of groups) {
    for (const entry of group.entries) columns[columnOf(entry)].push({ entry, group: group.key })
  }
  return columns
}

/**
 * Put a card in a column. Done is the tick (a deadline handed in or sat);
 * Doing stamps `started_at`, which a later tick keeps, so un-ticking puts it
 * back in Doing; To do clears both.
 */
export async function setColumn(store: CompanionStore, entry: TaskEntry, column: TaskColumn): Promise<void> {
  if (columnOf(entry) === column) return
  const started = column === 'todo' ? null : column === 'doing' ? nowIso() : undefined
  if (entry.kind === 'task') {
    await store.upsert<PlanTask>('plan-tasks', {
      id: entry.id,
      done_at: column === 'done' ? nowIso() : null,
      ...(started !== undefined ? { started_at: started } : {}),
    })
    return
  }
  const d = entry.deadline
  const status = column === 'done' ? tickedStatus(d) : 'upcoming'
  await store.upsert<Deadline>('deadlines', {
    id: d.id,
    // Only a real change of status is sent: it writes a "Changed by you" line in the deadline's history.
    ...(status !== d.status ? { status } : {}),
    ...(started !== undefined ? { started_at: started } : {}),
  })
}

/* -- Writes ------------------------------------------------------------------- */

/**
 * "Read chapter 3 30 min": a sentence, and the minutes when it ends in some
 * (Today's "Add a task" reads them the same way). Minutes only say how much
 * of a day a dated task takes from the plan; 15 when not said.
 */
export function parseTask(text: string): { title: string; minutes: number } {
  const clean = text.trim()
  const match = clean.match(/\s*(\d{1,3})\s*(?:m|min|mins|minutes)\.?$/i)
  const minutes = match ? Math.min(600, Math.max(1, Number(match[1]))) : 15
  return { title: match ? clean.slice(0, match.index).trim() || clean : clean, minutes }
}

/** The next place at the end of a day's (or the undated) list, so a new or moved task goes last. */
function endOf(store: CompanionStore, date: IsoDate | null): number {
  return store.planTasks.value.filter((t) => t.date === date).reduce((m, t) => Math.max(m, t.position), 0) + 1
}

export async function addTask(
  store: CompanionStore,
  input: {
    text: string
    subject_id: Uuid | null
    date: IsoDate | null
    detail?: string | null
    starts_at?: string | null
    /** New task's pickers; the quick add leaves them to the words and the defaults. */
    minutes?: number
    priority?: Priority
    column?: TaskColumn
  },
): Promise<PlanTask | null> {
  const parsed = parseTask(input.text)
  const title = parsed.title
  const minutes = input.minutes ?? parsed.minutes
  if (!title) return null
  return store.upsert<PlanTask>('plan-tasks', {
    id: crypto.randomUUID(),
    date: input.date,
    subject_id: input.subject_id,
    deadline_id: null,
    topic_id: null,
    item_id: null,
    kind: 'own',
    title: title.slice(0, 300),
    detail: input.detail?.trim() || null,
    minutes,
    position: endOf(store, input.date),
    done_at: null,
    generated_at: nowIso(),
    // A time is a time on a day (the server refuses one without).
    starts_at: input.date ? (input.starts_at ?? null) : null,
    priority: input.priority ?? 0,
    // Made straight into Doing or Done, as a column's "+" can.
    started_at: input.column && input.column !== 'todo' ? nowIso() : null,
    ...(input.column === 'done' ? { done_at: nowIso() } : {}),
  })
}

/** One write for the edit dialog's Save; a new day also puts it at the end of that day. */
export async function editTask(
  store: CompanionStore,
  task: PlanTask,
  changes: Partial<Pick<PlanTask, 'title' | 'detail' | 'subject_id' | 'date' | 'starts_at' | 'minutes'>>,
): Promise<void> {
  const moving = changes.date !== undefined && changes.date !== task.date
  await store.upsert<PlanTask>('plan-tasks', {
    id: task.id,
    ...changes,
    ...(moving ? { position: endOf(store, changes.date ?? null) } : {}),
    // Off its day, a task can't keep an hour (the server refuses one without).
    ...(changes.date === null ? { starts_at: null } : {}),
  })
}

/** Another day, or none. */
export async function moveTask(store: CompanionStore, task: PlanTask, date: IsoDate | null): Promise<void> {
  if (task.date !== date) await editTask(store, task, { date })
}

/** The tick: a task is done or not; a deadline handed in (or sat) or back to upcoming. */
export async function toggleEntry(store: CompanionStore, entry: TaskEntry): Promise<void> {
  if (entry.kind === 'task') {
    await store.upsert<PlanTask>('plan-tasks', { id: entry.id, done_at: entry.task.done_at ? null : nowIso() })
    return
  }
  const d = entry.deadline
  await store.upsert<Deadline>('deadlines', { id: d.id, status: isDone(entry) ? 'upcoming' : tickedStatus(d) })
}

/* -- The tracker -------------------------------------------------------------- */

/*
 * Tasks as a tracker (8 Nov 2026, after adgen-new's to-do): every card has a
 * priority, a note and a checklist of steps, opened on its own page
 * (`/app/tasks/{id}`). The same three on a deadline are the learner's, never
 * the school's: an LMS sync leaves them be. A task's note is its `detail`; a
 * deadline's is `notes` (its `scope_note` is the school's).
 */

export const PRIORITY_LABELS: Record<Priority, string> = {
  get 0() { return translate('tasks.priority.none') },
  get 1() { return translate('tasks.priority.low') },
  get 2() { return translate('tasks.priority.medium') },
  get 3() { return translate('tasks.priority.high') },
  get 4() { return translate('tasks.priority.urgent') },
}

/** A picker's order, a tracker's: none, then the most pressing down. */
export const PRIORITY_ORDER: Priority[] = [0, 4, 3, 2, 1]

export const KIND_LABELS = new Proxy({} as Record<DeadlineKind, string>, {
  get: (_, kind) => translate(`tasks.kind.${String(kind)}`),
})

export function priorityOf(entry: TaskEntry): Priority {
  return (entry.kind === 'task' ? entry.task.priority : entry.deadline.priority) ?? 0
}

export function checklistOf(entry: TaskEntry): ChecklistItem[] {
  return (entry.kind === 'task' ? entry.task.checklist : entry.deadline.checklist) ?? []
}

export function notesOf(entry: TaskEntry): string {
  return (entry.kind === 'task' ? entry.task.detail : entry.deadline.notes) ?? ''
}

export function titleOf(entry: TaskEntry): string {
  return entry.kind === 'task' ? entry.task.title : entry.deadline.title
}

export function subjectIdOf(entry: TaskEntry): Uuid | null {
  return entry.kind === 'task' ? entry.task.subject_id : entry.deadline.subject_id
}

/** "Today", "Tomorrow", "Wed", "Thu 29 Oct": a day as a picker names it. */
export function relativeTo(date: IsoDate, today: IsoDate): string {
  return cap(relativeDay(date, today))
}

/** "30 min", "1 h 30 m": a task's length; a deadline has none. */
export function minutesLabel(minutes: number): string {
  return durationLabel(minutes * 60)
}

/** Priority, note and steps, on either kind: one write. */
export async function updateEntry(
  store: CompanionStore,
  entry: TaskEntry,
  changes: { priority?: Priority; notes?: string | null; checklist?: ChecklistItem[] | null },
): Promise<void> {
  const { notes, ...rest } = changes
  if (entry.kind === 'task') {
    await store.upsert<PlanTask>('plan-tasks', { id: entry.id, ...rest, ...(notes !== undefined ? { detail: notes } : {}) })
    return
  }
  await store.upsert<Deadline>('deadlines', { id: entry.id, ...rest, ...(notes !== undefined ? { notes } : {}) })
}

/**
 * One card by id, for its page: the learner's own task or a deadline, with
 * the group its day falls in (for the date chip's words). Null for anything
 * the board doesn't hold: a planner task, or a row that is gone.
 */
export function findEntry(tasks: PlanTask[], deadlines: Deadline[], id: Uuid, now = Date.now()): BoardCard | null {
  const today = dayKey(now)
  const task = tasks.find((t) => t.id === id && t.kind === 'own' && !t.deleted_at)
  if (task) {
    const entry: TaskEntry = { kind: 'task', id, day: task.date, task }
    return { entry, group: task.done_at ? 'done' : slot(task.date, today) }
  }
  const d = deadlines.find((x) => x.id === id && !x.deleted_at)
  if (!d) return null
  const day = d.due_at ? dayKey(d.due_at) : null
  const entry: TaskEntry = { kind: 'deadline', id, day, deadline: d }
  return { entry, group: isDone(entry) ? 'done' : slot(day, today) }
}

/** The board's filter: one course (or all), and words found in the title or the note. */
export function entryMatches(entry: TaskEntry, subjectId: Uuid | null, query: string): boolean {
  if (subjectId && subjectIdOf(entry) !== subjectId) return false
  const q = query.trim().toLowerCase()
  return !q || titleOf(entry).toLowerCase().includes(q) || notesOf(entry).toLowerCase().includes(q)
}

/** A choice in a property picker. */
export interface PropOption {
  key: string
  label: string
  hint?: string
}

/** The day picker's quick picks: today, tomorrow, the rest of this week by name, next Monday. */
export function dayOptions(today: IsoDate): PropOption[] {
  const out: PropOption[] = [
    { key: today, label: translate('tasks.day.today'), hint: weekdayShort(today) },
    { key: shiftDay(today, 1), label: translate('tasks.day.tomorrow'), hint: weekdayShort(shiftDay(today, 1)) },
  ]
  const monday = shiftDay(mondayOf(today), 7)
  for (let n = 2; n < 7; n++) {
    const key = shiftDay(today, n)
    if (key >= monday) break
    out.push({ key, label: relativeDay(key, today), hint: key.slice(8, 10).replace(/^0/, '') })
  }
  out.push({ key: monday, label: translate('tasks.day.nextWeek'), hint: `${weekdayShort(monday)} ${+monday.slice(8, 10)}` })
  return out
}

// Labels are getters so the lists, built once, still read in the current language.
export const STATUS_OPTIONS: PropOption[] = (['todo', 'doing', 'done'] as const).map((key) => ({
  key,
  get label() { return COLUMN_LABELS[key] },
}))

export const PRIORITY_OPTIONS: PropOption[] = PRIORITY_ORDER.map((p) => ({
  key: String(p),
  get label() { return PRIORITY_LABELS[p] },
}))

/** The shelf as a picker; '' is no course. */
export function courseOptions(subjects: Subject[]): PropOption[] {
  return [{ key: '', label: translate('tasks.course.none') }, ...subjects.map((s) => ({ key: s.id, label: s.title }))]
}

/** Every half hour from 07:00 to 23:30; typing "16" in the picker finds 16:00 and 16:30. */
export const TIME_OPTIONS: PropOption[] = Array.from({ length: 34 }, (_, i) => {
  const at = `${String(7 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`
  return { key: at, label: at }
})

export const DURATION_OPTIONS: PropOption[] = [15, 30, 45, 60, 90, 120, 180].map((m) => ({ key: String(m), get label() { return minutesLabel(m) } }))

/** Steps done out of steps, or null when there are none. */
export function checklistProgress(items: ChecklistItem[]): { done: number; total: number } | null {
  return items.length ? { done: items.filter((i) => i.done).length, total: items.length } : null
}
