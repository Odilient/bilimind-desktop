// Time-zone helpers shared by WP4 (build, review, .ics, receipts). Course times are shown in the goal's zone
// (default Asia/Kuala_Lumpur, UTC+8, no DST), never the machine's: the demo PC's own clock/zone is unreliable.
// Owner: WP4.

export const DEFAULT_TIMEZONE = 'Asia/Kuala_Lumpur';
const DAY_MS = 86_400_000;

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat | null {
  if (fmtCache.has(tz)) return fmtCache.get(tz)!;
  try {
    const f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
    });
    fmtCache.set(tz, f);
    return f;
  } catch {
    return null;
  }
}

/** Minutes east of UTC for `tz` at instant `at` (+480 for Kuala Lumpur). Falls back to +480 when Intl lacks the zone. */
export function tzOffsetMinutes(tz: string, at: Date): number {
  const f = formatter(tz);
  if (!f) return 480;
  const p = Object.fromEntries(f.formatToParts(at).map(x => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour! % 24, +p.minute!, +p.second!);
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
}

const pad = (n: number, w = 2) => String(Math.abs(n)).padStart(w, '0');
const offsetText = (min: number) => `${min < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(min) / 60))}:${pad(Math.abs(min) % 60)}`;

/** Wall-clock parts of `at` in `tz`. */
export function zoned(at: Date, tz: string = DEFAULT_TIMEZONE): { date: string; time: string; hm: string; offset: string; weekday: number } {
  const off = tzOffsetMinutes(tz, at);
  const local = new Date(at.getTime() + off * 60_000);
  const date = local.toISOString().slice(0, 10);
  const time = local.toISOString().slice(11, 19);
  return { date, time, hm: time.slice(0, 5), offset: offsetText(off), weekday: local.getUTCDay() };
}

/** ISO datetime with the zone's offset: '2026-10-10T21:40:00+08:00'. */
export function isoInZone(at: Date, tz: string = DEFAULT_TIMEZONE): string {
  const z = zoned(at, tz);
  return `${z.date}T${z.time}${z.offset}`;
}

/** The instant of wall time `date` 'YYYY-MM-DD' + `hm` 'HH:MM' in `tz`. */
export function zonedToDate(date: string, hm: string, tz: string = DEFAULT_TIMEZONE): Date {
  const [h, m] = hm.split(':').map(Number);
  const wall = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), h ?? 0, m ?? 0);
  let t = wall - tzOffsetMinutes(tz, new Date(wall)) * 60_000;
  t = wall - tzOffsetMinutes(tz, new Date(t)) * 60_000;   // second pass settles DST edges
  return new Date(t);
}

/** '2026-10-12' + n days. */
export function addDays(date: string, n: number): string {
  return new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) + n * DAY_MS).toISOString().slice(0, 10);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** 'Wednesday 14 October' for a 'YYYY-MM-DD'. */
export function longDay(date: string): string {
  const d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)));
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
/** 'Wed 14 Oct'. */
export function shortDay(date: string): string {
  const d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)));
  return `${WEEKDAYS[d.getUTCDay()]!.slice(0, 3)} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]!.slice(0, 3)}`;
}
/** '9:00' from 'HH:MM' (drops the leading zero). */
export const clockText = (hm: string): string => hm.replace(/^0(\d)/, '$1');

/** Local date + time of an ISO datetime with offset ('2026-10-14T09:00:00+08:00' -> {date '2026-10-14', hm '09:00'}) in tz. */
export function localOf(iso: string, tz: string = DEFAULT_TIMEZONE): { date: string; hm: string } {
  const z = zoned(new Date(iso), tz);
  return { date: z.date, hm: z.hm };
}
