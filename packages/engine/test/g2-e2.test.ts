// G2 review, lane E2 (plan + exports): study order, the daily budget, exam-map fixes that persist, folded subtopics,
// the Checker's key-term rule, the Anki deck, the short title and the clock. No model calls, no network.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Assessment, ExamMap } from '@bilimind/core';
import { coursePaths, readJson } from '../src/course.ts';
import { examMap, foldedInto } from '../src/exam.ts';
import { buildPlan, defaultStudyOrder, planMarkdown } from '../src/plan.ts';
import { chooseLessons } from '../src/run.ts';
import { mentionsAnswer } from '../src/verdict.ts';
import { deckRows } from '../src/export/anki-csv.ts';
import { countCards } from '../src/export/receipts.ts';
import { shortTitle } from '../src/build.ts';
import { clockSkewMs, skewedNow } from '../src/clock.ts';
import { GOAL, dsIngest, dsOutline, fakeCtx, lesson, tempCourse, writeCourse } from './wp2-helpers.ts';

const OUTLINE = dsOutline([
  lesson('analysis', 'Big O', 'quantitative', { estimated_minutes: 25 }),
  lesson('hash', 'Hash tables', 'conceptual', { estimated_minutes: 25 }),
  lesson('probing', 'Linear probing', 'diagnostic', { estimated_minutes: 20, track: 'subtopic', branch_of: 'hash' }),
  lesson('heaps', 'Binary heaps', 'procedural', { estimated_minutes: 45 }),
  lesson('avl', 'AVL rotations', 'procedural', { estimated_minutes: 25 }),
]);
const EXAM: ExamMap = { total_marks: 100, unmatched: [], questions: [
  { id: 'Q2a', number: '2', part: 'a', text: 'Probe sequence', marks: 10, file: 'p.pdf', locator: null, chunk_id: null, matches: [], assigned: 'hash', assigned_by: 'auto', folded_from: 'probing' } as ExamMap['questions'][number],
], weights: [
  { key: 'heaps', title: 'Binary heaps', marks: 40, share: 0.4, questions: ['Q3'] },
  { key: 'hash', title: 'Hash tables', marks: 30, share: 0.3, questions: ['Q2a', 'Q2b'] },
  { key: 'analysis', title: 'Big O', marks: 15, share: 0.15, questions: ['Q1'] },
  { key: 'probing', title: 'Linear probing', marks: 0, share: 0, questions: [] },
  { key: 'avl', title: 'AVL rotations', marks: 0, share: 0, questions: [] },
] };

describe('plan (G2 review)', () => {
  it('studies the heaviest topic first; a subtopic follows its parent; no past paper keeps the outline order', () => {
    expect(defaultStudyOrder(['analysis', 'hash', 'probing', 'heaps'], OUTLINE, EXAM)).toEqual(['heaps', 'hash', 'probing', 'analysis']);
    expect(defaultStudyOrder(['analysis', 'hash', 'probing', 'heaps'], OUTLINE, null)).toEqual(['analysis', 'hash', 'probing', 'heaps']);
  });

  it('never plans a day over minutes_per_day when the selection fits, and clamps a long lesson to 70% of a day', () => {
    const p = buildPlan({ goal: GOAL, outline: OUTLINE, examMap: EXAM, keep: ['analysis', 'hash', 'heaps'], start: '2026-10-11' });
    expect(p.lessons.map(l => l.key)).toEqual(['heaps', 'hash', 'analysis']);
    expect(p.lessons.find(l => l.key === 'heaps')!.minutes).toBe(30);           // 45 -> 70% of 45 = 30
    expect(p.warnings.some(w => /heaps is sized at 45 min/.test(w))).toBe(true);
    for (const d of p.days) expect(d.minutes).toBeLessThanOrEqual(GOAL.minutes_per_day);
    expect(p.warnings.some(w => /over the daily/.test(w))).toBe(false);
    // the heaviest topic gets at least as many spaced reviews as any other
    const n = (k: string) => p.review_dates[k]!.length;
    expect(n('heaps')).toBeGreaterThanOrEqual(Math.max(n('hash'), n('analysis')));
  });

  it('a folded subtopic is "counted in" its parent, never "No marks", even when the Lead says so', () => {
    expect(foldedInto(EXAM, 'probing')).toEqual({ into: 'hash', questions: ['Q2a'] });
    const p = buildPlan({ goal: GOAL, outline: OUTLINE, examMap: EXAM, keep: ['hash', 'heaps'], cut: { probing: 'No marks in the past paper.' }, start: '2026-10-11' });
    const probing = p.cut.find(c => c.key === 'probing')!;
    expect(probing.reason).toMatch(/Its exam questions \(Q2a\) are counted in Hash tables, which is kept/);
    expect(p.cut.find(c => c.key === 'avl')!.reason).toMatch(/No marks/);
    const md = planMarkdown(p, OUTLINE, EXAM, GOAL);
    expect(md).toContain('| Linear probing | — | counted in Hash tables (Q2a) | — |');
    expect(md).not.toMatch(/Linear probing\*\* \(0% of marks\)/);
  });
});

describe('chooseLessons (G2 review)', () => {
  const t = (key: string, minutes: number, archetype = 'conceptual', track: 'core' | 'subtopic' = 'core', parent: string | null = null) =>
    ({ key, title: key, archetype, kind_label: '', formats: [], minutes, track, parent, thin: false }) as never;
  it('never cuts a >= 10% topic for a lighter one when swapping makes it fit', () => {
    // 2 study days x 30 min x 70% = 42 min: the small 8% topic ranks first by marks per minute and fills the space
    const topics = [t('tiny', 10), t('mid', 30), t('big', 30)];
    const weights = [{ key: 'tiny', title: '', marks: 8, share: 0.08, questions: [] }, { key: 'big', title: '', marks: 20, share: 0.2, questions: [] },
      { key: 'mid', title: '', marks: 12, share: 0.12, questions: [] }];
    const r = chooseLessons(topics, weights, { exam_at: '2026-10-12T09:00:00+08:00', minutes_per_day: 30 }, new Date('2026-10-10T10:00:00+08:00'));
    expect(r.keep).toContain('big');
    expect(r.cut.big).toBeUndefined();
  });
});

describe('exam-map --assign persists (G2 review)', () => {
  const paper = ['Question 1 (10 marks): Hashing', '(a) Define the load factor. [4 marks]', '(b) Insert 18 with linear probing. [6 marks]',
    ...Array.from({ length: 9 }, (_, i) => `Question ${i + 2} [5 marks] Binary search tree question ${i + 2}: insert keys and search.`),
    'Question 10 (10 marks): Hashing again', '(a) Rehash a table. [5 marks]', '(b) Compute the load factor. [5 marks]'].join('\n');
  it('re-applies earlier fixes; a fix for Q1 never touches Q10a', async () => {
    const dir = tempCourse();
    const ing = dsIngest();
    ing.chunks = ing.chunks.map(c => (c.material_id === 3 ? { ...c, content: paper } : c));
    const outline = dsOutline([lesson('hash_tables', 'Hash tables', 'conceptual', { chunk_ids: [1, 2, 3] }), lesson('bst', 'Binary search trees', 'procedural', { chunk_ids: [4, 5] })]);
    writeCourse(dir, { ingest: ing, outline });
    const ctx = fakeCtx(dir);
    await examMap(ctx, { assign: { Q10a: 'bst' } });
    await examMap(ctx, { assign: { Q1: 'bst' } });              // must keep Q10a=bst
    const again = await examMap(ctx, {}) as unknown as { reapplied?: string[] };
    const map = readJson<ExamMap>(coursePaths(dir).examMap);
    const by = (id: string) => map.questions.find(q => q.id === id)!;
    expect(by('Q10a')).toMatchObject({ assigned: 'bst', assigned_by: 'lead' });
    expect(by('Q1a')).toMatchObject({ assigned: 'bst', assigned_by: 'lead' });
    expect(by('Q10b').assigned_by).toBe('auto');
    expect(again.reapplied).toEqual(expect.arrayContaining(['Q10a=bst', 'Q1a=bst', 'Q1b=bst']));
    await examMap(ctx, { assign: { Q1a: 'hash_tables' } });     // a later fix of one part replaces the earlier one
    const m2 = readJson<ExamMap>(coursePaths(dir).examMap);
    expect(m2.questions.find(q => q.id === 'Q1a')!.assigned).toBe('hash_tables');
    expect(m2.questions.find(q => q.id === 'Q1b')!.assigned).toBe('bst');
    expect(readFileSync(coursePaths(dir).examMapMd, 'utf8')).toContain('(set by the Lead)');
  });
});

describe('Checker rule and deck (G2 review)', () => {
  const mcq = { id: 'q1', kind: 'mcq', prompt: 'How is the load factor defined?', bloom: 'remember', grader: 'auto', max_score: 1,
    options: [{ id: 'a', text: 'n / m, keys over slots' }, { id: 'b', text: 'm / n' }], answer_key: { correct_option_ids: ['a'] } } as unknown as Assessment;
  it('a supported quote must share a key term with the correct answer', () => {
    expect(mentionsAnswer('The dictionary (map) ADT Operations: insert(key, value), search(key),', mcq)).toBe(false);
    expect(mentionsAnswer('The load factor alpha = n / m measures how full the table is.', mcq)).toBe(true);
    const cloze = { ...mcq, kind: 'cloze', answer_key: { accepted: ['chaining'] } } as unknown as Assessment;
    expect(mentionsAnswer('separate chain: a linked list per slot', cloze)).toBe(true);    // crude stem
  });
  it('the deck always carries the quiz items (deduped) and the card count equals the deck', () => {
    const lessons = [{ id: 'l1', blocks: [
      { id: 'b1', type: 'quiz', payload: {}, cites: [], assessments: [
        { id: 'q1', kind: 'cloze', prompt: 'Separate ___ keeps a list per slot.', answer_key: { accepted: ['chaining'] } },
        mcq, { ...mcq, id: 'q3' },
        { id: 'q4', kind: 'numeric', prompt: 'alpha for n=6, m=8?', answer_key: { value: 0.75, tolerance: 0 } },
      ] },
    ] }] as never;
    const rows = deckRows({ id: 'c', lessons });
    expect(rows.map(r => r[0]!.split('\n')[0])).toEqual(['Separate ___ keeps a list per slot.', 'How is the load factor defined?', 'alpha for n=6, m=8?']);
    expect(countCards(lessons)).toBe(rows.length);
  });
});

describe('short display title and clock (G2 review)', () => {
  it('titles stay within 32 characters', () => {
    expect(shortTitle('Data Structures exam prep from your CSC2103 slides')).toBe('Data Structures exam prep');
    expect(shortTitle('Data Structures: final exam preparation for CSC2103')).toBe('Data Structures');
    expect(shortTitle('Hash tables')).toBe('Hash tables');
    for (const t of ['An Introduction to the Theory of Computation and Complexity', 'Mutiara Tea Bar day-one onboarding for new baristas and counter staff'])
      expect(shortTitle(t).length).toBeLessThanOrEqual(32);
  });
  it('Ctx.now() adds the measured skew (pinned with BILIMIND_CLOCK_SKEW_MS)', async () => {
    const before = process.env.BILIMIND_CLOCK_SKEW_MS;
    process.env.BILIMIND_CLOCK_SKEW_MS = String(8 * 3_600_000);
    try {
      const skew = await clockSkewMs();
      expect(skew).toBe(8 * 3_600_000);
      expect(Math.abs(skewedNow(skew)().getTime() - (Date.now() + skew))).toBeLessThan(1000);
    } finally {
      if (before === undefined) delete process.env.BILIMIND_CLOCK_SKEW_MS; else process.env.BILIMIND_CLOCK_SKEW_MS = before;
    }
  });
});
