// reviews.ics: study blocks (plan days) + spaced reviews (review/state.json), in the goal's zone
// in the goal's time zone, every event ending before the exam. Our own small RFC 5545 writer (no package).
// Owner: WP4.
import type { Course, PlanResult, ReviewState } from '@bilimind/core';
import type { Ics } from '../contracts.ts';
import { DEFAULT_TIMEZONE, shortDay, tzOffsetMinutes, zoned, zonedToDate } from './time.ts';

export const STUDY_TIME = '20:00';          // evening study block (local)
export const REVIEW_TIME = '08:00';         // morning spaced review (local; review/state.json first due is 08:00 too)
const PRODID = '-//BiliMind//BiliMind Desktop//EN';

/** RFC 5545 TEXT escaping. */
export const icsText = (s: string): string => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Fold a content line at 75 octets (UTF-8), continuation lines start with one space. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let curBytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = out.length ? 74 : 75;           // continuation lines carry a leading space
    if (curBytes + b > limit) { out.push(cur); cur = ''; curBytes = 0; }
    cur += ch; curBytes += b;
  }
  if (cur) out.push(cur);
  return out.map((l, i) => (i ? ' ' + l : l)).join('\r\n');
}

const stampUtc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
/** Local wall time in tz as 20261011T200000. */
function localStamp(d: Date, tz: string): string {
  const z = zoned(d, tz);
  return `${z.date.replace(/-/g, '')}T${z.time.replace(/:/g, '')}`;
}
const offsetHHMM = (min: number) => `${min < 0 ? '-' : '+'}${String(Math.floor(Math.abs(min) / 60)).padStart(2, '0')}${String(Math.abs(min) % 60).padStart(2, '0')}`;

interface IcsEvent { uid: string; start: Date; end: Date; summary: string; description: string; alarmMin?: number }

export const ics: Ics = ({ course, plan, state }) => {
  const tz = course.goal?.timezone || plan.goal?.timezone || DEFAULT_TIMEZONE;
  const examAt = course.goal?.exam_at ?? plan.goal?.exam_at ?? null;
  const exam = examAt ? new Date(examAt) : null;
  const built = new Date(course.built_at);
  const stamp = stampUtc(Number.isFinite(built.getTime()) ? built : new Date());
  const lessonById = new Map(course.lessons.map(l => [l.id, l]));
  const events: IcsEvent[] = [];

  // study blocks: one per plan day that has lessons
  for (const d of plan.days ?? []) {
    const ls = (d.lessons ?? []).map(k => lessonById.get(k)).filter((l): l is Course['lessons'][number] => !!l);
    if (!ls.length || d.exam) continue;
    const minutes = Math.max(15, ls.reduce((s, l) => s + l.minutes, 0) || d.minutes || 30);
    const start = zonedToDate(d.date, STUDY_TIME, tz);
    events.push({
      uid: `${course.id}-study-${d.date}@bilimind`,
      start, end: new Date(start.getTime() + minutes * 60_000),
      summary: `Study: ${ls.map(l => l.title).join(' + ')}`,
      description: [
        `${course.title}. ${minutes} minutes.`,
        ...ls.map(l => `Lesson ${l.n}: ${l.title} (${l.minutes} min)`),
        'Open index.html in your course folder.',
      ].join('\n'),
      alarmMin: 10,
    });
  }

  // G2 review: plan.md, the day tiles and this file share ONE source: plan.review_dates (one event per day listing
  // the lessons); FSRS only decides which cards appear inside that session.
  const planned = new Map<string, string[]>();
  for (const [key, dates] of Object.entries(plan.review_dates ?? {})) {
    if (!lessonById.has(key)) continue;
    for (const d of dates ?? []) planned.set(d, [...(planned.get(d) ?? []), key]);
  }
  if (planned.size) {
    for (const [day, keys] of [...planned.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const ls = keys.map(k => lessonById.get(k)!);
      const cards = (state?.cards ?? []).filter(c => keys.includes(c.lesson));
      const start = zonedToDate(day, REVIEW_TIME, tz);
      const minutes = Math.max(10, ls.length * 5);
      events.push({
        uid: `${course.id}-review-${day}@bilimind`,
        start, end: new Date(start.getTime() + minutes * 60_000),
        summary: `Review: ${ls.map(l => l.title).join(', ')}`,
        description: [
          `Spaced review for ${course.title}, ${shortDay(day)}: ${ls.length} lesson${ls.length === 1 ? '' : 's'}, about ${minutes} minutes.`,
          'Open index.html, then Due today: it shows the cards that are due.',
          ...cards.slice(0, 6).map(c => `- ${c.prompt.length > 90 ? c.prompt.slice(0, 87) + '...' : c.prompt}`),
          ...(cards.length > 6 ? [`... and ${cards.length - 6} more`] : []),
        ].join('\n'),
        alarmMin: 0,
      });
    }
  }
  // fallback (no plan review dates): one event per day with due cards, at the earliest due time that day
  const byDay = new Map<string, { first: Date; cards: ReviewState['cards'] }>();
  for (const c of planned.size ? [] : state?.cards ?? []) {
    if (!lessonById.has(c.lesson)) continue;
    const due = new Date(c.fsrs.due);
    if (!Number.isFinite(due.getTime())) continue;
    const day = zoned(due, tz).date;
    const cur = byDay.get(day);
    if (!cur) byDay.set(day, { first: due, cards: [c] });
    else { cur.cards.push(c); if (due < cur.first) cur.first = due; }
  }
  for (const [day, { first, cards }] of [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const minutes = Math.max(10, Math.ceil(cards.length * 0.75));
    const titles = [...new Set(cards.map(c => lessonById.get(c.lesson)!.title))];
    events.push({
      uid: `${course.id}-review-${day}@bilimind`,
      start: first, end: new Date(first.getTime() + minutes * 60_000),
      summary: `Review: ${cards.length} card${cards.length === 1 ? '' : 's'} (${titles.join(', ')})`,
      description: [
        `Spaced review for ${course.title}, ${shortDay(day)}. Open index.html, then Due today.`,
        ...cards.slice(0, 8).map(c => `- ${c.prompt.length > 90 ? c.prompt.slice(0, 87) + '...' : c.prompt}`),
        ...(cards.length > 8 ? [`... and ${cards.length - 8} more`] : []),
      ].join('\n'),
      alarmMin: 0,
    });
  }

  const kept = events
    .filter(e => !exam || e.end.getTime() <= exam.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const off = tzOffsetMinutes(tz, exam ?? built);
  const lines: string[] = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:${PRODID}`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(course.title)}`, `X-WR-TIMEZONE:${tz}`,
    'BEGIN:VTIMEZONE', `TZID:${tz}`, 'BEGIN:STANDARD', 'DTSTART:19700101T000000',
    `TZOFFSETFROM:${offsetHHMM(off)}`, `TZOFFSETTO:${offsetHHMM(off)}`, `TZNAME:${offsetHHMM(off).slice(0, 3)}`,
    'END:STANDARD', 'END:VTIMEZONE',
  ];
  for (const e of kept) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${tz}:${localStamp(e.start, tz)}`, `DTEND;TZID=${tz}:${localStamp(e.end, tz)}`,
      `SUMMARY:${icsText(e.summary)}`, `DESCRIPTION:${icsText(e.description)}`, 'TRANSP:OPAQUE');
    if (e.alarmMin !== undefined) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(e.summary)}`, `TRIGGER:-PT${e.alarmMin}M`, 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
};

/** Minimal reader for tests and `grade`: unfolds lines and returns VEVENT property maps. */
export function parseIcs(text: string): Record<string, string>[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const events: Record<string, string>[] = [];
  let cur: Record<string, string> | null = null;
  let depth = 0;
  for (const line of unfolded.split(/\r?\n/)) {
    if (line === 'BEGIN:VEVENT') { cur = {}; depth = 0; continue; }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    if (line.startsWith('BEGIN:')) { depth++; continue; }
    if (line.startsWith('END:')) { depth--; continue; }
    if (depth) continue;
    const i = line.indexOf(':');
    if (i > 0) cur[line.slice(0, i)] = line.slice(i + 1);
  }
  return events;
}
