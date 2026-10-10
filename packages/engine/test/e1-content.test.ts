// E1 content-quality fixes (G2 review): nested citations hoisted, ingest ids accepted, slide mentions and items cited,
// uncited blocks backfilled, exam targets in the Writer prompt, multi_select counts, numeric working recomputed.
import { describe, expect, it, vi } from 'vitest';
import type { Chunk, LessonContent, SourceFile } from '@bilimind/core';
import type { Ctx, LlmRequest } from '../src/contracts.ts';
import { coursePaths, writeJson } from '../src/course.ts';
import { draft, readLessonDraft } from '../src/draft.ts';
import { normaliseItem, multiPrompt } from '../src/normalise/assessment.ts';
import { bestFor, doneFromTests, normalisePayload, quizIntro } from '../src/normalise/blocks.ts';
import { normaliseLessonDraft } from '../src/normalise/lesson.ts';
import { accuracyRules, expandSchema, expandUser, examTargets } from '../src/prompts/expand.ts';
import { fillSlideRange } from '../src/prompts/context.ts';
import { arithmeticSlips, evalArith, lastNumber, workProblems } from '../src/validate/arith.ts';
import { checkLesson } from '../src/validate/check.ts';
import { groundCites } from '../src/validate/fix.ts';
import { ruleCites, ruleItemCites, ruleMulti, ruleNumeric } from '../src/validate/rules.ts';
import type { CheckContext } from '../src/validate/rules.ts';
import { evidencePacket } from '../src/evidence.ts';
import { buildRewrittenItem, rewriteProblems, rewriteUser } from '../src/rewrite.ts';
import { dsIngest, dsOutline, fakeCtx, lesson, scriptedLlm, tempCourse, writeCourse } from './wp2-helpers.ts';

const llm = vi.hoisted(() => ({ impl: null as null | ((ctx: Ctx, req: LlmRequest) => Promise<unknown>) }));
vi.mock('../src/llm.ts', async orig => ({ ...(await orig<typeof import('../src/llm.ts')>()), callJson: (ctx: Ctx, req: LlmRequest) => llm.impl!(ctx, req) }));

// ---------- a small slide deck (L02, slides 1-9) + a BST deck + a past paper ----------
const FILES: SourceFile[] = [
  { material_id: 1, name: 'CSC2103-L02-hash-tables.pdf', path: 'sources/CSC2103-L02-hash-tables.pdf', title: 'Lecture 2 · Hash tables', kind: 'pdf', role: 'lecture', pages: 9, words: 900, scanned_pages: [], landscape: true },
  { material_id: 2, name: 'CSC2103-L03-bst.pdf', path: 'sources/CSC2103-L03-bst.pdf', title: 'Lecture 3 · BST', kind: 'pdf', role: 'lecture', pages: 3, words: 300, scanned_pages: [], landscape: true },
  { material_id: 3, name: 'past-paper.pdf', path: 'sources/past-paper.pdf', title: 'Past paper', kind: 'pdf', role: 'past_paper', pages: 1, words: 80, scanned_pages: [] },
];
const SLIDES = [
  'CSC2103 Data Structures | Lecture 2: Hash tables',
  'Learning outcomes: map keys to buckets; resolve collisions; choose a load factor.',
  'The dictionary ADT stores key value pairs. Operations: insert, search and delete by key.',
  'A hash function maps a key to a bucket index: h(k) = k mod m for a table of m buckets.',
  'Good hash functions spread keys uniformly; with m prime and h(k) = k mod m the remainders cover every bucket.',
  'Collisions happen when two keys hash to the same bucket index.',
  'Load factor alpha = n / m. Keep alpha between 0.6 and 0.75 for open addressing and between 1 and 3 for separate chaining.',
  'Average search is O(1) when alpha stays bounded; the worst case is O(n) when every key lands in one bucket.',
  'Separate chaining: each bucket holds a linked list and new entries go to the end of the chain.',
];
const chunk = (id: number, material_id: number, n: number, content: string): Chunk => ({
  id, material_id, title: FILES[material_id - 1]!.title, ordinal: n, locator: material_id === 3 ? `Page ${n}` : `Slide ${n}`, page: n, content,
});
const CHUNKS: Chunk[] = [
  ...SLIDES.map((t, i) => chunk(i + 1, 1, i + 1, t)),
  chunk(20, 2, 1, 'Binary search tree property: keys in the left subtree are smaller, keys in the right subtree are larger.'),
  chunk(21, 2, 2, 'AVL rotations rebalance a tree after an insert makes it lean by two levels.'),
  chunk(30, 3, 1, 'Question 2 (30 marks): Hashing\n(b) Insert 89, 18, 49, 58, 69 into a table of size 10 using linear probing. [10 marks]'),
];
const cx = (over: Partial<CheckContext> = {}): CheckContext => ({
  key: 'hash', archetype: null, minutes: null, timeoutMs: 2000,
  chunks: new Map(CHUNKS.map(c => [c.id, c])), files: new Map(FILES.map(f => [f.material_id, f])), ...over,
});
const mcq = (id: string, prompt: string, extra: Record<string, unknown> = {}) => ({
  id, kind: 'mcq', prompt, bloom: 'apply', grader: 'deterministic', max_score: 1,
  options: [{ id: 'a', text: 'O(1)' }, { id: 'b', text: 'O(n)' }, { id: 'c', text: 'O(log n)' }, { id: 'd', text: 'O(n log n)' }],
  answer_key: { correct_option_ids: ['a'] }, ...extra,
});
const lessonOf = (blocks: unknown[]): LessonContent => ({ key: 'hash', blocks: blocks as LessonContent['blocks'], attempts: 1, cost_usd: 0, repairs: [] });

describe('normaliser: nested citations and ingest ids', () => {
  it('hoists payload.source_material_ids / cite_chunk_ids / assessments to the block and keeps real ids outside the supplied list', () => {
    const raw = { blocks: [
      { type: 'explainer', payload: { markdown: 'Hashing maps keys to buckets.', source_material_ids: [4, 5] } },
      { type: 'quiz', payload: { intro: 'Try these.', cite_chunk_ids: [8], assessments: [mcq('x', 'What is the average search cost of a hash table?')] } },
      { type: 'example', payload: { markdown: 'h(89) = 89 mod 10 = 9.' }, source_material_ids: [7, 999] },
    ] };
    const { content, repairs } = normaliseLessonDraft(raw, { key: 'hash', allowsCode: false, suppliedChunkIds: [4, 5, 8], knownChunkIds: [4, 5, 7, 8] });
    expect(content.blocks.map(b => b.source_material_ids)).toEqual([[4, 5], [8], [7]]);
    expect(content.blocks[1]!.assessments).toHaveLength(1);
    expect(content.blocks[1]!.payload).not.toHaveProperty('assessments');
    expect(repairs.some(r => /moved source_material_ids out of a explainer payload/.test(r))).toBe(true);
    expect(repairs.some(r => /kept example citation 7/.test(r))).toBe(true);
  });
});

describe('arithmetic recompute (numeric `work`)', () => {
  it('evaluates plain arithmetic and finds the slips', () => {
    expect(evalArith('1/2(1 + 1/(1-0.75)^2)')).toBe(8.5);
    expect(evalArith('69 % 10')).toBe(9);
    expect(evalArith('3 +')).toBeNull();
    expect(arithmeticSlips('h(69) = 69 mod 10 = 9; slot 9 is empty; 1 probe')).toEqual([]);
    expect(arithmeticSlips('h(69) = 69 mod 10 = 5')).toEqual([{ expr: '69 % 10', said: 5, real: 9 }]);
    expect(arithmeticSlips('sum 3 + 4 + 5 + 2 + 29 = 47')[0]).toMatchObject({ said: 47, real: 43 });
    expect(arithmeticSlips('alpha = 9/11 = 0.82; parent (6-1)/2 = 2; 2i+1 = 7')).toEqual([]);   // rounded, floored, symbolic
    expect(arithmeticSlips('alpha = 9/11 = 0.9')).toHaveLength(1);
    expect(lastNumber('slots 0-8 are full; 2.5 probes (alpha = 0.5).')).toBe(2.5);
    expect(workProblems('69 mod 10 = 9; 1 probe', 5)).toEqual(['its working ends in 1 but the key says 5']);
    expect(workProblems(undefined, 5)).toEqual([]);
  });

  it('draft normaliser drops a numeric item whose working is wrong, keeps a right one with its working as the explanation', () => {
    const base = { kind: 'numeric', prompt: 'With m = 10 and linear probing, how many probes does inserting 69 take?', bloom: 'apply', grader: 'deterministic' };
    expect(normaliseItem({ ...base, answer_key: { value: 5, work: '69 mod 10 = 9; slot 9 is empty; 1 probe' } }).item).toBeNull();
    expect(normaliseItem({ ...base, answer_key: { value: 1, work: '69 mod 10 = 5; 1 probe' } }).why).toMatch(/69 % 10 = 5, but that is 9/);
    const ok = normaliseItem({ ...base, answer_key: { value: 1, work: '69 mod 10 = 9; slot 9 is empty; 1 probe' } }).item!;
    expect(ok.answer_key).toMatchObject({ value: 1, work: '69 mod 10 = 9; slot 9 is empty; 1 probe' });
    expect(ok.explanation).toBe('69 mod 10 = 9; slot 9 is empty; 1 probe');
    const why = normaliseItem({ ...mcq('q', 'What is the average search cost?'), explanation: 'A bounded load factor keeps chains short.' }).item!;
    expect(why.explanation).toBe('A bounded load factor keeps chains short.');
  });

  it('check Q9 recomputes stored working; no working is passed on to the Checker', () => {
    const item = { id: 'q1', kind: 'numeric', prompt: 'How many probes?', bloom: 'apply', grader: 'deterministic', max_score: 1,
      answer_key: { value: 5, work: '69 mod 10 = 5; 5 probes' } };
    const l = lessonOf([{ id: 'b1', type: 'quiz', payload: {}, source_material_ids: [4], assessments: [item] }]);
    const bad = ruleNumeric(l, cx());
    expect(bad[0]!.ok).toBe(false);
    expect(bad[0]!.detail).toBe('its working says 69 % 10 = 5, but that is 9');
    expect(bad[0]!.suggestion).toMatch(/rewrite-item --lesson hash --item q1/);
    item.answer_key = { value: 9, work: '69 mod 10 = 9' };
    expect(ruleNumeric(l, cx())[0]!.ok).toBe(true);
    item.answer_key = { value: 9 } as never;
    expect(ruleNumeric(l, cx())[0]!.detail).toMatch(/the Checker recomputes it/);
    const md = evidencePacket({ ingest: null, outline: null, chunks: cx().chunks!, files: cx().files, goalLanguage: null, shares: new Map() }, l).md;
    expect(md).toMatch(/\*\*Verify:\*\* no working was given/);
  });
});

describe('multi_select count', () => {
  it('normaliser and check drop a count that does not match the key; a matching count is kept', () => {
    expect(multiPrompt('Which two statements are true?', 3)).toBe('Which statements are true? (Select all that apply.)');
    expect(multiPrompt('Which two statements are true?', 2)).toBe('Which two statements are true?');
    const raw = { kind: 'multi_select', prompt: 'Which two statements about chaining are true?', bloom: 'understand', grader: 'deterministic',
      options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }, { id: 'd', text: 'D' }], answer_key: { correct_option_ids: ['a', 'b', 'd'] } };
    expect(normaliseItem(raw).item!.prompt).toBe('Which statements about chaining are true? (Select all that apply.)');
    const item = { ...raw, id: 'q1', max_score: 1 };
    const l = lessonOf([{ id: 'b1', type: 'quiz', payload: {}, source_material_ids: [9], assessments: [item] }]);
    expect(ruleMulti(l, cx())[0]!.detail).toMatch(/says "Which two" but 3 options are correct/);
    const { lesson: fixed, data } = checkLesson(l, cx());
    expect(fixed.blocks[0]!.assessments[0]!.prompt).toBe('Which statements about chaining are true? (Select all that apply.)');
    expect(data.failed.filter(f => f.rule.startsWith('Q6'))).toEqual([]);
    const two = lessonOf([{ id: 'b1', type: 'quiz', payload: {}, source_material_ids: [9], assessments: [{ ...item, answer_key: { correct_option_ids: ['a', 'b'] } }] }]);
    expect(ruleMulti(two, cx())[0]!.ok).toBe(true);
  });
});

describe('citations: Q14 / Q14b and the grounding repairs', () => {
  it('Q14 fails a lesson whose blocks cite nothing even when an item does; Q14b names the bare auto-marked items', () => {
    const l = lessonOf([
      { id: 'b1', type: 'explainer', payload: { markdown: 'Hi.' }, source_material_ids: [], assessments: [] },
      { id: 'b2', type: 'quiz', payload: {}, source_material_ids: null, assessments: [mcq('q1', 'Average cost?', { cite_chunk_ids: [8] }), mcq('q2', 'Worst cost?')] },
    ]);
    expect(ruleCites(l, cx()).some(r => !r.ok && /no block cites a source chunk \(only 1 question cite\)/.test(r.detail))).toBe(true);
    const q14b = ruleItemCites(l, cx());
    expect(q14b[0]).toMatchObject({ ok: false, rule: 'Q14b item citations' });
    expect(q14b[0]!.detail).toMatch(/^q2 cites no slide/);
  });

  it('prose "slide 7" cites slide 7; auto-marked items and uncited blocks get their best-matching chunk', () => {
    const l = lessonOf([
      { id: 'b1', type: 'explainer', source_material_ids: [4], assessments: [],
        payload: { markdown: 'Slide 7 gives the load factor range for each scheme, and slide 9 says new entries go to the end of the chain.' } },
      { id: 'b2', type: 'example', source_material_ids: [], assessments: [],
        payload: { markdown: 'Separate chaining in action: each bucket holds a linked list, and a new entry goes to the end of the chain of its bucket.' } },
      { id: 'b3', type: 'quiz', payload: {}, source_material_ids: [], assessments: [
        { id: 'q1', kind: 'numeric', prompt: 'A table has n = 9 keys in m = 12 buckets. What is the load factor alpha = n / m?', bloom: 'apply',
          grader: 'deterministic', max_score: 1, answer_key: { value: 0.75, tolerance: 0.01 } },
      ] },
    ]);
    const fixes = groundCites(l, cx({ supplied: [4, 7, 8, 9] }));
    expect(l.blocks[0]!.source_material_ids).toEqual([4, 7, 9]);
    expect(l.blocks[2]!.assessments[0]!.cite_chunk_ids).toEqual([7]);
    expect(l.blocks[1]!.source_material_ids).toContain(9);
    expect(l.blocks[2]!.source_material_ids).toEqual([7]);                 // the quiz cites its items' chunks
    expect(fixes.map(f => f.rule)).toEqual(expect.arrayContaining(['Q14 citations', 'Q14b item citations']));
    expect(ruleCites(l, cx()).every(r => r.ok)).toBe(true);
    expect(ruleItemCites(l, cx())[0]!.ok).toBe(true);
  });

  it('front-matter chunks (title, learning outcomes) are never cited', () => {
    const l = lessonOf([{ id: 'b1', type: 'explainer', source_material_ids: [1, 2, 4], assessments: [], payload: { markdown: 'Hashing.' } }]);
    checkLesson(l, cx());
    const { lesson: fixed } = checkLesson(l, cx());
    expect(fixed.blocks[0]!.source_material_ids).toEqual([4]);
  });
});

describe('Writer prompt: exam targets and accuracy rules', () => {
  it('lists the mapped past-paper parts as not citable, and the accuracy rules (conventions, work, explanation, idioms)', () => {
    const t = examTargets([{ id: 'Q2b', marks: 10, text: 'Hashing: Insert 89, 18, 49, 58, 69 using linear probing.' }])!;
    expect(t).toContain('EXAM TARGETS');
    expect(t).toContain('- Q2b [10 marks]: Hashing: Insert 89, 18, 49, 58, 69 using linear probing.');
    expect(t).toContain('NOT citable');
    expect(examTargets([])).toBeNull();
    const r = accuracyRules('javascript');
    for (const s of ["use the SLIDE's convention exactly", '`work` string', '`explanation`', 'misconception', 'no Python "//"', 'Items test DIFFERENT points'])
      expect(r).toContain(s);
    const schema = expandSchema().properties.blocks.items.properties.assessments.items as { properties: Record<string, { description?: string }> };
    expect(schema.properties.explanation).toBeTruthy();
    expect(schema.properties.answer_key!.description).toContain('work');
  });

  it('draft: exam targets reach the prompt; nested cites, wrong numeric keys and item cites are handled before check', async () => {
    const dir = tempCourse();
    writeCourse(dir, {
      ingest: { files: FILES, chunks: CHUNKS, digest: '', thin_files: [] },
      outline: dsOutline([
        lesson('hash', 'Hash tables: from key to bucket', 'quantitative', { chunk_ids: [4, 5, 7, 8], summary: 'You will be able to compute h(k) = k mod m and the load factor (slides 4 and 7).' }),
        lesson('bst', 'Binary search trees', 'conceptual', { chunk_ids: [20] }),
      ], { allows_code: false }),
    });
    writeJson(coursePaths(dir).examMap, { total_marks: 30, unmatched: [], weights: [{ key: 'hash', title: 'Hash', marks: 30, share: 1, questions: ['Q2b'] }],
      questions: [{ id: 'Q2b', number: '2', part: 'b', text: 'Hashing: Insert 89, 18, 49, 58, 69 into a table of size 10 using linear probing.', marks: 10,
        file: 'past-paper.pdf', locator: null, chunk_id: null, matches: [], assigned: 'hash', assigned_by: 'auto' }] });
    const reply = { blocks: [
      { type: 'explainer', payload: { markdown: 'A hash function turns a key into a bucket index: h(k) = k mod m. Slide 7 says how full the table may get before it should grow.', source_material_ids: [4] } },
      { type: 'worked_example', payload: { problem_markdown: 'Where does 89 go when m = 10?', steps: [{ expression: '89 mod 10 = 9', explanation: 'remainder' }, { expression: 'slot 9', explanation: 'empty, so it goes there' }], answer: 'slot 9' } },
      { type: 'quiz', payload: { intro: 'Three questions. Work them by hand.' }, assessments: [
        { kind: 'numeric', prompt: 'With m = 10, which slot does key 69 hash to?', bloom: 'apply', grader: 'deterministic', answer_key: { value: 5, work: '69 mod 10 = 9' } },
        { kind: 'numeric', prompt: 'A table holds n = 9 keys in m = 12 buckets. What is the load factor alpha = n / m?', bloom: 'apply', grader: 'deterministic',
          answer_key: { value: 0.75, tolerance: 0.01, work: '9 / 12 = 0.75' } },
        { kind: 'multi_select', prompt: 'Which two statements about hash tables are true?', bloom: 'understand', grader: 'deterministic',
          options: [{ id: 'a', text: 'Average search is O(1) when the load factor is bounded' }, { id: 'b', text: 'Worst-case search is O(n)' },
            { id: 'c', text: 'Search is always O(log n)' }, { id: 'd', text: 'Collisions happen when two keys hash to the same bucket' }],
          answer_key: { correct_option_ids: ['a', 'b', 'd'] }, explanation: 'Slides 6 and 8 state all three.' },
      ] },
    ] };
    const s = scriptedLlm({ expand: [reply] });
    llm.impl = s.fn as never;
    await draft(fakeCtx(dir), { lesson: 'hash' });
    const u = s.calls[0]!.user;
    expect(u).toContain("EXAM TARGETS — last year's paper asks these parts about this lesson");
    expect(u).toContain('- Q2b [10 marks]: Hashing: Insert 89, 18, 49, 58, 69');
    expect(u).toContain('ACCURACY RULES');
    expect(u).toMatch(/\[material_id=7 · Lecture 2 · Hash tables · Slide 7\]/);         // the summary's named slide is supplied
    expect(u).not.toContain('material_id=1 ');                                            // the title slide never is
    const saved = readLessonDraft(dir, 'hash');
    expect(saved.blocks[0]!.source_material_ids).toEqual(expect.arrayContaining([4, 7]));  // hoisted + "Slide 7" in the prose
    const items = saved.blocks.flatMap(b => b.assessments);
    expect(items.map(a => a.kind)).toEqual(['numeric', 'multi_select']);                  // the wrong 69-mod-10 key was dropped
    expect(items[1]!.prompt).toBe('Which statements about hash tables are true? (Select all that apply.)');
    expect(items[1]!.explanation).toBe('Slides 6 and 8 state all three.');
    expect(items.every(a => (a.cite_chunk_ids ?? []).length === 1)).toBe(true);           // backfilled item cites
    expect(saved.blocks.find(b => b.type === 'quiz')!.payload).toEqual({ intro: 'Work them by hand.' });
    expect(saved.repairs.some(r => /dropped an item: a numeric item was dropped/.test(r))).toBe(true);
  });
});

describe('payload normaliser details', () => {
  it('rebuilds "Done looks like" from the first test; lower-cases best_for; drops count sentences from a quiz intro', () => {
    expect(doneFromTests('Write it.\n\n**Done looks like:** insert 49 returns 2 at index 0.', [{ call: 'probe([49,58], 49)', expect: 4 }]))
      .toBe('Write it.\n\n**Done looks like:** `probe([49,58], 49)` returns `4`.');
    const code = normalisePayload('code', { language: 'javascript', mode: 'function', starter_code: 'function f(n) { return 0; }',
      instructions_markdown: 'Write f.\nDone looks like: f(2) gives 5.', tests: [{ name: 'two', call: 'f(2)', expect: 4 }] }, { language: 'en' }).payload!;
    expect(code.instructions_markdown).toBe('Write f.\n**Done looks like:** `f(2)` returns `4`.');
    expect(bestFor('You cannot predict n')).toBe('you cannot predict n');
    expect(bestFor('BST lookups')).toBe('BST lookups');
    expect(quizIntro('Four items. Two of them ask for a number. Work them by hand.')).toBe('Work them by hand.');
    expect(quizIntro('Three questions.')).toBeNull();
  });

  it('fillSlideRange fills holes in the lesson deck run, skipping slides a cut topic owns', () => {
    const pool = CHUNKS.filter(c => c.material_id !== 3 && c.id > 2);
    const picked = [3, 4, 8].map(id => pool.find(c => c.id === id)!);
    const outline = dsOutline([lesson('hash', 'Hash', 'conceptual', { chunk_ids: [3, 4, 8] }), lesson('cut', 'Cut topic', 'conceptual', { chunk_ids: [6] })]);
    const plan = { lessons: [{ key: 'hash' }] } as never;
    const got = fillSlideRange(picked, pool, { lesson: outline.lessons[0]!, outline, plan, cap: 12 });
    expect(got.map(c => c.id)).toEqual([3, 4, 5, 7, 8]);                                  // 6 belongs to the cut topic
  });
});

describe('rewrite-item', () => {
  it('lists the sibling questions; a numeric rewrite needs working that checks out', () => {
    const data = { ingest: null, outline: null, chunks: new Map(CHUNKS.map(c => [c.id, c])), files: new Map(FILES.map(f => [f.material_id, f])), goalLanguage: null, shares: new Map() };
    const old = mcq('q2', 'What is the worst-case search cost?') as never;
    const u = rewriteUser(data, old, 'The key is wrong.', [8], ['What is the average search cost?']);
    expect(u).toContain("## The lesson's other questions (do not duplicate or reword these)\n- What is the average search cost?");
    const bad = buildRewrittenItem({ kind: 'numeric', prompt: 'How many probes does inserting 69 take?', bloom: 'apply',
      answer_key: { value: 5, work: '69 mod 10 = 9; 1 probe' } }, old, 'q7');
    expect(rewriteProblems(bad).join(' ')).toMatch(/ends in 1 but the key says 5/);
    const good = buildRewrittenItem({ kind: 'numeric', prompt: 'How many probes does inserting 69 take?', bloom: 'apply',
      answer_key: { value: 1, work: '69 mod 10 = 9; 1 probe' } }, old, 'q7');
    expect(rewriteProblems(good)).toEqual([]);
    expect(good.explanation).toBe('69 mod 10 = 9; 1 probe');
  });
});

// keep the shared ds helper import used (WP2 fixture stays the reference ingest shape)
void dsIngest;
