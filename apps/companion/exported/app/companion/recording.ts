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
import { MEDIA_FILE, type Recorded } from './recorder'
import { isDesktopApp, usePlatform } from './platform'
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

/* -- The web and the desktop (recorder.ts) ---------------------------- */

/** The server's upload limit (ItemController::MAX_UPLOAD_KB): about two hours of sound at the recorder's bitrate. */
const MAX_UPLOAD = 50 * 1024 * 1024

function extensionOf(mime: string): string {
  if (mime.includes('mp4')) return 'm4a'
  if (mime.includes('ogg')) return 'ogg'
  return 'webm'
}

/**
 * File what the web or desktop recorder made as one recording item.
 *
 *  - Desktop: the bytes are already on this computer, in the recording's own
 *    folder, so the item takes the recording's id and says `on_device`. It
 *    never carries `meta.path`: the server reads that as a file it stores
 *    and would sign a link to nothing.
 *  - Web: uploaded like any file (the server makes a `file` item and keeps
 *    the bytes), then turned into a recording with its length. If the upload
 *    fails, the learner is handed the file to save, so a lecture is never lost
 *    to a bad connection.
 */
export async function fileMediaRecording(
  store: CompanionStore,
  rec: Recorded,
  place: Omit<RecordingMeta, 'id'>,
  title: string | null = null,
): Promise<Item | null> {
  if (rec.duration_s <= 0) return null
  // "Lecture 8 recording"; with no class to name it after, "Voice memo recording" or plain "Screen recording"
  const base = place.label.split(' · ').at(-1) || 'Voice memo'
  const named = title ?? (rec.screen ? (base === 'Voice memo' ? 'Screen recording' : `${base} screen recording`) : `${base} recording`)
  if (!rec.blob) {
    return store.upsert<Item>('items', {
      id: rec.id,
      subject_id: place.subject_id,
      session_id: place.session_id,
      topic_id: place.topic_id,
      parent_id: null,
      kind: 'recording',
      title: named,
      preview: null,
      // No `size` either: the server counts `meta.size` against synced storage (MaterialQuota::usedBytes),
      // and what stays on this computer is never capped.
      meta: { duration_s: rec.duration_s, mime: rec.mime, on_device: true, ...(rec.screen ? { screen: true } : {}) },
      source: 'made',
      source_ref: null,
      position: store.items.value.length,
      pinned: false,
    })
  }
  const file = new File([rec.blob], `${named}.${extensionOf(rec.mime)}`, { type: rec.mime })
  try {
    if (file.size > MAX_UPLOAD) throw new Error('too big')
    const uploaded = await store.repo().upload(file, {
      subject_id: place.subject_id ?? undefined,
      session_id: place.session_id ?? undefined,
    })
    store.rows.items[uploaded.id] = uploaded
    return await store.upsert<Item>('items', {
      id: uploaded.id,
      kind: 'recording',
      title: named,
      topic_id: place.topic_id,
      meta: { ...uploaded.meta, duration_s: rec.duration_s },
    })
  } catch {
    useToast().error({
      title: 'The recording didn’t upload',
      body: file.size > MAX_UPLOAD
        ? 'It’s longer than an upload can take. Save it to this computer so nothing is lost.'
        : 'Save it to this computer so nothing is lost, and add it later with Upload files.',
      action: { label: 'Save it', handler: () => void usePlatform().saveFile(file, file.name) },
      // stays until it's answered: the only other copy goes when this tab does
      duration: 0,
    })
    return null
  }
}

/** Where a recording kept on this computer plays from; null anywhere else. */
export function deviceMediaUrl(item: Item): string | null {
  if (!item.meta.on_device || !isDesktopApp()) return null
  return usePlatform().recordings?.url(item.id, MEDIA_FILE) ?? null
}

/**
 * For a player's `loadedmetadata`. MediaRecorder writes WebM without its
 * length, so the player shows none and its bar can't seek until it has read
 * to the end. Asking for a time far past the end makes it find the end (it
 * reads, it doesn't play), and then it goes back to the start.
 */
export function settleDuration(event: Event): void {
  const el = event.target as HTMLMediaElement
  if (el.duration !== Infinity) return
  el.addEventListener('timeupdate', () => (el.currentTime = 0), { once: true })
  el.currentTime = 1e101
}
