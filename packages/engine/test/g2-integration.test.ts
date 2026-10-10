// G2 integration fixes: regressions found on the first live `run` over showcase/sources/ds-final.
import { describe, expect, it } from 'vitest';
import { chooseLessons } from '../src/run.ts';
import { quizCard, ankiCsv } from '../src/export/anki-csv.ts';
import { decodeJsonObject, repairStringEscapes } from '../src/llm.ts';
import { testCodeBlock } from '../src/validate/code.ts';
import { ruleCites } from '../src/validate/rules.ts';

const topic = (key: string, minutes: number, parent: string | null = null) => ({
  key, title: key, archetype: 'concept', kind_label: '', formats: [], minutes, track: parent ? 'subtopic' as const : 'core' as const, parent, thin: false,
});

describe('G2 fixes', () => {
  it('run: a topic missing from exam-map weights is a zero-mark topic (cut with the past-paper reason)', () => {
    const topics = [topic('heaps', 30), topic('bst', 30), topic('avl', 40)];   // G2: kept only while the days fit
    // exam-map data lists only topics that carry marks
    const weights = [{ key: 'heaps', title: 'heaps', marks: 70, share: 0.7, questions: [] }, { key: 'bst', title: 'bst', marks: 30, share: 0.3, questions: [] }];
    const { keep, cut } = chooseLessons(topics, weights, { deadline: '2026-10-13', minutes_per_day: 45, timezone: 'Asia/Kuala_Lumpur' },
      new Date('2026-10-10T02:00:00Z'), 6);
    expect(keep).toEqual(['heaps', 'bst']);
    expect(cut.avl).toMatch(/^No marks in the past paper/);
  });

  it('llm: repairStringEscapes fixes raw newlines/tabs and stray backslashes only inside strings', () => {
    const bad = '{"a": "x\n\ty", "b": "\\alpha", "c": "ok\\n"}\n';
    expect(JSON.parse(repairStringEscapes(bad))).toEqual({ a: 'x\n\ty', b: '\\alpha', c: 'ok\n' });
  });

  it('llm: decodeJsonObject repairs miscounted brackets (both live failure shapes), but not for a truncated reply', () => {
    // a missing "]" before the closing braces
    expect(decodeJsonObject('{"blocks":[{"payload":{"items":[{"a":1}}},{"type":"x"}]}'))
      .toEqual({ blocks: [{ payload: { items: [{ a: 1 }] } }, { type: 'x' }] });
    // one "}" too many before a sibling key
    expect(decodeJsonObject('{"blocks":[{"type":"quiz","assessments":[{"q":1}]},"source_material_ids":[5]},{"type":"x"}]}'))
      .toEqual({ blocks: [{ type: 'quiz', assessments: [{ q: 1 }], source_material_ids: [5] }, { type: 'x' }] });
    expect(decodeJsonObject('{"blocks":[{"payload":{"items":[{"a":1}}}', { brackets: false })).toBeNull();
    expect(decodeJsonObject('no json')).toBeNull();
  });

  it('check Q11: a starter that never finishes is flagged', () => {
    const block = { id: 'b4', type: 'code', source_material_ids: [], payload: {
      language: 'javascript', mode: 'function', starter_code: 'function f(n) { while (true) { /* TODO */ } }',
      tests: [{ name: 'one', call: 'f(1)', expect: 1 }, { name: 'two', call: 'f(2)', expect: 2 }] },
    assessments: [{ id: 'q1', kind: 'code', prompt: 'Write f', bloom: 'apply', grader: 'deterministic', max_score: 2,
      answer_key: { reference_solution: 'function f(n) { return n; }', tests: ['one', 'two'] } }] };
    const v = testCodeBlock(block as never, 300);
    expect(v.state).toBe('fail');
    expect(v.problems.join(' ')).toMatch(/starter never finishes/);
  });

  it('check Q14: a lesson that cites no chunk at all fails', () => {
    const cx = { key: 'heaps', archetype: null, minutes: null, timeoutMs: 2000, files: new Map(),
      chunks: new Map([[1, { id: 1, material_id: 1, title: 'L4', ordinal: 1, locator: 'Slide 1', page: 1, content: 'x' }]]) };
    const bare = { key: 'heaps', blocks: [{ type: 'explainer', payload: { markdown: 'Hi.' }, source_material_ids: [], assessments: [] }] };
    const rows = ruleCites(bare as never, cx as never);
    expect(rows.some(r => !r.ok && /cites a source chunk/.test(r.detail))).toBe(true);
    bare.blocks[0]!.source_material_ids = [1] as never;
    expect(ruleCites(bare as never, cx as never).every(r => r.ok)).toBe(true);
  });

  it('anki: a course without flashcards or cloze falls back to quiz items with short answers', () => {
    const mcq = { id: 'q1', kind: 'mcq', prompt: 'Pick one', bloom: 'remember', grader: 'deterministic', max_score: 1,
      options: [{ id: 'a', text: 'Right' }, { id: 'b', text: 'Wrong' }], answer_key: { correct_option_ids: ['a'] } };
    const essay = { id: 'q2', kind: 'essay', prompt: 'Discuss', bloom: 'evaluate', grader: 'self', max_score: 5 };
    expect(quizCard(mcq as never)).toEqual({ front: 'Pick one\na) Right\nb) Wrong', back: 'Right' });
    expect(quizCard(essay as never)).toBeNull();
    const course = { id: 'c', title: 'T', lessons: [{ id: 'l1', blocks: [{ type: 'quiz', payload: {}, assessments: [mcq, essay] }] }] };
    const csv = ankiCsv(course as never);
    expect(csv.split('\r\n').filter(l => l && !l.startsWith('#'))).toHaveLength(1);
  });
});
