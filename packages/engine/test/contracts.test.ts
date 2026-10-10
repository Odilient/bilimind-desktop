import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import * as engine from '../src/index.ts';
import { coursePaths, BilimindError } from '../src/index.ts';

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
});
