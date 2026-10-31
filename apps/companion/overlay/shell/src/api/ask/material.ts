// What an answer reads: the words in an item, the chat's attachments, a link or a calendar feed. Long material is cut
// into excerpts, so a citation can point at the paragraph that backs a sentence.
import { extractFile } from '@bilimind/engine/ingest/index'
import { htmlToSections } from '@bilimind/engine/ingest/html'
import { basename, join } from 'node:path'
import { publicFetch } from './public-fetch.ts'
import type { Row, Store } from '../store.ts'
import { dayKey } from '../../../../app/companion/time.ts'

export interface Excerpt {
  id: string
  kind: 'slide' | 'file' | 'transcript'
  itemId: string
  title: string
  text: string
  number?: number | null
  atSeconds?: number | null
  topicId?: string | null
}

export interface Cite {
  kind: string
  id: string
  label: string
  at_seconds: number | null
  subject_id: string | null
  url?: string | null
}

export type Pair = [Excerpt, Cite]

const EXCERPT_CHARS = 1500
const TRANSCRIPT_WINDOW_SECONDS = 60
const MAX_FILE_BYTES = 30_000_000
const ATTACHED_BUDGET = 24_000
const PER_SOURCE = 10_000
const CHUNK = 1500
const LINK_CHARS = 24_000
const LINK_BYTES = 4_000_000
const CALENDAR_EVENTS = 200
const LINK_TTL_MS = 2 * 3_600_000
const DECK_MIMES = [
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  'application/vnd.ms-powerpoint',
]
const STOP = new Set([
  'the', 'and', 'for', 'are', 'was', 'were', 'you', 'your', 'how', 'why', 'what', 'when', 'where', 'who',
  'which', 'this', 'that', 'these', 'those', 'with', 'from', 'into', 'have', 'has', 'had', 'does', 'did',
  'can', 'could', 'would', 'should', 'will', 'about', 'please', 'explain', 'tell', 'give', 'make', 'show',
  'there', 'their', 'them', 'they', 'then', 'than', 'its', 'not', 'but', 'all', 'any', 'some', 'more',
  'most', 'also', 'just', 'like', 'mean', 'means', 'difference', 'between', 'need', 'want', 'know', 'help',
  'что', 'как', 'это', 'для', 'про', 'мне', 'где', 'когда', 'почему', 'есть', 'или', 'тут', 'там', 'чем',
  'его', 'она', 'они', 'мой', 'моя', 'мои', 'надо', 'нужно', 'объясни', 'расскажи',
  'nima', 'qanday', 'uchun', 'bilan', 'haqida', 'menga', 'qayerda', 'qachon', 'nega', 'bu', 'shu',
])

/** Lower case, letters and digits only, single spaces. */
export function normalise(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

/** The question's distinct content words: no stemming or embeddings, because learners call things what the slides call them. */
export function termsOf(...texts: string[]): string[] {
  const out = new Set<string>()
  for (const word of normalise(texts.join(' ')).split(' ')) if ([...word].length >= 3 && !STOP.has(word)) out.add(word)
  return [...out].slice(0, 40)
}

/** How many of the terms appear in the text as whole words. */
export function scoreOf(terms: string[], text: string): number {
  if (!terms.length || !text.trim()) return 0
  const words = new Set(normalise(text).split(' '))
  return terms.filter((t) => words.has(t)).length
}

export function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = String(seconds % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/** One excerpt's place, short: "slide 3", "p. 2", "47:05", or nothing. */
export function placeOf(e: Excerpt): string | null {
  if (e.kind === 'transcript' && e.atSeconds != null) return clock(e.atSeconds)
  if (e.kind === 'slide' && e.number != null) return `slide ${e.number}`
  return e.number != null ? `p. ${e.number}` : null
}

/** How the model is shown where this came from. */
export function headerOf(e: Excerpt): string {
  const where = e.kind === 'transcript' && e.atSeconds != null ? `at ${clock(e.atSeconds)}`
    : e.kind === 'slide' && e.number != null ? `slide ${e.number}`
      : e.number != null ? `page ${e.number}` : null
  return `[${e.id} · ${e.title}${where ? ` · ${where}` : ''}]`
}

const clip = (text: string): string => {
  const flat = text.replace(/\s+/gu, ' ').trim()
  return flat.length > EXCERPT_CHARS ? `${flat.slice(0, EXCERPT_CHARS - 1)}…` : flat
}

export function materialReader(store: Store, filesDir: string, fetcher: typeof fetch = publicFetch) {
  let next = 0
  const id = () => `E${++next}`

  /** Page by page or slide by slide, kept per file version: reading is the slow part, and a broken PDF isn't worth retrying. */
  async function sections(item: Row): Promise<{ n: number | null; text: string }[]> {
    const stored = item.meta?.path
    if (typeof stored !== 'string' || !stored) return []
    const key = `text:${item.id}:${item.meta.size ?? ''}`
    const cached = store.getMeta<{ n: number | null; text: string }[]>(key)
    if (cached) return cached
    let out: { n: number | null; text: string }[] = []
    try {
      if (Number(item.meta.size ?? 0) <= MAX_FILE_BYTES) {
        // Only the name: `meta` is client-writable, and this must never read outside the files folder.
        const extracted = await extractFile(join(filesDir, basename(stored)))
        out = extracted.sections.map((s) => ({
          n: s.page ?? (s.locator?.match(/(\d+)/) ? Number(s.locator.match(/(\d+)/)![1]) : null),
          text: s.text,
        })).filter((s) => s.text.trim())
      }
    } catch { /* an unreadable or unsupported file: nothing to cite */ }
    store.setMeta(key, out)
    return out
  }

  function isDeck(item: Row): boolean {
    const mime = String(item.meta?.mime ?? '').toLowerCase()
    return DECK_MIMES.includes(mime) || (mime === 'application/pdf' && /\b(slides?|lecture|deck|presentation)\b/iu.test(item.title))
  }

  function fromPreview(item: Row, kind: Excerpt['kind']): Excerpt[] {
    const text = clip(String(item.preview ?? ''))
    return text ? [{ id: id(), kind, itemId: item.id, title: item.title, text, topicId: item.topic_id }] : []
  }

  async function fromItem(item: Row): Promise<Excerpt[]> {
    if (item.kind === 'file') {
      const deck = isDeck(item)
      const out: Excerpt[] = []
      for (const s of await sections(item)) {
        const text = clip(s.text)
        if (text) out.push({ id: id(), kind: deck ? 'slide' : 'file', itemId: item.id, title: item.title, text, number: s.n, topicId: item.topic_id })
      }
      return out.length ? out : fromPreview(item, 'file')
    }
    if (item.kind === 'recording') {
      const out: Excerpt[] = []
      let window: { start: number; text: string } | null = null
      const close = () => { if (window) out.push({ id: id(), kind: 'transcript', itemId: item.id, title: item.title, text: clip(window.text), atSeconds: window.start, topicId: item.topic_id }) }
      for (const seg of Array.isArray(item.meta?.transcript) ? item.meta.transcript : []) {
        if (typeof seg?.text !== 'string') continue
        const start = Number(seg.start ?? seg.at ?? seg.at_seconds ?? 0)
        if (!window || start - window.start >= TRANSCRIPT_WINDOW_SECONDS) {
          close()
          window = { start, text: '' }
        }
        window.text += ` ${seg.text.trim()}`
      }
      close()
      return out.length ? out : fromPreview(item, 'transcript')
    }
    return item.kind === 'page' || item.kind === 'link' ? fromPreview(item, 'file') : []
  }

  async function excerpts(items: Row[], budget: number, perItem = 6000): Promise<Excerpt[]> {
    const out: Excerpt[] = []
    let left = budget
    for (const item of items) {
      if (left <= 0) break
      let taken = 0
      for (const e of await fromItem(item)) {
        if (taken + e.text.length > perItem || e.text.length > left) break
        out.push(e)
        taken += e.text.length
        left -= e.text.length
      }
    }
    return out
  }

  const links = new Map<string, { at: number; page: { title: string | null; text: string; calendar?: boolean } | null }>()

  /** A web page or calendar feed the learner attached, kept for a while: every later answer in the thread reads it again. */
  async function readLink(url: string): Promise<{ title: string | null; text: string; calendar?: boolean } | null> {
    const hit = links.get(url)
    if (hit && Date.now() - hit.at < LINK_TTL_MS) return hit.page
    const page = await fetchLink(url).catch(() => null)
    links.set(url, { at: Date.now(), page })
    return page
  }

  async function fetchLink(url: string): Promise<{ title: string | null; text: string; calendar?: boolean } | null> {
    const target = url.replace(/^webcal(s?):/i, 'https:')
    if (!/^https?:\/\//i.test(target)) return null
    const res = await fetcher(target, { signal: AbortSignal.timeout(15_000), headers: { Accept: 'text/html, text/calendar, text/plain;q=0.9' } })
    if (!res.ok || !res.body) return null
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (size < LINK_BYTES) {
      const { value, done } = await reader.read()
      if (done) break
      chunks.push(value)
      size += value.length
    }
    reader.cancel().catch(() => undefined)
    const body = Buffer.concat(chunks).toString('utf8')
    const type = res.headers.get('content-type') ?? ''
    if (/^webcal/i.test(url) || /\.ics(\?|$)/i.test(url) || type.includes('text/calendar') || body.startsWith('BEGIN:VCALENDAR')) {
      const calendar = calendarOf(body)
      return calendar ? { ...calendar, calendar: true } : null
    }
    if (type.includes('html') || /^\s*<(!doctype|html)/i.test(body)) {
      const title = body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || null
      const text = htmlToSections(body).map((s) => s.text).join('\n\n').slice(0, LINK_CHARS)
      return text.trim() ? { title, text } : null
    }
    return type.startsWith('text/') ? { title: null, text: body.slice(0, LINK_CHARS) } : null
  }

  function fromChunks(title: string, text: string, cite: Cite): Pair[] {
    return chunks(text).map((piece): Pair => [{ id: '', kind: 'file', itemId: '', title, text: piece }, cite])
  }

  /**
   * The chat's attachments, first thing the model is shown, because the learner put them there on purpose. Within the
   * budget every attachment keeps its first excerpt; the rest are those sharing the most words with the question.
   * One with nothing readable is named in `unread`, so the answer can say so instead of pretending.
   */
  async function attached(list: Record<string, any>[], terms: string[], status: (text: string) => void) {
    if (!list.length) return { excerpts: [] as Pair[], unread: [] as string[], itemIds: [] as string[] }
    const first = list[0]!
    status(list.length === 1 && ['file', 'note', 'link', 'calendar'].includes(first.kind)
      ? `Reading ${String(first.label ?? 'your attachment').slice(0, 60)}…`
      : 'Reading what you attached…')
    const bySource: Pair[][] = []
    const unread: string[] = []
    const itemIds: string[] = []
    let texts = 0
    for (const a of list) {
      const label = String(a.label ?? 'Attachment')
      let pairs: Pair[] = []
      if (a.kind === 'file' || a.kind === 'note') {
        const item = store.get('items', a.item_id)
        if (item) {
          itemIds.push(item.id)
          pairs = (await excerpts([item], PER_SOURCE, PER_SOURCE)).map((e): Pair => {
            const place = placeOf(e)
            return [e, { kind: 'item', id: item.id, label: `${e.title}${place ? ` · ${place}` : ''}`, at_seconds: e.atSeconds ?? null, subject_id: item.subject_id ?? null }]
          })
        }
      } else if (a.kind === 'link' || a.kind === 'calendar') {
        const page = a.url ? await readLink(a.url) : null
        if (page) {
          const title = page.title ?? shortUrl(a.url)
          pairs = fromChunks(title, page.text, { kind: 'attachment', id: a.url, label: title, at_seconds: null, subject_id: null, url: a.url })
        }
      } else if (a.kind === 'text') {
        pairs = fromChunks(label, String(a.text ?? ''), { kind: 'attachment', id: `text-${++texts}`, label, at_seconds: null, subject_id: null, url: null })
      }
      if (pairs.length) bySource.push(pairs)
      else unread.push(label)
    }
    return { excerpts: fit(bySource, terms), unread, itemIds }
  }

  /** All of an item's words, with each page or slide marked: what a course is drafted from. */
  async function itemText(item: Row): Promise<string> {
    if (item.kind === 'file') {
      const deck = isDeck(item)
      const text = (await sections(item)).map((s) => `${s.n !== null ? `[${deck ? 'slide ' : 'p. '}${s.n}]\n` : ''}${s.text}`).join('\n\n')
      return text.trim() ? text : String(item.preview ?? '').trim()
    }
    if (item.kind === 'recording' && Array.isArray(item.meta?.transcript)) {
      return item.meta.transcript.map((s: any) => (typeof s?.text === 'string' ? s.text : '')).join(' ').trim()
    }
    return String(item.preview ?? '').trim()
  }

  /** What a link was read as, without fetching it again. */
  const linkInfo = (url: string) => links.get(url)?.page ?? null

  return { excerpts, attached, readLink, itemText, linkInfo }
}

export function shortUrl(url: string): string {
  try {
    const u = new URL(url.replace(/^webcal(s?):/i, 'https:'))
    return `${u.host.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}`.slice(0, 120) || url
  } catch {
    return url
  }
}

/** Cut on paragraph (then word) boundaries into pieces of at most CHUNK characters, PER_SOURCE in all. */
function chunks(raw: string): string[] {
  const text = raw.replace(/\r\n/g, '\n').trim().slice(0, PER_SOURCE)
  const pieces: string[] = []
  let current = ''
  for (const line of text.split(/\n+/)) {
    let paragraph = line.trim()
    while (paragraph.length > CHUNK) {
      if (current) { pieces.push(current); current = '' }
      let cut = paragraph.slice(0, CHUNK)
      const space = cut.lastIndexOf(' ')
      if (space > CHUNK / 2) cut = cut.slice(0, space)
      pieces.push(cut.trim())
      paragraph = paragraph.slice(cut.length).trim()
    }
    if (!paragraph) continue
    if (current && current.length + paragraph.length + 1 > CHUNK) { pieces.push(current); current = '' }
    current = current ? `${current}\n${paragraph}` : paragraph
  }
  if (current.trim()) pieces.push(current.trim())
  return pieces.filter((p) => p.trim())
}

function fit(bySource: Pair[][], terms: string[]): Pair[] {
  const all = bySource.flatMap((pairs) => pairs.map((pair, i) => ({ pair, lead: i === 0, score: scoreOf(terms, pair[0].text) })))
    .map((r, order) => ({ ...r, order }))
  if (all.reduce((n, r) => n + r.pair[0].text.length, 0) <= ATTACHED_BUDGET) return all.map((r) => r.pair)
  const ranked = [...all].sort((a, b) => Number(b.lead) - Number(a.lead) || b.score - a.score || a.order - b.order)
  let left = ATTACHED_BUDGET
  const kept = ranked.filter((r) => {
    if (r.pair[0].text.length > left) return false
    left -= r.pair[0].text.length
    return true
  })
  return kept.sort((a, b) => a.order - b.order).map((r) => r.pair)
}

/**
 * A calendar feed as one line per event, soonest first, from a month back to a year ahead. A repeating event is one
 * line that says so, not forty.
 * shortcut: a TZID is read as the learner's own clock, close enough to say what is on when. Do it properly with ICS import.
 */
export function calendarOf(ics: string): { title: string; text: string } | null {
  const lines = ics.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n')
  const value = (line: string) => line.slice(line.indexOf(':') + 1).replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').replace(/\s+/g, ' ').trim()
  const now = Date.now()
  const from = now - 31 * 86_400_000
  const to = now + 366 * 86_400_000
  const events: { at: number; line: string }[] = []
  let title = 'Calendar'
  let event: Record<string, string> | null = null
  for (const line of lines) {
    if (line.startsWith('X-WR-CALNAME')) title = value(line).slice(0, 200) || title
    else if (line === 'BEGIN:VEVENT') event = {}
    else if (line === 'END:VEVENT' && event) {
      const m = event.DTSTART?.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/)
      if (m) {
        const at = m[7]
          ? Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!)
          : new Date(+m[1]!, +m[2]! - 1, +m[3]!, +(m[4] ?? 0), +(m[5] ?? 0)).getTime()
        const repeats = 'RRULE' in event
        if (repeats || (at >= from && at <= to)) {
          const day = m[7] ? dayKey(at) : `${m[1]}-${m[2]}-${m[3]}`
          const when = m[4] ? `${day} ${m[7] ? new Date(at).toISOString().slice(11, 16) : `${m[4]}:${m[5]}`}` : day
          const summary = value(`:${event.SUMMARY ?? ''}`).slice(0, 200) || 'Event'
          const where = value(`:${event.LOCATION ?? ''}`).slice(0, 120)
          events.push({ at, line: `${repeats ? `from ${when}, repeating` : when} · ${summary}${where ? ` · ${where}` : ''}` })
        }
      }
      event = null
    } else if (event) {
      const name = line.split(/[;:]/, 1)[0]!
      if (['DTSTART', 'SUMMARY', 'LOCATION', 'RRULE'].includes(name)) event[name] = line.slice(line.indexOf(':') + 1)
    }
  }
  const text = [...new Set(events.sort((a, b) => a.at - b.at).map((e) => e.line))].slice(0, CALENDAR_EVENTS).join('\n').slice(0, LINK_CHARS)
  return text ? { title, text } : null
}
