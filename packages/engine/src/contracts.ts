// @bilimind/engine contracts: the exact signatures the CLI (apps/cli) calls, one per command of PLAN.md §2.5.
// Each module file implements its functions with THESE names and types (checked at compile time by
// src/contracts-check.ts). Change a signature only with a line in packages/engine/CONTRACTS.md.
//
// Conventions
// - Every command function takes `ctx: Ctx` first and returns the `data` object of the CLI's JSON line.
//   The CLI adds {ok, cmd, cost_usd: ctx.spend.usd, ms} and appends crew/log.jsonl (log.ts).
// - Failures throw BilimindError(message, hint): the CLI prints {"ok":false,"cmd","error","hint"} and exits 1.
// - Paths returned in data are RELATIVE to the course folder (forward slashes). Paths used for I/O are built
//   with node:path join(), never by hand.
// - Progress goes to ctx.progress (stderr), never stdout.
// - Ids (cross-lane rule): block ids `b<n>` and item ids `q<n>` are unique per lesson, assigned by draft, KEPT across
//   repairs and edits, NEVER renumbered by position and never reused. A "block number" (`--block n`, codeDir(key, n),
//   CheckFailure.block, CodeBlockReport.block) is the numeric part of the id (core blockNumber('b3') = 3), not an index.
// - Draft -> course: core fromSaasLesson(draft, meta) is the ONE conversion (build AND narrate use it), so narration cue
//   ids equal the player's sentence ids. Items are never deleted from a draft: the Checker loop sets `status`.
import type {
  Assessment, AudioClip, BlockType, Chunk, Course, CourseLesson, ExamMap, ExamQuestion, FileKind, FileRole, Goal,
  IngestResult, LessonContent, LogEvent, NarrationIndex, OutlineResult, PlanResult, Receipts, ReviewState, SourceFile, Verdict, VerdictKind,
} from '@bilimind/core';

// ---------- shared ----------
export class BilimindError extends Error {
  hint: string | undefined;
  constructor(message: string, hint?: string) {
    super(message);
    this.name = 'BilimindError';
    this.hint = hint;
  }
}

export interface Ctx {
  course: string;                 // absolute course folder: <workspace>/bilimind-out/<slug>
  agent: string;                  // `--as` label, default "Lead"
  noCache: boolean;               // `--no-cache` (every rehearsal and stage run)
  model?: string;                 // `--model <id>` override
  maxUsd?: number;                // `--max-usd <n>` per-command cap (on top of ledger caps)
  spend: { usd: number; calls: number };   // accumulated by llm.callJson during this command
  now: () => Date;                // injectable clock (tests)
  progress: (line: string) => void;        // stderr
}

/** Layout of a course folder (PLAN §2.4). Every path absolute. */
export interface CoursePaths {
  root: string; sources: string; audio: string; img: string; lessonsMd: string; review: string; crew: string;
  courseJson: string; indexHtml: string; planMd: string; reportMd: string; reviewsIcs: string; deckCsv: string;
  reviewState: string; reviewHistory: string; reviewOutbox: string;
  goal: string; ingest: string; outline: string; examMap: string; examMapMd: string; plan: string; log: string; cache: string;
  narrationJson: string;                // crew/narration.json (core NarrationIndex): written by narrate, read by build
  lessonJson(key: string): string;      // crew/lessons/<key>.json
  checksJson(key: string): string;      // crew/checks/<key>.json
  codeDir(key: string, block: number): string;   // crew/code/<key>-b<n>/
  evidenceMd(key: string): string;      // crew/evidence/<key>.md
  verdictsJson(key: string): string;    // crew/verdicts/<key>.json
}

// ---------- config.ts ----------
export type ProviderId = 'deepseek' | 'openrouter';
export interface EngineConfig {
  provider: ProviderId;
  baseUrl: string;                // 'https://api.deepseek.com' | 'https://openrouter.ai/api/v1'
  apiKey: string;                 // NEVER printed, logged or written
  keySource: 'env' | 'env.local' | 'user-config' | 'none';
  models: { fast: string; reasoning: string };   // deepseek: deepseek-flash / deepseek-v4-pro; openrouter: deepseek/deepseek-v4-flash
  userDir: string;                // %USERPROFILE%\.bilimind
  ledgerPath: string;             // %USERPROFILE%\.bilimind\ledger.jsonl
  caps: { runUsd: number; dayUsd: number };      // 0.25 / 2.00
  reserveUsd: Record<ProviderId, number>;        // demo-day reserves (PLAN §6)
  demoDay: boolean;               // BILIMIND_DEMO_DAY=1 lifts the reserve floor
}
/** Resolve provider + key: env, then bilimind-desktop/.env.local (dev), then %USERPROFILE%\.bilimind\config.json. */
export type LoadConfig = (opts?: { env?: Record<string, string | undefined>; repoRoot?: string }) => EngineConfig;

// ---------- llm.ts ----------
export interface LlmRequest {
  stage: 'outline' | 'relabel' | 'expand' | 'expand_block' | 'higher_order' | 'rewrite_item' | 'explain' | 'probe' | 'auto_check' | 'fact_check';
  system: string;
  user: string;
  schema?: Record<string, unknown>;          // JSON-schema subset (required/types/enums/min/max) checked with one corrective turn
  validate?: (value: unknown) => string[];   // extra checks; non-empty => one corrective turn
  reasoning?: boolean;                       // on only for outline/relabel
  maxTokens?: number;                        // default 32768
  temperature?: number;                      // default 0.6
  model?: string;
}
export interface LlmResult<T> {
  data: T;
  model: string; provider: ProviderId;
  usage: { prompt_tokens: number; completion_tokens: number; reasoning_tokens?: number };
  cost_usd: number; ms: number; cached: boolean; attempts: number;
}
/** OpenAI-compatible JSON call (port of LlmClient::json). Checks the ledger first, records spend after, adds to ctx.spend. */
export type CallJson = <T = unknown>(ctx: Ctx, req: LlmRequest) => Promise<LlmResult<T>>;

// ---------- ledger.ts ----------
export interface LedgerEntry { ts: string; course: string; cmd: string; provider: ProviderId; model: string;
  prompt_tokens: number; completion_tokens: number; cost_usd: number; cached: boolean }
/** Throws BilimindError when the run cap, day cap, ctx.maxUsd or the provider balance floor would be crossed. */
export type CheckBudget = (ctx: Ctx, cfg: EngineConfig, estimateUsd: number) => Promise<void>;
export type RecordSpend = (cfg: EngineConfig, entry: LedgerEntry) => void;
export type SpentToday = (cfg: EngineConfig, now?: Date) => number;
export type SpentForCourse = (cfg: EngineConfig, course: string) => number;
/** Live balance: DeepSeek GET /user/balance, OpenRouter GET /api/v1/credits. null when unreachable. */
export type Balance = (cfg: EngineConfig) => Promise<{ usd: number | null; provider: ProviderId }>;

// ---------- cache.ts ----------
export type CacheKey = (model: string, messages: { role: string; content: string }[]) => string;   // sha256 hex
export type CacheGet = (course: string, key: string) => unknown | null;
export type CacheSet = (course: string, key: string, value: unknown) => void;

// ---------- log.ts ----------
export type AppendLog = (course: string, event: LogEvent) => void;
export type ReadLog = (course: string) => LogEvent[];
/** `note --text`: a decision line that appears in REPORT.md and the receipts' per-agent log. */
export type Note = (ctx: Ctx, opts: { text: string }) => Promise<{ text?: string }>;

// ---------- course.ts (folder, init, goal, status) ----------
export type CoursePathsFn = (course: string) => CoursePaths;
/** `--course` default: newest folder under <cwd>/bilimind-out/. Throws when none. */
export type ResolveCourse = (course: string | undefined, cwd: string) => string;
export interface InitOptions { src: string; sentence: string; slug?: string; outRoot?: string /* default <cwd>/bilimind-out */ }
/**
 * `init`: creates the course folder + crew/, copies the source files into sources/, stores the sentence (crew/goal.json
 * gets {sentence} only; `goal` completes it). Slug: lowercase [a-z0-9-] (it becomes course.id). The CLI runs init with
 * needsCourse:false, so init appends its own crew/log.jsonl line once the folder exists.
 */
export type Init = (opts: InitOptions, now?: Date) => Promise<{ course: string }>;
export interface GoalInput {
  deadline?: string;              // ISO date or datetime
  examTime?: string;              // HH:MM
  minutesPerDay: number;
  audience: 'student' | 'staff';
  lang: string;
  codeLang?: string | null;       // 'js' -> 'javascript'
  assume: string[];
  timezone?: string;              // default Asia/Kuala_Lumpur
}
/** `goal`: writes crew/goal.json. */
export type SetGoal = (ctx: Ctx, input: GoalInput) => Promise<{ goal: Goal }>;
export interface StatusData { stages: Record<'init' | 'goal' | 'ingest' | 'outline' | 'exam_map' | 'plan' | 'narrate' | 'export' | 'build', 'done' | 'todo'>;
  lessons: Record<string, 'todo' | 'drafted' | 'checked' | 'verified'> }
export type Status = (ctx: Ctx) => Promise<StatusData>;

// ---------- doctor.ts ----------
export interface DoctorData { node: string; provider: ProviderId | null; key: boolean; balance_usd: number | null; reserve_usd: number;
  spent_today_usd: number; clock_skew_ms: number | null; edge_tts: boolean }
export type Doctor = (opts?: { cwd?: string }) => Promise<DoctorData>;

// ---------- ingest/ ----------
export interface Section { locator: string | null; page: number | null; text: string }
export interface ExtractedFile { kind: FileKind; pages: number; sections: Section[]; scanned_pages: number[]; landscape?: boolean }
export type ExtractFile = (absPath: string) => Promise<ExtractedFile>;
/** Heuristic role ("Question 1", "marks", "Answer ALL", "Time allowed" -> past_paper; "Learning outcome"/"CLO" -> syllabus; "SOP"/"procedure"/"shift" -> sop). */
export type DetectRole = (name: string, text: string) => FileRole;
/** SaaS chunker: 1200 chars, 150 overlap inside a section, never across; a chunk keeps its section's locator. */
export type ChunkSections = (file: Pick<SourceFile, 'material_id' | 'title'>, sections: Section[], firstId: number) => Chunk[];
/** <= maxChars (6000) evenly spread across lecture files (past papers excluded), "[Slide 1] text" lines. */
export type BuildDigest = (files: SourceFile[], chunks: Chunk[], maxChars?: number) => string;
export interface IngestData { files: { name: string; kind: FileKind; role: FileRole; pages: number; words: number; scanned_pages: number[] }[];
  chunks: number; thin_files: string[] }
/** `ingest`: reads sources/, writes crew/ingest.json (IngestResult). `roles` = `--role "<file>=past_paper"` overrides. */
export type Ingest = (ctx: Ctx, opts: { roles?: Record<string, FileRole> }) => Promise<IngestData>;
export type ReadIngest = (course: string) => IngestResult;

// ---------- retrieve.ts ----------
export interface RetrievalIndex { search(text: string, limit: number): { chunk: Chunk; score: number; terms: string[] }[] }
export type BuildIndex = (chunks: Chunk[]) => RetrievalIndex;
/** SaaS term recipe (stopwords, >= 3 chars, max 24 terms). */
export type SearchTerms = (text: string) => string[];
/** Top `limit` (6) chunks for a lesson; at least `minimum` (2) even on weak overlap. */
export type RetrieveForLesson = (index: RetrievalIndex, chunks: Chunk[], lesson: { title: string; summary?: string; concept_key?: string },
  opts?: { limit?: number; minimum?: number }) => Chunk[];

// ---------- outline.ts ----------
export interface OutlineData { title: string; allows_code: boolean;
  topics: { key: string; title: string; archetype: string; kind_label: string; formats: BlockType[]; minutes: number; track: 'core' | 'subtopic'; parent: string | null; thin: boolean }[] }
/** `outline`: one reasoning call + variety gate (relabel <= 2) + normalisation; writes crew/outline.json (OutlineResult). */
export type OutlineFn = (ctx: Ctx, opts: { maxTopics?: number }) => Promise<OutlineData>;
export type ReadOutline = (course: string) => OutlineResult;

// ---------- exam.ts ----------
export interface ExamMapData { questions: number; total_marks: number;
  weights: { key: string; title: string; marks: number; share: number; questions: string[] }[]; unmatched: string[] }
/** Regex parse of a past paper: "Question N", "QN", "(a)", "[N marks]". */
export type ParseExamQuestions = (text: string, file: string) => ExamQuestion[];
/** `exam-map`: writes crew/exam-map.json (ExamMap) and crew/exam-map.md. `assign` = `--assign "Q3=<key>"`. */
export type ExamMapFn = (ctx: Ctx, opts: { assign?: Record<string, string> }) => Promise<ExamMapData>;
export type ReadExamMap = (course: string) => ExamMap | null;

// ---------- plan.ts ----------
export interface PlanData { lessons: { key: string; title: string; day: string; minutes: number }[];
  capacity_min: number; used_min: number; reviews: number; warnings: string[] }
/** `plan --keep k1,k2 [--cut "k=reason"] [--order ...]`: writes crew/plan.json (PlanResult) and plan.md. */
export type PlanFn = (ctx: Ctx, opts: { keep: string[]; cut?: Record<string, string>; order?: string[]; start?: string }) => Promise<PlanData>;
export type ReadPlan = (course: string) => PlanResult | null;

// ---------- draft.ts + normalise/ ----------
export interface DraftData { blocks: BlockType[]; items: number; code_blocks: number; cites: number }
/**
 * `draft --lesson k [--note "..."] [--only <type>]`: one expand call; writes crew/lessons/<key>.json (LessonContent). No auto re-ask.
 * Ids: a full draft assigns b1.. / q1..; `--only <type>` replaces the block of that type IN PLACE keeping its id (or appends
 * it with the next free b<n>), and its items get the next free q<n>. Block `source_material_ids` are CHUNK ids.
 */
export type DraftFn = (ctx: Ctx, opts: { lesson: string; note?: string; only?: BlockType }) => Promise<DraftData>;
export type ReadLessonDraft = (course: string, key: string) => LessonContent;
export type WriteLessonDraft = (course: string, content: LessonContent) => void;
/** Port of BlockPayloadNormaliser + normaliseAssessment + singleton/MCQ-cap/strip-code rules. */
export type NormaliseLesson = (raw: unknown, opts: { key: string; allowsCode: boolean; suppliedChunkIds: number[] }) => { content: LessonContent; repairs: string[] };

// ---------- validate/ (check) ----------
export interface CheckFailure { rule: string; block: number | null; item: string | null; detail: string; suggestion: string }
export interface CheckData { total: number; passed: number; failed: CheckFailure[]; auto_fixed: { rule: string; detail: string }[] }
/**
 * `check --lesson k`: Q1-Q17 (engine-port §5.2) incl. running code tests; writes crew/checks/<key>.json (this CheckData +
 * {round, at}). total = passed + failed.length ("15/15 checks"). CheckFailure.block = block number (see ids rule).
 * computeReceipts reads these counts from the `check` LogEvent.data (latest round per lesson).
 */
export type CheckFn = (ctx: Ctx, opts: { lesson: string }) => Promise<CheckData>;
export interface JsTestResult { name: string; passed: boolean; expected: unknown; actual: unknown; error?: string }
export interface JsTestRun { passed: number; total: number; results: JsTestResult[]; timedOut: boolean; syntaxError?: string }
/** node:vm harness: code + `{name, call, expect}` tests, deepEqual, timeout 2000 ms. */
export type RunJsTests = (code: string, tests: { name: string; call?: string; expect?: unknown }[], timeoutMs?: number) => JsTestRun;
export type IsSafeFormula = (formula: string, inputKeys: string[]) => boolean;
export type IsPlausibleMermaid = (source: string) => boolean;

// ---------- codework.ts ----------
export interface CodeBlockReport { block: number; dir?: string;
  reference: { passed: number; total: number; failures: { test: string; expected: unknown; actual: unknown }[] };
  starter: { passed: number; total: number }; disabled?: boolean }
export interface CodeTestData { blocks: CodeBlockReport[] }
/**
 * `code-test --lesson k [--block n] [--dump|--apply|--disable --reason]`. run (default) tests the lesson JSON;
 * dump writes crew/code/<k>-b<n>/{instructions.md, starter.js, solution.js, tests.json}; apply reads them back
 * into the lesson JSON and re-runs; disable marks the exercise self-graded with the reason: payload.tests = [], the
 * block's code item gets grader 'self' and loses answer_key.tests (the player shows "Mark it yourself"; core gradeCode
 * returns status 'self' for grader 'self'). Files: instructions.md, starter.js, solution.js (= answer_key.reference_solution),
 * tests.json (= payload.tests, [{name, call, expect}]).
 */
export type CodeTestFn = (ctx: Ctx, opts: { lesson: string; block?: number; mode: 'run' | 'dump' | 'apply' | 'disable'; reason?: string }) => Promise<CodeTestData>;

// ---------- evidence.ts / verdict.ts / rewrite.ts ----------
/** `evidence --lesson k`: crew/evidence/<k>.md, one packet per item (prompt, options, accepted answer in words, cited chunks <= 700 chars). */
export type EvidenceFn = (ctx: Ctx, opts: { lesson: string }) => Promise<{ items: number; packet: string }>;
export interface VerdictInput { item: string; verdict: VerdictKind; quote: string; reason: string }
export interface VerdictData { applied: number; refused: { item: string; why: string }[]; excluded: number; labelled: number }
/**
 * `verdict`: refuses quotes not verbatim (whitespace-normalised) in one of the item's cited chunks (its block's
 * source_material_ids + its own cite_chunk_ids). Appends to crew/verdicts/<k>.json (Verdict[], round 1 or 2) and updates
 * the item in crew/lessons/<k>.json, never deleting it: status = the verdict, quote, reason, cite_chunk_ids = [chunk of the
 * quote]; supported -> explanation = quote; not_covered -> labels += 'beyond_slides'; contradicted -> status
 * 'contradicted' (fromSaasLesson drops it; build lists it via core excludedItems()). CLI: `--item q3 --verdict ...
 * --quote ... --reason ...` gives one ruling; `--file <path>` is a JSON array of VerdictInput (or {"rulings": [...]}).
 */
export type VerdictFn = (ctx: Ctx, opts: { lesson: string; rulings: VerdictInput[] }) => Promise<VerdictData>;
/** The chunk containing `quote` (whitespace-normalised substring), or null. */
export type FindQuote = (quote: string, chunks: Chunk[]) => Chunk | null;
export type ReadVerdicts = (course: string, key: string) => Verdict[];
/**
 * `rewrite-item`: one cheap call from the item's chunks + the Checker's reason. The NEW item gets the next free q<n>,
 * `replaces: <old id>`, labels ['rewritten'], status 'pending', and is inserted right after the old one in the same block;
 * the old item keeps status 'contradicted'. The Checker then rules on the new id.
 */
export type RewriteItemFn = (ctx: Ctx, opts: { lesson: string; item: string; reason: string }) => Promise<{ item: Assessment; status: 'pending' }>;

// ---------- plant.ts ----------
export type PlantFn = (ctx: Ctx, opts: { lesson?: string; n: number }) => Promise<{ planted: number; key_file: string }>;
export type PlantScoreFn = (ctx: Ctx) => Promise<{ planted: number; caught: number; missed: number; false_alarms: number }>;

// ---------- tts.ts (narrate) ----------
export interface WordTiming { offset_ms: number; duration_ms: number; text: string }
/** One Edge TTS request (msedge-tts + clock-skew fix), cached by sha256(text, voice, rate). */
export type Synthesize = (text: string, opts: { voice: string; rate?: string; cacheDir?: string }) => Promise<{ mp3: Uint8Array; words: WordTiming[]; duration_ms: number }>;
/**
 * `narrate [--lessons k1,k2] [--voice id] [--langs en,ms]`: per lesson ONE mp3 whose script is
 * lessonSentences(fromSaasLesson(draft, meta)) (title.0 first, one cue per sentence; text may be rewritten for the
 * voice but sentences are never merged or split) + waveform peaks; the "Hear the plan" overview (deterministic text from
 * goal + plan + exam-map, <= 60 s, cue ids plan.N via textSentences('plan', text)); speaking items and dialogue openers
 * in their own language's voice (paths written into the draft payloads). Writes crew/narration.json (NarrationIndex).
 */
export type NarrateFn = (ctx: Ctx, opts: { lessons?: string[]; voice?: string; langs?: string[] }) => Promise<{ clips: number; minutes: number; failed: string[] }>;
export type ReadNarration = (course: string) => NarrationIndex | null;
export type ReadClips = (course: string) => AudioClip[];

// ---------- review.ts ----------
/**
 * Builds review/state.json: one FSRS card per course item (not project/essay/code) and per flashcard, first due from the
 * plan's review_dates. Idempotent: existing cards keep their FSRS state, new ids get new cards, cards whose item left
 * the course are removed. Called by `export` (before the .ics) and by `build` when state.json is missing.
 */
export type InitReview = (ctx: Ctx) => Promise<{ cards: number }>;
export type ReadReviewState = (course: string) => ReviewState | null;
/** P2 `due --n 3`: picks due cards, writes review/today.html + review/outbox.json. */
export type DueFn = (ctx: Ctx, opts: { n: number }) => Promise<{ questions: { n: number; id: string; prompt: string; options?: string[] }[]; page: string }>;
/** P2 `grade --answers "1 b, 2 chaining"`: grades the last outbox with core gradeFromText, reschedules, regenerates reviews.ics. */
export type GradeFn = (ctx: Ctx, opts: { answers: string }) => Promise<{ results: { n: number; correct: boolean; expected?: string; cite?: string; quote?: string; next_due: string }[]; ics_updated: boolean }>;

// ---------- export/ ----------
/** Obsidian note for one lesson: callouts, task lists, mermaid fences, `> [!quote] Source:` citation callouts. */
export type ToMarkdown = (lesson: CourseLesson, course: Course) => string;
/** Anki CSV: front, back, tags (flashcards + cloze items). */
export type AnkiCsv = (course: Course) => string;
/** .ics: study blocks (plan days) + reviews (state.json), TZ Asia/Kuala_Lumpur, every event before the exam. */
export type Ics = (input: { course: Course; plan: PlanResult; state: ReviewState | null }) => string;
/** REPORT.md from log.jsonl + checks + verdicts + ledger: what each agent did, checks, rejections, code fixes, cost, wall time. */
export type Report = (input: { course: Course; log: LogEvent[] }) => string;
/** The receipts slab numbers, computed only from the log + lesson files. */
export type ComputeReceipts = (input: { course: Omit<Course, 'receipts'>; log: LogEvent[]; files: SourceFile[]; excluded: Receipts['excluded'] }) => Receipts;
/** `export`: runs initReview, then writes lessons/NN-<key>.md, deck.csv, reviews.ics, REPORT.md, plan.md (refresh). Works from assembleCourse(ctx). */
export type ExportFn = (ctx: Ctx) => Promise<{ files: string[] }>;

// ---------- build.ts ----------
/**
 * Course object from the crew/ files: per kept lesson (plan order) core fromSaasLesson(draft, {outline meta, plan day,
 * narration from readNarration, resolveCite}) where resolveCite(chunkId, quote?) gives {file, locator, page, quote,
 * excerpt <= 700 chars containing the quote, chunk_id} (locator is required: chunk.locator, else `Page N`, else the file
 * title; file = 'sources/<name>' = a course.sources[].file); receipts.excluded from core excludedItems(); path from
 * outline + plan (+ cut reasons); review.cards from review/state.json. Does not write anything.
 */
export type AssembleCourse = (ctx: Ctx) => Promise<Course>;
export interface BuildData { index_html: string; size_kb: number; lessons: number; receipts: Receipts }
/** `build`: validates with core validateCourse, writes course.json, pastes into the template (core injectCourse), writes index.html. */
export type BuildFn = (ctx: Ctx, opts?: { template?: string }) => Promise<BuildData>;

// ---------- run.ts (builders only, never in SKILL.md) ----------
export type RunFn = (opts: { src: string; sentence: string; slug?: string; outRoot?: string; noCache?: boolean }) => Promise<{ course: string; lessons: number; cost_usd: number; ms: number }>;

/** The whole engine surface the CLI uses. src/contracts-check.ts asserts `typeof import('./index.ts')` satisfies it. */
export interface EngineApi {
  loadConfig: LoadConfig;
  callJson: CallJson;
  checkBudget: CheckBudget; recordSpend: RecordSpend; spentToday: SpentToday; spentForCourse: SpentForCourse; balance: Balance;
  cacheKey: CacheKey; cacheGet: CacheGet; cacheSet: CacheSet;
  appendLog: AppendLog; readLog: ReadLog; note: Note;
  coursePaths: CoursePathsFn; resolveCourse: ResolveCourse; init: Init; setGoal: SetGoal; status: Status;
  doctor: Doctor;
  extractFile: ExtractFile; detectRole: DetectRole; chunkSections: ChunkSections; buildDigest: BuildDigest; ingest: Ingest; readIngest: ReadIngest;
  buildIndex: BuildIndex; searchTerms: SearchTerms; retrieveForLesson: RetrieveForLesson;
  outline: OutlineFn; readOutline: ReadOutline;
  parseExamQuestions: ParseExamQuestions; examMap: ExamMapFn; readExamMap: ReadExamMap;
  plan: PlanFn; readPlan: ReadPlan;
  draft: DraftFn; readLessonDraft: ReadLessonDraft; writeLessonDraft: WriteLessonDraft; normaliseLesson: NormaliseLesson;
  check: CheckFn; runJsTests: RunJsTests; isSafeFormula: IsSafeFormula; isPlausibleMermaid: IsPlausibleMermaid;
  codeTest: CodeTestFn;
  evidence: EvidenceFn; verdict: VerdictFn; findQuote: FindQuote; readVerdicts: ReadVerdicts; rewriteItem: RewriteItemFn;
  plant: PlantFn; plantScore: PlantScoreFn;
  synthesize: Synthesize; narrate: NarrateFn; readNarration: ReadNarration; readClips: ReadClips;
  initReview: InitReview; readReviewState: ReadReviewState; due: DueFn; grade: GradeFn;
  toMarkdown: ToMarkdown; ankiCsv: AnkiCsv; ics: Ics; report: Report; computeReceipts: ComputeReceipts; exportAll: ExportFn;
  assembleCourse: AssembleCourse; build: BuildFn;
  run: RunFn;
}
