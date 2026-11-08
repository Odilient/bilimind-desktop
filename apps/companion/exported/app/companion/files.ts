/**
 * Where an item's bytes can be opened from.
 *
 * The API signs a `file_url` on every item it sends, but signed URLs expire, so PowerSync doesn't sync them: an
 * item read from the local database has none. Opening one then asks the API
 * for the item, which signs a fresh link.
 */
import { useApi } from '~/composables/useApi'
import type { Item } from './types'

export type WithFileUrl = Item & { file_url?: string | null }

/** A link that works right now, or null when one has to be asked for. */
export function knownFileUrl(item: WithFileUrl): string | null {
  return item.file_url ?? (item.source === 'made' ? (item.meta.url ?? item.meta.path ?? null) : null)
}

/** Ask the API for a freshly signed link; falls back to the original (e.g. Moodle's own). */
export async function fetchFileUrl(item: WithFileUrl): Promise<string | null> {
  try {
    const fresh = await useApi().get<WithFileUrl>(`/companion/items/${item.id}`)
    if (fresh.file_url) return fresh.file_url
  } catch {
    // Offline, or the item is gone: fall through to what we have.
  }
  return item.meta.url ?? null
}
