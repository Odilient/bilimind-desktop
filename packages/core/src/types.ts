// @bilimind/core types: one source of truth for every stage of the engine, the CLI and the player.
// Ported from hackathon/research/engine-port.md §1.1, plus the PLAN.md §2.3 additions.
// Course (course.json, the player contract) types are inferred from the zod schemas in
// course-schema.ts and re-exported at the bottom of this file.
import type { Narration, PlanDay } from './course-schema.ts';

// ---------- enums (prompts render their tables from these) ----------
export const ARCHETYPES = ['procedural', 'conceptual', 'factual', 'discriminative', 'diagnostic',
  'quantitative', 'spatial', 'evolutionary', 'performance', 'safety_critical', 'communicative'] as const;
export type Archetype = typeof ARCHETYPES[number];

export const BLOCK_TYPES = ['explainer', 'key_points', 'example', 'resource', 'video', 'quiz', 'exam', 'project',
  'flashcards', 'code', 'reflection', 'walkthrough', 'checklist', 'diagram', 'comparison', 'scenario',
  'reference_table', 'worked_example', 'playground', 'annotated_media', 'timeline', 'analogy', 'audio',
  'speaking', 'dialogue', 'illustration', 'misconception'] as const;            // 27, same order as BlockType.php
export type BlockType = typeof BLOCK_TYPES[number];
export const CARRIES_ASSESSMENTS: readonly BlockType[] = ['quiz', 'exam', 'project', 'code'];
export const SINGLETON: readonly BlockType[] = ['diagram', 'comparison', 'playground', 'scenario', 'timeline', 'checklist',
  'walkthrough', 'annotated_media', 'audio', 'flashcards', 'analogy', 'video', 'resource', 'illustration'];

export const ASSESSMENT_KINDS = ['mcq', 'multi_select', 'short_answer', 'cloze', 'essay', 'project', 'code', 'ordering', 'numeric'] as const;
export type AssessmentKind = typeof ASSESSMENT_KINDS[number];
/** Kinds the page (and `grade`) can mark without a model. */
export const DETERMINISTIC_KINDS: readonly AssessmentKind[] = ['mcq', 'multi_select', 'cloze', 'ordering', 'numeric', 'code'];
/** Kinds the learner marks against the rubric + reference answer offline ("You mark it"). */
export const SELF_MARKED_KINDS: readonly AssessmentKind[] = ['short_answer', 'essay', 'project'];

export const BLOOM = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as const;
export type Bloom = typeof BLOOM[number];
export const HIGHER_ORDER = ['apply', 'analyze', 'evaluate', 'create'] as const;
export const GRADERS = ['deterministic', 'llm_rubric', 'self'] as const;
export type Grader = typeof GRADERS[number];
export const TRACKS = ['core', 'subtopic'] as const;
export type Track = typeof TRACKS[number];
export const MARKS = ['recommended', 'alternative', 'anytime'] as const;
export type Mark = typeof MARKS[number];

/** PLAN §2.3: heuristic role of an input file (ingest/roles.ts). */
export const FILE_ROLES = ['lecture', 'past_paper', 'syllabus', 'sop', 'other'] as const;
export type FileRole = typeof FILE_ROLES[number];
export const FILE_KINDS = ['pdf', 'pptx', 'docx', 'md', 'txt', 'html'] as const;
export type FileKind = typeof FILE_KINDS[number];

/** Checker rulings (PLAN §1.3, verdict.ts). */
export const VERDICTS = ['supported', 'contradicted', 'not_covered'] as const;
export type VerdictKind = typeof VERDICTS[number];
/** Labels an assessment item can carry in course.json. `beyond_slides` = Checker ruled not_covered. */
export const ITEM_LABELS = ['beyond_slides', 'rewritten'] as const;
export type ItemLabel = typeof ITEM_LABELS[number];
/**
 * Where an item is in the Checker loop (crew/lessons/<key>.json). verdict.ts sets it; items are NEVER deleted
 * from the draft. `contradicted` and `excluded` items never reach course.json (fromSaasLesson drops them and
 * build lists them in receipts.excluded). `pending` = rewritten, waiting for the Checker's second ruling.
 */
export type ItemStatus = 'unchecked' | 'pending' | 'supported' | 'not_covered' | 'contradicted' | 'excluded';
/** Statuses that never reach course.json. */
export const DROPPED_STATUSES: readonly ItemStatus[] = ['contradicted', 'excluded'];

export const SKINS = ['cobalt', 'ink', 'lime'] as const;
export type Skin = typeof SKINS[number];
export const AUDIENCES = ['student', 'staff'] as const;
export type Audience = typeof AUDIENCES[number];
export const CODE_LANGUAGES = ['javascript', 'python', 'sql', 'html'] as const;
export type CodeLanguage = typeof CODE_LANGUAGES[number];
export const CODE_MODES = ['function', 'script', 'debug', 'query', 'build'] as const;
export type CodeMode = typeof CODE_MODES[number];
export type Rating = 'again' | 'hard' | 'good' | 'easy';

// ---------- stage 1: ingest ----------
export interface SourceFile {
  material_id: number;          // file number (1-based); chunk ids are separate
  name: string;                 // file name as in sources/, e.g. "lecture-4-hashing.pdf"
  path: string;                 // relative to the course folder: "sources/lecture-4-hashing.pdf"
  title: string;                // display title, e.g. "Lecture 4 · Hashing"
  kind: FileKind;
  role: FileRole;
  pages: number;                // pages (pdf), slides (pptx), sections (docx/md)
  words: number;
  scanned_pages: number[];      // 1-based pages with no text layer
  landscape?: boolean;          // pdf pages are slides (locator says "Slide N")
}
export interface Chunk {
  id: number;                   // global chunk id (ours); printed to the model as material_id
  material_id: number; title: string;   // file title, e.g. "Week 7 - Trees.pdf"
  ordinal: number;              // running number inside the file (never shown to the learner)
  locator: string | null;       // THEIR place: "Slide 14", "Page 3", "2.1 Binary search trees"
  page: number | null;          // 1-based page/slide number when known (for sources/<file>#page=N)
  content: string;              // <= 1200 chars (chunker), hard cap 4000
}
export interface IngestResult {
  files: SourceFile[];
  chunks: Chunk[];
  digest: string;               // <= 6000 chars spread across lecture files (past papers excluded)
  thin_files: string[];         // file names with too little text
}

// ---------- stage 2: research (unused in the hackathon) ----------
export interface Resource { id: number; kind: 'video' | 'article' | 'image' | 'reference'; title: string; url: string;
  domain: string; why: string; duration?: string; embeddable: boolean; license?: string; attribution?: string }

// ---------- stage 3: goal ----------
/** crew/goal.json, written by `bilimind goal` from the Lead's reading of the user's sentence. */
export interface Goal {
  sentence: string;             // the user's sentence, verbatim
  topic?: string;               // "Data Structures"
  title?: string;               // working course title
  deadline: string | null;      // exam/deadline date, 'YYYY-MM-DD'
  exam_time: string | null;     // 'HH:MM' local time
  exam_at: string | null;       // ISO datetime with offset, e.g. '2026-10-14T09:00:00+08:00'
  timezone: string;             // 'Asia/Kuala_Lumpur'
  minutes_per_day: number;
  audience: Audience;
  language: string;             // BCP-47, 'en'
  code_language: CodeLanguage | null;   // `--code-lang js` -> 'javascript'
  assumptions: string[];        // every `--assume` line, in order
  created_at: string;           // ISO datetime
}
/** engine-port §1.1 CourseBrief (prompt input), derived from Goal. */
export interface CourseBrief {
  topic: string;
  title?: string;
  language: string;
  level?: 'beginner' | 'intermediate' | 'advanced';
  goal?: string;
  deadline?: string;
  minutes_per_day?: number;
  source_type: 'topic' | 'materials' | 'mixed';
  audience?: Audience;
  clarify?: { question: string; answer: string }[];
  settings?: { formats_preferred?: BlockType[]; depth?: 'overview' | 'standard' | 'deep'; include_code?: boolean };
}

// ---------- stage 4: outline ----------
export interface OutlineNode {
  key: string; title: string; summary: string; concept_key: string;
  section?: string; note?: string; track: Track; branch_of?: string;
  mark?: Mark; group?: string; archetype: Archetype; estimated_minutes: number;
}
export interface Outline { course_title: string; allows_code: boolean; nodes: OutlineNode[];
  further?: { title: string; topic: string; after_key?: string }[] }
/** After GraphBuilder-style normalisation (crew/outline.json lessons). */
export interface Lesson extends OutlineNode {
  index: number; layer: number; position: number; parent: number | null;
  planned_block_types: BlockType[];          // derived from archetype, never from the model
  chunk_ids: number[];                       // chunks retrieved for this lesson
  thin: boolean;                             // < ~150 words of supporting chunks
  status: 'stub' | 'generating' | 'ready' | 'failed'; failure_reason?: string;
}
/** crew/outline.json */
export interface OutlineResult {
  title: string;
  allows_code: boolean;
  code_language: CodeLanguage | null;
  lessons: Lesson[];
  further: { title: string; topic: string; after_key?: string }[];
  variety_violation: string | null;          // what was left after relabel passes (accepted)
  relabel_passes: number;
}

// ---------- exam map (PLAN §2.3 exam.ts) ----------
export interface ExamQuestion {
  id: string;                   // "Q2b"
  number: string;               // "2"
  part: string | null;          // "b"
  text: string;
  marks: number;
  file: string;                 // past-paper file name
  locator: string | null;       // "Page 3"
  chunk_id: number | null;
  matches: { key: string; score: number; terms: string[] }[];   // best outline topics, best first
  assigned: string | null;      // topic key the marks count towards
  assigned_by: 'auto' | 'lead';
}
export interface TopicWeight {
  key: string; title: string;
  marks: number;
  share: number;                // 0..1 of total marks
  questions: string[];          // ["Q2b", "Q5"]
}
/** crew/exam-map.json */
export interface ExamMap {
  questions: ExamQuestion[];
  total_marks: number;
  weights: TopicWeight[];       // sorted by share desc
  unmatched: string[];          // question ids not assigned to any topic
}

// ---------- plan (PLAN §2.3 plan.ts); crew/plan.json ----------
export interface PlannedLesson { key: string; title: string; day: string /* YYYY-MM-DD */; minutes: number; weight: number | null; order: number }
export interface CutLesson { key: string; title: string; reason: string; weight: number | null }
export interface PlanResult {
  goal: Pick<Goal, 'deadline' | 'exam_at' | 'minutes_per_day' | 'timezone'>;
  start: string;                // first study day, YYYY-MM-DD
  days: PlanDay[];              // every day from start to the exam (exam day flagged)
  lessons: PlannedLesson[];
  cut: CutLesson[];
  capacity_min: number;         // days x minutes_per_day
  new_budget_min: number;       // 60% of capacity
  review_budget_min: number;    // 40% of capacity
  used_min: number;
  reviews: number;              // review sessions scheduled
  review_dates: Record<string, string[]>;  // lesson key -> review dates (backwards from the exam)
  assumptions: string[];
  warnings: string[];
}

// ---------- stage 5: draft (crew/lessons/<key>.json) ----------
export interface AssessmentOption { id: string; text: string }
export interface AnswerKey {
  correct_option_ids?: string[];
  accepted?: string[];
  correct_order?: string[];
  value?: number; tolerance?: number; unit?: string | null;
  reference_answer?: string;
  reference_solution?: string;
  tests?: string[];
}
export interface RubricRow { criterion: string; weight: number; excellent: string; acceptable: string; poor: string }
export interface Assessment {
  id: string;                   // "q1".. unique inside the lesson, NEVER reused (a rewrite gets the next free q<n>); the Checker's --item
  kind: AssessmentKind; prompt: string; bloom: Bloom; grader: Grader;
  options?: AssessmentOption[];
  answer_key?: AnswerKey;
  rubric?: RubricRow[];
  max_score: number;
  status?: ItemStatus;          // Checker loop state (absent = 'unchecked')
  labels?: ItemLabel[];         // verdict.ts: not_covered -> 'beyond_slides'; rewrite.ts: 'rewritten'
  explanation?: string;         // set by verdict (supported): the Checker's verbatim quote, shown after submit
  cite_chunk_ids?: number[];    // chunks the explanation quote came from (becomes item.cites in course.json)
  replaces?: string;            // rewrite.ts: id of the contradicted item this one replaces (receipts.excluded[].replaced_by)
  quote?: string;               // verdict.ts: the Checker's verbatim quote for the latest ruling (any verdict)
  reason?: string;              // verdict.ts: the Checker's reason for the latest ruling (receipts.excluded[].reason)
}
export interface Block {
  id?: string;                  // "b1".. assigned by draft; stable across repairs; never reused after a deletion
  type: BlockType;
  title?: string | null;
  payload: Record<string, unknown>;
  source_material_ids: number[] | null;    // CHUNK ids (engine-port §6.2)
  assessments: Assessment[];
}
/** Block number used by the CLI (`--block n`, codeDir(key, n), Check.block): the numeric part of the block id, never the array index. */
export const blockNumber = (id: string): number => Number(/^b(\d+)$/.exec(id)?.[1] ?? NaN);
export interface LessonContent {
  key: string; blocks: Block[]; attempts: number; cost_usd: number;
  repairs: string[];            // human log: "re-asked for missing walkthrough", "demoted 2 mcq to short_answer"
}

// ---------- stage 6: validate (`check`) ----------
export interface Check { lesson: string; block?: number; item?: string; rule: string; ok: boolean; detail: string; suggestion?: string; fixed?: boolean }
export interface ValidationReport { checks: Check[]; passed: number; failed: number; repaired: number }

// ---------- Checker ----------
/** One ruling (crew/verdicts/<key>.json is Verdict[]). */
export interface Verdict {
  lesson: string;
  item: string;                 // "q3"
  verdict: VerdictKind;
  quote: string;                // verbatim from a cited chunk (verdict.ts refuses otherwise)
  reason: string;               // <= 25 words
  chunk_id?: number | null;     // chunk the quote was found in (filled by verdict.ts)
  round?: number;               // 1 = first ruling, 2 = after rewrite
  at?: string;                  // ISO datetime
}

// ---------- stage 7: narrate ----------
/** One rendered mp3. Lesson narration is one clip per lesson; speaking items and dialogue openers get their own. */
export interface AudioClip {
  kind: 'lesson' | 'plan' | 'speaking' | 'dialogue';
  lesson: string | null;        // lesson id (null for the plan overview)
  block: string | null;         // block id "b9" for speaking/dialogue clips
  item?: number;                // speaking item index (0-based)
  file: string;                 // 'audio/<hash>.mp3' relative to the course folder
  voice: string; text: string; duration_ms: number;
  words?: { offset_ms: number; duration_ms: number; text: string }[];
}
/**
 * crew/narration.json, written by `narrate`, read by `build` (readNarration). Lesson cue ids come from
 * core lessonSentences() of the COURSE-SHAPED lesson (fromSaasLesson output), so they match the player's spans.
 * speaking/dialogue clip paths are ALSO written into the draft payloads (speaking.items[i].audio,
 * speaking.voice, dialogue.opening_audio) so build needs nothing else.
 */
export interface NarrationIndex {
  version: 1;
  voice: string;                                 // default narrator voice
  lessons: Record<string, Narration>;   // lesson id -> narration
  plan: (Narration & { text: string }) | null;   // "Hear the plan" (cue ids plan.N)
  clips: AudioClip[];
  failed: string[];                              // lesson ids / clip texts that failed (TTS 403 etc.)
  updated_at: string;
}

// ---------- review (review/state.json) ----------
/** Serialised ts-fsrs card (dates as ISO strings). See fsrs.ts. */
export interface FsrsState {
  due: string; stability: number; difficulty: number; elapsed_days: number; scheduled_days: number;
  learning_steps: number; reps: number; lapses: number; state: 0 | 1 | 2 | 3; last_review: string | null;
}
export interface ReviewCard {
  id: string;                   // "<lesson>/<item>" for quiz items, "<lesson>/<block>/c<n>" for flashcards (see cardId())
  lesson: string;
  kind: 'item' | 'flashcard';
  item?: string;                // assessment id
  block?: string;               // block id
  card?: number;                // flashcard index (0-based)
  prompt: string;               // front / question (for due lists)
  fsrs: FsrsState;
}
export interface ReviewState {
  version: 1;
  course_id: string;
  exam_at: string | null;
  updated_at: string;
  cards: ReviewCard[];
}

// ---------- log (crew/log.jsonl, one LogEvent per line) ----------
export interface LogEvent {
  ts: string;                   // ISO datetime
  agent: string;                // `--as` label: "Lead", "Writer · Hashing", "Coder", "Checker"
  cmd: string;                  // "draft", "check", "note", ...
  args?: string;                // short summary of the arguments
  ok: boolean;
  result?: string;              // one-line result summary (goes into REPORT.md and the receipts log)
  ms: number;
  cost_usd: number;
  lesson?: string;
  data?: Record<string, unknown>;   // command-specific counters (checks, verdicts, tests) for receipts
}

// ---------- stage 8: build ----------
export interface BuildResult { dir: string; index_html: string; size_kb: number; lessons: number; markdown: string[]; anki: string; ics: string; report: string }

// ---------- course.json (player contract): types inferred from course-schema.ts ----------
export type {
  Course, CourseLesson, CourseBlock, CourseAssessment, Cite, Narration, NarrationSentence,
  PathTopic, PathItem, PlanDay, CoursePlan, Receipts, ReceiptLogLine, ExcludedItem, CourseSource,
  CourseExport, ReviewDue, CourseGoal,
} from './course-schema.ts';
