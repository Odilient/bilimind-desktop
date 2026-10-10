// `check --lesson k`: Q0-Q17 (engine-port §5.2) over crew/lessons/<k>.json. Deterministic repairs first (fix.ts, written
// back to the draft with a `repairs` line each), then the pure rules (rules.ts) incl. running every JS code exercise in
// node:vm. Writes crew/checks/<k>.json = CheckData + {lesson, round, at, checks} and returns CheckData.
import { closeSync, existsSync, mkdirSync, openSync, rmSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArchetype } from '@bilimind/core';
import type { LessonContent } from '@bilimind/core';
import { BilimindError } from '../contracts.ts';
import type { CheckData, CheckFailure, CheckFn, Ctx } from '../contracts.ts';
import { coursePaths, readJson, readJsonOrNull, writeJson } from '../course.ts';
import { autoFix } from './fix.ts';
import { clone, loadCourseData, outlineLessonOf } from './lesson.ts';
import type { CourseData } from './lesson.ts';
import { runRules } from './rules.ts';
import type { CheckContext } from './rules.ts';

/** Reads crew/lessons/<key>.json with a helpful error when the lesson was never drafted. */
export function loadDraft(course: string, key: string): LessonContent {
  const path = coursePaths(course).lessonJson(key);
  if (!existsSync(path)) throw new BilimindError(`No draft for lesson "${key}"`, `Run \`draft --lesson ${key}\` first (lesson keys are in crew/outline.json).`);
  const lesson = readJson<LessonContent>(path);
  if (!lesson || !Array.isArray(lesson.blocks)) throw new BilimindError(`crew/lessons/${key}.json has no blocks array`, `Re-run \`draft --lesson ${key}\`.`);
  return lesson;
}
export function saveDraft(course: string, lesson: LessonContent): void {
  writeJson(coursePaths(course).lessonJson(lesson.key), lesson);
}

/**
 * Cross-process lock around a read-modify-write of crew/lessons/<key>.json. The Coder (code-test --apply) and the
 * Checker (verdict, rewrite-item) run in parallel on the same lesson; without this one could overwrite the other.
 * The callback must be synchronous and must load the draft INSIDE the lock. A lock older than 30 s is stale.
 */
export function withLessonLock<T>(course: string, key: string, fn: () => T): T {
  const lock = `${coursePaths(course).lessonJson(key)}.lock`;
  mkdirSync(dirname(lock), { recursive: true });
  const deadline = Date.now() + 15000;
  const nap = new Int32Array(new SharedArrayBuffer(4));
  for (;;) {
    try { closeSync(openSync(lock, 'wx')); break; } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      try { if (Date.now() - statSync(lock).mtimeMs > 30000) { rmSync(lock, { force: true }); continue; } } catch { continue; }
      if (Date.now() > deadline) throw new BilimindError(`crew/lessons/${key}.json is busy (another command holds its lock)`, 'Run the command again in a few seconds.');
      Atomics.wait(nap, 0, 0, 40);
    }
  }
  try { return fn(); } finally { rmSync(lock, { force: true }); }
}

export function checkContext(data: CourseData, key: string, timeoutMs = 2000): CheckContext {
  const ol = outlineLessonOf(data, key);
  return {
    key,
    archetype: ol ? parseArchetype(ol.archetype) : null,
    minutes: ol && Number.isFinite(ol.estimated_minutes) && ol.estimated_minutes > 0 ? ol.estimated_minutes : null,
    chunks: data.ingest ? data.chunks : null,
    files: data.files,
    timeoutMs,
    share: data.shares?.get(key) ?? null,
  };
}

/** Pure entry point (tests, plant): repairs a COPY and runs the rules; nothing is written. */
export function checkLesson(lesson: LessonContent, cx: CheckContext): { lesson: LessonContent; data: CheckData; checks: ReturnType<typeof runRules> } {
  const fixed = clone(lesson);
  const auto_fixed = autoFix(fixed, cx);
  const checks = runRules(fixed, cx);
  const failed: CheckFailure[] = checks.filter(c => !c.ok).map(c => ({
    rule: c.rule, block: c.block ?? null, item: c.item ?? null, detail: c.detail, suggestion: c.suggestion ?? '',
  }));
  return { lesson: fixed, checks, data: { total: checks.length, passed: checks.length - failed.length, failed, auto_fixed } };
}

export const check: CheckFn = async (ctx: Ctx, opts) => {
  const key = opts.lesson;
  if (!key) throw new BilimindError('check needs --lesson <key>', 'Lesson keys are in crew/outline.json.');
  const paths = coursePaths(ctx.course);
  const cx = checkContext(loadCourseData(ctx.course), key);
  const { data, checks } = withLessonLock(ctx.course, key, () => {
    const res = checkLesson(loadDraft(ctx.course, key), cx);
    if (res.data.auto_fixed.length) {
      res.lesson.repairs = [...(Array.isArray(res.lesson.repairs) ? res.lesson.repairs : []), ...res.data.auto_fixed.map(f => `check: ${f.detail}`)];
      saveDraft(ctx.course, res.lesson);
    }
    return res;
  });
  const prev = readJsonOrNull<{ round?: number }>(paths.checksJson(key));
  writeJson(paths.checksJson(key), { lesson: key, round: (prev?.round ?? 0) + 1, at: ctx.now().toISOString(), ...data, checks });
  ctx.progress(`check ${key}: ${data.passed}/${data.total} passed, ${data.auto_fixed.length} auto-fixed, ${data.failed.length} flagged`);
  for (const f of data.failed) ctx.progress(`  ✗ ${f.rule}${f.block !== null ? ` b${f.block}` : ''}${f.item ? ` ${f.item}` : ''}: ${f.detail}`);
  return data;
};
