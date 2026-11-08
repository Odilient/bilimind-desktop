/**
 * Deadlines, tasks, grades and cards as tables: what goes into the
 * spreadsheet, the CSVs and the Anki file. Columns are named in the app's
 * words ("Due", "Grade %", "Handed in"), dates are the learner's own clock
 * (`time.ts`), and each row says its course, so the whole-account sheet
 * sorts and filters by course.
 *
 * The store holds every deadline, but only some tasks and cards (bootstrap
 * sends a window of the plan and the cards that are due), so tasks and cards
 * are listed from the server for an export and fall back to what's on the
 * device when it can't be reached. Tasks are the learner's own (`kind:
 * 'own'`): the generated study plan is a schedule BiliMind redraws every
 * day, not a list anyone keeps.
 */
import { countsToward, runningGrade } from '../grades'
import type { CompanionStore } from '../store'
import { dayKey, parts } from '../time'
import type { Card, Deadline, PlanTask } from '../types'
import { kindWord, knownBy } from '../words'
import { anki, csv, xlsx, type AnkiCard, type Cell, type Sheet } from './formats'

/** Which rows: one course, My notes (null; cards only), or everything (undefined). */
export type Scope = string | null | undefined

function inScope(subjectId: string | null, scope: Scope): boolean {
  return scope === undefined || subjectId === scope
}

/** An instant as the learner's wall-clock date (and time, unless it's all day). */
function when(iso: string | null | undefined, allDay = false): Cell {
  if (!iso) return null
  if (allDay) return { when: dayKey(iso) }
  const p = parts(iso)
  return { when: `${dayKey(iso)} ${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}` }
}

const STATUS: Record<Deadline['status'], string> = {
  upcoming: 'Coming up',
  submitted: 'Handed in',
  done: 'Done',
  missed: 'Missed',
  cancelled: 'Cancelled',
}

function courseName(c: CompanionStore, id: string | null): string {
  return id ? (c.get('subjects', id)?.title ?? '') : 'My notes'
}

function deadlines(c: CompanionStore, scope: Scope): Deadline[] {
  return c.deadlines.value.filter((d) => inScope(d.subject_id, scope))
}

export function deadlineSheet(c: CompanionStore, scope: Scope): Sheet {
  return {
    name: 'Deadlines',
    head: ['Course', 'What', 'Kind', 'Due', 'Status', 'Weight %', 'Grade %', 'Where', 'Covers', 'Known from'],
    rows: deadlines(c, scope).map((d) => [
      courseName(c, d.subject_id),
      d.title,
      kindWord(d.kind),
      when(d.due_at, d.all_day),
      STATUS[d.status],
      d.weight_pct,
      d.grade,
      d.location,
      d.scope_note,
      // As the course's Deadlines view says it.
      d.confidence === 'official' || d.confirmed ? 'Official' : (knownBy(d) ?? 'Not confirmed yet'),
    ]),
  }
}

/**
 * Everything that counts toward a grade, or has one, course by course, each
 * course closed by its running grade: the same number the app says
 * (`runningGrade`), so the file and the Grades view never disagree.
 */
export function gradeSheet(c: CompanionStore, scope: Scope): Sheet {
  const byCourse = new Map<string, Deadline[]>()
  for (const d of deadlines(c, scope)) byCourse.set(d.subject_id, [...(byCourse.get(d.subject_id) ?? []), d])
  const rows: Cell[][] = []
  for (const [id, list] of [...byCourse].sort(([a], [b]) => courseName(c, a).localeCompare(courseName(c, b)))) {
    const course = courseName(c, id)
    const counted = list.filter((d) => countsToward(d) && (d.weight_pct != null || d.grade != null))
    for (const d of counted) rows.push([course, d.title, kindWord(d.kind), d.weight_pct, d.grade, when(d.due_at, d.all_day)])
    const running = runningGrade(list)
    if (running) rows.push([course, 'Running grade so far', null, null, running.percent, null])
  }
  return { name: 'Grades', head: ['Course', 'Assessment', 'Kind', 'Weight %', 'Grade %', 'Due'], rows }
}

export async function ownTasks(c: CompanionStore, scope: Scope): Promise<PlanTask[]> {
  let tasks: PlanTask[]
  try {
    tasks = await c.repo().list<PlanTask>('plan-tasks', { kind: 'own' })
  } catch {
    tasks = c.planTasks.value.filter((t) => t.kind === 'own')
  }
  return tasks.filter((t) => !t.deleted_at && inScope(t.subject_id, scope))
}

export function taskSheet(c: CompanionStore, tasks: PlanTask[]): Sheet {
  return {
    name: 'Tasks',
    head: ['Date', 'Task', 'Course', 'Minutes', 'Done on', 'Notes'],
    rows: tasks.map((t) => [
      t.date ? { when: t.date } : null,
      t.title,
      t.subject_id ? courseName(c, t.subject_id) : '',
      t.minutes || null,
      when(t.done_at, true),
      t.detail,
    ]),
  }
}

/** The workbook: deadlines always, tasks and grades when there are any. */
export async function spreadsheet(c: CompanionStore, scope: Scope): Promise<Uint8Array> {
  const tasks = taskSheet(c, await ownTasks(c, scope))
  const grades = gradeSheet(c, scope)
  return xlsx([deadlineSheet(c, scope), ...(tasks.rows.length ? [tasks] : []), ...(grades.rows.length ? [grades] : [])])
}

export function deadlinesCsv(c: CompanionStore, scope: Scope): string {
  const sheet = deadlineSheet(c, scope)
  return csv(sheet.head, sheet.rows)
}

export async function tasksCsv(c: CompanionStore, scope: Scope): Promise<string> {
  const sheet = taskSheet(c, await ownTasks(c, scope))
  return csv(sheet.head, sheet.rows)
}

/* -- Cards -------------------------------------------------------------------- */

async function cardsOf(c: CompanionStore, scope: Scope): Promise<Card[]> {
  let cards: Card[]
  try {
    cards = await c.repo().list<Card>('cards', scope === undefined ? {} : { subject_id: scope ?? 'null' })
  } catch {
    cards = c.cards.value
  }
  return cards.filter((k) => !k.deleted_at && !k.suspended && inScope(k.subject_id, scope))
}

export interface CardFiles {
  count: number
  /** Anki's text import, one deck: "BiliMind::Databases". */
  anki: string
  csv: string
}

export async function cardFiles(c: CompanionStore, scope: Scope): Promise<CardFiles> {
  const cards = await cardsOf(c, scope)
  const topic = (k: Card) => c.get('topics', k.topic_id)?.title ?? ''
  const deck = scope === undefined ? 'BiliMind' : `BiliMind::${courseName(c, scope)}`
  const notes: AnkiCard[] = cards.map((k) => ({
    id: k.id,
    front: k.front,
    back: k.back,
    tags: [courseName(c, k.subject_id), topic(k)],
  }))
  return {
    count: cards.length,
    anki: anki(deck, notes),
    csv: csv(
      ['Front', 'Back', 'Course', 'Topic', 'Next review'],
      cards.map((k) => [k.front, k.back, courseName(c, k.subject_id), topic(k), when(k.due_at, true)]),
    ),
  }
}
