/**
 * Imports and links: a link that shows what it is, and a YouTube
 * playlist that comes in as material.
 *
 *   await previewInto(store, item)     // reads the link once, keeps it on `meta.link`
 *   await importPlaylist(store, url, subjectId)  // the playlist's page, or null
 *
 * A preview is read by the server (`POST /companion/links/unfurl`: the
 * service's own oEmbed for YouTube, Vimeo, Loom, Figma and Canva, Open Graph
 * tags for anything else, never a private address) and kept on the row, so
 * it's read once per link and travels with it to every device. The title is
 * only replaced while it is still the one made from the address
 * ("canva.com · view"); a name the learner typed is theirs.
 *
 * Every link gets one: a new one as it's saved (`addLink`), an older one,
 * or one ChatGPT or Claude added, the first time its card is shown
 * (`CompanionLinksPreview`).
 *
 * A playlist link (`youtube.com/playlist?list=…`) becomes a page named after
 * the playlist with one link per video under it, in order. Without the
 * server's YouTube key (or for a private playlist) it answers null and the
 * caller saves the address as one ordinary link, which still previews.
 */
import { ApiError, useApi } from '~/composables/useApi'
import type { CompanionStore } from '../store'
import type { Item, LinkPreview, Uuid } from '../types'
import { linkTitle } from '../capture'

/** Providers whose things open in their own app, so the button says which. */
const APPS = new Set(['Canva', 'Figma', 'YouTube', 'Vimeo', 'Loom', 'Google Docs', 'Google Slides', 'Google Sheets'])

/**
 * Hosts a player may be framed from: the server only ever answers with these
 * (`Unfurler::PROVIDERS`), and the card checks again rather than trusting a
 * row another device or an old client wrote. The desktop app's page policy
 * lists the same hosts in `frame-src` (desktop/src/main/protocol.ts): change
 * all three together, or that app shows an empty frame.
 */
export const EMBED_HOSTS = [
  'www.youtube.com',
  'www.youtube-nocookie.com',
  'player.vimeo.com',
  'www.loom.com',
  'www.figma.com',
  'embed.figma.com',
  'www.canva.com',
  'docs.google.com',
]

/** "Open in Canva", "Open in YouTube", or "Open link". */
export function openWords(link: LinkPreview | null | undefined): string {
  return link?.provider && APPS.has(link.provider) ? `Open in ${link.provider}` : 'Open link'
}

/** The player's address when it may be framed here: https, on a host above. */
export function embedOf(link: LinkPreview | null | undefined): string | null {
  if (!link?.embed_url) return null
  try {
    const u = new URL(link.embed_url)
    return u.protocol === 'https:' && EMBED_HOSTS.includes(u.hostname) ? u.toString() : null
  } catch {
    return null
  }
}

/** A YouTube playlist's id, by the same rule as the server (`YouTubePlaylist::idFrom`). */
export function playlistId(url: string): string | null {
  try {
    const u = new URL(url)
    if (!['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(u.hostname.replace(/^www\./, ''))) return null
    if (u.pathname.replace(/\/+$/, '') !== '/playlist') return null
    const list = u.searchParams.get('list')
    return list && /^[\w-]{12,64}$/.test(list) && !list.startsWith('RD') ? list : null
  } catch {
    return null
  }
}

/**
 * The server's reading of a link. A refused address (private, internal)
 * comes back as an empty preview, so it isn't asked about again; a network
 * failure is null, and the next showing tries again.
 */
export async function unfurlLink(url: string): Promise<LinkPreview | null> {
  try {
    return await useApi().post<LinkPreview>('/companion/links/unfurl', { url })
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) {
      return { url, title: null, provider: null, thumbnail: null, embed_url: null }
    }
    return null
  }
}

const reading = new Map<Uuid, Promise<void>>()

/** Read a link's preview once and keep it on the row. Quiet: a link without one is still a link. */
export function previewInto(store: CompanionStore, item: Item): Promise<void> {
  const url = item.meta.url
  if (item.kind !== 'link' || item.meta.link || !url) return Promise.resolve()
  const running = reading.get(item.id)
  if (running) return running
  const job = (async () => {
    const preview = await unfurlLink(url)
    const now = store.get('items', item.id)
    if (!preview || !now || now.deleted_at || now.meta.link) return
    const named = Boolean(now.title) && now.title !== linkTitle(url)
    await store.upsert<Item>('items', {
      id: now.id,
      ...(!named && preview.title ? { title: preview.title } : {}),
      meta: { ...now.meta, link: preview },
    })
  })()
    .catch(() => undefined)
    .finally(() => reading.delete(item.id))
  reading.set(item.id, job)
  return job
}

/**
 * A playlist brought in where the button said (a course, or My notes): its
 * page, with the links already in the store. Null when it can't be (not a
 * playlist, no key on the server, private, offline).
 */
export async function importPlaylist(store: CompanionStore, url: string, subjectId: Uuid | null): Promise<Item | null> {
  if (!playlistId(url)) return null
  try {
    const made = await useApi().post<{ page: Item; items: Item[] }>(
      '/companion/imports/youtube',
      { url, subject_id: subjectId },
      { timeout: 60_000 },
    )
    for (const row of [made.page, ...made.items]) store.rows.items[row.id] = row
    return made.page
  } catch {
    return null
  }
}
