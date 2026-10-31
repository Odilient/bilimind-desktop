/**
 * The bookkeeping around a native recording (app/companion/native/recorder.ts).
 *
 * The recorder names each recording's folder by the `sessionId` it is given,
 * and a start with an id it already knows continues that folder. So every
 * recording gets a fresh id — the id of the item it will be filed as — and
 * which class it belongs to travels with it: in the recorder's own manifest
 * (`start({ meta })`, which survives the app being killed and the WebView's
 * storage being reclaimed), and in localStorage as a fallback for a recorder
 * that predates `meta`.
 */
import type { Item } from './types'
import type { CompanionStore } from './store'
import type { RecorderState } from './native/recorder'
import { nowIso } from './time'

export interface RecordingMeta {
  /** The recorder's sessionId, and the id of the item it is filed as. */
  id: string
  subject_id: string | null
  session_id: string | null
  topic_id: string | null
  /** "Databases · Lecture 8". */
  label: string
}

const KEY = 'bm:recordings'

function readAll(): Record<string, RecordingMeta> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, RecordingMeta>
  } catch {
    return {}
  }
}

function writeAll(all: Record<string, RecordingMeta>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // Without storage a re-attached recording files under the course on screen.
  }
}

export function rememberRecording(meta: RecordingMeta): void {
  writeAll({ ...readAll(), [meta.id]: meta })
}

export function recordingMeta(id: string | null | undefined): RecordingMeta | null {
  return id ? (readAll()[id] ?? null) : null
}

/** The class a recording belongs to: its manifest's word first, then ours. */
export function metaOf(state: RecorderState | null | undefined): RecordingMeta | null {
  if (!state?.sessionId) return null
  const m = state.meta as Partial<RecordingMeta> | null | undefined
  if (m && typeof m.label === 'string') {
    return {
      id: state.sessionId,
      subject_id: m.subject_id ?? null,
      session_id: m.session_id ?? null,
      topic_id: m.topic_id ?? null,
      label: m.label,
    }
  }
  return recordingMeta(state.sessionId)
}

export function forgetRecording(id: string): void {
  const all = readAll()
  delete all[id]
  writeAll(all)
}

/**
 * File what the recorder holds as one recording item. Safe to call twice:
 * the item's id is the recording's, so a second call finds it filed.
 */
export async function fileRecording(
  store: CompanionStore,
  state: RecorderState,
  fallback: Omit<RecordingMeta, 'id'>,
): Promise<Item | null> {
  const id = state.sessionId
  if (!id || store.get('items', id)) return null
  const duration = Math.round(state.elapsedMs / 1000)
  if (duration <= 0 || !state.segments.length) return null
  const meta = metaOf(state) ?? { id, ...fallback }
  const item = await store.upsert<Item>('items', {
    id,
    subject_id: meta.subject_id,
    session_id: meta.session_id,
    topic_id: meta.topic_id,
    parent_id: null,
    kind: 'recording',
    title: `${meta.label.split(' · ').at(-1) ?? 'Voice memo'} recording`,
    preview: null,
    meta: { duration_s: duration, segments: state.segments.length, path: state.dir },
    source: 'made',
    source_ref: null,
    position: store.items.value.length,
    pinned: false,
    created_at: state.startedAt ?? nowIso(),
  })
  forgetRecording(id)
  return item
}
