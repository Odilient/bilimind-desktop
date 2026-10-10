// Turns core's course-ds-mini.json back into a crew/ workbench (ingest, outline, exam-map, plan, goal, lesson drafts
// with chunk ids, verdict status, a rejected item, log.jsonl) so WP4's narrate/review/export/build run on it.
// Used by WP4 tests and `node packages/engine/test/helpers/fixture-crew.ts <dir>` (a ready course folder for demos).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plannedBlockTypes, reviewDatesBackwardsFromExam } from '@bilimind/core';
import type { Chunk, Cite, Course, ExamMap, Goal, IngestResult, LessonContent, LogEvent, OutlineResult, PlanResult, SourceFile } from '@bilimind/core';

const HERE = dirname(fileURLToPath(import.meta.url));
export const FIXTURE_PATH = resolve(HERE, '..', '..', '..', 'core', 'fixtures', 'course-ds-mini.json');
export const loadFixture = (): Course => JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Course;

const write = (p: string, v: unknown) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, typeof v === 'string' ? v : JSON.stringify(v, null, 2)); };

/** Writes <dir>/{sources, crew/...}; returns the course folder. */
export function makeFixtureCrew(dir: string, opts: { log?: boolean } = {}): string {
  const c = loadFixture();
  const root = resolve(dir);
  const files: SourceFile[] = c.sources.map((s, i) => ({
    material_id: i + 1, name: s.file.replace(/^sources\//, ''), path: s.file, title: s.title, kind: s.kind, role: s.role,
    pages: s.pages, words: 1200, scanned_pages: [],
  }));
  for (const f of files) write(join(root, f.path), '%PDF-1.4\n% placeholder for the fixture\n');
  write(join(root, 'sources', 'LICENSE.md'), '# Fixture sources\n\n| File | What | Licence |\n|---|---|---|\n| `sample-lecture-04-hashing.pdf` | notes | Sample document |\n\n## Attribution\n\nSample notes written by the BiliMind team for the fixture.\n');

  // one chunk per distinct cite (file + locator + excerpt)
  const chunks: Chunk[] = [];
  const chunkOf = (cite: Cite): number => {
    const mat = files.find(f => f.path === cite.file)!.material_id;
    const hit = chunks.find(ch => ch.material_id === mat && ch.locator === cite.locator && ch.content === cite.excerpt);
    if (hit) return hit.id;
    const id = chunks.length + 1;
    chunks.push({ id, material_id: mat, title: files[mat - 1]!.title, ordinal: id, locator: cite.locator, page: cite.page ?? null, content: cite.excerpt });
    return id;
  };

  const drafts: LessonContent[] = c.lessons.map(l => ({
    key: l.id, attempts: 1, cost_usd: 0.001, repairs: [],
    blocks: l.blocks.map(b => ({
      id: b.id, type: b.type, title: b.title ?? null, payload: b.payload as Record<string, unknown>,
      source_material_ids: b.cites.map(chunkOf),
      assessments: b.assessments.map(a => {
        const { verdict, cites, ...rest } = a as typeof a & { verdict?: string };
        return {
          ...(rest as unknown as LessonContent['blocks'][number]['assessments'][number]),
          ...(verdict ? { status: verdict as 'supported' } : {}),
          ...(cites?.length ? { cite_chunk_ids: cites.map(chunkOf), quote: cites[0]!.quote } : {}),
        };
      }),
    })),
  }));
  // the rejected item goes back into its draft, before the item that replaced it
  for (const x of c.receipts.excluded) {
    const d = drafts.find(dd => dd.key === x.lesson)!;
    for (const b of d.blocks) {
      const at = b.assessments.findIndex(a => a.id === x.replaced_by);
      if (at < 0) continue;
      b.assessments[at] = { ...b.assessments[at]!, replaces: x.item, labels: [...(b.assessments[at]!.labels ?? []), 'rewritten'] };
      b.assessments.splice(at, 0, {
        id: x.item, kind: 'mcq', prompt: x.prompt, bloom: 'understand', grader: 'deterministic', max_score: 100,
        options: [{ id: 'a', text: 'True' }, { id: 'b', text: 'False' }], answer_key: { correct_option_ids: ['a'] },
        status: 'contradicted', reason: x.reason, quote: x.quote, ...(x.cite ? { cite_chunk_ids: [chunkOf(x.cite)] } : {}),
      });
    }
  }
  for (const d of drafts) write(join(root, 'crew', 'lessons', `${d.key}.json`), d);

  const ingest: IngestResult = { files, chunks, digest: chunks.map(ch => `[${ch.locator}] ${ch.content}`).join('\n').slice(0, 6000), thin_files: [] };
  write(join(root, 'crew', 'ingest.json'), ingest);

  const outline: OutlineResult = {
    title: c.title, allows_code: c.allows_code, code_language: c.code_language, further: c.further, variety_violation: null, relabel_passes: 0,
    lessons: [],
  };
  let index = 0;
  for (const t of c.path) {
    const parentIndex = index;
    outline.lessons.push({
      key: t.id, title: t.title, summary: t.summary ?? '', concept_key: t.id, section: t.section ?? undefined, note: t.note ?? undefined,
      track: 'core', archetype: t.archetype, estimated_minutes: t.minutes, index: index++, layer: 0, position: parentIndex, parent: null,
      planned_block_types: plannedBlockTypes(t.archetype), chunk_ids: [], thin: false, status: 'ready',
    });
    for (const it of t.items) {
      outline.lessons.push({
        key: it.id, title: it.title, summary: '', concept_key: it.id, track: 'subtopic', branch_of: t.id, mark: it.mark ?? undefined, group: it.group ?? undefined,
        archetype: t.archetype, estimated_minutes: it.minutes || 10, index: index++, layer: 1, position: 0, parent: parentIndex,
        planned_block_types: plannedBlockTypes(t.archetype), chunk_ids: [], thin: false, status: 'ready',
      });
    }
  }
  write(join(root, 'crew', 'outline.json'), outline);

  const examMap: ExamMap = { questions: [], total_marks: 100, weights: c.plan.weights, unmatched: [] };
  write(join(root, 'crew', 'exam-map.json'), examMap);

  const goal: Goal = {
    sentence: c.goal.sentence, topic: 'Data Structures', deadline: c.goal.deadline, exam_time: '09:00', exam_at: c.goal.exam_at,
    timezone: 'Asia/Kuala_Lumpur', minutes_per_day: c.goal.minutes_per_day, audience: c.goal.audience, language: 'en',
    code_language: 'javascript', assumptions: c.goal.assumptions, created_at: '2026-10-10T13:31:02.000Z',
  };
  write(join(root, 'crew', 'goal.json'), goal);

  const plan: PlanResult = {
    goal: { deadline: goal.deadline, exam_at: goal.exam_at, minutes_per_day: goal.minutes_per_day, timezone: goal.timezone },
    start: c.plan.days[0]!.date, days: c.plan.days,
    lessons: c.lessons.map((l, i) => ({ key: l.id, title: l.title, day: l.day!, minutes: l.minutes, weight: c.plan.weights.find(w => w.key === l.id)?.share ?? null, order: i })),
    cut: c.plan.cut.map(x => ({ ...x, weight: c.plan.weights.find(w => w.key === x.key)?.share ?? null })),
    capacity_min: c.plan.capacity_min, new_budget_min: 81, review_budget_min: 54, used_min: c.plan.used_min, reviews: 3,
    review_dates: Object.fromEntries(c.lessons.map(l => [l.id, reviewDatesBackwardsFromExam(l.day!, goal.exam_at)])),
    assumptions: goal.assumptions, warnings: [],
  };
  write(join(root, 'crew', 'plan.json'), plan);
  write(join(root, 'plan.md'), `# Plan: ${c.title}\n\nFixture plan.\n`);

  if (opts.log !== false) write(join(root, 'crew', 'log.jsonl'), fixtureLog().map(e => JSON.stringify(e)).join('\n') + '\n');
  return root;
}

/** A plausible crew log: two check rounds (3 failures repaired), a Coder fix, verdicts, a rewrite, notes. */
export function fixtureLog(): LogEvent[] {
  const t0 = Date.parse('2026-10-10T13:31:00.000Z');
  let t = t0;
  const ev = (agent: string, cmd: string, ms: number, data: Record<string, unknown> | undefined, result: string, extra: Partial<LogEvent> = {}): LogEvent => {
    t += ms + 1000;
    return { ts: new Date(t).toISOString(), agent, cmd, ok: true, result, ms, cost_usd: 0, ...(data ? { data } : {}), ...extra };
  };
  const fail = (rule: string, block: number) => ({ rule, block, item: null, detail: `${rule} failed`, suggestion: 'fix it' });
  return [
    ev('Lead', 'goal', 40, { goal: {} }, 'Exam Wed 14 Oct 09:00, 45 min/day, 3 assumptions'),
    ev('Lead', 'ingest', 900, { files: [], chunks: 14, thin_files: [] }, '3 files, 47 pages; quiz-1 is the past paper'),
    ev('Lead', 'outline', 21000, undefined, '4 topics', { cost_usd: 0.0012 }),
    ev('Lead', 'exam-map', 300, undefined, 'hashing 35%, heaps 30%'),
    ev('Lead', 'plan', 80, undefined, 'kept 2, cut 2'),
    ev('Lead', 'note', 5, undefined, '', { args: 'Cut AVL rotations: 0 marks last year.' }),
    ev('Writer · Hash tables', 'draft', 30000, { blocks: [], items: 6, code_blocks: 1, cites: 12 }, '11 blocks, 6 questions', { lesson: 'hash_tables', cost_usd: 0.0011 }),
    ev('Writer · Binary heaps', 'draft', 32000, { blocks: [], items: 6, code_blocks: 1, cites: 10 }, '14 blocks, 6 questions', { lesson: 'binary_heaps', cost_usd: 0.0012 }),
    ev('Writer · Hash tables', 'check', 400, { total: 17, passed: 15, failed: [fail('mandatory_format', 4), fail('mcq_cap', 11)], auto_fixed: [] }, '15/17 checks', { lesson: 'hash_tables' }),
    ev('Writer · Binary heaps', 'check', 400, { total: 17, passed: 16, failed: [fail('citation', 2)], auto_fixed: [] }, '16/17 checks', { lesson: 'binary_heaps' }),
    ev('Writer · Hash tables', 'draft', 9000, { blocks: [], items: 6, code_blocks: 1, cites: 12 }, 'added worked_example', { lesson: 'hash_tables', cost_usd: 0.0004 }),
    ev('Writer · Hash tables', 'check', 400, { total: 17, passed: 17, failed: [], auto_fixed: [] }, '17/17 checks', { lesson: 'hash_tables' }),
    ev('Writer · Binary heaps', 'check', 400, { total: 17, passed: 17, failed: [], auto_fixed: [] }, '17/17 checks', { lesson: 'binary_heaps' }),
    ev('Coder', 'code-test', 2100, { blocks: [{ block: 10, reference: { passed: 3, total: 4, failures: [{ test: 'wraps', expected: 0, actual: 7 }] }, starter: { passed: 0, total: 4 } }] }, 'reference 3/4', { lesson: 'hash_tables' }),
    ev('Coder', 'code-test', 1800, { blocks: [{ block: 10, reference: { passed: 4, total: 4, failures: [] }, starter: { passed: 1, total: 4 } }] }, 'reference 4/4 after fix', { lesson: 'hash_tables' }),
    ev('Coder', 'code-test', 1700, { blocks: [{ block: 8, reference: { passed: 4, total: 4, failures: [] }, starter: { passed: 0, total: 4 } }] }, 'reference 4/4', { lesson: 'binary_heaps' }),
    ev('Checker', 'evidence', 50, { items: 6, packet: 'crew/evidence/hash_tables.md' }, '6 packets', { lesson: 'hash_tables' }),
    ev('Checker', 'verdict', 60, { applied: 6, refused: [], excluded: 1, labelled: 1 }, '4 supported, 1 contradicted, 1 not covered', { lesson: 'hash_tables' }),
    ev('Checker', 'rewrite-item', 4000, { item: {}, status: 'pending' }, 'q7 replaces q5', { lesson: 'hash_tables', cost_usd: 0.0002 }),
    ev('Checker', 'verdict', 60, { applied: 1, refused: [], excluded: 0, labelled: 0 }, 'q7 supported', { lesson: 'hash_tables' }),
    ev('Checker', 'verdict', 60, { applied: 5, refused: [{ item: 'q5', why: 'not verbatim' }], excluded: 0, labelled: 0 }, '5 supported', { lesson: 'binary_heaps' }),
    ev('Lead', 'narrate', 18000, { clips: 9, minutes: 8.2, failed: [] }, '9 clips, 8.2 min'),
  ];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = makeFixtureCrew(process.argv[2] ?? join(process.cwd(), 'bilimind-out', 'ds-final-fixture'));
  console.log(out);
}
