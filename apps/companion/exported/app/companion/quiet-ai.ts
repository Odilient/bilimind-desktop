/**
 * Quiet AI: one switch that takes every AI button off the screen.
 *
 * Students turn against a notes app the day it pushes AI into their notes (126 of
 * Notion's last 500 reviews; the design notes
 * §7). BiliMind's AI only ever appears on request; Quiet AI is for the ones
 * who don't want to be asked either. When it is on, pages and boards hide
 * their AI actions, and Ask leaves the navigation.
 *
 *   const { quiet } = useQuietAi()
 *   <button v-if="!quiet" …>Map lectures 6–7</button>
 *
 * Off by default: AI on request is already quiet. Kept per device in
 * localStorage (`bm:quiet-ai`), and in step across open tabs.
 */
import { readonly, ref, type Ref } from 'vue'

const KEY = 'bm:quiet-ai'

function read(): boolean {
  if (!import.meta.client) return false
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

const quiet = ref(read())
let listening = false

function listen(): void {
  if (listening || !import.meta.client) return
  listening = true
  window.addEventListener('storage', (event) => {
    if (event.key === KEY) quiet.value = event.newValue === '1'
  })
}

function set(value: boolean): void {
  quiet.value = value
  try {
    if (value) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    // Private mode: it holds for this tab only.
  }
}

export function useQuietAi(): { quiet: Readonly<Ref<boolean>>; set: (value: boolean) => void; toggle: () => void } {
  listen()
  return { quiet: readonly(quiet), set, toggle: () => set(!quiet.value) }
}
