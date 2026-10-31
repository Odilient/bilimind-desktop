/**
 * The words a learner sees.
 *
 * The API talks about nodes, stubs, expansion and outlines because that is what
 * the generator manipulates. None of it means anything to somebody who just
 * wants to learn to rewire a bedroom, and a screen full of "0/14 nodes · 12
 * expanded · Outlined" reads like a build log, not a course.
 *
 * So every learner-facing string that describes structure comes from here, and
 * nothing else in `app/` should be spelling out "node" or "expanded" in prose.
 * Internal names stay internal: types, props and API fields keep saying node.
 */

import type { CourseStatus, NodeStatus } from '~/types/api'

/** "1 lesson" / "14 lessons". */
export function lessons(count: number): string {
  return `${count} ${count === 1 ? 'lesson' : 'lessons'}`
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}

/**
 * The one-line summary under a course title.
 *
 * Deliberately says what a learner can *do* next rather than reporting three
 * ratios. "14 lessons · 9 ready to read" beats "0/14 nodes · 12 expanded"
 * because the second sentence answers a question nobody asked.
 */
export function courseProgressLine(input: {
  total: number
  completed: number
  /** How many have been written. Omit when the caller does not actually know. */
  ready?: number
  writing?: number
}): string {
  const { total, completed, ready, writing = 0 } = input

  if (total === 0) return 'Nothing planned yet'
  if (writing > 0) return `Writing ${writing} of ${lessons(total)}`
  if (completed > 0 && completed === total) return `All ${lessons(total)} finished`
  if (completed > 0) return `${completed} of ${lessons(total)} finished`
  if (ready === undefined) return `${lessons(total)} · not started`
  if (ready === 0) return `${lessons(total)} planned · none written yet`
  if (ready === total) return `${lessons(total)} · ready to read`
  return `${lessons(total)} · ${ready} ready to read`
}

/**
 * What a learner should press next on a course card. The verb *is* the state,
 * which is why the card does not need a status chip next to it as well.
 */
export function courseAction(input: {
  ready: number
  completed: number
  writing: number
  /** Lessons opened and not finished. A half-read lesson is not a fresh start. */
  started?: number
}): { label: string; tone: 'primary' | 'accent' | 'secondary' } {
  if (input.writing > 0) return { label: 'See progress', tone: 'secondary' }
  if (input.ready === 0) return { label: 'Choose lessons', tone: 'accent' }
  if (input.completed === 0 && !input.started) return { label: 'Start', tone: 'primary' }
  return { label: 'Continue', tone: 'primary' }
}

/** Course status, said the way a person would say it. */
export function courseStatusLabel(status: CourseStatus | null | undefined): string {
  switch (status) {
    case 'ready':
      return 'Ready'
    case 'outlined':
      return 'Plan ready'
    case 'expanding':
      return 'Being written'
    case 'failed':
      return 'Needs another go'
    default:
      return 'Draft'
  }
}

/**
 * A single lesson's state. Shorter and blunter than `nodeStatusStyle`'s labels,
 * which carry the dot vocabulary for dense structural views; this is for prose.
 */
export function lessonStateLabel(status: NodeStatus | null | undefined): string {
  switch (status) {
    case 'ready':
      return 'Ready to read'
    case 'generating':
      return 'Being written'
    case 'queued':
      return 'Waiting to be written'
    case 'failed':
      return 'Needs another go'
    default:
      return 'Not written yet'
  }
}

const LANGUAGES: Record<string, string> = {
  en: 'English',
  uz: 'Uzbek',
  ru: 'Russian',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  tr: 'Turkish',
  ar: 'Arabic',
  pt: 'Portuguese',
  it: 'Italian',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  hi: 'Hindi',
}

/** "uz" → "Uzbek". Falls back to the code upper-cased for anything unlisted. */
export function languageName(code: string | null | undefined): string {
  if (!code) return ''
  return LANGUAGES[code.toLowerCase()] ?? code.toUpperCase()
}

/**
 * How long ago, in the vaguest terms that are still true. Nobody needs
 * "5 days ago" to be "4 days and 19 hours ago", and vagueness here reads as
 * calm rather than as a log line.
 */
export function agoLabel(iso: string | null | undefined): string {
  if (!iso) return ''

  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''

  const minutes = Math.floor((Date.now() - then) / 60_000)
  if (minutes < 2) return 'just now'
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? 'an hour ago' : `${hours} hours ago`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 14) return 'last week'
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  return `${Math.floor(days / 30)} months ago`
}
