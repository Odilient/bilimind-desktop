import type { CodeTest, CodeTestResult } from '~/types/api'

/**
 * Runs learner JavaScript in a sandboxed Web Worker (SPEC §7 / §9).
 *
 * The rules this composable exists to enforce:
 *  - the code never touches the main thread — no `eval`, no `new Function` here;
 *  - the worker is built from a Blob URL, so it has no access to the page's DOM,
 *    cookies or storage, and is same-origin only for the duration of the run;
 *  - a hard 3s timeout terminates the worker, because an infinite loop inside a
 *    worker cannot be interrupted any other way;
 *  - the worker is terminated and the Blob URL revoked on every exit path.
 *
 *   const runner = useCodeRunner()
 *   const result = await runner.run(code, block.payload.tests ?? [])
 *
 * The result is what the `code` assessment posts to the backend, which records
 * `grader_meta.source = 'client_worker'` — the API is honest that these numbers
 * came from the learner's browser.
 */

export interface CodeRunResult {
  /** Every declared test passed (and there was at least one). */
  passed: boolean
  results: CodeTestResult[]
  logs: string[]
  /** Compile/runtime failure that stopped the whole run, or null. */
  error: string | null
  timedOut: boolean
  durationMs: number
}

interface WorkerReply {
  results?: Array<{
    name?: unknown
    passed?: unknown
    expected?: unknown
    received?: unknown
    error?: unknown
  }>
  logs?: unknown[]
  error?: unknown
}

/** Hard ceiling from the SPEC. */
const DEFAULT_TIMEOUT_MS = 3000

const MAX_LOGS = 200
const MAX_LOG_CHARS = 2000

/**
 * The worker program. Written in ES5-flavoured JavaScript with no template
 * literals so it can live inside one, and no imports so the Blob is standalone.
 */
const WORKER_SOURCE = `
'use strict';
(function () {
  var MAX_LOGS = ${MAX_LOGS};
  var MAX_LOG_CHARS = ${MAX_LOG_CHARS};

  function display(value, depth) {
    depth = depth || 0;
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    var type = typeof value;
    if (type === 'string') return depth === 0 ? value : JSON.stringify(value);
    if (type === 'number' || type === 'boolean' || type === 'bigint') return String(value);
    if (type === 'function') return '[Function ' + (value.name || 'anonymous') + ']';
    if (type === 'symbol') return value.toString();
    if (value instanceof Error) return value.name + ': ' + value.message;
    if (depth > 3) return '…';
    try {
      if (Array.isArray(value)) {
        var items = [];
        for (var i = 0; i < value.length && i < 50; i++) items.push(display(value[i], depth + 1));
        if (value.length > 50) items.push('… ' + (value.length - 50) + ' more');
        return '[' + items.join(', ') + ']';
      }
      if (value instanceof Map) return 'Map(' + value.size + ')';
      if (value instanceof Set) return 'Set(' + value.size + ')';
      var keys = Object.keys(value);
      var parts = [];
      for (var k = 0; k < keys.length && k < 30; k++) {
        parts.push(keys[k] + ': ' + display(value[keys[k]], depth + 1));
      }
      if (keys.length > 30) parts.push('…');
      return '{ ' + parts.join(', ') + ' }';
    } catch (err) {
      return String(value);
    }
  }

  // depth 0 prints a top-level string bare (console output); depth 1 quotes it
  // (a test value, where "5" and 5 must not look identical).
  function inspect(value, depth) {
    var text = display(value, depth === undefined ? 1 : depth);
    return text.length > MAX_LOG_CHARS ? text.slice(0, MAX_LOG_CHARS) + '…' : text;
  }

  function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a === 'number' && typeof b === 'number') {
      return (a !== a && b !== b) || a === b;
    }
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i])) return false;
      }
      return true;
    }
    var ak = Object.keys(a);
    var bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    for (var j = 0; j < ak.length; j++) {
      if (!Object.prototype.hasOwnProperty.call(b, ak[j])) return false;
      if (!deepEqual(a[ak[j]], b[ak[j]])) return false;
    }
    return true;
  }

  function errorMessage(err) {
    if (err && typeof err === 'object' && 'message' in err) {
      return String((err.name ? err.name + ': ' : '') + err.message);
    }
    return String(err);
  }

  self.onmessage = function (event) {
    var payload = event.data || {};
    var code = String(payload.code == null ? '' : payload.code);
    var tests = Array.isArray(payload.tests) ? payload.tests : [];
    var logs = [];

    function record(level, args) {
      if (logs.length >= MAX_LOGS) return;
      var parts = [];
      for (var i = 0; i < args.length; i++) parts.push(inspect(args[i], 0));
      var line = parts.join(' ');
      logs.push(level === 'log' ? line : '[' + level + '] ' + line);
      if (logs.length === MAX_LOGS) logs.push('… output truncated');
    }

    var sandboxConsole = {
      log: function () { record('log', arguments); },
      info: function () { record('info', arguments); },
      debug: function () { record('debug', arguments); },
      warn: function () { record('warn', arguments); },
      error: function () { record('error', arguments); },
      table: function () { record('log', arguments); },
      trace: function () { record('log', arguments); },
      dir: function () { record('log', arguments); },
      group: function () {},
      groupEnd: function () {},
      time: function () {},
      timeEnd: function () {},
      assert: function () {}
    };

    var body =
      '"use strict";\\n' +
      code +
      '\\n;return __tests.map(function (__test) {\\n' +
      '  try {\\n' +
      '    var __expression = __test.call;\\n' +
      '    var __actual = eval(__expression);\\n' +
      '    return { name: __test.name, passed: __equal(__actual, __test.expect), actual: __actual };\\n' +
      '  } catch (__err) {\\n' +
      '    return { name: __test.name, passed: false, failed: __err };\\n' +
      '  }\\n' +
      '});';

    var runner;

    try {
      runner = new Function('console', '__tests', '__equal', body);
    } catch (err) {
      self.postMessage({ results: [], logs: logs, error: errorMessage(err) });
      return;
    }

    var raw;

    try {
      raw = runner(sandboxConsole, tests, deepEqual);
    } catch (err) {
      self.postMessage({ results: [], logs: logs, error: errorMessage(err) });
      return;
    }

    if (!Array.isArray(raw)) {
      self.postMessage({
        results: [],
        logs: logs,
        error: tests.length
          ? 'Your code returned before the tests could run — remove any top-level return.'
          : null
      });
      return;
    }

    var results = [];

    for (var i = 0; i < raw.length; i++) {
      var row = raw[i];
      var test = tests[i] || {};
      results.push({
        name: String(row.name == null ? 'Test ' + (i + 1) : row.name),
        passed: !!row.passed,
        expected: inspect(test.expect),
        received: row.failed ? null : inspect(row.actual),
        error: row.failed ? errorMessage(row.failed) : null
      });
    }

    self.postMessage({ results: results, logs: logs, error: null });
  };
})();
`

function normaliseResults(reply: WorkerReply): CodeTestResult[] {
  const rows = Array.isArray(reply.results) ? reply.results : []

  return rows.map((row, index) => ({
    name: typeof row.name === 'string' && row.name !== '' ? row.name : `Test ${index + 1}`,
    passed: row.passed === true,
    expected: typeof row.expected === 'string' ? row.expected : undefined,
    received: typeof row.received === 'string' ? row.received : undefined,
    error: typeof row.error === 'string' && row.error !== '' ? row.error : null,
  }))
}

function normaliseLogs(reply: WorkerReply): string[] {
  const logs = Array.isArray(reply.logs) ? reply.logs : []

  return logs.slice(0, MAX_LOGS + 1).map((line) => String(line).slice(0, MAX_LOG_CHARS))
}

export interface UseCodeRunnerOptions {
  /** Hard kill after this many milliseconds. Defaults to the SPEC's 3s. */
  timeoutMs?: number
}

export function useCodeRunner(options: UseCodeRunnerOptions = {}) {
  const timeoutMs = Math.max(250, options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  const running = ref(false)
  const result = ref<CodeRunResult | null>(null)

  /** Torn down by `cancel()`, by the timeout, and by scope disposal. */
  let teardown: (() => void) | null = null

  const supported = computed(
    () => import.meta.client && typeof Worker !== 'undefined' && typeof Blob !== 'undefined',
  )

  function cancel(): void {
    teardown?.()
    running.value = false
  }

  function run(code: string, tests: CodeTest[] = []): Promise<CodeRunResult> {
    cancel()

    if (!import.meta.client || typeof Worker === 'undefined' || typeof Blob === 'undefined') {
      const unsupported: CodeRunResult = {
        passed: false,
        results: [],
        logs: [],
        error: 'This browser cannot run code exercises (Web Workers are unavailable).',
        timedOut: false,
        durationMs: 0,
      }
      result.value = unsupported

      return Promise.resolve(unsupported)
    }

    running.value = true
    const startedAt = Date.now()

    return new Promise<CodeRunResult>((resolve) => {
      const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }))
      const worker = new Worker(url)

      let settled = false
      let timer: ReturnType<typeof setTimeout> | undefined

      const cleanup = (): void => {
        if (timer !== undefined) clearTimeout(timer)
        worker.onmessage = null
        worker.onerror = null
        worker.terminate()
        URL.revokeObjectURL(url)
        teardown = null
      }

      const settle = (partial: Omit<CodeRunResult, 'durationMs'>): void => {
        if (settled) return
        settled = true
        cleanup()

        const finished: CodeRunResult = { ...partial, durationMs: Date.now() - startedAt }
        result.value = finished
        running.value = false
        resolve(finished)
      }

      teardown = () =>
        settle({
          passed: false,
          results: [],
          logs: [],
          error: 'Run cancelled.',
          timedOut: false,
        })

      worker.onmessage = (event: MessageEvent<WorkerReply>) => {
        const reply = event.data ?? {}
        const results = normaliseResults(reply)
        const error = typeof reply.error === 'string' && reply.error !== '' ? reply.error : null

        settle({
          passed: error === null && results.length > 0 && results.every((row) => row.passed),
          results,
          logs: normaliseLogs(reply),
          error,
          timedOut: false,
        })
      }

      worker.onerror = (event: ErrorEvent) => {
        event.preventDefault?.()
        settle({
          passed: false,
          results: [],
          logs: [],
          error: event.message || 'The sandbox failed to start.',
          timedOut: false,
        })
      }

      timer = setTimeout(() => {
        settle({
          passed: false,
          results: [],
          logs: [],
          error: `Timed out after ${(timeoutMs / 1000).toFixed(timeoutMs % 1000 === 0 ? 0 : 1)}s — check for an infinite loop.`,
          timedOut: true,
        })
      }, timeoutMs)

      worker.postMessage({
        code: String(code ?? ''),
        tests: tests.map((test) => ({
          name: String(test?.name ?? ''),
          call: String(test?.call ?? ''),
          expect: test?.expect ?? null,
        })),
      })
    })
  }

  if (import.meta.client && getCurrentScope()) {
    onScopeDispose(() => cancel())
  }

  return {
    /** True while a run is in flight. */
    running: readonly(running),
    /** The most recent run, kept so the UI can re-render without re-running. */
    result,
    supported,
    timeoutMs,
    run,
    cancel,
  }
}
