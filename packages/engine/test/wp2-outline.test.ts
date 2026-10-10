// WP2 outline tests: golden runs on the engine-port samples with the model mocked, plus the GraphBuilder port.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { plannedBlockTypes, varietyViolation } from '@bilimind/core';
import type { OutlineResult } from '@bilimind/core';
import type { Ctx, LlmRequest } from '../src/contracts.ts';
import { coursePaths, readJson } from '../src/course.ts';
import { normaliseOutline, fixMarks } from '../src/normalise/outline.ts';
import { decideAllowsCode, outline } from '../src/outline.ts';
import { dsIngest, fakeCtx, sample, scriptedLlm, tempCourse, writeCourse } from './wp2-helpers.ts';

const llm = vi.hoisted(() => ({ impl: null as null | ((ctx: Ctx, req: LlmRequest) => Promise<unknown>) }));
vi.mock('../src/llm.ts', async orig => ({ ...(await orig<typeof import('../src/llm.ts')>()), callJson: (ctx: Ctx, req: LlmRequest) => llm.impl!(ctx, req) }));

function course() {
  const dir = tempCourse();
  writeCourse(dir, { ingest: dsIngest() });
  return { dir, ctx: fakeCtx(dir) };
}

describe('outline golden: outline-trees-heaps-noreason.json (fails the gate)', () => {
  const raw = sample('outline-trees-heaps-noreason.json');
  it('the sample violates the variety gate (procedural 6 of 11 = 55%)', () => {
    expect(varietyViolation(raw.nodes, { strictSmall: true })).toMatch(/^`procedural` was used on 6 of 11 nodes \(55%\), above the 40% ceiling/);
  });

  it('relabel pass fixes it; allows_code is decided in code; too many topics is reported', async () => {
    const { dir, ctx } = course();
    const s = scriptedLlm({ outline: [raw], relabel: [{ relabels: [
      { key: 'bst_deletion', archetype: 'diagnostic' }, { key: 'heapsort', archetype: 'Quantitative' }, { key: 'nope', archetype: 'factual' }] }] });
    llm.impl = s.fn as never;
    const data = await outline(ctx, {}) as Awaited<ReturnType<typeof outline>> & { warnings: string[] };
    expect(s.calls.map(c => [c.stage, c.reasoning])).toEqual([['outline', true], ['relabel', true]]);
    expect(s.calls[1]!.user).toContain('`procedural` was used on 6 of 11 nodes (55%)');
    expect(s.calls[0]!.system).toContain('You are drawing the SPINE: 5 to 8 topics');
    const out = readJson<OutlineResult & { warnings: string[] }>(coursePaths(dir).outline);
    expect(out.relabel_passes).toBe(1);
    expect(out.variety_violation).toBeNull();
    expect(out.lessons.find(l => l.key === 'heapsort')!.archetype).toBe('quantitative');
    expect(out.lessons.find(l => l.key === 'heapsort')!.planned_block_types).toEqual(['worked_example', 'playground', 'quiz']);
    expect(data.allows_code).toBe(true);                // the model said false; "Data Structures" is a coding subject
    expect(out.code_language).toBe('javascript');
    expect(data.warnings).toEqual(expect.arrayContaining([
      'allows_code set to true in code (the model said false)',
      '11 topics on the spine, above the 8 a compact course allows: cut some in `plan`',
    ]));
    expect(data.topics).toHaveLength(11);
    expect(data.topics[0]).toMatchObject({ key: 'tree_terminology_and_basics', kind_label: 'Facts', formats: ['flashcards', 'reference_table', 'quiz'], parent: null });
  });

  it('relabel that never fixes it: 2 passes, then the outline is ACCEPTED with the violation recorded', async () => {
    const { dir, ctx } = course();
    const s = scriptedLlm({ outline: [raw], relabel: [new Error('HTTP 500'), { relabels: [] }] });
    llm.impl = s.fn as never;
    const data = await outline(ctx, {}) as unknown as { warnings: string[] };
    expect(s.calls.filter(c => c.stage === 'relabel')).toHaveLength(2);
    const out = readJson<OutlineResult>(coursePaths(dir).outline);
    expect(out.relabel_passes).toBe(2);
    expect(out.variety_violation).toMatch(/procedural/);
    expect(data.warnings.some(w => w.startsWith('variety gate still fails after 2 relabel pass(es)'))).toBe(true);
    expect(ctx.lines.some(l => l.includes('relabel pass 1 failed'))).toBe(true);
  });
});

describe('outline golden: outline-trees-heaps-reasoning.json (passes after the marks fix)', () => {
  const raw = sample('outline-trees-heaps-reasoning.json');
  beforeEach(() => { llm.impl = null; });

  it('no relabel call, marks fixed, formats derived from archetypes, tree arranged', async () => {
    const { dir, ctx } = course();
    const s = scriptedLlm({ outline: [{ ...raw, nodes: raw.nodes.map((n: object) => ({ ...n, formats: ['explainer', 'quiz'] })) }] });
    llm.impl = s.fn as never;
    const data = await outline(ctx, {}) as unknown as { warnings: string[]; topics: { key: string; parent: string | null; formats: string[] }[] };
    expect(s.calls.map(c => c.stage)).toEqual(['outline']);
    const out = readJson<OutlineResult>(coursePaths(dir).outline);
    expect(out.variety_violation).toBeNull();
    expect(out.allows_code).toBe(true);
    const by = new Map(out.lessons.map(l => [l.key, l]));
    // two `recommended` siblings with no `alternative` are not options: marks removed; a lone pick keeps its badge
    expect(by.get('recursion_for_trees')!.mark).toBeUndefined();
    expect(by.get('array_representation_trees')!.mark).toBeUndefined();
    expect(by.get('heap_array_indexing_practice')!.mark).toBe('recommended');
    expect(data.warnings.some(w => w.startsWith('tree_terminology_traversals: 2 subtopics were all marked recommended'))).toBe(true);
    for (const l of out.lessons) expect(l.planned_block_types).toEqual(plannedBlockTypes(l.archetype));
    expect(by.get('recursion_for_trees')!.parent).toBe(by.get('tree_terminology_traversals')!.index);
    expect(by.get('binary_heap_operations')!.layer).toBe(3);
    expect(data.topics.find(t => t.key === 'visualizing_avl_rotations')!.parent).toBe('avl_trees_balancing');
    for (const l of out.lessons) expect(l.chunk_ids.length).toBeGreaterThan(0);
    expect(l0(out).status).toBe('stub');
  });
});
const l0 = (o: OutlineResult) => o.lessons[0]!;

describe('allows_code rule', () => {
  it('staff onboarding never; a coding subject always; otherwise the model', () => {
    expect(decideAllowsCode(true, 'staff', 'Boba Shop: Day One')).toBe(false);
    expect(decideAllowsCode(false, 'student', 'Trees and Heaps for Your Data Structures Final')).toBe(true);
    expect(decideAllowsCode(false, 'student', 'Bahasa Melayu Survival Kit')).toBe(false);
    expect(decideAllowsCode(true, 'student', 'Statistics')).toBe(true);
  });
  it('a staff course strips code even when the model says true', async () => {
    const dir = tempCourse();
    writeCourse(dir, { ingest: dsIngest(), goal: { audience: 'staff', topic: 'Boba shop', sentence: 'Train my new hire' } });
    llm.impl = scriptedLlm({ outline: [sample('outline-trees-heaps-reasoning.json')] }).fn as never;
    const data = await outline(fakeCtx(dir), {});
    expect(data.allows_code).toBe(false);
    expect(readJson<OutlineResult>(coursePaths(dir).outline).code_language).toBeNull();
  });
});

describe('GraphBuilder port (normaliseOutline)', () => {
  it('never fails on sloppy output', () => {
    const o = normaliseOutline({ course_title: '  DS  ', allows_code: 'yes', nodes: [
      'junk', { title: '' },
      { key: 'Intro Topic!', title: 'Intro', archetype: 'Procedural knowledge', track: 'core', estimated_minutes: 400, note: 'x'.repeat(241), section: 'Start' },
      { key: 'intro_topic', title: 'Duplicate key', archetype: 'nonsense', track: 'core', estimated_minutes: '2' },
      { key: 'orphan', title: 'Subtopic with no parent', track: 'subtopic', mark: 'recommended', group: 'G', section: 'never on a subtopic' },
      { key: 'child', title: 'Child', track: 'subtopic', branch_of: 'intro_topic', mark: 'alternative', note: 'never on a subtopic' },
      { key: 'grandchild', title: 'Grandchild', track: 'subtopic', branch_of: 'child' },
      { key: 'deep', title: 'Too deep', track: 'subtopic', branch_of: 'grandchild' },
      { key: 'self', title: 'Self parent', track: 'subtopic', branch_of: 'self' },
    ], further: [{ title: 'Next', after_key: 'intro_topic' }, { title: 'next' }, { title: 'Bad anchor', topic: 't', after_key: 'child' }] });
    const by = new Map(o.nodes.map(n => [n.key, n]));
    expect(o.allowsCode).toBe(false);                                     // only boolean true counts
    expect([...by.keys()]).toEqual(['intro_topic', 'child', 'grandchild', 'deep', 'intro_topic_2', 'orphan', 'self']);
    expect(by.get('intro_topic')).toMatchObject({ archetype: 'procedural', estimated_minutes: 240, section: 'Start', layer: 0, position: 0 });
    expect(by.get('intro_topic')!.note).toBeUndefined();                  // over-long note dropped, not cut
    expect(by.get('intro_topic_2')).toMatchObject({ archetype: 'conceptual', estimated_minutes: 5, layer: 1 });
    expect(by.get('orphan')).toMatchObject({ track: 'core' });           // a subtopic without branch_of goes on the spine
    expect(by.get('orphan')!.mark).toBeUndefined();
    expect(by.get('child')).toMatchObject({ branch_of: 'intro_topic', depth: 1, position: 1, mark: 'recommended' });   // marks fix: alt without rec
    expect(by.get('child')!.note).toBeUndefined();
    expect(by.get('grandchild')).toMatchObject({ branch_of: 'child', depth: 2 });
    expect(by.get('deep')).toMatchObject({ branch_of: 'intro_topic', depth: 1 });   // re-hung on the topic
    expect(by.get('self')).toMatchObject({ branch_of: 'orphan', depth: 1 });   // its own key: the nearest topic above
    expect(o.further).toEqual([{ title: 'Next', topic: 'Next', after_key: 'intro_topic' }, { title: 'Bad anchor', topic: 't' }]);
    expect(o.reattached).toBe(2);
  });
  it('every lesson a subtopic: the model order becomes the spine', () => {
    const o = normaliseOutline({ nodes: [{ title: 'A', track: 'subtopic', branch_of: 'b', mark: 'anytime' }, { key: 'b', title: 'B', track: 'subtopic', branch_of: 'a' }] });
    expect(o.nodes.map(n => [n.track, n.layer])).toEqual([['core', 0], ['core', 1]]);
    expect(o.nodes[0]!.mark).toBeUndefined();
  });
  it('fixMarks leaves a proper recommended/alternative set alone', () => {
    const ns = [{ key: 'a', track: 'subtopic' as const, branch_of: 't', mark: 'recommended' as const }, { key: 'b', track: 'subtopic' as const, branch_of: 't', mark: 'alternative' as const }];
    expect(fixMarks(ns)).toEqual([]);
  });
});
