// WP2 draft tests (model mocked): one expand call with the lesson's chunks + neighbours + derived formats; ids b1../q1..;
// --note becomes the steer; --only rewrites in place (keeps the id) or adds a missing block; higher-order repair;
// code stripped when allows_code is false; the result converts to a valid course lesson.
import { existsSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { CourseLessonSchema, fromSaasLesson } from '@bilimind/core';
import type { LessonContent, PlanResult } from '@bilimind/core';
import type { Ctx, LlmRequest } from '../src/contracts.ts';
import { coursePaths, writeJson } from '../src/course.ts';
import { draft, readLessonDraft } from '../src/draft.ts';
import { dsIngest, dsOutline, fakeCtx, lesson, sample, scriptedLlm, tempCourse, writeCourse } from './wp2-helpers.ts';

const llm = vi.hoisted(() => ({ impl: null as null | ((ctx: Ctx, req: LlmRequest) => Promise<unknown>) }));
vi.mock('../src/llm.ts', async orig => ({ ...(await orig<typeof import('../src/llm.ts')>()), callJson: (ctx: Ctx, req: LlmRequest) => llm.impl!(ctx, req) }));

function course(over: { allowsCode?: boolean } = {}) {
  const dir = tempCourse();
  writeCourse(dir, {
    ingest: dsIngest(),
    outline: dsOutline([
      lesson('hash_tables', 'How hash tables find a key', 'conceptual', { chunk_ids: [1, 2, 3, 6] }),
      lesson('bst', 'Binary search trees', 'conceptual', { chunk_ids: [4, 5], concept_key: 'ds.binary_search_tree' }),
      lesson('heaps', 'Binary heaps', 'procedural', { chunk_ids: [] }),
    ], { allows_code: over.allowsCode ?? true }),
  });
  return { dir, ctx: fakeCtx(dir) };
}
const valid = (c: LessonContent) => {
  const r = CourseLessonSchema.safeParse(fromSaasLesson(c as never, { id: c.key, title: 'T', archetype: 'conceptual' }));
  return r.success ? [] : r.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
};
// The model "cites" chunk ids 14/15 in the sample; remap them onto this course's BST chunks 4/5.
const bstLesson = (name: string) => JSON.parse(JSON.stringify(sample(name)).replace(/\b14\b/g, '4').replace(/\b15\b/g, '5'));

describe('draft --lesson (full draft)', () => {
  it('one expand call: chunks as material ids, neighbours, derived formats; normalised; ids; data counts', async () => {
    const { dir, ctx } = course();
    const s = scriptedLlm({ expand: [bstLesson('lesson-bst-pinned.json')] });
    llm.impl = s.fn as never;
    const data = await draft(ctx, { lesson: 'bst' }) as Awaited<ReturnType<typeof draft>> & { missing_formats: string[]; repairs: string[]; file: string };
    expect(s.calls.map(c => [c.stage, c.reasoning])).toEqual([['expand', false]]);
    const u = s.calls[0]!.user;
    expect(u).toContain('[material_id=4 · Lecture 3 · Binary search trees · Slide 1]');
    expect(u).not.toContain('material_id=6');                                 // past-paper chunks are never lesson sources
    expect(u).toContain('COMES IMMEDIATELY BEFORE THIS NODE (already taught — do not re-teach)\n- How hash tables find a key');
    expect(u).toContain('COMES AFTER THIS NODE (do not teach it here)\n- Binary heaps');
    expect(u).toContain('- MANDATORY FORMATS — every one of these MUST be a block in your reply: explainer, diagram, analogy');
    expect(u).toContain('- Deadline: 2026-10-14 09:00 — everything must be studiable before this date');
    expect(s.calls[0]!.system).toContain('You are the lesson writer for BiliMind.');
    expect(s.calls[0]!.schema).toBeTruthy();
    const saved = readLessonDraft(dir, 'bst');
    expect(saved.blocks.map(b => b.id)).toEqual(['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7']);
    expect(saved.blocks.flatMap(b => b.assessments).map(a => a.id)).toEqual(['q1', 'q2', 'q3', 'q4']);
    expect(saved.attempts).toBe(1);
    expect(saved.cost_usd).toBe(0.001);
    expect(saved.repairs.some(r => r.startsWith('demoted 1 of 2 mcq'))).toBe(true);
    expect(data).toMatchObject({ items: 4, code_blocks: 0, cites: 2, missing_formats: [], file: 'crew/lessons/bst.json' });
    expect(data.blocks).toEqual(['explainer', 'diagram', 'explainer', 'analogy', 'explainer', 'misconception', 'quiz']);
    expect(valid(saved)).toEqual([]);
  });

  it('--note is rendered as the Writer\'s steer; a re-draft counts attempts and cost', async () => {
    const { dir, ctx } = course();
    const s = scriptedLlm({ expand: [bstLesson('lesson-bst-reasoning.json'), bstLesson('lesson-bst-reasoning.json')] });
    llm.impl = s.fn as never;
    await draft(ctx, { lesson: 'bst' });
    await draft(ctx, { lesson: 'bst', note: 'Use the degenerate insert 10, 20, 30 from slide 2.' });
    expect(s.calls[1]!.user).toContain("LEARNER'S REWRITE INSTRUCTION — this version is a regeneration, and this is what they asked for\n\n\"Use the degenerate insert 10, 20, 30 from slide 2.\"");
    const saved = readLessonDraft(dir, 'bst');
    expect(saved.attempts).toBe(2);
    expect(saved.cost_usd).toBe(0.002);
    expect(saved.repairs[0]).toBe('re-drafted with the Writer\'s note: "Use the degenerate insert 10, 20, 30 from slide 2."');
  });

  it('missing mandatory formats are reported, not re-asked (the Writer decides)', async () => {
    const { ctx } = course();
    const raw = bstLesson('lesson-bst-reasoning.json');
    raw.blocks = raw.blocks.filter((b: { type: string }) => b.type !== 'analogy');
    const s = scriptedLlm({ expand: [raw] });
    llm.impl = s.fn as never;
    const data = await draft(ctx, { lesson: 'bst' }) as unknown as { missing_formats: string[] };
    expect(data.missing_formats).toEqual(['analogy']);
    expect(s.calls).toHaveLength(1);
  });

  it('all-recall items trigger ONE higher-order repair call; its items join the last container', async () => {
    const { dir, ctx } = course();
    const raw = bstLesson('lesson-bst-reasoning.json');
    const quiz = raw.blocks.find((b: { type: string }) => b.type === 'quiz');
    quiz.assessments = quiz.assessments.map((a: { bloom: string }) => ({ ...a, bloom: 'remember' }));
    const s = scriptedLlm({ expand: [raw], higher_order: [{ assessments: [
      { kind: 'short_answer', prompt: 'Your BST holds 1..5 inserted in order. What is its height and why does search slow down?', bloom: 'analyze', grader: 'self', answer_key: { reference_answer: '4' } },
      { kind: 'cloze', prompt: 'A ____ is recall', bloom: 'remember', grader: 'deterministic', answer_key: { accepted: ['x'] } }] }] });
    llm.impl = s.fn as never;
    await draft(ctx, { lesson: 'bst' });
    expect(s.calls.map(c => c.stage)).toEqual(['expand', 'higher_order']);
    expect(s.calls[1]!.user).toContain('WHAT THE LESSON ACTUALLY TEACHES\n## Explainer');
    const saved = readLessonDraft(dir, 'bst');
    const q = saved.blocks.find(b => b.type === 'quiz')!.assessments;
    expect(q.at(-1)).toMatchObject({ id: 'q5', bloom: 'analyze' });         // the recall one is not added
    expect(q).toHaveLength(5);
    expect(saved.cost_usd).toBe(0.002);
    expect(saved.repairs.some(r => r.startsWith('added 1 higher-order item'))).toBe(true);
  });

  it('a lesson with no stored chunk ids retrieves its own; unknown lesson fails with the keys', async () => {
    const { ctx } = course();
    const s = scriptedLlm({ expand: [bstLesson('lesson-bst-reasoning.json')] });
    llm.impl = s.fn as never;
    await draft(ctx, { lesson: 'heaps' });
    expect(s.calls[0]!.user).toContain('MATERIAL EXCERPTS');
    expect(s.calls[0]!.user).toContain('- MANDATORY FORMATS — every one of these MUST be a block in your reply: walkthrough, checklist');
    await expect(draft(ctx, { lesson: 'nope' })).rejects.toThrow(/No lesson "nope"/);
  });

  it('with a plan, neighbours are the kept lessons in plan order', async () => {
    const { dir, ctx } = course();
    writeJson(coursePaths(dir).plan, { lessons: [{ key: 'heaps', order: 1 }, { key: 'bst', order: 2 }] } as unknown as PlanResult);
    const s = scriptedLlm({ expand: [bstLesson('lesson-bst-reasoning.json')] });
    llm.impl = s.fn as never;
    await draft(ctx, { lesson: 'bst' });
    expect(s.calls[0]!.user).toContain('COMES IMMEDIATELY BEFORE THIS NODE (already taught — do not re-teach)\n- Binary heaps');
    expect(s.calls[0]!.user).not.toContain('COMES AFTER THIS NODE');
  });

  it('allows_code false: code exercises never reach the draft', async () => {
    const { dir, ctx } = course({ allowsCode: false });
    const raw = bstLesson('lesson-bst-reasoning.json');
    raw.blocks.splice(1, 0, { type: 'code', payload: { language: 'javascript', mode: 'function', starter_code: 'x', instructions_markdown: 'Do it',
      tests: [{ name: 't', call: 'f()', expect: 1 }] }, assessments: [{ kind: 'code', prompt: 'Write f', bloom: 'apply', grader: 'deterministic', answer_key: { reference_solution: 'function f(){return 1}' } }] });
    llm.impl = scriptedLlm({ expand: [raw] }).fn as never;
    const data = await draft(ctx, { lesson: 'bst' });
    expect(data.code_blocks).toBe(0);
    expect(readLessonDraft(dir, 'bst').repairs).toContain('stripped 1 code exercise (this is not a coding subject)');
  });
});

describe('draft --only <type>', () => {
  async function drafted() {
    const c = course();
    llm.impl = scriptedLlm({ expand: [bstLesson('lesson-bst-reasoning.json')] }).fn as never;
    await draft(c.ctx, { lesson: 'bst' });
    return c;
  }

  it('rewrites the existing block IN PLACE, keeping its id; other parts are summarised in the prompt', async () => {
    const { dir, ctx } = await drafted();
    const before = readLessonDraft(dir, 'bst');
    const s = scriptedLlm({ expand_block: [{ blocks: [{ type: 'diagram', payload: { source: 'graph TD\n  A["50"] --> B["30"]', alt_text: 'A small BST' }, source_material_ids: [5, 99] }] }] });
    llm.impl = s.fn as never;
    await draft(ctx, { lesson: 'bst', only: 'diagram', note: 'Draw the tree from slide 2' });
    expect(s.calls[0]!.stage).toBe('expand_block');
    expect(s.calls[0]!.user).toContain('THE PART TO REWRITE — a `diagram` block. This is what it says now:');
    expect(s.calls[0]!.user).toContain('THE OTHER PARTS OF THIS LESSON (already written — do not repeat them, do not return them)\n\n- explainer: ');
    expect(s.calls[0]!.user).toContain('"Draw the tree from slide 2"');
    const after = readLessonDraft(dir, 'bst');
    const d = after.blocks.find(b => b.type === 'diagram')!;
    expect(d.id).toBe(before.blocks.find(b => b.type === 'diagram')!.id);
    expect(d.payload).toMatchObject({ source: 'graph TD\n  A["50"] --> B["30"]' });
    expect(d.source_material_ids).toEqual([5]);
    expect(after.blocks.map(b => b.id)).toEqual(before.blocks.map(b => b.id));
    expect(after.attempts).toBe(2);
    expect(after.repairs.at(-1)).toBe('rewrote the diagram block (b2) with the Writer\'s note: "Draw the tree from slide 2"');
  });

  it('adds a MISSING block with the next free id before the quiz; a new quiz gets fresh item ids', async () => {
    const { dir, ctx } = await drafted();
    const s = scriptedLlm({
      expand_block: [
        { blocks: [{ type: 'walkthrough', payload: { steps: [{ detail: 'Compare with root' }, { detail: 'Go left if smaller' }, { detail: 'Insert at the empty spot' }] } }] },
        { blocks: [{ type: 'quiz', payload: {}, assessments: [{ kind: 'cloze', prompt: 'In-order traversal visits keys in ____ order.', bloom: 'remember', grader: 'deterministic', answer_key: { accepted: ['sorted'] } }] }] },
      ],
    });
    llm.impl = s.fn as never;
    await draft(ctx, { lesson: 'bst', only: 'walkthrough' });
    expect(s.calls[0]!.user).toContain('THE PART TO WRITE — a `walkthrough` block. The lesson does not have one yet');
    let after = readLessonDraft(dir, 'bst');
    expect(after.blocks.map(b => `${b.id}:${b.type}`).slice(-2)).toEqual(['b7:walkthrough', 'b6:quiz']);
    await draft(ctx, { lesson: 'bst', only: 'quiz' });
    after = readLessonDraft(dir, 'bst');
    expect(after.blocks.find(b => b.type === 'quiz')!.assessments.map(a => a.id)).toEqual(['q5']);   // never reuses q1..q4
    expect(valid(after)).toEqual([]);
  });

  it('refuses an --only before the first draft, a disabled type, and an unusable reply', async () => {
    const { ctx } = course();
    await expect(draft(ctx, { lesson: 'bst', only: 'diagram' })).rejects.toThrow(/No draft of bst yet/);
    const d = await drafted();
    await expect(draft(d.ctx, { lesson: 'bst', only: 'video' as never })).rejects.toThrow(/not a block type/);
    llm.impl = scriptedLlm({ expand_block: [{ blocks: [{ type: 'diagram', payload: { source: 'not mermaid' } }] }] }).fn as never;
    await expect(draft(d.ctx, { lesson: 'bst', only: 'diagram' })).rejects.toThrow(/no usable diagram block/);
    expect(existsSync(coursePaths(d.dir).lessonJson('bst'))).toBe(true);
  });
});
