// Lesson expansion, one-part rewrite and higher-order repair prompts: ExpandNodePrompt.php (2026-08-29.1),
// engine-port.md §3.5-3.6. Heredocs verbatim from src/prompts/php.ts; the node brief is a line-by-line port
// of ExpandNodePrompt::nodeBrief. HACKATHON edits: the disabled types (illustration, annotated_media, video,
// resource, exam) are cut from the catalogue and the schema enum, so the model never emits them; the optional
// menu is filtered to the enabled set; `--only <type>` may ADD a missing block, not only rewrite one.
import {
  ASSESSMENT_BIAS, ASSESSMENT_KINDS, BLOOM, DISABLED_TYPES, ENABLED_TYPES, GRADERS, HIGHER_ORDER, TEST, TRACK, WRITING_NOTE,
  optionalFormats,
} from '@bilimind/core';
import type { Archetype, Assessment, BlockType, Chunk, CourseBrief, Mark, Track } from '@bilimind/core';
import { GROUNDING_RULES, HOUSE_STYLE, assemble, clarificationTranscript, courseBrief, edit, limit, materialExcerpts, php } from './support.ts';

export const EXPAND_PROMPT_VERSION = '2026-08-29.1';
export const MAX_MCQ_SHARE = 0.40;

/** The node fields the writer prompt reads (an outline Lesson satisfies it). */
export interface NodeForPrompt {
  key: string; title: string; summary?: string; concept_key?: string; estimated_minutes: number;
  track: Track; layer: number; mark?: Mark | null; archetype: Archetype;
}
export interface Neighbour { title: string; summary?: string | null }

/** Drop one `type   {...}` entry (its header line and every indented line under it) from the catalogue. */
export function removeCatalogueEntry(catalogue: string, type: string): string {
  const lines = catalogue.split('\n');
  const start = lines.findIndex(l => l.split(/\s/)[0] === type);
  if (start < 0) throw new Error(`catalogue entry ${type} not found`);
  let end = start + 1;
  while (end < lines.length && (lines[end] === '' || /^\s/.test(lines[end]!))) end++;
  return [...lines.slice(0, start), ...lines.slice(end)].join('\n');
}

/** PAYLOAD_CATALOGUE, verbatim minus the disabled types (HACKATHON, engine-port §3.5 trims). */
export function payloadCatalogue(): string {
  let t = php('ExpandNodePrompt.payloadCatalogue.0');
  for (const type of DISABLED_TYPES) t = removeCatalogueEntry(t, type);
  return t;
}

export const assessmentRules = (): string => php('ExpandNodePrompt.assessmentRules.0', { mcqShare: Math.round(MAX_MCQ_SHARE * 100) });

export function expandSystem(): string {
  return php('ExpandNodePrompt.system.0', { catalogue: payloadCatalogue(), assessmentRules: assessmentRules(), house: HOUSE_STYLE });
}

/** ExpandNodePrompt::nodeBrief, line for line. `mandatory` = core mandatoryFormats(archetype) (never 'quiz'). */
export function nodeBrief(n: NodeForPrompt, mandatory: readonly BlockType[], allowsCode: boolean, codeLanguage: string | null): string {
  const L: string[] = [`- Title: ${n.title}`, `- Stable key: ${n.key}`];
  if (n.summary?.trim()) L.push(`- What this node is for: ${n.summary.trim()}`);
  if (n.concept_key?.trim()) L.push(`- Canonical concept: ${n.concept_key}`);
  L.push(`- Study time to fill: ${n.estimated_minutes} focused minutes`);
  L.push(n.track === 'core'
    ? `- Where it sits: step ${n.layer + 1} on the course path (step 1 is where the learner starts)`
    : `- Where it sits: off step ${n.layer + 1} — ${TRACK.subtopic.writingContext}`);
  if (n.mark === 'recommended') L.push('- Badge: RECOMMENDED — of the options under this step, this is the one we point learners at. Teach it as the default choice; you may mention what it was chosen over.');
  if (n.mark === 'alternative') L.push('- Badge: ALTERNATIVE — one of several options under this step; the learner does this OR the recommended one, not both. Do not assume the sibling options were read. Say plainly when this one is the better pick.');
  if (n.mark === 'anytime') L.push('- Badge: LEARN ANYTIME — nothing later depends on this and it may be opened out of order, so it must stand entirely on its own and must not become a prerequisite for anything.');
  const a = n.archetype;
  L.push('', `- ARCHETYPE: \`${a}\` — this node is one where ${TEST[a]}.`, `- WRITING THIS ARCHETYPE WELL: ${WRITING_NOTE[a]}`);
  let kinds = [...ASSESSMENT_BIAS[a]];
  let optional = optionalFormats(a).filter(t => (ENABLED_TYPES as readonly string[]).includes(t));   // HACKATHON: enabled set only
  const offersCode = optional.includes('code');
  if (!allowsCode) { kinds = kinds.filter(k => k !== 'code'); optional = optional.filter(t => t !== 'code'); }
  L.push(`- ASSESSMENT KINDS THAT SUIT IT: ${kinds.join(', ')}`);
  if (optional.length) L.push(`- OPTIONAL FORMATS you may add 1–3 of: ${optional.join(', ')}`);
  if (allowsCode && offersCode) {
    L.push('- CODE PRACTICE — this IS a coding course and this lesson is a natural place to write code, so include a `code` block: a hands-on exercise where the learner writes and RUNS real code. Pick the `mode` that matches the skill this lesson teaches, and set it in the language the course teaches — the sandbox runs python, javascript, sql and html, and nothing else. Give it a concrete task, minimal starter code carrying the shape to complete, and 2–4 `tests`. A code-appropriate lesson the learner only reads is half-taught.');
    if (codeLanguage) L.push(`- THIS COURSE ALREADY SETS ITS EXERCISES IN \`${codeLanguage}\` — stay in it unless this lesson is specifically about another language.`);
  }
  if (mandatory.length) L.push('', `- MANDATORY FORMATS — every one of these MUST be a block in your reply: ${mandatory.join(', ')}`);
  return 'THE NODE YOU ARE WRITING\n' + L.join('\n');
}

export const neighbours = (heading: string, ns: readonly Neighbour[]): string | null => ns.length
  ? heading + '\n' + ns.map(x => (x.summary?.trim() ? `- ${x.title} — ${limit(x.summary.trim(), 200)}` : `- ${x.title}`)).join('\n')
  : null;

/** We run no research stage, so this is always the "found nothing" heredoc. */
export const researchList = (): string => php('ExpandNodePrompt.researchList.0');

export const steer = (s?: string | null): string | null => s?.trim() ? assemble([
  "LEARNER'S REWRITE INSTRUCTION — this version is a regeneration, and this is what they asked for",
  `"${limit(s.trim(), 500)}"`,
  php('ExpandNodePrompt.steer.0'),
]) : null;

export const correction = (c?: string | null): string | null => c?.trim()
  ? assemble(['YOUR PREVIOUS ATTEMPT AT THIS NODE WAS REJECTED', c.trim(), php('ExpandNodePrompt.correction.0')])
  : null;

export interface ExamTarget { id: string; marks: number; text: string }
export interface ExpandInput {
  brief: CourseBrief; lesson: NodeForPrompt; allowsCode: boolean; codeLanguage: string | null;
  prerequisites: Neighbour[]; dependents: Neighbour[]; chunks: Chunk[]; mandatory: BlockType[];
  instruction?: string | null; correction?: string | null; examTargets?: ExamTarget[];
}

/**
 * HACKATHON (G2 review): the past-paper parts mapped to this lesson. Not citable (an exam question is not evidence);
 * the Writer rehearses the same task format with different numbers, one practice item per part worth 4+ marks.
 */
const NL = '\n';
export function examTargets(ts?: ExamTarget[] | null): string | null {
  if (!ts?.length) return null;
  return assemble([
    "EXAM TARGETS — last year's paper asks these parts about this lesson (NOT citable: never put them in source_material_ids)",
    ts.map(t => `- ${t.id} [${t.marks} marks]: ${limit(t.text.replace(/\s+/g, ' ').trim(), 400)}`).join(NL),
    'Rehearse each part in the SAME task format with DIFFERENT numbers or keys (a trace stays a trace, "write a function" stays code, '
    + '"explain" stays a short written answer). Every part worth 4 or more marks needs at least one practice item or worked example of that '
    + 'format in this lesson: a trace as an ordering, numeric or cloze item (or a walkthrough step), a "write code" part as a `code` block '
    + "when code is allowed, an \"explain\" part as a short_answer. Do not copy the paper's own numbers into a question.",
  ]);
}

/** HACKATHON (G2 review): rules for the facts and conventions the lesson states. */
export function accuracyRules(codeLanguage: string | null): string {
  const L = [
    'ACCURACY RULES — the learner is revising for an exam marked against these slides',
    '- When you state a convention (insert at the head or the tail of a chain, a load-factor threshold, 0- or 1-based indices, '
    + "which child to swap with), use the SLIDE's convention exactly, and say \"slide N\" only for a slide in the excerpts that says it.",
    '- Every number you state must be recomputed, not recalled: redo each modulo, sum, count and array trace step by step before you write it. '
    + 'An array after each insertion must be the real result of running the algorithm.',
    "- Every numeric item's answer_key carries a short `work` string: the derivation, ending in the final number (e.g. \"69 mod 10 = 9; slot 9 "
    + 'is empty; 1 probe"). Its last number must equal `value`.',
    '- A multi_select prompt never says how many options are correct unless that number equals the correct ids (prefer "Select all that apply.").',
    "- A project must fit inside this lesson's study time; give the data it needs (keys, arrays) in the brief.",
  ];
  if (codeLanguage) L.push(`- All code, pseudo-code and idioms are ${codeLanguage}: no other language's operators or behaviour (no Python "//", `
    + 'no negative indices that wrap). Tests of a function that changes its input check the changed state, not only the return value.');
  return L.join(NL);
}

export function expandUser(a: ExpandInput): string {
  return assemble([
    courseBrief(a.brief),
    clarificationTranscript(a.brief.clarify),
    nodeBrief(a.lesson, a.mandatory, a.allowsCode, a.codeLanguage),
    neighbours('COMES IMMEDIATELY BEFORE THIS NODE (already taught — do not re-teach)', a.prerequisites),
    neighbours('COMES AFTER THIS NODE (do not teach it here)', a.dependents),
    researchList(),
    a.chunks.length ? assemble([GROUNDING_RULES, materialExcerpts(a.chunks)]) : null,
    examTargets(a.examTargets),
    accuracyRules(a.allowsCode ? a.codeLanguage : null),
    steer(a.instruction),
    correction(a.correction),
    php('ExpandNodePrompt.user.0'),
  ]);
}

/** NodeExpander::formatViolation, verbatim (the corrective sentence for a missing mandatory format). */
export const formatViolation = (present: readonly string[], missing: readonly string[]): string =>
  `The lesson was missing ${missing.length === 1 ? 'a mandatory format' : 'mandatory formats'}: ${missing.map(m => '`' + m + '`').join(', ')}. `
  + `This node teaches a kind of knowledge that cannot be taught without ${missing.length === 1 ? 'it' : 'them'}, so an explainer covering the same ground is not a substitute. `
  + `You wrote: ${present.length ? [...new Set(present)].join(', ') : 'nothing usable'}. Keep those, and add what is missing.`;

// ---------- schemas (SchemaValidator subset; payload shapes are enforced by the normaliser) ----------
export const assessmentSchema = (higherOrderOnly = false) => ({
  type: 'object', required: ['kind', 'prompt', 'bloom', 'grader'],
  properties: {
    kind: { type: 'string', enum: [...ASSESSMENT_KINDS] },
    prompt: { type: 'string', minLength: 10, maxLength: 4000, description: 'the question, standing entirely on its own' },
    bloom: { type: 'string', enum: higherOrderOnly ? [...HIGHER_ORDER] : [...BLOOM], description: 'cognitive level this item actually demands' },
    grader: { type: 'string', enum: [...GRADERS] },
    options: {
      type: 'array', minItems: 2, maxItems: 8, description: 'mcq/multi_select/ordering only',
      items: { type: 'object', required: ['id', 'text'], properties: {
        id: { type: 'string', minLength: 1, maxLength: 8 }, text: { type: 'string', minLength: 1, maxLength: 600 } } },
    },
    answer_key: { type: 'object', description: 'never shown to the learner: {correct_option_ids:[]} | {accepted:[]} | {correct_order:[]} | {value,tolerance,unit} | {reference_answer} | {reference_solution}' },
    rubric: {
      type: 'array', minItems: 2, maxItems: 4, description: 'REQUIRED for every llm_rubric item; weights sum to 1',
      items: { type: 'object', required: ['criterion', 'weight', 'excellent', 'acceptable', 'poor'], properties: {
        criterion: { type: 'string', minLength: 6, maxLength: 200 }, weight: { type: 'number', minimum: 0, maximum: 1 },
        excellent: { type: 'string', minLength: 10, maxLength: 400 }, acceptable: { type: 'string', minLength: 10, maxLength: 400 },
        poor: { type: 'string', minLength: 10, maxLength: 400 } } },
    },
    max_score: { type: 'integer', minimum: 1, maximum: 100 },
  },
});

export const expandSchema = (enabled: readonly BlockType[] = ENABLED_TYPES) => ({
  type: 'object', required: ['blocks'],
  properties: {
    blocks: {
      type: 'array', minItems: 3, maxItems: 12, items: {
        type: 'object', required: ['type', 'payload'],
        properties: {
          type: { type: 'string', enum: [...enabled] },
          payload: { type: 'object', description: 'shape is dictated by `type` — see the block payload catalogue' },
          source_material_ids: { type: 'array', maxItems: 12, description: 'material ids this block was built from; omit when none', items: { type: 'integer' } },
          assessments: { type: 'array', maxItems: 8, description: 'only on quiz/exam/project/code blocks', items: assessmentSchema() },
        },
      },
    },
  },
});

// ---------- `draft --only <type>`: ExpandNodePrompt::rewriteUser / rewriteSchema ----------
/** NodeExpander::excerpt: the first non-empty string in a payload, whitespace-collapsed, <= 160 chars. */
export function payloadExcerpt(payload: unknown): string {
  if (typeof payload === 'string') return payload.trim() ? limit(payload.trim().replace(/\s+/gu, ' '), 160) : '';
  if (payload && typeof payload === 'object') {
    for (const v of Object.values(payload as Record<string, unknown>)) { const e = payloadExcerpt(v); if (e) return e; }
  }
  return '';
}

function rewriteSteer(s?: string | null): string {
  return s?.trim()
    ? assemble(["THE OWNER'S REQUEST — this is what they asked for", `"${limit(s.trim(), 500)}"`, php('ExpandNodePrompt.rewriteSteer.0')])
    : assemble(["THE OWNER'S REQUEST", 'No specific instruction: write a fresh, better version of this part — clearer, more concrete, same scope.']);
}

export interface RewriteInput {
  brief: CourseBrief; lesson: NodeForPrompt; allowsCode: boolean; codeLanguage: string | null; chunks: Chunk[];
  type: BlockType;
  current: Record<string, unknown> | null;     // the block's payload now; null = the lesson has no block of this type yet
  otherParts: { type: string; excerpt: string }[];
  instruction?: string | null;
}

export function rewriteUser(a: RewriteInput): string {
  const others = a.otherParts.length ? assemble([
    'THE OTHER PARTS OF THIS LESSON (already written — do not repeat them, do not return them)',
    a.otherParts.map(p => `- ${p.type}` + (p.excerpt === '' ? '' : `: ${p.excerpt}`)).join('\n'),
  ]) : null;
  const part = a.current
    ? `THE PART TO REWRITE — a \`${a.type}\` block. This is what it says now:\n${JSON.stringify({ type: a.type, payload: a.current }, null, 4)}`
    // HACKATHON: the Writer asks for a MISSING block (usually a mandatory format the first draft left out).
    : `THE PART TO WRITE — a \`${a.type}\` block. The lesson does not have one yet; it is the part that is missing.`;
  let closing = php('ExpandNodePrompt.rewriteUser.0', { type: a.type });
  if (!a.current) closing = edit(closing, 'Rewrite ONLY this part.', 'Write ONLY this part.', 'add a missing part');
  return assemble([
    courseBrief(a.brief),
    clarificationTranscript(a.brief.clarify),
    nodeBrief(a.lesson, [], a.allowsCode, a.codeLanguage),
    researchList(),
    a.chunks.length ? assemble([GROUNDING_RULES, materialExcerpts(a.chunks)]) : null,
    accuracyRules(a.allowsCode ? a.codeLanguage : null),
    others,
    part,
    rewriteSteer(a.instruction),
    closing,
  ]);
}

/** The expansion schema pinned to exactly one block of `type`. */
export function rewriteSchema(type: BlockType) {
  const s = expandSchema();
  s.properties.blocks.minItems = 1;
  s.properties.blocks.maxItems = 1;
  s.properties.blocks.items.properties.type.enum = [type];
  return s;
}

// ---------- §3.6 higher-order repair (only when every item is remember/understand) ----------
export const higherOrderSystem = (): string =>
  php('ExpandNodePrompt.higherOrderSystem.0', { assessmentRules: assessmentRules(), house: HOUSE_STYLE });

export function higherOrderUser(brief: CourseBrief, lesson: NodeForPrompt, allowsCode: boolean,
  existing: Pick<Assessment, 'kind' | 'prompt' | 'bloom'>[], digest: string): string {
  return assemble([
    courseBrief(brief),
    nodeBrief(lesson, [], allowsCode, null),
    'WHAT THE LESSON ACTUALLY TEACHES\n' + limit(digest.trim(), 6000),
    existing.length
      ? 'QUESTIONS ALREADY IN THIS LESSON (do not duplicate or paraphrase these)\n'
        + existing.map(x => `- [${x.kind} · ${x.bloom}] ${limit(x.prompt, 220)}`).join('\n')
      : 'The lesson currently ships no questions at all.',
    php('ExpandNodePrompt.higherOrderUser.0'),
  ]);
}

export const higherOrderSchema = {
  type: 'object', required: ['assessments'], properties: {
    assessments: { type: 'array', minItems: 1, maxItems: 2, items: assessmentSchema(true) },
  },
};

/** BlockType::label() (used as the digest headings). */
export const BLOCK_LABEL: Record<string, string> = {
  explainer: 'Explainer', key_points: 'Key points', example: 'Example', resource: 'Resources', video: 'Videos', quiz: 'Quiz',
  exam: 'Exam', project: 'Project', flashcards: 'Flashcards', code: 'Code exercise', reflection: 'Reflection',
  walkthrough: 'Walkthrough', checklist: 'Checklist', diagram: 'Diagram', comparison: 'Comparison', scenario: 'Scenario',
  reference_table: 'Reference table', worked_example: 'Worked example', playground: 'Playground', annotated_media: 'Annotated image',
  timeline: 'Timeline', analogy: 'Analogy', audio: 'Listen', speaking: 'Speak', dialogue: 'Role-play', illustration: 'Illustration',
  misconception: 'Common misconception',
};

const s = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
function joinRows(rows: unknown, keys: string[]): string {
  if (!Array.isArray(rows)) return '';
  return rows.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map(r => keys.map(k => s(r[k]).trim()).filter(Boolean))
    .filter(p => p.length).map(p => '- ' + p.join(' — ')).join('\n');
}

/** NodeExpander::lessonDigest: what the lesson teaches, per block, for the higher-order repair call. */
export function lessonDigest(blocks: { type: string; payload: Record<string, unknown> }[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    const p = b.payload;
    let text = '';
    switch (b.type) {
      case 'explainer': case 'example': case 'analogy': text = s(p.markdown); break;
      case 'key_points': text = (Array.isArray(p.points) ? p.points.map(s) : []).join('\n- '); break;
      case 'project': text = s(p.brief_markdown); break;
      case 'code': text = s(p.instructions_markdown); break;
      case 'reflection': text = s(p.prompt); break;
      case 'walkthrough': text = joinRows(p.steps, ['title', 'detail_markdown']); break;
      case 'checklist': text = joinRows(p.items, ['text', 'why']); break;
      case 'comparison': text = joinRows(p.items, ['name', 'best_for']); break;
      case 'scenario': text = s(p.setup_markdown) + '\n' + s(p.debrief_markdown); break;
      case 'worked_example': text = s(p.problem_markdown) + '\n' + joinRows(p.steps, ['expression', 'explanation']) + '\nAnswer: ' + s(p.answer); break;
      case 'playground': text = s(p.guidance_markdown); break;
      case 'timeline': text = joinRows(p.events, ['when', 'title', 'detail']); break;
      case 'diagram': text = s(p.alt_text ?? p.caption); break;
      case 'audio': text = s(p.script_markdown); break;
      case 'misconception': text = s(p.belief) + '\n' + s(p.what_is_true); break;
      default: text = '';
    }
    if (text.trim()) parts.push(`## ${BLOCK_LABEL[b.type] ?? b.type}\n${text.trim()}`);
  }
  return parts.join('\n\n');
}
