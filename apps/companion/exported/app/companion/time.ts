/**
 * Dates and times for the companion, always in the learner's own time zone.
 *
 * A lecture at 10:00 in Lisbon is 10:00 on the screen even when the laptop
 * is set to Berlin, so nothing here formats through the device's local time:
 * every instant goes through `Intl` with an explicit `timeZone`. The zone is
 * the active goal's (the contract's `goals.timezone`), set once by the store
 * with `setZone()`, and falls back to the browser's.
 *
 * Words, not codes: "Thu 29 Oct", "in 12 min", "tonight". Never an ISO string
 * on screen.
 */

let zone: string | undefined

export function browserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function setZone(tz: string | null | undefined): void {
  zone = tz || undefined
}

export function currentZone(): string {
  return zone ?? browserZone()
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function fmt(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const tz = currentZone()
  const key = tz + JSON.stringify(options)
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...options })
    formatters.set(key, f)
  }
  return f
}

function toDate(value: string | Date | number): Date {
  return value instanceof Date ? value : new Date(value)
}

/** The wall-clock parts of an instant in the learner's zone. */
export function parts(value: string | Date | number) {
  const out: Record<string, string> = {}
  for (const p of fmt({
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(toDate(value))) {
    out[p.type] = p.value
  }
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour),
    minute: Number(out.minute),
    weekday: out.weekday ?? '',
  }
}

/** `YYYY-MM-DD` of an instant, in the learner's zone. */
export function dayKey(value: string | Date | number = Date.now()): string {
  const p = parts(value)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Days between two `YYYY-MM-DD` keys; positive when `to` is later. */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10))
  return Math.round((b - a) / 86_400_000)
}

export function shiftDay(key: string, days: number): string {
  const d = new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10) + days))
  return d.toISOString().slice(0, 10)
}

/** ISO weekday of a day key, Monday = 1. */
export function weekdayOf(key: string): number {
  const d = new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)))
  return ((d.getUTCDay() + 6) % 7) + 1
}

/** The Monday of the week a day key falls in. */
export function mondayOf(key: string): string {
  return shiftDay(key, 1 - weekdayOf(key))
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "Thu 29 Oct", from a day key. */
export function dayLabel(key: string): string {
  return `${WEEKDAYS[weekdayOf(key) - 1]} ${+key.slice(8, 10)} ${MONTHS[+key.slice(5, 7) - 1]}`
}

/** "29 Oct". */
export function shortDate(key: string): string {
  return `${+key.slice(8, 10)} ${MONTHS[+key.slice(5, 7) - 1]}`
}

/** "Tuesday 27 October". */
export function longDayLabel(key: string): string {
  return `${WEEKDAYS_LONG[weekdayOf(key) - 1]} ${+key.slice(8, 10)} ${MONTHS_LONG[+key.slice(5, 7) - 1]}`
}

export function weekdayShort(key: string): string {
  return WEEKDAYS[weekdayOf(key) - 1] ?? ''
}

export function weekdayName(n: number): string {
  return WEEKDAYS[n - 1] ?? ''
}

/** "Sunday", from an ISO weekday. */
export function weekdayLong(n: number): string {
  return WEEKDAYS_LONG[n - 1] ?? ''
}

/** "15 June". */
export function dayMonthLong(key: string): string {
  return `${+key.slice(8, 10)} ${MONTHS_LONG[+key.slice(5, 7) - 1]}`
}

export function monthShort(key: string): string {
  return MONTHS[+key.slice(5, 7) - 1] ?? ''
}

/** "09:00", in the learner's zone. */
export function clock(value: string | Date): string {
  const p = parts(value)
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

/**
 * When, said the way a person says it: "today", "tomorrow", "Thu", or a date
 * once it is more than a week out.
 */
export function relativeDay(key: string, today = dayKey()): string {
  const diff = daysBetween(today, key)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  if (diff > 1 && diff < 7) return weekdayShort(key)
  return dayLabel(key)
}

/** "Thu 09:00", "today 23:59", "Wed 4 Nov 14:00". */
export function whenLabel(iso: string, allDay = false): string {
  const key = dayKey(iso)
  const rel = relativeDay(key)
  const day = rel === 'today' || rel === 'tomorrow' ? rel : rel.length <= 3 ? rel : dayLabel(key)
  return allDay ? day : `${day} ${clock(iso)}`
}

/** "in 12 min", "in 3 h", "in 2 days", "now", "2 days ago". */
export function untilLabel(iso: string, now = Date.now()): string {
  const ms = new Date(iso).getTime() - now
  const mins = Math.round(ms / 60_000)
  if (Math.abs(mins) < 1) return 'now'
  if (mins > 0) {
    if (mins < 60) return `in ${mins} min`
    if (mins < 60 * 20) return `in ${Math.round(mins / 60)} h`
    const days = daysBetween(dayKey(now), dayKey(iso))
    return days <= 1 ? 'tomorrow' : `in ${days} days`
  }
  const ago = -mins
  if (ago < 60) return `${ago} min ago`
  if (ago < 60 * 20) return `${Math.round(ago / 60)} h ago`
  const days = daysBetween(dayKey(iso), dayKey(now))
  return days <= 1 ? 'yesterday' : `${days} days ago`
}

/** "1 d 23 h" — the countdown chip on the desktop title bar. */
export function countdown(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((new Date(iso).getTime() - now) / 60_000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  if (d > 0) return `${d} d ${h} h`
  if (h > 0) return `${h} h ${mins % 60} min`
  return `${mins} min`
}

/** "1 h 52 m", "41:20" style durations, in words a person reads. */
export function durationLabel(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return m % 60 ? `${h} h ${m % 60} m` : `${h} h`
}

/** A moment in a recording: "47:05", "1:02:10". */
export function timecode(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

/** "Good morning" by the learner's own clock. */
export function greeting(now = Date.now()): string {
  const h = parts(now).hour
  if (h < 5) return 'Good evening'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/**
 * An ISO string with the device's own offset, e.g. `2026-10-27T10:00:00+05:00`.
 * The contract wants offsets on the wire, and `toISOString()` only ever says Z.
 */
export function isoWithOffset(d: Date): string {
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const abs = Math.abs(off)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  )
}

export function nowIso(): string {
  return isoWithOffset(new Date())
}
