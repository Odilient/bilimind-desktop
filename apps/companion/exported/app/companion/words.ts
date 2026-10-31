/**
 * The companion's sentences about its own rows, in one place so every screen
 * says a deadline, a session and a source the same way. Words a person uses:
 * "heard in class", "from the group chat", never `confidence: heard`.
 */
import type { Deadline, DeadlineSource, Item, Session, Slot, Subject } from './types'
import { clock, dayKey, dayLabel, durationLabel, relativeDay, timecode, weekdayShort } from './time'

export const KIND_WORD: Record<Deadline['kind'], string> = {
  assignment: 'Assignment',
  quiz: 'Quiz',
  lab: 'Lab',
  midterm: 'Midterm',
  final: 'Final',
  exam: 'Exam',
  project: 'Project',
  presentation: 'Presentation',
  milestone: 'Checkpoint',
  other: 'Deadline',
}

/** "heard in class, Moodle agrees" — how we know, in a few words. */
export function knownBy(d: Deadline): string | null {
  const kinds = new Set(d.sources.map((s) => s.kind))
  const heard = kinds.has('transcript')
  const official = d.sources.some((s) => s.confidence === 'official')
  if (d.tentative) {
    if (d.confidence === 'heard') return 'heard in class, not confirmed yet'
    if (d.confidence === 'shared') return 'from the group chat, not confirmed yet'
  }
  if (heard && official) return 'heard in class, Moodle agrees'
  if (heard) return 'heard in class'
  if (d.confidence === 'own') return 'your own'
  return null
}

/** The line under a deadline's title. */
export function deadlineMeta(d: Deadline, subject: Subject | null, withCourse = true): string {
  const parts: string[] = []
  if (withCourse && subject) parts.push(subject.title)
  if (d.scope_note) parts.push(d.scope_note)
  const known = knownBy(d)
  if (known) parts.push(known)
  else if (d.weight_pct) parts.push(`${d.weight_pct}% of the grade`)
  return parts.join(' · ')
}

/**
 * Readiness, said in words: "45% ready", "ready", "not started". The rings
 * that used to carry this read like a dashboard; a phrase reads like a
 * person. One wording everywhere: Today, the Calendar, a deadline, practice.
 *
 * Null is a topic, or a deadline, with no check that counts yet. That's not
 * 0%: nothing has been shown either way, so it says so. A deadline passes
 * `r.checked ? r.percent : null`.
 */
export function readyWords(percent: number | null): string {
  if (percent === null) return 'not checked yet'
  if (percent >= 85) return 'ready'
  if (percent <= 5) return 'not started'
  return `${percent}% ready`
}

/** Day and time, split for the right-hand column: ["Thu", "09:00"]. */
export function dueParts(d: Deadline): [string, string] {
  if (!d.due_at) return ['No date', '']
  const key = dayKey(d.due_at)
  const rel = relativeDay(key)
  const day = rel === 'today' ? 'Today' : rel === 'tomorrow' ? 'Tomorrow' : rel.length <= 3 ? rel : dayLabel(key).slice(4)
  return [day, d.all_day ? '' : clock(d.due_at)]
}

/** "Thu 29 Oct, 09:00". */
export function dueLong(d: Deadline): string {
  if (!d.due_at) return 'No date yet'
  return `${dayLabel(dayKey(d.due_at))}${d.all_day ? '' : `, ${clock(d.due_at)}`}`
}

/** "10:00–12:00 · B-302". */
export function sessionLine(s: Session): string {
  return [`${clock(s.starts_at)}–${clock(s.ends_at)}`, s.location].filter(Boolean).join(' · ')
}

export function sessionWhen(s: Session): string {
  const key = dayKey(s.starts_at)
  const rel = relativeDay(key)
  return `${rel === 'today' ? 'Today' : rel === 'tomorrow' ? 'Tomorrow' : weekdayShort(key)} ${clock(s.starts_at)}`
}

const SOURCE_WORD: Record<DeadlineSource['kind'], string> = {
  moodle: 'Moodle',
  teams: 'Teams',
  canvas: 'Canvas',
  ics: 'Calendar feed',
  email: 'Email',
  transcript: 'Said in class',
  share: 'Shared message',
  classmate: 'A classmate',
  user: 'You',
  photo: 'Photo',
  pdf: 'PDF',
}

/** "Said in Lecture 7, Wed 10:47", "Moodle post, Mon 15:02". */
export function sourceLine(s: DeadlineSource, recordingSession?: Session | null): string {
  const at = `${weekdayShort(dayKey(s.observed_at))} ${clock(s.observed_at)}`
  if (s.kind === 'transcript') {
    return `Said in ${recordingSession?.title ?? 'class'}, ${at}`
  }
  if (s.kind === 'moodle') return `Moodle post, ${at}`
  if (s.kind === 'user') return 'Set by you'
  return `${SOURCE_WORD[s.kind]}, ${at}`
}

export function itemIcon(item: Item): string {
  switch (item.kind) {
    case 'page': return 'pencil'
    case 'board': return 'board'
    case 'recording': return 'mic'
    case 'photo': return 'camera'
    case 'link': return 'link'
    default: return 'file'
  }
}

/** A chip label for an item: "1 h 52 m", "L7-Normal-forms.pdf", "Notes". */
export function itemLabel(item: Item): string {
  if (item.kind === 'recording' && item.meta.duration_s) return durationLabel(item.meta.duration_s)
  return item.title
}

export function atLabel(seconds: number | null | undefined): string {
  return seconds == null ? '' : timecode(seconds)
}

export const SLOT_WORD: Record<Slot['kind'], string> = {
  lecture: 'Lecture',
  tutorial: 'Tutorial',
  lab: 'Lab',
  seminar: 'Seminar',
  lesson: 'Lesson',
  study: 'Study',
}

/** File size as a person reads it. */
export function sizeLabel(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
