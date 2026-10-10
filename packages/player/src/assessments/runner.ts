// JavaScript test runner for code blocks (function / debug mode): a classic Blob worker per run (works on
// file://, media.md 4), killed after TIMEOUT_MS. Same semantics as the engine's node:vm harness: the learner's
// code runs first, then each test's `call` is ONE expression evaluated in the same scope and deep-compared
// with `expect` (strict, NaN == NaN, arrays elementwise, plain objects by own keys).

export const TIMEOUT_MS = 1500;
const MAX_LOG_LINES = 200;

export interface RunTest { name: string; call?: string; expect?: unknown }
export interface TestOutcome { name: string; passed: boolean; expected: string; actual: string; error?: string }
export interface LogLine { k: 'log' | 'warn' | 'error'; t: string }
export interface RunResult {
  results: TestOutcome[];
  logs: LogLine[];
  passed: string[];          // names of passed tests (core gradeCode input)
  timedOut: boolean;
  syntaxError?: string;      // the learner's code did not parse
  runtimeError?: string;     // the learner's top-level code threw
  ms: number;
}

/**
 * The worker body. Plain ES5-ish source (it is stringified into a Blob), no imports. `__run` is also used
 * directly by the unit tests (node), so it must not touch `self` itself.
 */
export function __run(code: string, tests: RunTest[], maxLines: number): Omit<RunResult, 'passed' | 'timedOut' | 'ms'> {
  var logs: LogLine[] = [];
  function fmt(v: unknown): string {
    if (typeof v === 'string') return v;
    try { var s = JSON.stringify(v); return s === undefined ? String(v) : s; } catch (e) { return String(v); }
  }
  function cap(k: LogLine['k']) {
    return function () {
      if (logs.length < maxLines) logs.push({ k: k, t: Array.prototype.map.call(arguments, fmt).join(' ') });
    };
  }
  var con = { log: cap('log'), info: cap('log'), debug: cap('log'), warn: cap('warn'), error: cap('error') };
  function preview(v: unknown): string {
    var t: string;
    if (v === undefined) return 'undefined';
    if (typeof v === 'number' && isNaN(v)) return 'NaN';
    if (typeof v === 'function') return 'a function';
    try { t = JSON.stringify(v); } catch (e) { t = String(v); }
    if (t === undefined) t = String(v);
    return t.length > 140 ? t.slice(0, 140) + '…' : t;
  }
  function eq(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a === 'number' && typeof b === 'number') return isNaN(a) && isNaN(b);
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    var aa = Array.isArray(a), ab = Array.isArray(b);
    if (aa !== ab) return false;
    if (aa) {
      var la = a as unknown[], lb = b as unknown[];
      if (la.length !== lb.length) return false;
      for (var i = 0; i < la.length; i++) if (!eq(la[i], lb[i])) return false;
      return true;
    }
    var ka = Object.keys(a as object), kb = Object.keys(b as object);
    if (ka.length !== kb.length) return false;
    for (var j = 0; j < ka.length; j++) {
      var key = ka[j]!;
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!eq((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
    }
    return true;
  }
  function msg(e: unknown): string {
    if (e && typeof e === 'object' && 'message' in e) {
      var r = e as { name?: string; message?: string };
      return (r.name ? r.name + ': ' : '') + String(r.message);
    }
    return String(e);
  }
  var body = code + '\n;return function (__c) { return eval(__c); };';
  var factory: (console: unknown) => (call: string) => unknown;
  try {
    // eslint-disable-next-line no-new-func
    factory = new Function('console', body) as typeof factory;
  } catch (e) {
    return { results: tests.map(function (t) { return { name: t.name, passed: false, expected: preview(t.expect), actual: '', error: 'Your code does not parse: ' + msg(e) }; }), logs: logs, syntaxError: msg(e) };
  }
  var evalIn: (call: string) => unknown;
  try {
    evalIn = factory(con);
  } catch (e) {
    return { results: tests.map(function (t) { return { name: t.name, passed: false, expected: preview(t.expect), actual: '', error: 'Your code threw before the checks ran: ' + msg(e) }; }), logs: logs, runtimeError: msg(e) };
  }
  var results: TestOutcome[] = [];
  for (var n = 0; n < tests.length; n++) {
    var t = tests[n]!;
    try {
      var actual = evalIn(String(t.call || 'undefined'));
      var ok = eq(actual, t.expect === undefined ? null : t.expect) || (t.expect === undefined && actual === undefined);
      results.push({ name: t.name, passed: ok, expected: preview(t.expect), actual: preview(actual) });
    } catch (e) {
      results.push({ name: t.name, passed: false, expected: preview(t.expect), actual: '', error: msg(e) });
    }
  }
  return { results: results, logs: logs };
}

const WORKER_SRC = `var __run = ${__run.toString()};
self.onmessage = function (e) {
  var d = e.data, t0 = Date.now(), out;
  try { out = __run(d.code, d.tests, ${MAX_LOG_LINES}); } catch (err) { out = { results: [], logs: [], runtimeError: String(err) }; }
  out.ms = Date.now() - t0;
  self.postMessage(out);
};`;

let workerUrl: string | null = null;
function url(): string {
  if (!workerUrl) workerUrl = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
  return workerUrl;
}

/** Run the learner's code against the tests in a fresh worker; never rejects. */
export function runJs(code: string, tests: RunTest[], timeoutMs = TIMEOUT_MS): Promise<RunResult> {
  const t0 = performance.now();
  const plainTests = tests.map(t => ({ name: t.name, call: t.call, expect: t.expect }));
  return new Promise(resolve => {
    let w: Worker;
    const fail = (why: string, timedOut: boolean): RunResult => ({
      results: plainTests.map(t => ({ name: t.name, passed: false, expected: preview(t.expect), actual: '', error: why })),
      logs: [{ k: 'error', t: why }], passed: [], timedOut, ms: Math.round(performance.now() - t0),
    });
    try { w = new Worker(url()); } catch (e) { resolve(fail(`Could not start the runner: ${String(e)}`, false)); return; }
    const timer = setTimeout(() => {
      w.terminate();
      resolve(fail(`Stopped after ${(timeoutMs / 1000).toFixed(1)} seconds. An endless loop?`, true));
    }, timeoutMs);
    w.onmessage = (e: MessageEvent) => {
      clearTimeout(timer);
      w.terminate();
      const d = e.data as Omit<RunResult, 'passed' | 'timedOut'>;
      resolve({ ...d, passed: d.results.filter(r => r.passed).map(r => r.name), timedOut: false, ms: Math.round(performance.now() - t0) });
    };
    w.onerror = (e: ErrorEvent) => {
      e.preventDefault();
      clearTimeout(timer);
      w.terminate();
      resolve(fail(e.message || 'The runner crashed.', false));
    };
    w.postMessage({ code, tests: plainTests });
  });
}

function preview(v: unknown): string {
  if (v === undefined) return 'undefined';
  try { const t = JSON.stringify(v); return t === undefined ? String(v) : t; } catch { return String(v); }
}
