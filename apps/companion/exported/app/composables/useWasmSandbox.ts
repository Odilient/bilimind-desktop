import type {
  ResultTable,
  RunLang,
  SandboxLang,
  SandboxTest,
  SandboxTestResult,
  WorkerRequest,
  WorkerResponse,
} from '~/sandbox/protocol'
import { MAX_CODE_BYTES } from '~/sandbox/protocol'

/**
 * Main-thread API for the WebAssembly sandbox (Stage 1, SANDBOX ENGINE).
 *
 * This owns a single MODULE worker (`app/sandbox/runner.worker.ts`) in which all
 * user code executes 100% client-side in WebAssembly. The composable adds the
 * one guarantee the worker cannot make for itself: a WALL-CLOCK timeout. A
 * runtime wedged inside WASM (an infinite loop, a runaway allocation) cannot be
 * interrupted from JS, so when the worker misses its deadline we `terminate()`
 * the whole thing and resolve with `timedOut: true`. The next run lazily spawns
 * a fresh worker.
 *
 * Runs are serialised — one at a time — so a slow Pyodide warmup can never race
 * a second run inside the same single-threaded worker.
 *
 * This is ADDITIVE and entirely separate from the older `useCodeRunner`, which
 * keeps running the Blob-worker JS path for existing code blocks. Nothing here
 * touches that file.
 *
 * HTML has no worker path: `run({ lang: 'html' })` echoes the code straight back
 * so the UI can drop it into a sandboxed `<iframe srcdoc>` — see {@link run}.
 */

export type {
  ExpectedTable,
  SandboxTest,
  SandboxTestResult,
  ResultTable,
  RunLang,
} from '~/sandbox/protocol'

export interface RunOptions {
  lang: RunLang
  code: string
  stdin?: string
  tests?: SandboxTest[]
  /** SQL only: schema + seed run before the learner's query, output discarded. */
  setup?: string
  /** Wall-clock kill switch. Defaults to 5000ms. */
  timeoutMs?: number
}

export interface RunResult {
  ok: boolean
  stdout: string
  stderr: string
  table?: ResultTable
  tests?: SandboxTestResult[]
  durationMs: number
  timedOut: boolean
  error?: string
}

/** Short wall-clock kill switch for the actual code RUN (guards infinite loops). */
const DEFAULT_TIMEOUT_MS = 5000
/**
 * Generous budget for a runtime's one-time LOAD. Pyodide is ~10MB fetched from a
 * CDN, so the first warmup can legitimately take many seconds on a slow line — a
 * runtime still downloading is not a hung tab, and must never be terminated by
 * the short exec limit. This budget only trips on a genuinely stalled network.
 */
const WARMUP_TIMEOUT_MS = 60_000

/* -------------------------------------------------------------------------- */
/* Per-language warm state (shared across every composable instance)          */
/* -------------------------------------------------------------------------- */

export type WarmPhase = 'cold' | 'warming' | 'ready' | 'failed'

/**
 * Reactive so a template can show a "preparing…" state and re-enable Run the
 * instant a runtime finishes loading. Module-level because the worker it tracks
 * is itself a singleton — two panels share one warmed Pyodide.
 */
const warmState = reactive<Record<string, WarmPhase>>({})
/** De-dupes concurrent warmups of the same language onto one in-flight load. */
const warmPromises = new Map<string, Promise<{ ok: boolean; stderr: string }>>()

/* -------------------------------------------------------------------------- */
/* Singleton worker + serial run queue                                        */
/* -------------------------------------------------------------------------- */

let worker: Worker | null = null
let nextId = 1
/** Resolves the in-flight run's promise; cleared when it settles. */
const pending = new Map<number, (response: WorkerResponse) => void>()
/** The tail of the serial queue — every run chains onto the previous one. */
let queue: Promise<unknown> = Promise.resolve()

function supported(): boolean {
  return import.meta.client && typeof Worker !== 'undefined'
}

function ensureWorker(): Worker {
  if (worker) return worker
  const created = new Worker(new URL('~/sandbox/runner.worker.ts', import.meta.url), {
    type: 'module',
  })
  created.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const resolve = pending.get(event.data.id)
    if (resolve) {
      pending.delete(event.data.id)
      resolve(event.data)
    }
  }
  worker = created
  return created
}

/** Kill the worker (timeout / crash). Any in-flight waiter is left to the caller. */
function killWorker(): void {
  if (worker) {
    worker.onmessage = null
    worker.onerror = null
    worker.terminate()
    worker = null
  }
  pending.clear()
  // A fresh worker starts with no runtimes loaded, so every language is cold again.
  for (const lang of Object.keys(warmState)) warmState[lang] = 'cold'
  warmPromises.clear()
}

/**
 * Post one request and race it against the wall-clock timeout. On timeout the
 * worker is terminated and a `timedOut` response synthesised. `kind` only
 * changes the wording: a slow code RUN is probably an infinite loop, whereas a
 * slow warmup is a stalled download — never the user's fault.
 */
function dispatch(
  request: WorkerRequest,
  timeoutMs: number,
  kind: 'exec' | 'warmup' = 'exec',
): Promise<WorkerResponse> {
  return new Promise<WorkerResponse>((resolve) => {
    let settled = false
    const active = ensureWorker()

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      pending.delete(request.id)
      killWorker()
      const seconds = (timeoutMs / 1000).toFixed(timeoutMs % 1000 === 0 ? 0 : 1)
      const stderr =
        kind === 'warmup'
          ? `The runtime is taking unusually long to download (over ${seconds}s). Check your connection and press Run to try again.`
          : `Timed out after ${seconds}s — terminated to keep the tab responsive (check for an infinite loop).`
      resolve({
        id: request.id,
        ok: false,
        stdout: '',
        stderr,
        durationMs: timeoutMs,
        error: kind === 'warmup' ? 'warmup-timeout' : 'timeout',
      })
    }, timeoutMs)

    pending.set(request.id, (response) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(response)
    })

    try {
      active.postMessage(request)
    } catch (err) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      pending.delete(request.id)
      resolve({
        id: request.id,
        ok: false,
        stdout: '',
        stderr: err instanceof Error ? err.message : String(err),
        durationMs: 0,
        error: 'dispatch-failed',
      })
    }
  })
}

/** Chain `task` onto the serial queue so only one run touches the worker at a time. */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  // Keep the chain alive even if a run rejects; swallow here, surface at `run`.
  queue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

/* -------------------------------------------------------------------------- */
/* Public composable                                                          */
/* -------------------------------------------------------------------------- */

export function useWasmSandbox() {
  const running = ref(false)

  /** Reactive phase for a language. `html` needs no runtime, so it is always ready. */
  function phase(lang: RunLang): WarmPhase {
    if (lang === 'html') return 'ready'
    return warmState[lang] ?? 'cold'
  }

  /** True once `lang`'s runtime is loaded and a run would be instant. Reactive. */
  function ready(lang: RunLang): boolean {
    return phase(lang) === 'ready'
  }

  /** True while `lang`'s runtime is still downloading/initialising. Reactive. */
  function warming(lang: RunLang): boolean {
    return phase(lang) === 'warming'
  }

  /**
   * Ensure `lang`'s runtime is loaded, paying the one-time download under a
   * GENEROUS budget so a slow CDN is never mistaken for a hung run. Idempotent
   * and de-duped: concurrent callers await the same in-flight load. Resolves
   * with the outcome so a caller can surface a load failure to the learner.
   */
  function ensureWarm(lang: RunLang): Promise<{ ok: boolean; stderr: string }> {
    if (lang === 'html' || !supported()) return Promise.resolve({ ok: true, stderr: '' })
    if (warmState[lang] === 'ready') return Promise.resolve({ ok: true, stderr: '' })

    const existing = warmPromises.get(lang)
    if (existing) return existing

    warmState[lang] = 'warming'
    const load = enqueue(async () => {
      const response = await dispatch(
        { id: nextId++, lang: lang as SandboxLang, code: '', warmup: true },
        WARMUP_TIMEOUT_MS,
        'warmup',
      )
      warmState[lang] = response.ok ? 'ready' : 'failed'
      return { ok: response.ok, stderr: response.stderr }
    }).finally(() => {
      warmPromises.delete(lang)
    })

    warmPromises.set(lang, load)
    return load
  }

  async function run(opts: RunOptions): Promise<RunResult> {
    // HTML never touches the worker: hand the code back for an <iframe srcdoc>.
    if (opts.lang === 'html') {
      return {
        ok: true,
        stdout: opts.code,
        stderr: '',
        durationMs: 0,
        timedOut: false,
      }
    }

    if (!supported()) {
      return {
        ok: false,
        stdout: '',
        stderr: 'This browser cannot run the sandbox (Web Workers are unavailable).',
        durationMs: 0,
        timedOut: false,
        error: 'unsupported',
      }
    }

    if (opts.code.length > MAX_CODE_BYTES) {
      return {
        ok: false,
        stdout: '',
        stderr: `Code exceeds the ${Math.round(MAX_CODE_BYTES / 1000)}KB limit.`,
        durationMs: 0,
        timedOut: false,
        error: 'code-too-large',
      }
    }

    running.value = true
    try {
      // 1) Load the runtime first, on its own generous clock. This is the fix for
      //    the Pyodide cold-start bug: the ~10MB download no longer races the 5s
      //    exec limit, so the first Python run stops timing out.
      if (!ready(opts.lang)) {
        const warm = await ensureWarm(opts.lang)
        if (!warm.ok) {
          return {
            ok: false,
            stdout: '',
            stderr: warm.stderr || 'The runtime could not be loaded.',
            durationMs: 0,
            timedOut: false,
            error: 'runtime-load-failed',
          }
        }
      }

      // 2) Now the runtime is warm, apply the SHORT wall-clock to the code run
      //    itself — that is what still guards against an infinite loop.
      const timeoutMs = Math.max(250, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)
      const request: WorkerRequest = {
        id: nextId++,
        lang: opts.lang as SandboxLang,
        code: opts.code,
        stdin: opts.stdin,
        tests: opts.tests,
        setup: opts.setup,
      }

      return await enqueue(async () => toRunResult(await dispatch(request, timeoutMs)))
    } finally {
      running.value = false
    }
  }

  /**
   * Pre-initialise a runtime so the first real run is not paying the load cost.
   * Fire-and-forget friendly; resolves `true` once the runtime is ready.
   */
  async function warmup(lang: RunLang): Promise<boolean> {
    return (await ensureWarm(lang)).ok
  }

  if (import.meta.client && getCurrentScope()) {
    onScopeDispose(() => {
      // Do not kill the shared worker on every unmount — other consumers may be
      // using it. It is torn down only on timeout/crash.
    })
  }

  return {
    /** True while a run (or its runtime load) is in flight. */
    running: readonly(running),
    /** Reactive: is `lang`'s runtime loaded and ready for an instant run? */
    ready,
    /** Reactive: is `lang`'s runtime still downloading/initialising? */
    warming,
    /** Reactive phase for `lang`: cold | warming | ready | failed. */
    phase,
    run,
    warmup,
    /** Grade tests against a completed run's stdout, no VM required. */
    gradeStdoutTests,
    /** Map sandbox test results into the {name, passed} shape the code flow uses. */
    toCodeTestResults,
  }
}

function toRunResult(response: WorkerResponse): RunResult {
  return {
    ok: response.ok,
    stdout: response.stdout,
    stderr: response.stderr,
    table: response.result,
    tests: response.tests,
    durationMs: response.durationMs,
    timedOut: response.error === 'timeout',
    error: response.error,
  }
}

/* -------------------------------------------------------------------------- */
/* Grading helpers (pure, exported for reuse by the code-exercise flow)       */
/* -------------------------------------------------------------------------- */

/**
 * Compare each test's `expected` against a run's stdout. This is the subset of
 * grading that needs no interpreter, so it can run on the main thread; the
 * expression-based checks are graded inside the worker's VM instead.
 */
export function gradeStdoutTests(stdout: string, tests: SandboxTest[]): SandboxTestResult[] {
  const got = stdout.trim()
  return tests.map((test) => {
    const want = String(test.expected ?? test.expect ?? '').trim()
    const passed = got === want
    return {
      name: test.name,
      passed,
      detail: passed ? undefined : `expected stdout "${want}" · received "${got}"`,
    }
  })
}

/**
 * Adapt sandbox test results to the `{ name, passed, error }` shape the existing
 * code-exercise grading path (CodeAssessment.vue / CodeTestResult) consumes, so
 * a WASM run can feed the same submission flow as the legacy JS runner.
 */
export function toCodeTestResults(
  tests: SandboxTestResult[] | undefined,
): Array<{ name: string; passed: boolean; error: string | null }> {
  return (tests ?? []).map((test) => ({
    name: test.name,
    passed: test.passed,
    error: test.passed ? null : (test.detail ?? null),
  }))
}
