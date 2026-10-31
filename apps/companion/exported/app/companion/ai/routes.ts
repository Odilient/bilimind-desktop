/**
 * Where the chat lives, said once. Every "New chat", "New course", "Ask
 * BiliMind: …" and "Open full screen" in the app builds its link here, so
 * the chat's address can change in one place.
 *
 *   /app/chat              a new chat (the sidebar's New chat, ⌥Space)
 *   /app/chat/<id>         a chat, reloadable and bookmarkable
 *
 * A new chat reads these from its address once, then drops them:
 *
 *   q        ask this straight away
 *   prompt   put this in the box, unsent (the landing's `?goal=`, a starter)
 *   intent   `course`: the course-making start (Courses' New course)
 *   attach   item ids to attach, comma-separated ("Ask about this note")
 *   connect  open a "Connect your school" modal: moodle, ics, email, photo
 */
import type { ConnectKind } from '../create'

export const CHAT_PATH = '/app/chat'

export function chatPath(threadId?: string | null): string {
  return threadId ? `${CHAT_PATH}/${threadId}` : CHAT_PATH
}

export interface NewChatOptions {
  q?: string | null
  prompt?: string | null
  intent?: 'course' | null
  attach?: string[] | null
  connect?: ConnectKind | null
}

export function newChatLink(options: NewChatOptions = {}): { path: string; query: Record<string, string> } {
  const query: Record<string, string> = {}
  if (options.q) query.q = options.q
  if (options.prompt) query.prompt = options.prompt
  if (options.intent) query.intent = options.intent
  if (options.attach?.length) query.attach = options.attach.join(',')
  if (options.connect) query.connect = options.connect
  return { path: CHAT_PATH, query }
}

/** Is this route the chat page itself (where the assistant panel steps aside)? */
export function onChatPage(path: string): boolean {
  return path === CHAT_PATH || path.startsWith(`${CHAT_PATH}/`)
}

let lastAsked = { path: '', at: 0 }

/**
 * May this address's `?q=` be asked now? Once per address: leaving a
 * workspace (a course, Notes) for the chat mounts the chat page twice in one
 * navigation, as the layout swaps the box it draws the page in, and each
 * mount reads the address before the first one has had time to clear it.
 * Kept here, outside the page, because the second mount is a new instance
 * that remembers nothing of the first.
 */
export function firstAsk(fullPath: string, now = Date.now()): boolean {
  if (lastAsked.path === fullPath && now - lastAsked.at < 5000) return false
  lastAsked = { path: fullPath, at: now }
  return true
}
