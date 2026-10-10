// Dates for the home: today in the course's time zone, the exam countdown, short labels.
// The demo can pin "now" with ?now=2026-10-12 or ?now=2026-10-12T09:00:00+08:00 in the URL (hash or search).

const DAY_MS = 86_400_000;

function nowOverride(): string | null {
  try {
    const href = typeof location !== 'undefined' ? location.href : '';
    const m = href.match(/[?&]now=([^&#]+)/);
    return m ? decodeURIComponent(m[1]!) : null;
  } catch { return null; }
}

/** The current time, or the ?now= override (a date alone means 08:00 that day, local to the course). */
export function now(): Date {
  const o = nowOverride();
  if (o) {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(o) ? `${o}T08:00:00+08:00` : o);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/** YYYY-MM-DD of an instant in a time zone (browser zone when tz is missing or unknown). */
export function ymdIn(d: Date, tz?: string | null): string {
  try {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit' });
    return f.format(d);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Parts of a plain date (no zone maths: a plan date is a calendar day). */
export function dayParts(ymd: string): { weekday: string; weekdayLong: string; day: number; month: string } {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return { weekday: WEEKDAYS[dt.getUTCDay()]!, weekdayLong: WEEKDAYS_LONG[dt.getUTCDay()]!, day: d, month: MONTHS[m - 1]! };
}

/** Whole days from a to b (both YYYY-MM-DD). */
export function daysFromTo(a: string, b: string): number {
  const t = (s: string) => { const [y, m, d] = s.split('-').map(Number) as [number, number, number]; return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / DAY_MS);
}

/** Exam labels in the course time zone: { ymd, weekday: 'Wed', day: '14 Oct', time: '9:00' }. */
export function examInfo(examAt: string | null | undefined, tz?: string | null): { ymd: string; weekday: string; weekdayLong: string; day: string; time: string } | null {
  if (!examAt) return null;
  const d = new Date(examAt);
  if (Number.isNaN(d.getTime())) return null;
  const ymd = ymdIn(d, tz);
  const p = dayParts(ymd);
  let time = '';
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz || undefined, hour: 'numeric', minute: '2-digit', hour12: false }).formatToParts(d);
    const h = Number(parts.find(x => x.type === 'hour')?.value ?? '0');
    const mi = parts.find(x => x.type === 'minute')?.value ?? '00';
    time = `${h}:${mi}`;
  } catch { time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; }
  return { ymd, weekday: p.weekday, weekdayLong: p.weekdayLong, day: `${p.day} ${p.month}`, time };
}

/** The countdown chip on the hero title: 'TODAY', 'TOMORROW', '4 DAYS'; null once the exam day has passed. */
export function countdownChip(examYmd: string | null | undefined, todayYmd: string): string | null {
  if (!examYmd) return null;
  const n = daysFromTo(todayYmd, examYmd);
  if (n < 0) return null;
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  return `${n} days`;
}

/** "3d 14h 05m" until the exam (or null when it has started). */
export function countdownText(examAt: string | null | undefined, at: Date): string | null {
  if (!examAt) return null;
  const ms = new Date(examAt).getTime() - at.getTime();
  if (!(ms > 0)) return null;
  const d = Math.floor(ms / DAY_MS);
  const h = Math.floor((ms % DAY_MS) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return d > 0 ? `${d}d ${h}h ${String(m).padStart(2, '0')}m` : `${h}h ${String(m).padStart(2, '0')}m`;
}

/** 75 -> "1h 15m", 35 -> "35 min". */
export function fmtMinutes(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

/** 83_400 -> "1:23". */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "last night", "this morning", "yesterday", "on 10 Oct" for the hero eyebrow. */
export function builtWhen(builtAt: string, at: Date, tz?: string | null): string {
  const b = new Date(builtAt);
  if (Number.isNaN(b.getTime())) return '';
  const days = daysFromTo(ymdIn(b, tz), ymdIn(at, tz));
  let hour = b.getHours();
  try { hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz || undefined, hour: 'numeric', hour12: false }).format(b)); } catch { /* browser zone */ }
  if (days <= 0) return hour < 12 ? 'this morning' : hour < 18 ? 'today' : 'tonight';
  if (days === 1) return hour >= 18 ? 'last night' : 'yesterday';
  const p = dayParts(ymdIn(b, tz));
  return `on ${p.day} ${p.month}`;
}

/** "10 Oct 2026" */
export function fmtLongDate(iso: string, tz?: string | null): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const ymd = ymdIn(d, tz);
  const p = dayParts(ymd);
  return `${p.day} ${p.month} ${ymd.slice(0, 4)}`;
}
