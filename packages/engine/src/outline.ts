// `outline`: one call (reasoning on), GraphBuilder normalisation, variety gate (core varietyViolation, strictSmall)
// + relabel <= 2 passes then accept, allows_code decided in code, marks fix, derived formats (core
// plannedBlockTypes, never the model), top-6 chunks + thin flag per lesson. Writes crew/outline.json.
// Owner: WP2. Keep the export names and types (src/contracts.ts).
import { LABEL, parseArchetype, varietyViolation } from '@bilimind/core';
import type { Lesson, OutlineResult } from '@bilimind/core';
import type { Ctx, OutlineData, OutlineFn, ReadOutline } from './contracts.ts';
import { BilimindError } from './contracts.ts';
import { coursePaths, readJson, readJsonOrNull, writeJson } from './course.ts';
import { callJson } from './llm.ts';
import { readIngest } from './ingest/index.ts';
import { outlineSchema, outlineSystem, outlineUser, relabelSchema, relabelSystem, relabelUser, sizeFor } from './prompts/outline.ts';
import { briefFromGoal, goalDefaults, lessonSources, teachingChunks } from './prompts/context.ts';
import { normaliseOutline } from './normalise/outline.ts';

/** A subject where writing or reading code is a genuine skill (the model's allows_code is a hint, not the decision). */
const CODE_SUBJECT = /\b(data structures?|algorithms?|programming|program|coding|javascript|typescript|python|java\b|c\+\+|sql|database|software|web dev|computer science|computing)\b/i;

/** HACKATHON allows_code rule: never for staff onboarding; otherwise the model's answer OR a coding subject. */
export function decideAllowsCode(modelSays: boolean, audience: string, ...texts: (string | undefined | null)[]): boolean {
  if (audience === 'staff') return false;
  return modelSays || texts.some(t => !!t && CODE_SUBJECT.test(t));
}

interface RawOutline { course_title?: string; allows_code?: boolean; nodes?: { key?: string; archetype?: string; title?: string; summary?: string }[]; further?: unknown }

/** Variety gate + relabel passes (errors swallowed: "a course that leans conceptual is worth more than no course"). */
async function varietyPass(ctx: Ctx, raw: RawOutline): Promise<{ raw: RawOutline; violation: string | null; passes: number }> {
  let violation = varietyViolation(raw.nodes ?? [], { strictSmall: true });
  let passes = 0;
  while (violation && passes < 2) {
    passes++;
    ctx.progress(`outline: variety gate failed (${violation.slice(0, 90)}...), relabel pass ${passes}`);
    try {
      const res = await callJson<{ relabels?: { key?: string; archetype?: string }[] }>(ctx, {
        stage: 'relabel', system: relabelSystem(), user: relabelUser({ course_title: raw.course_title ?? '', nodes: raw.nodes ?? [] }, violation),
        schema: relabelSchema, reasoning: true,
      });
      const changes = new Map<string, string>();
      for (const r of res.data?.relabels ?? []) {
        const a = parseArchetype(r?.archetype);
        if (a && typeof r?.key === 'string') changes.set(r.key, a);
      }
      raw = { ...raw, nodes: (raw.nodes ?? []).map(n => (n && typeof n.key === 'string' && changes.has(n.key) ? { ...n, archetype: changes.get(n.key)! } : n)) };
    } catch (e) {
      ctx.progress(`outline: relabel pass ${passes} failed (${(e as Error).message}); keeping the labels`);
    }
    violation = varietyViolation(raw.nodes ?? [], { strictSmall: true });
  }
  return { raw, violation, passes };
}

export const outline: OutlineFn = async (ctx, opts) => {
  const p = coursePaths(ctx.course);
  const goal = goalDefaults(readJsonOrNull(p.goal));
  const ingest = readIngest(ctx.course);
  const pool = teachingChunks(ingest);
  if (!pool.length && !goal.sentence) throw new BilimindError('Nothing to plan from: no readable source text and no goal sentence.', 'Run `ingest` on a folder with slides or notes, and `goal` first.');
  const size = sizeFor(opts.maxTopics);
  const brief = briefFromGoal(goal, { hasMaterials: pool.length > 0 });
  ctx.progress(`outline: planning ${size.spine[0]}-${size.spine[1]} topics from ${ingest.files.length} files (reasoning on)...`);

  const res = await callJson<RawOutline>(ctx, {
    stage: 'outline', system: outlineSystem(size), user: outlineUser(brief, ingest.digest || null, null),
    schema: outlineSchema(size), reasoning: true,
  });
  const { raw, violation, passes } = await varietyPass(ctx, res.data ?? {});
  const norm = normaliseOutline(raw);
  if (!norm.nodes.length) throw new BilimindError('The outline came back with no usable lessons.', 'Run `outline` again (add --no-cache).');

  const allowsCode = decideAllowsCode(norm.allowsCode, goal.audience, norm.title, goal.topic, goal.sentence, brief.topic);
  const warnings: string[] = [];
  if (allowsCode !== norm.allowsCode) warnings.push(`allows_code set to ${allowsCode} in code (the model said ${norm.allowsCode})`);
  const spine = norm.nodes.filter(n => n.track === 'core').length;
  if (spine > size.spine[1]) warnings.push(`${spine} topics on the spine, above the ${size.spine[1]} a compact course allows: cut some in \`plan\``);
  if (violation) warnings.push(`variety gate still fails after ${passes} relabel pass(es), accepted: ${violation}`);
  warnings.push(...norm.marksFixed);

  const lessons: Lesson[] = norm.nodes.map((n, index) => {
    const src = lessonSources(pool, n);
    const { depth: _d, ...node } = n;
    return { ...node, index, chunk_ids: src.chunks.map(c => c.id), thin: pool.length > 0 && src.thin, status: 'stub' };
  });
  const result: OutlineResult = {
    title: norm.title, allows_code: allowsCode, code_language: allowsCode ? 'javascript' : null,   // HACKATHON: the page runs JS
    lessons, further: norm.further, variety_violation: violation, relabel_passes: passes,
  };
  writeJson(p.outline, { ...result, warnings });   // `warnings` is an extra key for the Lead; readers ignore it

  const data: OutlineData = {
    title: result.title, allows_code: allowsCode,
    topics: lessons.map(l => ({
      key: l.key, title: l.title, archetype: l.archetype, kind_label: LABEL[l.archetype], formats: l.planned_block_types,
      minutes: l.estimated_minutes, track: l.track, parent: l.parent === null ? null : lessons[l.parent]!.key, thin: l.thin,
    })),
  };
  return Object.assign(data, { warnings });
};

export const readOutline: ReadOutline = course => readJson<OutlineResult>(coursePaths(course).outline);
