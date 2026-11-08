/**
 * The one door every companion screen reads and writes through.
 *
 * Two implementations sit behind it: `http` (the REST contract in
 * the design notes) and `powersync` (local-first, synced), and
 * screens never know which.
 *
 */
import type {
  CollectionName,
  Connection,
  DocState,
  GoalDraft,
  Readiness,
  Row,
  Signal,
  Snapshot,
  Today,
  Uuid,
  Item,
  Card,
  Check,
  CheckConfidence,
  CheckPurpose,
  CheckSitting,
  ClassView,
} from './types'

export interface IcsImportResult {
  connection: Connection
  created: { slots: number; sessions: number; deadlines: number }
  updated: number
}

export interface CompanionRepo {
  readonly mode: 'http' | 'powersync'

  /** Everything for the signed-in user. */
  bootstrap(): Promise<Snapshot>
  /** Rows changed since a server time, tombstones included. */
  changes(since: string): Promise<Snapshot>

  list<T extends Row>(collection: CollectionName, filter?: Record<string, string | number | boolean>): Promise<T[]>
  /** Create or update; send a client-made `id` to create offline-safely. */
  upsert<T extends Row>(collection: CollectionName, row: Partial<T> & { id: Uuid }): Promise<T>
  remove(collection: CollectionName, id: Uuid): Promise<void>

  today(date: string): Promise<Today>
  rebuildPlan(date: string): Promise<void>
  readiness(deadlineId: Uuid): Promise<Readiness>

  /**
   * `subjects`: fact index => the course the
   * learner picked for a proposed deadline that names none of theirs.
   */
  applySignal(id: Uuid, factIndexes?: number[], subjects?: Record<number, Uuid>): Promise<void>
  dismissSignal(id: Uuid): Promise<void>

  reviewCard(id: Uuid, review: { rating: 1 | 2 | 3 | 4; fsrs: Record<string, unknown>; due_at: string; reviewed_at: string }): Promise<Card>

  /**
   * A sitting of checks. Without topics the server picks
   * what is due; open questions from an unfinished sitting come back first.
   * Online only: the questions are written and marked by the server.
   */
  startCheck(body: { purpose: CheckPurpose; topic_ids?: Uuid[]; deadline_id?: Uuid; subject_id?: Uuid }): Promise<CheckSitting>
  /**
   * Answer one question and get it back marked. A teach-back's first answer
   * comes back with `follow_up` set and no result; send `follow_up_answer`
   * to have it marked. Sending an answered, unmarked question again retries
   * the marking. An empty answer is "I don't know": marked wrong, no model.
   */
  answerCheck(id: Uuid, body: { answer: string; confidence?: CheckConfidence | null; follow_up_answer?: string | null }): Promise<Check>
  /** The class for one assessment, anonymous. */
  classOf(deadlineId: Uuid): Promise<ClassView>

  pageDoc(itemId: Uuid): Promise<DocState>
  pushDocUpdate(itemId: Uuid, update: string): Promise<void>
  upload(file: File, where: { subject_id?: Uuid; session_id?: Uuid }): Promise<Item>

  ingestText(text: string, channel: 'share' | 'manual' | 'email', subjectId?: Uuid): Promise<Signal[]>
  ingestIcs(source: { url: string } | { ics_text: string }): Promise<IcsImportResult>
  ingestFile(file: File): Promise<Signal[]>
  goalFromSentence(sentence: string, answers?: Record<string, string>): Promise<GoalDraft>

  // Google: a file picked in Drive, already downloaded by the browser
  // (`google/drive.ts`), and the learner's calendar link (Settings → Calendar).
  /** 201 a new item, or the one brought in from that Drive file before. */
  importDriveFile(
    file: File,
    where: { drive_id: string; url?: string | null; subject_id?: Uuid; session_id?: Uuid; suggested_subject_id?: Uuid },
  ): Promise<Item>
  /** The link a calendar app subscribes to, or null until one is made. */
  calendarFeed(): Promise<{ url: string | null }>
  /** A new link; the old one stops working. */
  newCalendarFeed(): Promise<{ url: string }>
}
