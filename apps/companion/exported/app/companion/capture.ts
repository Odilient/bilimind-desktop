/**
 * Capture: one button, from anywhere: a recording, a photo of
 * the board, a file, a link. The sheet lives in the layout; any screen opens
 * it.
 *
 * Where a capture goes is the learner's call (28 Oct). It lands in My notes
 * unless the button that started it named a class or a course ("Record this
 * class" on Lecture 8's card, a course's own upload). When there was an
 * obvious course anyway (a class on now, the course on screen), it is kept
 * on the row as a suggestion and the note's header asks "Add to Databases?";
 * nothing is filed by the guess itself. `fileTarget` is that guess.
 *
 * The sheet's menu is Notes' "+" list (`CompanionNotesNewList`), the same
 * note types in the same words, for whatever still opens the sheet on its
 * menu (the desktop app's capture shortcut). The rail passes the button it
 * was pressed on (`showFrom`), so on a computer the menu opens as a popover
 * beside that button.
 */
import { ref } from 'vue'
import type { Item, Session, Signal, Subject } from './types'
import type { CompanionStore } from './store'
// imports
import { importPlaylist, previewInto } from './imports/links'

export type CaptureMode = 'menu' | 'record' | 'paste' | 'signal'

/** Where the button that opened the menu sits, in viewport pixels. */
export interface CaptureAnchor {
  left: number
  right: number
  top: number
  bottom: number
}

const open = ref(false)
const mode = ref<CaptureMode>('menu')
/** The course the button that opened it named (a course's own Record), if any. */
const context = ref<string | null>(null)
/** A class picked on purpose (Record on Today's card): filed under it. */
const pinned = ref<string | null>(null)
/** A signal to show on its own: what a share from another app turned into. */
const signal = ref<Signal | null>(null)
/** The rail's New, when that is what opened the menu. */
const anchor = ref<CaptureAnchor | null>(null)

export function useCapture() {
  return {
    open,
    mode,
    context,
    pinned,
    signal,
    anchor,
    /** The share sheet's answer: one fact, its before and after, Apply or Not this. */
    showSignal(next: Signal) {
      signal.value = next
      mode.value = 'signal'
      context.value = null
      pinned.value = null
      anchor.value = null
      open.value = true
    },
    show(next: CaptureMode = 'menu', subjectId: string | null = null, sessionId: string | null = null) {
      mode.value = next
      context.value = subjectId
      pinned.value = sessionId
      anchor.value = null
      open.value = true
    },
    /** The menu, as a popover beside the button that asked for it. */
    showFrom(el: HTMLElement) {
      const r = el.getBoundingClientRect()
      mode.value = 'menu'
      context.value = null
      pinned.value = null
      anchor.value = { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
      open.value = true
    },
    hide() {
      open.value = false
    },
  }
}

export interface FileTarget {
  subject: Subject | null
  session: Session | null
  /** "Databases · Lecture 8", or "My notes". */
  label: string
  /** "now", "in 12 min", "earlier today" — why this one was picked. */
  reason: string
  /**
   * Worked out, not pressed: the class on now, the course on screen. A guess
   * is only ever offered ("Add to Databases?"); `uploadCapture` files it in
   * My notes and keeps the guess as the suggestion.
   */
  guess?: boolean
}

const GRACE = 15 * 60_000

/** Where a capture goes when nothing named a place. */
export const MY_NOTES: FileTarget = { subject: null, session: null, label: 'My notes', reason: 'not in a course' }

/**
 * Where a capture made right now most likely belongs: a guess. In order: a
 * class picked on purpose (Record pressed on that class's card, which is not
 * a guess); the class in progress (or just finished — people photograph the
 * board on the way out); the one about to start; the course on screen, under
 * its latest class; otherwise My notes. Used to suggest, and by a course's
 * page to pick which of its classes a note it makes is under.
 */
export function fileTarget(
  store: CompanionStore,
  subjectId: string | null = null,
  now = Date.now(),
  sessionId: string | null = null,
): FileTarget {
  const sessions = store.sessions.value.filter((s) => !s.cancelled)
  const chosen = store.get('sessions', sessionId)
  const running = sessions.find((s) => Date.parse(s.starts_at) <= now && Date.parse(s.ends_at) + GRACE > now)
  const soon = sessions.find((s) => Date.parse(s.starts_at) > now && Date.parse(s.starts_at) - now < GRACE)
  const pick = (session: Session, reason: string, guess = true): FileTarget => {
    const subject = store.get('subjects', session.subject_id)
    return { subject, session, label: `${subject?.title ?? 'Course'} · ${session.title}`, reason, guess }
  }
  if (chosen) return pick(chosen, Date.parse(chosen.starts_at) > now ? 'the class you picked' : 'in class now', false)
  if (running) return pick(running, Date.parse(running.ends_at) > now ? 'in class now' : 'just finished')
  if (soon) return pick(soon, 'about to start')
  if (subjectId) {
    const subject = store.get('subjects', subjectId)
    const last = [...sessions].reverse().find((s) => s.subject_id === subjectId && Date.parse(s.starts_at) <= now)
    if (last && subject) return pick(last, 'the course you have open')
    if (subject) return { subject, session: null, label: subject.title, reason: 'the course you have open', guess: true }
  }
  return MY_NOTES
}

/**
 * The place a button named: that class (and its course), else that course,
 * else My notes. Never a guess.
 */
export function namedTarget(store: CompanionStore, subjectId: string | null, sessionId: string | null = null): FileTarget {
  const session = store.get('sessions', sessionId)
  if (session) {
    const subject = store.get('subjects', session.subject_id)
    return { subject, session, label: `${subject?.title ?? 'Course'} · ${session.title}`, reason: 'the class you picked' }
  }
  const subject = store.get('subjects', subjectId)
  return subject ? { subject, session: null, label: subject.title, reason: 'the course you picked' } : MY_NOTES
}

/** The row `meta` that remembers a guess on a note filed in My notes. */
export function suggestionMeta(guess: FileTarget | null): Partial<Item['meta']> {
  if (!guess?.subject) return {}
  return { suggested_subject_id: guess.subject.id, suggested_session_id: guess.session?.id ?? null }
}

export interface CaptureOptions {
  /** The course on screen, for the suggestion only. */
  onScreen?: string | null
  /** No toast: the caller opens what was made, which says enough. */
  quiet?: boolean
}

/**
 * Splits a target into where it is filed and what it suggests: a place a
 * button named is filed; a guess files in My notes and is kept as the
 * suggestion; nothing named suggests from the class on now or the screen.
 */
function settle(store: CompanionStore, target: FileTarget | null | undefined, onScreen: string | null) {
  if (target?.subject && !target.guess) return { filed: target, guess: null }
  return { filed: MY_NOTES, guess: target?.guess ? target : fileTarget(store, onScreen) }
}

/** The guess, written onto a row that landed in My notes. */
async function remember(store: CompanionStore, item: Item, guess: FileTarget | null): Promise<Item> {
  const extra = suggestionMeta(guess)
  if (item.subject_id || !extra.suggested_subject_id) return item
  return store.upsert<Item>('items', { id: item.id, meta: { ...item.meta, ...extra } }).catch(() => item)
}

/**
 * Photos or files, uploaded and filed where the button said (My notes when
 * it said nothing), with one toast that names the place. Notes' "+", the
 * capture sheet and the palette's "Upload a file" share it, so all of them
 * file the same thing in the same place.
 */
export async function uploadMany(
  store: CompanionStore,
  files: File[],
  target: FileTarget | null = null,
  opts: CaptureOptions = {},
): Promise<Item[]> {
  const toast = useToast()
  const { filed, guess } = settle(store, target, opts.onScreen ?? null)
  const made: Item[] = []
  for (const file of files) {
    try {
      const item = await store.repo().upload(file, {
        subject_id: filed.subject?.id,
        session_id: filed.session?.id,
      })
      store.rows.items[item.id] = item
      made.push(await remember(store, item, guess))
    } catch {
      toast.error(`${file.name} didn't upload. Check the connection and try again.`)
    }
  }
  if (made.length && !opts.quiet) {
    toast.success({
      title: `Saved to ${filed.label}`,
      body: made.length === 1 ? made[0]!.title : `${made.length} files`,
    })
  }
  return made
}

/** One photo or file: `uploadMany` for one, what was made or null. */
export async function uploadCapture(
  store: CompanionStore,
  file: File,
  target: FileTarget | null = null,
  opts: CaptureOptions = {},
): Promise<Item | null> {
  const [item] = await uploadMany(store, [file], target, opts)
  return item ?? null
}

/** "youtube.com", the name a link has before anyone renames it. */
export function linkTitle(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean).at(-1)
    const host = u.hostname.replace(/^www\./, '')
    return path && path.length < 60 ? `${host} · ${decodeURIComponent(path).replace(/[-_]+/g, ' ')}` : host
  } catch {
    return url
  }
}

/** What was typed, as a link a browser can open ("bbc.co.uk/news" gains its https://). */
export function normaliseUrl(text: string): string | null {
  const raw = text.trim()
  if (!raw || /\s/.test(raw)) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const u = new URL(withScheme)
    if (!['http:', 'https:'].includes(u.protocol) || !u.hostname.includes('.')) return null
    return u.toString()
  } catch {
    return null
  }
}

/** A link, saved as a note: the address, a name from it, filed like any capture. */
export async function addLink(
  store: CompanionStore,
  url: string,
  target: FileTarget | null = null,
  // imports: a link ON something: a deadline (`meta.deadline_id`), a
  // lesson (`topic_id`) or a page (`parent_id`). The target names its course.
  opts: CaptureOptions & { title?: string | null; deadlineId?: string | null; topicId?: string | null; parentId?: string | null } = {},
): Promise<Item> {
  const { filed, guess } = settle(store, target, opts.onScreen ?? null)
  const subjectId = filed.subject?.id ?? null
  const position = store.items.value.filter((i) => !i.deleted_at && i.subject_id === subjectId && !i.parent_id).length
  const on = Boolean(opts.deadlineId || opts.topicId || opts.parentId)
  // imports: a YouTube playlist arrives as its videos, under a page named
  // after it; one put on something stays a single link there, which still plays.
  const item = (on ? null : await importPlaylist(store, url, subjectId)) ?? await store.upsert<Item>('items', {
    id: crypto.randomUUID(),
    subject_id: subjectId,
    session_id: filed.session?.id ?? null,
    topic_id: opts.topicId ?? filed.session?.topic_id ?? null,
    parent_id: opts.parentId ?? null,
    kind: 'link',
    title: opts.title?.trim() || linkTitle(url),
    preview: url,
    meta: { url, ...(opts.deadlineId ? { deadline_id: opts.deadlineId } : {}), ...(subjectId || on ? {} : suggestionMeta(guess)) },
    source: 'made',
    source_ref: null,
    position,
    pinned: false,
  })
  // imports: its title, picture and player, read once (quiet when it can't be).
  void previewInto(store, item)
  if (!opts.quiet) useToast().success({ title: `Saved to ${filed.label}`, body: item.title })
  return item
}
