// A calendar link or file: classes become slots and sessions, assessments become deadlines. Importing the same feed
// again only changes what the feed changed; what the learner deleted stays deleted.
//
// shortcut: repeats are DAILY and WEEKLY only (timetables are), anything else reads as its first event; move to a full RRULE parser if a real feed needs it.
import { dayKey, shiftDay, weekdayOf } from '../../../../app/companion/time.ts'
import { publicFetch } from '../ask/public-fetch.ts'
import { Invalid } from '../rules.ts'
import { createRow, updateRow } from '../rows.ts'
import { wireTime, type Raw, type Row, type Store } from '../store.ts'
import { localInstant, zoneFor } from '../zone.ts'
import { contextFor, weekOf } from './signals.ts'
import { codesIn, code as codeOf, courseScore, deadlineKind, looksLikeDeadline, matchCourse, matchDeadline, normalise, sessionKind } from './words.ts'

const MAX_BYTES = 5 * 1024 * 1024
const DAY = 86_400_000
const WINDOW_WEEKS = 40
const SESSION_WEEKS = 26
const PAST_DEADLINE_DAYS = 14
const COLORS = ['db', 'net', 'prg', 'mth', 'seg', 'eng', 'ita']

interface When { at: number; allDay: boolean }

interface Occurrence { uid: string; summary: string; description: string; location: string | null; categories: string[]; url: string | null; allDay: boolean; starts: number; ends: number; original: number; recurring: boolean; bounded: boolean; cancelled: boolean }

const unescape = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim()

function parseEvents(ics: string): Raw[] {
  const lines = ics.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n')
  const events: Raw[] = []
  let event: Raw | null = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { event = { EXDATE: [] }; continue }
    if (line === 'END:VEVENT') { if (event) events.push(event); event = null; continue }
    if (!event) continue
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const [name, ...params] = line.slice(0, colon).split(';')
    const value = line.slice(colon + 1)
    const tzid = params.find((p) => p.toUpperCase().startsWith('TZID='))?.slice(5)
    if (name === 'EXDATE') event.EXDATE.push(...value.split(',').map((v) => ({ value: v, tzid })))
    else event[name!.toUpperCase()] = { value, tzid }
  }
  return events
}

function dateOf(prop: Raw | undefined, zone: string): When | null {
  const v = String(prop?.value ?? '').trim()
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/)
  if (!m) return null
  const day = `${m[1]}-${m[2]}-${m[3]}`
  if (!m[4]) return { at: localInstant(day, '00:00', zone), allDay: true }
  if (m[7]) return { at: Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!), allDay: false }
  let tz = prop?.tzid ? String(prop.tzid).replace(/^"|"$/g, '') : zone
  // A zone name only Windows knows, or none at all, reads as the learner's own.
  try { new Intl.DateTimeFormat('en', { timeZone: tz }) } catch { tz = zone }
  return { at: localInstant(day, `${m[4]}:${m[5]}`, tz), allDay: false }
}

function durationMs(value: unknown): number | null {
  const m = String(value ?? '').match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/)
  if (!m) return null
  return (+(m[1] ?? 0) * 7 + +(m[2] ?? 0)) * DAY + (+(m[3] ?? 0)) * 3_600_000 + (+(m[4] ?? 0)) * 60_000 + (+(m[5] ?? 0)) * 1000
}

const WEEKDAYS: Record<string, number> = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 7 }

/** Every start of a repeating event inside the window, by wall clock so a class stays at 9 across a clock change. */
function expand(start: When, rule: string, zone: string, from: number, to: number, exdates: Set<number>): { starts: number[]; bounded: boolean } {
  const parts = Object.fromEntries(rule.split(';').map((p) => p.split('=') as [string, string]))
  const until = parts.UNTIL ? dateOf({ value: parts.UNTIL }, zone)?.at ?? null : null
  const count = parts.COUNT ? Number(parts.COUNT) : null
  const bounded = until !== null || count !== null
  const every = Math.max(1, Number(parts.INTERVAL) || 1)
  if (parts.FREQ !== 'WEEKLY' && parts.FREQ !== 'DAILY') return { starts: [start.at], bounded: true }
  const firstDay = dayKey(start.at)
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(start.at)
  const days = parts.FREQ === 'WEEKLY' ? (parts.BYDAY ? parts.BYDAY.split(',').map((d: string) => WEEKDAYS[d.slice(-2)]!).filter(Boolean) : [weekdayOf(firstDay)]) : null
  const out: number[] = []
  const monday = shiftDay(firstDay, -(weekdayOf(firstDay) - 1))
  let seen = 0
  for (let n = 0; n < 2000; n++) {
    const candidates = days
      ? [...days].sort((a, b) => a - b).map((w) => shiftDay(monday, n * every * 7 + w - 1))
      : [shiftDay(firstDay, n * every)]
    for (const day of candidates) {
      if (day < firstDay) continue
      const at = start.allDay ? localInstant(day, '00:00', zone) : localInstant(day, clock, zone)
      if ((until !== null && at > until) || (count !== null && seen >= count) || at > to) return { starts: out, bounded }
      seen++
      if (at >= from && !exdates.has(at)) out.push(at)
    }
  }
  return { starts: out, bounded }
}

export function occurrencesOf(ics: string, zone: string, now: number): Occurrence[] {
  const events = parseEvents(ics)
  const from = now - WINDOW_WEEKS * 7 * DAY
  const to = now + WINDOW_WEEKS * 7 * DAY
  const overrides = new Map<string, Raw>()
  for (const e of events) if (e['RECURRENCE-ID']) overrides.set(`${e.UID?.value}|${dateOf(e['RECURRENCE-ID'], zone)?.at}`, e)
  const out: Occurrence[] = []
  for (const e of events) {
    if (e['RECURRENCE-ID']) continue
    const start = dateOf(e.DTSTART, zone)
    if (!start) continue
    const summary = unescape(String(e.SUMMARY?.value ?? ''))
    const end = dateOf(e.DTEND, zone)?.at
    const length = end !== undefined ? end - start.at : durationMs(e.DURATION?.value) ?? (start.allDay ? DAY : 0)
    const uid = String(e.UID?.value ?? '').trim() || `nouid-${normalise(summary)}-${start.at}`
    const rule = e.RRULE?.value ? String(e.RRULE.value).toUpperCase() : null
    const exdates = new Set<number>((e.EXDATE as Raw[]).map((x) => dateOf(x, zone)?.at).filter((x): x is number => x !== undefined))
    const { starts, bounded } = rule ? expand(start, rule, zone, from, to, exdates) : { starts: start.at >= from && start.at <= to ? [start.at] : [], bounded: true }
    const make = (src: Raw, at: number, finish: number, original: number): Occurrence => {
      const description = unescape(String(src.DESCRIPTION?.value ?? ''))
      const direct = String(src.URL?.value ?? '').trim()
      const link = direct || description.match(/https?:\/\/[^\s<>"\]]+/i)?.[0]?.replace(/[.,);]+$/, '') || ''
      const location = unescape(String(src.LOCATION?.value ?? ''))
      return {
        uid,
        summary: unescape(String(src.SUMMARY?.value ?? summary)),
        description,
        location: location ? location.slice(0, 200) : null,
        categories: src.CATEGORIES?.value ? String(src.CATEGORIES.value).split(',').map((c) => unescape(c)).filter(Boolean) : [],
        url: link && link.length <= 2000 ? link : null,
        allDay: start.allDay,
        starts: at,
        ends: finish < at ? at : finish,
        original,
        recurring: Boolean(rule),
        bounded,
        cancelled: String(src.STATUS?.value ?? '').trim().toUpperCase() === 'CANCELLED',
      }
    }
    for (const at of starts) {
      const moved = overrides.get(`${uid}|${at}`)
      if (moved) {
        const movedAt = dateOf(moved.DTSTART, zone)?.at ?? at
        const movedEnd = dateOf(moved.DTEND, zone)?.at ?? movedAt + length
        out.push(make({ ...e, ...moved }, movedAt, movedEnd, at))
      } else out.push(make(e, at, at + length, at))
    }
  }
  return out.sort((a, b) => a.original - b.original)
}

function courseName(summary: string): string | null {
  const text = summary.replace(/(?<![A-Za-z0-9])[A-Z]{2,5}[ -]?\d{2,4}[A-Z]?(?![A-Za-z0-9])/g, ' ')
  for (const raw of text.split(/\s+[·|•–—\-:/]\s+|\s*[·|•]\s*|\s+\(|\)\s*/u)) {
    const part = raw.replace(/^[\s\-–—·:,()]+|[\s\-–—·:,()]+$/g, '')
    if (part.length < 3 || looksLikeDeadline(part)) continue
    // A part that is only a class kind ("Lecture", "Lab 2") names no course.
    const rest = part.replace(/\b(lecture|lectures|tutorial|lab|laboratory|seminar|practical|workshop|class|group|section|session|week|room)\b|\d+/gi, '').trim()
    if (rest.length >= 3) return part.slice(0, 200)
  }
  return null
}

function isDeadline(e: Occurrence): boolean {
  const text = `${e.summary} ${e.categories.join(' ')}`
  if (/\b(due|deadline|submit|submission|hand[\s-]?in|opens|closes)\b/i.test(text)) return true
  if (/\b(lecture|tutorial|seminar|class|revision|review\s+session|study|workshop|office\s+hours|consultation)\b/i.test(text)) return false
  if (e.recurring) return looksLikeDeadline(text)
  return looksLikeDeadline(text) || (!e.allDay && e.starts === e.ends && e.categories.length > 0)
}

function deadlineTitle(summary: string, subject: Row): { title: string; edge: string } {
  let title = summary.trim()
  if (subject.code) title = title.replace(new RegExp(`(?<![A-Za-z0-9])${subject.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9])\\s*[:·\\-–—]?\\s*`, 'i'), '').trim()
  const edge = title.match(/\s+(opens|closes)\s*$/i)?.[1]?.toLowerCase() ?? 'due'
  title = title.replace(/^(due|deadline)\s*[:\-–—]\s*/i, '').replace(/\s+(is\s+due|due(\s+date)?|(submission\s+)?deadline|submission|opens|closes|starts|ends)\s*$/i, '').trim()
  // "Final exam · Databases": the part that IS the course is dropped. Only exactly.
  const parts = title.split(/\s+[·|•–—]\s+/u)
  if (parts.length > 1) {
    const kept = parts.filter((p) => courseScore(p, subject) < 0.9)
    if (kept.length) title = kept.join(' · ')
  }
  return { title: title ? title.slice(0, 300) : 'Deadline', edge }
}

const refOf = (e: Occurrence) => (e.recurring ? `ics:${e.uid}@${new Date(e.original).toISOString()}` : `ics:${e.uid}`)
const weightOf = (text: string) => {
  const m = text.match(/\b(?:worth|weight(?:ing)?|counts?\s+for)\s*:?\s*(\d{1,3}(?:\.\d+)?)\s*%|(\d{1,3}(?:\.\d+)?)\s*%\s+of\s+(?:the\s+)?(?:final\s+)?(?:grade|mark|module|course)/i)
  const v = m ? Number(m[1] ?? m[2]) : 0
  return v > 0 && v <= 100 ? v : null
}
const scopeNoteOf = (text: string) => text.match(/\b(chapters?|weeks?|units?|lectures?|topics?|sections?)\s+\d+(?:\s*(?:[–-]|to|and|&)\s*\d+)?/iu)?.[0]?.trim().slice(0, 200) ?? null

function evidence(e: Occurrence, due: number, zone: string): string {
  const when = new Date(due).toLocaleString('en-GB', { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', ...(e.allDay ? {} : { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) })
  return [e.summary || null, when, e.location, e.cancelled ? 'cancelled' : null].filter(Boolean).join(' · ')
}

function labelOf(ics: string, url: string | null): string {
  const name = ics.match(/^X-WR-CALNAME:(.+)$/mi)?.[1]?.trim()
  if (name) return name.replace(/\\,/g, ',').slice(0, 200)
  const host = url ? (() => { try { return new URL(url).host } catch { return null } })() : null
  if (ics.includes('PRODID:-//Moodle')) return host ? `Moodle calendar · ${host}` : 'Moodle calendar'
  return host ? `Calendar · ${host}` : 'Calendar file'
}

export function importCalendar(store: Store, connection: Row, ics: string): Raw {
  const zone = zoneFor(store)
  const now = Date.now()
  const events = occurrencesOf(ics, zone, now)
  const c = contextFor(store, 'ics')
  const owned = [...c.subjects]
  const counts = { created: { subjects: 0, deadlines: 0, slots: 0, sessions: 0 }, updated: { deadlines: 0, slots: 0, sessions: 0 }, moved: 0, cancelled: 0, skipped: 0 }

  const makeSubject = (code: string | null, title: string): Row => {
    const used = owned.map((s) => s.color)
    const subject = createRow(store, 'subjects', { goal_id: c.term?.id ?? null, title: title.slice(0, 200), code, color: COLORS.find((x) => !used.includes(x)) ?? 'c8', source: 'ics', source_ref: `ics:course:${code ?? normalise(title).replace(/ /g, '-')}`, format: 'weeks', position: Math.max(-1, ...owned.map((s) => Number(s.position) || 0)) + 1 })
    owned.push(subject)
    counts.created.subjects++
    return subject
  }

  const votes = new Map<string, Map<string, number>>()
  for (const e of events) {
    const first = codesIn(`${e.categories.join(' ')} ${e.summary}`)[0]
    const name = courseName(e.summary)
    if (first && name) {
      const row = votes.get(first) ?? new Map<string, number>()
      row.set(name, (row.get(name) ?? 0) + 1)
      votes.set(first, row)
    }
  }
  const nameByCode = (code: string) => [...(votes.get(code)?.entries() ?? [])].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const byUid = new Map<string, Row | null>()
  for (const e of events) {
    if (byUid.has(e.uid)) continue
    const codes = codesIn(`${e.categories.join(' ')} ${e.summary}`)
    let subject: Row | null = null
    for (const code of codes) {
      subject = owned.find((s) => s.code && codeOf(s.code) === code) ?? null
      if (subject) break
    }
    if (!subject && codes.length) {
      const code = codes[0]!
      const name = nameByCode(code)
      // A course they already have by name but without its code gets the code; it is the same course.
      const same = name ? matchCourse(null, name, owned.filter((s) => !s.code)) : null
      if (same) subject = updateRow(store, 'subjects', same, { code })
      else subject = makeSubject(code, name ?? code)
    }
    if (!subject && e.recurring && !isDeadline(e)) {
      const name = courseName(e.summary)
      if (name) subject = matchCourse(null, name, owned) ?? makeSubject(null, name)
    }
    byUid.set(e.uid, subject)
  }
  // Grouped one-off lectures carry no repeat, so they match by name too, but only a course that exists.
  for (const e of events) {
    if (byUid.get(e.uid) || isDeadline(e) || e.recurring) continue
    const name = courseName(e.summary)
    const twins = events.filter((o) => normalise(o.summary) === normalise(e.summary) && weekdayOf(dayKey(o.original)) === weekdayOf(dayKey(e.original)))
    if (name && twins.length >= 2) byUid.set(e.uid, matchCourse(null, name, owned))
  }

  const deadlinesIn: [Occurrence, Row][] = []
  const classesIn: [Occurrence, Row][] = []
  for (const e of events) {
    const subject = byUid.get(e.uid) ?? null
    if (!subject) counts.skipped++
    else if (isDeadline(e)) deadlinesIn.push([e, subject])
    else classesIn.push([e, subject])
  }

  // "Quiz 2 opens" + "Quiz 2 closes" → one quiz.
  const groups = new Map<string, { subject: Row; title: string; events: Record<string, Occurrence> }>()
  for (const [e, subject] of deadlinesIn) {
    const { title, edge } = deadlineTitle(e.summary, subject)
    const key = e.recurring ? `${e.uid}@${e.original}` : `${subject.id}|${normalise(title)}`
    const group = groups.get(key) ?? { subject, title, events: {} }
    group.events[edge] ??= e
    groups.set(key, group)
  }
  // Rows this feed made are found by their ref; only the other rows are matched by title.
  const pool = c.deadlines.filter((d) => !String(d.source_ref ?? '').startsWith('ics:'))
  const allDeadlines = store.db.prepare("SELECT body FROM rows WHERE collection = 'deadlines'").all().map((r) => JSON.parse((r as { body: string }).body) as Row)
  for (const { subject, title, events: edges } of groups.values()) {
    const { due: plain, opens, closes } = edges as Record<string, Occurrence | undefined>
    let event = (plain ?? opens ?? closes)!
    if (opens && closes) event = closes.starts - opens.starts <= DAY ? opens : closes
    const all = [plain, opens, closes].filter(Boolean) as Occurrence[]
    const refs = all.map(refOf)
    const dueAt = event.allDay ? localInstant(dayKey(event.starts), '23:59', zone) : event.starts
    const description = [...new Set(all.map((e) => e.description))].join('\n')
    const location = all.map((e) => e.location).find(Boolean) ?? null
    const kind = deadlineKind(title, null) ?? (all.some((e) => /\b(opens|closes)\b/i.test(e.summary)) ? 'quiz' : null) ?? (/\b(due|submission|submit)\b/i.test(event.summary) ? 'assignment' : 'other')
    const attributes: Raw = { due_at: wireTime(dueAt), all_day: event.allDay, ...(location ? { location } : {}), ...(event.cancelled ? { status: 'cancelled' } : {}) }
    const source = { kind: 'ics', confidence: 'official', evidence: evidence(event, dueAt, zone), url: event.url }
    const existing = allDeadlines.find((d) => refs.includes(d.source_ref)) ?? matchDeadline(pool, subject.id, kind, title, now)
    // The learner deleted it; a feed does not bring it back.
    if (existing?.deleted_at) continue
    if (!existing) {
      if (dueAt < now - PAST_DEADLINE_DAYS * DAY) { counts.skipped++; continue }
      createRow(store, 'deadlines', { ...attributes, subject_id: subject.id, kind, title, weight_pct: weightOf(description), scope_note: scopeNoteOf(description), status: attributes.status ?? 'upcoming', confidence: 'official', confirmed: false, source_ref: refOf(event), sources: [source], topic_ids: [] })
      counts.created.deadlines++
      continue
    }
    // The feed has not changed its account of this deadline since it last said so: leave it, whatever else changed it.
    const latest = [...(existing.sources ?? [])].reverse().find((s: Raw) => s.kind === 'ics')
    if (latest?.evidence === source.evidence) continue
    if (existing.weight_pct == null && weightOf(description) !== null) attributes.weight_pct = weightOf(description)
    if (existing.scope_note == null && scopeNoteOf(description) !== null) attributes.scope_note = scopeNoteOf(description)
    const moved = Date.parse(existing.due_at ?? '') !== dueAt
    const changed = moved || Object.entries(attributes).some(([k, v]) => k !== 'due_at' && existing[k] !== v)
    const updated = updateRow(store, 'deadlines', existing, attributes)
    store.put('deadlines', { ...updated, confidence: 'official', source_ref: existing.source_ref ?? refOf(event), sources: [...updated.sources, { id: crypto.randomUUID(), deadline_id: existing.id, item_id: null, at_seconds: null, observed_at: wireTime(now), change: null, created_at: wireTime(now), ...source }] })
    if (changed) counts.updated.deadlines++
    if (moved) counts.moved++
  }

  // A series is one repeat (by UID), or the same title in the same course.
  const series = new Map<string, { subject: Row; recurring: boolean; events: Occurrence[] }>()
  for (const [e, subject] of classesIn) {
    const key = e.recurring ? `r:${e.uid}` : `g:${subject.id}|${normalise(e.summary)}`
    const row = series.get(key) ?? { subject, recurring: e.recurring, events: [] }
    row.events.push(e)
    series.set(key, row)
  }
  const clockOf = (at: number) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at)
  const allSlots = store.db.prepare("SELECT body FROM rows WHERE collection = 'slots'").all().map((r) => JSON.parse((r as { body: string }).body) as Row)
  const allSessions = store.db.prepare("SELECT body FROM rows WHERE collection = 'sessions'").all().map((r) => JSON.parse((r as { body: string }).body) as Row)
  const windowStart = now - SESSION_WEEKS * 7 * DAY
  const windowEnd = now + SESSION_WEEKS * 7 * DAY
  const mostOf = (values: (string | null)[]) => [...values.reduce((m, v) => (v ? m.set(v, (m.get(v) ?? 0) + 1) : m), new Map<string, number>())].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const writeSession = (e: Occurrence, subject: Row, slot: Row | null, title: string, number: number | null): string => {
    const identity = refOf(e)
    const ref = `${identity}~${e.starts}|${e.ends}|${e.location ?? ''}|${e.cancelled ? 'x' : ''}`
    const session = allSessions.find((s) => s.source_ref === identity || String(s.source_ref ?? '').startsWith(`${identity}~`))
    if (!session) {
      createRow(store, 'sessions', { subject_id: subject.id, slot_id: slot?.id ?? null, title: title.slice(0, 200), number, starts_at: wireTime(e.starts), ends_at: wireTime(e.ends), location: e.location, week: weekOf(c, dayKey(e.starts)), cancelled: e.cancelled, source_ref: ref })
      counts.created.sessions++
      return identity
    }
    if (session.deleted_at || session.source_ref === ref) return identity
    store.put('sessions', { ...session, slot_id: slot?.id ?? session.slot_id, starts_at: wireTime(e.starts), ends_at: wireTime(e.ends), location: e.location ?? session.location, week: weekOf(c, dayKey(e.starts)), source_ref: ref, cancelled: e.cancelled || session.cancelled })
    if (e.cancelled && !session.cancelled) counts.cancelled++
    counts.updated.sessions++
    return identity
  }

  for (const [key, one] of series) {
    // A slot per weekday and start time; a moved occurrence belongs to the slot of the day it was moved FROM. The number
    // runs across the series: Monday's and Wednesday's lectures are Lecture 1, 2, 3.
    const bySlot = new Map<string, { e: Occurrence; number: number }[]>()
    one.events.forEach((e, i) => {
      const pattern = `${weekdayOf(dayKey(e.original))}|${clockOf(e.original)}`
      bySlot.set(pattern, [...(bySlot.get(pattern) ?? []), { e, number: i + 1 }])
    })
    for (const [pattern, rows] of bySlot) {
      if (!one.recurring && rows.length < 2) {
        for (const { e } of rows) {
          // One event in a course that has no repeat: only a course code in it says it's this course's class.
          if (!one.subject.code || !codesIn(`${e.categories.join(' ')} ${e.summary}`).includes(codeOf(one.subject.code))) { counts.skipped++; continue }
          writeSession(e, one.subject, null, e.summary.replace(new RegExp(`(?<![A-Za-z0-9])${one.subject.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9])\\s*[:·\\-–—]?\\s*`, 'i'), '').trim() || sessionKind(e.summary), null)
        }
        continue
      }
      const [weekday, start] = pattern.split('|') as [string, string]
      const first = rows[0]!.e
      const ref = one.recurring ? `ics:${first.uid}#${weekday}${start.replace(':', '')}` : `ics:grp:${normalise(key).replace(/ /g, '').slice(0, 24)}#${weekday}${start.replace(':', '')}`
      const attrs = { subject_id: one.subject.id, kind: sessionKind(first.summary), weekday: Number(weekday), starts_at: start, ends_at: mostOf(rows.map((r) => clockOf(r.e.ends))) ?? start, location: mostOf(rows.map((r) => r.e.location)), valid_from: dayKey(first.original), valid_until: first.bounded ? dayKey(rows.at(-1)!.e.original) : null }
      let slot = allSlots.find((s) => s.source_ref === ref) ?? null
      if (!slot) {
        slot = createRow(store, 'slots', { ...attrs, source_ref: ref })
        counts.created.slots++
      } else if (!slot.deleted_at && Object.entries(attrs).some(([k, v]) => slot![k] !== v)) {
        slot = store.put('slots', { ...slot, ...attrs })
        counts.updated.slots++
      }
      const label = attrs.kind === 'study' ? 'Study' : attrs.kind[0]!.toUpperCase() + attrs.kind.slice(1)
      const written = new Set<string>()
      for (const { e, number } of rows) {
        if (e.starts < windowStart || e.starts > windowEnd) continue
        written.add(writeSession(e, one.subject, slot, `${label} ${number}`, number))
      }
      if (one.recurring) {
        const prefix = `ics:${first.uid}@`
        for (const session of allSessions) {
          if (session.deleted_at || session.slot_id !== slot.id || session.cancelled || !String(session.source_ref ?? '').startsWith(prefix)) continue
          if (Date.parse(session.starts_at) <= now || Date.parse(session.starts_at) > windowEnd) continue
          if (!written.has(String(session.source_ref).split('~')[0]!)) {
            store.put('sessions', { ...session, cancelled: true })
            counts.cancelled++
          }
        }
      }
    }
  }

  const saved = store.put('connections', { ...connection, status: 'ok', error: null, last_synced_at: wireTime(now), meta: { ...(connection.meta ?? {}), calendar: ics.match(/^X-WR-CALNAME:(.+)$/mi)?.[1]?.trim().slice(0, 200) ?? null, producer: ics.includes('Moodle') ? 'moodle' : 'generic', last_result: { events: events.length, ...counts } } })
  const { token: _token, ...connectionWire } = saved
  return {
    connection: { ...connectionWire, has_token: false },
    created: counts.created,
    updated: counts.updated.deadlines + counts.updated.slots + counts.updated.sessions,
    details: { events: events.length, updated: counts.updated, moved: counts.moved, cancelled: counts.cancelled, skipped: counts.skipped },
  }
}

const normaliseUrl = (url: string) => url.trim().replace(/^webcals?:\/\//i, 'https://')

export async function fetchFeed(url: string, fetcher: typeof fetch = publicFetch): Promise<string> {
  const target = normaliseUrl(url)
  if (!/^https?:\/\//i.test(target)) throw new Invalid({ url: ["That isn't a web address."] })
  let res: Response
  try {
    res = await fetcher(target, { signal: AbortSignal.timeout(25_000), headers: { Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.5' } })
  } catch (error) {
    const blocked = /private network/.test(String((error as Error)?.message))
    throw new Invalid({ url: [blocked ? "We can't read that calendar: it points at a private or internal address." : "We couldn't reach that calendar: the server did not answer."] })
  }
  if (!res.ok) throw new Invalid({ url: [`We couldn't read that calendar: the server said ${res.status}.`] })
  const body = await res.text()
  if (body.length > MAX_BYTES) throw new Invalid({ url: ['That calendar is too large to read.'] })
  if (!/BEGIN:VCALENDAR/i.test(body)) throw new Invalid({ url: ["That link doesn't lead to a calendar."] })
  return body
}

export function connectionFor(store: Store, url: string | null, ics: string): Row {
  const label = labelOf(ics, url)
  const existing = store.live('connections').find((c) => c.kind === 'ics' && (url ? c.url === url : !c.url && c.label === label))
  return existing ?? createRow(store, 'connections', { kind: 'ics', label, url, status: 'pending', meta: {} })
}

export { normaliseUrl }
