// Q11: the node:vm harness that runs a JavaScript exercise against its tests (engine-port §5.3).
// Each test gets a FRESH context (no state leaks between tests): the code runs, then the test's `call`
// expression is evaluated, both under one `timeoutMs` budget (2 s), and the result is deep-compared with
// `expect`. A test without `call` is a script-mode test: the code's console output (trimmed) must equal `expect`.
// After a timeout the remaining tests are not run (an infinite loop must not cost 2 s per test).
// node:vm is not a security boundary; this runs model-written exercises from our own pipeline, in a context
// with a null prototype, no require/process, and string code generation (eval / new Function) disabled.
import vm from 'node:vm';
import type { JsTestResult, JsTestRun, RunJsTests } from '../contracts.ts';

export interface JsTest { name: string; call?: string; expect?: unknown }

/**
 * engine-port §5.3 deepEqual: strict equality, NaN == NaN, arrays elementwise, plain objects by own keys.
 * Works across vm realms (Array.isArray, no instanceof). One leniency: an expected `null` matches `undefined`
 * (JSON has no undefined, so "returns nothing" is written as null).
 */
export function deepEqual(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (expected === null && actual === undefined) return true;
  if (typeof actual === 'number' && typeof expected === 'number') return Number.isNaN(actual) && Number.isNaN(expected);
  if (actual === null || expected === null || typeof actual !== 'object' || typeof expected !== 'object') return false;
  const aa = Array.isArray(actual), ea = Array.isArray(expected);
  if (aa !== ea) return false;
  if (aa) {
    const a = actual as unknown[], e = expected as unknown[];
    return a.length === e.length && a.every((x, i) => deepEqual(x, e[i]));
  }
  const a = actual as Record<string, unknown>, e = expected as Record<string, unknown>;
  const ka = Object.keys(a).filter(k => a[k] !== undefined), ke = Object.keys(e).filter(k => e[k] !== undefined);
  return ka.length === ke.length && ke.every(k => Object.prototype.hasOwnProperty.call(a, k) && deepEqual(a[k], e[k]));
}

/** A JSON-safe copy of a value for reports ("expected 2, got 4"). */
export function toPlain(v: unknown): unknown {
  if (v === undefined) return '(undefined)';
  if (typeof v === 'number' && !Number.isFinite(v)) return String(v);
  if (typeof v === 'function') return '(function)';
  if (typeof v === 'bigint' || typeof v === 'symbol') return String(v);
  try {
    const s = JSON.stringify(v);
    return s === undefined ? String(v) : JSON.parse(s);
  } catch {
    return String(v);
  }
}

const errMessage = (e: unknown): string => {
  if (e && typeof e === 'object' && 'message' in e) {
    const name = 'name' in e && typeof (e as { name: unknown }).name === 'string' ? (e as { name: string }).name : 'Error';
    return `${name}: ${String((e as { message: unknown }).message)}`;
  }
  return String(e);
};
const isTimeout = (e: unknown): boolean =>
  !!e && typeof e === 'object' && (e as { code?: unknown }).code === 'ERR_SCRIPT_EXECUTION_TIMEOUT';

const BOOT = `
var __out = [];
var __fmt = function (a) { if (typeof a === 'string') return a; try { var s = JSON.stringify(a); return s === undefined ? String(a) : s; } catch (e) { return String(a); } };
var console = { log: function () { __out.push(Array.prototype.map.call(arguments, __fmt).join(' ')); } };
console.info = console.log; console.warn = console.log; console.error = console.log; console.debug = console.log;
`;

function freshContext(): vm.Context {
  const ctx = vm.createContext(Object.create(null) as object, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(BOOT, ctx);
  return ctx;
}

/** Syntax check without running: returns the message or null. */
export function syntaxError(code: string): string | null {
  try {
    new vm.Script(code, { filename: 'exercise.js' });
    return null;
  } catch (e) {
    return errMessage(e);
  }
}

export const runJsTests: RunJsTests = (code, tests, timeoutMs = 2000) => {
  const results: JsTestResult[] = [];
  const syn = syntaxError(code);
  if (syn) {
    for (const t of tests) results.push({ name: t.name, passed: false, expected: toPlain(t.expect), actual: null, error: syn });
    return { passed: 0, total: tests.length, results, timedOut: false, syntaxError: syn };
  }
  const script = new vm.Script(code, { filename: 'exercise.js' });
  let timedOut = false;
  for (const t of tests) {
    const expected = toPlain(t.expect);
    if (timedOut) { results.push({ name: t.name, passed: false, expected, actual: null, error: 'not run: an earlier test timed out' }); continue; }
    const ctx = freshContext();
    const started = Date.now();
    try {
      script.runInContext(ctx, { timeout: timeoutMs });
      if (t.call && t.call.trim()) {
        const left = Math.max(1, timeoutMs - (Date.now() - started));
        const actual = vm.runInContext(`(${t.call}\n)`, ctx, { timeout: left, filename: 'test.js' });
        if (actual && typeof (actual as { then?: unknown }).then === 'function') {
          results.push({ name: t.name, passed: false, expected, actual: '(Promise)', error: 'the call returned a Promise; tests must be synchronous' });
          continue;
        }
        results.push({ name: t.name, passed: deepEqual(actual, t.expect), expected, actual: toPlain(actual) });
      } else {
        const out = (vm.runInContext('__out.join("\\n")', ctx) as string).trim();
        const want = t.expect === undefined || t.expect === null ? '' : (typeof t.expect === 'string' ? t.expect : JSON.stringify(t.expect)).trim();
        results.push({ name: t.name, passed: out === want, expected: want, actual: out });
      }
    } catch (e) {
      if (isTimeout(e)) {
        timedOut = true;
        results.push({ name: t.name, passed: false, expected, actual: null, error: `timed out after ${timeoutMs} ms (infinite loop?)` });
      } else {
        results.push({ name: t.name, passed: false, expected, actual: null, error: errMessage(e) });
      }
    }
  }
  const run: JsTestRun = { passed: results.filter(r => r.passed).length, total: tests.length, results, timedOut };
  return run;
};
