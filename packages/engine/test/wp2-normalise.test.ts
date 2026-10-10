// WP2 normaliser tests: BlockPayloadNormaliser aliases, item repairs, singleton rule, orphans, MCQ cap, strip code.
// Every normalised lesson must survive core fromSaasLesson + CourseLessonSchema (the player contract).
import { describe, expect, it } from 'vitest';
import { CourseLessonSchema, fromSaasLesson, payloadIssues } from '@bilimind/core';
import type { LessonContent } from '@bilimind/core';
import { normaliseLesson } from '../src/normalise/index.ts';
import { normalisePayload, plausibleMermaid, safeFormula } from '../src/normalise/blocks.ts';
import { normaliseItem } from '../src/normalise/assessment.ts';
import { sample } from './wp2-helpers.ts';

const ctx = { language: 'en' };
const opts = { key: 'l', allowsCode: true, suppliedChunkIds: [14, 15] };
const valid = (content: LessonContent) => {
  const r = CourseLessonSchema.safeParse(fromSaasLesson(content as never, { id: content.key, title: 'T', archetype: 'conceptual' }));
  return r.success ? [] : r.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
};
const quiz = (items: unknown[]) => ({ type: 'quiz', payload: {}, assessments: items });
const mcq = (prompt: string, correct = 'b') => ({ kind: 'mcq', prompt, bloom: 'apply', grader: 'deterministic',
  options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }, { id: 'd', text: 'D' }], answer_key: { correct_option_ids: [correct] } });
const short = (prompt: string, bloom = 'analyze') => ({ kind: 'short_answer', prompt, bloom, grader: 'llm_rubric',
  rubric: [{ criterion: 'Names the cost', weight: 2, excellent: 'e', acceptable: 'a', poor: 'p' }, { criterion: 'Gives a reason', weight: 2, excellent: 'e', acceptable: 'a', poor: 'p' }],
  answer_key: { reference_answer: 'r' } });

describe('engine-port samples (lesson-bst-*.json)', () => {
  it('noreason: the duplicate diagram is dropped; everything validates', () => {
    const { content, repairs } = normaliseLesson(sample('lesson-bst-noreason.json'), { ...opts, key: 'bst' });
    expect(content.blocks.filter(b => b.type === 'diagram')).toHaveLength(1);
    expect(repairs).toContain('dropped a second diagram (one per lesson)');
    expect(content.blocks.map(b => b.id)).toEqual(['b1', 'b2', 'b3', 'b4', 'b5']);
    expect(valid(content)).toEqual([]);
  });
  it('pinned: 2 mcq of 4 items -> the later one is demoted to short_answer with the option text as reference', () => {
    const raw = sample('lesson-bst-pinned.json');
    const { content, repairs } = normaliseLesson(raw, { ...opts, key: 'bst' });
    const items = content.blocks.flatMap(b => b.assessments);
    expect(items.map(a => a.kind)).toEqual(['mcq', 'short_answer', 'short_answer', 'essay']);
    expect(items.map(a => a.id)).toEqual(['q1', 'q2', 'q3', 'q4']);
    const orig = raw.blocks.at(-1).assessments[2];
    const correct = orig.options.find((o: { id: string }) => o.id === orig.answer_key.correct_option_ids[0]).text;
    expect(items[2]!.answer_key).toEqual({ reference_answer: correct });
    expect(items[2]!.options).toBeUndefined();
    expect(repairs.some(r => r.startsWith('demoted 1 of 2 mcq'))).toBe(true);
    expect(valid(content)).toEqual([]);
  });
  it('reasoning: clean lesson passes untouched', () => {
    const { content, repairs } = normaliseLesson(sample('lesson-bst-reasoning.json'), { ...opts, key: 'bst' });
    expect(repairs).toEqual([]);
    expect(content.blocks.map(b => b.type)).toEqual(['explainer', 'diagram', 'analogy', 'misconception', 'key_points', 'quiz']);
    expect(valid(content)).toEqual([]);
  });
  it('source_material_ids keep only supplied chunk ids', () => {
    const { content } = normaliseLesson(sample('lesson-bst-reasoning.json'), { ...opts, key: 'bst', suppliedChunkIds: [15] });
    expect(content.blocks[1]!.source_material_ids).toEqual([15]);
    expect(content.blocks[0]!.source_material_ids).toBeNull();
  });
});

describe('payload aliases (engine-port §4 table) fold into the core shapes', () => {
  const ok = (type: Parameters<typeof normalisePayload>[0], payload: unknown) => {
    const r = normalisePayload(type, payload, ctx);
    expect(r.payload, r.why).not.toBeNull();
    expect(payloadIssues(type, r.payload)).toEqual([]);
    return r.payload as Record<string, any>;
  };
  it('analogy, misconception, example', () => {
    expect(ok('analogy', { analogy_markdown: 'Like a phone book.', limits: 'Phone books do not rebalance.' })).toEqual({ markdown: 'Like a phone book.', breaks_down_when: 'Phone books do not rebalance.' });
    expect(normalisePayload('analogy', { markdown: 'x' }, ctx).payload).toBeNull();
    expect(ok('misconception', { misconception: 'm', grain_of_truth: 'g', correction_markdown: 'c', how_to_catch_it: 't' })).toEqual({ belief: 'm', why_it_seems_right: 'g', what_is_true: 'c', tell: 't' });
    expect(ok('example', { markdown: 'm' }).title).toBe('Worked example');
  });
  it('walkthrough: detail/verify aliases, renumbered, < 3 steps dropped', () => {
    const p = ok('walkthrough', { steps: [{ n: 4, detail: 'a', verify: 'v' }, { markdown: 'b' }, 'junk', { title: 'C', detail_markdown: 'c', warning: 'w' }] });
    expect(p.steps.map((s: { n: number }) => s.n)).toEqual([1, 2, 3]);
    expect(p.steps[0]).toEqual({ n: 1, title: 'Step 1', detail_markdown: 'a', check: 'v' });
    expect(p.steps[2].title).toBe('C');
    expect(normalisePayload('walkthrough', { steps: [{ detail: 'a' }, { detail: 'b' }] }, ctx).payload).toBeNull();
  });
  it('checklist accepts bare strings; title default', () => {
    const p = ok('checklist', { items: ['Heap property holds', { text: 'Array is complete', why: 'no gaps' }, 'Root is the min'] });
    expect(p.title).toBe('Before you move on');
    expect(p.items[0]).toEqual({ text: 'Heap property holds' });
  });
  it('comparison pads ragged rows; reference_table takes {column: value} rows', () => {
    const c = ok('comparison', { axes: ['Access', 'Insert front', 'Memory'], items: [{ name: 'Array', values: ['O(1)'], use_when: 'random access' }, { title: 'List', values: ['O(n)', 'O(1)', 'pointer', 'extra'] }] });
    expect(c.items[0]).toEqual({ name: 'Array', values: ['O(1)', '—', '—'], best_for: 'random access' });
    expect(c.items[1].values).toHaveLength(3);
    const t = ok('reference_table', { columns: ['Op', 'Cost'], rows: [{ Op: 'insert', Cost: 'O(log n)' }, ['peek', 'O(1)', 'extra'], ['', '']] });
    expect(t.rows).toEqual([['insert', 'O(log n)'], ['peek', 'O(1)']]);
    expect(t.title).toBe('Quick reference');
  });
  it('scenario: one correct per step, unknown next_id ends the path, aliases', () => {
    const p = ok('scenario', { setup: 'Your table is slow.', steps: [{ question: 'First check?', options: [
      { label: 'Load factor', outcome: 'alpha = 0.95', correct: true, next_id: 's9' }, { text: 'Restart', correct: true }] }], debrief: 'd' });
    expect(p.steps[0].options.map((o: { correct: boolean }) => o.correct)).toEqual([true, false]);
    expect(p.steps[0].options[0].next_id).toBeNull();
    expect(p.debrief_markdown).toBe('d');
  });
  it('worked example, timeline, flashcards', () => {
    expect(ok('worked_example', { problem: 'p', steps: [{ math: '1+1', why: 'add' }, { code: 'x', explanation: 'y' }] }).answer).toBe('x');
    expect(ok('timeline', { events: [{ year: 1962, event: 'AVL' }, { date: '1970', title: 'B-tree', description: 'disks' }, { when: '1978', title: 'Red-black' }] }).events[0]).toEqual({ when: '1962', title: 'AVL', detail: '' });
    expect(normalisePayload('flashcards', { cards: [{ front: 'a' }] }, ctx).payload).toBeNull();
  });
  it('playground: safe formula only, keys lower-cased, defaults derived', () => {
    const p = ok('playground', { inputs: [{ key: 'Alpha', label: 'Load factor', min: 0.1, max: 0.95 }], formula: 'function compute(i) { return 0.5 * (1 + 1 / (1 - i.Alpha)); }' });
    expect(p.inputs[0].key).toBe('alpha');
    expect(p.formula_js).toContain('i.alpha');
    expect(p.output_label).toBe('Result');
    expect(normalisePayload('playground', { inputs: [{ key: 'x' }], formula_js: 'function compute(i) { while(true){} return i.x; }' }, ctx).payload).toBeNull();
    expect(safeFormula('function compute(p) { return p.y; }', ['x'])).toBe(false);
    expect(safeFormula('(i) => i.x', ['x'])).toBe(false);
  });
  it('diagram: fences stripped, implausible mermaid dropped, alt text defaulted', () => {
    expect(ok('diagram', { mermaid: '```mermaid\ngraph TD\n  A["root"] --> B\n```', caption: 'c' })).toEqual({ format: 'mermaid', source: 'graph TD\n  A["root"] --> B', caption: 'c', alt_text: 'c' });
    expect(normalisePayload('diagram', { source: 'graph TD\n A[unbalanced --> B' }, ctx).payload).toBeNull();
    expect(plausibleMermaid('notadiagram\nA-->B')).toBe(false);
  });
  it('speaking/dialogue aliases and language default', () => {
    const s = ok('speaking', { phrases: ['Saya', { phrase: 'Makan', gloss: 'to eat', ipa: 'MAH-kahn' }], lang: 'ms' });
    expect(s.language).toBe('ms');
    expect(s.items[1]).toEqual({ text: 'Makan', translation: 'to eat', phonetic: 'MAH-kahn' });
    const d = ok('dialogue', { scenario: 'Hawker stall', objective: 'Order', tutor_role: 'vendor', opener: 'Nak makan apa?', useful_phrases: ['Saya nak'] });
    expect(d).toMatchObject({ ai_role: 'vendor', learner_role: 'you', goal: 'Order', opening_line: 'Nak makan apa?', hints: ['Saya nak'], language: 'en' });
  });
  it('code: javascript function mode only; tests need call + expect; names unique', () => {
    const p = ok('code', { language: 'JavaScript (ES6)', mode: 'function', starter_code: 'function f(){}', instructions_markdown: 'Write f',
      tests: [{ name: 't', call: 'f(1)', expect: 2 }, { name: 't', call: 'f(2)', expect: null }, { name: 'no expect', call: 'f(3)' }], hints: ['try a loop'] });
    expect(p.language).toBe('javascript');
    expect(p.tests.map((t: { name: string }) => t.name)).toEqual(['t', 't (2)']);
    expect(p.tests[1].expect).toBeNull();
    expect(normalisePayload('code', { language: 'python', instructions_markdown: 'x' }, ctx).why).toMatch(/python code block was dropped/);
    expect(normalisePayload('code', { language: 'rust', instructions_markdown: 'x' }, ctx).payload).toBeNull();
    expect(ok('code', { language: 'js', mode: 'debug', instructions_markdown: 'Fix it', tests: [] }).mode).toBe('function');   // debug without symptom
  });
});

describe('items (normaliseAssessment)', () => {
  it('mcq with two correct ids becomes multi_select; no valid id -> dropped', () => {
    expect(normaliseItem({ ...mcq('Which are O(1)?'), answer_key: { correct_option_ids: ['a', 'c'] } }).item!.kind).toBe('multi_select');
    expect(normaliseItem({ ...mcq('x?'), answer_key: { correct_option_ids: ['z'] } }).item).toBeNull();
    expect(normaliseItem({ ...mcq('x?'), answer_key: { correct_option_id: 'c' } }).item!.answer_key).toEqual({ correct_option_ids: ['c'] });
  });
  it('ordering needs a full permutation (aliases accepted)', () => {
    const o = { kind: 'ordering', prompt: 'Order the steps', bloom: 'apply', grader: 'deterministic', options: [{ id: 'a', text: '1' }, { id: 'b', text: '2' }, { id: 'c', text: '3' }] };
    expect(normaliseItem({ ...o, answer_key: { sequence: ['c', 'a', 'b'] } }).item!.answer_key).toEqual({ correct_order: ['c', 'a', 'b'] });
    expect(normaliseItem({ ...o, answer_key: { correct_order: ['c', 'a'] } }).item).toBeNull();
  });
  it('rubric weights normalise; llm_rubric without rubric -> self; deterministic short answer -> self', () => {
    const s = normaliseItem(short('Why does chaining tolerate alpha > 1?')).item!;
    expect(s.rubric!.map(r => r.weight)).toEqual([0.5, 0.5]);
    expect(s.grader).toBe('llm_rubric');
    expect(normaliseItem({ kind: 'essay', prompt: 'Discuss hashing', bloom: 'evaluate', grader: 'llm_rubric' }).item!.grader).toBe('self');
    expect(normaliseItem({ kind: 'Short Answer', prompt: 'Explain it', bloom: 'Analyze', grader: 'deterministic' }).item).toMatchObject({ kind: 'short_answer', grader: 'self', bloom: 'analyze' });
    expect(normaliseItem({ kind: 'numeric', prompt: 'How many probes?', bloom: 'apply', answer_key: { answer: '2.5', tolerance: 0.1 } }).item!.answer_key).toEqual({ value: 2.5, tolerance: 0.1 });
    expect(normaliseItem({ kind: 'cloze', prompt: 'A ____ maps keys', bloom: 'remember', answer_key: {} }).item).toBeNull();
  });
});

describe('lesson rules', () => {
  it('orphan items are re-homed into a trailing quiz; empty quiz dropped; disabled types dropped', () => {
    const { content, repairs } = normaliseLesson({ blocks: [
      { type: 'explainer', payload: { markdown: 'x' }, assessments: [short('Explain the cost of a resize.')] },
      { type: 'video', payload: { resource_ids: [1] } },
      { type: 'quiz', payload: {}, assessments: [] },
    ] }, opts);
    expect(content.blocks.map(b => `${b.id}:${b.type}`)).toEqual(['b1:explainer', 'b2:quiz']);
    expect(content.blocks[1]!.assessments.map(a => a.id)).toEqual(['q1']);
    expect(repairs).toEqual(expect.arrayContaining(['dropped a video block (that format is switched off)', 're-homed 1 question from narrative blocks into a quiz']));
    expect(valid(content)).toEqual([]);
  });
  it('code: item test names derived from the block; missing item synthesised; stripped when allows_code is false', () => {
    const code = { type: 'code', payload: { language: 'javascript', mode: 'function', starter_code: 'function rev(h) {\n  // TODO\n}', instructions_markdown: 'Reverse the list',
      tests: [{ name: 'empty', call: 'rev(null)', expect: null }, { name: 'one', call: 'rev(1)', expect: 1 }] },
      assessments: [{ kind: 'code', prompt: 'Reverse a list', bloom: 'apply', grader: 'deterministic', answer_key: { reference_solution: 'function rev(h){return h}' } }] };
    const a = normaliseLesson({ blocks: [code, quiz([mcq('Pick one')])] }, opts);
    expect(a.content.blocks[0]!.assessments[0]!.answer_key).toEqual({ reference_solution: 'function rev(h){return h}', tests: ['empty', 'one'] });
    expect(valid(a.content)).toEqual([]);
    const b = normaliseLesson({ blocks: [{ ...code, assessments: [] }] }, opts);
    expect(b.content.blocks[0]!.assessments[0]).toMatchObject({ kind: 'code', grader: 'deterministic', answer_key: { tests: ['empty', 'one'] } });
    expect(b.repairs[0]).toMatch(/added the missing code item/);
    const c = normaliseLesson({ blocks: [code, quiz([mcq('Pick one'), { ...a.content.blocks[0]!.assessments[0], kind: 'code' }])] }, { ...opts, allowsCode: false });
    expect(c.content.blocks.map(x => x.type)).toEqual(['quiz']);
    expect(c.content.blocks[0]!.assessments.map(x => x.kind)).toEqual(['mcq']);
    expect(c.repairs).toContain('stripped 2 code exercises (this is not a coding subject)');
  });
  it('MCQ cap: 3 mcq of 5 items -> 2 allowed, the last demoted', () => {
    const { content } = normaliseLesson({ blocks: [quiz([mcq('q one'), mcq('q two'), short('q three'), mcq('q four'), short('q five')])] }, opts);
    expect(content.blocks[0]!.assessments.map(a => a.kind)).toEqual(['mcq', 'mcq', 'short_answer', 'short_answer', 'short_answer']);
  });
  it('a project without its item gets a self-marked one, so the mandatory format survives', () => {
    const { content } = normaliseLesson({ blocks: [{ type: 'project', payload: { brief_markdown: 'Build a hash table', deliverables: ['code'] } }] }, opts);
    expect(content.blocks[0]!.assessments[0]).toMatchObject({ id: 'q1', kind: 'project', grader: 'self', bloom: 'create' });
    expect(valid(content)).toEqual([]);
  });
});
