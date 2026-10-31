/**
 * The WebAssembly execution worker (Stage 1, SANDBOX ENGINE).
 *
 * This is a MODULE worker — spawned by the main thread with
 *   new Worker(new URL('./runner.worker.ts', import.meta.url), { type: 'module' })
 *
 * SECURITY MODEL: every language runs 100% inside WebAssembly in THIS worker.
 * The worker has no DOM, and we hand the guest code no network, no filesystem
 * and no host bindings beyond a captured `console`/stdout. The server never
 * executes any of it. The only thing left to defend is the user's own tab, so
 * the limits here are deliberately harsh:
 *   - 64MB memory ceiling and a ~4s CPU interrupt deadline for JavaScript;
 *   - stdout/stderr capped at 100KB (truncated with a notice);
 *   - the main thread additionally enforces a wall-clock timeout by terminating
 *     the whole worker, which is the only way to kill a runtime wedged in WASM.
 *
 * Runtimes are lazy: a language's WASM is only fetched the first time it is used
 * (or explicitly warmed up). Load failures — e.g. the CDN being blocked — are
 * reported as a clear message in `stderr`, never thrown across the boundary.
 */

import {
  newQuickJSWASMModule,
  shouldInterruptAfterDeadline,
  type QuickJSContext,
  type QuickJSWASMModule,
  type QuickJSHandle,
} from 'quickjs-emscripten'
import initSqlJs, { type SqlJsStatic } from 'sql.js'

import {
  canonicalTest,
  MAX_CODE_BYTES,
  MAX_OUTPUT_BYTES,
  OUTPUT_TRUNCATED_NOTICE,
  PYODIDE_ESM_URL,
  PYODIDE_INDEX_URL,
  SQLJS_CDN_BASE,
  type ResultTable,
  type SandboxLang,
  type SandboxTest,
  type SandboxTestResult,
  type WorkerRequest,
  type WorkerResponse,
} from './protocol'

/* -------------------------------------------------------------------------- */
/* Tunable limits                                                             */
/* -------------------------------------------------------------------------- */

const JS_MEMORY_LIMIT_BYTES = 64 * 1024 * 1024
const JS_CPU_DEADLINE_MS = 4000
const JS_MAX_STACK_BYTES = 1024 * 1024

/* -------------------------------------------------------------------------- */
/* Output capture — a shared, capped sink                                     */
/* -------------------------------------------------------------------------- */

class OutputSink {
  stdout = ''
  stderr = ''
  private stdoutFull = false
  private stderrFull = false

  writeOut(chunk: string): void {
    if (this.stdoutFull) return
    if (this.stdout.length + chunk.length > MAX_OUTPUT_BYTES) {
      this.stdout = this.stdout.slice(0, MAX_OUTPUT_BYTES) + OUTPUT_TRUNCATED_NOTICE
      this.stdoutFull = true
      return
    }
    this.stdout += chunk
  }

  writeErr(chunk: string): void {
    if (this.stderrFull) return
    if (this.stderr.length + chunk.length > MAX_OUTPUT_BYTES) {
      this.stderr = this.stderr.slice(0, MAX_OUTPUT_BYTES) + OUTPUT_TRUNCATED_NOTICE
      this.stderrFull = true
      return
    }
    this.stderr += chunk
  }
}

/* -------------------------------------------------------------------------- */
/* Value helpers                                                              */
/* -------------------------------------------------------------------------- */

function errorMessage(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`
  if (err && typeof err === 'object' && 'message' in err) {
    const record = err as { name?: unknown; message?: unknown }
    const name = typeof record.name === 'string' ? `${record.name}: ` : ''
    return `${name}${String(record.message)}`
  }
  return String(err)
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a === 'number' && typeof b === 'number') {
    return (Number.isNaN(a) && Number.isNaN(b)) || a === b
  }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  const arrA = Array.isArray(a)
  const arrB = Array.isArray(b)
  if (arrA !== arrB) return false
  if (arrA && arrB) {
    const la = a as unknown[]
    const lb = b as unknown[]
    if (la.length !== lb.length) return false
    return la.every((item, index) => deepEqual(item, lb[index]))
  }
  const ka = Object.keys(a as Record<string, unknown>)
  const kb = Object.keys(b as Record<string, unknown>)
  if (ka.length !== kb.length) return false
  return ka.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  )
}

/** A short, safe rendering of a value for test-failure detail lines. */
function preview(value: unknown): string {
  let text: string
  try {
    text = typeof value === 'string' ? JSON.stringify(value) : JSON.stringify(value) ?? String(value)
  } catch {
    text = String(value)
  }
  if (text === undefined) text = String(value)
  return text.length > 120 ? `${text.slice(0, 120)}…` : text
}

/* -------------------------------------------------------------------------- */
/* JavaScript runtime — quickjs-emscripten                                    */
/* -------------------------------------------------------------------------- */

let quickJsModule: QuickJSWASMModule | null = null

async function loadQuickJs(): Promise<QuickJSWASMModule> {
  if (!quickJsModule) quickJsModule = await newQuickJSWASMModule()
  return quickJsModule
}

/** Read a QuickJS handle back into a plain JS value, tolerating cycles/errors. */
function dumpHandle(context: QuickJSContext, handle: QuickJSHandle): unknown {
  try {
    return context.dump(handle)
  } catch {
    return undefined
  }
}

async function runJavaScript(
  code: string,
  tests: SandboxTest[],
  sink: OutputSink,
): Promise<{ ok: boolean; error?: string; tests?: SandboxTestResult[] }> {
  const QuickJS = await loadQuickJs()
  const context = QuickJS.newContext()
  const runtime = context.runtime

  runtime.setMemoryLimit(JS_MEMORY_LIMIT_BYTES)
  runtime.setMaxStackSize(JS_MAX_STACK_BYTES)
  runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + JS_CPU_DEADLINE_MS))

  try {
    // Install a minimal console that funnels into the captured stdout/stderr.
    const consoleHandle = context.newObject()
    const bind = (write: (line: string) => void) =>
      context.newFunction('', (...args: QuickJSHandle[]) => {
        const line = args.map((handle) => stringifyGuest(context, handle)).join(' ')
        write(line + '\n')
      })

    for (const [name, write] of [
      ['log', (l: string) => sink.writeOut(l)],
      ['info', (l: string) => sink.writeOut(l)],
      ['debug', (l: string) => sink.writeOut(l)],
      ['warn', (l: string) => sink.writeErr(l)],
      ['error', (l: string) => sink.writeErr(l)],
    ] as const) {
      const fn = bind(write)
      context.setProp(consoleHandle, name, fn)
      fn.dispose()
    }
    context.setProp(context.global, 'console', consoleHandle)
    consoleHandle.dispose()

    const evalResult = context.evalCode(code)
    if (evalResult.error) {
      const message = errorMessage(dumpHandle(context, evalResult.error))
      evalResult.error.dispose()
      sink.writeErr(message + '\n')
      return { ok: false, error: message }
    }
    evalResult.value.dispose()

    // Grade expression tests inside the same VM (they can see the user's code).
    const results: SandboxTestResult[] = []
    for (const raw of tests) {
      const test = canonicalTest(raw)
      if (test.expression === undefined) {
        results.push(gradeStdoutTest(test.name, test.expected, sink.stdout))
        continue
      }
      const testResult = context.evalCode(test.expression)
      if (testResult.error) {
        const message = errorMessage(dumpHandle(context, testResult.error))
        testResult.error.dispose()
        results.push({ name: test.name, passed: false, detail: message })
        continue
      }
      const actual = dumpHandle(context, testResult.value)
      testResult.value.dispose()
      const passed = deepEqual(actual, test.expected)
      results.push({
        name: test.name,
        passed,
        detail: passed
          ? undefined
          : `expected ${preview(test.expected)} · received ${preview(actual)}`,
      })
    }

    return { ok: true, tests: tests.length ? results : undefined }
  } finally {
    context.dispose()
    runtime.dispose()
  }
}

/** Render a guest handle to a readable string for console output. */
function stringifyGuest(context: QuickJSContext, handle: QuickJSHandle): string {
  const value = dumpHandle(context, handle)
  if (typeof value === 'string') return value
  if (value === undefined) return 'undefined'
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

/* -------------------------------------------------------------------------- */
/* Python runtime — Pyodide from the pinned CDN                               */
/* -------------------------------------------------------------------------- */

interface PyodideInterface {
  runPythonAsync(code: string): Promise<unknown>
  setStdout(options: { batched?: (text: string) => void }): void
  setStderr(options: { batched?: (text: string) => void }): void
  setStdin(options: { stdin?: () => string; error?: boolean }): void
}

let pyodidePromise: Promise<PyodideInterface> | null = null

async function loadPyodide(): Promise<PyodideInterface> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      // Non-literal specifier → TS treats this as a dynamic import of unknown
      // shape; `@vite-ignore` stops the bundler from trying to inline the CDN.
      const url = PYODIDE_ESM_URL
      const mod = (await import(/* @vite-ignore */ url)) as {
        loadPyodide: (options: { indexURL: string }) => Promise<PyodideInterface>
      }
      return mod.loadPyodide({ indexURL: PYODIDE_INDEX_URL })
    })().catch((err) => {
      // Reset so a later run can retry (e.g. transient CDN failure).
      pyodidePromise = null
      throw err
    })
  }
  return pyodidePromise
}

async function runPython(
  code: string,
  stdin: string | undefined,
  tests: SandboxTest[],
  sink: OutputSink,
): Promise<{ ok: boolean; error?: string; tests?: SandboxTestResult[] }> {
  const pyodide = await loadPyodide()

  pyodide.setStdout({ batched: (text) => sink.writeOut(text + '\n') })
  pyodide.setStderr({ batched: (text) => sink.writeErr(text + '\n') })

  if (stdin !== undefined) {
    const lines = stdin.split('\n')
    let cursor = 0
    pyodide.setStdin({ stdin: () => (cursor < lines.length ? lines[cursor++]! : '') })
  }

  try {
    await pyodide.runPythonAsync(code)
  } catch (err) {
    const message = errorMessage(err)
    sink.writeErr(message + '\n')
    return { ok: false, error: message }
  }

  if (!tests.length) return { ok: true }

  const results: SandboxTestResult[] = []
  for (const raw of tests) {
    const test = canonicalTest(raw)
    if (test.expression === undefined) {
      results.push(gradeStdoutTest(test.name, test.expected, sink.stdout))
      continue
    }
    try {
      const value = await pyodide.runPythonAsync(test.expression)
      const actual = toJs(value)
      const passed = deepEqual(actual, test.expected)
      results.push({
        name: test.name,
        passed,
        detail: passed
          ? undefined
          : `expected ${preview(test.expected)} · received ${preview(actual)}`,
      })
    } catch (err) {
      results.push({ name: test.name, passed: false, detail: errorMessage(err) })
    }
  }
  return { ok: true, tests: results }
}

/**
 * Convert a Pyodide proxy/primitive into a plain JS value where possible.
 *
 * `dict_converter` is load-bearing, not a nicety: bare `toJs()` turns a Python
 * dict into a JS `Map`, and `deepEqual` compares a Map against the plain object
 * in the payload's `expect` as unequal — so a CORRECT answer that returns a dict
 * would fail with a diff the learner cannot act on. `Object.fromEntries` gives
 * back the shape the expectation was written as.
 */
function toJs(value: unknown): unknown {
  if (value && typeof value === 'object' && 'toJs' in value) {
    try {
      return (value as { toJs: (options?: { dict_converter?: unknown }) => unknown }).toJs({
        dict_converter: Object.fromEntries,
      })
    } catch {
      return value
    }
  }
  return value
}

/* -------------------------------------------------------------------------- */
/* SQL runtime — sql.js with the wasm fetched from the pinned CDN             */
/* -------------------------------------------------------------------------- */

let sqlPromise: Promise<SqlJsStatic> | null = null

async function loadSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({ locateFile: (file) => `${SQLJS_CDN_BASE}${file}` }).catch((err) => {
      sqlPromise = null
      throw err
    })
  }
  return sqlPromise
}

function runSql(
  SQL: SqlJsStatic,
  code: string,
  setup: string | undefined,
  tests: SandboxTest[],
  sink: OutputSink,
): { ok: boolean; error?: string; result?: ResultTable; tests?: SandboxTestResult[] } {
  const db = new SQL.Database()
  try {
    // The fixture runs first, on the same database, and its output is thrown
    // away: the learner is graded on their query, never on the CREATE/INSERT
    // that put the rows there. A broken fixture is OUR bug, so it is reported
    // as one rather than blamed on the query.
    if (setup && setup.trim() !== '') {
      try {
        db.exec(setup)
      } catch (err) {
        const message = `The exercise's setup SQL failed: ${errorMessage(err)}`
        sink.writeErr(message + '\n')
        return { ok: false, error: message }
      }
    }

    const execResults = db.exec(code)

    if (execResults.length === 0) {
      sink.writeOut('(no rows)\n')
      return {
        ok: true,
        tests: tests.length ? gradeTableTests(tests, undefined) : undefined,
      }
    }

    // Return the final statement's result set as the table; echo any earlier
    // ones to stdout so multi-statement scripts are not silently dropped.
    const last = execResults[execResults.length - 1]!
    for (const set of execResults.slice(0, -1)) {
      sink.writeOut(`${set.columns.join(' | ')}\n`)
      for (const row of set.values) sink.writeOut(`${row.join(' | ')}\n`)
    }

    const result: ResultTable = { columns: last.columns, rows: last.values }

    return {
      ok: true,
      result,
      tests: tests.length ? gradeTableTests(tests, result) : undefined,
    }
  } catch (err) {
    const message = errorMessage(err)
    sink.writeErr(message + '\n')
    return { ok: false, error: message }
  } finally {
    db.close()
  }
}

/**
 * Grade a SQL run against the table each test expects.
 *
 * Row order is ignored unless the test asks for it, because a correct answer to
 * "which customers spent over 100" is the same set whatever order it came back
 * in — only an exercise that is actually about `ORDER BY` should care. Columns
 * are only checked when the test names them: an exercise usually cares that the
 * right rows came back, not what the learner aliased the column to.
 */
function gradeTableTests(
  tests: SandboxTest[],
  actual: ResultTable | undefined,
): SandboxTestResult[] {
  return tests.map((raw) => {
    const want = raw.expectTable

    if (!want) {
      // Not a table test — fall back to comparing the run's stdout, which is
      // what a non-SELECT script exercise is graded on.
      const test = canonicalTest(raw)
      return gradeStdoutTest(test.name, test.expected, '')
    }

    if (!actual) {
      return {
        name: raw.name,
        passed: false,
        detail: `expected ${want.rows.length} row(s) · the query returned no result set`,
      }
    }

    if (want.columns && !deepEqual(normaliseRow(want.columns), normaliseRow(actual.columns))) {
      return {
        name: raw.name,
        passed: false,
        detail: `expected columns ${preview(want.columns)} · received ${preview(actual.columns)}`,
      }
    }

    const expectedRows = want.rows.map(normaliseRow)
    const actualRows = actual.rows.map(normaliseRow)

    const passed = want.ordered
      ? deepEqual(expectedRows, actualRows)
      : deepEqual(sortRows(expectedRows), sortRows(actualRows))

    return {
      name: raw.name,
      passed,
      detail: passed
        ? undefined
        : `expected ${expectedRows.length} row(s) ${preview(expectedRows)} · received ` +
          `${actualRows.length} row(s) ${preview(actualRows)}`,
    }
  })
}

/**
 * SQLite hands back `1` where the fixture author wrote `1.0`, and `"7"` where a
 * COUNT produced `7`. Comparing those as-is fails a correct query on a type the
 * learner never chose, so every cell is flattened to a comparable string first.
 */
function normaliseRow(row: unknown[]): string[] {
  return row.map((cell) => {
    if (cell === null || cell === undefined) return '\u0000null'
    if (typeof cell === 'number') return String(cell)
    if (typeof cell === 'boolean') return cell ? '1' : '0'
    if (cell instanceof Uint8Array) return `blob:${cell.length}`
    return String(cell).trim()
  })
}

/** A stable order for set comparison; never shown to the learner. */
function sortRows(rows: string[][]): string[][] {
  return [...rows].sort((a, b) => (a.join('\u0001') < b.join('\u0001') ? -1 : 1))
}

/* -------------------------------------------------------------------------- */
/* Stdout-based grading (shared by all runtimes)                              */
/* -------------------------------------------------------------------------- */

function gradeStdoutTest(name: string, expected: unknown, stdout: string): SandboxTestResult {
  const want = String(expected ?? '').trim()
  const got = stdout.trim()
  const passed = got === want
  return {
    name,
    passed,
    detail: passed ? undefined : `expected stdout ${preview(want)} · received ${preview(got)}`,
  }
}

/* -------------------------------------------------------------------------- */
/* Dispatch                                                                   */
/* -------------------------------------------------------------------------- */

async function warmup(lang: SandboxLang): Promise<void> {
  if (lang === 'javascript') await loadQuickJs()
  else if (lang === 'python') await loadPyodide()
  else if (lang === 'sql') await loadSql()
}

async function handle(request: WorkerRequest): Promise<WorkerResponse> {
  const started = performance.now()
  const sink = new OutputSink()

  const done = (partial: Omit<WorkerResponse, 'id' | 'durationMs' | 'stdout' | 'stderr'>): WorkerResponse => ({
    id: request.id,
    stdout: sink.stdout,
    stderr: sink.stderr,
    durationMs: Math.round(performance.now() - started),
    ...partial,
  })

  if (request.warmup) {
    try {
      await warmup(request.lang)
      return done({ ok: true })
    } catch (err) {
      const message = loadFailureMessage(request.lang, err)
      sink.writeErr(message + '\n')
      return done({ ok: false, error: message })
    }
  }

  if (request.code.length > MAX_CODE_BYTES) {
    const message = `Code exceeds the ${Math.round(MAX_CODE_BYTES / 1000)}KB limit.`
    sink.writeErr(message + '\n')
    return done({ ok: false, error: message })
  }

  try {
    switch (request.lang) {
      case 'javascript': {
        const out = await runJavaScript(request.code, request.tests ?? [], sink)
        return done({ ok: out.ok, error: out.error, tests: out.tests })
      }
      case 'python': {
        const out = await runPython(request.code, request.stdin, request.tests ?? [], sink)
        return done({ ok: out.ok, error: out.error, tests: out.tests })
      }
      case 'sql': {
        const SQL = await loadSql()
        const out = runSql(SQL, request.code, request.setup, request.tests ?? [], sink)
        return done({ ok: out.ok, error: out.error, result: out.result, tests: out.tests })
      }
      default: {
        const message = `Unsupported language: ${String(request.lang)}`
        sink.writeErr(message + '\n')
        return done({ ok: false, error: message })
      }
    }
  } catch (err) {
    const message = loadFailureMessage(request.lang, err)
    sink.writeErr(message + '\n')
    return done({ ok: false, error: message })
  }
}

/** Turn an unexpected throw (usually a blocked CDN) into a plain-English line. */
function loadFailureMessage(lang: SandboxLang, err: unknown): string {
  const base = errorMessage(err)
  const runtime =
    lang === 'python' ? 'Pyodide' : lang === 'sql' ? 'sql.js' : 'the JavaScript engine'
  if (/fetch|network|import|load|Failed|CORS|blocked/i.test(base)) {
    return `Could not load ${runtime} — the runtime is downloaded from a CDN and the request was blocked or failed. (${base})`
  }
  return base
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  void handle(request).then((response) => {
    ;(self as unknown as Worker).postMessage(response)
  })
}
