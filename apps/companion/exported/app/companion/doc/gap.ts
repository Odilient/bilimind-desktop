import type { Item } from '../types'
import { timecode } from '../time'

/**
 * "What did I miss?": your notes compared with the slides and the transcript,
 * listing what isn't there, each with where it came from.
 *
 * The comparison runs on the server, `POST /api/companion/items/{id}/gaps`
 * with the page's plain text. It only ever runs when the learner opens the
 * panel. A server without the endpoint (404) shows "coming soon".
 */

/** How a source is shown: a slide, a second of the recording, a reading, a photo. */
export type GapSourceKind = 'slide' | 'recording' | 'reading' | 'photo'

export interface GapSource {
  /** "slides 18–20", "47:05", "whiteboard photo 2". */
  label: string
  kind: GapSourceKind
  item_id?: string | null
  at_seconds?: number | null
}

export interface Gap {
  id: string
  title: string
  /** What the page would say about it: inserted as the callout's text. */
  body: string
  /** A short reason it's here, e.g. "skipped in class, in the reading". */
  note?: string | null
  sources: GapSource[]
}

export type GapResult =
  | { state: 'ready'; compared: string; gaps: Gap[] }
  | { state: 'no-material' }
  | { state: 'coming-soon' }
  | { state: 'error'; message: string }

/** The server's shape: sources are slides, files and transcript lines. */
interface ServerSource {
  kind: 'slide' | 'file' | 'transcript' | GapSourceKind
  label?: string | null
  item_id?: string | null
  at_seconds?: number | null
}

interface ServerGap {
  id: string
  title: string
  body: string
  why?: string | null
  note?: string | null
  sources?: ServerSource[]
}

interface ServerAnswer {
  compared?: string
  gaps?: ServerGap[]
  reason?: 'no-material' | null
}

/**
 * A transcript line is a moment of the recording, shown by its time; a file is
 * reading. Slides and photos keep their own labels.
 */
function toSource(source: ServerSource): GapSource {
  const at = source.at_seconds ?? null
  switch (source.kind) {
    case 'transcript':
    case 'recording':
      return {
        kind: 'recording',
        label: at != null ? timecode(at) : source.label || 'the recording',
        item_id: source.item_id ?? null,
        at_seconds: at,
      }
    case 'file':
    case 'reading':
      return { kind: 'reading', label: source.label || 'the reading', item_id: source.item_id ?? null, at_seconds: null }
    default:
      return { kind: source.kind, label: source.label || source.kind, item_id: source.item_id ?? null, at_seconds: at }
  }
}

function toGap(gap: ServerGap): Gap {
  return {
    id: gap.id,
    title: gap.title,
    body: gap.body,
    note: gap.note ?? gap.why ?? null,
    sources: (gap.sources ?? []).map(toSource),
  }
}

export async function findGaps(page: Item, text: string): Promise<GapResult> {
  try {
    const answer = await useApi().post<ServerAnswer>(`/companion/items/${page.id}/gaps`, { text })
    if (answer.reason === 'no-material') return { state: 'no-material' }
    return { state: 'ready', compared: answer.compared ?? '', gaps: (answer.gaps ?? []).map(toGap) }
  } catch (error) {
    const e = error as { status?: number; message?: string }
    if (e.status === 404 || e.status === 405) return { state: 'coming-soon' }
    if (e.status === 0) return { state: 'error', message: 'This needs a connection. Your notes are safe; try again once you are online.' }
    if (e.status === 429) return { state: 'error', message: 'That was a lot of comparing in one minute. Try again in a moment.' }
    // 503 says in words what went wrong with the model; anything else gets the plain version.
    return { state: 'error', message: e.status === 503 && e.message ? e.message : 'Could not compare your notes just now. Try again in a minute.' }
  }
}
