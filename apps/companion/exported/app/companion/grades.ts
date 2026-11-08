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
import { translate } from '../utils/i18n'

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

/* -- The running grade ------------------------------ */

/**
 * "How am I doing in this course?": the grade so far, from the marks in, each
 * counting for its share of the grade (`weight_pct`). A course whose marks
 * carry no weights at all (Moodle often says none) gets the plain average,
 * every mark counting the same, and says so; once any mark has a weight, the
 * marks without one stop counting, because a 10% lab and a weightless quiz
 * can't be averaged honestly.
 *
 * What's still to come is the rest of the listed weight, so "averaging 78%
 * on 40% of the grade, 60% still to come" can be said, and the grade only
 * reads as finished once everything listed is marked and the weights reach
 * the whole grade.
 */
export interface RunningGrade {
  /** The grade so far, 0–100, rounded. */
  percent: number
  /** Marks counted. */
  marked: number
  /** False: no mark has a weight, so every mark counts the same. */
  weighted: boolean
  /** Weight already marked, in points of the grade (40 = 40% of it); 0 unweighted. */
  markedWeight: number
  /** Weight still to be marked, in points of the grade. */
  unmarkedWeight: number
  /** Every listed weight added up; under 100 when not every assessment is listed. */
  totalWeight: number
  /** What still counts and has no mark, soonest first (undated last). */
  unmarked: Deadline[]
  /** Everything listed is marked and the weights make the whole grade. */
  final: boolean
}

/** An assessment that counts toward the grade: not cancelled, not deleted. */
export function countsToward(d: Deadline): boolean {
  return !d.deleted_at && d.status !== 'cancelled'
}

/** `course`: one course's deadlines, in any order. Null until something is marked. */
export function runningGrade(course: Deadline[]): RunningGrade | null {
  const live = course.filter(countsToward)
  const marks = live.filter((d) => d.grade != null)
  if (!marks.length) return null

  const weighted = marks.some((d) => d.weight_pct)
  const counted = weighted ? marks.filter((d) => d.weight_pct) : marks
  const share = (d: Deadline): number => (weighted ? d.weight_pct! : 1)
  const sum = counted.reduce((s, d) => s + share(d), 0)
  const percent = Math.round(counted.reduce((s, d) => s + share(d) * d.grade!, 0) / sum)

  const unmarked = live
    .filter((d) => d.grade == null && (!weighted || d.weight_pct))
    .sort((a, b) => (a.due_at ? Date.parse(a.due_at) : Infinity) - (b.due_at ? Date.parse(b.due_at) : Infinity))
  const unmarkedWeight = unmarked.reduce((s, d) => s + (d.weight_pct ?? 0), 0)
  const totalWeight = live.reduce((s, d) => s + (d.weight_pct ?? 0), 0)

  return {
    percent,
    marked: counted.length,
    weighted,
    markedWeight: weighted ? sum : 0,
    unmarkedWeight,
    totalWeight,
    unmarked,
    // 99.5: weights typed as 33.3 + 33.3 + 33.3 are the whole grade.
    final: !unmarked.length && (!weighted || totalWeight >= 99.5),
  }
}

/**
 * The running grade said quietly, for the Courses shelf and a course's nav:
 * "Averaging 78%", or "Finished with 78%". Empty with nothing marked.
 */
export function gradeWords(r: RunningGrade | null): string {
  if (!r) return ''
  return translate(r.final ? 'grades.finishedWith' : 'grades.averaging', { percent: r.percent })
}

/**
 * What "the score you need" (`neededOn`, ExamTools) is about in a course's
 * Grades view: its final, else an exam, else the heaviest assessment still
 * to come. Only one with a weight and no mark yet, whose date hasn't passed.
 */
export function finalOf(course: Deadline[], now = Date.now()): Deadline | null {
  const open = course.filter(
    (d) => countsToward(d) && d.grade == null && d.weight_pct && (!d.due_at || Date.parse(d.due_at) > now),
  )
  return (
    open.find((d) => d.kind === 'final') ??
    open.find((d) => d.kind === 'exam') ??
    [...open].sort((a, b) => b.weight_pct! - a.weight_pct!)[0] ??
    null
  )
}

/**
 * Where a mark came from, when it wasn't typed here: Moodle's gradebook
 * writes a source whose evidence starts with "Moodle gradebook: "
 * (`MoodleWording::GRADEBOOK` on the server).
 */
export function gradeFromMoodle(d: Deadline): boolean {
  return d.grade != null && d.sources.some((s) => s.kind === 'moodle' && s.evidence.startsWith('Moodle gradebook: '))
}

/* -- What's needed on the rest (Daylight 2, gaps) ------------------------------ */

/**
 * "So far you have 74% on the 20% that's been marked. To finish on 70%
 * overall, you need about 69% on what's left." (the landing's Grades card).
 *
 * Unlike `neededOn`, which asks what one exam needs while the rest goes like
 * the average, this asks what EVERYTHING still to come needs on average, so it
 * holds no assumption to explain. "What's left" is the grade not yet marked:
 * 100 points less the marked weight, or the listed weights when they add up to
 * more than 100. Weighted marks only; null until one is in, or with nothing left.
 */
export interface NeededOnRest {
  /** Average needed on what's left, 0–100, rounded up; ≤ 0 or > 100 when out of play. */
  need: number
  state: 'reachable' | 'secured' | 'out-of-reach'
  /** The grade so far on the marked part, 0–100. */
  sofar: number
  /** Share of the grade marked, in points (20 = 20%). */
  markedWeight: number
  /** Share still to come, in points. */
  leftWeight: number
  target: number
}

export function neededOnRest(course: Deadline[], target: number): NeededOnRest | null {
  const marked = course.filter((d) => countsToward(d) && d.grade != null && d.weight_pct)
  if (!marked.length) return null
  const total = Math.max(100, course.filter(countsToward).reduce((s, d) => s + (d.weight_pct ?? 0), 0))
  const markedWeight = marked.reduce((s, d) => s + d.weight_pct!, 0)
  const earned = marked.reduce((s, d) => s + (d.weight_pct! * d.grade!) / 100, 0)
  const leftWeight = total - markedWeight
  if (leftWeight < 0.5) return null
  const need = Math.ceil((((target / 100) * total - earned) / leftWeight) * 100)
  return {
    need,
    state: need <= 0 ? 'secured' : need > 100 ? 'out-of-reach' : 'reachable',
    sofar: Math.round((earned / markedWeight) * 100),
    markedWeight: Math.round(markedWeight),
    leftWeight: Math.round(leftWeight),
    target,
  }
}

/** The sentence the Grades card says, from `neededOnRest`. */
export function restWords(r: NeededOnRest): string {
  const named = { sofar: r.sofar, marked: r.markedWeight, target: r.target, need: r.need }
  const sofar = translate('grades.rest.sofar', named)
  if (r.state === 'secured') return `${sofar} ${translate('grades.rest.secured', named)}`
  if (r.state === 'out-of-reach') return `${sofar} ${translate('grades.rest.out', named)}`
  return `${sofar} ${translate('grades.rest.need', named)}`
}
