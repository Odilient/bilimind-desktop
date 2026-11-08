/**
 * The AI companion's shapes, shared by the panel, the Ask page, Today's
 * composer, the palette and the create flow. The server half is
 * `POST /api/companion/ask` (backend `routes/api/companion-ask.php`); these
 * types are its wire format, so change them together.
 *
 * The rule the whole feature follows: the AI never changes anything on its
 * own. When it can make something (a note, cards, a map, a course, a plan) it
 * says so as an `AiAction`, which the thread draws as a card with one button;
 * the learner's press is what makes it.
 */

/** What the answer may be grounded in: what's open, its course, or everything. */
export type AiScope = 'here' | 'course' | 'everything'

export type AiContextKind =
  | 'everything'
  | 'today'
  | 'course'
  | 'lesson'
  | 'page'
  | 'board'
  | 'deadline'
  | 'notes'

/**
 * What is on screen, registered by the screen with `useAiContext()`. It picks
 * the suggestions, the chip in the panel's header ("Lesson 3 · SQL joins"),
 * and what the server reads before it answers.
 */
export interface AiContext {
  kind: AiContextKind
  /** The chip's words: "SQL joins", "Lecture 8 notes", "Databases". */
  label: string
  subjectId?: string | null
  /** A page or a board. */
  itemId?: string | null
  topicId?: string | null
  /** A written lesson (the old app's node) and the generated course behind it. */
  nodeId?: number | null
  courseId?: number | null
  deadlineId?: string | null
  /**
   * The plain text of what is on screen, read only when a question is sent
   * (the server can't read a page's Yjs body, so the client hands it over).
   */
  excerpt?: () => string
}

export interface AiCitation {
  /**
   * `attachment`: something given in the chat that is no row of theirs: an
   * attached link or calendar (`url` set; open it), pasted text, or a Moodle
   * course's outline (`subject_id` set). A file or note given is `item`.
   */
  kind: 'item' | 'lesson' | 'topic' | 'deadline' | 'session' | 'attachment'
  /** A uuid, or a lesson's node id as a string (an attachment's: its URL, its course, or `text-N`). */
  id: string
  /** "Lecture 8 slides · slide 19", "Lesson 3 · SQL joins", "47:05". */
  label: string
  quote?: string | null
  at_seconds?: number | null
  subject_id?: string | null
  /** `attachment` from a link or calendar: the URL as it was sent. */
  url?: string | null
}

export interface AiMapBranch {
  title: string
  children?: AiMapBranch[]
}

/** Something the answer offers to make. Drawn as a card; nothing happens until pressed. */
export type AiAction =
  | { type: 'draw'; title: string; mode: '2d' | '3d'; caption?: string; brief: string; graphic?: import('./graphic').AiGraphic }
  | { type: 'create_page'; title: string; markdown: string; subject_id?: string | null }
  | {
      type: 'create_cards'
      subject_id?: string | null
      topic_id?: string | null
      cards: { front: string; back: string }[]
    }
  | { type: 'create_board'; title: string; subject_id?: string | null; root: string; branches: AiMapBranch[] }
  | {
      type: 'create_course'
      title: string
      summary?: string | null
      finish_date?: string | null
      topics: string[]
    }
  /** `rewrite`: the topic's lesson is already written, so the press rewrites it. */
  | { type: 'write_lesson'; topic_id: string; title: string; instruction?: string | null; rewrite?: boolean }
  | {
      type: 'add_tasks'
      date: string
      tasks: { title: string; minutes: number; subject_id?: string | null }[]
    }
  | {
      type: 'add_deadline'
      subject_id: string
      title: string
      kind: string
      due_at: string
    }
  | { type: 'quiz'; subject_id?: string | null; questions: { q: string; a: string }[] }
  | { type: 'open'; to: string; label: string }
  /**
   * "Make a course from this": offered when the learner gave material without
   * asking for a course. Pressed, it sends `label` as their next message with
   * `intent: 'course'`, and the proposer reads every attachment in the chat.
   */
  | { type: 'draft_course'; label: string }
  /** "OK, create it": the learner's words pressed Create on the draft `message_id` carries. */
  | { type: 'create_draft'; message_id: string }

/**
 * Something given with a message, the way ChatGPT takes a file: read before
 * the answer and cited like any other source. One composer takes all of
 * them at once, and the same list is what a course is made from when the
 * learner asks for one (the server hands it to the course proposer as is).
 *
 *  - `file`: uploaded on attach (`POST /companion/items/upload`, no course),
 *    so it is a Notes item by the time the message is sent.
 *  - `note`: a page, board or file already in Notes, picked or dragged in.
 *  - `link`: a web page (https). `calendar`: an .ics or webcal:// feed.
 *  - `text`: pasted text, at most 100,000 characters.
 *  - `moodle`: one of the learner's Moodle courses, already imported (its
 *    subject); the server reads its outline.
 */
export type AiAttachmentKind = 'file' | 'note' | 'link' | 'calendar' | 'text' | 'moodle'

export interface AiAttachment {
  kind: AiAttachmentKind
  /** The chip's words: "lecture-4.pdf", "Normal forms", "en.wikipedia.org", "Pasted text · 1,240 words". */
  label: string
  /** `file` and `note`. */
  item_id?: string | null
  /** `link` and `calendar`. */
  url?: string | null
  /** `text` only. Not echoed back on stored messages (the label says what it was). */
  text?: string | null
  /** `moodle`: the imported course. */
  subject_id?: string | null
  /** `file`: for the chip's icon. */
  mime?: string | null
}

/**
 * A course drafted inside the chat. When the learner says what they want to
 * learn (or attaches material and asks for a course), the answer says so in
 * a sentence and the server runs the course proposer over the message, the
 * chat so far and every attachment, then hangs the draft on the answer.
 * The chat draws it as a card (path, deadlines, pace, sources) with Edit and
 * Create course; asking for changes in the chat drafts it again, and the new
 * draft hangs on the new answer (the old card says it was replaced).
 */
export interface AiProposal {
  /** `drafting` while the proposer works (the status line names each step). */
  state: 'drafting' | 'ready' | 'failed'
  /** `CourseProposal` from `~/companion/create` (kept loose here to avoid a cycle). */
  proposal?: import('../create').CourseProposal | null
  error?: string | null
  /** Set once a course was made from this draft: the card turns into a link to it. */
  created?: { subject_id: string; goal_id?: string | null } | null
  /** A revision ("make it 6 weeks"): the id of the message whose draft this one replaces. */
  replaces?: string | null
  /** While `drafting`: the model's reasoning, then the draft as far as it is written. */
  partial?: AiProposalSoFar | null
}

export interface AiProposalSoFar {
  thinking?: string
  thinking_length?: number
  title?: string | null
  summary?: string | null
  units?: { title: string; topics: { title: string }[] }[]
  deadlines?: { title: string; due_at: string | null }[]
}

/**
 * One line of the work list while a course is drafted ("Reading
 * lecture-4.pdf", "Finding the deadlines", "Drawing your path"), sent as
 * `status` events with a `step`. Kept on the message while it is pending
 * only; the finished draft's `sources` say what was read.
 */
export interface AiStep {
  key: string
  label: string
  state: 'active' | 'done' | 'failed'
}

export interface AiMessage {
  id: string
  role: 'user' | 'assistant'
  /** Markdown. */
  text: string
  /** A passage the learner attached ("Ask about this"). */
  quote?: string | null
  /** A user message: what was given with it, drawn as chips above its text. */
  attachments?: AiAttachment[]
  citations?: AiCitation[]
  actions?: AiAction[]
  /** An assistant message: the course it drafted, if it drafted one. */
  proposal?: AiProposal | null
  /** An assistant message still streaming in. */
  pending?: boolean
  /** "Reading Lecture 8 slides…" while it is being grounded. */
  status?: string | null
  /** While a course is drafted: the work list (client-side only). */
  steps?: AiStep[]
  /** While the answer streams: what its action cards hold so far (client-side only). */
  making?: AiAction[] | null
  /**
   * An assistant message that asked for an attempt instead of doing the work
   *: the question was part of graded work (`graded`, with
   * the assessment), or the learner chose "Make me try first" (`try_first`,
   * with the course, or none for everywhere). Drawn as a line under the
   * answer with "Check my attempt" and "I'm stuck, show me".
   */
  guard?: AiGuard | null
  error?: string | null
  /** The error is the AI limit: the way out is Usage, not trying again. */
  limited?: boolean
  created_at: string
}

export interface AiGuard {
  reason: 'graded' | 'try_first'
  /** `graded`: the assessment ("Assignment 2"). */
  deadline_id: string | null
  /** `try_first`: the course it is on for; null when it is on everywhere. */
  subject_id: string | null
  /** "Assignment 2", "Databases", or "everywhere". */
  title: string
}

export interface AiThread {
  id: string
  title: string
  subject_id: string | null
  updated_at: string
  /** A thread that drafted a course (the sidebar's chat list marks it). */
  has_proposal?: boolean
  messages?: AiMessage[]
}

/** The request body of `POST /api/companion/ask`. */
export interface AiAskBody {
  message: string
  thread_id?: string | null
  quote?: string | null
  /** At most 12 items (file + note), 8 links (link + calendar), 100,000 characters of text. */
  attachments?: AiAttachment[]
  /**
   * `course`: the learner asked for a course outright (a "Make a course"
   * starter, Courses' New course), so the answer drafts one whatever the
   * words. Left out, the model decides from the message.
   * `attempt`: "Check my attempt": the message (and its photo or file) is the
   * learner's own work; the answer is feedback on it, never a rewrite.
   * `stuck`: "I'm stuck, show me", pressed on a guarded answer: the next
   * step only, without an attempt. Never the text they hand in.
   */
  intent?: 'course' | 'attempt' | 'stuck' | null
  scope: AiScope
  context: {
    kind: AiContextKind
    label?: string | null
    subject_id?: string | null
    item_id?: string | null
    topic_id?: string | null
    node_id?: number | null
    course_id?: number | null
    deadline_id?: string | null
    /** At most 16,000 characters. */
    excerpt?: string | null
  }
}
