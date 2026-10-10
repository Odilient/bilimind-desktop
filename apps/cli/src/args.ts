// Option parsing helpers. Every parse error is a BilimindError, so it still answers with one JSON line.
import { BilimindError } from '@bilimind/engine';

/** commander collector for repeatable options (`--assume a --assume b`). */
export const collect = (value: string, prev: string[] = []): string[] => [...prev, value];

/** "a,b , c" -> ['a','b','c'] */
export const csv = (v: string | undefined): string[] => (v ?? '').split(',').map(s => s.trim()).filter(Boolean);

/** ["k=v", ...] -> {k: v}; the value may contain '=' (only the first one splits). */
export function pairs(list: string[] | undefined, flag: string, example: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of list ?? []) {
    const i = raw.indexOf('=');
    const k = i > 0 ? raw.slice(0, i).trim() : '';
    const v = i > 0 ? raw.slice(i + 1).trim() : '';
    if (!k || !v) throw new BilimindError(`${flag} expects key=value, got "${raw}"`, `Example: ${flag} "${example}"`);
    out[k] = v;
  }
  return out;
}

export function int(v: string | undefined, flag: string, min: number, max: number, fallback?: number): number {
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    throw new BilimindError(`${flag} is required`, `Pass ${flag} <${min}-${max}>.`);
  }
  const x = Number(v);
  if (!Number.isInteger(x) || x < min || x > max) throw new BilimindError(`${flag} must be a whole number ${min}-${max}, got ${v}`, `Pass ${flag} <${min}-${max}>.`);
  return x;
}

/** Short argument summary for crew/log.jsonl (never more than 200 chars). */
export function argSummary(o: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === false || (Array.isArray(v) && !v.length)) continue;
    const flag = '--' + k.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
    if (v === true) { parts.push(flag); continue; }
    const vals = Array.isArray(v) ? v : [v];
    for (const x of vals) {
      const s = String(x);
      parts.push(`${flag} ${/\s/.test(s) ? JSON.stringify(s.length > 60 ? s.slice(0, 57) + '...' : s) : s}`);
    }
  }
  const s = parts.join(' ');
  return s.length > 200 ? s.slice(0, 197) + '...' : s;
}
