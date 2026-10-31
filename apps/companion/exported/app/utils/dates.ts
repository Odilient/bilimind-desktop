/**
 * Calendar helpers for the schedule surfaces.
 *
 * Deliberately no `Intl` and no local-time parsing of ISO dates: a schedule
 * item is a *day*, not an instant, and `new Date('2026-08-08')` is midnight
 * UTC, which lands on the 7th for anyone west of Greenwich. Everything here
 * parses into UTC and formats from fixed tables, so the server, SSR and the
 * browser all agree on which square of the calendar a session sits in.
 */

export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export const WEEKDAYS_MIN = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const
export const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

export function parseDay(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1))
}

/** Today in the learner's own timezone, as a plain ISO date. */
export function isoToday(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  const date = parseDay(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function dayDiff(from: string, to: string): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000)
}

/** ISO weekday, 1 = Monday. */
export function isoWeekday(iso: string): number {
  return ((parseDay(iso).getUTCDay() + 6) % 7) + 1
}

/** "Today", "Tomorrow", or "Wed 12 Aug". */
export function dayLabel(iso: string): string {
  const diff = dayDiff(isoToday(), iso)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  const date = parseDay(iso)
  return `${WEEKDAYS_SHORT[isoWeekday(iso) - 1]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`
}

/**
 * `dayLabel` for use mid-sentence: "next today" is wrong, and so is
 * "next mon 3 aug". Only the relative words lower-case; real dates keep their
 * capitals because they are names.
 */
export function dayLabelInline(iso: string): string {
  const label = dayLabel(iso)
  return ['Today', 'Tomorrow', 'Yesterday'].includes(label) ? label.toLowerCase() : label
}

/** Three-letter weekday, for the schedule's date gutter. */
export function weekdayLabel(iso: string): string {
  return WEEKDAYS_SHORT[isoWeekday(iso) - 1] ?? ''
}

/** Day of the month, for the schedule's date gutter. */
export function dayOfMonth(iso: string): number {
  return parseDay(iso).getUTCDate()
}

export function minutesLabel(value: number): string {
  const m = Math.max(0, Math.round(value))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest === 0 ? `${h} hr` : `${h} hr ${rest}m`
}

/** Compact form for tight spaces: "45m", "1h 15m". */
export function minutesShort(value: number): string {
  const m = Math.max(0, Math.round(value))
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`
}

/** Hours to one decimal, for weekly budgets: "2.1". */
export function hoursLabel(minutes: number): string {
  return (Math.max(0, minutes) / 60).toFixed(1).replace(/\.0$/, '')
}
