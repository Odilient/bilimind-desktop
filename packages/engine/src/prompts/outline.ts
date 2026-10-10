// Outline + archetype relabel prompts: OutlinePrompt.php (2026-08-29.1) and ArchetypeRelabelPrompt.php
// (2026-10-04.1), engine-port.md §3.2-3.4. Text is verbatim (src/prompts/php.ts); tables are RENDERED from the
// core constants that drive validation and the UI, so prompt and code cannot drift. Every deliberate change is
// an edit() marked HACKATHON: the compact spine (5-8 topics + 2-5 subtopics, each topic one sitting, no
// "parts" stage), as measured live in engine-port-samples/measure_outline.py.
import { ARCHETYPES, MARK, TEST, TRACK, mandatoryFormats } from '@bilimind/core';
import type { CourseBrief, Outline } from '@bilimind/core';
import { GROUNDING_RULES, HOUSE_STYLE, assemble, clarificationTranscript, courseBrief, edit, php } from './support.ts';

export const OUTLINE_PROMPT_VERSION = '2026-08-29.1';
export const RELABEL_PROMPT_VERSION = '2026-10-04.1';
export const MAX_NOTE_LENGTH = 240;
export const MAX_FURTHER = 4;

export interface OutlineSize {
  spine: [number, number]; side: [number, number]; nodes: [number, number];
  notes: string; chapters: string; chaptersExample: string;
}
export const OUTLINE_SIZE: { compact: OutlineSize } = {
  // HACKATHON: a student with an exam on Friday needs 6-12 lessons, not 60.
  compact: { spine: [5, 8], side: [2, 5], nodes: [7, 14], notes: 'One to three', chapters: '2 to 3', chaptersExample: 'eight topics read as three parts' },
};

/** `outline --max-topics n`: the compact size with a different spine ceiling. */
export function sizeFor(maxTopics?: number): OutlineSize {
  const c = OUTLINE_SIZE.compact;
  if (!maxTopics || maxTopics === c.spine[1]) return c;
  const hi = Math.max(3, Math.min(16, Math.round(maxTopics)));
  const lo = Math.min(c.spine[0], hi);
  return { ...c, spine: [lo, hi], nodes: [Math.min(c.nodes[0], lo + c.side[0]), Math.max(lo + c.side[0], hi + 6)] };
}

/** OutlinePrompt::archetypeTable. HACKATHON: "the learner will get" lists mandatoryFormats (annotated_media -> walkthrough). */
export const archetypeTable = (): string => ['Pick the archetype whose "true when" description actually fits.', '',
  ...ARCHETYPES.flatMap(a => [`\`${a}\` — true when ${TEST[a]}.`, `    the learner will get: ${mandatoryFormats(a).join(' + ')}`])].join('\n');
export const trackTable = (): string => (['core', 'subtopic'] as const).flatMap(t =>
  [`\`${t}\` — use it when ${TRACK[t].rule}.`, `    the learner is told: "${TRACK[t].blurb}"`]).join('\n');
export const markTable = (): string => (['recommended', 'alternative', 'anytime'] as const).flatMap(m =>
  [`\`${m}\` — use it when ${MARK[m].rule}.`, `    the learner is told: "${MARK[m].label} — ${MARK[m].blurb}"`]).join('\n');

export function outlineSystem(size: OutlineSize = OUTLINE_SIZE.compact): string {
  const [s0, s1] = size.spine, [d0, d1] = size.side;
  let t = php('OutlinePrompt.system.0', {
    tracks: trackTable(), marks: markTable(), archetypes: archetypeTable(), example: php('OutlinePrompt.shapeExample.0'),
    maxNote: MAX_NOTE_LENGTH, maxFurther: MAX_FURTHER, house: HOUSE_STYLE,
  });
  // HACKATHON: compact counts and one-sitting topics (no StepParts stage).
  t = edit(t, 'You are drawing the SPINE: 10 to 16 topics', `You are drawing the SPINE: ${s0} to ${s1} topics`, 'spine count');
  t = edit(t, 'plus 3 to 10 side lessons', `plus ${d0} to ${d1} side lessons`, 'side count');
  t = edit(t, /A topic is a MILESTONE — a capability big enough[\s\S]*?put them in the one order they can be learned in\./,
    'A topic is a MILESTONE — a capability big enough that a learner would name it\n'
    + 'when asked what they now know — and it is taught in ONE focused sitting of 15 to\n'
    + '45 minutes. Your job is to choose the milestones and put them in the one order\n'
    + 'they can be learned in.', 'one sitting');
  t = edit(t, / The everyday PARTS of each topic[\s\S]*?do not list those\./, '', 'no parts stage');
  t = edit(t, 'Yours must have 10\nto 16 topics.', `Yours must have ${s0}\nto ${s1} topics.`, 'example count');
  t = edit(t, /This is the\n {2}topic's OWN framing time[\s\S]*?by choice\./,
    'Vary it: a\n  definitions lesson is not a capstone. Keep the whole spine inside the time the\n'
    + '  learner has before their deadline; subtopics are spent on top, by choice.', 'minutes before the deadline');
  t = edit(t, 'Aim for 4 to 6 chapters over the\n  spine, so fourteen topics read as five parts.',
    `Aim for ${size.chapters} chapters over the\n  spine, so ${size.chaptersExample}.`, 'chapters');
  t = edit(t, 'Two to four notes across the course', `${size.notes} notes across the course`, 'notes');
  t = edit(t, '10–16 topics in studiable order', `${s0}–${s1} topics in studiable order`, 'check: topics');
  t = edit(t, '3–10\nsubtopics', `${d0}–${d1}\nsubtopics`, 'check: subtopics');
  t = edit(t, 'two to four notes;', `${size.notes.toLowerCase()} notes;`, 'check: notes');
  return t;
}

/** HACKATHON addition to the user turn for an onboarding course (audience 'staff'), engine-port §3.2. */
export const STAFF_PARAGRAPH = `This course trains new staff of a small business from the owner's own documents.
The capstone is a real shift task done end to end and checked by a supervisor
(e.g. "Open the cafe alone: machine on, dial in, float counted"). Safety and
hygiene rules in the documents are \`safety_critical\` lessons, recipes and
station routines are \`procedural\`, menu and price facts are \`factual\`. allows_code is false.`;

export function outlineUser(brief: CourseBrief, digest: string | null, correction: string | null = null): string {
  const materials = digest?.trim() ? assemble([
    GROUNDING_RULES,
    'MATERIAL SAMPLE (a spread across everything the learner attached)\n' + digest.trim(),
    php('OutlinePrompt.user.0'),
  ]) : null;
  const corr = correction?.trim() ? assemble(['YOUR PREVIOUS ATTEMPT WAS REJECTED', correction.trim(), php('OutlinePrompt.correction.0')]) : null;
  return assemble([
    courseBrief(brief),
    clarificationTranscript(brief.clarify),
    materials,
    brief.audience === 'staff' ? STAFF_PARAGRAPH : null,   // HACKATHON
    corr,
    php('OutlinePrompt.user.1'),
  ]);
}

export const outlineSchema = (size: OutlineSize = OUTLINE_SIZE.compact) => ({
  type: 'object', required: ['course_title', 'allows_code', 'nodes'],
  properties: {
    course_title: { type: 'string', minLength: 4, maxLength: 120, description: 'in the course language' },
    allows_code: { type: 'boolean', description: 'true only if this subject is genuinely about writing/reading code (a programming language, web/software dev, SQL, data science in code, algorithms); false for everything else, including subjects that merely involve numbers or steps' },
    nodes: {
      type: 'array', minItems: size.nodes[0], maxItems: size.nodes[1],
      description: 'the topics in study order, each immediately followed by the subtopics hanging off it',
      items: {
        type: 'object',
        // branch_of stays optional on purpose: a missing one is repaired (lesson goes on the spine),
        // whereas a schema violation fails the whole outline and burns a retry.
        required: ['key', 'title', 'summary', 'concept_key', 'track', 'archetype', 'estimated_minutes'],
        properties: {
          key: { type: 'string', minLength: 2, maxLength: 64, description: 'unique snake_case English slug; branch_of and after_key reference this' },
          title: { type: 'string', minLength: 3, maxLength: 90 },
          summary: { type: 'string', minLength: 40, maxLength: 500, description: '2-3 sentences: capability, coverage, pitfall' },
          concept_key: { type: 'string', minLength: 2, maxLength: 64, description: 'language-agnostic English canonical concept id' },
          section: { type: 'string', maxLength: 60, description: 'on the FIRST topic of a chapter only: the chapter it opens' },
          note: { type: 'string', maxLength: MAX_NOTE_LENGTH, description: 'topics only, optional: a sentence or two of advice a mentor would say at this point' },
          track: { type: 'string', enum: ['core', 'subtopic'], description: 'core = a topic on the spine; subtopic = hangs off one with a dotted line' },
          branch_of: { type: 'string', maxLength: 64, description: 'required unless track is core: the key of the topic (or, once, the subtopic) this hangs off' },
          mark: { type: 'string', enum: ['recommended', 'alternative', 'anytime'], description: 'subtopics only, optional: the badge — recommended, alternative, or anytime' },
          group: { type: 'string', maxLength: 60, description: 'subtopics only, optional: the family name shared by three or more siblings drawn in one headed box' },
          archetype: { type: 'string', enum: [...ARCHETYPES], description: 'the kind of knowledge this lesson teaches; determines its formats' },
          estimated_minutes: { type: 'integer', minimum: 10, maximum: 90 },
        },
      },
    },
    further: {
      type: 'array', maxItems: MAX_FURTHER, description: 'courses worth starting after this one; empty when none would help',
      items: {
        type: 'object', required: ['title', 'topic'], properties: {
          title: { type: 'string', maxLength: 60, description: 'what the button says' },
          topic: { type: 'string', maxLength: 200, description: 'the request a learner would type to create that course' },
          after_key: { type: 'string', maxLength: 64, description: 'the topic this pointer belongs beside; omit for the end of the course' },
        },
      },
    },
  },
});

// ---------- §3.4 archetype relabel: the cheap fix for a failed variety gate ----------
export const relabelSystem = (): string => php('ArchetypeRelabelPrompt.system.0', { archetypes: archetypeTable() });

export function relabelUser(o: Pick<Outline, 'course_title'> & { nodes: { key?: string; archetype?: string; title?: string; summary?: string }[] }, violation: string): string {
  const list = o.nodes.filter(n => typeof n.key === 'string' && n.key.trim())
    .map(n => `- \`${n.key}\` [${n.archetype ?? 'conceptual'}] ${(n.title ?? '').trim()} — ${(n.summary ?? '').trim()}`).join('\n');
  return php('ArchetypeRelabelPrompt.user.0', { title: (o.course_title ?? '').trim(), list, violation });
}

export const relabelSchema = {
  type: 'object', required: ['relabels'], properties: {
    relabels: {
      type: 'array', description: 'only the lessons whose archetype changes',
      items: { type: 'object', required: ['key', 'archetype'], properties: {
        key: { type: 'string', maxLength: 64 }, archetype: { type: 'string', enum: [...ARCHETYPES] } } },
    },
  },
};
