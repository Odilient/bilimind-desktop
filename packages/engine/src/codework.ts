// `code-test`: run / dump / apply / disable for the Coder agent.
// Owner: WP3. Keep the export names and types (src/contracts.ts); replace the stubs in place.
//   run     : tests every code block of the lesson JSON (reference must pass all, starter must fail one).
//   dump    : crew/code/<k>-b<n>/{instructions.md, starter.js, solution.js, tests.json} (+ the same run report).
//   apply   : reads those four files back into the lesson JSON, re-runs, saves.
//   disable : payload.tests = [], code item grader 'self', answer_key.tests removed; the reason goes into `repairs`.
// Non-JavaScript exercises dump with their own extension (starter.py, solution.sql, ...) and are not executed here.
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Block, LessonContent } from '@bilimind/core';
import { BilimindError } from './contracts.ts';
import type { CodeBlockReport, CodeTestFn, Ctx } from './contracts.ts';
import { coursePaths, writeJson, writeText } from './course.ts';
import { loadDraft, saveDraft, withLessonLock } from './validate/check.ts';
import { testCodeBlock } from './validate/code.ts';
import { blockNo, codeItemOf, nextItemId } from './validate/lesson.ts';
import type { Raw } from './validate/lesson.ts';

const EXT: Record<string, string> = { javascript: 'js', python: 'py', sql: 'sql', html: 'html' };
const extOf = (b: Block) => EXT[String(((b.payload ?? {}) as Raw).language ?? 'javascript')] ?? 'js';
const rel = (ctx: Ctx, abs: string) => relative(ctx.course, abs).split('\\').join('/');

function pickBlocks(lesson: LessonContent, key: string, n?: number): Block[] {
  const code = lesson.blocks.filter(b => b.type === 'code');
  if (!code.length) throw new BilimindError(`Lesson "${key}" has no code exercise`, 'Nothing to test: the Coder can skip this lesson.');
  if (n === undefined || n === null) return code;
  const b = code.find(x => blockNo(x) === n);
  if (!b) throw new BilimindError(`Lesson "${key}" has no code block b${n}`, `Code blocks: ${code.map(x => x.id ?? '?').join(', ')}. Pass --block <number>.`);
  return [b];
}

function runReport(b: Block): CodeBlockReport {
  return testCodeBlock(b).report;
}

function dumpBlock(ctx: Ctx, key: string, b: Block): string {
  const n = blockNo(b);
  if (n === null) throw new BilimindError(`A code block in "${key}" has no b<n> id`, 'Give the block an id like b7 in the lesson JSON, then dump again.');
  const dir = coursePaths(ctx.course).codeDir(key, n);
  const p = (b.payload ?? {}) as Raw;
  const ext = extOf(b);
  const item = codeItemOf(b);
  writeText(join(dir, 'instructions.md'), String(p.instructions_markdown ?? ''));
  writeText(join(dir, `starter.${ext}`), String(p.starter_code ?? ''));
  writeText(join(dir, `solution.${ext}`), String(item?.answer_key?.reference_solution ?? ''));
  writeJson(join(dir, 'tests.json'), Array.isArray(p.tests) ? p.tests : []);
  return rel(ctx, dir);
}

function readText(path: string, what: string, key: string, n: number): string {
  if (!existsSync(path)) throw new BilimindError(`Missing ${what} for ${key} b${n}`, `Run \`code-test --lesson ${key} --block ${n} --dump\` first, edit the files, then --apply.`);
  return readFileSync(path, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
}

function applyBlock(ctx: Ctx, lesson: LessonContent, key: string, b: Block): string {
  const n = blockNo(b)!;
  const dir = coursePaths(ctx.course).codeDir(key, n);
  const ext = extOf(b);
  const instructions = readText(join(dir, 'instructions.md'), 'instructions.md', key, n);
  const starter = readText(join(dir, `starter.${ext}`), `starter.${ext}`, key, n);
  const solution = readText(join(dir, `solution.${ext}`), `solution.${ext}`, key, n);
  let tests: unknown;
  try { tests = JSON.parse(readText(join(dir, 'tests.json'), 'tests.json', key, n)); } catch (e) {
    if (e instanceof BilimindError) throw e;
    throw new BilimindError(`tests.json for ${key} b${n} is not valid JSON: ${(e as Error).message}`, 'Fix the JSON (an array of {"name","call","expect"}), then --apply again.');
  }
  if (!Array.isArray(tests) || tests.some(t => !t || typeof t !== 'object' || typeof (t as Raw).name !== 'string' || !(t as Raw).name))
    throw new BilimindError(`tests.json for ${key} b${n} must be an array of {"name","call","expect"}`, 'Every test needs a unique non-empty name.');
  const names = (tests as Raw[]).map(t => String(t.name));
  if (new Set(names).size !== names.length) throw new BilimindError(`tests.json for ${key} b${n} has duplicate test names`, 'Test names must be unique (grading counts passed names).');

  const p = (b.payload ??= {}) as Raw;
  p.instructions_markdown = instructions.replace(/\n+$/, '');
  p.starter_code = starter.replace(/\n+$/, '');
  p.tests = tests;
  let item = codeItemOf(b);
  if (!item) {
    item = { id: nextItemId(lesson), kind: 'code', prompt: 'Make every test pass.', bloom: 'apply', grader: 'deterministic', max_score: 100, answer_key: {} };
    b.assessments = [...(b.assessments ?? []), item];
  }
  item.answer_key = { ...(item.answer_key ?? {}), reference_solution: solution.replace(/\n+$/, ''), tests: names };
  if (item.grader === 'self' && names.length) item.grader = 'deterministic';
  return rel(ctx, dir);
}

function disableBlock(b: Block): void {
  const p = (b.payload ??= {}) as Raw;
  p.tests = [];
  const item = codeItemOf(b);
  if (item) {
    item.grader = 'self';
    if (item.answer_key) delete item.answer_key.tests;
  }
}

export const codeTest: CodeTestFn = async (ctx, opts) => {
  const key = opts.lesson;
  if (!key) throw new BilimindError('code-test needs --lesson <key>', 'Lesson keys are in crew/outline.json.');
  const mode = opts.mode ?? 'run';
  const out: CodeBlockReport[] = [];
  const log = (r: CodeBlockReport) => ctx.progress(`code-test ${key} b${r.block}: ${r.disabled ? 'disabled (self-marked)'
    : `reference ${r.reference.passed}/${r.reference.total}, starter fails ${r.starter.total - r.starter.passed}/${r.starter.total}`}`
    + r.reference.failures.slice(0, 3).map(f => `\n  ✗ ${f.test}: expected ${JSON.stringify(f.expected)}, got ${JSON.stringify(f.actual)}`).join(''));

  if (mode === 'run' || mode === 'dump') {
    const lesson = loadDraft(ctx.course, key);
    for (const b of pickBlocks(lesson, key, opts.block)) {
      const dir = mode === 'dump' ? dumpBlock(ctx, key, b) : undefined;
      const r = runReport(b);
      if (dir) r.dir = dir;
      out.push(r); log(r);
    }
    return { blocks: out };
  }
  if (mode === 'apply') {
    return withLessonLock(ctx.course, key, () => {
      const lesson = loadDraft(ctx.course, key);
      const blocks = pickBlocks(lesson, key, opts.block);
      const dirs = blocks.map(b => applyBlock(ctx, lesson, key, b));
      blocks.forEach((b, i) => {
        const r = runReport(b);
        r.dir = dirs[i]!;
        out.push(r); log(r);
        lesson.repairs = [...(lesson.repairs ?? []), `code-test: applied ${dirs[i]} (reference ${r.reference.passed}/${r.reference.total}, starter fails ${r.starter.total - r.starter.passed}/${r.starter.total})`];
      });
      saveDraft(ctx.course, lesson);
      return { blocks: out };
    });
  }
  if (mode === 'disable') {
    const reason = (opts.reason ?? '').trim();
    if (!reason) throw new BilimindError('code-test --disable needs --reason "<why>"', 'Say why the exercise cannot be fixed; the reason goes into REPORT.md.');
    return withLessonLock(ctx.course, key, () => {
      const lesson = loadDraft(ctx.course, key);
      for (const b of pickBlocks(lesson, key, opts.block)) {
        disableBlock(b);
        lesson.repairs = [...(lesson.repairs ?? []), `code-test: disabled b${blockNo(b)} (self-marked): ${reason}`];
        const r = runReport(b);
        out.push(r); log(r);
      }
      saveDraft(ctx.course, lesson);
      return { blocks: out };
    });
  }
  throw new BilimindError(`Unknown code-test mode "${String(mode)}"`, 'Use --dump, --apply, --disable --reason "...", or no flag to run.');
};
