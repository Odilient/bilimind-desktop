/**
 * Wire protocol shared by the main thread (`useWasmSandbox`) and the WebAssembly
 * runner worker (`runner.worker.ts`).
 *
 * Everything the user writes runs 100% client-side in WebAssembly — the server
 * never sees or executes it (SECURITY MODEL). This file only describes the
 * messages that cross the main-thread ↔ worker boundary; it holds no runtime
 * code so it can be imported from both sides without dragging either runtime in.
 */

/** Languages the worker can execute. `html` is handled on the main thread. */
export type SandboxLang = 'python' | 'javascript' | 'sql'

/** Every language the public `run()` accepts (worker langs + main-thread html). */
export type RunLang = SandboxLang | 'html'

/**
 * One graded check. Two shapes are supported, matching the grading helper:
 *  - `expression`: a snippet evaluated inside the same VM after the user's code
 *    runs; its value is deep-compared against `expected`.
 *  - `expected` alone: compared against the run's trimmed stdout.
 *
 * `call` / `expect` are accepted as aliases so the existing {@link CodeTest}
 * shape (name/call/expect) from the code-exercise flow feeds straight through.
 */
export interface SandboxTest {
  name: string
  expression?: string
  expected?: unknown
  /** Alias for `expression` (legacy `CodeTest.call`). */
  call?: string
  /** Alias for `expected` (legacy `CodeTest.expect`). */
  expect?: unknown
  /**
   * SQL only: compare the run's final result set against this table instead of
   * evaluating an expression. `columns` is optional — an exercise usually cares
   * that the right ROWS came back, not what the learner aliased them.
   */
  expectTable?: ExpectedTable
}

/** The table shape a SQL exercise is graded against. */
export interface ExpectedTable {
  columns?: string[]
  rows: unknown[][]
  /**
   * Whether row order is part of the answer. False by default: only an exercise
   * that is actually about `ORDER BY` should fail a correct set in a different
   * order.
   */
  ordered?: boolean
}

/** Result of one graded check — the shape the code-exercise flow consumes. */
export interface SandboxTestResult {
  name: string
  passed: boolean
  detail?: string
}

/** A SQL result set, or any tabular output a runtime chooses to return. */
export interface ResultTable {
  columns: string[]
  rows: unknown[][]
}

/** Message posted from the main thread into the worker. */
export interface WorkerRequest {
  id: number
  lang: SandboxLang
  code: string
  stdin?: string
  tests?: SandboxTest[]
  /**
   * SQL only: schema + seed statements executed before the learner's query, on
   * the same in-memory database. Its output is discarded — the learner is being
   * graded on their query, not on the fixture that set the table up.
   */
  setup?: string
  /** Just spin the runtime up and reply; no user code. */
  warmup?: boolean
}

/** Message posted from the worker back to the main thread. */
export interface WorkerResponse {
  id: number
  ok: boolean
  stdout: string
  stderr: string
  result?: ResultTable
  tests?: SandboxTestResult[]
  durationMs: number
  error?: string
}

/** Hard ceilings. Kept here so both sides agree on the numbers. */
export const MAX_CODE_BYTES = 100_000
export const MAX_OUTPUT_BYTES = 100_000
export const OUTPUT_TRUNCATED_NOTICE = '\n…[output truncated at 100KB]'

/** Pinned CDN locations. Never bump these silently — versions are load-bearing. */
export const PYODIDE_VERSION = '0.27.2'
export const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`
export const PYODIDE_ESM_URL = `${PYODIDE_INDEX_URL}pyodide.mjs`
export const SQLJS_VERSION = '1.14.1'
export const SQLJS_CDN_BASE = `https://cdn.jsdelivr.net/npm/sql.js@${SQLJS_VERSION}/dist/`

/**
 * Normalise a test's aliased fields to the canonical pair. Pure — safe on both
 * threads.
 */
export function canonicalTest(test: SandboxTest): {
  name: string
  expression?: string
  expected: unknown
} {
  const expression = test.expression ?? test.call
  const expected = test.expected !== undefined ? test.expected : test.expect
  return {
    name: test.name,
    expression: expression && expression.trim() !== '' ? expression : undefined,
    expected,
  }
}
