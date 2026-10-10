// WP2 golden tests: the prompts are the production PHP heredocs (extracted verbatim) plus ONLY the HACKATHON edits.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DISABLED_TYPES, ENABLED_TYPES } from '@bilimind/core';
import { PHP_PROMPTS } from '../src/prompts/php.ts';
import { HOUSE_STYLE, GROUNDING_RULES, courseBrief, languageLabel, materialExcerpts, php } from '../src/prompts/support.ts';
import { archetypeTable, markTable, outlineSchema, outlineSystem, outlineUser, relabelSystem, relabelUser, sizeFor, trackTable } from '../src/prompts/outline.ts';
import {
  expandSchema, expandSystem, expandUser, formatViolation, higherOrderSystem, higherOrderUser, lessonDigest, nodeBrief, payloadCatalogue,
  rewriteSchema, rewriteUser,
} from '../src/prompts/expand.ts';
import { sample } from './wp2-helpers.ts';

const BACKEND = fileURLToPath(new URL('../../../../backend/app/Services/Llm/Prompts/', import.meta.url));
const lineDiff = (a: string, b: string) => { const s = new Set(b.split('\n')); return a.split('\n').filter(l => !s.has(l)); };

const brief = { topic: 'Data Structures', title: 'DS final', language: 'en', goal: 'Pass the final on Wednesday', deadline: '2026-10-14 09:00',
  minutes_per_day: 45, source_type: 'materials' as const, audience: 'student' as const };
const node = { key: 'bst_ordering', title: 'How a binary search tree keeps keys in order', summary: 'You will be able to insert keys by hand.',
  concept_key: 'ds.binary_search_tree', estimated_minutes: 25, track: 'core' as const, layer: 2, archetype: 'conceptual' as const };

describe('prompts are the PHP heredocs, verbatim', () => {
  it.skipIf(!existsSync(BACKEND))('src/prompts/php.ts equals a fresh extraction from the backend', async () => {
    const mod = await import(pathToFileURL(join(fileURLToPath(new URL('../scripts/', import.meta.url)), 'extract-php-prompts.mjs')).href);
    expect(mod.extractAll(BACKEND)).toEqual({ ...PHP_PROMPTS });
  });

  it('house style and grounding rules are the PromptSupport heredocs', () => {
    expect(HOUSE_STYLE.startsWith('WRITING CONTRACT\n- Be concrete.')).toBe(true);
    expect(HOUSE_STYLE).toContain('NEVER write a URL.');
    expect(GROUNDING_RULES.startsWith('GROUNDING\n- The learner attached their own material.')).toBe(true);
    expect(languageLabel('en')).toBe('English (BCP-47 tag "en")');
    expect(languageLabel('ms')).toBe('Malay (BCP-47 tag "ms")');
  });

  it('outline system = PHP text with exactly the HACKATHON compact edits', () => {
    const raw = php('OutlinePrompt.system.0', { tracks: trackTable(), marks: markTable(), archetypes: archetypeTable(),
      example: php('OutlinePrompt.shapeExample.0'), maxNote: 240, maxFurther: 4, house: HOUSE_STYLE });
    const ours = outlineSystem();
    expect(lineDiff(ours, raw)).toEqual([
      'You are drawing the SPINE: 5 to 8 topics on the `core` track, in the one',
      'order they can be learned in, plus 2 to 5 side lessons on the `subtopic` track',
      'when asked what they now know — and it is taught in ONE focused sitting of 15 to',
      '45 minutes. Your job is to choose the milestones and put them in the one order',
      'they can be learned in.',
      'that bites 10% of people.',
      'no marketing. One to three notes across the course; a note on every topic is',
      'ARCHETYPES and every kind of box are visible in one screen. Yours must have 5',
      'to 8 topics. Copy the shape, not the subject matter.',
      '  A chapter runs until the next one is named. Aim for 2 to 3 chapters over the',
      '  spine, so eight topics read as three parts. Name the capability the chapter',
      '- `estimated_minutes` — honest focused study time, 10 to 90. Vary it: a',
      '  definitions lesson is not a capstone. Keep the whole spine inside the time the',
      '  learner has before their deadline; subtopics are spent on top, by choice.',
      'Silently check: 5–8 topics in studiable order; no topic leaning on a later',
      'one; every topic big enough to contain two or three distinct things; 2–5',
      'marked; one to three notes; the last topic is a capstone; at least five distinct',
    ]);
    expect(ours).not.toMatch(/10 to 16|later stage breaks/);
    expect(ours).toContain('"course_title": "Postgres query performance for application engineers"');   // the shape example, verbatim
  });

  it('archetype table is rendered from core (spatial gets diagram + walkthrough, never annotated_media)', () => {
    const t = archetypeTable();
    expect(t).toContain('`procedural` — true when the learner has to DO a sequence of steps in order, and doing them out of order fails.');
    expect(t).toContain('    the learner will get: diagram + walkthrough');
    expect(t).not.toContain('annotated_media');
    expect(relabelSystem()).toContain(t);
  });

  it('outline user turn: brief with deadline + per-day budget, digest under GROUNDING, staff paragraph, correction', () => {
    const u = outlineUser(brief, '### Material #1\n[Slide 1] text', 'Only 2 distinct archetypes.');
    expect(u.startsWith('LEARNER BRIEF\n- Topic as the learner wrote it: Data Structures')).toBe(true);
    expect(u).toContain('- Time budget: 45 minutes per day');
    expect(u).toContain('- Deadline: 2026-10-14 09:00 — everything must be studiable before this date');
    expect(u).toContain('- Source of truth: their own attached materials');
    expect(u).toContain(GROUNDING_RULES + '\n\nMATERIAL SAMPLE (a spread across everything the learner attached)\n### Material #1');
    expect(u).toContain('YOUR PREVIOUS ATTEMPT WAS REJECTED\n\nOnly 2 distinct archetypes.\n\nRebuild the outline');
    expect(u.endsWith('Return the JSON object described in\nthe output contract and nothing else.')).toBe(true);
    expect(u).not.toContain('This course trains new staff');
    expect(outlineUser({ ...brief, audience: 'staff' }, null)).toContain('This course trains new staff of a small business');
  });

  it('outline schema uses the compact node bounds; --max-topics widens the spine', () => {
    expect(outlineSchema().properties.nodes.minItems).toBe(7);
    expect(outlineSchema().properties.nodes.maxItems).toBe(14);
    const s = sizeFor(10);
    expect(s.spine).toEqual([5, 10]);
    expect(outlineSystem(s)).toContain('You are drawing the SPINE: 5 to 10 topics');
  });

  it('relabel user lists `key` [archetype] title — summary and the violation', () => {
    const u = relabelUser({ course_title: 'T', nodes: [{ key: 'a', archetype: 'procedural', title: 'A', summary: 'S' }, { title: 'no key' }] }, 'V');
    expect(u).toBe('Course: T\n\nLessons, as `key` [current archetype] title — summary:\n- `a` [procedural] A — S\n\nThe problem with these labels:\nV');
  });
});

describe('expand prompts', () => {
  it('system = PHP text minus exactly the disabled catalogue entries', () => {
    const raw = php('ExpandNodePrompt.system.0', { catalogue: php('ExpandNodePrompt.payloadCatalogue.0'),
      assessmentRules: php('ExpandNodePrompt.assessmentRules.0', { mcqShare: 40 }), house: HOUSE_STYLE });
    const ours = expandSystem();
    expect(lineDiff(ours, raw)).toEqual([]);   // nothing added
    const removedHeads = lineDiff(raw, ours).filter(l => /^\S/.test(l)).map(l => l.split(/\s/)[0]);
    expect(removedHeads.sort()).toEqual([...DISABLED_TYPES].sort());
    for (const t of ENABLED_TYPES) expect(payloadCatalogue().split('\n').some(l => l.split(/\s/)[0] === t), t).toBe(true);
    expect(ours).toContain('AT MOST 40% OF THEM MAY BE `mcq`.');
    expect(ours).toContain('"starter_code": "def greet(name):\\n    # TODO\\n    pass"');   // nowdoc backslashes kept literally
  });

  it('node brief is the NodeExpander port: archetype, writing note, kinds, enabled optional menu, code steer, mandatory', () => {
    const b = nodeBrief(node, ['explainer', 'diagram', 'analogy'], true, 'javascript');
    expect(b).toBe([
      'THE NODE YOU ARE WRITING',
      '- Title: How a binary search tree keeps keys in order',
      '- Stable key: bst_ordering',
      '- What this node is for: You will be able to insert keys by hand.',
      '- Canonical concept: ds.binary_search_tree',
      '- Study time to fill: 25 focused minutes',
      '- Where it sits: step 3 on the course path (step 1 is where the learner starts)',
      '',
      '- ARCHETYPE: `conceptual` — this node is one where the learner has to understand WHY something behaves as it does before any of it makes sense.',
      '- WRITING THIS ARCHETYPE WELL: The diagram carries the mechanism; do not describe in prose what the diagram already shows. The analogy must name where it BREAKS — an analogy without its limit teaches a misconception.',
      '- ASSESSMENT KINDS THAT SUIT IT: short_answer, mcq, essay',
      '- OPTIONAL FORMATS you may add 1–3 of: example, reflection, scenario, misconception, key_points, audio, speaking, dialogue',
      '',
      '- MANDATORY FORMATS — every one of these MUST be a block in your reply: explainer, diagram, analogy',
    ].join('\n'));
    const q = nodeBrief({ ...node, archetype: 'quantitative' }, [], true, 'javascript');
    expect(q).toContain('- CODE PRACTICE — this IS a coding course');
    expect(q).toContain('- THIS COURSE ALREADY SETS ITS EXERCISES IN `javascript`');
    const noCode = nodeBrief({ ...node, archetype: 'quantitative' }, [], false, null);
    expect(noCode).toContain('- ASSESSMENT KINDS THAT SUIT IT: numeric, short_answer');
    expect(noCode).not.toContain('code');
    expect(nodeBrief({ ...node, track: 'subtopic', mark: 'alternative' }, [], false, null)).toContain('- Badge: ALTERNATIVE');
  });

  it('user turn: brief, node, neighbours, no research, grounded chunk-id excerpts, steer, closing', () => {
    const chunks = [{ id: 37, material_id: 2, title: 'Week 7 - Trees.pdf', ordinal: 4, locator: 'Slide 14', page: 14, content: 'BST ordering.' }];
    const u = expandUser({ brief, lesson: node, allowsCode: true, codeLanguage: 'javascript', chunks, mandatory: ['explainer', 'diagram', 'analogy'],
      prerequisites: [{ title: 'Trees', summary: 'Vocabulary.' }], dependents: [{ title: 'AVL' }], instruction: 'Use the slide 14 example' });
    const order = ['LEARNER BRIEF', 'THE NODE YOU ARE WRITING', 'COMES IMMEDIATELY BEFORE THIS NODE (already taught — do not re-teach)\n- Trees — Vocabulary.',
      'COMES AFTER THIS NODE (do not teach it here)\n- AVL', 'RESEARCH RESULTS\nThe research stage found nothing usable', 'GROUNDING',
      "MATERIAL EXCERPTS (the learner's own source — cite by material_id)\n[material_id=37 · Week 7 - Trees.pdf · Slide 14]\nBST ordering.",
      "LEARNER'S REWRITE INSTRUCTION", '"Use the slide 14 example"', 'Write this node now.'];
    let at = -1;
    for (const part of order) { const i = u.indexOf(part); expect(i, part).toBeGreaterThan(at); at = i; }
  });

  it('chunk headers fall back to "chunk N" when there is no locator', () => {
    expect(materialExcerpts([{ id: 5, material_id: 1, title: '', ordinal: 3, locator: null, page: null, content: 'x' }]))
      .toContain('[material_id=5 · untitled material · chunk 3]');
  });

  it('schemas: enabled types only; rewrite pins one block of the type; higher-order only apply+', () => {
    const s = expandSchema();
    expect(s.properties.blocks.items.properties.type.enum).toEqual([...ENABLED_TYPES]);
    const r = rewriteSchema('walkthrough');
    expect([r.properties.blocks.minItems, r.properties.blocks.maxItems]).toEqual([1, 1]);
    expect(r.properties.blocks.items.properties.type.enum).toEqual(['walkthrough']);
    expect(expandSchema().properties.blocks.items.properties.type.enum).toEqual([...ENABLED_TYPES]);   // not mutated
    expect(higherOrderSystem()).toContain('You are the assessment designer for BiliMind.');
  });

  it('rewrite user: rewrite an existing part, or write a missing one', () => {
    const base = { brief, lesson: node, allowsCode: false, codeLanguage: null, chunks: [], otherParts: [{ type: 'explainer', excerpt: 'Keys go left.' }] };
    const re = rewriteUser({ ...base, type: 'diagram', current: { format: 'mermaid', source: 'graph TD' }, instruction: 'smaller' });
    expect(re).toContain('THE PART TO REWRITE — a `diagram` block. This is what it says now:\n{\n    "type": "diagram"');
    expect(re).toContain('Rewrite ONLY this part.');
    expect(re).toContain("THE OWNER'S REQUEST — this is what they asked for\n\n\"smaller\"");
    const add = rewriteUser({ ...base, type: 'analogy', current: null });
    expect(add).toContain('THE PART TO WRITE — a `analogy` block. The lesson does not have one yet');
    expect(add).toContain('Write ONLY this part.');
    expect(add).toContain('No specific instruction');
    expect(add).toContain('- explainer: Keys go left.');
  });

  it('format violation sentence and lesson digest', () => {
    expect(formatViolation(['explainer', 'quiz'], ['diagram'])).toBe('The lesson was missing a mandatory format: `diagram`. This node teaches a kind of knowledge that cannot be taught without it, so an explainer covering the same ground is not a substitute. You wrote: explainer, quiz. Keep those, and add what is missing.');
    const d = lessonDigest(sample('lesson-bst-reasoning.json').blocks);
    expect(d).toContain('## Explainer\n');
    expect(d).toContain('## Common misconception\n');
    const hu = higherOrderUser(brief, node, true, [{ kind: 'mcq', prompt: 'What is a BST?', bloom: 'remember' }], d);
    expect(hu).toContain('QUESTIONS ALREADY IN THIS LESSON (do not duplicate or paraphrase these)\n- [mcq · remember] What is a BST?');
    expect(courseBrief(brief)).not.toContain('per week');
  });
});
