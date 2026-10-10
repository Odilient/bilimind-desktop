// Q12: playground formulas. isSafeFormula is the BlockPayloadNormaliser rule (engine-port §4 row 19); sweepFormula
// evaluates compute() on 28 points across one input in node:vm (200 ms budget) and reports whether every output is a
// finite number and whether the output actually moves (a flat line has nothing to discover).
import vm from 'node:vm';
import type { IsSafeFormula } from '../contracts.ts';

const SHAPE = /^\s*function\s+compute\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\{([\s\S]*)\}\s*;?\s*$/;
const FORBIDDEN = ['import', 'require(', 'fetch(', 'xmlhttprequest', 'while', 'eval(', 'function', '=>', 'settimeout', 'setinterval',
  'document', 'window', 'globalthis', 'localstorage', 'postmessage', 'worker', 'math.random', 'new function', 'constructor',
  'process', '__proto__', 'prototype', 'this'];

export interface FormulaProblem { ok: boolean; why: string | null; param: string | null; reads: string[] }

/** Why a formula is unsafe (null = safe). Same rules as isSafeFormula, with the reason for the report. */
export function formulaProblem(formula: string, inputKeys: string[]): FormulaProblem {
  const no = (why: string, param: string | null = null, reads: string[] = []): FormulaProblem => ({ ok: false, why, param, reads });
  if (typeof formula !== 'string' || !formula.trim()) return no('formula_js is empty');
  if (formula.length > 1200) return no(`formula_js is ${formula.length} characters (max 1200)`);
  const m = SHAPE.exec(formula);
  if (!m) return no('formula_js must be exactly `function compute(p) { ... }`');
  const param = m[1]!, body = m[2]!;
  const low = body.toLowerCase();
  if (!/\breturn\b/.test(body)) return no('compute() never returns a value', param);
  const bad = FORBIDDEN.find(w => (/^[a-z_]+$/.test(w) ? new RegExp(`\\b${w}\\b`).test(low) : low.includes(w)));
  if (bad) return no(`formula_js uses \`${bad}\`, which is not allowed in a playground`, param);
  if (new RegExp(`\\b${param.replace(/\$/g, '\\$')}\\s*\\[`).test(body)) return no(`read inputs as ${param}.key, not ${param}[...]`, param);
  const reads = [...body.matchAll(new RegExp(`\\b${param.replace(/\$/g, '\\$')}\\s*\\.\\s*([A-Za-z_$][\\w$]*)`, 'g'))].map(x => x[1]!);
  if (!reads.length) return no(`compute() never reads an input (${param}.<key>)`, param, reads);
  const unknown = [...new Set(reads.filter(r => !inputKeys.includes(r)))];
  if (unknown.length) return no(`compute() reads ${unknown.map(u => `${param}.${u}`).join(', ')}, which ${unknown.length === 1 ? 'is not an input' : 'are not inputs'} (inputs: ${inputKeys.join(', ') || 'none'})`, param, reads);
  return { ok: true, why: null, param, reads: [...new Set(reads)] };
}

export const isSafeFormula: IsSafeFormula = (formula, inputKeys) => formulaProblem(formula, inputKeys).ok;

export interface PlaygroundInput { key: string; min: number; max: number; step?: number; default: number }
export interface Sweep { input: string; xs: number[]; ys: unknown[]; finite: boolean; constant: boolean; error: string | null }

/** compute() at 28 evenly spaced values of `inputs[index]` (others at their defaults), inside node:vm. */
export function sweepFormula(formula: string, inputs: PlaygroundInput[], index = 0, timeoutMs = 200, points = 28): Sweep {
  const target = inputs[index]!;
  const base: Record<string, number> = {};
  for (const i of inputs) base[i.key] = Number(i.default);
  const xs = Array.from({ length: points }, (_, k) => target.min + ((target.max - target.min) * k) / (points - 1));
  const args = xs.map(x => ({ ...base, [target.key]: x }));
  const ctx = vm.createContext(Object.create(null) as object, { codeGeneration: { strings: false, wasm: false } });
  let ys: unknown[] = [];
  try {
    const out = vm.runInContext(
      `${formula}\n;(function (pts) { var r = []; for (var k = 0; k < pts.length; k++) r.push(compute(pts[k])); return JSON.stringify(r.map(function (y) { return typeof y === 'number' ? (isFinite(y) ? y : String(y)) : (y === undefined ? '(undefined)' : String(y)); })); })(${JSON.stringify(args)})`,
      ctx, { timeout: timeoutMs, filename: 'playground.js' });
    ys = JSON.parse(String(out)) as unknown[];
  } catch (e) {
    const timeout = (e as { code?: string })?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT';
    const msg = timeout ? `compute() did not finish within ${timeoutMs} ms` : `compute() threw: ${(e as { message?: string })?.message ?? String(e)}`;
    return { input: target.key, xs, ys: [], finite: false, constant: false, error: msg };
  }
  const finite = ys.length === xs.length && ys.every(y => typeof y === 'number' && Number.isFinite(y));
  const nums = ys.filter((y): y is number => typeof y === 'number');
  const lo = Math.min(...nums), hi = Math.max(...nums);
  const constant = finite && hi - lo <= 1e-9 * Math.max(1, Math.abs(hi), Math.abs(lo));
  return { input: target.key, xs, ys, finite, constant, error: null };
}
