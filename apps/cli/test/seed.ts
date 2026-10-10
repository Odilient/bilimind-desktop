// Test seeding from packages/core/fixtures/course-ds-mini.json (no LLM, no network):
// - writeSourceFolder(dir): the fixture's sample notes as Markdown files (+ LICENSE.md and STATUS.md, which init must skip)
// - seedCourse(dir): the crew/ files the agents would have produced (goal, ingest, outline, exam-map, plan, lesson drafts),
//   reverse-converted from the fixture course, so every deterministic command can run on real data.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plannedBlockTypes, reviewDatesBackwardsFromExam } from '@bilimind/core';
import type { Archetype, Assessment, Block, Chunk, ExamMap, Goal, IngestResult, Lesson, LessonContent, OutlineResult, PlanResult, SourceFile } from '@bilimind/core';

const here = dirname(fileURLToPath(import.meta.url));
export const FIXTURE = join(here, '..', '..', '..', 'packages', 'core', 'fixtures', 'course-ds-mini.json');

type Raw = Record<string, any>;
export const fixture = (): Raw => JSON.parse(readFileSync(FIXTURE, 'utf8'));

const mdName = (file: string) => file.replace(/^sources\//, '').replace(/\.[a-z]+$/i, '.md');
const write = (p: string, s: string) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, s); };
const writeJson = (p: string, v: unknown) => write(p, JSON.stringify(v, null, 2) + '\n');

interface CiteLike { file: string; locator: string; page?: number | null; quote: string; excerpt: string }

/** Every distinct cited excerpt of the fixture becomes one chunk (ids from 1, in reading order). */
function chunksOf(c: Raw): { files: SourceFile[]; chunks: Chunk[]; chunkOf: (cite: CiteLike) => number } {
  const files: SourceFile[] = (c.sources as Raw[]).map((s, i) => ({
    material_id: i + 1, name: mdName(s.file), path: `sources/${mdName(s.file)}`, title: s.title, kind: 'md', role: s.role,
    pages: s.pages, words: 0, scanned_pages: [],
  }));
  const byFile = new Map((c.sources as Raw[]).map((s, i) => [s.file as string, files[i]!]));
  const chunks: Chunk[] = [];
  const index = new Map<string, number>();
  const add = (cite: CiteLike): number => {
    const k = `${cite.file}|${cite.locator}|${cite.excerpt}`;
    const have = index.get(k);
    if (have) return have;
    const f = byFile.get(cite.file)!;
    const id = chunks.length + 1;
    chunks.push({ id, material_id: f.material_id, title: f.title, ordinal: chunks.filter(x => x.material_id === f.material_id).length,
      locator: cite.locator, page: cite.page ?? null, content: cite.excerpt });
    index.set(k, id);
    return id;
  };
  for (const l of c.lessons as Raw[]) for (const b of l.blocks as Raw[]) {
    for (const ct of b.cites ?? []) add(ct);
    for (const a of b.assessments ?? []) for (const ct of a.cites ?? []) add(ct);
  }
  for (const x of c.receipts?.excluded ?? []) if (x.cite) add(x.cite);
  for (const f of files) f.words = chunks.filter(ch => ch.material_id === f.material_id).reduce((s, ch) => s + ch.content.split(/\s+/).length, 0);
  return { files, chunks, chunkOf: add };
}

/** The sample notes as Markdown, one "## Page N" section per cited page. */
export function writeSourceFolder(dir: string): string[] {
  const c = fixture();
  const { files, chunks } = chunksOf(c);
  for (const f of files) {
    const pages = chunks.filter(ch => ch.material_id === f.material_id).sort((a, b) => (a.page ?? 0) - (b.page ?? 0));
    const body = pages.map(ch => `## ${ch.locator}\n\n${ch.content}\n`).join('\n');
    write(join(dir, f.name), `# ${f.title}\n\nSample document written for the BiliMind test fixture.\n\n${body}`);
  }
  write(join(dir, 'LICENSE.md'), '# License\n\nSample notes, CC BY 4.0. This file must never be ingested.\n');
  write(join(dir, 'STATUS.md'), '# Status\n\nBuilder notes. This file must never be ingested.\n');
  return files.map(f => f.name);
}

function toAssessment(a: Raw, chunkOf: (c: CiteLike) => number): Assessment {
  const { cites, verdict, ...rest } = a;
  const out: Raw = { ...rest, status: verdict ?? 'unchecked' };
  if (Array.isArray(cites) && cites.length) out.cite_chunk_ids = (cites as CiteLike[]).map(chunkOf);
  return out as Assessment;
}

/** Writes the crew/ workbench of a 2-lesson course (as if goal/ingest/outline/exam-map/plan/draft had run). */
export function seedCourse(course: string): { lessons: string[]; codeBlocks: Record<string, number[]> } {
  const c = fixture();
  const { files, chunks, chunkOf } = chunksOf(c);
  const crew = join(course, 'crew');
  writeSourceFolder(join(course, 'sources'));

  const goal: Goal = {
    sentence: c.goal.sentence, deadline: c.goal.deadline, exam_time: '09:00', exam_at: c.goal.exam_at, timezone: c.goal.timezone,
    minutes_per_day: c.goal.minutes_per_day, audience: c.goal.audience, language: 'en', code_language: 'javascript',
    assumptions: c.goal.assumptions, created_at: '2026-10-10T18:00:00+08:00',
  };
  writeJson(join(crew, 'goal.json'), goal);

  const digest = chunks.filter(ch => files[ch.material_id - 1]!.role !== 'past_paper').map(ch => `[${ch.locator}] ${ch.content}`).join('\n').slice(0, 6000);
  const ingest: IngestResult = { files, chunks, digest, thin_files: [] };
  writeJson(join(crew, 'ingest.json'), ingest);

  const lessonsById = new Map((c.lessons as Raw[]).map(l => [l.id as string, l]));
  const outlineLessons: Lesson[] = (c.path as Raw[]).map((p, i) => {
    const l = lessonsById.get(p.id);
    const ids = new Set<number>();
    for (const b of l?.blocks ?? []) for (const ct of b.cites ?? []) ids.add(chunkOf(ct));
    return {
      key: p.id, title: p.title, summary: p.summary ?? l?.summary ?? '', concept_key: p.id, section: p.section ?? undefined,
      track: 'core', archetype: p.archetype as Archetype, estimated_minutes: p.minutes,
      index: i, layer: 0, position: i, parent: null, planned_block_types: plannedBlockTypes(p.archetype as Archetype),
      chunk_ids: [...ids], thin: false, status: l ? 'ready' : 'stub',
    } as Lesson;
  });
  const outline: OutlineResult = { title: c.title, allows_code: true, code_language: 'javascript', lessons: outlineLessons,
    further: [], variety_violation: null, relabel_passes: 0 };
  writeJson(join(crew, 'outline.json'), outline);

  const paperChunk = chunks.find(ch => files[ch.material_id - 1]!.role === 'past_paper') ?? null;
  const examMap: ExamMap = {
    questions: (c.plan.weights as Raw[]).flatMap(w => (w.questions as string[]).map(q => ({
      id: q, number: q.replace(/^Q(\d+).*/, '$1'), part: q.match(/^Q\d+([a-z])$/)?.[1] ?? null, text: `${q} (${w.title})`,
      marks: Math.round(w.marks / Math.max(1, w.questions.length)), file: paperChunk ? files[paperChunk.material_id - 1]!.name : 'paper.md',
      locator: paperChunk?.locator ?? null, chunk_id: paperChunk?.id ?? null, matches: [{ key: w.key, score: 1, terms: [] }],
      assigned: w.key, assigned_by: 'auto' as const,
    }))),
    total_marks: 100,
    weights: c.plan.weights,
    unmatched: [],
  };
  writeJson(join(crew, 'exam-map.json'), examMap);

  const kept = (c.lessons as Raw[]).map(l => l.id as string);
  const plan: PlanResult = {
    goal: { deadline: goal.deadline, exam_at: goal.exam_at, minutes_per_day: goal.minutes_per_day, timezone: goal.timezone },
    start: c.plan.days[0].date, days: c.plan.days,
    lessons: (c.lessons as Raw[]).map((l, i) => ({ key: l.id, title: l.title, day: l.day, minutes: l.minutes,
      weight: (c.plan.weights as Raw[]).find(w => w.key === l.id)?.share ?? null, order: i + 1 })),
    cut: (c.plan.cut as Raw[]).map(x => ({ key: x.key, title: x.title, reason: x.reason, weight: (c.plan.weights as Raw[]).find(w => w.key === x.key)?.share ?? null })),
    capacity_min: c.plan.capacity_min, new_budget_min: Math.round(c.plan.capacity_min * 0.6), review_budget_min: Math.round(c.plan.capacity_min * 0.4),
    used_min: c.plan.used_min, reviews: (c.plan.days as Raw[]).reduce((s, d) => s + (d.reviews ?? 0), 0),
    review_dates: Object.fromEntries((c.lessons as Raw[]).map(l => [l.id, reviewDatesBackwardsFromExam(l.day, goal.exam_at)])),
    assumptions: goal.assumptions, warnings: c.plan.warnings ?? [],
  };
  writeJson(join(crew, 'plan.json'), plan);
  write(join(course, 'plan.md'), `# Plan\n\nSeeded from the fixture.\n`);

  const codeBlocks: Record<string, number[]> = {};
  for (const l of c.lessons as Raw[]) {
    const blocks: Block[] = (l.blocks as Raw[]).map(b => ({
      id: b.id, type: b.type, title: b.title ?? null, payload: b.payload,
      source_material_ids: [...new Set(((b.cites ?? []) as CiteLike[]).map(chunkOf))],
      assessments: ((b.assessments ?? []) as Raw[]).map(a => toAssessment(a, chunkOf)),
    }) as Block);
    // the rejected item the fixture's receipts list: back on the draft as 'contradicted', right before its rewrite
    for (const x of (c.receipts?.excluded ?? []) as Raw[]) {
      if (x.lesson !== l.id) continue;
      const quiz = blocks.find(b => b.assessments.some(a => a.id === x.replaced_by));
      if (!quiz) continue;
      const at = quiz.assessments.findIndex(a => a.id === x.replaced_by);
      quiz.assessments.splice(at, 0, {
        id: x.item, kind: 'mcq', prompt: x.prompt, bloom: 'understand', grader: 'deterministic',
        options: [{ id: 'a', text: 'True' }, { id: 'b', text: 'False' }], answer_key: { correct_option_ids: ['a'] }, max_score: 100,
        status: 'contradicted', quote: x.quote, reason: x.reason, cite_chunk_ids: x.cite ? [chunkOf(x.cite)] : [],
      });
      const rw = quiz.assessments.find(a => a.id === x.replaced_by)!;
      rw.replaces = x.item;
      rw.labels = [...new Set([...(rw.labels ?? []), 'rewritten' as const])];
    }
    const draft: LessonContent = { key: l.id, blocks, attempts: 1, cost_usd: 0, repairs: [] } as LessonContent;
    writeJson(join(crew, 'lessons', `${l.id}.json`), draft);
    codeBlocks[l.id] = blocks.filter(b => b.type === 'code').map(b => Number(String(b.id).slice(1)));
  }
  return { lessons: kept, codeBlocks };
}
