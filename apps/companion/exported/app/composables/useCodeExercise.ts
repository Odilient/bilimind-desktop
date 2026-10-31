import type {
  CheckResult,
  CodeAttemptResponse,
  CodeMode,
  CodeTest,
  ExerciseCheck,
  ExerciseRun,
  ExerciseSpec,
} from '~/types/api'
import type { RunLang, RunResult, SandboxTest } from '~/composables/useWasmSandbox'

/**
 * Everything about a code exercise that is worth reasoning about without a
 * browser: turning a payload into a spec, and turning a spec plus a buffer into
 * a run.
 *
 * The five modes are one component because they differ in exactly two places —
 * what the output pane renders, and how the run loop is driven — and both of
 * those live here. Four of the five hand their checks to the WASM worker and
 * read its verdicts back; `build` is the exception, because grading a document
 * by rendering it would put the grade inside the thing being graded, so its
 * markup is PARSED on this thread and never executed.
 *
 * Nothing downstream of `buildSpec()` reads a raw payload field. A lesson
 * generated before modes existed and one generated this morning both have to
 * render, and the single place they are reconciled is here.
 */

const TIMEOUT_MS = 5000

/** Function/debug/query checks a learner can hold in their head at once. */
const MAX_CHECKS = 12
/** Script cases. Each is a separate worker run, so this is also a time budget. */
const MAX_SCRIPT_CASES = 8

const MODES: readonly CodeMode[] = ['function', 'script', 'debug', 'query', 'build']

/* -------------------------------------------------------------------------- */
/* Language identity                                                          */
/* -------------------------------------------------------------------------- */

export interface LangMark {
  label: string
  glyph: string
  /**
   * A language's own brand colour, deliberately outside the product palette: it
   * identifies a runtime, not a state, and tinting it with our accent would make
   * four different languages look like four different kinds of importance.
   */
  color: string
}

/** One source for the monogram, so the sandbox tab and the inline card agree. */
export const LANG_MARKS: Record<RunLang, LangMark> = {
  python: { label: 'Python', glyph: 'Py', color: '#5b9bd1' },
  javascript: { label: 'JavaScript', glyph: 'JS', color: '#e8d44d' },
  sql: { label: 'SQL', glyph: 'SQL', color: '#48b9a8' },
  html: { label: 'HTML', glyph: '</>', color: '#e8703a' },
}

/* -------------------------------------------------------------------------- */
/* Payload → spec                                                             */
/* -------------------------------------------------------------------------- */

/** The loose shape a `code` block hands down, before any of it is trusted. */
export interface ExerciseInput {
  mode?: string | null
  language?: string | null
  tests?: CodeTest[] | null
  setupSql?: string | null
  tables?: Array<{ name: string; columns: string[] }> | null
  requirements?: string[] | null
  symptomMarkdown?: string | null
  hints?: string[] | null
}

/** The exercise's declared language mapped onto a runtime that exists. */
export function toRunLang(language: string | null | undefined): RunLang {
  const lang = String(language ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  if (lang === 'sql') return 'sql'
  if (lang === 'html' || lang === 'css') return 'html'
  if (lang.startsWith('py')) return 'python'
  return 'javascript'
}

/**
 * The mode, for a payload that may not declare one.
 *
 * The LANGUAGE decides first and cannot be overruled, exactly as it does
 * server-side: a payload that says `query` in Python is a Python exercise with a
 * confused label, not a SQL one. Only then does a declared mode get a say, and
 * an unrecognised one is never fatal — it falls to `function`, which is the
 * shape every block generated before modes existed already has.
 *
 * The one inference left is `script`, and it is gated on a check carrying
 * `stdin`. There is no separate `cases` array to look for: the grader reads the
 * names it scores against from `tests` and only from there.
 */
export function inferMode(
  declared: string | null | undefined,
  lang: RunLang,
  tests: CodeTest[],
): CodeMode {
  if (lang === 'html') return 'build'
  if (lang === 'sql') return 'query'

  const named = MODES.find((mode) => mode === declared)
  // `build` and `query` cannot run in a general-purpose runtime, so a payload
  // claiming one here is mislabelled rather than special.
  if (named === 'function' || named === 'script' || named === 'debug') return named

  return tests.some((test) => typeof test.stdin === 'string') ? 'script' : 'function'
}

function textList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return []
  const items: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const text = item.trim()
    if (text !== '') items.push(text)
    if (items.length >= max) break
  }
  return items
}

function trimmed(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text === '' ? null : text
}

function buildChecks(mode: CodeMode, tests: CodeTest[]): ExerciseCheck[] {
  const rows = tests.filter((test): test is CodeTest => Boolean(test) && typeof test === 'object')
  const checks: ExerciseCheck[] = []

  for (const row of rows) {
    const name = trimmed(row.name)
    if (name === null) continue

    if (mode === 'script') {
      checks.push({
        name,
        stdinCase: {
          // '' is a real input (a program reading an empty line); only a missing
          // one means "this program takes no input".
          stdin: typeof row.stdin === 'string' ? row.stdin : undefined,
          expectStdout: typeof row.expect === 'string' ? row.expect : String(row.expect ?? ''),
        },
      })
    } else if (mode === 'query') {
      const table = row.expect_table
      if (!table || !Array.isArray(table.rows)) continue
      checks.push({
        name,
        test: {
          name,
          expectTable: {
            columns: Array.isArray(table.columns) && table.columns.length > 0
              ? table.columns
              : undefined,
            rows: table.rows,
            ordered: table.ordered === true,
          },
        },
      })
    } else if (mode === 'build') {
      const selector = trimmed(row.selector)
      if (selector === null) continue
      checks.push({
        name,
        dom: {
          selector,
          minCount: typeof row.min_count === 'number' && row.min_count > 0 ? row.min_count : 1,
          textContains: trimmed(row.text_contains),
          attribute:
            row.attribute && typeof row.attribute === 'object' && trimmed(row.attribute.name)
              ? { name: row.attribute.name, value: trimmed(row.attribute.value) }
              : null,
        },
      })
    } else {
      // A row with neither a call nor an expectation cannot fail and cannot pass;
      // showing it would promise a check that is not there.
      if (row.call === undefined && row.expect === undefined) continue
      const call = trimmed(row.call) ?? undefined
      checks.push({ name, test: { name, call, expect: row.expect } })
    }

    if (checks.length >= (mode === 'script' ? MAX_SCRIPT_CASES : MAX_CHECKS)) break
  }

  return checks
}

export function buildSpec(input: ExerciseInput): ExerciseSpec {
  const language = (trimmed(input.language) ?? 'javascript').toLowerCase()
  const lang = toRunLang(language)
  const tests = Array.isArray(input.tests) ? input.tests : []
  const mode = inferMode(input.mode, lang, tests)
  const checks = buildChecks(mode, tests)

  const tables = Array.isArray(input.tables)
    ? input.tables
        .filter((table) => Boolean(table) && typeof table.name === 'string')
        .slice(0, 6)
        .map((table) => ({
          name: table.name,
          columns: Array.isArray(table.columns) ? table.columns.slice(0, 12) : [],
        }))
    : []

  return {
    mode,
    lang: lang as ExerciseSpec['lang'],
    language,
    checks,
    setup: mode === 'query' ? trimmed(input.setupSql) : null,
    tables: mode === 'query' ? tables : [],
    requirements: mode === 'build' ? textList(input.requirements, 6) : [],
    symptomMarkdown: mode === 'debug' ? trimmed(input.symptomMarkdown) : null,
    hints: textList(input.hints, 5),
    graded: checks.length > 0,
  }
}

/* -------------------------------------------------------------------------- */
/* What a check promises, in one line                                          */
/* -------------------------------------------------------------------------- */

/**
 * The declared expectation, taken from the PAYLOAD rather than parsed back out
 * of the worker's failure line. The worker's line is prose written for a human;
 * re-reading it as data is the kind of thing that works until a message is
 * reworded.
 */
export function expectedOf(check: ExerciseCheck): string | null {
  if (check.stdinCase) return check.stdinCase.expectStdout
  if (check.dom) {
    const parts = [check.dom.selector]
    if (check.dom.minCount > 1) parts.push(`× ${check.dom.minCount}`)
    if (check.dom.textContains) parts.push(`containing “${check.dom.textContains}”`)
    if (check.dom.attribute) {
      parts.push(
        check.dom.attribute.value === null
          ? `with ${check.dom.attribute.name}`
          : `with ${check.dom.attribute.name}="${check.dom.attribute.value}"`,
      )
    }
    return parts.join(' ')
  }
  if (check.test?.expectTable) {
    const rows = check.test.expectTable.rows.length
    return `${rows} ${rows === 1 ? 'row' : 'rows'}`
  }
  if (check.test && check.test.expect !== undefined) {
    try {
      return JSON.stringify(check.test.expect) ?? String(check.test.expect)
    } catch {
      return String(check.test.expect)
    }
  }
  return null
}

/* -------------------------------------------------------------------------- */
/* build mode — grading a document without running it                          */
/* -------------------------------------------------------------------------- */

/**
 * Grade markup against its declared structural checks.
 *
 * The document is PARSED, never rendered: `DOMParser` builds an inert document
 * with no scripts, no network and no layout, so nothing the learner wrote can
 * touch the page grading it. A selector we cannot vouch for would throw inside
 * `querySelectorAll` and the throw would be reported as the learner's failure,
 * so every one of them is wrapped — the server drops malformed selectors, and
 * this is the second line for a payload that was hand-edited past it.
 */
export function gradeDom(code: string, checks: ExerciseCheck[]): CheckResult[] {
  const doc = new DOMParser().parseFromString(code, 'text/html')

  return checks.map((check) => {
    const base = { name: check.name, expected: cap(expectedOf(check)), received: null }
    const dom = check.dom

    if (!dom) {
      return { ...base, passed: false, detail: null, error: 'this check declares no selector' }
    }

    let found: Element[]
    try {
      found = Array.from(doc.querySelectorAll(dom.selector))
    } catch {
      return {
        ...base,
        passed: false,
        detail: null,
        error: `“${dom.selector}” is not a selector this browser can read`,
      }
    }

    const before = found.length

    if (dom.textContains !== null) {
      const needle = dom.textContains.toLowerCase()
      found = found.filter((el) => (el.textContent ?? '').toLowerCase().includes(needle))
    }

    if (dom.attribute !== null) {
      const { name, value } = dom.attribute
      found = found.filter((el) => {
        if (!el.hasAttribute(name)) return false
        return value === null || (el.getAttribute(name) ?? '').trim() === value.trim()
      })
    }

    const passed = found.length >= dom.minCount

    return {
      ...base,
      passed,
      detail: passed
        ? null
        : before === 0
          ? `nothing in your page matches ${dom.selector}`
          : `${before} matched ${dom.selector}, but ${found.length} of ${dom.minCount} ` +
            'met the rest of the check',
      error: null,
    }
  })
}

/* -------------------------------------------------------------------------- */
/* Body scroll lock — shared, because a lesson can hold two exercises           */
/* -------------------------------------------------------------------------- */

let scrollLocks = 0

export function lockBodyScroll(): void {
  if (!import.meta.client) return
  scrollLocks += 1
  if (scrollLocks === 1) document.body.style.overflow = 'hidden'
}

export function unlockBodyScroll(): void {
  if (!import.meta.client) return
  scrollLocks = Math.max(0, scrollLocks - 1)
  // Only the last overlay standing may release the lock; a second exercise
  // closing its focus view must not un-scroll the page the first one is holding.
  if (scrollLocks === 0) document.body.style.overflow = ''
}

/* -------------------------------------------------------------------------- */
/* Draft persistence                                                           */
/* -------------------------------------------------------------------------- */

/**
 * sessionStorage, never localStorage: a draft should die with the tab. A buffer
 * that outlives the session becomes stale course state — the learner returns
 * days later to code they do not remember writing, sitting on top of a starter
 * that may since have changed.
 *
 * Every access is guarded because Safari in private mode throws on the property
 * itself, not just on the write.
 */
function draftKey(assessmentId: number): string {
  return `bilimind:code:${assessmentId}`
}

export function readDraft(assessmentId: number): string | null {
  try {
    return window.sessionStorage.getItem(draftKey(assessmentId))
  } catch {
    return null
  }
}

export function writeDraft(assessmentId: number, code: string): void {
  try {
    window.sessionStorage.setItem(draftKey(assessmentId), code)
  } catch {
    /* out of quota or a private window — the draft is a convenience, not state */
  }
}

export function clearDraft(assessmentId: number): void {
  try {
    window.sessionStorage.removeItem(draftKey(assessmentId))
  } catch {
    /* see readDraft */
  }
}

/* -------------------------------------------------------------------------- */
/* The run loop                                                                */
/* -------------------------------------------------------------------------- */

function firstLine(text: string | null | undefined): string | null {
  const line = (text ?? '').trim().split('\n')[0]
  return line ? line : null
}

/** 2000 chars: `expected`/`received` are persisted verbatim and declare no ceiling. */
function cap(value: string | null, max = 2000): string | null {
  if (value === null) return null
  return value.length > max ? `${value.slice(0, max)}…` : value
}

/** The server's ceiling on `response.console`: 500 lines of 5000 characters. */
const MAX_CONSOLE_LINES = 400
const MAX_CONSOLE_LINE = 4000

/**
 * The run's output, trimmed to something the attempt endpoint will actually
 * accept. A print inside a loop reaches the worker's 100KB cap long before it
 * reaches 500 lines, and a rejected submission would throw away a run the learner
 * has already done — a validation error is the worst possible place to discover
 * that your program printed too much.
 *
 * The HEAD is kept, and the tail is replaced by a count: an exercise is graded on
 * what a program prints FIRST, and a learner reading their attempt back wants the
 * beginning of the output, not the end of the flood.
 */
function consoleLines(stdout: string): string[] {
  const lines = stdout.split('\n').filter((line) => line !== '')
  const kept = lines
    .slice(0, MAX_CONSOLE_LINES)
    .map((line) => (line.length > MAX_CONSOLE_LINE ? `${line.slice(0, MAX_CONSOLE_LINE)}…` : line))

  if (lines.length > MAX_CONSOLE_LINES) {
    kept.push(`…and ${lines.length - MAX_CONSOLE_LINES} more lines`)
  }

  return kept
}

export interface RunProgress {
  /** 1-based case being executed, for script mode's "case 3 of 5" readout. */
  index: number
  total: number
}

export function useCodeExercise(spec: Ref<ExerciseSpec>, code: Ref<string>) {
  const sandbox = useWasmSandbox()

  const running = ref(false)
  const progress = ref<RunProgress | null>(null)
  const lastRun = ref<ExerciseRun | null>(null)
  /**
   * The dirty-run rule, split in two. Blanking the results the instant an edit
   * starts takes away the failure line the learner is reading in order to fix
   * it; keeping them while forbidding submission is the same guarantee with the
   * information left on screen.
   */
  const stale = ref(false)
  let cancelled = false

  const canCancel = computed(() => running.value && spec.value.mode === 'script')

  function blank(partial: Partial<ExerciseRun> = {}): ExerciseRun {
    return {
      results: [],
      table: null,
      stdout: '',
      stderr: null,
      timedOut: false,
      durationMs: 0,
      aborted: false,
      ...partial,
    }
  }

  /** A check the worker never reported on, with an honest reason. */
  function unreported(check: ExerciseCheck, reason: string): CheckResult {
    return {
      name: check.name,
      passed: false,
      detail: null,
      error: reason,
      expected: cap(expectedOf(check)),
      received: null,
    }
  }

  /** function | debug | query: one run, the worker grades inside the VM. */
  async function runSingle(): Promise<ExerciseRun> {
    const current = spec.value
    const tests = current.checks
      .map((check) => check.test)
      .filter((test): test is NonNullable<ExerciseCheck['test']> => test !== undefined)

    const result = await sandbox.run({
      lang: current.lang,
      code: code.value,
      tests: tests.length > 0 ? (tests as SandboxTest[]) : undefined,
      setup: current.setup ?? undefined,
      timeoutMs: TIMEOUT_MS,
    })

    if (result.error === 'runtime-load-failed') return abortedRun(result)

    const reported = new Map((result.tests ?? []).map((test) => [test.name, test]))
    const failure = result.timedOut
      ? 'not reached — the run timed out'
      : (firstLine(result.stderr) ?? 'the run stopped before this check')

    const results = current.checks.map<CheckResult>((check) => {
      const got = reported.get(check.name)
      if (!got) return unreported(check, failure)
      return {
        name: check.name,
        passed: got.passed,
        detail: cap(got.detail ?? null, 5000),
        error: null,
        expected: cap(expectedOf(check)),
        received: null,
      }
    })

    return blank({
      results,
      table: result.table ?? null,
      stdout: result.stdout,
      stderr: firstLine(result.stderr) === null ? null : result.stderr,
      timedOut: result.timedOut,
      durationMs: result.durationMs,
    })
  }

  /**
   * script: one worker run per case, because a run has exactly one stdout.
   *
   * Two failures are handled differently on purpose. A TIMEOUT stops the loop
   * dead: a timeout terminates the worker, which resets every runtime to cold,
   * so pressing on would re-download Pyodide (~10MB) once per remaining case —
   * one infinite loop would cost the learner 80MB. A crash does not: a program
   * that throws on empty input says nothing about what it does with '3\n4'.
   */
  async function runScript(): Promise<ExerciseRun> {
    const current = spec.value
    const results: CheckResult[] = []
    const transcript: string[] = []
    let durationMs = 0
    let timedOut = false
    let stderr: string | null = null

    for (const [index, check] of current.checks.entries()) {
      if (cancelled) return blank({ aborted: true })

      progress.value = { index: index + 1, total: current.checks.length }

      const expected = check.stdinCase?.expectStdout ?? ''
      const result = await sandbox.run({
        lang: current.lang,
        code: code.value,
        stdin: check.stdinCase?.stdin,
        // No `expression`, so the worker grades this case on what it printed.
        tests: [{ name: check.name, expected }],
        timeoutMs: TIMEOUT_MS,
      })

      if (result.error === 'runtime-load-failed') return abortedRun(result)

      durationMs += result.durationMs
      if (result.stdout !== '') {
        transcript.push(`— ${check.name}\n${result.stdout.replace(/\n$/, '')}`)
      }

      if (result.timedOut) {
        timedOut = true
        stderr ??= result.stderr
        results.push(unreported(check, 'timed out — check for a loop that never ends'))
        // Reporting the rest as failures rather than omitting them is what keeps
        // the grader's `tests_not_reported` empty, which is the honest signal.
        for (const rest of current.checks.slice(index + 1)) {
          results.push(unreported(rest, 'not run — an earlier case timed out'))
        }
        break
      }

      if (!result.ok) {
        stderr ??= result.stderr
        results.push({
          name: check.name,
          passed: false,
          detail: null,
          error: cap(firstLine(result.stderr) ?? 'the program stopped with an error', 5000),
          expected: cap(expected),
          received: cap(result.stdout.trim()),
        })
        continue
      }

      const got = (result.tests ?? []).find((test) => test.name === check.name)
      results.push({
        name: check.name,
        passed: got?.passed === true,
        detail: cap(got?.detail ?? null, 5000),
        error: null,
        expected: cap(expected),
        received: cap(result.stdout.trim()),
      })
    }

    return blank({ results, stdout: transcript.join('\n\n'), stderr, timedOut, durationMs })
  }

  /** build: parsed on this thread; nothing the learner wrote is ever executed. */
  function runBuild(): ExerciseRun {
    const started = performance.now()
    const results = gradeDom(code.value, spec.value.checks)
    return blank({ results, durationMs: Math.round(performance.now() - started) })
  }

  function abortedRun(result: RunResult): ExerciseRun {
    return blank({ aborted: true, stderr: result.stderr || 'The runtime could not be loaded.' })
  }

  async function runAll(): Promise<void> {
    if (running.value) return

    cancelled = false
    running.value = true
    progress.value = null

    try {
      const mode = spec.value.mode
      const result =
        mode === 'build' ? runBuild() : mode === 'script' ? await runScript() : await runSingle()

      // A cancelled multi-case run is discarded whole: a partial result set is
      // precisely the stale result the dirty-run rule exists to keep out.
      if (cancelled) return

      lastRun.value = result
      stale.value = false
    } finally {
      running.value = false
      progress.value = null
    }
  }

  function cancel(): void {
    cancelled = true
  }

  function reset(): void {
    lastRun.value = null
    stale.value = false
  }

  /** Editing invalidates the previous run without erasing it. */
  function markStale(): void {
    if (lastRun.value) stale.value = true
  }

  const passedCount = computed(
    () => lastRun.value?.results.filter((result) => result.passed).length ?? 0,
  )

  /** Submittable: a graded exercise needs a fresh run behind it; nothing else does. */
  const submittable = computed(() => {
    if (code.value.trim() === '') return false
    if (!spec.value.graded) return true
    const run = lastRun.value
    return run !== null && !run.aborted && !stale.value
  })

  /** EXACTLY the keys the server's `code` arm declares — see CodeAttemptResponse. */
  function attemptResponse(): CodeAttemptResponse | null {
    if (!submittable.value) return null
    const run = lastRun.value

    return {
      code: code.value,
      language: spec.value.language,
      tests: (run?.results ?? []).map((result) => ({
        name: result.name,
        passed: result.passed,
        error: result.error,
        detail: result.detail,
        expected: result.expected,
        received: result.received,
      })),
      console: consoleLines(run?.stdout ?? ''),
      timed_out: run?.timedOut ?? false,
      duration_ms: run?.durationMs ?? 0,
    }
  }

  return {
    sandbox,
    running: readonly(running),
    progress: readonly(progress),
    lastRun,
    stale,
    canCancel,
    passedCount,
    submittable,
    runAll,
    cancel,
    reset,
    markStale,
    attemptResponse,
    TIMEOUT_MS,
  }
}
