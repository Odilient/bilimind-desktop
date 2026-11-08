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

import { currentLocale, intlTag, translate } from '../utils/i18n'

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

const names = new Map<string, Intl.DateTimeFormat>()

/** A day key's part in the active language, said by `Intl` (the key is a calendar day, so UTC). */
function say(key: string, options: Intl.DateTimeFormatOptions): string {
  const tag = intlTag(currentLocale())
  const id = tag + JSON.stringify(options)
  let f = names.get(id)
  if (!f) {
    f = new Intl.DateTimeFormat(tag, { timeZone: 'UTC', ...options })
    names.set(id, f)
  }
  return f.format(new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10))))
}

/** "29 Oct". */
export function shortDate(key: string): string {
  return say(key, { day: 'numeric', month: 'short' })
}

/** "Thu 29 Oct", from a day key. */
export function dayLabel(key: string): string {
  return `${weekdayShort(key)} ${shortDate(key)}`
}

/** "15 June". */
export function dayMonthLong(key: string): string {
  return say(key, { day: 'numeric', month: 'long' })
}

/** "Tuesday 27 October". */
export function longDayLabel(key: string): string {
  return `${say(key, { weekday: 'long' })} ${dayMonthLong(key)}`
}

export function weekdayShort(key: string): string {
  return say(key, { weekday: 'short' })
}

// 2024-01-01 was a Monday.
export function weekdayName(n: number): string {
  return weekdayShort(shiftDay('2024-01-01', n - 1))
}

/** "Sunday", from an ISO weekday. */
export function weekdayLong(n: number): string {
  return say(shiftDay('2024-01-01', n - 1), { weekday: 'long' })
}

export function monthShort(key: string): string {
  return say(key, { month: 'short' })
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
  const diff = daysBetween(dayKey(), key)
  const day =
    diff === 0
      ? translate('calendar.time.today')
      : diff === 1
        ? translate('calendar.time.tomorrow')
        : diff > 1 && diff < 7
          ? weekdayShort(key)
          : dayLabel(key)
  return allDay ? day : `${day} ${clock(iso)}`
}

/** "in 12 min", "in 3 h", "in 2 days", "now", "2 days ago". */
export function untilLabel(iso: string, now = Date.now()): string {
  const ms = new Date(iso).getTime() - now
  const mins = Math.round(ms / 60_000)
  if (Math.abs(mins) < 1) return translate('calendar.time.now')
  if (mins > 0) {
    if (mins < 60) return translate('calendar.time.inMin', mins)
    if (mins < 60 * 20) return translate('calendar.time.inH', Math.round(mins / 60))
    const days = daysBetween(dayKey(now), dayKey(iso))
    return days <= 1 ? translate('calendar.time.tomorrow') : translate('calendar.time.inDays', days)
  }
  const ago = -mins
  if (ago < 60) return translate('calendar.time.minAgo', ago)
  if (ago < 60 * 20) return translate('calendar.time.hAgo', Math.round(ago / 60))
  const days = daysBetween(dayKey(iso), dayKey(now))
  return days <= 1 ? translate('calendar.time.yesterday') : translate('calendar.time.daysAgo', days)
}

/** "1 d 23 h" — the countdown chip on the desktop title bar. */
export function countdown(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((new Date(iso).getTime() - now) / 60_000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  if (d > 0) return translate('calendar.time.dh', { d, h })
  if (h > 0) return translate('calendar.time.hMin', { h, m: mins % 60 })
  return translate('calendar.time.min', { n: mins })
}

/** "1 h 52 m", "41:20" style durations, in words a person reads. */
export function durationLabel(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 60) return translate('calendar.time.min', { n: m })
  const h = Math.floor(m / 60)
  return m % 60 ? translate('calendar.time.hm', { h, m: m % 60 }) : translate('calendar.time.h', { n: h })
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
  if (h < 12 && h >= 5) return translate('calendar.time.morning')
  if (h >= 12 && h < 18) return translate('calendar.time.afternoon')
  return translate('calendar.time.evening')
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
