// Verbatim port of backend/app/Enums/ConceptArchetype.php (engine-port.md §2), the outline variety
// gate (§2.1), tracks and marks (§2.2), plus the learner words and icons (player-design.md §2.1).
// "The agents decide what to teach and when. Our code decides how each kind of knowledge must be taught."
import { ARCHETYPES } from './types.ts';
import type { Archetype, BlockType, AssessmentKind } from './types.ts';

export const FORMATS: Record<Archetype, BlockType[]> = {          // MANDATORY, enforced by the expander
  procedural:      ['walkthrough', 'checklist'],
  conceptual:      ['explainer', 'diagram', 'analogy'],
  factual:         ['flashcards', 'reference_table'],
  discriminative:  ['comparison', 'example'],
  diagnostic:      ['scenario', 'diagram'],
  quantitative:    ['worked_example', 'playground'],
  spatial:         ['diagram', 'annotated_media'],     // annotated_media -> walkthrough when no research image (mandatoryFormats)
  evolutionary:    ['timeline', 'explainer'],
  performance:     ['project', 'checklist'],
  safety_critical: ['checklist', 'scenario'],
  communicative:   ['speaking', 'dialogue'],
};

const COMMON: BlockType[] = ['key_points', 'video', 'resource', 'audio', 'speaking', 'dialogue'];

export const OPTIONAL_RAW: Record<Archetype, BlockType[]> = {      // the writer's menu (1-3 of these), never validated
  procedural:      ['example', 'code', 'diagram', ...COMMON],
  conceptual:      ['example', 'reflection', 'scenario', 'illustration', 'misconception', ...COMMON],
  factual:         ['explainer', 'example', 'timeline', ...COMMON],
  discriminative:  ['reference_table', 'scenario', 'explainer', 'illustration', 'misconception', ...COMMON],
  diagnostic:      ['checklist', 'example', 'reference_table', 'misconception', ...COMMON],
  quantitative:    ['explainer', 'code', 'reference_table', ...COMMON],
  spatial:         ['explainer', 'walkthrough', 'reference_table', 'illustration', ...COMMON],
  evolutionary:    ['comparison', 'reflection', 'example', ...COMMON],
  performance:     ['walkthrough', 'example', 'reflection', ...COMMON],
  safety_critical: ['reference_table', 'walkthrough', 'annotated_media', 'illustration', ...COMMON],
  communicative:   ['flashcards', 'explainer', 'example', ...COMMON],
};
/** The optional menu with the mandatory ones removed (filter by ENABLED_TYPES before prompting). */
export const optionalFormats = (a: Archetype): BlockType[] =>
  OPTIONAL_RAW[a].filter(t => !FORMATS[a].includes(t));

export const ASSESSMENT_BIAS: Record<Archetype, AssessmentKind[]> = {   // fed to the writer as a bias; the 40% MCQ cap makes it bite
  procedural:      ['ordering', 'short_answer', 'project'],
  conceptual:      ['short_answer', 'mcq', 'essay'],
  factual:         ['cloze', 'mcq', 'multi_select'],
  discriminative:  ['multi_select', 'short_answer', 'mcq'],
  diagnostic:      ['short_answer', 'ordering', 'multi_select'],
  quantitative:    ['numeric', 'code', 'short_answer'],
  spatial:         ['mcq', 'short_answer', 'cloze'],
  evolutionary:    ['ordering', 'short_answer', 'mcq'],
  performance:     ['project', 'essay'],
  safety_critical: ['multi_select', 'short_answer', 'ordering'],
  communicative:   ['short_answer', 'cloze', 'mcq'],
};

/**
 * Mandatory formats for the hackathon: FORMATS[a] with annotated_media -> walkthrough
 * (we run no research stage, so there is never an image to annotate). NodeExpander::mandatoryFormats.
 */
export const mandatoryFormats = (a: Archetype): BlockType[] =>
  FORMATS[a].map(t => (t === 'annotated_media' ? 'walkthrough' : t)).filter((t, i, xs) => xs.indexOf(t) === i);

/**
 * planned = mandatory + 'quiz', unless a mandatory format already carries assessments (project/code/quiz/exam).
 * HACKATHON: built on mandatoryFormats (not FORMATS) so spatial never plans the disabled annotated_media.
 */
export const plannedBlockTypes = (a: Archetype): BlockType[] => {
  const m = mandatoryFormats(a);
  return m.some(t => ['quiz', 'exam', 'project', 'code'].includes(t)) ? [...m] : [...m, 'quiz'];
};

export const TEST: Record<Archetype, string> = {   // "true when ..." line the outline model applies to its own summary
  procedural:      'the learner has to DO a sequence of steps in order, and doing them out of order fails',
  conceptual:      'the learner has to understand WHY something behaves as it does before any of it makes sense',
  factual:         'there is a body of terms, values or standards that must simply be known cold',
  discriminative:  'there are two or more options and the whole skill is knowing which one to reach for',
  diagnostic:      'the learner is handed symptoms and has to work backwards to the cause',
  quantitative:    'there is a formula, a calculation or a model with numbers that must come out right',
  spatial:         'the learner has to know where things sit relative to each other — layout, anatomy, wiring, structure',
  evolutionary:    'the current state only makes sense once you know how it got here, and what it replaced',
  performance:     'the learner builds, delivers or performs the real thing end to end and it gets judged',
  safety_critical: 'getting this wrong injures somebody, destroys equipment, or loses data that does not come back',
  communicative:   'the learner has to produce spoken language and be understood in a real exchange — the skill is in the mouth and ear, not on the page',
};

export const WRITING_NOTE: Record<Archetype, string> = {   // fed to the lesson writer: what is most often got wrong
  procedural:      'Number every step and put the thing that goes wrong at each step next to it. The checklist is what the learner keeps open while they work, so it must be checkable in the field, not a summary of the walkthrough.',
  conceptual:      'The diagram carries the mechanism; do not describe in prose what the diagram already shows. The analogy must name where it BREAKS — an analogy without its limit teaches a misconception.',
  factual:         'Flashcards are cue → answer, never cue → paragraph. The reference table is what the learner comes back to in six months; sort it the way they will look things up, not the way you introduced them.',
  discriminative:  'The comparison axes must be the ones that actually decide the choice. "Popularity" and "ease of use" decide nothing. Every item needs a `best_for` naming the situation where it wins.',
  diagnostic:      'The scenario must start from the symptom, exactly as it presents in real life, not from the cause. The diagram is a decision tree: symptom at the top, checks as branches, causes at the leaves.',
  quantitative:    'Every step of the worked example shows the expression before the result. The playground must have something worth discovering when a value is dragged — a threshold, a reversal, a diminishing return — and the guidance names it.',
  spatial:         'The diagram is the lesson, not a decoration. Every hotspot on annotated media must say something the label alone does not.',
  evolutionary:    'Each timeline event states what changed AND what problem it solved. Dates without consequences are trivia.',
  performance:     'The brief must be specific enough that two learners could produce different good answers, and the rubric must be able to tell both apart from a bad one. The checklist is what they check before submitting.',
  safety_critical: 'State the consequence in concrete terms — what the current does to a heart, what the pressure does to a weld. The scenario puts them in the moment where the shortcut is tempting.',
  communicative:   'Write full utterances people actually say, not textbook sentences — greetings, requests, the phrase you need in the moment. The dialogue must have a goal the learner can only reach by producing the target language, and the AI stays in character and corrects gently, after the exchange, not mid-sentence.',
};

export const LABEL: Record<Archetype, string> = {
  procedural: 'Procedure', conceptual: 'Concept', factual: 'Facts', discriminative: 'Choosing between',
  diagnostic: 'Diagnosis', quantitative: 'Calculation', spatial: 'Layout', evolutionary: 'How it got here',
  performance: 'Do it for real', safety_critical: 'Safety', communicative: 'Speaking',
};

/** Learner words for the lesson's kind tag (player-design.md §2.1). Never show the archetype id itself. */
export const LEARNER_TAG: Record<Archetype, { tag: string; icon: string; object: string }> = {
  procedural:      { tag: 'A skill you do',           icon: 'i-steps',   object: 'obj-check' },
  conceptual:      { tag: 'An idea to get',           icon: 'i-bulb',    object: 'obj-book' },
  factual:         { tag: 'Stuff to memorise',        icon: 'i-cards',   object: 'obj-docs' },
  discriminative:  { tag: 'Two things you mix up',    icon: 'i-scales',  object: 'obj-globe' },
  quantitative:    { tag: 'Numbers to feel',          icon: 'i-sliders', object: 'obj-calendar' },
  communicative:   { tag: 'Said out loud',            icon: 'i-mic',     object: 'obj-mic' },
  spatial:         { tag: 'A picture to read',        icon: 'i-image',   object: 'obj-globe' },
  diagnostic:      { tag: 'A problem to diagnose',    icon: 'i-target',  object: 'obj-check' },
  evolutionary:    { tag: 'How it got here',          icon: 'i-time',    object: 'obj-calendar' },
  performance:     { tag: 'Something to make',        icon: 'i-rocket',  object: 'obj-rocket' },
  safety_critical: { tag: 'Get it right first time',  icon: 'i-warning', object: 'obj-check' },
};

/** Lenient parse (models emit 'Procedural', 'procedural knowledge', 'safety critical'). */
export function parseArchetype(v: unknown): Archetype | null {
  if (typeof v !== 'string') return null;
  const n = v.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/_?(knowledge|node|type|archetype)$/, '');
  return (ARCHETYPES as readonly string[]).includes(n) ? (n as Archetype) : null;
}
/** GraphBuilder::FALLBACK_ARCHETYPE */
export const FALLBACK_ARCHETYPE: Archetype = 'conceptual';

// ---------- §2.1 outline distribution gate (OutlineVariety.php) ----------
export const VARIETY = { SMALL_COURSE: 10, MIN_DISTINCT_ARCHETYPES: 5, MAX_ARCHETYPE_SHARE: 0.40, MAX_PLAIN_SHARE: 0.30 } as const;

const render = (counts: [string, number][]) => 'you used: ' + counts.map(([a, c]) => `${a}×${c}`).join(', ') + '.';

/**
 * Returns the FIRST violated rule only, or null. With `strictSmall` (HACKATHON default) a course
 * under 10 nodes still gets rules 3 and 4 (<= 40% share, a performance/communicative node).
 * On the Lead's keep/cut selection this is a warning, not a block (PLAN §3.1).
 */
export function varietyViolation(nodes: { title?: string; archetype?: string }[], opts = { strictSmall: true }): string | null {
  const arch = nodes.filter(n => n.title?.trim()).map(n => parseArchetype(n.archetype) ?? 'conceptual');
  const total = arch.length; if (!total) return null;
  const counts = [...arch.reduce((m, a) => m.set(a, (m.get(a) ?? 0) + 1), new Map<string, number>())].sort((x, y) => y[1] - x[1]);
  const distinct = counts.length;
  if (total < VARIETY.SMALL_COURSE && !opts.strictSmall) {
    return distinct >= 3 ? null
      : `A ${total}-node course used only ${distinct} distinct archetype${distinct === 1 ? '' : 's'} (${render(counts)}). Even a short course teaches more than one kind of knowledge.`;
  }
  const minDistinct = total < VARIETY.SMALL_COURSE ? 3 : VARIETY.MIN_DISTINCT_ARCHETYPES;
  if (distinct < minDistinct) return `Only ${distinct} distinct archetypes were used across ${total} nodes (${render(counts)}); at least ${minDistinct} are required. `
    + 'Look again at the nodes you labelled the same way: some of them are really about choosing between options, some are procedures, some are facts to be memorised, and at least one should have the learner produce something real.';
  const [dominant, dominantCount] = counts[0]!;
  const limit = Math.floor(total * VARIETY.MAX_ARCHETYPE_SHARE);
  if (dominantCount > limit) return `\`${dominant}\` was used on ${dominantCount} of ${total} nodes (${Math.round(dominantCount / total * 100)}%), above the 40% ceiling — at most ${limit} may carry it. `
    + `${render(counts)} Re-examine every \`${dominant}\` node and ask what the learner actually has to be able to do at the end of it; several of them will turn out to be a different kind of knowledge.`;
  if (!arch.includes('performance') && !arch.includes('communicative'))
    return 'No node is a `performance` node. A course where the learner never once builds, delivers or performs the real thing has taught them about the subject rather than taught them the subject. The capstone is the obvious candidate; there is usually a second one earlier.';
  return null;
}

// ---------- §2.2 tracks and marks (rendered into the outline prompt) ----------
export const TRACK = {
  core:     { rule: 'it is one of the numbered topics of the course, and a later topic (or the capstone) genuinely cannot be followed without it',
              blurb: 'Follow these in order — each one is assumed by the next.' },
  subtopic: { rule: 'it hangs off a topic: a sub-skill the topic is made of, a tool or alternative the learner chooses between, or a side lesson worth having beside it. It has its own lesson and is never itself a numbered step',
              blurb: 'What a step covers. Tied to it with a dotted line; a badge says how to treat it.',
              writingContext: 'a subtopic hanging off a topic. The learner reaches it having already opened that topic, so teach THIS thing narrowly and completely rather than re-introducing the wider subject.' },
} as const;
/** Badge colours mapped to cobalt tokens: recommended = cobalt, alternative = lime (ink text), anytime = grey. */
export const MARK = {
  recommended: { label: 'Recommended',   blurb: 'Our pick — do this one.',                      color: '#2340E6',
                 rule: 'of several options under a topic, this is the one you would tell a mentee to take' },
  alternative: { label: 'Alternative',   blurb: 'Pick this or the recommended one, not both.',  color: '#C6F24E',
                 rule: 'it is another option to the recommended one; the learner does ONE of them, not all' },
  anytime:     { label: 'Learn anytime', blurb: 'Order not strict. Come back to it whenever.',  color: '#929292',
                 rule: 'it can be read at any point without anything else suffering — a curiosity, a history, a niche case' },
} as const;
