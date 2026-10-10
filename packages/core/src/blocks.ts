// Block catalogue for the hackathon (engine-port.md §4, PLAN.md §3.2): enabled types, one zod schema per
// payload (the canonical shape AFTER normalisation; the normaliser in packages/engine folds aliases first),
// and the assessment item schemas. course-schema.ts builds course.json on top of these.
import { z } from 'zod';
import { BLOOM, GRADERS, ITEM_LABELS } from './types.ts';
import type { BlockType } from './types.ts';

// ---------- enabled set ----------
export const TIER_A = ['explainer', 'example', 'analogy', 'walkthrough', 'checklist', 'project', 'code', 'diagram', 'timeline',
  'comparison', 'reference_table', 'flashcards', 'scenario', 'worked_example', 'playground', 'speaking', 'dialogue', 'quiz'] as const;
export const TIER_B = ['key_points', 'misconception', 'audio', 'reflection'] as const;
/** Every type the schema enum, the prompt catalogue and the player accept (18 Tier A + 4 Tier B). */
export const ENABLED_TYPES = [...TIER_A, ...TIER_B] as const;
export type EnabledBlockType = typeof ENABLED_TYPES[number];
/** Removed from the schema enum AND the prompt catalogue, so the model never emits them. */
export const DISABLED_TYPES: readonly BlockType[] = ['illustration', 'annotated_media', 'video', 'resource', 'exam'];
export const isEnabledType = (t: unknown): t is EnabledBlockType => (ENABLED_TYPES as readonly string[]).includes(t as string);

/** Player component name for a type: worked_example -> "WorkedExampleBlock" (src/blocks/<Name>.vue). */
export const blockComponentName = (t: string): string =>
  t.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('') + 'Block';

/**
 * Learner-facing chrome per type (player-design.md §5.0): eyebrow text, sprite icon, whether it is a task
 * (lime icon tile), and how narration treats it. Never show the type id itself on screen.
 */
export const BLOCK_META: Record<EnabledBlockType, { eyebrow: string; icon: string; task: boolean; voice: 'read' | 'partial' | 'silent' }> = {
  explainer:       { eyebrow: '',                     icon: 'i-book',    task: false, voice: 'read' },
  example:         { eyebrow: 'Example',              icon: 'i-file',    task: false, voice: 'read' },
  analogy:         { eyebrow: 'Think of it like this', icon: 'i-bulb',   task: false, voice: 'read' },
  walkthrough:     { eyebrow: 'Step by step',         icon: 'i-steps',   task: false, voice: 'read' },
  checklist:       { eyebrow: 'Checklist',            icon: 'i-list',    task: true,  voice: 'silent' },
  project:         { eyebrow: 'Make it',              icon: 'i-rocket',  task: true,  voice: 'partial' },
  code:            { eyebrow: 'Try it',               icon: 'i-code',    task: true,  voice: 'silent' },
  diagram:         { eyebrow: 'Diagram',              icon: 'i-flow',    task: false, voice: 'partial' },
  timeline:        { eyebrow: 'How it got here',      icon: 'i-time',    task: false, voice: 'read' },
  comparison:      { eyebrow: 'Side by side',         icon: 'i-scales',  task: false, voice: 'partial' },
  reference_table: { eyebrow: 'Look it up',           icon: 'i-table',   task: false, voice: 'silent' },
  flashcards:      { eyebrow: 'Practice cards',       icon: 'i-cards',   task: true,  voice: 'silent' },
  scenario:        { eyebrow: 'What would you do?',   icon: 'i-target',  task: true,  voice: 'partial' },
  worked_example:  { eyebrow: 'Worked example',       icon: 'i-steps',   task: false, voice: 'partial' },
  playground:      { eyebrow: 'Try it',               icon: 'i-sliders', task: true,  voice: 'partial' },
  speaking:        { eyebrow: 'Say it',               icon: 'i-mic',     task: true,  voice: 'silent' },
  dialogue:        { eyebrow: 'Talk it through',      icon: 'i-speaker', task: true,  voice: 'partial' },
  quiz:            { eyebrow: 'Check yourself',       icon: 'i-quiz',    task: true,  voice: 'silent' },
  key_points:      { eyebrow: 'Key points',           icon: 'i-list',    task: false, voice: 'read' },
  misconception:   { eyebrow: 'Common mix-up',        icon: 'i-warning', task: false, voice: 'partial' },
  audio:           { eyebrow: 'Listen',               icon: 'i-speaker', task: false, voice: 'read' },
  reflection:      { eyebrow: 'Think about it',       icon: 'i-spark',   task: true,  voice: 'read' },
};

// ---------- payload schemas (thresholds = the normaliser's drop rules, engine-port §4 table) ----------
const str = z.string();
const text = z.string().min(1);
const optText = z.string().optional();

export const ExplainerPayload = z.object({ markdown: text });
export const KeyPointsPayload = z.object({ points: z.array(text).min(1).max(12) });
export const ExamplePayload = z.object({ title: text, markdown: text });
export const AnalogyPayload = z.object({ markdown: text, breaks_down_when: text });
export const MisconceptionPayload = z.object({ belief: text, why_it_seems_right: text, what_is_true: text, tell: optText });
export const WalkthroughPayload = z.object({
  intro: optText,
  steps: z.array(z.object({ n: z.number().int().min(1), title: text, detail_markdown: text, warning: optText, check: optText })).min(3).max(12),
});
export const ChecklistPayload = z.object({
  title: text,
  items: z.array(z.object({ text: z.string().min(1).max(300), why: optText })).min(3).max(14),
  note: optText,
});
export const ProjectPayload = z.object({ title: text, brief_markdown: text, deliverables: z.array(text).max(8) });

/** One code test. Which fields apply depends on the block's mode (see CodeTestRules). */
export const CodeTest = z.object({
  name: text,
  call: optText,                        // function/debug: ONE expression
  expect: z.unknown().optional(),       // function/debug: JSON value; script: printed text
  stdin: optText,                       // script (python)
  expect_table: z.object({ columns: z.array(str).optional(), rows: z.array(z.array(z.unknown())), ordered: z.boolean().optional() }).optional(),  // query
  selector: optText, min_count: z.number().int().optional(), text_contains: optText,             // build
  attribute: z.object({ name: text, value: optText }).optional(),
});
export const CodePayload = z.object({
  mode: z.enum(['function', 'script', 'debug', 'query', 'build']),
  language: z.enum(['javascript', 'python', 'sql', 'html']),
  starter_code: str,
  instructions_markdown: text,
  tests: z.array(CodeTest).max(12),
  hints: z.array(z.string().max(200)).max(3).optional(),
  symptom_markdown: optText,
  setup_sql: z.string().max(8000).optional(),
  requirements: z.array(str).optional(),
}).superRefine((p, ctx) => {
  if ((p.mode === 'function' || p.mode === 'debug') && p.tests.some(t => !t.call))
    ctx.addIssue({ code: 'custom', message: `${p.mode} tests need a \`call\` expression`, path: ['tests'] });
  if ((p.mode === 'function' || p.mode === 'debug' || p.mode === 'script') && p.tests.some(t => !('expect' in t) || t.expect === undefined))
    ctx.addIssue({ code: 'custom', message: `${p.mode} tests need an \`expect\` value (null is allowed)`, path: ['tests'] });
  if (p.mode === 'query' && p.tests.some(t => !t.expect_table)) ctx.addIssue({ code: 'custom', message: 'query tests need `expect_table`', path: ['tests'] });
  if (p.mode === 'build' && p.tests.some(t => !t.selector)) ctx.addIssue({ code: 'custom', message: 'build tests need a `selector`', path: ['tests'] });
  if (new Set(p.tests.map(t => t.name)).size !== p.tests.length)
    ctx.addIssue({ code: 'custom', message: 'test names must be unique (grading counts passed names)', path: ['tests'] });
  if (p.mode === 'debug' && !p.symptom_markdown) ctx.addIssue({ code: 'custom', message: 'debug mode needs symptom_markdown', path: ['symptom_markdown'] });
  if (p.mode === 'query' && !p.setup_sql) ctx.addIssue({ code: 'custom', message: 'query mode needs setup_sql', path: ['setup_sql'] });
});
export const DiagramPayload = z.object({
  format: z.literal('mermaid'),
  source: text,
  caption: optText,
  alt_text: text,
  svg: optText,                         // P1: pre-rendered SVG markup (build.ts); the player prefers it when present
});
export const TimelinePayload = z.object({
  events: z.array(z.object({
    when: z.string().min(1).max(60), title: text, detail: str,
    turning: z.boolean().optional(),    // player extra (player-design §5.11), not in the model catalogue
  })).min(3).max(12),
});
export const ComparisonPayload = z.object({
  intro: optText,
  axes: z.array(text).min(2).max(6),
  items: z.array(z.object({ name: text, values: z.array(str), best_for: optText })).min(2).max(5),
}).refine(p => p.items.every(i => i.values.length === p.axes.length), { message: 'every comparison item needs exactly one value per axis', path: ['items'] });
export const ReferenceTablePayload = z.object({
  title: text,
  columns: z.array(text).min(2).max(8),
  rows: z.array(z.array(str)).min(2).max(20),
  note: optText,
}).refine(p => p.rows.every(r => r.length === p.columns.length), { message: 'every reference_table row needs one cell per column', path: ['rows'] });
export const FlashcardsPayload = z.object({ cards: z.array(z.object({ front: text, back: text })).min(1).max(20) });
export const ScenarioPayload = z.object({
  setup_markdown: text,
  steps: z.array(z.object({
    id: text,
    prompt: text,
    options: z.array(z.object({ id: text, text: text, outcome_markdown: text, correct: z.boolean(), next_id: z.string().nullable().optional() })).min(2).max(5),
  })).min(1).max(6),
  debrief_markdown: optText,
});
export const WorkedExamplePayload = z.object({
  problem_markdown: text,
  steps: z.array(z.object({ expression: text, explanation: str })).min(2).max(12),
  answer: text,
  common_mistakes: z.array(str).max(5),
});
export const PlaygroundPayload = z.object({
  inputs: z.array(z.object({
    key: z.string().regex(/^[a-z_][a-z0-9_]{0,31}$/),
    label: text, min: z.number(), max: z.number(), step: z.number().positive(), default: z.number(), unit: optText,
  }).refine(i => i.max > i.min, { message: 'max must be above min' })).min(1).max(3),
  formula_js: text,                     // exactly `function compute(i) { return ...; }` (isSafeFormula, engine validate/playground.ts)
  output_label: text,
  output_unit: optText,
  guidance_markdown: text,
  /**
   * Player extra (player-design §5.14), optional, not in the model catalogue unless WP2 adds it: crossing
   * `input <op> value` marks the block passed and shows "You found it: <say>".
   */
  discover: z.object({ input: text, op: z.enum(['>', '>=', '<', '<=']), value: z.number(), say: text }).optional(),
}).superRefine((p, ctx) => {
  const keys = p.inputs.map(i => i.key);
  if (new Set(keys).size !== keys.length) ctx.addIssue({ code: 'custom', message: 'playground input keys must be unique', path: ['inputs'] });
  if (p.discover && !keys.includes(p.discover.input)) ctx.addIssue({ code: 'custom', message: 'discover.input must be one of the input keys', path: ['discover', 'input'] });
});
export const SpeakingPayload = z.object({
  intro_markdown: optText,
  language: text,                       // the language the learner SPEAKS ('ms', 'en')
  items: z.array(z.object({
    text: z.string().min(1).max(240), translation: optText, phonetic: optText,
    audio: optText,                     // narrate: 'audio/<hash>.mp3' native-voice clip
  })).min(2).max(12),
  voice_hint: optText,
  voice: optText,                       // narrate: Edge voice id used, e.g. 'ms-MY-YasminNeural'
});
export const DialoguePayload = z.object({
  scenario_markdown: text,
  language: text,
  ai_role: text,
  learner_role: text,
  goal: text,
  opening_line: optText,
  opening_audio: optText,               // narrate: 'audio/<hash>.mp3' (opening line voiced)
  hints: z.array(str).max(6).optional(),
});
export const QuizPayload = z.object({ intro: optText });
export const AudioPayload = z.object({
  script_markdown: text,
  voice_hint: optText,
  duration_estimate_s: z.number().min(0),
  language: text,
  src: optText,                         // narrate: 'audio/<hash>.mp3' when rendered as its own clip
});
export const ReflectionPayload = z.object({ prompt: text });

export const PAYLOAD_SCHEMAS = {
  explainer: ExplainerPayload, example: ExamplePayload, analogy: AnalogyPayload, walkthrough: WalkthroughPayload,
  checklist: ChecklistPayload, project: ProjectPayload, code: CodePayload, diagram: DiagramPayload,
  timeline: TimelinePayload, comparison: ComparisonPayload, reference_table: ReferenceTablePayload,
  flashcards: FlashcardsPayload, scenario: ScenarioPayload, worked_example: WorkedExamplePayload,
  playground: PlaygroundPayload, speaking: SpeakingPayload, dialogue: DialoguePayload, quiz: QuizPayload,
  key_points: KeyPointsPayload, misconception: MisconceptionPayload, audio: AudioPayload, reflection: ReflectionPayload,
} as const satisfies Record<EnabledBlockType, z.ZodType>;

/** Payload type for a given block type, e.g. PayloadOf<'code'>. */
export type PayloadOf<T extends EnabledBlockType> = z.infer<(typeof PAYLOAD_SCHEMAS)[T]>;

/** Validate one payload; returns readable issues ("steps: Too small ...") or []. */
export function payloadIssues(type: string, payload: unknown): string[] {
  if (!isEnabledType(type)) return [`type \`${type}\` is not enabled`];
  const r = (PAYLOAD_SCHEMAS[type] as z.ZodType).safeParse(payload);
  return r.success ? [] : r.error.issues.map(i => `${i.path.join('.') || '(payload)'}: ${i.message}`);
}

// ---------- citations (resolved by build.ts from chunk ids; engine-port §6) ----------
/**
 * A citation chip. Never shown without a quote (player-design §5.17).
 * `file` is relative to the course folder and is also the key into course.sources[].file.
 */
export const CiteSchema = z.object({
  file: text,                           // "sources/lecture-4-hashing.pdf"
  locator: text,                        // "Page 12", "Slide 14", "2.1 Binary search trees"
  page: z.number().int().min(1).nullable().optional(),   // for sources/<file>#page=N
  quote: text,                          // the verbatim phrase (Checker quote, or the chunk sentence the block used)
  excerpt: str,                         // up to ~700 chars of the chunk around the quote, shown in the popover
  chunk_id: z.number().int().optional(),
});
export type Cite = z.infer<typeof CiteSchema>;

// ---------- assessment items (engine-port §4.2) ----------
export const OptionSchema = z.object({ id: z.string().min(1).max(8), text: z.string().min(1).max(600) });
export const RubricRowSchema = z.object({
  criterion: text, weight: z.number().min(0).max(1), excellent: text, acceptable: text, poor: text,
});
const itemBase = {
  id: text,                                         // "q1".. unique inside the lesson
  prompt: text,
  bloom: z.enum(BLOOM),
  grader: z.enum(GRADERS),
  max_score: z.number().int().min(1).max(100),
  rubric: z.array(RubricRowSchema).min(2).max(4).optional(),
  // course.json extras (set by verdict/build; absent in drafts)
  explanation: optText,                             // supported: the quote, shown after submit with its chip
  cites: z.array(CiteSchema).optional(),
  labels: z.array(z.enum(ITEM_LABELS)).optional(), // "beyond_slides" when the Checker ruled not_covered
  verdict: z.enum(['supported', 'not_covered', 'pending', 'unchecked']).optional(),
};

const optionIdsExist = (a: { options: { id: string }[]; answer_key: { correct_option_ids: string[] } }) =>
  a.answer_key.correct_option_ids.every(id => a.options.some(o => o.id === id));

export const McqItem = z.object({
  ...itemBase, kind: z.literal('mcq'),
  options: z.array(OptionSchema).min(2).max(8),
  answer_key: z.object({ correct_option_ids: z.array(text).length(1) }),
}).refine(optionIdsExist, { message: 'mcq correct id must be one of the options', path: ['answer_key'] });
export const MultiSelectItem = z.object({
  ...itemBase, kind: z.literal('multi_select'),
  options: z.array(OptionSchema).min(2).max(8),
  answer_key: z.object({ correct_option_ids: z.array(text).min(1) }),
}).refine(optionIdsExist, { message: 'multi_select correct ids must be options', path: ['answer_key'] });
export const OrderingItem = z.object({
  ...itemBase, kind: z.literal('ordering'),
  options: z.array(OptionSchema).min(2).max(8),     // presented (scrambled) order
  answer_key: z.object({ correct_order: z.array(text).min(2) }),
}).refine(a => a.answer_key.correct_order.length === a.options.length
  && new Set(a.answer_key.correct_order).size === a.options.length
  && a.answer_key.correct_order.every(id => a.options.some(o => o.id === id)),
{ message: 'correct_order must list every option id exactly once', path: ['answer_key', 'correct_order'] });
export const NumericItem = z.object({
  ...itemBase, kind: z.literal('numeric'),
  answer_key: z.object({ value: z.number().finite(), tolerance: z.number().min(0).optional(), unit: z.string().nullable().optional() }),
});
export const ClozeItem = z.object({
  ...itemBase, kind: z.literal('cloze'),            // prompt carries one ____ blank (check Q8)
  answer_key: z.object({ accepted: z.array(text).min(1) }),
});
const selfMarked = <K extends 'short_answer' | 'essay' | 'project'>(k: K) => z.object({
  ...itemBase, kind: z.literal(k),
  answer_key: z.object({ reference_answer: optText }).optional(),
});
export const ShortAnswerItem = selfMarked('short_answer');
export const EssayItem = selfMarked('essay');
export const ProjectItem = selfMarked('project');
export const CodeItem = z.object({
  ...itemBase, kind: z.literal('code'),
  answer_key: z.object({ reference_solution: optText, tests: z.array(str).optional() }),   // tests DERIVED from the block's tests[].name
});

export const ASSESSMENT_SCHEMAS = {
  mcq: McqItem, multi_select: MultiSelectItem, ordering: OrderingItem, numeric: NumericItem, cloze: ClozeItem,
  short_answer: ShortAnswerItem, essay: EssayItem, project: ProjectItem, code: CodeItem,
} as const;

/** Any assessment item, by kind (zod 4 discriminated union works with refined members). */
export const AssessmentItemSchema = z.discriminatedUnion('kind', [
  McqItem, MultiSelectItem, OrderingItem, NumericItem, ClozeItem, ShortAnswerItem, EssayItem, ProjectItem, CodeItem,
]);
export type AssessmentItem = z.infer<typeof AssessmentItemSchema>;
