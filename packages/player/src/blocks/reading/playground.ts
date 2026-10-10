// Playground engine (player-design §5.14): the model-written `function compute(i) { return ...; }` runs
// in a Blob Web Worker (never on the main thread), one batch per evaluation: the current value plus a
// 28-point sweep of the first input. A run that takes longer than 1.5 s kills the worker.

export const SWEEP_POINTS = 28;
export const TIMEOUT_MS = 1500;

export interface PlayInput { key: string; label: string; min: number; max: number; step: number; default: number; unit?: string }
export interface BatchResult { values: (number | null)[]; error?: string; timedOut?: boolean }

/**
 * Evaluate `formula` for each input object. MUST stay self-contained (no outer references, no imports,
 * no spread helpers): its source text is pasted into the worker via Function.prototype.toString().
 */
export function evaluateBatch(formula: string, calls: Record<string, number>[]): BatchResult {
  let compute: unknown;
  try {
    compute = new Function('"use strict";\n' + formula + '\n;return typeof compute === "function" ? compute : null;')();
  } catch (e) {
    return { values: [], error: 'The formula does not parse: ' + String((e && (e as Error).message) || e) };
  }
  if (typeof compute !== 'function') return { values: [], error: 'The formula has no compute(i) function.' };
  const values: (number | null)[] = [];
  for (let k = 0; k < calls.length; k++) {
    try {
      const v = Number((compute as (i: Record<string, number>) => unknown)(Object.freeze(Object.assign({}, calls[k]))));
      values.push(Number.isFinite(v) ? v : null);
    } catch {
      values.push(null);
    }
  }
  return { values };
}

/** The worker's whole source (exported for tests). */
export function workerSource(): string {
  return `"use strict";
const evaluateBatch = ${evaluateBatch.toString()};
self.onmessage = function (e) {
  var d = e.data || {};
  var r;
  try { r = evaluateBatch(String(d.formula || ''), d.calls || []); }
  catch (err) { r = { values: [], error: String((err && err.message) || err) }; }
  self.postMessage({ id: d.id, values: r.values, error: r.error });
};`;
}

/** Long-lived worker; on a timeout it is terminated and a fresh one is made for the next run. */
export class PlaygroundRunner {
  private worker: Worker | null = null;
  private url: string | null = null;
  private seq = 0;
  readonly supported: boolean;

  constructor(private timeoutMs = TIMEOUT_MS) {
    this.supported = typeof Worker !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
  }

  private spawn(): Worker {
    if (this.worker) return this.worker;
    if (!this.url) this.url = URL.createObjectURL(new Blob([workerSource()], { type: 'text/javascript' }));
    this.worker = new Worker(this.url);
    return this.worker;
  }

  run(formula: string, calls: Record<string, number>[]): Promise<BatchResult> {
    if (!this.supported) return Promise.resolve(fallback(formula, calls));
    let w: Worker;
    try { w = this.spawn(); } catch { return Promise.resolve(fallback(formula, calls)); }
    const id = ++this.seq;
    return new Promise(resolve => {
      const done = (r: BatchResult) => { clearTimeout(timer); w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr); resolve(r); };
      const onMsg = (e: MessageEvent) => { if (e.data?.id === id) done({ values: e.data.values ?? [], error: e.data.error }); };
      const onErr = (e: ErrorEvent) => { e.preventDefault?.(); this.kill(); done({ values: [], error: e.message || 'The calculation crashed.' }); };
      const timer = setTimeout(() => { this.kill(); done({ values: [], timedOut: true, error: 'The calculation took longer than 1.5 s, so it was stopped.' }); }, this.timeoutMs);
      w.addEventListener('message', onMsg);
      w.addEventListener('error', onErr);
      w.postMessage({ id, formula, calls });
    });
  }

  kill(): void { this.worker?.terminate(); this.worker = null; }

  dispose(): void {
    this.kill();
    if (this.url) { URL.revokeObjectURL(this.url); this.url = null; }
  }
}

/** No Worker at all: run on the main thread only when the formula cannot loop. */
function fallback(formula: string, calls: Record<string, number>[]): BatchResult {
  if (/\b(while|for|do)\b|=>|setInterval|setTimeout/.test(formula.replace(/function\s+compute\s*\(/, ''))) {
    return { values: [], error: 'This browser cannot run the calculation safely (no Web Workers).' };
  }
  return evaluateBatch(formula, calls);
}

// ---------- pure helpers (tested) ----------

/** The 28 x positions of the first input's sweep. */
export function sweepXs(input: Pick<PlayInput, 'min' | 'max'> | undefined, n = SWEEP_POINTS): number[] {
  if (!input) return [];
  const span = input.max - input.min;
  if (!Number.isFinite(span) || span <= 0) return [];
  return Array.from({ length: n }, (_, i) => input.min + (span * i) / (n - 1));
}

/** The batch: [current, ...sweep] as input objects. */
export function buildCalls(inputs: PlayInput[], values: Record<string, number>, n = SWEEP_POINTS): Record<string, number>[] {
  const cur: Record<string, number> = {};
  for (const i of inputs) cur[i.key] = Number.isFinite(values[i.key]) ? values[i.key]! : i.default;
  const first = inputs[0];
  return [cur, ...sweepXs(first, n).map(x => ({ ...cur, [first!.key]: x }))];
}

export const decimalsOf = (step: number): number => {
  const s = String(step);
  if (s.includes('e-')) return Math.min(6, Number(s.split('e-')[1]));
  return s.includes('.') ? Math.min(6, s.split('.')[1]!.length) : 0;
};

/** Slider label: as many decimals as the step has. */
export const fmtInput = (v: number, step: number): string => v.toFixed(decimalsOf(step));

/** The big number: 2.5, 8.5, 1.78, 50.5, 1,240. */
export function fmtOutput(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  const digits = a >= 1000 ? 0 : a >= 100 ? 1 : a >= 1 ? 2 : a >= 0.01 ? 3 : 4;
  const s = v.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  return s === '-0' ? '0' : s;
}

/** About `count` round tick values covering [lo, hi]. */
export function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  if (hi === lo) { hi = lo + 1; }
  const raw = (hi - lo) / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? 10 * mag;
  const start = Math.floor(lo / step) * step;
  const out: number[] = [];
  for (let t = start; t <= hi + step * 0.5; t += step) out.push(Number(t.toFixed(10)));
  return out;
}

export interface Discover { input: string; op: '>' | '>=' | '<' | '<='; value: number; say: string }

export function crossed(d: Discover | undefined, values: Record<string, number>): boolean {
  if (!d) return false;
  const v = values[d.input];
  if (v === undefined || !Number.isFinite(v)) return false;
  const eps = 1e-9;
  switch (d.op) {
    case '>': return v > d.value + eps;
    case '>=': return v >= d.value - eps;
    case '<': return v < d.value - eps;
    case '<=': return v <= d.value + eps;
    default: return false;
  }
}

export interface ChartGeom {
  path: string; area: string; xTicks: { x: number; label: string }[]; yTicks: { y: number; label: string }[];
  markerX: number | null; markerY: number | null; zone: { x: number; w: number } | null;
}

/** SVG geometry for the sweep chart in a `w` x `h` box with left/bottom axis gutters. */
export function chartGeometry(opts: {
  w: number; h: number; xs: number[]; ys: (number | null)[]; current: number | null; currentY: number | null;
  step: number; discover?: Discover; sweptKey?: string;
}): ChartGeom & { pad: { l: number; r: number; t: number; b: number } } {
  const pad = { l: 44, r: 14, t: 14, b: 28 };
  const { w, h, xs, ys } = opts;
  const pts = xs.map((x, i) => [x, ys[i]] as const).filter((p): p is readonly [number, number] => p[1] !== null && Number.isFinite(p[1]));
  const empty = { path: '', area: '', xTicks: [], yTicks: [], markerX: null, markerY: null, zone: null, pad };
  if (pts.length < 2 || w < 60) return empty;
  const x0 = xs[0]!, x1 = xs[xs.length - 1]!;
  const yVals = pts.map(p => p[1]);
  let lo = Math.min(...yVals), hi = Math.max(...yVals);
  if (lo > 0 && lo < hi * 0.6) lo = 0;   // anchor positive curves at zero when that does not flatten them
  const ticks = niceTicks(lo, hi, 4);
  lo = Math.min(lo, ticks[0] ?? lo);
  hi = Math.max(hi, ticks[ticks.length - 1] ?? hi);
  const sx = (x: number) => pad.l + ((x - x0) / (x1 - x0 || 1)) * (w - pad.l - pad.r);
  const sy = (y: number) => pad.t + (1 - (y - lo) / (hi - lo || 1)) * (h - pad.t - pad.b);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join('');
  const base = sy(lo).toFixed(1);
  const area = `${path}L${sx(pts[pts.length - 1]![0]).toFixed(1)},${base}L${sx(pts[0]![0]).toFixed(1)},${base}Z`;
  const xt = niceTicks(x0, x1, 4).filter(t => t >= x0 - 1e-9 && t <= x1 + 1e-9);
  const xd = Math.max(decimalsOf(opts.step), xt.some(t => !Number.isInteger(t)) ? 1 : 0);
  const xTicks = xt.map(t => ({ x: sx(t), label: Number(t.toFixed(Math.min(4, xd + 1))).toString() }));
  const yTicks = ticks.map(t => ({ y: sy(t), label: fmtOutput(t) }));
  const markerX = opts.current === null ? null : sx(Math.min(x1, Math.max(x0, opts.current)));
  const markerY = opts.currentY === null || !Number.isFinite(opts.currentY) ? null : sy(Math.min(hi, Math.max(lo, opts.currentY)));
  let zone: { x: number; w: number } | null = null;
  if (opts.discover && opts.discover.input === opts.sweptKey) {
    const zx = sx(Math.min(x1, Math.max(x0, opts.discover.value)));
    zone = opts.discover.op.startsWith('>') ? { x: zx, w: sx(x1) - zx } : { x: sx(x0), w: zx - sx(x0) };
  }
  return { path, area, xTicks, yTicks, markerX, markerY, zone, pad };
}
