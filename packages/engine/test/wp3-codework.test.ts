// WP3: code-test run / dump / apply / disable.
import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gradeCode } from '@bilimind/core';
import { check, codeTest } from '../src/index.ts';
import { coursePaths } from '../src/course.ts';
import { blockOf, itemOf, makeCourse, readDraft } from './wp3-fixture.ts';
import type { TestCourse } from './wp3-fixture.ts';

let t: TestCourse | null = null;
afterEach(() => { t?.cleanup(); t = null; });

describe('code-test', () => {
  it('run: reference passes all, starter fails some', async () => {
    t = makeCourse();
    const r = await codeTest(t.ctx, { lesson: 'hash_tables', mode: 'run' });
    expect(r.blocks).toEqual([{ block: 10, reference: { passed: 4, total: 4, failures: [] }, starter: { passed: 1, total: 4 } }]);
  });

  it('dump -> edit -> apply round-trips through crew/code/<k>-b<n>/', async () => {
    t = makeCourse();
    const dumped = await codeTest(t.ctx, { lesson: 'binary_heaps', block: 8, mode: 'dump' });
    expect(dumped.blocks[0]!.dir).toBe('crew/code/binary_heaps-b8');
    const dir = coursePaths(t.dir).codeDir('binary_heaps', 8);
    for (const f of ['instructions.md', 'starter.js', 'solution.js', 'tests.json']) expect(existsSync(join(dir, f)), f).toBe(true);
    const before = readDraft(t.dir, 'binary_heaps');
    expect(readFileSync(join(dir, 'solution.js'), 'utf8')).toBe(itemOf(before, 'q1').answer_key!.reference_solution);

    // the Coder breaks the solution, adds a test, apply -> the run report shows the failure
    const broken = 'function heapPush(heap, value) { heap.push(value); return heap; }';
    writeFileSync(join(dir, 'solution.js'), broken);
    const tests = JSON.parse(readFileSync(join(dir, 'tests.json'), 'utf8'));
    tests.push({ name: 'two inserts keep the minimum on top', call: 'heapPush(heapPush([4], 2), 3)', expect: [2, 4, 3] });
    writeFileSync(join(dir, 'tests.json'), JSON.stringify(tests, null, 2));
    const bad = await codeTest(t.ctx, { lesson: 'binary_heaps', block: 8, mode: 'apply' });
    expect(bad.blocks[0]!.reference.passed).toBeLessThan(5);
    expect(bad.blocks[0]!.reference.failures[0]).toMatchObject({ test: 'new minimum rises to the root', expected: [1, 2, 8, 5] });
    let d = readDraft(t.dir, 'binary_heaps');
    expect(itemOf(d, 'q1').answer_key!.reference_solution).toBe(broken);
    expect(itemOf(d, 'q1').answer_key!.tests).toHaveLength(5);
    expect((blockOf(d, 'b8').payload.tests as unknown[]).length).toBe(5);

    // ...then fixes it again: apply -> 5/5
    writeFileSync(join(dir, 'solution.js'), String(itemOf(before, 'q1').answer_key!.reference_solution));
    const good = await codeTest(t.ctx, { lesson: 'binary_heaps', block: 8, mode: 'apply' });
    expect(good.blocks[0]!.reference).toEqual({ passed: 5, total: 5, failures: [] });
    d = readDraft(t.dir, 'binary_heaps');
    expect(d.repairs.filter(x => x.startsWith('code-test: applied crew/code/binary_heaps-b8'))).toHaveLength(2);
    expect((await check(t.ctx, { lesson: 'binary_heaps' })).failed).toEqual([]);
  });

  it('apply refuses malformed tests.json and missing dumps', async () => {
    t = makeCourse();
    await expect(codeTest(t.ctx, { lesson: 'hash_tables', block: 10, mode: 'apply' })).rejects.toThrow(/Missing instructions.md/);
    await codeTest(t.ctx, { lesson: 'hash_tables', block: 10, mode: 'dump' });
    writeFileSync(join(coursePaths(t.dir).codeDir('hash_tables', 10), 'tests.json'), '[{"name": "a"}, {"name": "a"}]');
    await expect(codeTest(t.ctx, { lesson: 'hash_tables', block: 10, mode: 'apply' })).rejects.toThrow(/duplicate test names/);
    await expect(codeTest(t.ctx, { lesson: 'hash_tables', block: 3, mode: 'run' })).rejects.toThrow(/no code block b3/);
  });

  it('disable: tests emptied, grader self, key tests removed; core gradeCode says self; check passes', async () => {
    t = makeCourse();
    await expect(codeTest(t.ctx, { lesson: 'hash_tables', block: 10, mode: 'disable' })).rejects.toThrow(/--reason/);
    const r = await codeTest(t.ctx, { lesson: 'hash_tables', block: 10, mode: 'disable', reason: 'expected values contradict the slide' });
    expect(r.blocks[0]!.disabled).toBe(true);
    const d = readDraft(t.dir, 'hash_tables');
    expect(blockOf(d, 'b10').payload.tests).toEqual([]);
    const q1 = itemOf(d, 'q1');
    expect(q1.grader).toBe('self');
    expect(q1.answer_key!.tests).toBeUndefined();
    expect(gradeCode(q1 as unknown as Parameters<typeof gradeCode>[0], [], []).status).toBe('self');
    expect(d.repairs.at(-1)).toBe('code-test: disabled b10 (self-marked): expected values contradict the slide');
    const c = await check(t.ctx, { lesson: 'hash_tables' });
    expect(c.failed).toEqual([]);
  });
});
