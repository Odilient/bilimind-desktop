// Q11 per code block, shared by `check` and `code-test`: the reference solution must pass every test, the starter
// must fail at least one (else the exercise is already solved), and debug-mode starters must at least parse.
import type { Block } from '@bilimind/core';
import type { CodeBlockReport, JsTestRun } from '../contracts.ts';
import { runJsTests } from './harness.ts';
import type { JsTest } from './harness.ts';
import { blockNo, codeItemOf } from './lesson.ts';
import type { Raw } from './lesson.ts';

export interface CodeVerdict {
  block: number | null;
  /** 'ok' | 'fail' | 'disabled' | 'skipped' (a language/mode we do not execute here) */
  state: 'ok' | 'fail' | 'disabled' | 'skipped';
  report: CodeBlockReport;
  problems: string[];       // human sentences, empty when ok
  summary: string;          // "reference passes 4/4 tests · starter fails 3/4"
  reference?: JsTestRun;
  starter?: JsTestRun;
}

const s = (v: unknown) => (typeof v === 'string' ? v : '');
const short = (v: unknown): string => {
  const t = typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v ?? null);
  return t.length > 80 ? t.slice(0, 79) + '…' : t;
};

export const isDisabledCode = (b: Block): boolean => {
  const tests = ((b.payload ?? {}) as Raw).tests;
  return codeItemOf(b)?.grader === 'self' && (!Array.isArray(tests) || tests.length === 0);
};

export function codeTests(b: Block): JsTest[] {
  const tests = ((b.payload ?? {}) as Raw).tests;
  return Array.isArray(tests) ? (tests as Raw[]).map((t, i) => ({ name: s(t.name) || `test ${i + 1}`, call: s(t.call) || undefined, expect: t.expect })) : [];
}

export function testCodeBlock(b: Block, timeoutMs = 2000): CodeVerdict {
  const n = blockNo(b);
  const p = (b.payload ?? {}) as Raw;
  const lang = s(p.language) || 'javascript';
  const mode = s(p.mode) || 'function';
  const tests = codeTests(b);
  const item = codeItemOf(b);
  const reference = s((item?.answer_key as Raw | undefined)?.reference_solution);
  const starter = s(p.starter_code);
  const empty: CodeBlockReport = { block: n ?? 0, reference: { passed: 0, total: tests.length, failures: [] }, starter: { passed: 0, total: tests.length } };

  if (isDisabledCode(b)) return { block: n, state: 'disabled', report: { ...empty, disabled: true }, problems: [], summary: 'disabled: the learner marks it themselves' };
  if (lang !== 'javascript' || !['function', 'debug', 'script'].includes(mode))
    return { block: n, state: 'skipped', report: empty, problems: [], summary: `not executed here (${lang} ${mode}); the page runs it` };

  const problems: string[] = [];
  if (!item) problems.push('the code block has no `code` assessment item (nothing holds the reference solution)');
  if (!reference.trim()) problems.push('answer_key.reference_solution is empty');
  if (!tests.length) problems.push('the exercise has no tests');
  if ((mode === 'function' || mode === 'debug') && tests.some(t => !t.call)) problems.push(`every ${mode} test needs a \`call\` expression`);
  if (problems.length) return { block: n, state: 'fail', report: empty, problems, summary: problems[0]! };

  const ref = runJsTests(reference, tests, timeoutMs);
  const st = runJsTests(starter, tests, timeoutMs);
  const failures = ref.results.filter(r => !r.passed).map(r => ({ test: r.name, expected: r.expected, actual: r.error ? `${r.actual === null ? '' : `${short(r.actual)} `}(${r.error})`.trim() : r.actual }));
  const report: CodeBlockReport = { block: n ?? 0, reference: { passed: ref.passed, total: ref.total, failures }, starter: { passed: st.passed, total: st.total } };

  if (ref.syntaxError) problems.push(`the reference solution does not parse: ${ref.syntaxError}`);
  else if (ref.passed < ref.total) {
    for (const f of ref.results.filter(r => !r.passed).slice(0, 4))
      problems.push(f.error ? `reference fails '${f.name}': ${f.error}` : `reference fails '${f.name}': expected ${short(f.expected)}, got ${short(f.actual)}`);
  }
  if (mode === 'debug' && st.syntaxError) problems.push(`the debug starter does not parse (it should run and misbehave): ${st.syntaxError}`);
  else if (!st.syntaxError && st.passed === st.total && st.total > 0) problems.push(`the starter code already passes all ${st.total} tests, so there is nothing to solve`);
  // G2: a `while (true)` starter with only TODO comments hangs the learner's first Run until the worker is killed
  if (st.timedOut && !ref.timedOut) problems.push('the starter never finishes (an endless loop): add a placeholder `return` so a first Run shows failing tests, not a timeout');

  const stFails = st.total - st.passed;
  const summary = `reference passes ${ref.passed}/${ref.total} tests · starter fails ${stFails}/${st.total}`;
  return { block: n, state: problems.length ? 'fail' : 'ok', report, problems, summary, reference: ref, starter: st };
}
