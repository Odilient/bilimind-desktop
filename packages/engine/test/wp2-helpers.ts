// WP2 test helpers: a throwaway course folder with goal/ingest/outline written by hand (no model, no network),
// a fake ctx, and a scripted callJson for vi.mock('../src/llm.ts').
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plannedBlockTypes } from '@bilimind/core';
import type { Archetype, Chunk, Goal, IngestResult, Lesson, OutlineResult, SourceFile } from '@bilimind/core';
import type { Ctx, LlmRequest, LlmResult } from '../src/contracts.ts';
import { coursePaths, writeJson } from '../src/course.ts';

export const SAMPLES = fileURLToPath(new URL('../../../hackathon/research/engine-port-samples/', import.meta.url));
export const DS_FINAL = fileURLToPath(new URL('../../../showcase/sources/ds-final/', import.meta.url));
export const sample = (name: string): any => JSON.parse(readFileSync(join(SAMPLES, name), 'utf8'));

export function tempCourse(prefix = 'bm-wp2-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function fakeCtx(course: string, now = new Date('2026-10-11T02:00:00Z')): Ctx & { lines: string[] } {
  const lines: string[] = [];
  return { course, agent: 'Test', noCache: true, spend: { usd: 0, calls: 0 }, now: () => now, progress: l => { lines.push(l); }, lines };
}

export const GOAL: Goal = {
  sentence: 'My Data Structures final is Wednesday 9am. The slides and last year\'s paper are in this folder. I have 45 minutes a day. Get me ready.',
  topic: 'Data Structures', deadline: '2026-10-14', exam_time: '09:00', exam_at: '2026-10-14T09:00:00+08:00',
  timezone: 'Asia/Kuala_Lumpur', minutes_per_day: 45, audience: 'student', language: 'en', code_language: 'javascript',
  assumptions: ['The exam covers lectures 1-4.', 'No weekend study was ruled out.'], created_at: '2026-10-11T02:00:00Z',
};

/** A small lecture-deck ingest (two files + a past paper) with hand-written slide text. */
export function dsIngest(): IngestResult {
  const files: SourceFile[] = [
    { material_id: 1, name: 'L02-hash-tables.pdf', path: 'sources/L02-hash-tables.pdf', title: 'Lecture 2 · Hash tables', kind: 'pdf', role: 'lecture', pages: 3, words: 200, scanned_pages: [], landscape: true },
    { material_id: 2, name: 'L03-bst.pdf', path: 'sources/L03-bst.pdf', title: 'Lecture 3 · Binary search trees', kind: 'pdf', role: 'lecture', pages: 2, words: 150, scanned_pages: [], landscape: true },
    { material_id: 3, name: 'past-paper.pdf', path: 'sources/past-paper.pdf', title: 'Past paper', kind: 'pdf', role: 'past_paper', pages: 1, words: 80, scanned_pages: [] },
  ];
  const c = (id: number, material_id: number, n: number, content: string): Chunk => ({
    id, material_id, title: files[material_id - 1]!.title, ordinal: n, locator: material_id === 3 ? `Page ${n}` : `Slide ${n}`, page: n, content,
  });
  const chunks = [
    c(1, 1, 1, 'Hash tables map keys to slots with a hash function h(k) = k mod m. The load factor alpha = n / m measures how full the table is.'),
    c(2, 1, 2, 'Collisions: separate chaining keeps a linked list per slot; linear probing tries the next slot. Primary clustering slows linear probing as alpha grows.'),
    c(3, 1, 3, 'Resize: when alpha exceeds 0.75 the table doubles and every key is rehashed into the new array.'),
    c(4, 2, 1, 'Binary search tree: every key in the left subtree is smaller than the node, every key in the right subtree is larger. Search costs O(h).'),
    c(5, 2, 2, 'Insert 10, 20, 30, 40, 50 in order and the tree degenerates into a list of height 4. In-order traversal visits keys in sorted order.'),
    c(6, 3, 1, 'Question 1 (10 marks): Hashing\n(a) Define the load factor of a hash table. [4 marks]\n(b) Insert 18, 41, 22 with linear probing, m = 13. [6 marks]'),
  ];
  return { files, chunks, digest: '### Material #1 — "Lecture 2 · Hash tables" (slide deck)\n[Slide 1] Hash tables map keys to slots.', thin_files: [] };
}

export function lesson(key: string, title: string, archetype: Archetype, over: Partial<Lesson> = {}): Lesson {
  return {
    key, title, summary: `You will be able to work with ${title.toLowerCase()} by hand. Covers the core operations and their cost.`,
    concept_key: `ds.${key}`, track: 'core', archetype, estimated_minutes: 30, index: 0, layer: 0, position: 0, parent: null,
    planned_block_types: plannedBlockTypes(archetype), chunk_ids: [], thin: false, status: 'stub', ...over,
  };
}

export function dsOutline(lessons: Lesson[], over: Partial<OutlineResult> = {}): OutlineResult {
  let layer = -1;
  const fixed = lessons.map((l, index) => {
    if (l.track === 'core') layer++;
    return { ...l, index, layer: Math.max(0, layer) };
  });
  return { title: 'Data Structures: final exam prep', allows_code: true, code_language: 'javascript', lessons: fixed, further: [],
    variety_violation: null, relabel_passes: 0, ...over };
}

export function writeCourse(dir: string, parts: { goal?: Partial<Goal> | null; ingest?: IngestResult; outline?: OutlineResult }): void {
  const p = coursePaths(dir);
  if (parts.goal !== null) writeJson(p.goal, { ...GOAL, ...(parts.goal ?? {}) });
  if (parts.ingest) writeJson(p.ingest, parts.ingest);
  if (parts.outline) writeJson(p.outline, parts.outline);
}

/** A scripted callJson: each stage answers from its queue (or a function of the request); every request is recorded. */
export function scriptedLlm(answers: Partial<Record<LlmRequest['stage'], unknown[] | ((req: LlmRequest) => unknown)>>) {
  const calls: LlmRequest[] = [];
  const queues = new Map(Object.entries(answers).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v]));
  const fn = async <T>(_ctx: Ctx, req: LlmRequest): Promise<LlmResult<T>> => {
    calls.push(req);
    const q = queues.get(req.stage);
    let data: unknown;
    if (typeof q === 'function') data = q(req);
    else if (Array.isArray(q) && q.length) data = q.shift();
    else throw new Error(`no scripted answer for stage ${req.stage}`);
    if (data instanceof Error) throw data;
    return { data: structuredClone(data) as T, model: 'deepseek-flash', provider: 'deepseek', usage: { prompt_tokens: 1000, completion_tokens: 500 },
      cost_usd: 0.001, ms: 5, cached: false, attempts: 1 };
  };
  return { fn, calls };
}
