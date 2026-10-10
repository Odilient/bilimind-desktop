// WP3 test fixture: a throwaway course folder built from packages/core/fixtures/course-ds-mini.json.
// Every distinct cite (file + locator) becomes an ingest chunk; course blocks become draft blocks whose
// source_material_ids are those chunk ids; item cites become cite_chunk_ids; item verdicts become draft statuses.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plannedBlockTypes } from '@bilimind/core';
import type { Archetype, Assessment, Block, Chunk, IngestResult, LessonContent, OutlineResult, SourceFile } from '@bilimind/core';
import { coursePaths, writeJson } from '../src/course.ts';
import type { Ctx } from '../src/contracts.ts';

type Raw = Record<string, any>;
export const FIXTURE: Raw = JSON.parse(readFileSync(fileURLToPath(new URL('../../core/fixtures/course-ds-mini.json', import.meta.url)), 'utf8'));

export interface TestCourse { dir: string; ctx: Ctx; chunks: Chunk[]; lines: string[]; cleanup: () => void }

export function makeCourse(opts: { copies?: boolean } = {}): TestCourse {
  const dir = mkdtempSync(join(tmpdir(), 'bm-wp3-'));
  const files: SourceFile[] = (FIXTURE.sources as Raw[]).map((s, i) => ({
    material_id: i + 1, name: String(s.file).replace(/^sources\//, ''), path: s.file, title: s.title, kind: s.kind, role: s.role,
    pages: s.pages, words: 0, scanned_pages: [],
  }));
  const fileId = (file: string) => files.find(f => f.path === file)!.material_id;
  const chunks: Chunk[] = [];
  const chunkFor = (c: Raw): number => {
    const found = chunks.find(x => x.material_id === fileId(c.file) && x.locator === c.locator);
    if (found) return found.id;
    const id = chunks.length + 1;
    chunks.push({ id, material_id: fileId(c.file), title: files[fileId(c.file) - 1]!.title, ordinal: id, locator: c.locator, page: c.page ?? null, content: c.excerpt });
    return id;
  };
  const drafts: LessonContent[] = (FIXTURE.lessons as Raw[]).map(l => ({
    key: l.id, attempts: 1, cost_usd: 0, repairs: [],
    blocks: (l.blocks as Raw[]).map((b): Block => ({
      id: b.id, type: b.type, title: b.title ?? null, payload: JSON.parse(JSON.stringify(b.payload)),
      source_material_ids: ((b.cites ?? []) as Raw[]).map(chunkFor),
      assessments: ((b.assessments ?? []) as Raw[]).map((a): Assessment => {
        const { cites, verdict, labels, ...rest } = a;
        const item: Assessment = { ...(rest as Assessment) };
        if (verdict) item.status = verdict;
        const keep = ((labels ?? []) as string[]).filter(x => x === 'rewritten') as Assessment['labels'];
        if (keep && keep.length) item.labels = keep;
        if (verdict === 'not_covered') item.labels = [...(item.labels ?? []), 'beyond_slides'];
        if (cites?.length) item.cite_chunk_ids = (cites as Raw[]).map(chunkFor);
        return item;
      }),
    })),
  }));
  if (opts.copies) {
    for (const d of [...drafts]) drafts.push({ ...JSON.parse(JSON.stringify(d)), key: `${d.key}_copy` });
  }
  const p = coursePaths(dir);
  const ingest: IngestResult = { files, chunks, digest: '', thin_files: [] };
  writeJson(p.ingest, ingest);
  const lessonMeta = (key: string) => (FIXTURE.lessons as Raw[]).find(l => key.startsWith(l.id))!;
  const outline: OutlineResult = {
    title: FIXTURE.title, allows_code: true, code_language: 'javascript', further: [], variety_violation: null, relabel_passes: 0,
    lessons: drafts.map((d, i) => {
      const m = lessonMeta(d.key);
      return {
        key: d.key, title: m.title, summary: m.summary, concept_key: d.key, track: 'core', archetype: m.archetype as Archetype,
        estimated_minutes: m.minutes, index: i, layer: 0, position: i, parent: null,
        planned_block_types: plannedBlockTypes(m.archetype), chunk_ids: [...new Set(d.blocks.flatMap(b => b.source_material_ids ?? []))],
        thin: false, status: 'ready',
      };
    }),
  };
  writeJson(p.outline, outline);
  writeJson(p.goal, { sentence: 'test', language: 'en' });
  for (const d of drafts) writeJson(p.lessonJson(d.key), d);
  const lines: string[] = [];
  const ctx: Ctx = {
    course: dir, agent: 'Test', noCache: true, spend: { usd: 0, calls: 0 },
    now: () => new Date('2026-10-11T01:00:00Z'), progress: l => { lines.push(l); },
  };
  return { dir, ctx, chunks, lines, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

export const readDraft = (dir: string, key: string): LessonContent => JSON.parse(readFileSync(coursePaths(dir).lessonJson(key), 'utf8'));
export const writeDraft = (dir: string, d: LessonContent) => writeJson(coursePaths(dir).lessonJson(d.key), d);
export const blockOf = (d: LessonContent, id: string) => d.blocks.find(b => b.id === id)!;
export const itemOf = (d: LessonContent, id: string) => d.blocks.flatMap(b => b.assessments).find(a => a.id === id)!;
