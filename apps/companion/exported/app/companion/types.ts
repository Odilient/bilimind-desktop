/**
 * The companion's data model, mirrored from the server tables in
 * the design notes
 *
 * Every row is owned by one user, keyed by a client-generatable uuid, and
 * soft-deleted through `deleted_at` so sync can carry tombstones.
 */

export type Uuid = string
/** ISO 8601 with offset, e.g. `2026-10-27T10:00:00+05:00`. */
export type IsoDateTime = string
/** `YYYY-MM-DD`. */
export type IsoDate = string

export interface Row {
  id: Uuid
  created_at?: IsoDateTime
  updated_at?: IsoDateTime
  deleted_at?: IsoDateTime | null
}

/** Token names drawn by the app's course palette, or any hex colour. */
export type CourseColor = 'db' | 'net' | 'prg' | 'mth' | 'seg' | 'eng' | 'ita' | 'c8' | (string & {})

export type Confidence = 'official' | 'heard' | 'shared' | 'own'

export interface Goal extends Row {
  title: string
  kind: 'term' | 'self'
  starts_on: IsoDate | null
  /** The finish line. */
  ends_on: IsoDate | null
  weeks: { n: number; starts_on: IsoDate }[] | null
  breaks: { starts_on: IsoDate; ends_on: IsoDate; label: string }[] | null
  exam_period: { starts_on: IsoDate; ends_on: IsoDate } | null
  finish_kind: 'exam' | 'project' | 'date' | null
  finish_label: string | null
  sessions_per_week: number | null
  minutes_per_session: number | null
  timezone: string
  status: 'active' | 'done' | 'archived'
}

/** UI "Course". */
export interface Subject extends Row {
  goal_id: Uuid | null
  title: string
  code: string | null
  color: CourseColor
  lecturer: string | null
  source: 'moodle' | 'canvas' | 'teams' | 'ics' | 'manual' | 'generated' | 'public' | 'import' | 'classroom'
  source_ref: string | null
  source_url: string | null
  format: 'weeks' | 'path'
  generated_course_id: number | null
  recording_allowed: boolean
  position: number
  /** Off the Courses shelf since then (`companion/shelf.ts`); null while on it. */
  archived_at: IsoDateTime | null
  /** The learner's own group ("Year 2 · Autumn"), or null for none. */
  group_name: string | null
  /** The starter kit's sample course (`companion/samples.ts`). */
  sample?: boolean
  /**
   * "Make me try first" for this course: the assistant asks for an attempt
   * on every question here, not only on graded work. It
   * can only make the assistant stricter; there is no switch that loosens it.
   */
  try_first: boolean
  /** Daylight 2 (gaps): the overall mark aimed for, 0-100 (`grades.ts` `neededOnRest`); null for none. */
  grade_target?: number | null
  /**
   * Daylight 2 (gaps): the class share this course is part of (`shares.ts`),
   * as its owner or a member; null for a course of one's own. Set by the server.
   */
  share_id?: Uuid | null
  /**
   * The cover's picture: a glyph key from `COURSE_ICONS` or one emoji; null
   * lets `courseIcon()` pick one from the title (`companion/course-icons.ts`).
   */
  icon?: string | null
}

export interface Slot extends Row {
  subject_id: Uuid
  kind: 'lecture' | 'tutorial' | 'lab' | 'seminar' | 'lesson' | 'study'
  /** ISO weekday, Monday = 1. */
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7
  /** `HH:MM`. */
  starts_at: string
  ends_at: string
  location: string | null
  valid_from: IsoDate | null
  valid_until: IsoDate | null
  source_ref: string | null
}

/** UI "session" / "class". Table `class_sessions`. */
export interface Session extends Row {
  subject_id: Uuid
  slot_id: Uuid | null
  title: string
  number: number | null
  starts_at: IsoDateTime
  ends_at: IsoDateTime
  location: string | null
  week: number | null
  topic_id: Uuid | null
  cancelled: boolean
  source_ref: string | null
}

export type ItemKind = 'page' | 'board' | 'file' | 'recording' | 'photo' | 'link'

/**
 * Imports and links: a link's preview (`Item.meta.link`). `embed_url`
 * is a player or viewer on the service's own host, set only when the thing is
 * public; a private Canva or Figma design has a title and no embed.
 */
export interface LinkPreview {
  url: string
  title: string | null
  provider: string | null
  thumbnail: string | null
  embed_url: string | null
}

/** Recording: one line of a recording's transcript, in seconds from its start. */
export interface TranscriptLine {
  start: number
  end: number | null
  text: string
}

export interface Item extends Row {
  /** `null` = the Notebook. */
  subject_id: Uuid | null
  session_id: Uuid | null
  topic_id: Uuid | null
  parent_id: Uuid | null
  kind: ItemKind
  title: string
  preview: string | null
  meta: {
    path?: string
    mime?: string
    size?: number
    duration_s?: number
    segments?: number
    url?: string
    template?: string
    icon?: string
    /** A seeded page's first text, set out once by the editor (a server or starter-kit seed). */
    seed_html?: string
    /** One of the starter kit's sample notes (`companion/samples.ts`). */
    sample?: true
    /** `fresh`: a page made from /app/p/new starts as the bare template. Boards keep `deadline_id` here. */
    props?: Record<string, unknown>
    /**
     * The course a note made in My notes probably belongs to (made during its
     * class, or with it open). Only ever a suggestion: the note's header asks
     * "Add to Databases?" and nothing moves without that tap. Nulled once
     * filed or dismissed. `notes/make.ts` writes it; `notes/suggest.ts` reads it.
     */
    suggested_subject_id?: string | null
    suggested_session_id?: string | null
    /**
     * Planner and inbox: answered in the Inbox ("Keep in My notes"),
     * so an arrival from outside stops asking where it goes (`companion/inbox.ts`).
     */
    inbox_done_at?: IsoDateTime | null
    /**
     * Google: the Google Doc this page was last saved to, so the next
     * "Update in Google Docs" replaces it (`companion/google/docs.ts`).
     */
    google_doc?: { id: string; url: string }
    /*
     * Recording. A desktop recording is kept on the computer that
     * made it (`on_device`), never uploaded, so it has no `path` (which the
     * server reads as its own stored file). `screen`: it has a picture.
     * `transcript` is written on that computer (`companion/transcribe/`); the
     * server already reads it as `[{start, text}]` (CourseMaterial), and
     * `transcribed_s` is how far it got, so a stopped one carries on.
     */
    on_device?: boolean
    screen?: boolean
    transcript?: TranscriptLine[]
    transcribed_s?: number
    /**
     * Imports and links: what a link is, read once from the service
     * (POST /companion/links/unfurl; `companion/imports/links.ts`), and the
     * deadline it sits on, when it was added there (the link is then in the
     * deadline's course too).
     */
    link?: LinkPreview
    deadline_id?: Uuid | null
  }
  source: 'made' | 'moodle' | 'canvas' | 'ics' | 'email' | 'share' | 'generated' | 'import'
    // MCP: a note or link ChatGPT or Claude added; `source_ref` is
    // `assistant:chatgpt` / `assistant:claude`.
    | 'assistant'
  source_ref: string | null
  /** A signed, short-lived link to the stored file (http mode); fetched again when it runs out. */
  file_url?: string | null
  position: number
  pinned: boolean
}

export interface Topic extends Row {
  subject_id: Uuid
  /** A unit groups topics. */
  parent_id: Uuid | null
  title: string
  position: number
  summary: string | null
  source: 'extracted' | 'generated' | 'manual' | 'moodle'
  weight: number | null
  node_id: number | null
}

export type DeadlineKind =
  | 'assignment' | 'quiz' | 'lab' | 'midterm' | 'final' | 'exam'
  | 'project' | 'presentation' | 'milestone' | 'other'

export interface DeadlineSource extends Row {
  deadline_id: Uuid
  kind: 'moodle' | 'teams' | 'canvas' | 'ics' | 'email' | 'transcript' | 'share' | 'classmate' | 'user' | 'photo' | 'pdf' | 'classroom'
  confidence: Confidence
  evidence: string
  url: string | null
  item_id: Uuid | null
  at_seconds: number | null
  observed_at: IsoDateTime
  change: Record<string, { from: unknown; to: unknown }> | null
}

/** UI "deadline" / "assessment". */
export interface Deadline extends Row {
  subject_id: Uuid
  kind: DeadlineKind
  title: string
  due_at: IsoDateTime | null
  all_day: boolean
  weight_pct: number | null
  location: string | null
  status: 'upcoming' | 'submitted' | 'done' | 'missed' | 'cancelled'
  confidence: Confidence
  confirmed: boolean
  scope_note: string | null
  grade: number | null
  /** Tasks as a board: Doing since then; null while it is to do. Done is still `status`. */
  started_at?: IsoDateTime | null
  /** Tasks as a tracker: the learner's own say, never the school's (an LMS sync leaves these). */
  priority?: Priority
  /** The learner's own note; `scope_note` is what the school says it covers. */
  notes?: string | null
  checklist?: ChecklistItem[] | null
  /**
   * What readiness said on the due date, stored by the server when the grade
   * comes in (from the LMS or typed by the learner): "Readiness said 70%. You
   * got 74%." Null until there is a grade, or when nothing was checked.
   */
  readiness_said: number | null
  source_ref: string | null
  /** Derived by the server: heard or shared, and not confirmed. */
  tentative: boolean
  topic_ids: Uuid[]
  sources: DeadlineSource[]
}

export interface Card extends Row {
  /** Null for a card made on a Notebook page: it is reviewed, but counts toward no course's readiness. */
  subject_id: Uuid | null
  topic_id: Uuid | null
  item_id: Uuid | null
  kind: 'basic' | 'cloze' | 'question'
  front: string
  back: string
  source_quote: string | null
  /** A ts-fsrs `Card`, serialised. */
  fsrs: Record<string, unknown>
  due_at: IsoDateTime
  last_review_at: IsoDateTime | null
  suspended: boolean
}

export interface PlanTask extends Row {
  /**
   * The day it's for. Tasks and grades: null only for a task of the
   * learner's own that has no day yet ("No date" on /app/tasks); the server
   * refuses a dateless task of any other kind. An own task's `detail` is its note.
   */
  date: IsoDate | null
  subject_id: Uuid | null
  deadline_id: Uuid | null
  topic_id: Uuid | null
  item_id: Uuid | null
  /**
   * `own` is one the learner typed; the planner never replaces it. `check`
   * is a sitting of cold checks (`/app/check`): its topics are named in the
   * title, and starting it posts `POST /checks {purpose: 'cold', deadline_id}`,
   * which picks the same topics by the same rule.
   */
  kind: 'review' | 'read' | 'practice' | 'prepare' | 'lesson' | 'work' | 'own' | 'check'
  title: string
  detail: string | null
  minutes: number
  position: number
  done_at: IsoDateTime | null
  generated_at: IsoDateTime
  /**
   * Planner and inbox: the day the plan first put it on, once the
   * learner moved it to another (the Calendar's week, "Do it tomorrow").
   * Set by the server only; while it's set the planner leaves the task where
   * it is and doesn't plan it again on the day it left. Never on `own` tasks.
   */
  moved_from?: IsoDate | null
  /** Tasks as a board: Doing since then; null while it is to do. Done is still `done_at`. */
  started_at?: IsoDateTime | null
  /** The Calendar's grid: the hour it is planned for, `HH:MM`; null keeps it in its day's To do strip. Never without a `date`. */
  starts_at?: string | null
  /** Tasks as a tracker: 0 none, 1 low, 2 medium, 3 high, 4 urgent. */
  priority?: Priority
  /** Tasks as a tracker: the steps inside it, or null. */
  checklist?: ChecklistItem[] | null
}

/** Tasks as a tracker: how pressing a task or deadline is, 0 (none) to 4 (urgent). */
export type Priority = 0 | 1 | 2 | 3 | 4

/** One step inside a task or a deadline (`checklist`). */
export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export type FactType =
  | 'deadline.create' | 'deadline.update' | 'deadline.cancel'
  | 'session.cancel' | 'session.move' | 'slot.create' | 'note'

export interface SignalFact {
  type: FactType
  subject_guess: { id: Uuid | null; title: string | null; code: string | null }
  target_id: Uuid | null
  payload: Record<string, unknown>
  evidence: string
  at_seconds?: number | null
}

export interface Signal extends Row {
  channel: 'email' | 'share' | 'transcript' | 'ics' | 'moodle' | 'photo' | 'pdf' | 'telegram' | 'manual'
    // Planner and inbox: a deadline proposed by an import (Notion) or
    // by ChatGPT or Claude (the MCP server), waiting in the Inbox.
    | 'import' | 'assistant'
  raw_excerpt: string
  item_id: Uuid | null
  at_seconds: number | null
  subject_id: Uuid | null
  facts: SignalFact[]
  confidence: Confidence
  status: 'pending' | 'applied' | 'dismissed' | 'auto'
  applied_at: IsoDateTime | null
}

export interface Connection extends Row {
  kind: 'ics' | 'moodle' | 'email' | 'teams'
    // Imports: Notion's page picker; the token stays on the server.
    | 'notion'
    // Daylight 2 (gaps): Google Classroom, read-only (`imports/classroom.ts`).
    | 'classroom'
  label: string
  url: string | null
  site_url: string | null
  status: 'ok' | 'error' | 'pending'
  last_synced_at: IsoDateTime | null
  error: string | null
  meta: Record<string, unknown>
}

/* -------------------------------------------------------------------------- */
/* Checks: done means remembered                        */
/* -------------------------------------------------------------------------- */

/**
 * `recall` says it in your own words, `apply` works a step, `why` explains
 * why something happens, `explain` is teach-back: the whole topic explained
 * to a listener, who asks one follow-up.
 */
export type CheckKind = 'recall' | 'apply' | 'why' | 'explain'
/** Asked before the answer is marked: "Sure", "Think so", "Guessing". */
export type CheckConfidence = 'sure' | 'think' | 'guess'
export type CheckResult = 'right' | 'partly' | 'wrong'
/**
 * `cold`: the daily check, on topics studied a few days ago. `prepare`: three
 * questions on what a new assessment needs (§3.6). `teach`: teach it back.
 */
export type CheckPurpose = 'cold' | 'prepare' | 'teach'

/** Where a question came from; drawn as a chip that opens it, like a chat citation. */
export interface CheckSource {
  /** A file, recording or page of theirs; null for a written lesson. */
  item_id: Uuid | null
  /** A written lesson (the old app's node). */
  node_id: number | null
  /** "Lecture 8 slides · slide 19", "Lesson 3 · SQL joins". */
  label: string
  quote: string | null
  at_seconds: number | null
}

/**
 * One question of a check, and once answered, how it went. Made by the
 * server (`POST /checks`), answered through `POST /checks/{id}/answer`, and
 * otherwise read-only: it syncs like any row, so readiness can be worked out
 * on the device. The model answer never reaches the client before the
 * question is answered: `revealed` is filled in by the marking.
 */
export interface Check extends Row {
  /** One sitting: the questions asked together. */
  batch_id: Uuid
  purpose: CheckPurpose
  subject_id: Uuid | null
  topic_id: Uuid | null
  /** The assessment it was asked for, if any. */
  deadline_id: Uuid | null
  kind: CheckKind
  prompt: string
  /** Null: from general knowledge, not from their material (the screen says so). */
  source: CheckSource | null
  /**
   * Asked cold: at least a few days after the topic was last studied, or on
   * a topic never studied. Only a cold check counts toward readiness; a
   * teach-back straight after the lesson is practice.
   */
  cold: boolean
  /** Days since the topic was last studied, when it was asked; null if never. */
  studied_days_ago: number | null
  confidence: CheckConfidence | null
  answer: string | null
  /** Teach-back: the listener's one question, and the reply to it. */
  follow_up: string | null
  follow_up_answer: string | null
  result: CheckResult | null
  feedback: string | null
  /** The model answer, set when the question is marked. */
  revealed: string | null
  /** Sure, and not right: why the wrong answer was tempting. */
  tempting: string | null
  asked_at: IsoDateTime
  answered_at: IsoDateTime | null
  graded_at: IsoDateTime | null
  /**
   * Daylight 2 (gaps): `written` (answered in their own words, the default),
   * `choice` (pick one of four `options`) or `truefalse` (`options` is
   * ['True', 'False']). An option question is answered with the option's
   * exact text and marked right or wrong on the server, with no model call.
   */
  format?: CheckFormat
  options?: string[] | null
  /** A written answer, once marked: each rubric point and the verdict on it ("1/1" when met). */
  marks?: CheckMark[] | null
}

export type CheckFormat = 'written' | 'choice' | 'truefalse'

export interface CheckMark {
  point: string
  verdict: 'met' | 'partly' | 'missed'
}

/** `POST /checks`: a sitting, or nothing to check yet and when there will be. */
export interface CheckSitting {
  batch_id: Uuid | null
  checks: Check[]
  /** With no checks: when the next topic in reach turns cold. Null when nothing has been studied. */
  opens_at: IsoDateTime | null
}

/* -------------------------------------------------------------------------- */
/* Your class: circles built from data                      */
/* -------------------------------------------------------------------------- */

/**
 * `GET /deadlines/{id}/class`: the learner's class for one assessment, from
 * check data only, anonymous. Classmates are other learners with the same
 * course (the same Moodle course, or the same standard exam) and the same
 * assessment. Class numbers show only from 5 learners who share.
 */
export interface ClassView {
  /**
   * False when the course can't be matched to classmates at all (not from an
   * LMS, not a standard exam): the screen then shows nothing about a class.
   */
  possible: boolean
  /** Learners on BiliMind with this assessment, the caller included. */
  members: number
  /** Whether the class numbers below are shown (5 or more sharing). */
  shown: boolean
  /** Classmates who practised or checked its topics in the last 7 days. */
  preparing: number | null
  readiness_median: number | null
  /** The scope's hardest topics, by how often classmates missed them in checks. */
  hardest: { title: string; missed_pct: number }[]
  /** The caller shares their own results (users.preferences.companion.share_results). */
  sharing: boolean
  /** A share card for the class chat: no names, no material. */
  invite: { title: string; text: string; url: string }
}

/** Everything the app holds locally. `GET /bootstrap` and `GET /changes` share this shape. */
export interface Snapshot {
  goals: Goal[]
  subjects: Subject[]
  slots: Slot[]
  sessions: Session[]
  topics: Topic[]
  deadlines: Deadline[]
  items: Item[]
  cards: Card[]
  plan_tasks: PlanTask[]
  signals: Signal[]
  connections: Connection[]
  checks: Check[]
  server_time: IsoDateTime
}

export type CollectionName =
  | 'goals' | 'subjects' | 'slots' | 'sessions' | 'items' | 'topics'
  | 'deadlines' | 'cards' | 'plan-tasks' | 'signals' | 'connections' | 'checks'

export interface Today {
  date: IsoDate
  now_session: Session | null
  next_session: Session | null
  due_soon: { deadline: Deadline; readiness: number }[]
  plan: { minutes: number; tasks: PlanTask[] }
  reviews_due: number
  inbox_count: number
  pace: {
    goal_id: Uuid
    status: 'on' | 'behind' | 'ahead'
    weeks_behind: number
    sessions_per_week_needed: number
    sessions_per_week_actual: number
  }[]
}

/**
 * A topic's place in the checks: `checked` (its last counted check went
 * well enough), `missed` (its last one didn't: it's back in the plan),
 * `unchecked` (studied, no check yet), `unstudied` (nothing to check).
 */
export type TopicCheckState = 'checked' | 'missed' | 'unchecked' | 'unstudied'

/**
 * Readiness from proof: a topic's number is the pass rate
 * of its cold checks in the last six weeks, recent ones counting more and
 * the whole fading as the newest gets old. A topic never checked has no
 * number ("not checked yet"); over a deadline it counts as 0, so the figure
 * only rises when something is shown to have stuck. Same rule on the server
 * (`Readiness.php`) and the device (`readiness.ts`).
 */
export interface Readiness {
  /** Σ weight × topic percent over the scope, unchecked topics at 0. */
  percent: number
  /** Topics in scope with a counted check in the window, and all topics in scope. */
  checked: number
  total: number
  topics: {
    topic_id: Uuid
    title: string
    weight: number
    /** Null until a check counts. */
    percent: number | null
    state: TopicCheckState
    /** Counted checks in the window, and how they went. */
    checks: number
    right: number
    partly: number
    last_checked_at: IsoDateTime | null
    last_studied_at: IsoDateTime | null
    /** When it is cold enough to check; null when it is now, or never studied. */
    checkable_at: IsoDateTime | null
    /**
     * Daylight 2 (gaps): when it is next due for a check, on the ladder "a day
     * after the lesson, then a week, then a month" (a week after one right
     * sitting, a month after two in a row); null when never studied. In the
     * past when it is due now. "Its next check is in a month, on Wed 9 Dec."
     */
    next_check_at?: IsoDateTime | null
    /** Share of its cards reviewed at least once, 0–1: the work, shown beside the proof. */
    practiced: number
  }[]
  /**
   * Over counted answers in scope that carry a confidence: how many, how many
   * said "Sure", and how many of THOSE were right ("Sure of 9 in 10, right on
   * 6 of them"). Null under 5.
   */
  calibration: { answered: number; sure: number; right: number } | null
  suggestion: {
    /** The check that would move the number: topics checkable now. */
    check: { topics: number; questions: number; minutes: number }
    /** The cards in scope due today or new. */
    practice: { cards: number; minutes: number }
  }
}

export interface DocState {
  snapshot: string | null
  updates: { id: Uuid; update: string; created_at: IsoDateTime }[]
  /**
   * `false` when this may be short of what the server holds: PowerSync answering
   * offline for a page it never synced. An empty doc then proves nothing, so a
   * page or board must not be set out from its template on it, or the server's
   * text arrives later and the page reads twice. Absent means complete.
   */
  complete?: boolean
}

export interface GoalDraft {
  questions?: { id: string; question: string; options?: string[] }[]
  goal?: Goal
  subject?: Subject
  topics?: Topic[]
}
