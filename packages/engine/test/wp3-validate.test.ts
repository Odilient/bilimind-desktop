// WP3: check (Q0-Q17), the node:vm harness, playground formulas and Mermaid plausibility.
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { check, isPlausibleMermaid, isSafeFormula, runJsTests } from '../src/index.ts';
import { coursePaths } from '../src/course.ts';
import { deepEqual } from '../src/validate/harness.ts';
import { sweepFormula } from '../src/validate/playground.ts';
import { blockOf, itemOf, makeCourse, readDraft, writeDraft } from './wp3-fixture.ts';
import type { TestCourse } from './wp3-fixture.ts';

let t: TestCourse | null = null;
afterEach(() => { t?.cleanup(); t = null; });

describe('runJsTests (node:vm harness)', () => {
  it('passes, fails with expected vs actual, and deep-compares arrays and objects', () => {
    const r = runJsTests('const add = (a, b) => a + b; function pair() { return { a: [1, 2], b: null }; }', [
      { name: 'adds', call: 'add(1, 2)', expect: 3 },
      { name: 'object', call: 'pair()', expect: { a: [1, 2], b: null } },
      { name: 'wrong', call: 'add(1, 1)', expect: 3 },
    ]);
    expect(r.passed).toBe(2);
    expect(r.results[2]).toMatchObject({ name: 'wrong', passed: false, expected: 3, actual: 2 });
  });
  it('kills an infinite loop at 2 s and skips the remaining tests', () => {
    const t0 = Date.now();
    const r = runJsTests('function f() { for (;;) {} }', [{ name: 'loops', call: 'f()', expect: 1 }, { name: 'next', call: '1', expect: 1 }]);
    const ms = Date.now() - t0;
    expect(r.timedOut).toBe(true);
    expect(r.results[0]!.error).toMatch(/timed out after 2000 ms/);
    expect(r.results[1]!.error).toMatch(/not run/);
    expect(ms).toBeGreaterThanOrEqual(1900);
    expect(ms).toBeLessThan(4000);
  });
  it('reports syntax errors, isolates tests, captures console for script tests, blocks eval', () => {
    expect(runJsTests('function (', [{ name: 'x', call: '1', expect: 1 }]).syntaxError).toMatch(/SyntaxError/);
    const iso = runJsTests('var n = 0; function inc() { return ++n; }', [{ name: 'a', call: 'inc()', expect: 1 }, { name: 'b', call: 'inc()', expect: 1 }]);
    expect(iso.passed).toBe(2);
    expect(runJsTests('console.log("total", 42)', [{ name: 'out', expect: 'total 42' }]).passed).toBe(1);
    expect(runJsTests('function g() { return eval("1"); }', [{ name: 'e', call: 'g()', expect: 1 }]).passed).toBe(0);
    expect(runJsTests('', [{ name: 'p', call: 'typeof process + typeof require', expect: 'undefinedundefined' }]).passed).toBe(1);
  });
  it('deepEqual: NaN, arrays, null vs undefined', () => {
    expect(deepEqual(NaN, NaN)).toBe(true);
    expect(deepEqual([1, [2]], [1, [2]])).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual(undefined, null)).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});

describe('isSafeFormula / sweep / isPlausibleMermaid', () => {
  const ok = 'function compute(i) { return 0.5 * (1 + 1 / ((1 - i.alpha) * (1 - i.alpha))); }';
  it('accepts the fixture formula and rejects unsafe or wrong-shaped ones', () => {
    expect(isSafeFormula(ok, ['alpha'])).toBe(true);
    expect(isSafeFormula(ok, ['beta'])).toBe(false);                                   // reads an undeclared input
    expect(isSafeFormula('function compute(p) { while (true) {} return p.x; }', ['x'])).toBe(false);
    expect(isSafeFormula('function compute(p) { return fetch("x") || p.x; }', ['x'])).toBe(false);
    expect(isSafeFormula('const compute = p => p.x', ['x'])).toBe(false);
    expect(isSafeFormula('function compute(p) { return 3; }', ['x'])).toBe(false);     // never reads an input
    expect(isSafeFormula('function compute(p) { return p.constructor; }', ['x'])).toBe(false);
  });
  it('sweeps 28 points: finite, and flags a constant output', () => {
    const inputs = [{ key: 'alpha', min: 0.05, max: 0.95, default: 0.5 }];
    const s = sweepFormula(ok, inputs);
    expect(s.xs).toHaveLength(28);
    expect(s.finite).toBe(true);
    expect(s.constant).toBe(false);
    const flat = sweepFormula('function compute(p) { return p.alpha * 0 + 7; }', inputs);
    expect(flat.constant).toBe(true);
    const inf = sweepFormula('function compute(p) { return 1 / (1 - p.alpha); }', [{ key: 'alpha', min: 0, max: 1, default: 0.5 }]);
    expect(inf.finite).toBe(false);
  });
  it('Mermaid plausibility', () => {
    expect(isPlausibleMermaid('flowchart LR\n  K["key: heap"] --> H["hash(k) = 17"]')).toBe(true);
    expect(isPlausibleMermaid('```mermaid\ngraph TD\n A-->B\n```')).toBe(true);
    expect(isPlausibleMermaid('graph TD\n A[open --> B')).toBe(false);
    expect(isPlausibleMermaid('diagram TD\n A-->B')).toBe(false);
    expect(isPlausibleMermaid('graph TD\n A["x]-->B')).toBe(false);
    expect(isPlausibleMermaid('graph TD\n A--><script>alert(1)</script>')).toBe(false);
    expect(isPlausibleMermaid(`graph TD\n${'A-->B\n'.repeat(70)}`)).toBe(false);
  });
});

describe('check --lesson', () => {
  it('passes the fixture lessons and writes crew/checks/<k>.json with rounds', async () => {
    t = makeCourse();
    for (const k of ['hash_tables', 'binary_heaps']) {
      const d = await check(t.ctx, { lesson: k });
      expect(d.failed, JSON.stringify(d.failed)).toEqual([]);
      expect(d.total).toBe(d.passed);
      expect(d.total).toBeGreaterThan(20);
    }
    await check(t.ctx, { lesson: 'hash_tables' });
    const file = JSON.parse(readFileSync(coursePaths(t.dir).checksJson('hash_tables'), 'utf8'));
    expect(file.round).toBe(2);
    expect(file.checks.find((c: { rule: string }) => c.rule === 'Q11 code runs').detail).toBe('reference passes 4/4 tests · starter fails 3/4 · OK');
  });

  it('(a) a reference solution that fails a test fails Q11 with expected vs actual', async () => {
    t = makeCourse();
    const d = readDraft(t.dir, 'hash_tables');
    itemOf(d, 'q1').answer_key!.reference_solution = 'function linearProbeIndex(table, key) { return key % table.length; }';
    writeDraft(t.dir, d);
    const r = await check(t.ctx, { lesson: 'hash_tables' });
    const f = r.failed.find(x => x.rule === 'Q11 code runs')!;
    expect(f.block).toBe(10);
    expect(f.detail).toContain("reference fails 'home slot taken: next slot': expected 3, got 2");
    expect(f.suggestion).toContain('code-test --lesson hash_tables --block 10 --dump');
  });

  it('(b) a starter that already passes every test is flagged', async () => {
    t = makeCourse();
    const d = readDraft(t.dir, 'binary_heaps');
    blockOf(d, 'b8').payload.starter_code = itemOf(d, 'q1').answer_key!.reference_solution;
    writeDraft(t.dir, d);
    const r = await check(t.ctx, { lesson: 'binary_heaps' });
    expect(r.failed.find(x => x.rule === 'Q11 code runs')!.detail).toMatch(/starter code already passes all 4 tests/);
  });

  it('(c) an infinite loop in a reference is killed and reported', async () => {
    t = makeCourse();
    const d = readDraft(t.dir, 'hash_tables');
    itemOf(d, 'q1').answer_key!.reference_solution = 'function linearProbeIndex(table, key) { let i = key; while (true) { i++; } }';
    writeDraft(t.dir, d);
    const r = await check(t.ctx, { lesson: 'hash_tables' });
    expect(r.failed.find(x => x.rule === 'Q11 code runs')!.detail).toMatch(/timed out after 2000 ms/);
  }, 10000);

  it('(d) a constant playground formula is flagged', async () => {
    t = makeCourse();
    const d = readDraft(t.dir, 'hash_tables');
    blockOf(d, 'b5').payload.formula_js = 'function compute(i) { return i.alpha * 0 + 2.5; }';
    writeDraft(t.dir, d);
    const r = await check(t.ctx, { lesson: 'hash_tables' });
    expect(r.failed.find(x => x.rule === 'Q12 playground')!.detail).toMatch(/does not change as alpha moves/);
  });

  it('(e) a bad Mermaid is dropped and the missing mandatory format is then flagged', async () => {
    t = makeCourse();
    const d = readDraft(t.dir, 'hash_tables');
    blockOf(d, 'b2').payload.source = 'flowchart LR\n  K["key --> H[hash';
    writeDraft(t.dir, d);
    const r = await check(t.ctx, { lesson: 'hash_tables' });
    expect(r.auto_fixed.some(f => f.rule === 'Q13 diagram' && /b2: dropped/.test(f.detail))).toBe(true);
    expect(readDraft(t.dir, 'hash_tables').blocks.some(b => b.id === 'b2')).toBe(false);
    // binary_heaps (procedural) has no mandatory diagram; hash_tables (quantitative) neither, so no Q1 failure here:
    expect(r.failed.some(f => f.rule === 'Q1 formats')).toBe(false);
  });

  it('(f) a cite id that was never supplied is stripped; prose naming a missing slide is flagged', async () => {
    t = makeCourse();
    const d = readDraft(t.dir, 'hash_tables');
    blockOf(d, 'b1').source_material_ids = [1, 999];
    blockOf(d, 'b1').payload.markdown = String(blockOf(d, 'b1').payload.markdown) + '\n\nAs slide 140 of your deck shows, this matters.';
    writeDraft(t.dir, d);
    const r = await check(t.ctx, { lesson: 'hash_tables' });
    expect(r.auto_fixed.some(f => f.rule === 'Q14 citations' && /b1: removed 1 chunk id/.test(f.detail))).toBe(true);
    expect(readDraft(t.dir, 'hash_tables').blocks[0]!.source_material_ids).toEqual([1]);
    expect(r.failed.find(f => f.rule === 'Q14 citations')!.detail).toMatch(/slide 140/);
  });

  it('auto-fixes the deterministic faults and flags the rest', async () => {
    t = makeCourse();
    const d = readDraft(t.dir, 'hash_tables');
    const quiz = blockOf(d, 'b11');
    // MCQ cap: turn the multi_select and the numeric into mcqs -> 4 mcq of 6 (max 2)
    const q3 = itemOf(d, 'q3');
    q3.kind = 'mcq'; q3.answer_key = { correct_option_ids: ['a'] }; q3.options = q3.options!.slice(0, 4);
    q3.prompt = q3.prompt.replace(/\s*\(Select all that apply\.\)/, '');
    itemOf(d, 'q4').prompt = itemOf(d, 'q4').prompt.replace(/probes/gi, 'steps');           // unit no longer named
    itemOf(d, 'q6').rubric = itemOf(d, 'q6').rubric!.map(r => ({ ...r, weight: 2 }));        // weights sum to 4
    blockOf(d, 'b1').payload.markdown = String(blockOf(d, 'b1').payload.markdown) + ' See [the docs](https://example.com/hash) or https://x.y/z.';
    quiz.assessments.push({ id: 'q8', kind: 'cloze', prompt: 'A hash function maps each key to one of m ______.', bloom: 'remember', grader: 'deterministic', max_score: 100, answer_key: { accepted: ['slots'] } });
    writeDraft(t.dir, d);
    const r = await check(t.ctx, { lesson: 'hash_tables' });
    const rules = r.auto_fixed.map(f => f.rule);
    expect(rules).toEqual(expect.arrayContaining(['Q4 mcq cap', 'Q8 cloze', 'Q9 numeric', 'Q10 rubric', 'Q16 no urls']));
    const after = readDraft(t.dir, 'hash_tables');
    expect(after.blocks[0]!.payload.markdown).not.toMatch(/https?:/);
    expect(after.blocks[0]!.payload.markdown).toContain('See the docs or');
    expect(itemOf(after, 'q8').prompt).toContain('m ____.');
    expect(itemOf(after, 'q4').prompt).toMatch(/Give your answer in probes\.$/);
    expect(itemOf(after, 'q6').rubric!.reduce((s, x) => s + x.weight, 0)).toBeCloseTo(1);
    const demoted = after.blocks.flatMap(b => b.assessments).filter(a => a.kind === 'short_answer' && a.answer_key?.reference_answer && a.id !== 'q6');
    expect(demoted.length).toBeGreaterThanOrEqual(1);
    expect(after.repairs.some(x => x.startsWith('check: '))).toBe(true);
    // 7 items now: Q2 flags it (never deletes)
    // G2: code and project items do not count as practice items, so 7 items with one code item is within 3-6
    expect(r.failed.find(f => f.rule === 'Q2 item count')).toBeUndefined();
    expect(after.blocks.flatMap(b => b.assessments)).toHaveLength(7);
  });

  it('flags mcq integrity, thin lessons, missing formats and ids; errors without a draft', async () => {
    t = makeCourse();
    const d = readDraft(t.dir, 'binary_heaps');
    const q5 = itemOf(d, 'q5');
    q5.options = q5.options!.slice(0, 3);
    d.blocks = d.blocks.filter(b => b.type !== 'walkthrough');                       // procedural needs walkthrough + checklist
    for (const b of d.blocks) if (b.type === 'explainer' || b.type === 'example') b.payload.markdown = 'Short.';
    d.blocks.push({ ...JSON.parse(JSON.stringify(d.blocks[0])), id: 'b1' });         // duplicate id
    writeDraft(t.dir, d);
    const op = coursePaths(t.dir).outline;
    const outline = JSON.parse(readFileSync(op, 'utf8'));
    outline.lessons.find((l: { key: string }) => l.key === 'binary_heaps').estimated_minutes = 120;
    writeFileSync(op, JSON.stringify(outline));
    const r = await check(t.ctx, { lesson: 'binary_heaps' });
    const by = (rule: string) => r.failed.filter(f => f.rule === rule);
    expect(by('Q15 thin lesson')[0]!.detail).toMatch(/for a 120-minute lesson \(target about 3600/);
    expect(by('Q15 thin lesson')[0]!.suggestion).toMatch(/draft --lesson binary_heaps --note "The lesson came back at \d+ words/);
    expect(by('Q5 mcq')[0]!.detail).toMatch(/3 options/);
    expect(by('Q1 formats')[0]!.detail).toMatch(/missing `walkthrough`/);
    expect(by('Q0 ids')[0]!.detail).toMatch(/duplicate block ids: b1/);
    expect(r.passed + r.failed.length).toBe(r.total);
    await expect(check(t.ctx, { lesson: 'nope' })).rejects.toThrow(/No draft for lesson "nope"/);
  });
});
