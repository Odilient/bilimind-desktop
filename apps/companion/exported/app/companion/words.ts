/**
 * The companion's sentences about its own rows, in one place so every screen
 * says a deadline, a session and a source the same way. Words a person uses:
 * "heard in class", "from the group chat", never `confidence: heard`.
 */
import type { Deadline, DeadlineSource, Item, Session, Slot, Subject } from './types'
import { clock, dayKey, dayLabel, durationLabel, relativeDay, timecode, weekdayShort } from './time'
import { translate } from '~/utils/i18n'

/** A deadline's kind, in the active language ("Quiz", "Midterm"). */
export function kindWord(kind: Deadline['kind']): string {
  return translate(`today.kind.${kind}`)
}

/** "heard in class, Moodle agrees" — how we know, in a few words. */
export function knownBy(d: Deadline): string | null {
  const kinds = new Set(d.sources.map((s) => s.kind))
  const heard = kinds.has('transcript')
  const official = d.sources.some((s) => s.confidence === 'official')
  if (d.tentative) {
    if (d.confidence === 'heard') return translate('today.known.heardPending')
    if (d.confidence === 'shared') return translate('today.known.sharedPending')
  }
  if (heard && official) return translate('today.known.heardMoodle')
  if (heard) return translate('today.known.heard')
  if (d.confidence === 'own') return translate('today.known.own')
  return null
}

/** The line under a deadline's title. */
export function deadlineMeta(d: Deadline, subject: Subject | null, withCourse = true): string {
  const parts: string[] = []
  if (withCourse && subject) parts.push(subject.title)
  if (d.scope_note) parts.push(d.scope_note)
  const known = knownBy(d)
  if (known) parts.push(known)
  else if (d.weight_pct) parts.push(translate('today.weight', { n: d.weight_pct }))
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
  if (percent === null) return translate('today.ready.none')
  if (percent >= 85) return translate('today.ready.done')
  if (percent <= 5) return translate('today.ready.notStarted')
  return translate('today.ready.percent', { n: percent })
}

/** Day and time, split for the right-hand column: ["Thu", "09:00"]. */
export function dueParts(d: Deadline): [string, string] {
  if (!d.due_at) return [translate('today.due.none'), '']
  const key = dayKey(d.due_at)
  const rel = relativeDay(key)
  const day = rel === 'today' ? translate('common.today') : rel === 'tomorrow' ? translate('common.tomorrow') : rel.length <= 3 ? rel : dayLabel(key).slice(4)
  return [day, d.all_day ? '' : clock(d.due_at)]
}

/** "Thu 29 Oct, 09:00". */
export function dueLong(d: Deadline): string {
  if (!d.due_at) return translate('today.due.noneYet')
  return `${dayLabel(dayKey(d.due_at))}${d.all_day ? '' : `, ${clock(d.due_at)}`}`
}

/** "10:00–12:00 · B-302". */
export function sessionLine(s: Session): string {
  return [`${clock(s.starts_at)}–${clock(s.ends_at)}`, s.location].filter(Boolean).join(' · ')
}

export function sessionWhen(s: Session): string {
  const key = dayKey(s.starts_at)
  const rel = relativeDay(key)
  return `${rel === 'today' ? translate('common.today') : rel === 'tomorrow' ? translate('common.tomorrow') : weekdayShort(key)} ${clock(s.starts_at)}`
}

const BRAND_SOURCE: Partial<Record<DeadlineSource['kind'], string>> = {
  moodle: 'Moodle',
  teams: 'Teams',
  canvas: 'Canvas',
  pdf: 'PDF',
  // Daylight 2 (gaps): set by the teacher in Google Classroom.
  classroom: 'Google Classroom',
}

function sourceWord(kind: DeadlineSource['kind']): string {
  return BRAND_SOURCE[kind] ?? translate(`today.source.${kind}`)
}

/** "Said in Lecture 7, Wed 10:47", "Moodle post, Mon 15:02". */
export function sourceLine(s: DeadlineSource, recordingSession?: Session | null): string {
  const at = `${weekdayShort(dayKey(s.observed_at))} ${clock(s.observed_at)}`
  if (s.kind === 'transcript') {
    return translate('today.line.said', { where: recordingSession?.title ?? translate('today.line.class'), at })
  }
  if (s.kind === 'moodle') return translate('today.line.moodle', { at })
  if (s.kind === 'user') return translate('today.line.user')
  return translate('today.line.other', { word: sourceWord(s.kind), at })
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

export function slotWord(kind: Slot['kind']): string {
  return translate(`today.slot.${kind}`)
}

/** File size as a person reads it. */
export function sizeLabel(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
