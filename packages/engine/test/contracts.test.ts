import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as engine from '../src/index.ts';
import { coursePaths, BilimindError, defaultTimeZone, setGoal } from '../src/index.ts';

describe('engine contracts', () => {
  it('exports every EngineApi function', () => {
    const names = ['loadConfig', 'callJson', 'checkBudget', 'ingest', 'outline', 'examMap', 'plan', 'draft', 'check', 'codeTest',
      'evidence', 'verdict', 'rewriteItem', 'plant', 'plantScore', 'narrate', 'initReview', 'due', 'grade', 'toMarkdown', 'ankiCsv',
      'ics', 'report', 'computeReceipts', 'exportAll', 'assembleCourse', 'build', 'run', 'doctor', 'init', 'setGoal', 'status', 'note',
      'readNarration', 'readClips', 'readIngest', 'readOutline', 'readExamMap', 'readPlan', 'readLessonDraft', 'readVerdicts', 'readReviewState'];
    for (const n of names) expect(typeof (engine as Record<string, unknown>)[n], n).toBe('function');
  });
  it('course paths follow PLAN §2.4', () => {
    const p = coursePaths(join('x', 'bilimind-out', 'ds'));
    expect(p.lessonJson('hash_tables').endsWith(join('crew', 'lessons', 'hash_tables.json'))).toBe(true);
    expect(p.codeDir('heaps', 3).endsWith(join('crew', 'code', 'heaps-b3'))).toBe(true);
    expect(p.reviewState.endsWith(join('review', 'state.json'))).toBe(true);
  });
  it('BilimindError carries a hint', () => {
    const e = new BilimindError('No key', 'Set DEEPSEEK_API_KEY');
    expect(e.hint).toBe('Set DEEPSEEK_API_KEY');
    expect(e).toBeInstanceOf(Error);
  });
  it('uses the computer time zone by default while allowing an explicit override', async () => {
    const oldTz = process.env.TZ;
    process.env.TZ = 'Europe/Oslo';
    vi.resetModules();
    const course = mkdtempSync(join(tmpdir(), 'bilimind-timezone-'));
    const ctx = { course, now: () => new Date('2026-10-10T12:00:00Z'), progress: () => {}, agent: 'Test', noCache: true, spend: { usd: 0, calls: 0 } };
    const base = { minutesPerDay: 45, audience: 'student' as const, lang: 'en', codeLang: 'none' as const, assume: [], deadline: '2026-10-14', examTime: '09:00' };
    await setGoal(ctx, base);
    expect(JSON.parse(readFileSync(coursePaths(course).goal, 'utf8')).timezone).toBe(defaultTimeZone());
    await setGoal(ctx, { ...base, timezone: 'Asia/Kuala_Lumpur' });
    expect(JSON.parse(readFileSync(coursePaths(course).goal, 'utf8')).timezone).toBe('Asia/Kuala_Lumpur');
    if (oldTz === undefined) delete process.env.TZ; else process.env.TZ = oldTz;
  });
});
