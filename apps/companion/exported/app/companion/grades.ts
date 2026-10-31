/**
 * "What do I need on the final?" — the sum every student does on a napkin
 * the week before an exam, done from the course's own weights and grades.
 *
 * Grades are percentages (0–100). Work not marked yet is assumed to go the
 * way the marked work went, which is the honest middle guess; the screen
 * says so in a line under the answer, because a number without its
 * assumption is the kind of fact that makes people stop trusting the app.
 */
import type { Deadline } from './types'

export interface GradeTarget {
  label: string
  percent: number
}

/** Common bands. A school's own scale can replace these once a course carries one. */
export const TARGETS: GradeTarget[] = [
  { label: 'Pass', percent: 50 },
  { label: 'B', percent: 70 },
  { label: 'B+', percent: 75 },
  { label: 'A', percent: 85 },
]

export interface Needed {
  /** What the exam needs, 0–100, rounded up; below 0 or above 100 when out of play. */
  need: number
  state: 'reachable' | 'secured' | 'out-of-reach'
  /** The course total with full marks on the exam. */
  best: number
  /** Average over the marked work so far. */
  average: number
  /** Share of the grade already marked, 0–100. */
  markedWeight: number
  /** Unmarked work assumed to go like the average. */
  assumed: Deadline[]
}

export function neededOn(exam: Deadline, course: Deadline[], target: number): Needed | null {
  if (!exam.weight_pct) return null
  const weighted = course.filter((d) => d.weight_pct && d.status !== 'cancelled' && !d.deleted_at)
  const marked = weighted.filter((d) => d.id !== exam.id && d.grade != null)
  if (!marked.length) return null

  const total = weighted.reduce((sum, d) => sum + d.weight_pct!, 0)
  const markedWeight = marked.reduce((sum, d) => sum + d.weight_pct!, 0)
  const earned = marked.reduce((sum, d) => sum + (d.weight_pct! * d.grade!) / 100, 0)
  const average = (earned / markedWeight) * 100
  const assumed = weighted.filter((d) => d.id !== exam.id && d.grade == null)
  const assumedWeight = assumed.reduce((sum, d) => sum + d.weight_pct!, 0)
  const expected = earned + (average / 100) * assumedWeight

  const need = Math.ceil((((target / 100) * total - expected) / exam.weight_pct) * 100)
  const best = Math.round(((expected + exam.weight_pct) / total) * 100)
  return {
    need,
    state: need <= 0 ? 'secured' : need > 100 ? 'out-of-reach' : 'reachable',
    best,
    average: Math.round(average),
    markedWeight: Math.round((markedWeight / total) * 100),
    assumed,
  }
}
