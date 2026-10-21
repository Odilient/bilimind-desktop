// WP2 exam-map + plan tests. exam-map runs on the REAL ds-final past paper (WP1 ingest of the showcase PDFs) with a
// hand-written outline, and must assign >= 70% of marks to topics (PLAN 5.2 acceptance). No model calls.
import { cpSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ExamMap, OutlineResult, PlanResult } from '@bilimind/core';
import { BilimindError } from '../src/contracts.ts';
import { coursePaths, readJson, writeJson } from '../src/course.ts';
import { ingest, readIngest } from '../src/ingest/index.ts';
import { examMap, parseExamQuestions, joinFileChunks, examStem } from '../src/exam.ts';
import { buildPlan, partitionByMinutes, plan, planToday } from '../src/plan.ts';
import { lessonSources, teachingChunks } from '../src/prompts/context.ts';
import { DS_FINAL, GOAL, dsOutline, fakeCtx, lesson, tempCourse, writeCourse } from './wp2-helpers.ts';

const PAPER = `SAMPLE FINAL EXAMINATION
Time allowed: 2 hours Total marks: 40
1. Answer ALL questions.
Question 1 (15 marks): Hashing
(a) Define the load factor of a hash table.
[5 marks]
(b) Insert 18, 41, 22 using linear probing with m = 13. Compare (i) probes and (ii) clustering. [10 marks]
Question 2 (10 marks): Heaps
(a) State the heap property. [4 marks]
(b) Give the parent index of node i.
Question 3 [15 marks] Binary search trees: draw the tree after inserting 45, 25, 65.
END OF QUESTION PAPER`;

describe('parseExamQuestions', () => {
  it('questions, parts and marks; a part without marks shares what is left of its question', () => {
    const qs = parseExamQuestions(PAPER, 'past-paper.pdf');
    expect(qs.map(q => [q.id, q.marks])).toEqual([['Q1a', 5], ['Q1b', 10], ['Q2a', 4], ['Q2b', 6], ['Q3', 15]]);
    expect(qs[0]).toMatchObject({ number: '1', part: 'a', file: 'past-paper.pdf', assigned: null, assigned_by: 'auto' });
    expect(qs[0]!.text).toBe('Hashing: Define the load factor of a hash table.');
    expect(qs[1]!.text).toContain('(i) probes and (ii) clustering');   // mid-line (i) is not a part
    expect(qs[4]!.text).toBe('Binary search trees: draw the tree after inserting 45, 25, 65.');
  });
  it('joins overlapping chunks back into the file text', () => {
    const base = { material_id: 1, title: 't', page: 1 };
    const { text, spans } = joinFileChunks([
      { ...base, id: 2, ordinal: 2, locator: 'Page 1', content: 'the overlap region here and the second half.' },
      { ...base, id: 1, ordinal: 1, locator: 'Page 1', content: 'First half of the page, then the overlap region here' },
      { ...base, id: 3, ordinal: 3, locator: 'Page 2', content: 'Page two.' },
    ]);
    expect(text).toBe('First half of the page, then the overlap region here and the second half.\nPage two.');
    expect(spans.map(s => s.chunk.id)).toEqual([1, 2, 3]);
    expect(['hashing', 'heaps', 'probing', 'probes', 'trees'].map(examStem)).toEqual(['hash', 'heap', 'prob', 'prob', 'tree']);
  });
});

describe.skipIf(!existsSync(DS_FINAL))('exam-map on the real ds-final past paper', () => {
  let dir = '';
  beforeAll(async () => {
    dir = tempCourse();
    cpSync(DS_FINAL, coursePaths(dir).sources, { recursive: true });
    writeCourse(dir, {});
    await ingest(fakeCtx(dir), {});
    const pool = teachingChunks(readIngest(dir));
    const S = (key: string, title: string, archetype: Parameters<typeof lesson>[2], summary: string, over = {}) => {
      const l = lesson(key, title, archetype, { summary, ...over });
      return { ...l, chunk_ids: lessonSources(pool, l).chunks.map(c => c.id) };
    };
    writeJson(coursePaths(dir).outline, dsOutline([
      S('growth_rates_big_o', 'Measuring running time with Big O', 'quantitative', 'You will be able to state the Big O of a loop by counting basic operations. Covers Big O, Big Omega and Big Theta, nested and doubling loops.'),
      S('dynamic_arrays_amortised', 'Dynamic arrays and amortised append', 'quantitative', 'You will be able to explain why appending to a dynamic array is O(1) amortised. Covers capacity, doubling and the copy cost.', { track: 'subtopic', branch_of: 'growth_rates_big_o' }),
      S('arrays_vs_linked_lists', 'Choosing between arrays and linked lists', 'discriminative', 'You will be able to pick an array or a singly linked list for a task. Covers nodes, insertion at the front, access by index and memory use.'),
      S('hash_tables', 'How hash tables find a key in O(1)', 'conceptual', 'You will be able to explain how a hash function maps keys to slots. Covers the load factor, resizing and separate chaining.'),
      S('open_addressing_probing', 'Linear probing and clustering', 'diagnostic', 'You will be able to trace linear probing and spot primary clustering. Covers probe sequences, double hashing and expected probes.', { track: 'subtopic', branch_of: 'hash_tables' }),
      S('bst_operations', 'Insert, search and delete in a BST', 'procedural', 'You will be able to insert, search and delete keys in a binary search tree and list its traversals.'),
      S('avl_rotations', 'Rebalancing with AVL rotations', 'procedural', 'You will be able to rebalance an AVL tree after an insert. Covers the balance factor and the LL, RR, LR and RL rotations.'),
      S('binary_heaps', 'Binary heaps and priority queues', 'procedural', 'You will be able to insert into and extract the minimum of a binary heap stored in an array. Covers sift-up, sift-down and build-heap.'),
      S('capstone_timed_drill', 'Capstone: a timed drill', 'performance', 'You will answer a mixed set under time pressure and mark it against a rubric.'),
    ]));
  }, 60_000);

  it('20 parts, 100 marks; >= 70% of marks assigned; the expected topics carry them; AVL gets 0', async () => {
    const data = await examMap(fakeCtx(dir), {}) as Awaited<ReturnType<typeof examMap>> & { zero_mark_topics: string[] };
    expect(data.questions).toBe(20);
    expect(data.total_marks).toBe(100);
    const map = readJson<ExamMap>(coursePaths(dir).examMap);
    const assigned = map.questions.filter(q => q.assigned).reduce((s, q) => s + q.marks, 0);
    expect(assigned / map.total_marks).toBeGreaterThanOrEqual(0.7);
    const marks = (...keys: string[]) => map.weights.filter(w => keys.includes(w.key)).reduce((s, w) => s + w.marks, 0);
    expect(marks('hash_tables', 'open_addressing_probing')).toBe(30);
    expect(marks('binary_heaps')).toBe(30);
    expect(marks('bst_operations')).toBe(15);
    expect(marks('growth_rates_big_o', 'dynamic_arrays_amortised')).toBe(15);
    expect(marks('arrays_vs_linked_lists')).toBe(10);
    expect(data.zero_mark_topics).toContain('avl_rotations');
    expect(map.weights[0]!.share).toBeGreaterThanOrEqual(map.weights[1]!.share);
    const q2d = map.questions.find(q => q.id === 'Q2d')!;
    expect(q2d.locator).toBe('Page 2');
    expect(q2d.chunk_id).not.toBeNull();
    expect(q2d.matches[0]!.terms).toEqual(expect.arrayContaining(['clustering']));
    const md = readFileSync(coursePaths(dir).examMapMd, 'utf8');
    expect(md).toContain('## What the paper weights');
    expect(md).toMatch(/\| Q2b \| 10 \| /);
    expect(md).toContain('exam-map --assign "Q3=<topic key>"');
  }, 60_000);   // ingests five real PDFs: over 10 s on a busy Windows CI runner

  it('--assign overrides a whole question or one part; unknown keys and questions fail with a hint', async () => {
    await examMap(fakeCtx(dir), { assign: { Q2: 'hash_tables', q5d: 'avl_rotations' } });
    const map = readJson<ExamMap>(coursePaths(dir).examMap);
    expect(map.questions.filter(q => q.number === '2').every(q => q.assigned === 'hash_tables' && q.assigned_by === 'lead')).toBe(true);
    expect(map.questions.find(q => q.id === 'Q5d')!.assigned).toBe('avl_rotations');
    expect(map.weights.find(w => w.key === 'hash_tables')!.marks).toBe(30);
    await expect(examMap(fakeCtx(dir), { assign: { Q2: 'nope' } })).rejects.toThrow(/no topic with key "nope"/);
    await expect(examMap(fakeCtx(dir), { assign: { Q9: 'hash_tables' } })).rejects.toBeInstanceOf(BilimindError);
  });
});

describe('exam-map without a past paper', () => {
  it('says how to mark one', async () => {
    const dir = tempCourse();
    writeCourse(dir, { ingest: { files: [], chunks: [], digest: '', thin_files: [] }, outline: dsOutline([lesson('a', 'A', 'factual')]) });
    await expect(examMap(fakeCtx(dir), {})).rejects.toThrow(/No past paper/);
  });
});

// ---------- plan ----------
const OUTLINE = dsOutline([
  lesson('hash_tables', 'Hash tables', 'conceptual', { estimated_minutes: 20 }),
  lesson('probing', 'Linear probing', 'quantitative', { estimated_minutes: 20, track: 'subtopic', branch_of: 'hash_tables' }),
  lesson('heaps', 'Binary heaps', 'procedural', { estimated_minutes: 20 }),
  lesson('bst', 'BST operations', 'procedural', { estimated_minutes: 20, thin: true }),
  lesson('avl', 'AVL rotations', 'procedural', { estimated_minutes: 30 }),
  lesson('capstone', 'Capstone drill', 'performance', { estimated_minutes: 45 }),
]);
const EXAM: ExamMap = { questions: [], total_marks: 100, unmatched: [], weights: [
  { key: 'hash_tables', title: 'Hash tables', marks: 30, share: 0.3, questions: ['Q2'] },
  { key: 'heaps', title: 'Binary heaps', marks: 30, share: 0.3, questions: ['Q3'] },
  { key: 'bst', title: 'BST operations', marks: 15, share: 0.15, questions: ['Q5'] },
  { key: 'capstone', title: 'Capstone drill', marks: 10, share: 0.1, questions: ['Q4'] },
  { key: 'probing', title: 'Linear probing', marks: 15, share: 0.15, questions: ['Q1'] },
  { key: 'avl', title: 'AVL rotations', marks: 0, share: 0, questions: [] },
] };
const KEEP = ['hash_tables', 'probing', 'heaps', 'bst'];

describe('plan: 3 days x 45 min before a Wednesday 9am exam', () => {
  const p = buildPlan({ goal: GOAL, outline: OUTLINE, examMap: EXAM, keep: KEEP, cut: { avl: 'No marks in the past paper.' }, start: '2026-10-11' });

  it('keeps 4 lessons over 3 study days, every day within 45 min once reviews are counted (G2)', () => {
    expect(p.lessons.map(l => [l.key, l.day, l.order])).toEqual([
      ['hash_tables', '2026-10-11', 1], ['probing', '2026-10-11', 2], ['heaps', '2026-10-12', 3], ['bst', '2026-10-13', 4]]);
    for (const d of p.days) expect(d.minutes).toBeLessThanOrEqual(45);
    expect(p.days.map(d => d.date)).toEqual(['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14']);
    expect(p.days[3]).toMatchObject({ exam: true, label: 'Exam 09:00', lessons: [] });
    // new lessons get what the projected reviews leave (5 reviews x 5 min), not a fixed 60%
    expect([p.capacity_min, p.new_budget_min, p.review_budget_min, p.used_min]).toEqual([135, 110, 25, 80]);
    expect(p.lessons[0]!.weight).toBe(0.3);
  });
  it('every review date falls strictly before the exam and after the study day', () => {
    for (const l of p.lessons) {
      if (l.key !== 'bst') expect(p.review_dates[l.key]!.length).toBeGreaterThan(0);   // bst is learned the day before
      for (const d of p.review_dates[l.key]!) { expect(d < '2026-10-14').toBe(true); expect(d > l.day).toBe(true); }
    }
    expect(p.review_dates.hash_tables).toEqual(['2026-10-12', '2026-10-13']);
    expect(p.reviews).toBe(Object.values(p.review_dates).flat().length);
    expect(p.days[1]!.reviews).toBe(2);                       // hash_tables + probing reviewed on day 2
  });
  it('cut reasons: the Lead\'s, else derived from the marks', () => {
    expect(p.cut).toEqual([
      { key: 'avl', title: 'AVL rotations', reason: 'No marks in the past paper.', weight: 0 },
      { key: 'capstone', title: 'Capstone drill', reason: 'Did not fit the days you have.', weight: 0.1 },
    ]);
    expect(p.warnings).toContain('Cut lesson capstone carries 10% of the past paper\'s marks.');
    expect(p.warnings).toContain('bst is thin in your sources: expect "Beyond your slides" labels in it.');
    expect(p.warnings.some(w => w.startsWith('Variety (advice only'))).toBe(true);   // no performance lesson kept
  });
  it('over-capacity selection produces a warning, never a block', () => {
    const over = buildPlan({ goal: GOAL, outline: OUTLINE, examMap: EXAM, keep: [...KEEP, 'avl', 'capstone'], start: '2026-10-11' });
    expect(over.used_min).toBe(140);                       // the 45-min capstone is planned as 30 (70% of a day)
    expect(over.warnings.some(w => /capstone is sized at 45 min/.test(w))).toBe(true);
    expect(over.warnings.some(w => /over the daily 45 min/.test(w))).toBe(true);
    expect(over.lessons).toHaveLength(6);
    expect(over.lessons.at(-1)!.day).toBe('2026-10-13');
  });
  it('--order wins; unknown keys fail with the outline keys as the hint', () => {
    const o = buildPlan({ goal: GOAL, outline: OUTLINE, examMap: null, keep: KEEP, order: ['heaps', 'avl'], start: '2026-10-11' });
    expect(o.lessons.map(l => l.key)).toEqual(['heaps', 'hash_tables', 'probing', 'bst']);
    expect(o.lessons[0]!.weight).toBeNull();
    expect(o.warnings).toContain('--order names avl, which is not kept; ignored.');
    expect(() => buildPlan({ goal: GOAL, outline: OUTLINE, examMap: null, keep: ['nope'], start: '2026-10-11' })).toThrow(/Unknown lesson key/);
    expect(() => buildPlan({ goal: GOAL, outline: OUTLINE, examMap: null, keep: [], start: '2026-10-11' })).toThrow(BilimindError);
  });
  it('an exam tomorrow plans one day; no exam date plans a week forward', () => {
    const t = buildPlan({ goal: GOAL, outline: OUTLINE, examMap: null, keep: KEEP, start: '2026-10-13' });
    expect(t.days.map(d => d.date)).toEqual(['2026-10-13', '2026-10-14']);
    expect(t.lessons.every(l => l.day === '2026-10-13')).toBe(true);
    const none = buildPlan({ goal: { ...GOAL, deadline: null, exam_at: null }, outline: OUTLINE, examMap: null, keep: KEEP, start: '2026-10-11' });
    expect(none.days).toHaveLength(7);
    expect(none.warnings[0]).toMatch(/No exam date/);
  });
});

describe('day assignment (linear partition)', () => {
  it('consecutive groups, smallest busiest day', () => {
    expect(partitionByMinutes([40, 40, 40, 45], 3)).toEqual([[0], [1, 2], [3]]);   // busiest day 80, not 85
    expect(partitionByMinutes([20, 20, 20, 20], 2)).toEqual([[0, 1], [2, 3]]);
    expect(partitionByMinutes([90, 10, 10, 10], 2)).toEqual([[0], [1, 2, 3]]);
    expect(partitionByMinutes([30, 30], 5)).toEqual([[0], [1]]);
    expect(partitionByMinutes([], 3)).toEqual([]);
  });
  it('4 days x 45 min with 4 lessons of 40-45 min: one per day, because two would not fit a day', () => {
    const o = dsOutline(['a', 'b', 'c', 'd'].map((k, i) => lesson(k, k.toUpperCase(), 'procedural', { estimated_minutes: i === 3 ? 45 : 40 })));
    const p = buildPlan({ goal: GOAL, outline: o, examMap: null, keep: ['a', 'b', 'c', 'd'], start: '2026-10-10' });
    expect(p.lessons.map(l => l.day)).toEqual(['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13']);
    expect(p.warnings).toContain('d is learned the day before the exam and gets no spaced review; move it earlier with --order if it matters.');
  });
});

describe('plan command', () => {
  it('writes crew/plan.json and plan.md; start defaults to today in the goal time zone', async () => {
    const dir = tempCourse();
    writeCourse(dir, { outline: OUTLINE });
    writeJson(coursePaths(dir).examMap, EXAM);
    // 2026-10-10T17:30Z is already 11 Oct in Kuala Lumpur (UTC+8)
    expect(planToday(new Date('2026-10-10T17:30:00Z'), 'Asia/Kuala_Lumpur')).toBe('2026-10-11');
    const data = await plan(fakeCtx(dir, new Date('2026-10-10T17:30:00Z')), { keep: KEEP, cut: { avl: 'Zero marks.' } });
    expect(data.lessons.map(l => l.day)).toEqual(['2026-10-11', '2026-10-11', '2026-10-12', '2026-10-13']);
    expect(data).toMatchObject({ capacity_min: 135, used_min: 80 });
    const saved = readJson<PlanResult>(coursePaths(dir).plan);
    expect(saved.assumptions).toEqual(GOAL.assumptions);
    const md = readFileSync(coursePaths(dir).planMd, 'utf8');
    for (const s of ['# Study plan: Data Structures: final exam prep', '## Assumptions', '## What the past paper weights', '## Kept, in study order',
      '## Cut, and why', '- **AVL rotations** (0% of marks): Zero marks.', '## Day by day', '### Wed 14 Oct: Exam 09:00', '## Review dates (counted back from the exam)'])
      expect(md).toContain(s);
    expect(md).toMatch(/### Sun 11 Oct · \d+ min\n\n- Learn: Hash tables \(20 min\)\n- Learn: Linear probing \(20 min\)/);
  });
});
