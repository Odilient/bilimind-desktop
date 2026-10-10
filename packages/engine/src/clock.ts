// G2 review: this PC's clock can be hours off (it was exactly 8 h slow). TTS already corrected for it; now every
// date the engine writes (plan day 1, review dates, REPORT and log times, .ics DTSTAMP, the countdown) uses the
// server time. The skew is measured once with the same HEAD probe `doctor` uses and cached in
// <course>/crew/clock.json and %USERPROFILE%/.bilimind/clock.json for 6 h (an offline result for 30 min, as 0).
// BILIMIND_CLOCK_SKEW_MS=<n> pins it; BILIMIND_NO_CLOCK=1 turns the probe off (skew 0).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { probeClock } from './doctor.ts';

const TTL_MS = 6 * 3_600_000;
const OFFLINE_TTL_MS = 30 * 60_000;
const MIN_SKEW = 60_000;

function cachePath(): string {
  const env = process.env;
  const home = env.USERPROFILE || env.HOME || homedir();
  return join(env.BILIMIND_HOME ? resolve(env.BILIMIND_HOME) : join(home, '.bilimind'), 'clock.json');
}

let memo: Promise<number> | null = null;

interface ClockCache { skew_ms?: number; local_at?: number; ok?: boolean; measured?: number | null }
function readCache(path: string): number | null {
  try {
    if (!existsSync(path)) return null;
    const c = JSON.parse(readFileSync(path, 'utf8')) as ClockCache;
    const age = Date.now() - Number(c.local_at ?? 0);
    if (typeof c.skew_ms === 'number' && age >= 0 && age < (c.ok ? TTL_MS : OFFLINE_TTL_MS)) return c.skew_ms;
  } catch { /* re-measure */ }
  return null;
}
function writeCache(path: string, c: ClockCache): void {
  try { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(c, null, 2)); } catch { /* cache is optional */ }
}
const crewCache = (course?: string) => (course && existsSync(join(course, 'crew')) ? join(course, 'crew', 'clock.json') : null);
let last: ClockCache | null = null;

/**
 * Server time minus local time in ms (0 when within a minute, offline, or switched off). Never throws. Measured once
 * per process (in-process memo) and cached in <course>/crew/clock.json and %USERPROFILE%/.bilimind/clock.json.
 */
export function clockSkewMs(course?: string): Promise<number> {
  memo ??= (async () => {
    const env = process.env;
    if (env.BILIMIND_CLOCK_SKEW_MS && Number.isFinite(Number(env.BILIMIND_CLOCK_SKEW_MS))) return Number(env.BILIMIND_CLOCK_SKEW_MS);
    if (env.BILIMIND_NO_CLOCK === '1') return 0;
    const crew = crewCache(course);
    const cached = (crew ? readCache(crew) : null) ?? readCache(cachePath());
    if (cached !== null) return cached;
    let skew: number | null = null;
    for (const url of ['https://api.deepseek.com/', 'https://speech.platform.bing.com/']) {
      const r = await probeClock(url, 3000);
      if (r.skew_ms !== null) { skew = r.skew_ms; break; }
    }
    const value = skew !== null && Math.abs(skew) >= MIN_SKEW ? skew : 0;
    last = { skew_ms: value, local_at: Date.now(), ok: skew !== null, measured: skew };
    writeCache(cachePath(), last);
    return value;
  })().catch(() => 0);
  return memo.then(v => {
    // the course folder keeps the skew its dates were made with (crew/clock.json), once per process
    const crew = crewCache(course);
    if (crew && !written.has(crew) && !process.env.BILIMIND_CLOCK_SKEW_MS && process.env.BILIMIND_NO_CLOCK !== '1') {
      written.add(crew);
      writeCache(crew, last ?? { skew_ms: v, local_at: Date.now(), ok: true, measured: v });
    }
    return v;
  });
}
const written = new Set<string>();

/** A Ctx `now` that returns the corrected time. */
export const skewedNow = (skewMs: number) => (): Date => new Date(Date.now() + skewMs);
