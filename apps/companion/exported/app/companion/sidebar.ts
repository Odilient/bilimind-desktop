/**
 * The app sidebar's state: how wide it is, and whether it is floating.
 *
 *   const s = useSidebar()
 *   s.toggle()          // the ⇤ button, the mark in the rail, `[`
 *   s.drawer.value      // the phone's left drawer
 *
 * It has three ways of being, and which one applies is decided by the screen,
 * never by a setting the learner has to find:
 *
 *  - Most screens: a column in the row, 260px with names or the 60px rail,
 *    as the learner last left it (`pinned`, remembered per device, expanded
 *    by default, because a first visit should read the places, not guess
 *    them from icons).
 *  - A workspace (a course, Notes) brings its own 272px left column, and two
 *    columns of names side by side leave the lesson a strip. So there the
 *    sidebar rests as the rail whatever `pinned` says, and expanding it
 *    floats the 260px panel over the content (`floating`) until the learner
 *    goes somewhere, clicks outside or presses Esc. Their standing choice
 *    is left alone.
 *  - A phone has no rail at all. The bar's menu button opens the same panel
 *    as a left drawer (`drawer`).
 *
 * Nothing here is rendered on a server (`/app` is `ssr: false`), so the
 * preference can live in localStorage and the first paint still has it.
 */
import { ref } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { CHAT_PATH } from './ai/routes'
import { useAiThread } from './ai/thread'

const KEY = 'bm:sidebar'

function readPinned(): boolean {
  if (!import.meta.client) return true
  try {
    return localStorage.getItem(KEY) !== '0'
  } catch {
    return true
  }
}

/** Expanded outside workspaces: the learner's standing choice. */
const pinned = ref(readPinned())
/** Expanded over a workspace, for this visit only. */
const floating = ref(false)
/** The phone's left drawer. */
const drawer = ref(false)

/**
 * Does this route bring its own left column? `definePageMeta({ workspace })`
 * may be a flag or a function of the route (one route can draw a course or
 * Notes); the layout and the sidebar read it the same way.
 */
export function isWorkspace(route: RouteLocationNormalizedLoaded): boolean {
  const flag = route.meta.workspace
  return typeof flag === 'function' ? Boolean((flag as (to: typeof route) => boolean)(route)) : flag === true
}

export function useSidebar() {
  return {
    pinned,
    floating,
    drawer,
    /** Collapse or expand: floats over a workspace, sets the choice elsewhere. */
    toggle(workspace: boolean) {
      if (workspace) {
        floating.value = !floating.value
        return
      }
      pinned.value = !pinned.value
      try {
        localStorage.setItem(KEY, pinned.value ? '1' : '0')
      } catch {
        // Private mode: remembered until the tab closes.
      }
    },
    /** Put away whatever floats: the overlay and the phone's drawer. */
    close() {
      floating.value = false
      drawer.value = false
    },
  }
}

/**
 * New chat, from anywhere: the sidebar's lime button, ⌥Space, the palette's
 * first row, the phone drawer. The thread is cleared first, so arriving on
 * `/app/chat` is always a blank page and never the chat that was open in
 * the dock a moment ago (that one is still in the list).
 */
export async function startNewChat(): Promise<void> {
  useAiThread().reset()
  await navigateTo(CHAT_PATH)
}
