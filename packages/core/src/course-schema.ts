// course.json: the player contract (player-design.md §1.3, reconciled with the engine types).
// `bilimind build` assembles it, validates it here, and pastes it into templates/player.html;
// the player validates the same object at boot. snake_case everywhere, like the SaaS payloads.
//
// Unknown keys are tolerated (zod strips them on parse), so a lane may add a field without breaking
// validation; add it here + in CHANGELOG.md when another lane must rely on it.
import { z } from 'zod';
import { ARCHETYPES, AUDIENCES, BLOCK_TYPES, CODE_LANGUAGES, FILE_KINDS, FILE_ROLES, MARKS, SKINS, TRACKS } from './types.ts';
import { AssessmentItemSchema, CiteSchema, ENABLED_TYPES, PAYLOAD_SCHEMAS, isEnabledType } from './blocks.ts';
import type { EnabledBlockType } from './blocks.ts';

export { CiteSchema };
export type { Cite } from './blocks.ts';

export const COURSE_SCHEMA_VERSION = 'bilimind.course/1' as const;

const text = z.string().min(1);
const optText = z.string().optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const isoDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'expected an ISO datetime');

// ---------- blocks ----------
const blockBase = {
  id: z.string().regex(/^b\d+$/, 'block ids are b1, b2, ...'),   // unique in the lesson; narration cue ids are `<id>.<n>`
  title: z.string().nullable().optional(),                       // block title (explainer heading, example title, ...)
  cites: z.array(CiteSchema),                                     // [] when the block has no source (then no chip)
};
const blockOf = <T extends EnabledBlockType>(t: T) => z.object({
  ...blockBase,
  type: z.literal(t),
  payload: PAYLOAD_SCHEMAS[t],
  assessments: z.array(AssessmentItemSchema),                     // only quiz/project/code carry items; [] elsewhere
});
/** One rendered block: discriminated on `type`, payload typed per type (see blocks.ts PayloadOf). */
export const CourseBlockSchema = z.discriminatedUnion('type', [
  blockOf('explainer'), blockOf('example'), blockOf('analogy'), blockOf('walkthrough'), blockOf('checklist'),
  blockOf('project'), blockOf('code'), blockOf('diagram'), blockOf('timeline'), blockOf('comparison'),
  blockOf('reference_table'), blockOf('flashcards'), blockOf('scenario'), blockOf('worked_example'),
  blockOf('playground'), blockOf('speaking'), blockOf('dialogue'), blockOf('quiz'),
  blockOf('key_points'), blockOf('misconception'), blockOf('audio'), blockOf('reflection'),
]);
export type CourseBlock = z.infer<typeof CourseBlockSchema>;
export type CourseAssessment = z.infer<typeof AssessmentItemSchema>;
/** Narrow a block by type: `if (isBlock(b, 'code')) b.payload.tests`. */
export const isBlock = <T extends EnabledBlockType>(b: CourseBlock, t: T): b is Extract<CourseBlock, { type: T }> => b.type === t;

// ---------- narration ----------
export const NarrationSentenceSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+\.\d+$/i, 'cue ids are <blockId>.<sentenceIndex>, e.g. b1.0 (title.0 for the lesson title)'),
  start_ms: z.number().min(0),
  end_ms: z.number().min(0),
});
export const NarrationSchema = z.object({
  src: text,                                    // 'audio/<hash>.mp3' (relative to index.html)
  duration_ms: z.number().min(0),
  voice: optText,                               // 'en-US-AndrewMultilingualNeural'
  sentences: z.array(NarrationSentenceSchema),  // in playback order; ids from core/sentences.ts lessonSentences()
  peaks: z.object({ hz: z.number().positive(), values: z.array(z.number().min(0).max(1)) }).optional(),  // waveform (0..1)
});
export type Narration = z.infer<typeof NarrationSchema>;
export type NarrationSentence = z.infer<typeof NarrationSentenceSchema>;

// ---------- lessons ----------
export const CourseLessonSchema = z.object({
  id: text,                                     // the outline key, e.g. 'hash_tables'; route #/l/<id>
  n: z.number().int().min(1),                   // 1-based lesson number (file names lessons/NN-<id>.md)
  title: text,
  summary: z.string(),
  archetype: z.enum(ARCHETYPES),                // show LEARNER_TAG[archetype], never the id
  minutes: z.number().min(1),
  track: z.enum(TRACKS),
  parent: z.string().nullable(),                // parent topic key for a subtopic
  mark: z.enum(MARKS).nullable(),
  section: z.string().nullable().optional(),
  day: isoDate.nullable(),                      // planned study day
  formats: z.array(z.enum(BLOCK_TYPES)),        // planned formats (mandatory + quiz) from the archetype
  thin: z.boolean().optional(),                 // few supporting source words: the lesson says so
  blocks: z.array(CourseBlockSchema).min(1),
  narration: NarrationSchema.nullable(),        // null => dock hidden, orb says "Narration not ready"
});
export type CourseLesson = z.infer<typeof CourseLessonSchema>;

// ---------- path (the roadmap) ----------
export const PathItemSchema = z.object({
  id: text,                                     // subtopic key
  title: text,
  mark: z.enum(MARKS).nullable(),
  lesson: z.string().nullable(),                // lesson id, null when cut
  group: z.string().nullable(),
  minutes: z.number().optional(),
  cut: z.boolean().optional(),
});
export const PathTopicSchema = z.object({
  id: text,                                     // topic key
  step: z.number().int().min(1),
  title: text,
  section: z.string().nullable(),               // chapter pill on the spine
  lesson: z.string().nullable(),                // lesson id, null when cut
  minutes: z.number(),
  note: z.string().nullable(),                  // mentor note beside the topic
  summary: optText,                             // one line for the brief popover (outline summary; also for cut topics)
  archetype: z.enum(ARCHETYPES),
  formats: z.array(z.enum(BLOCK_TYPES)),        // up to three icons on the milestone
  weight: z.number().min(0).max(1).nullable(),  // share of past-paper marks, null when no past paper
  cut: z.boolean(),                             // shown greyed with the reason
  cut_reason: z.string().nullable(),
  items: z.array(PathItemSchema),               // subtopics on dotted ties
});
export type PathTopic = z.infer<typeof PathTopicSchema>;
export type PathItem = z.infer<typeof PathItemSchema>;

// ---------- goal + plan ----------
export const CourseGoalSchema = z.object({
  sentence: z.string(),                         // the user's own sentence
  exam_at: isoDateTime.nullable(),              // '2026-10-14T09:00:00+08:00'
  deadline: isoDate.nullable(),
  minutes_per_day: z.number().min(1),
  audience: z.enum(AUDIENCES),
  assumptions: z.array(z.string()),
  timezone: optText,                            // 'Asia/Kuala_Lumpur': show exam weekday/time in this zone, not the browser's
});
export type CourseGoal = z.infer<typeof CourseGoalSchema>;
export const PlanDaySchema = z.object({
  date: isoDate,
  lessons: z.array(z.string()),                 // lesson ids planned that day
  reviews: z.number().int().min(0),             // cards due that day (from review/state.json)
  minutes: z.number().min(0),
  exam: z.boolean().optional(),                 // the exam day (lime card)
  label: optText,                               // "Exam 9:00"
});
export type PlanDay = z.infer<typeof PlanDaySchema>;
export const TopicWeightSchema = z.object({ key: text, title: text, marks: z.number(), share: z.number().min(0).max(1), questions: z.array(z.string()) });
export const CoursePlanSchema = z.object({
  days: z.array(PlanDaySchema),
  weights: z.array(TopicWeightSchema),          // from exam-map; [] without a past paper
  cut: z.array(z.object({ key: text, title: text, reason: text })),
  capacity_min: z.number().min(0),
  used_min: z.number().min(0),
  warnings: z.array(z.string()),
});
export type CoursePlan = z.infer<typeof CoursePlanSchema>;

// ---------- receipts ("Checked before you saw it") ----------
export const ReceiptLogLineSchema = z.object({
  t: z.string(),                                // 'HH:MM:SS' local time of the event
  agent: text,                                  // 'Writer · Hashing'
  action: text,                                 // 'check'
  result: z.string(),                           // '15/15 checks, repaired: added walkthrough'
});
export const ExcludedItemSchema = z.object({
  lesson: text,
  item: text,                                   // the item's id at the time
  prompt: text,
  reason: text,                                 // the Checker's reason
  quote: optText,                               // the deciding quote
  cite: CiteSchema.optional(),
  replaced_by: z.string().nullable().optional(), // id of the rewritten item, if any
});
export type ReceiptLogLine = z.infer<typeof ReceiptLogLineSchema>;
export type ExcludedItem = z.infer<typeof ExcludedItemSchema>;
export const ReceiptsSchema = z.object({
  files: z.number().int().min(0),
  pages: z.number().int().min(0),
  steps: z.number().int().min(0),               // topics planned on the path
  lessons: z.number().int().min(0),
  agents: z.number().int().min(0),
  checks: z.object({ run: z.number().int(), passed: z.number().int(), repaired: z.number().int(), flagged: z.number().int() }),
  tests: z.object({ run: z.number().int(), passed: z.number().int() }),   // code tests against reference solutions
  code_fixed: z.number().int().min(0),          // exercises the Coder fixed
  quiz_checked: z.number().int().min(0),        // items the Checker ruled on
  rejected: z.number().int().min(0),            // contradicted items
  rewritten: z.number().int().min(0),
  labels: z.object({ beyond_slides: z.number().int().min(0) }),
  narration_min: z.number().min(0),
  cards: z.number().int().min(0),               // flashcards + cloze items (Anki)
  minutes: z.number().min(0),                   // total study minutes
  cost_usd: z.number().min(0),
  credits: z.number().nullable(),               // WorkBuddy credits when known
  wall_ms: z.number().min(0),
  log: z.array(ReceiptLogLineSchema),           // "See what each agent did"
  excluded: z.array(ExcludedItemSchema),        // items that never reached the course
});
export type Receipts = z.infer<typeof ReceiptsSchema>;

// ---------- sources, exports, review ----------
export const CourseSourceSchema = z.object({
  id: text,                                     // 's1'
  title: text,
  short: optText,                               // chip label, e.g. 'L4' -> chip "L4 · p.12" (player derives one when absent)
  file: text,                                   // 'sources/lecture-4-hashing.pdf' (matches Cite.file)
  kind: z.enum(FILE_KINDS),
  role: z.enum(FILE_ROLES),
  pages: z.number().int().min(0),
  cited: z.number().int().min(0),
  license: optText,
});
export type CourseSource = z.infer<typeof CourseSourceSchema>;
export const CourseExportSchema = z.object({
  kind: z.enum(['ics', 'anki_csv', 'apkg', 'markdown', 'report', 'plan']),
  label: text,                                  // 'Study plan .ics'
  file: text,                                   // 'reviews.ics'
});
export type CourseExport = z.infer<typeof CourseExportSchema>;
export const ReviewDueSchema = z.object({
  id: text,                                     // card id, see fsrs.ts cardId()
  lesson: text,
  kind: z.enum(['item', 'flashcard']),
  item: optText,
  block: optText,
  card: z.number().int().min(0).optional(),
  due: isoDateTime,
});
export type ReviewDue = z.infer<typeof ReviewDueSchema>;

// ---------- the course ----------
export const CourseSchema = z.object({
  schema: z.literal(COURSE_SCHEMA_VERSION),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'course id is a slug'),   // localStorage prefix bm:<id>:*
  title: text,
  lede: z.string(),                             // the goal as one sentence (<= 140 chars)
  skin: z.enum(SKINS),
  object: optText,                              // 'img/obj-book.webp'
  chips: z.array(z.string()),                   // sprite icon ids for the hero title chips
  language: text,
  built_at: isoDateTime,
  allows_code: z.boolean(),
  code_language: z.enum(CODE_LANGUAGES).nullable(),
  attribution: optText,                         // footer licence line for the sources
  goal: CourseGoalSchema,
  plan: CoursePlanSchema,
  path: z.array(PathTopicSchema),
  further: z.array(z.object({ title: text, topic: text, after_key: optText })),
  lessons: z.array(CourseLessonSchema).min(1),
  narration: NarrationSchema.nullable(),        // "Hear the plan" overview (cue ids plan.N)
  receipts: ReceiptsSchema,
  sources: z.array(CourseSourceSchema),
  exports: z.array(CourseExportSchema),
  review: z.object({ generated_at: isoDateTime, cards: z.array(ReviewDueSchema) }),
});
export type Course = z.infer<typeof CourseSchema>;

export type CourseValidation = { ok: true; course: Course; errors: [] } | { ok: false; course: null; errors: string[] };

/**
 * Validate course.json. Schema issues plus cross-references (block ids unique per lesson, item ids
 * unique per lesson, path/plan lesson refs exist, cue ids name real blocks, review cards name real
 * lessons/items/blocks). Never throws.
 * Note: `course` is the zod parse output (unknown keys stripped). Write the ORIGINAL object to disk, and the
 * player renders the ORIGINAL object too (no transforms/defaults exist in these schemas, so only extra keys differ).
 */
export function validateCourse(data: unknown): CourseValidation {
  const r = CourseSchema.safeParse(data);
  if (!r.success) {
    return { ok: false, course: null, errors: r.error.issues.slice(0, 50).map(i => `${i.path.join('.') || '(root)'}: ${i.message}`) };
  }
  const c = r.data;
  const errors: string[] = [];
  const lessonIds = new Set<string>();
  const idsOf = new Map<string, Set<string>>();               // lesson id -> its block ids + item ids
  for (const l of c.lessons) {
    if (lessonIds.has(l.id)) errors.push(`lessons: duplicate lesson id ${l.id}`);
    lessonIds.add(l.id);
    const blockIds = new Set<string>();
    const itemIds = new Set<string>();
    for (const b of l.blocks) {
      if (blockIds.has(b.id)) errors.push(`lessons.${l.id}: duplicate block id ${b.id}`);
      blockIds.add(b.id);
      if (b.assessments.length && !['quiz', 'project', 'code'].includes(b.type)) errors.push(`lessons.${l.id}.${b.id}: ${b.type} cannot carry assessments`);
      for (const a of b.assessments) {
        if (itemIds.has(a.id)) errors.push(`lessons.${l.id}: duplicate item id ${a.id}`);
        itemIds.add(a.id);
      }
    }
    idsOf.set(l.id, new Set([...blockIds, ...itemIds]));
    for (const s of l.narration?.sentences ?? []) {
      const blk = s.id.split('.')[0]!;
      if (blk !== 'title' && !blockIds.has(blk)) errors.push(`lessons.${l.id}.narration: cue ${s.id} names no block`);
    }
  }
  for (const t of c.path) {
    if (t.lesson && !lessonIds.has(t.lesson)) errors.push(`path.${t.id}: lesson ${t.lesson} does not exist`);
    for (const i of t.items) if (i.lesson && !lessonIds.has(i.lesson)) errors.push(`path.${t.id}.${i.id}: lesson ${i.lesson} does not exist`);
  }
  for (const d of c.plan.days) for (const id of d.lessons) if (!lessonIds.has(id)) errors.push(`plan.days.${d.date}: lesson ${id} does not exist`);
  for (const r of c.review.cards) {
    const ids = idsOf.get(r.lesson);
    if (!ids) errors.push(`review.cards.${r.id}: lesson ${r.lesson} does not exist`);
    else if ((r.item && !ids.has(r.item)) || (r.block && !ids.has(r.block))) errors.push(`review.cards.${r.id}: names no item/block in lesson ${r.lesson}`);
  }
  return errors.length ? { ok: false, course: null, errors } : { ok: true, course: c, errors: [] };
}

/** Throwing variant for build/tests. */
export function parseCourse(data: unknown): Course {
  const v = validateCourse(data);
  if (!v.ok) throw new Error('course.json is invalid:\n' + v.errors.join('\n'));
  return v.course;
}

export { isEnabledType };

// ---------- embedding course.json into the player template ----------
// The template (packages/player/dist/player.html, copied to skills/bilimind/templates/player.html) carries
// exactly one tag:  <script id="bm-course" type="application/json">__BM_COURSE__</script>
// Runtime code never contains that tag as one string literal (an inline "</script>" would end the bundle).
export const COURSE_SCRIPT_ID = 'bm-course';
export const COURSE_PLACEHOLDER = '__BM_COURSE__';
const COURSE_TAG_RE = /(<script id="bm-course" type="application\/json">)\s*__BM_COURSE__\s*(<\/script>)/;

/** JSON safe inside a <script> element: escapes "</" (as "<\/"), "<!--", U+2028 and U+2029. */
export function courseJsonForHtml(course: unknown): string {
  const BS = String.fromCharCode(92);                       // a backslash, spelled out so no tool mangles it
  return JSON.stringify(course)
    .split('</').join('<' + BS + '/')                       // valid JSON escape for "/"
    .split('<!--').join(BS + 'u003c!--')
    .split(String.fromCharCode(0x2028)).join(BS + 'u2028')
    .split(String.fromCharCode(0x2029)).join(BS + 'u2029');
}

/** Paste a course into the template: replaces the placeholder INSIDE the bm-course tag only; throws if absent. */
export function injectCourse(templateHtml: string, course: unknown): string {
  if (!COURSE_TAG_RE.test(templateHtml)) throw new Error('player template has no <script id="bm-course"> placeholder tag');
  const json = courseJsonForHtml(course);
  return templateHtml.replace(COURSE_TAG_RE, (_m, open: string, close: string) => open + json + close);
}

/** Browser side: read the embedded course; null when the placeholder was never replaced. */
export function readEmbeddedCourse(doc: { getElementById(id: string): { textContent: string | null } | null }): unknown | null {
  const raw = doc.getElementById(COURSE_SCRIPT_ID)?.textContent?.trim();
  if (!raw || raw[0] !== '{') return null;
  return JSON.parse(raw);
}
