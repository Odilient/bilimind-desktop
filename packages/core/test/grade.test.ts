import { describe, expect, it } from 'vitest';
import {
  gradeCloze, gradeCode, gradeFromText, gradeItem, gradeMcq, gradeMultiSelect, gradeNumeric, gradeOrdering, gradeSelf,
  normaliseAnswer, parseNumber, passMark, rubricRatio,
} from '../src/index.ts';
import type { GradableItem } from '../src/index.ts';

const opts = (ids: string) => ids.split('').map(id => ({ id, text: `option ${id}` }));
const mcq: GradableItem = { kind: 'mcq', options: opts('abcd'), answer_key: { correct_option_ids: ['b'] }, max_score: 20 };
const multi: GradableItem = { kind: 'multi_select', options: opts('abcde'), answer_key: { correct_option_ids: ['a', 'c'] }, max_score: 100 };
const ord: GradableItem = { kind: 'ordering', options: opts('abcd'), answer_key: { correct_order: ['c', 'a', 'd', 'b'] }, max_score: 100 };
const num: GradableItem = { kind: 'numeric', answer_key: { value: 13.04, tolerance: 0.05, unit: 'A' }, max_score: 100 };
const cloze: GradableItem = { kind: 'cloze', answer_key: { accepted: ['load factor', "Don't panic"] }, max_score: 100 };

describe('policy', () => {
  it('pass mark is ceil(70%)', () => { expect(passMark(100)).toBe(70); expect(passMark(20)).toBe(14); expect(passMark(3)).toBe(3); });
});

describe('mcq', () => {
  it('exact id', () => {
    expect(gradeMcq(mcq, 'b')).toMatchObject({ score: 20, correct: true, passed: true });
    expect(gradeMcq(mcq, 'a')).toMatchObject({ score: 0, correct: false });
    expect(gradeMcq({ ...mcq, answer_key: {} }, 'b').status).toBe('pending');
  });
  it('accepts the scalar alias correct_option_id', () => {
    expect(gradeMcq({ kind: 'mcq', answer_key: { correct_option_id: 'c' } as never }, 'c').correct).toBe(true);
  });
});

describe('multi_select (Jaccard)', () => {
  it('full credit only for the exact set', () => expect(gradeMultiSelect(multi, ['a', 'c']).score).toBe(100));
  it('one of two right, nothing extra = 1/2', () => expect(gradeMultiSelect(multi, ['a']).ratio).toBeCloseTo(0.5));
  it('over-selecting costs: {a,c,e} vs {a,c} = 2/3', () => {
    const r = gradeMultiSelect(multi, ['a', 'c', 'e']);
    expect(r.ratio).toBeCloseTo(2 / 3);
    expect(r.score).toBe(67);
    expect(r.feedback).toMatch(/over-selecting/);
  });
  it('picking everything does not pay: 2/5', () => expect(gradeMultiSelect(multi, ['a', 'b', 'c', 'd', 'e']).ratio).toBeCloseTo(0.4));
});

describe('ordering (consecutive pairs x coverage)', () => {
  it('perfect order = full marks', () => expect(gradeOrdering(ord, ['c', 'a', 'd', 'b']).score).toBe(100));
  it('one adjacent swap: 2 of 3 pairs', () => {
    const r = gradeOrdering(ord, ['a', 'c', 'd', 'b']);   // ranks 1,0,2,3 -> pairs ok: (0,2),(2,3)
    expect(r.ratio).toBeCloseTo(2 / 3);
    expect(r.feedback).toMatch(/2 of the 3 consecutive pairs/);
  });
  it('reversed = 0', () => expect(gradeOrdering(ord, ['b', 'd', 'a', 'c']).score).toBe(0));
  it('missing items cap the score by coverage', () => {
    const r = gradeOrdering(ord, ['c', 'a', 'd']);          // 2/2 pairs x 3/4 coverage
    expect(r.ratio).toBeCloseTo(0.75);
    expect(r.correct).toBe(false);
  });
});

describe('numeric', () => {
  it('parses "13,04" and "13.04" as the same number', () => {
    expect(parseNumber('13,04')).toBe(13.04);
    expect(parseNumber('13.04')).toBe(13.04);
    expect(parseNumber('1.234,5')).toBe(1234.5);
    expect(parseNumber('1,234.5')).toBe(1234.5);
    expect(parseNumber('13.04 A')).toBe(13.04);
    expect(parseNumber('about -2e3 ohms')).toBe(-2000);
    expect(parseNumber('abc')).toBeNull();
  });
  it('within tolerance, with direction only', () => {
    expect(gradeNumeric(num, '13,04').correct).toBe(true);
    expect(gradeNumeric(num, '13.08').correct).toBe(true);
    const hi = gradeNumeric(num, '14');
    expect(hi).toMatchObject({ correct: false, direction: 'too_high' });
    expect(hi.feedback).not.toContain('13.04');
    expect(gradeNumeric(num, '12').direction).toBe('too_low');
    expect(gradeNumeric(num, 'banana').feedback).toMatch(/could not be read/);
  });
  it('float noise counts as exact when no tolerance is given', () => {
    expect(gradeNumeric({ kind: 'numeric', answer_key: { value: 0.3 } }, 0.1 + 0.2).correct).toBe(true);
  });
});

describe('cloze normalisation', () => {
  it('trim, casefold, punctuation to space, apostrophes dropped', () => {
    expect(normaliseAnswer('  Load-Factor! ')).toBe('load factor');
    expect(normaliseAnswer("don't")).toBe('dont');
    expect(normaliseAnswer('hello,world')).toBe('hello world');
    expect(normaliseAnswer('résumé')).toBe('résumé');   // no accent folding
  });
  it('grades against accepted', () => {
    expect(gradeCloze(cloze, 'LOAD   factor.').correct).toBe(true);
    expect(gradeCloze(cloze, 'dont panic').correct).toBe(true);
    expect(gradeCloze(cloze, 'loadfactor').correct).toBe(false);
    expect(gradeCloze(cloze, '').correct).toBe(false);
  });
  it('multi-blank keys grade positionally', () => {
    const two: GradableItem = { kind: 'cloze', answer_key: { blanks: [['heap'], ['log n', 'logn']] } as never };
    expect(gradeCloze(two, ['Heap', 'log n']).correct).toBe(true);
    expect(gradeCloze(two, ['heap', 'n']).ratio).toBeCloseTo(0.5);
  });
});

describe('code', () => {
  it('score = passed declared names / declared names', () => {
    const r = gradeCode({ kind: 'code', max_score: 100 }, ['t1', 't3', 'not-declared'], ['t1', 't2', 't3', 't4']);
    expect(r.ratio).toBe(0.5);
    expect(r.feedback).toMatch(/"t2", "t4"/);
    expect(gradeCode({ kind: 'code' }, ['t1'], ['t1']).correct).toBe(true);
    expect(gradeCode({ kind: 'code' }, [], ['t1'], true).feedback).toMatch(/time limit/);
  });
});

describe('self-marked and entry points', () => {
  it('rubric ratio and self grade', () => {
    const rows = [{ weight: 0.4 }, { weight: 0.6 }];
    expect(rubricRatio(rows, ['excellent', 'poor'])).toBeCloseTo(0.4);
    expect(rubricRatio(rows, ['acceptable', 'excellent'])).toBeCloseTo(0.84);
    expect(gradeSelf({ kind: 'essay' }, 0.84)).toMatchObject({ status: 'self', score: 84, passed: true });
    expect(gradeSelf({ kind: 'essay' }, null).status).toBe('self');
  });
  it('gradeItem dispatches by kind', () => {
    expect(gradeItem(mcq, { kind: 'mcq', option_id: 'b' }).correct).toBe(true);
    expect(gradeItem(ord, { kind: 'ordering', order: ['c', 'a', 'd', 'b'] }).correct).toBe(true);
  });
  it('gradeFromText parses one-line replies', () => {
    expect(gradeFromText(mcq, ' B ').correct).toBe(true);
    expect(gradeFromText(mcq, 'option b').correct).toBe(true);
    expect(gradeFromText(multi, 'a, c').correct).toBe(true);
    expect(gradeFromText(ord, 'c a d b').correct).toBe(true);
    expect(gradeFromText(num, '13,04').correct).toBe(true);
    expect(gradeFromText({ kind: 'short_answer' }, 'because').status).toBe('pending');
  });
});
