// Whose clock "today" is read on: the active goal's zone (a term before a self-study goal, because the timetable is
// the thing that has to be right), else this computer's.
import { browserZone } from '../../../app/companion/time.ts'
import type { Store } from './store.ts'

function isZone(zone: unknown): zone is string {
  if (typeof zone !== 'string' || !zone) return false
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

export const validZone = isZone

export function zoneFor(store: Store): string {
  const goal = store.live('goals')
    .filter((g) => g.status === 'active')
    .sort((a, b) => Number(b.kind === 'term') - Number(a.kind === 'term') || String(a.created_at).localeCompare(String(b.created_at)))[0]
  return isZone(goal?.timezone) ? goal.timezone : browserZone()
}

function offsetMs(at: number, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(at)
  const part = (type: string) => Number(parts.find((p) => p.type === type)!.value)
  return Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second')) - Math.floor(at / 1000) * 1000
}

/** The instant a `YYYY-MM-DD` starts in a zone. */
export function dayStart(key: string, zone: string): number {
  const utc = Date.parse(`${key}T00:00:00Z`)
  return utc - offsetMs(utc - offsetMs(utc, zone), zone)
}

/** The last millisecond of a `YYYY-MM-DD` in a zone. */
export function dayEnd(key: string, zone: string): number {
  return dayStart(new Date(Date.parse(`${key}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10), zone) - 1
}
