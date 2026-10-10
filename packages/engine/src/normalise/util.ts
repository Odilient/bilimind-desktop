// Small helpers shared by the normalisers: ports of the PHP text()/stringList()/number() accessors.
export type Raw = Record<string, unknown>;

export const isObj = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);

/** PHP text(): a string or number, trimmed; '' and anything else -> null. */
export function text(o: unknown, key: string): string | null {
  if (!isObj(o)) return null;
  const v = o[key];
  if (typeof v !== 'string' && !(typeof v === 'number' && Number.isFinite(v))) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}
/** First non-empty alias. */
export function textOf(o: unknown, ...keys: string[]): string | null {
  for (const k of keys) { const t = text(o, k); if (t !== null) return t; }
  return null;
}

export function number(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** PHP stringList(): strings/numbers only, trimmed, non-empty, at most `max`. */
export function stringList(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== 'string' && !(typeof x === 'number' && Number.isFinite(x))) continue;
    const t = String(x).trim();
    if (t !== '') out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** Laravel Str::limit with a total length that never exceeds `n` (the core schemas count the suffix too). */
export function cap(value: string, n: number, end = '...'): string {
  const cps = [...value];
  if (cps.length <= n) return value;
  return cps.slice(0, Math.max(0, n - end.length)).join('').trimEnd() + end;
}

/** Copy an object without null/undefined values (core zod schemas use `.optional()`, not `.nullable()`). */
export function compact<T extends Raw>(o: T): T {
  const out: Raw = {};
  for (const [k, v] of Object.entries(o)) if (v !== null && v !== undefined) out[k] = v;
  return out as T;
}

/** Str::slug('_'): ascii, lowercase, non-alphanumerics -> '_'. */
export function slug(value: string, max = 64): string {
  return value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, max).replace(/_+$/g, '');
}

export const words = (s: string): number => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;

/** "a", "b", ... by index (PHP chr(97 + i % 26)). */
export const letter = (i: number): string => String.fromCharCode(97 + (i % 26));
