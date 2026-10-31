/**
 * Which action cards have already been pressed, kept on this device so a
 * card stays "Saved to Databases · Open" after a reload or when the chat is
 * opened again from history. Without it the card went back to its button,
 * and one more press saved the same note twice.
 *
 *   madeFor(`${messageId}:${index}`)        // → ActionDone | null
 *   rememberMade(`${messageId}:${index}`, done)
 *
 * Keyed by the answer's server id (the thread swaps it in when the answer
 * lands) and the card's place in it. The newest 300 are kept; anything older
 * is a chat nobody is scrolling back through. Per device, like the dock's
 * open state: on another device the card offers its button again, and the
 * thing it made is there in the course either way.
 */
import { ref } from 'vue'
import type { ActionDone } from './actions'

const KEY = 'bm:ai-made'
const LIMIT = 300

function read(): Record<string, ActionDone> {
  if (!import.meta.client) return {}
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as Record<string, ActionDone>) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const made = ref<Record<string, ActionDone>>(read())

export function madeFor(key: string | null | undefined): ActionDone | null {
  return key ? made.value[key] ?? null : null
}

export function rememberMade(key: string | null | undefined, done: ActionDone): void {
  if (!key) return
  const entries = Object.entries({ ...made.value, [key]: { to: done.to, label: done.label } })
  // Insertion order is age: the oldest go first.
  made.value = Object.fromEntries(entries.slice(-LIMIT))
  try {
    localStorage.setItem(KEY, JSON.stringify(made.value))
  } catch {
    // Private mode: it holds until the tab closes.
  }
}
