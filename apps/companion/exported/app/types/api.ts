/**
 * BiliMind API contract — mirrors SPEC.md §1 (schema), §3 (block payloads) and
 * §8 (routes). Every frontend module imports its shapes from here:
 *
 *   import type { Course, Node, Block, TodayResponse } from '~/types/api'
 *
 * Rules baked into these types:
 *  - `answer_key` never exists on the wire, so it is absent here on purpose.
 *  - Anything the backend may omit is optional, never `any`.
 *  - Fixed value sets from the SPEC are string-literal unions, not `string`.
 */

/* -------------------------------------------------------------------------- */
/* Enumerations (SPEC §1)                                                     */
/* -------------------------------------------------------------------------- */

export type CourseStatus =
  'clarifying' | 'outlining' | 'outlined' | 'expanding' | 'ready' | 'failed'

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced'

export type CourseSourceType = 'topic' | 'materials' | 'mixed'

export type CourseDepth = 'overview' | 'standard' | 'deep'

export type NodeStatus = 'stub' | 'queued' | 'generating' | 'ready' | 'failed'

export type EdgeType = 'prerequisite' | 'optional' | 'related'

/**
 * Where a lesson sits on the roadmap, in roadmap.sh's grammar: `core` is a
 * TOPIC on the solid line, `subtopic` hangs off one (or, once, off another
 * subtopic) with a dotted tie. The two retired tracks, `recommended` and
 * `optional`, still arrive from payloads cached before the change and are read
 * as subtopics carrying the badge they implied — see `lessonTrack()`.
 */
export type LessonTrack = 'core' | 'subtopic' | 'recommended' | 'optional'

/**
 * The badge in a subtopic's corner — roadmap.sh's three-colour legend.
 * Purple: our pick. Green: pick this or the purple one. Grey: learn anytime.
 */
export type LessonMark = 'recommended' | 'alternative' | 'anytime'

/**
 * roadmap.sh's "have a look at the following relevant tracks": a course worth
 * starting after (or, with `after_key`, beside a topic of) this one. Clicking
 * one seeds the create flow with `topic`.
 */
export interface FurtherCourse {
  title: string
  topic: string
  after_key: string | null
}

export type BlockType =
  | 'explainer'
  | 'key_points'
  | 'example'
  | 'resource'
  | 'video'
  | 'quiz'
  | 'exam'
  | 'project'
  | 'flashcards'
  | 'code'
  | 'reflection'
  // EXPAND §2 — formats derived from the node's archetype.
  | 'walkthrough'
  | 'checklist'
  | 'diagram'
  | 'comparison'
  | 'scenario'
  | 'reference_table'
  | 'worked_example'
  | 'playground'
  | 'annotated_media'
  | 'timeline'
  | 'analogy'
  | 'audio'
  // Spoken production — the learner talks and is heard, not just reads.
  | 'speaking'
  | 'dialogue'
  // A drawing of something that must be SEEN, and the wrong belief a learner
  // arrives with. `illustration` is separate from `diagram` on purpose: diagrams
  // stay Mermaid, because image models cannot spell.
  | 'illustration'
  | 'misconception'

/**
 * EXPAND §1 — what kind of knowledge a node teaches. The backend derives the
 * node's formats from this; the UI only ever displays it.
 */
export type ConceptArchetype =
  | 'procedural'
  | 'conceptual'
  | 'factual'
  | 'discriminative'
  | 'diagnostic'
  | 'quantitative'
  | 'spatial'
  | 'evolutionary'
  | 'performance'
  | 'safety_critical'

export type AssessmentKind =
  | 'mcq'
  | 'multi_select'
  | 'short_answer'
  | 'cloze'
  | 'essay'
  | 'project'
  | 'code'
  | 'ordering'
  | 'numeric'

export type GraderKind = 'deterministic' | 'llm_rubric' | 'self'

/** `skipped` is roadmap.sh's fourth state: looked at, and declined. */
export type ProgressState = 'available' | 'in_progress' | 'completed' | 'skipped'

/**
 * `image` and `video` are stored, listed and attachable like any other material,
 * but nothing extracts text from them — no OCR, no transcription. Their status
 * says so rather than pretending they are still being read.
 */
export type MaterialKind = 'file' | 'url' | 'text' | 'image' | 'video'

/**
 * `needs_input` is the honest fourth outcome: extraction stopped and only the
 * owner can unstick it — a password-protected PDF, a link behind a login. It is
 * not `failed`, because nothing went wrong, and it is not `pending`, because
 * waiting will not help.
 */
export type MaterialStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'needs_input'

export type ScheduleStatus = 'active' | 'paused' | 'completed'

export type ScheduleItemState = 'pending' | 'done' | 'skipped' | 'moved'

export type GenerationStage =
  'clarify' | 'outline' | 'expand_node' | 'regenerate' | 'grade' | 'schedule'

/** ISO-8601 date (`2026-08-02`). */
export type IsoDate = string
/** ISO-8601 datetime. */
export type IsoDateTime = string

/* -------------------------------------------------------------------------- */
/* Courses                                                                    */
/* -------------------------------------------------------------------------- */

export interface ClarifyingQuestion {
  id: string
  question: string
  why?: string | null
  suggestions?: string[]
}

export interface ClarifyingAnswer {
  id: string
  answer: string
}

export interface CourseSettings {
  formats_preferred?: BlockType[] | string[]
  depth?: CourseDepth
  include_code?: boolean
}

/** Roll-up returned alongside every course. */
/**
 * `courses[].progress` — this learner's progress through the course, by node count.
 * Content readiness lives in `node_counts`, not here: a node can be `ready` (written)
 * without being `completed` (studied).
 */
export interface CourseProgress {
  total: number
  completed: number
  in_progress: number
  /** Present on `GET /api/courses/{id}`, absent on the library list. */
  skipped?: number
  available?: number
  /** 0–100, completion of the course by node count. */
  percent: number
}

/** `courses[].node_counts` — how much of the course has actually been written. */
export interface NodeCounts {
  total: number
  stub: number
  queued: number
  generating: number
  ready: number
  failed: number
}

/** Compact schedule facts attached to a course payload. */
export interface CourseScheduleSummary {
  id: number
  status: ScheduleStatus
  starts_on: IsoDate
  minutes_per_week: number
  days_of_week: number[]
  items_total?: number
  items_done?: number
  items_pending?: number
  next_scheduled_for?: IsoDate | null
  /** Number of pending items whose date has already passed. */
  overdue_count?: number
}

/** Who a course is credited to — the `owner` half of `/{username}/{slug}`. */
export interface CourseOwner {
  username: string | null
  name: string
  avatar_url?: string | null
}

/** Row shape for `GET /api/courses`. */
export interface CourseSummary {
  id: number
  user_id?: number
  /**
   * Stable identity, minted client-side at `/create/{uuid}` before the course
   * row exists and carried through creation. Unlike `slug` it never changes:
   * the outline stage renames the course, and the slug follows the rename.
   */
  uuid: string
  /** Second segment of the course URL, unique within one learner's library. */
  slug?: string | null
  /**
   * `/{username}/{course-slug}` — where this course lives, built server-side so
   * the client never has to guess at it. Null only for a row that predates
   * slugs; `courseUrl()` falls back to the id route for those.
   */
  path?: string | null
  owner?: CourseOwner | null
  title: string
  topic: string
  language: string
  level: CourseLevel | null
  /** EDIT — the course may contain code exercises, so the editor may add one. */
  allows_code?: boolean
  goal: string | null
  minutes_per_week: number | null
  source_type: CourseSourceType
  status: CourseStatus
  settings: CourseSettings | null
  share_token?: string | null
  share_url?: string | null
  is_public: boolean
  /**
   * Who can open it: the owner only, every member of `organization`, or anyone
   * with the link. `is_public` is the same fact as `visibility === 'public'`.
   */
  visibility?: CourseVisibility
  /** The organisation it belongs to, when that is a real one (not a personal workspace). */
  organization?: { id: number; name: string; type?: string } | null
  /** False on the "Shared with you" shelf: someone else's course, so no owner menu. */
  is_mine?: boolean
  status_label?: string
  is_generating?: boolean
  failure_reason: string | null
  /**
   * Which shelf the course is on. Both null in the library; `archived_at` is set
   * for a course put away, `deleted_at` for one in the trash. A card decides what
   * it offers from these two fields alone, not from which request fetched it.
   */
  archived_at?: IsoDateTime | null
  deleted_at?: IsoDateTime | null
  /**
   * When the nightly purge really deletes a trashed course. Sent by the API so
   * the retention window has one definition; null unless `deleted_at` is set.
   */
  purges_at?: IsoDateTime | null
  node_counts: NodeCounts
  progress: CourseProgress
  materials_count?: number
  schedule?: CourseScheduleSummary | null
  next_scheduled_for?: IsoDate | null
  created_at: IsoDateTime
  updated_at: IsoDateTime
}

/**
 * The shelves `GET /api/courses` can list. `organization` is "Shared with you":
 * courses an organisation you belong to shares, owned by somebody else.
 */
export type CourseShelf = 'library' | 'archived' | 'trash' | 'organization'

export type CourseVisibility = 'private' | 'organization' | 'public'

/** `GET /api/courses` with its envelope kept — the library needs the counts. */
export interface LibraryResponse {
  data: CourseSummary[]
  meta: {
    shelf: CourseShelf
    counts: Record<CourseShelf, number>
    trash_retention_days: number
  }
}

/** One step of the plan as it streams in, before the plan exists as lessons. */
export interface PipelineItem {
  title: string
  /** Hangs off a step rather than being one. */
  side: boolean
}

/**
 * The stage in flight on a course, as `App\Support\Pipeline` reports it. Null
 * when nothing is running. `elapsed` is seconds since the stage started,
 * counted by the server when it answered.
 */
export type CoursePipeline =
  | {
      stage: 'outline'
      started_at: IsoDateTime
      elapsed: number
      /** Queued for a worker → reasoning (no output yet) → steps arriving → labels being corrected. */
      phase: 'waiting' | 'thinking' | 'writing' | 'checking'
      items: PipelineItem[]
      attempt?: number
    }
  | {
      stage: 'parts'
      started_at: IsoDateTime
      elapsed: number
      phase?: 'waiting' | 'writing'
      batches_done?: number
      batches_total?: number
      /** Lessons added under the steps so far. */
      added?: number
    }

/** Full payload for `GET /api/courses/{course}` and `GET /api/u/{user}/{slug}`. */
export interface Course extends CourseSummary {
  clarifying_questions: ClarifyingQuestion[] | null
  clarifying_answers: ClarifyingAnswer[] | null
  /** Owner only. See `CoursePipeline`. */
  pipeline?: CoursePipeline | null
  /** Where to go after this course; empty when the outline offered nothing. */
  further?: FurtherCourse[]
  nodes: Node[]
  edges: Edge[]
  materials?: Material[]
  /**
   * Set only on the read-only projection — the payload a visitor who does not
   * own this course receives. Its presence is what the workspace page reads to
   * decide between the editor and the public page.
   */
  is_shared?: boolean
  shared_at?: IsoDateTime | null
  /**
   * False when an organisation member who does not own the course opens it: the
   * workspace, their own progress, and none of the surfaces that change or
   * spend on the course. Absent on the public projection.
   */
  can_edit?: boolean
  /**
   * Whether this reader may open the class report (`/reports/{uuid}`): the
   * course reaches an organisation's learners and they own it or teach there.
   */
  can_report?: boolean
}

/* -------------------------------------------------------------------------- */
/* Class reports — `GET /api/reports`, `GET /api/courses/{course}/report`     */
/* -------------------------------------------------------------------------- */

/** One card on `/reports`. */
export interface ReportCourse {
  id: number
  uuid: string
  title: string
  path: string | null
  is_mine: boolean
  owner: string | null
  organization: { id: number; name: string }
  lessons: number
  /** Members with the learner role, not counting the course's owner. */
  learners: number
  /** Members who have opened at least one lesson. */
  started: number
  last_active_at: IsoDateTime | null
}

/** One learner's row. The API sends them furthest behind first. */
export interface ReportLearner {
  id: number
  name: string
  email: string
  username: string | null
  role: 'owner' | 'admin' | 'instructor' | 'learner'
  role_label: string
  joined_at: IsoDateTime | null
  lessons_completed: number
  lessons_in_progress: number
  completed_this_week: number
  percent: number
  minutes: number
  /** Distinct live questions with a graded attempt. */
  questions_answered: number
  questions_passed: number
  attempts: number
  /** Mean of the best score on each answered question, 0–100. Null before any. */
  average_score: number | null
  last_active_at: IsoDateTime | null
}

export interface CourseReport {
  course: {
    id: number
    uuid: string
    title: string
    path: string | null
    visibility: CourseVisibility
    organization: { id: number; name: string } | null
    lessons: number
    questions: number
  }
  summary: {
    learners: number
    started: number
    active_this_week: number
    finished: number
    average_percent: number | null
    average_score: number | null
  }
  learners: ReportLearner[]
  generated_at: IsoDateTime
}

export interface CourseCreatePayload {
  /**
   * The uuid already in the address bar. Sending it makes creation idempotent —
   * a resubmit after a lost response returns the course the first call made
   * instead of building a second one.
   */
  uuid?: string
  topic: string
  language?: string
  level?: CourseLevel
  goal?: string
  minutes_per_week?: number
  material_ids?: number[]
  skip_clarify?: boolean
}

/* -------------------------------------------------------------------------- */
/* Course drafts — an unfinished trip through /create                         */
/* -------------------------------------------------------------------------- */

/** Where a draft is in the flow. Mirrors the page's own three steps. */
export type CourseDraftStep = 'compose' | 'clarify' | 'generating'

/**
 * Answers-in-progress on one clarifying question: the chips tapped so far and
 * anything typed alongside them, kept apart so a reload restores the controls
 * rather than the sentence they compose into.
 */
export interface ClarifyDraftAnswer {
  chips: string[]
  text: string
}

/**
 * The create form, exactly as the page holds it. Stored verbatim server-side —
 * this is the shape that goes out and comes back, not a projection of it.
 */
export interface CourseDraftPayload {
  topic?: string
  goal?: string
  language?: string
  /** `'any'` is a real choice here ("Not sure"), unlike on a created course. */
  level?: CourseLevel | 'any'
  minutes_per_week?: number
  material_ids?: number[]
  skip_clarify?: boolean
  clarify?: Record<string, ClarifyDraftAnswer>
}

export interface CourseDraft {
  uuid: string
  /** `/create/{uuid}` — where this draft is resumed. */
  path: string
  step: CourseDraftStep
  topic: string | null
  payload: CourseDraftPayload
  course_id: number | null
  /** The course this draft has already produced, if it got that far. */
  course: Course | null
  created_at: IsoDateTime
  updated_at: IsoDateTime
}

export interface CourseUpdatePayload {
  title?: string
  language?: string
  settings?: CourseSettings
}

export interface ShareResponse {
  share_url: string
  share_token: string
}

/* -------------------------------------------------------------------------- */
/* Graph                                                                      */
/* -------------------------------------------------------------------------- */

export interface Node {
  id: number
  course_id: number
  /** Stable slug, unique per course. Edges reference nodes by this key. */
  key: string
  title: string
  summary: string | null
  concept_key: string | null
  /**
   * Where this lesson sits relative to the course's one main line. Absent on
   * courses outlined before tracks existed, which are all `core`.
   */
  track?: LessonTrack | null
  track_label?: string | null
  /** The badge on a subtopic. Null on a topic, and on any subtopic that is simply part of its topic. */
  mark?: LessonMark | null
  mark_label?: string | null
  /**
   * The headed box this subtopic shares with siblings naming the same group —
   * "API styles", "Authentication". Null for a subtopic drawn on its own.
   */
  group?: string | null
  /** A paragraph of advice drawn beside a topic. Null on subtopics and on most topics. */
  note?: string | null
  /** What this lesson hangs off — a topic, or (one level down) a subtopic; null when it *is* the topic. */
  branch_of_node_id?: number | null
  /**
   * The chapter this lesson belongs to. A run of lessons sharing one names it
   * once, in the roadmap's margin. Absent on older courses.
   */
  section?: string | null
  /** Step index along the path, 0-based. */
  layer: number
  /** 0 for the lesson on the line, 1..n for the branches hanging off it. */
  position: number
  estimated_minutes: number
  status: NodeStatus
  planned_block_types: BlockType[] | null
  /** Null on nodes generated before archetypes existed. */
  archetype?: ConceptArchetype | null
  archetype_label?: string | null
  failure_reason: string | null
  /**
   * Seconds this lesson has been in the writer's hands, counted by the server
   * at the moment it answered. Null unless it is `generating`. See `useStopwatch`.
   */
  writing_for?: number | null
  /**
   * EDIT — the revision the content currently matches (the editor sends it
   * back as `base_revision_id`), and when a person last changed this lesson
   * by hand. Both null on a lesson nobody has touched since it was generated.
   */
  current_revision_id?: number | null
  edited_at?: IsoDateTime | null
  progress?: NodeProgress | null
  blocks_count?: number
  assessments_count?: number
  /**
   * The lesson itself, present only where the server eager-loaded it —
   * `CoursePayload::forPublic()` does, which is what `/{user}/{course}` renders
   * for a reader who does not own the course. The workspace fetches lessons one
   * at a time instead, so these stay absent there.
   */
  blocks?: Block[]
  assessments?: Assessment[]
  created_at?: IsoDateTime
  updated_at?: IsoDateTime
}

/** Alias for callers where the DOM's `Node` is also in scope. */
export type CourseNode = Node

export interface Edge {
  id: number
  course_id: number
  from_node_id: number
  to_node_id: number
  type: EdgeType
  /** Present when the backend echoes node keys for convenience. */
  from?: string
  to?: string
}

export interface NodeProgress {
  id?: number
  user_id?: number
  node_id: number
  state: ProgressState
  time_spent_seconds: number
  completed_at: IsoDateTime | null
  last_seen_at: IsoDateTime | null
}

/** Full payload for `GET /api/nodes/{node}`. */
export interface NodeDetail extends Node {
  blocks: Block[]
  assessments: Assessment[]
  course?: Pick<CourseSummary, 'id' | 'slug' | 'path' | 'title' | 'language' | 'status'>
  prev_node_id?: number | null
  next_node_id?: number | null
  prerequisites?: NodeRef[]
  unlocks?: NodeRef[]
}

export interface NodeRef {
  id: number
  key: string
  title: string
  status: NodeStatus
  track?: LessonTrack | null
  layer?: number
}

export interface NodeUpdatePayload {
  title?: string
  summary?: string
  blocks?: Array<
    Pick<BlockBase<BlockType, unknown>, 'id' | 'position'> & {
      payload?: unknown
    }
  >
}

export interface NodeProgressPayload {
  state?: ProgressState
  time_spent_seconds?: number
}

/* -------------------------------------------------------------------------- */
/* Blocks (SPEC §3) — discriminated union on `type`                           */
/* -------------------------------------------------------------------------- */

export interface BlockBase<T extends BlockType, P> {
  id: number
  node_id: number
  position: number
  type: T
  payload: P
  source_material_ids: number[] | null
  /** EDIT — the model is rewriting this part right now. */
  rewriting?: boolean
  /** EDIT — why the last rewrite did not land; null once one does. */
  rewrite_error?: string | null
  created_at?: IsoDateTime
  updated_at?: IsoDateTime
}

export interface ExplainerPayload {
  markdown: string
}

export interface KeyPointsPayload {
  points: string[]
}

export interface ExamplePayload {
  title: string
  markdown: string
}

/** Matches App\Models\Resource::KINDS. */
export type ResourceKind = 'video' | 'article' | 'docs' | 'book' | 'tool' | 'image'

/**
 * EXPAND §3 — resource and video blocks now carry resolved, verified rows rather
 * than the model's guess at a link. `search_query` is gone: the research stage
 * either found something real or the block was not written.
 */
export interface ResourcePayload {
  items: ResearchedResource[]
  note?: string | null
}

export interface VideoPayload {
  items: ResearchedResource[]
  /**
   * Opens the first video at the moment that teaches THIS lesson rather than at
   * 0:00. Optional and absent on every video block written before it existed.
   */
  start_seconds?: number | null
}

export interface QuizPayload {
  intro?: string | null
  assessment_ids: number[]
}

export interface ExamPayload {
  intro?: string | null
  time_limit_minutes?: number | null
  assessment_ids: number[]
}

export interface ProjectPayload {
  title: string
  brief_markdown: string
  deliverables: string[]
  assessment_ids: number[]
}

export interface Flashcard {
  front: string
  back: string
}

export interface FlashcardsPayload {
  cards: Flashcard[]
}

/**
 * The five shapes a code exercise can take. Anything unrecognised — including a
 * payload written before modes existed — normalises to `function`.
 */
export type CodeMode = 'function' | 'script' | 'debug' | 'query' | 'build'

/**
 * ONE declared check, whatever the mode. There is deliberately no second array
 * of "cases" beside this one: `DeterministicGrader::declaredTests()` reads the
 * names it grades against from exactly one place, and a check the grader cannot
 * see is a check the learner is never credited for.
 *
 * `name` is load-bearing — the client reports results by name and a renamed
 * check reads as "not reported", which scores zero.
 */
export interface CodeTest {
  name: string
  /** function | debug: an expression evaluated after the learner's code runs. */
  call?: string
  /** function | debug: the exact expected value. script: the exact expected stdout. */
  expect?: unknown
  /** script: fed to the program on stdin for this run. One worker run per entry. */
  stdin?: string | null
  /** query: the rows the final statement must return. */
  expect_table?: {
    columns: string[] | null
    rows: Array<Array<string | null>>
    ordered: boolean
  }
  /** build: a CSS selector the learner's markup must match. */
  selector?: string
  min_count?: number
  text_contains?: string | null
  attribute?: { name: string; value: string | null } | null
}

export interface CodePayload {
  /** Absent on every block generated before modes existed — treat as 'function'. */
  mode?: CodeMode
  /**
   * The runtime, and the source of truth: it is what selects the WASM engine in
   * the browser, so the mode is reconciled against it, never the other way round.
   */
  language: string
  starter_code: string
  instructions_markdown: string
  tests?: CodeTest[] | null
  /**
   * debug only — what the broken code DOES, as the learner would observe it.
   * Without it there is no fault to hunt and the exercise is just `function`.
   */
  symptom_markdown?: string
  /** query only: schema + seed, run first on the same database, output discarded. */
  setup_sql?: string
  /**
   * query only, and DERIVED from `setup_sql` server-side rather than restated by
   * the model. A hand-written schema drifts from the fixture that actually runs,
   * and then the learner spends the exercise debugging our typo.
   */
  tables?: Array<{ name: string; columns: string[] }>
  /** build only: what the markup has to end up containing. */
  requirements?: string[]
  /**
   * Revealed one at a time. A hint names the next thing to TRY; it never contains
   * the finished code. There is no `solution_code` field and there must never be
   * one: `LeakGuard::FORBIDDEN_KEYS` would not strip it, so it would ship the
   * working answer to the browser.
   */
  hints?: string[]
  assessment_ids: number[]
}

export interface ReflectionPayload {
  prompt: string
}

/* -------------------------------------------------------------------------- */
/* EXPAND §2 payloads                                                         */
/* -------------------------------------------------------------------------- */

/**
 * A verified, fetched resource. The generator never writes URLs — every one of
 * these came from the research stage and returned a 2xx before it was stored.
 */
export interface ResearchedResource {
  resource_id: number
  title: string
  url: string
  kind: ResourceKind
  provider: string
  /** YouTube videoId, for the IFrame embed. */
  provider_id: string | null
  embeddable: boolean
  domain: string | null
  duration_s: number | null
  duration_label: string | null
  language: string | null
  license: string | null
  attribution: string | null
  thumbnail: string | null
  /**
   * The link preview, read off the page at research time (LinkPreviewFetcher).
   * Optional because every block written before previews existed lacks them —
   * `resources:enrich` fills them in, but a renderer must not assume it ran.
   */
  /** The page's own banner (`og:image`); a video's thumbnail when there is nothing better. */
  image?: string | null
  /** The site's mark, or a guess at its `/favicon.ico` the browser may disprove. */
  favicon?: string | null
  /** `og:site_name`, the name the site calls itself. */
  site_name?: string | null
  /** A video's channel. */
  author?: string | null
  why: string | null
}

export interface AnalogyPayload {
  markdown: string
  /** Mandatory: an analogy without its limit teaches a misconception. */
  breaks_down_when: string
}

export interface WalkthroughStep {
  n: number
  title: string
  detail_markdown: string
  warning?: string | null
  check?: string | null
}

export interface WalkthroughPayload {
  intro?: string | null
  steps: WalkthroughStep[]
}

export interface ChecklistItem {
  text: string
  why?: string | null
}

export interface ChecklistPayload {
  title: string
  items: ChecklistItem[]
  note?: string | null
}

export interface DiagramPayload {
  format: 'mermaid'
  source: string
  caption?: string | null
  alt_text?: string | null
}

export interface ComparisonItem {
  name: string
  /** Exactly one entry per axis, in axis order. */
  values: string[]
  best_for?: string | null
}

export interface ComparisonPayload {
  intro?: string | null
  axes: string[]
  items: ComparisonItem[]
}

export interface ReferenceTablePayload {
  title?: string | null
  columns: string[]
  /** Every row is padded to `columns.length` server-side. */
  rows: string[][]
  note?: string | null
}

export interface ScenarioOption {
  id: string
  text: string
  outcome_markdown?: string | null
  /**
   * Present in the payload because this is practice, not assessment: the renderer
   * needs it to tell the learner where the branch led. Nothing is scored.
   */
  correct: boolean
  next_id?: string | null
}

export interface ScenarioStep {
  id: string
  prompt: string
  options: ScenarioOption[]
}

export interface ScenarioPayload {
  setup_markdown: string
  steps: ScenarioStep[]
  debrief_markdown?: string | null
}

export interface WorkedExampleStep {
  expression: string
  explanation: string
}

export interface WorkedExamplePayload {
  problem_markdown: string
  steps: WorkedExampleStep[]
  answer?: string | null
  common_mistakes: string[]
}

export interface PlaygroundInput {
  key: string
  label: string
  min: number
  max: number
  step: number
  default: number
  unit?: string | null
}

export interface PlaygroundPayload {
  inputs: PlaygroundInput[]
  /** `function compute(i) { ... }`, validated server-side, run in the sandboxed worker. */
  formula_js: string
  output_label: string
  output_unit?: string | null
  guidance_markdown?: string | null
}

export interface Hotspot {
  x_pct: number
  y_pct: number
  label: string
  detail?: string | null
}

export interface AnnotatedMediaPayload {
  media: ResearchedResource
  alt_text: string
  hotspots: Hotspot[]
}

export interface TimelineEvent {
  when: string
  title: string
  detail?: string | null
}

export interface TimelinePayload {
  events: TimelineEvent[]
}

export interface AudioPayload {
  /** Spoken by the browser's SpeechSynthesis — no provider, no audio file. */
  script_markdown: string
  voice_hint?: string | null
  duration_estimate_s: number
  /** The language the script is in; overrides the course language for the voice. */
  language?: string | null
}

/** One phrase a learner hears in the target language and says back. */
export interface SpeakingItem {
  text: string
  translation?: string | null
  phonetic?: string | null
}

export interface SpeakingPayload {
  intro_markdown?: string | null
  items: SpeakingItem[]
  voice_hint?: string | null
  /** The target language the phrases are in — usually not the course language. */
  language?: string | null
}

export interface DialoguePayload {
  scenario_markdown: string
  ai_role: string
  learner_role: string
  /** Shown to the learner as their objective; the tutor ends the scene when it's met. */
  goal: string
  opening_line?: string | null
  hints?: string[] | null
  /** The target language the conversation is in — usually not the course language. */
  language?: string | null
}

/** The four curated things a generated picture may be FOR. */
export type IllustrationIntent = 'depiction' | 'contrast' | 'scene' | 'metaphor'

/**
 * A picture that has already been drawn, resolved at READ time and merged into
 * the payload in memory by `IllustrationHydrator`. It is never persisted, which
 * is what lets the server bump its prompt template and re-point every block in
 * the product without a data migration or a stale id to chase.
 *
 * Only `ready` is ever hydrated. The key being ABSENT is therefore the signal to
 * ask for one — not a failure, and not a state to render as such.
 */
export interface IllustrationImage {
  state: 'ready'
  url: string
  /** Null when the server could not read the dimensions out of the file header. */
  width: number | null
  height: number | null
}

export interface IllustrationPayload {
  /**
   * What to draw, in plain words. The model writes THIS, never a prompt — the
   * server composes the real prompt from a house template carrying the no-text,
   * no-photorealism and no-real-people rules.
   */
  subject: string
  /**
   * Required, because this IS the block whenever there is no picture. It has to
   * teach on its own; some learners will only ever get these words.
   */
  alt_text: string
  caption?: string | null
  intent: IllustrationIntent
  /**
   * Labels rendered as real DOM text OVER the image, in the manner of
   * `annotated_media` — same geometry contract, same `Hotspot` shape. Nothing is
   * ever baked into the picture: image models misspell ("Palisade Mesowhyll",
   * "Lonweny Mesolerhyll", observed live), and the product teaches in ~16
   * languages, where a misspelt English label would be wrong twice.
   *
   * Optional and read defensively because the server does not emit it yet:
   * `BlockPayloadNormaliser::illustration()` currently keeps only
   * intent/subject/caption/alt_text. The renderer is here first on purpose — the
   * day the normaliser keeps a `points` key, every existing block starts showing
   * labels with no frontend change.
   */
  points?: Hotspot[] | null
  /** Absent until a picture exists. Hydrated, never stored. */
  image?: IllustrationImage | null
}

export interface MisconceptionPayload {
  /** The wrong thing learners actually arrive believing. */
  belief: string
  /**
   * The grain of truth in it. Required: a refutation without this is a strawman,
   * and nobody updates their mind against a strawman — the same argument
   * `analogy` makes for `breaks_down_when`.
   */
  why_it_seems_right: string
  what_is_true: string
  /**
   * How to catch yourself making it again. Optional: naming the tell is hard, and
   * a model that cannot do it should say nothing rather than pad.
   */
  tell?: string | null
}

export type IllustrationBlock = BlockBase<'illustration', IllustrationPayload>
export type MisconceptionBlock = BlockBase<'misconception', MisconceptionPayload>

export type AnalogyBlock = BlockBase<'analogy', AnalogyPayload>
export type WalkthroughBlock = BlockBase<'walkthrough', WalkthroughPayload>
export type ChecklistBlock = BlockBase<'checklist', ChecklistPayload>
export type DiagramBlock = BlockBase<'diagram', DiagramPayload>
export type ComparisonBlock = BlockBase<'comparison', ComparisonPayload>
export type ReferenceTableBlock = BlockBase<'reference_table', ReferenceTablePayload>
export type ScenarioBlock = BlockBase<'scenario', ScenarioPayload>
export type WorkedExampleBlock = BlockBase<'worked_example', WorkedExamplePayload>
export type PlaygroundBlock = BlockBase<'playground', PlaygroundPayload>
export type AnnotatedMediaBlock = BlockBase<'annotated_media', AnnotatedMediaPayload>
export type TimelineBlock = BlockBase<'timeline', TimelinePayload>
export type AudioBlock = BlockBase<'audio', AudioPayload>
export type SpeakingBlock = BlockBase<'speaking', SpeakingPayload>
export type DialogueBlock = BlockBase<'dialogue', DialoguePayload>

export type ExplainerBlock = BlockBase<'explainer', ExplainerPayload>
export type KeyPointsBlock = BlockBase<'key_points', KeyPointsPayload>
export type ExampleBlock = BlockBase<'example', ExamplePayload>
export type ResourceBlock = BlockBase<'resource', ResourcePayload>
export type VideoBlock = BlockBase<'video', VideoPayload>
export type QuizBlock = BlockBase<'quiz', QuizPayload>
export type ExamBlock = BlockBase<'exam', ExamPayload>
export type ProjectBlock = BlockBase<'project', ProjectPayload>
export type FlashcardsBlock = BlockBase<'flashcards', FlashcardsPayload>
export type CodeBlock = BlockBase<'code', CodePayload>
export type ReflectionBlock = BlockBase<'reflection', ReflectionPayload>

/**
 * A block whose `type` the frontend does not know about. `BlockRenderer` must
 * fall through to this case rather than crashing (SPEC §3).
 */
export type UnknownBlock = BlockBase<BlockType, Record<string, unknown>> & {
  type: BlockType
}

export type Block =
  | ExplainerBlock
  | KeyPointsBlock
  | ExampleBlock
  | ResourceBlock
  | VideoBlock
  | QuizBlock
  | ExamBlock
  | ProjectBlock
  | FlashcardsBlock
  | CodeBlock
  | ReflectionBlock
  | AnalogyBlock
  | WalkthroughBlock
  | ChecklistBlock
  | DiagramBlock
  | ComparisonBlock
  | ReferenceTableBlock
  | ScenarioBlock
  | WorkedExampleBlock
  | PlaygroundBlock
  | AnnotatedMediaBlock
  | TimelineBlock
  | AudioBlock
  | SpeakingBlock
  | DialogueBlock
  | IllustrationBlock
  | MisconceptionBlock

/** Payload type for a given block type, e.g. `PayloadFor<'quiz'>`. */
export type PayloadFor<T extends BlockType> = Extract<Block, { type: T }>['payload']

/* -------------------------------------------------------------------------- */
/* Assessments & attempts (SPEC §7)                                           */
/* -------------------------------------------------------------------------- */

export interface AssessmentOption {
  id: string
  text: string
}

export interface RubricCriterion {
  criterion: string
  weight: number
  excellent: string
  acceptable: string
  poor: string
}

/** `answer_key` is stripped server-side and is intentionally absent. */
export interface Assessment {
  id: number
  node_id: number
  block_id: number | null
  kind: AssessmentKind
  prompt: string
  options: AssessmentOption[] | null
  /**
   * The only part of an answer key a learner may see. Present on `numeric` items
   * and carries the expected unit — not the value, and not the tolerance.
   */
  input_hint?: { kind: 'numeric'; unit: string | null } | null
  rubric: RubricCriterion[] | null
  kind_label?: string
  grader: GraderKind
  grader_label?: string
  graded_automatically?: boolean
  max_score: number
  /** Score at or above which the item counts as passed. */
  pass_score?: number
  position: number
  /**
   * This learner's attempts, embedded by `GET /api/nodes/{id}` so the player can
   * restore graded state without a request per question. Absent on endpoints
   * that do not load the relation (e.g. the shared read-only view).
   */
  attempts?: Attempt[]
  attempt_summary?: AssessmentAttemptSummary
  created_at?: IsoDateTime
  updated_at?: IsoDateTime
}

export interface AssessmentAttemptSummary {
  count: number
  best_score: number | null
  passed: boolean
  last_attempt_at: IsoDateTime | null
}

export interface CriterionScore {
  criterion: string
  score_0_to_1: number
  comment: string
}

/** Learner submission shapes accepted by `POST /assessments/{id}/attempt`. */
export type AttemptResponse =
  | { option_id: string }
  | { option_ids: string[] }
  | { text: string }
  | { blanks: string[] }
  | { completed: boolean }
  | { code: string; results?: CodeTestResult[]; console?: string[] }
  | Record<string, unknown>

export interface CodeTestResult {
  name: string
  passed: boolean
  expected?: unknown
  received?: unknown
  error?: string | null
}

export interface Attempt {
  id: number
  assessment_id: number
  user_id: number
  response: AttemptResponse
  score: number | null
  passed: boolean | null
  feedback: string | null
  criterion_scores: CriterionScore[] | null
  grader_meta: Record<string, unknown> | null
  created_at: IsoDateTime
  updated_at: IsoDateTime
}

/* -------------------------------------------------------------------------- */
/* Materials (SPEC §5)                                                        */
/* -------------------------------------------------------------------------- */

export interface Material {
  id: number
  user_id?: number
  course_id: number | null
  /** Where it came from. What it *is* lives in `format`. */
  kind: MaterialKind
  kind_label: string
  format: MaterialFormat
  /** Server-authored, e.g. "Slide deck". Never derive a badge from the filename. */
  format_label: string
  title: string
  /**
   * Never on the wire. `MaterialResource` withholds it on purpose — it is a
   * server-side storage location and the client has no business knowing it.
   */
  path?: never
  url: string | null
  mime: string | null
  bytes: number | null
  status: MaterialStatus
  status_label: string
  is_ready: boolean
  needs_input: boolean
  /** Which ask to offer on a `needs_input` row, and null on every other row. */
  wants: MaterialWants | null
  char_count: number
  /** Present when the query counted it (`withCount('chunks')`). */
  chunk_count?: number
  failure_reason: string | null
  /** Only a video has something to play. Null everywhere else, by design. */
  preview_url: string | null
  source_meta: MaterialSourceMeta | null
  created_at: IsoDateTime
  updated_at: IsoDateTime
}

/* -------------------------------------------------------------------------- */
/* Scheduling (SPEC §6)                                                       */
/* -------------------------------------------------------------------------- */

export interface Schedule {
  id: number
  course_id: number
  user_id?: number
  starts_on: IsoDate
  minutes_per_week: number
  /** ISO weekday numbers, 1 = Monday. */
  days_of_week: number[]
  status: ScheduleStatus
  items?: ScheduleItem[]
  course?: Pick<CourseSummary, 'id' | 'slug' | 'path' | 'title' | 'language' | 'status'>
  created_at?: IsoDateTime
  updated_at?: IsoDateTime
}

export interface ScheduleItem {
  id: number
  schedule_id: number
  node_id: number
  scheduled_for: IsoDate
  estimated_minutes: number
  state: ScheduleItemState
  node?: Node
  created_at?: IsoDateTime
  updated_at?: IsoDateTime
}

export interface ScheduleCreatePayload {
  starts_on: IsoDate
  minutes_per_week: number
  days_of_week: number[]
}

export interface ScheduleItemPatchPayload {
  state?: ScheduleItemState
  scheduled_for?: IsoDate
}

/* -------------------------------------------------------------------------- */
/* Today (`GET /api/today`)                                                   */
/* -------------------------------------------------------------------------- */

/** Minimal course identity carried by today items (`ScheduleItemResource::courseBrief`). */
export interface TodayCourseRef {
  id: number
  slug?: string | null
  /** `/{username}/{course-slug}`; see `courseUrl()`. */
  path?: string | null
  title: string
  language: string
  status: CourseStatus
  status_label?: string
}

/** Per-node progress carried inline by today items. */
export interface NodeProgressRef {
  state: ProgressState
  time_spent_seconds: number
  completed_at: IsoDateTime | null
  last_seen_at: IsoDateTime | null
}

/** Node identity carried by today items (`ScheduleItemResource::nodePayload`). */
export interface TodayNodeRef {
  id: number
  course_id?: number
  key: string
  title: string
  summary?: string | null
  estimated_minutes: number
  status: NodeStatus
  status_label?: string
  is_expanded?: boolean
  layer?: number
  position?: number
  progress?: NodeProgressRef | null
}

export interface TodayItem extends Omit<ScheduleItem, 'node'> {
  course_id: number
  weekday: number
  state_label: string
  is_open: boolean
  is_today: boolean
  is_overdue: boolean
  /** Whole days between `scheduled_for` and today; > 0 means overdue. */
  days_late: number
  days_until: number
  course: TodayCourseRef
  node: TodayNodeRef
}

/** The schedule summary embedded in each row of `today.courses`. */
export interface TodayCourseSchedule {
  id: number
  status: ScheduleStatus
  starts_on: IsoDate
  minutes_per_week: number
  minutes_per_session: number
  days_of_week: number[]
  items_total: number
  items_done: number
  items_skipped: number
  items_open: number
  minutes_remaining: number
  percent: number
  next_scheduled_for: IsoDate | null
  finishes_on: IsoDate | null
}

/** Per-course progress strip on the home screen. Flat, not nested under `progress`. */
export interface TodayCourseProgress {
  id: number
  title: string
  language: string
  level: CourseLevel | null
  status: CourseStatus
  status_label: string
  nodes_total: number
  nodes_ready: number
  nodes_completed: number
  nodes_in_progress: number
  minutes_total: number
  minutes_completed: number
  time_spent_seconds: number
  percent: number
  schedule: TodayCourseSchedule
}

/** "Continue where you left off" — why, plus the node and course to resume. */
export interface ContinueTarget {
  reason: 'in_progress' | 'next_scheduled'
  node: TodayNodeRef
  course: TodayCourseRef | null
  state: ProgressState
  time_spent_seconds: number
  last_seen_at: IsoDateTime | null
}

/** Consecutive-days streak plus a 14-day activity strip. */
export interface TodayStreak {
  current: number
  longest: number
  active_today: boolean
  last_completed_on: IsoDate | null
  days: Array<{
    date: IsoDate
    weekday: number
    completed: number
    is_today: boolean
  }>
}

export interface TodaySummary {
  due_today: number
  due_today_minutes: number
  overdue: number
  overdue_minutes: number
  upcoming: number
  completed_today: number
  completed_today_minutes: number
  active_courses: number
  is_study_day: boolean
  all_clear: boolean
  has_schedule: boolean
}

export interface TodayWeek {
  starts_on: IsoDate
  ends_on: IsoDate
  planned_minutes: number
  completed_minutes: number
  days: Array<{
    date: IsoDate
    weekday: number
    items: number
    done: number
    minutes: number
    is_today: boolean
    is_past: boolean
  }>
}

export interface TodayNotifications {
  unread: number
  latest: {
    id: number
    type: string
    title: string
    is_read: boolean
    created_at: IsoDateTime | null
  } | null
}

export interface TodayResponse {
  date: IsoDate
  weekday: number
  timezone: string
  user: { id: number; name: string }
  summary: TodaySummary
  streak: TodayStreak
  due_today: TodayItem[]
  overdue: TodayItem[]
  completed_today: TodayItem[]
  next_up: TodayItem | null
  continue: ContinueTarget | null
  courses: TodayCourseProgress[]
  week: TodayWeek
  notifications: TodayNotifications
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */

export interface Notification {
  id: number
  user_id?: number
  type: string
  title: string
  body: string | null
  payload: Record<string, unknown> | null
  read_at: IsoDateTime | null
  created_at: IsoDateTime
  updated_at?: IsoDateTime
}

/* -------------------------------------------------------------------------- */
/* Generation                                                                 */
/* -------------------------------------------------------------------------- */

/** `event: progress` frame from `GET /api/courses/{course}/stream`. */
export interface GenerationProgressEvent {
  status: CourseStatus
  nodes_total: number
  nodes_ready: number
  nodes_failed: number
  percent: number
}

export interface GenerationRun {
  id: number
  course_id: number | null
  node_id: number | null
  stage: GenerationStage
  model: string
  status: 'success' | 'failed'
  input_tokens: number
  output_tokens: number
  cost_usd: string | number
  duration_ms: number
  attempts: number
  error: string | null
  created_at: IsoDateTime
}

/* -------------------------------------------------------------------------- */
/* Envelopes & errors                                                         */
/* -------------------------------------------------------------------------- */

/** Laravel API Resources wrap payloads in `{ data: ... }` by default. */
export interface Wrapped<T> {
  data: T
  meta?: Record<string, unknown>
  links?: Record<string, unknown>
}

/** Either a bare payload or a `{ data }` envelope. */
export type MaybeWrapped<T> = T | Wrapped<T>

/** Laravel's error body (SPEC §8 conventions). */
export interface ApiErrorBody {
  message: string
  errors?: Record<string, string[]>
}

/* ========================================================================== */
/* APPEND REGIONS                                                             */
/*                                                                            */
/* Four workstreams add types to this file at the same time. Everything above  */
/* this line is shared ground and is already settled — the block-type union,   */
/* the code-exercise contract, the material unions. Below, each workstream has */
/* its own region: append inside YOURS and touch nobody else's, and four       */
/* agents can land in one file without a single merge conflict.               */
/*                                                                            */
/* A type that more than one region needs does not belong in a region. Move it */
/* up into the shared part of the file and say so in the commit.              */
/* ========================================================================== */

/* -- Code exercise (workstream A) ------------------------------------------ */
/* The CodeMode / CodeTest / CodePayload contract itself lives up in the block */
/* payload section, because the server emits it and BlockRenderer consumes it. */
/* What belongs here is A's own UI vocabulary: the normalised exercise spec,   */
/* per-check run results, the shape the attempt is submitted in.               */

/**
 * ONE normalised check, whatever mode produced it. The five modes differ in how
 * a check is EVALUATED, never in how it is named or reported: `name` is carried
 * through verbatim from the payload because `DeterministicGrader::declaredTests()`
 * matches client-reported names against declared ones by exact string equality,
 * and a check we rename reads to the grader as "not reported" — which scores
 * zero for a correct answer.
 */
export interface ExerciseCheck {
  name: string
  /** function | debug | query — handed to the worker untouched. */
  test?: {
    name: string
    call?: string
    expect?: unknown
    expectTable?: { columns?: string[]; rows: unknown[][]; ordered?: boolean }
  }
  /** script — one worker run per check, because a run has exactly one stdout. */
  stdinCase?: { stdin: string | undefined; expectStdout: string }
  /** build — graded against the parsed document on this thread, never rendered. */
  dom?: {
    selector: string
    minCount: number
    textContains: string | null
    attribute: { name: string; value: string | null } | null
  }
}

/**
 * The payload after normalisation. Nothing downstream of the composable reads a
 * raw payload field: a lesson generated before modes existed and one generated
 * this morning have to render through the same code, and the place to reconcile
 * them is here, once.
 */
export interface ExerciseSpec {
  mode: CodeMode
  /** The sandbox runtime. `html` never reaches the worker. */
  lang: 'python' | 'javascript' | 'sql' | 'html'
  /** What the payload called the language, for the header. */
  language: string
  checks: ExerciseCheck[]
  /** query only: the fixture, run first on the same database. */
  setup: string | null
  /** query only: derived server-side from the fixture, never restated. */
  tables: Array<{ name: string; columns: string[] }>
  /** build only: what "done" looks like, ticked by the learner. */
  requirements: string[]
  /** debug only: what the broken code does, as the learner would observe it. */
  symptomMarkdown: string | null
  hints: string[]
  /** False when there is nothing to check — an explorable query, a visual build. */
  graded: boolean
}

/** One check's verdict, as the output pane renders it and the attempt reports it. */
export interface CheckResult {
  name: string
  passed: boolean
  /** Why it did not pass: the diff, the rows that came back, the missing match. */
  detail: string | null
  /** Why it could not be evaluated AT ALL — a crash, or a case never reached. */
  error: string | null
  /** Declared, so the pane can show the target even when the run blew up. */
  expected: string | null
  /** script only: what that case actually printed. */
  received: string | null
}

export interface ExerciseRun {
  results: CheckResult[]
  /** query only. Structurally identical to the worker's ResultTable. */
  table: { columns: string[]; rows: unknown[][] } | null
  stdout: string
  stderr: string | null
  timedOut: boolean
  durationMs: number
  /** The runtime never loaded. Nothing in this run is submittable. */
  aborted: boolean
}

/**
 * EXACTLY the keys `SubmitAttemptRequest`'s `code` arm declares.
 *
 * `SubmitAttemptRequest::response()` returns `$this->validated()['response']`,
 * and Laravel's `validated()` drops every key without a rule — so a `mode`, a
 * `hints_used` or a build checklist added here would vanish silently between the
 * HTTP request and the grader, with no error anywhere. Nothing outside this
 * shape is sent.
 */
export interface CodeAttemptResponse {
  code: string
  language: string
  tests: Array<{
    name: string
    passed: boolean
    error: string | null
    detail: string | null
    expected: string | null
    received: string | null
  }>
  console: string[]
  timed_out: boolean
  duration_ms: number
}

/* -- Generated imagery (workstream C) -------------------------------------- */
/* IllustrationPayload is shared and lives above. What belongs here is the     */
/* imagery ENDPOINT's vocabulary — the poll response, its states, the          */
/* remaining-allowance figure the owner is shown when a lesson degrades to alt */
/* text so that a hit ceiling never looks like a broken worker.                */

/**
 * Why there is no picture. The two halves matter to different people:
 * `course_cap` / `plan_cap` / `weekly_budget` / `disabled` / `provider_halted`
 * are the system working as designed and the owner can act on them, whereas
 * `worker_stalled` and `generation_failed` are an outage. They used to be
 * indistinguishable from outside, which is the whole reason this field exists.
 *
 * `not_owner` is ours, not the server's: a signed-in reader who does not own the
 * course gets a 404 from the trigger, and that is a fact about them rather than
 * about the lesson, so it is never shown.
 */
export type IllustrationUnavailableReason =
  | 'no_subject'
  | 'worker_stalled'
  | 'generation_failed'
  | 'disabled'
  | 'provider_halted'
  | 'course_cap'
  | 'plan_cap'
  | 'weekly_budget'
  | 'not_owner'

/**
 * What is left of each imagery ceiling. Rides on every trigger response,
 * successful or not — the owner should see the wall coming rather than discover
 * it, exactly as they do with the material quota.
 */
export interface ImageryAllowance {
  course_used: number
  /** Null means "no ceiling of this kind", not "zero". */
  course_limit: number | null
  month_used: number
  month_limit: number | null
  week_spend_usd: number
  week_budget_usd: number | null
  /** On their own OpenRouter key the platform's dollar ceiling does not apply. */
  using_own_key: boolean
}

/**
 * `POST /api/blocks/{block}/illustration`. Three shapes, and NONE of them is an
 * error status: a capped budget is content, not a fault, and a red toast over an
 * otherwise perfectly readable lesson would be a lie about how bad it is. Only a
 * genuine client bug (a block that is not yours, or not an illustration) 404s.
 */
export type IllustrationTriggerResponse =
  | {
      state: 'ready'
      url: string
      width?: number | null
      height?: number | null
      allowance?: ImageryAllowance | null
    }
  | {
      state: 'generating'
      /** Seconds the server wants us to wait before asking again. */
      retry_after?: number | null
      allowance?: ImageryAllowance | null
    }
  | {
      state: 'unavailable'
      reason?: IllustrationUnavailableReason | null
      /** Plain words for the course owner, already written for them by the server. */
      message?: string | null
      allowance?: ImageryAllowance | null
    }

/* -- Search (workstream D) ------------------------------------------------- */
/* Hits, groups, the request/response envelope for GET /api/search. A hit      */
/* points at a block by id; the anchor it scrolls to is `block-{id}`, which F  */
/* puts on the element carrying the scroll margin.                            */

export type SearchHitKind = 'course' | 'node' | 'block' | 'material'

export type SearchGroupKey = 'courses' | 'lessons' | 'content' | 'materials'

/**
 * Which tier of the server's ladder answered.
 *
 * `like` means the FTS index was unavailable and a plain scan answered instead
 * — results are still real, just narrower. Worth surfacing quietly rather than
 * hiding: a search that quietly stopped using its index and a search over an
 * empty library otherwise look identical.
 */
export type SearchRetrieval = 'fts' | 'like' | 'none'

export interface SearchHitCourse {
  id: number
  title: string
  /** `/{username}/{course-slug}`, or null for a row that predates slugs. */
  path: string | null
}

export interface SearchHitNode {
  id: number
  /** The stable outline slug, which is what `?node=` carries. */
  key: string
  title: string
  status: NodeStatus
}

export interface SearchHitBlock {
  id: number
  type: BlockType
  type_label: string
}

export interface SearchHitMaterial {
  id: number
  kind: MaterialKind
  title: string
  course_id: number | null
}

export interface SearchHit {
  /** `kind:id`. Unique across groups, so it keys a flat keyboard list. */
  id: string
  kind: SearchHitKind
  title: string
  /** The breadcrumb the server composed: "Course · Lesson". */
  context: string
  /**
   * PLAIN TEXT. Each match is wrapped in the two private-use codepoints
   * `HL_OPEN` / `HL_CLOSE` from `~/utils/highlight`. It is never HTML and must
   * never reach `v-html`: block prose is model-authored, so a snippet
   * interpolated as HTML is a stored-XSS delivery path. Split it with
   * `splitHighlights()` and render real <mark> elements.
   */
  snippet: string
  course: SearchHitCourse | null
  node: SearchHitNode | null
  block: SearchHitBlock | null
  material: SearchHitMaterial | null
}

export interface SearchGroup {
  key: SearchGroupKey
  label: string
  results: SearchHit[]
  has_more: boolean
  /** Only ever a number in focused (`in=`) mode; null in the grouped answer. */
  total: number | null
}

export interface SearchResponse {
  query: string
  scope: { course_id: number | null; course_title: string | null }
  retrieval: SearchRetrieval
  /**
   * True only when the index itself failed and the answer came from a plain
   * scan. Not the same as `retrieval === 'like'`: the scan also answers in
   * ordinary use (a two-letter word), and that is not worth a warning.
   * Optional so an API that predates it still type-checks.
   */
  degraded?: boolean
  took_ms: number
  /**
   * EMPTY — not four empty groups — when the server found nothing usable to
   * search for in the query. That difference is the whole "keep typing" vs "no
   * results" distinction, and it is the server's answer rather than a rule the
   * client has to re-derive from the tokeniser.
   */
  groups: SearchGroup[]
}

/* -- Materials (workstream E) ---------------------------------------------- */
/* MaterialKind and MaterialStatus are shared and live above. What belongs     */
/* here is everything E adds around them: format labels, per-material progress,*/
/* the parent/child grouping, the quota figures.                              */

/**
 * What a material *is*, as opposed to where it came from. Derived server-side
 * from kind + extension + mime and sent alongside `format_label`, so no client
 * ever has to guess a badge out of `title.split('.')` — which is wrong for
 * every file whose name lost its extension, and can never know a .vtt is a
 * transcript rather than a text file.
 */
export type MaterialFormat =
  | 'pdf'
  | 'docx'
  | 'slides'
  | 'book'
  | 'transcript'
  | 'sheet'
  | 'markup'
  | 'note'
  | 'web'
  | 'image'
  | 'video'
  | 'unknown'

/**
 * The one thing that would unstick a `needs_input` material. It picks the
 * button, and it is the entire reason `needs_input` exists as a state separate
 * from `failed`: a red row with no next move is where people give up.
 */
export type MaterialWants = 'text' | 'transcript'

/**
 * Whatever the ingest learned about the source. Deliberately open: every key is
 * optional and the server merges new ones in over time, so a client that
 * insists on a shape will break the first time an extractor learns something.
 */
export interface MaterialSourceMeta {
  /** Video only, from LinkClassifier. */
  provider?: string
  video_id?: string
  title?: string
  author_name?: string
  thumbnail_url?: string
  duration?: number
  /** Set once the owner answered the ask; the upload itself is kept alongside. */
  supplied_text?: boolean
  original_path?: string
  wants?: MaterialWants
  [key: string]: unknown
}

/**
 * `GET /api/materials/quota` — the same numbers EnforceMaterialQuota refuses
 * from, so the meter on the screen and the sentence that turns someone away can
 * never disagree.
 *
 * `metered: false` means the acting user has no organization (a pre-auth row
 * that never registered): nothing is counted against them and the meter should
 * stay off the screen rather than draw an empty bar.
 */
export interface MaterialQuota {
  plan: string
  byok: boolean
  metered: boolean
  storage: {
    used_bytes: number
    limit_bytes: number
    remaining_bytes: number
    materials: number
    materials_limit: number
  }
  upload: {
    max_bytes: number
  }
}

/* -------------------------------------------------------------------------- */
/* BILLING — what is left to spend                                            */
/* -------------------------------------------------------------------------- */

/**
 * One meter's remaining allowance: `GET /api/allowance`.
 *
 * Two buckets, deliberately not summed into one figure by the API. The PLAN
 * share resets on the 1st and is meant to be spent; the TOP-UP share was bought
 * (or carried over) and keeps until it expires. `remaining` is the total for
 * convenience, but the split is what a person needs to decide anything.
 *
 * `metered: false` means nothing is being counted — an own-model-key learner, or
 * an account with no organization. Draw nothing rather than an empty bar.
 */
export interface MeterAllowance {
  meter: string
  metered: boolean
  plan_limit: number | null
  plan_used: number
  plan_remaining: number
  topup_remaining: number
  /** plan_remaining + topup_remaining, or null when nothing is counted. */
  remaining: number | null
  /** How full the PLAN share is, 0-100. Top-ups deliberately excluded. */
  percent_used: number
  unmetered: boolean
  /**
   * The signup gift still left, already INSIDE `topup_remaining` —
   * here so it can be named as what it is rather than as something bought.
   */
  starter_remaining?: number
  /** When the gift lapses, ISO 8601, or null when there is none. */
  starter_expires_at?: string | null
  /**
   * A learning centre's pilot pool (`bilimind:pilot`) still left, also INSIDE
   * `topup_remaining`, and the pilot's last moment.
   */
  pilot_remaining?: number
  pilot_expires_at?: string | null
}

/**
 * One buyable pack. There is no currency and no exchange rate: a pack adds to
 * exactly one meter, in the same noun the rest of the product uses.
 */
export interface TopupPack {
  id: string
  /** `node_expansion` | `illustration` */
  meter: string
  name: string
  description: string
  quantity: number
  /** Smallest currency unit, tax-exclusive — VAT is added at checkout. */
  price: number
  currency: string
  /** False until the price exists on the selling provider; the button says so rather than 500s. */
  purchasable: boolean
  expires_after_days: number
}

/** `GET /api/allowance` — both meters, plus the way out of either. */
export interface AllowanceResponse {
  lessons: MeterAllowance | null
  illustrations: MeterAllowance | null
  packs: TopupPack[]
  resets_at?: string
}

/* -------------------------------------------------------------------------- */
/* EDIT — a lesson's history                                                  */
/* -------------------------------------------------------------------------- */

export type RevisionCause = 'generated' | 'edited' | 'rewritten' | 'regenerated' | 'restored'

/** One entry in History: `GET /api/nodes/{node}/revisions`. */
export interface Revision {
  id: number
  node_id: number
  cause: RevisionCause
  cause_label: string
  /** Server-composed: "Edited the explainer", "Regenerated: simpler". */
  summary: string
  user: { id: number; name: string } | null
  is_current?: boolean
  restored_from_revision_id: number | null
  bytes: number
  created_at: IsoDateTime
}

export type RevisionBlockChange = 'added' | 'changed' | 'same'

export interface RevisionBlockEntry {
  id: number | null
  type: BlockType
  label: string
  change: RevisionBlockChange
  moved: boolean
  /** Payload keys whose values differ, `type`, or `source_material_ids`. */
  fields: string[]
}

export interface RevisionChanges {
  title: boolean
  summary: boolean
  estimated_minutes: boolean
  blocks: RevisionBlockEntry[]
  removed: Array<{ id: number; type: BlockType; label: string; before_index: number }>
  counts: { added: number; removed: number; changed: number; moved: number }
}

export interface RevisionSnapshotAssessment {
  id: number | null
  block_id: number | null
  kind: string
  prompt: string
  options: unknown
  position: number
}

/** `GET /api/revisions/{revision}` — the version itself plus what changed. */
export interface RevisionDetail extends Revision {
  against_id: number | null
  changes: RevisionChanges
  snapshot: {
    title: string | null
    summary: string | null
    estimated_minutes: number | null
    /** Block ids are real rows, so a preview can outline them by id. */
    blocks: Block[]
    assessments: RevisionSnapshotAssessment[]
  }
}

export type DiffOp = 'eq' | 'del' | 'ins'

export interface DiffToken {
  op: DiffOp
  text: string
}

/* -- Lesson attachments (workstream ATTACH) -------------------------------- */
/* Files the course owner pins beside ONE lesson as extra context — a photo of */
/* their own wiring, the syllabus PDF, a voice memo. Not lesson content: they   */
/* never touch the lesson's parts, and only the owner can change them.         */

/** What the server sniffed the bytes as. Decides how the lesson shows it. */
export type AttachmentKind = 'image' | 'pdf' | 'audio' | 'video' | 'document' | 'file'

/**
 * One file attached to a lesson — the wire shape of `AttachmentResource`.
 *
 * `uuid` is the identity; there is no row id on the wire. `url` is signed and
 * time-limited, minted only inside a payload the reader was allowed to have,
 * and goes straight into `src`/`href`: an `<img>` cannot carry a bearer token,
 * so the file route carries none.
 */
export interface Attachment {
  uuid: string
  node_id: number
  /** The original filename, sanitised: no path, one line, never empty. */
  name: string
  mime: string
  kind: AttachmentKind
  /** "Photo", "PDF", "Voice memo" — the server's word for the kind. */
  kind_label: string
  bytes: number
  /** Pixel size for images so the lesson can hold the space; null otherwise. */
  width: number | null
  height: number | null
  caption: string | null
  /** Reading order among the lesson's attachments, 0-based and gapless. */
  position: number
  /** Signed, expiring. Use directly; never store it. */
  url: string
  created_at: IsoDateTime | null
}

/* -------------------------------------------------------------------------- */
/* MARKUP — a reader's private marks on a lesson                              */
/* -------------------------------------------------------------------------- */

/**
 * The four things a reader can leave on a lesson. Highlights and notes anchor
 * to text; ink anchors to a picture inside a block; a board is a blank canvas
 * that belongs to the lesson rather than to any one block. None of them are
 * part of the lesson, and nobody but the reader ever sees them.
 */
export type AnnotationKind = 'highlight' | 'note' | 'ink' | 'board' | 'label'

/**
 * `[x, y]` or `[x, y, pressure]`. x and y are 0..1 of the box the stroke was
 * drawn on — a picture's painted area, a board's logical canvas — so a stroke
 * lands on the same pixel of the picture at any rendered width.
 */
export type StrokePoint = [number, number] | [number, number, number]

export interface Stroke {
  /** `arrow` is a two-point stroke drawn with a head on the last point. */
  tool: 'pen' | 'marker' | 'arrow'
  /** A CSS colour, up to 24 characters. */
  color: string
  /** Width in px at a 1000px-wide box; scaled with the box when drawn. */
  size: number
  points: StrokePoint[]
}

/**
 * Where a highlight sits in a block's rendered text. `start`/`end` are
 * character offsets into the block's text; `quote` is what they covered, and
 * is what the mark is found by again once the lesson has been edited under it.
 */
export interface HighlightAnchor {
  block_id: number
  /** `'rendered'`: offsets into the text of the whole rendered block. */
  field: string
  start: number
  end: number
  quote: string
  /** Up to 32 characters either side, to tell apart repeated phrases. */
  prefix?: string
  suffix?: string
}

export interface InkAnchor {
  block_id: number
  /**
   * `media`: strokes over one picture, normalised to its painted box so they
   * never drift. `block`: strokes over the whole part, normalised to the
   * part's box when they were drawn and scaled with it since.
   */
  target: 'media' | 'block'
  /** `media` only — which picture in the block, counting `<img>`s in document order from 0. */
  media_index?: number
  /** The box the strokes were normalised to: the picture's natural size, or the part's size when drawn. */
  natural_width: number
  natural_height: number
}

export interface BoardAnchor {
  /** 100..8000 each. Points are normalised to this box. */
  logical_width: number
  logical_height: number
}

interface AnnotationBase {
  /** Minted by the client; the only name the server knows a mark by. */
  uuid: string
  node_id: number
  updated_at: IsoDateTime | null
}

export interface HighlightAnnotation extends AnnotationBase {
  kind: 'highlight'
  block_id: number
  anchor: HighlightAnchor
  data: { color: string }
}

export interface NoteAnnotation extends AnnotationBase {
  kind: 'note'
  block_id: number
  anchor: HighlightAnchor
  /**
   * `open` — shown as a card under the part it is on, with a number on the
   * words; folded, only a note mark on the words. Absent on notes made before
   * the choice existed, which read as open.
   */
  data: { color: string; text: string; open?: boolean }
}

export interface InkAnnotation extends AnnotationBase {
  kind: 'ink'
  block_id: number
  anchor: InkAnchor
  data: { strokes: Stroke[] }
}

export interface BoardAnnotation extends AnnotationBase {
  kind: 'board'
  block_id: null
  anchor: BoardAnchor
  data: { strokes: Stroke[]; title?: string; labels?: BoardLabel[] }
}

/** `GET /api/nodes/{node}/annotations` rows; `PUT` takes and returns the same. */
/** The Text tool: a few words at a point on a part or a picture. */
export type LabelSize = 'sm' | 'md' | 'lg'

export interface LabelLook {
  text: string
  color: string
  size: LabelSize
  weight?: 'normal' | 'bold'
  /** A paper backing behind the words, for busy pictures. */
  background?: boolean
}

export interface LabelAnchor {
  block_id: number
  target: 'media' | 'block'
  media_index?: number
  /** Normalised 0..1 to the box the label was placed on. */
  x: number
  y: number
  /** The box's size at placement — what the font scales against. */
  natural_width: number
  natural_height: number
}

export interface LabelAnnotation extends AnnotationBase {
  kind: 'label'
  block_id: number
  anchor: LabelAnchor
  data: LabelLook
}

/** A label on a whiteboard lives inside the board record (`data.labels`). */
export interface BoardLabel extends LabelLook {
  id: string
  x: number
  y: number
}

export type Annotation = HighlightAnnotation | NoteAnnotation | InkAnnotation | BoardAnnotation | LabelAnnotation

/* -------------------------------------------------------------------------- */
/* READING — how a person likes to read, kept with the account               */
/* -------------------------------------------------------------------------- */

export type ReadingFont = 'sans' | 'serif'
export type ReadingTheme = 'paper' | 'warm' | 'dim'

export interface ReadingSettings {
  /** Zoom of the lesson column, 0.75..1.6. */
  scale: number
  font: ReadingFont
  theme: ReadingTheme
}

export interface UserPreferences {
  reading?: Partial<ReadingSettings>
  /** MARKUP — ink colours the reader saved, beside the four the tray always has. */
  inks?: string[]
}

/** What the reader's pointer does next. `null` means they are reading. */
export type MarkupTool = 'highlight' | 'pen' | 'marker' | 'arrow' | 'eraser' | 'note' | 'text'
