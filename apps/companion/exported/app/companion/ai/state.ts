/**
 * The AI companion's one shared state: is the panel open, what is on screen,
 * and what the learner just asked for from somewhere else (the palette, a
 * lesson's "Ask about this", Today's "Plan my week").
 *
 *   // A screen says what it shows; the panel, its suggestions and the
 *   // answer's grounding follow it. Unmounting puts the previous one back.
 *   useAiContext(() => ({ kind: 'lesson', label: node.title, subjectId, nodeId }))
 *
 *   // Anywhere: open the companion, optionally with a passage or a question.
 *   const ai = useAi()
 *   ai.show({ quote: selectedText })
 *   ai.ask('Quiz me on chapter 4')
 *
 * Where it opens depends on the room there is, never on the screen:
 *
 *   ≥1280px     docked, a 360px column at the right of every screen. A
 *               workspace (a course, Notes) mounts `CompanionAiPanel` in its
 *               own row; every other screen gets the one the layout mounts.
 *               It pushes the content over and never covers it.
 *   1024–1279   a drawer over the right edge (`CompanionAiHost`), because a
 *               360px column beside a 272px outline leaves the lesson too
 *               narrow to read.
 *   <1024       a full-height sheet.
 *
 * The chat page (`/app/chat*`) IS the companion, so there it steps aside
 * entirely: no dock, no drawer, no floating button (`onChatPage`).
 *
 * Whether the dock is open is remembered per device. A first visit on a
 * screen wide enough to dock opens it, because the learner should meet the
 * companion before they have to go looking for it. The drawer and the sheet
 * cover the page, so they are never remembered: each opens when asked.
 */
import { computed, onBeforeUnmount, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import type { AiContext } from './types'

const OPEN_KEY = 'bm:ai-open'

const EVERYTHING: AiContext = { kind: 'everything', label: 'All your courses' }

/** Wide enough for a drawer rather than a sheet: the shell's `lg`. */
const WIDE = '(min-width: 1024px)'
/** Wide enough to dock beside the content: the shell's `xl`. */
const ROOMY = '(min-width: 1280px)'

function matches(query: string): boolean {
  return import.meta.client ? window.matchMedia(query).matches : false
}

function readOpen(): boolean {
  if (!import.meta.client) return false
  try {
    const stored = localStorage.getItem(OPEN_KEY)
    if (stored === '1' || stored === '0') return stored === '1'
  } catch {
    // Private mode: fall through to the first-visit default.
  }
  return matches(ROOMY)
}

/** The docked panel's visibility, remembered per device. */
const open = ref(readOpen())
/** ≥1024px: the companion is a drawer here rather than a sheet. */
const wide = ref(true)
/** ≥1280px: a dock fits beside the content. */
const roomy = ref(true)
let watchingWidth = false
function watchWidth(): void {
  if (watchingWidth || !import.meta.client) return
  watchingWidth = true
  const wideQuery = window.matchMedia(WIDE)
  const roomyQuery = window.matchMedia(ROOMY)
  wide.value = wideQuery.matches
  roomy.value = roomyQuery.matches
  wideQuery.addEventListener('change', (event) => {
    wide.value = event.matches
    // A drawer doesn't turn into a sheet under the learner's hands.
    if (!event.matches) overlay.value = false
  })
  roomyQuery.addEventListener('change', (event) => {
    roomy.value = event.matches
    // Narrowed past the dock with it open: it becomes the drawer, so the
    // answer being read doesn't vanish. Widened with the drawer open: it docks.
    if (!event.matches && open.value && docks.value > 0) overlay.value = true
    if (event.matches && overlay.value && docks.value > 0) {
      overlay.value = false
      open.value = true
      persist(true)
    }
  })
}
/** The drawer/sheet, for screens or widths without a dock. Never remembered. */
const overlay = ref(false)
/** How many docked panels are mounted (0 or 1 in practice). */
const docks = ref(0)
/** Registered contexts, innermost last. */
const stack = ref<{ token: number; get: () => AiContext | null }[]>([])
let nextToken = 0

/** A question or passage handed over by another screen, taken by the thread once. */
export interface AiRequest {
  prompt?: string
  quote?: string | null
  /** Send `prompt` straight away instead of leaving it in the box. */
  send?: boolean
  /** Start a new thread first. */
  fresh?: boolean
}
const request = ref<AiRequest | null>(null)

function persist(value: boolean): void {
  try {
    localStorage.setItem(OPEN_KEY, value ? '1' : '0')
  } catch {
    // Private mode: the panel just forgets, which is harmless.
  }
}

/** The newest registration that says something; `null` passes to the one below. */
const context = computed<AiContext>(() => {
  for (let i = stack.value.length - 1; i >= 0; i--) {
    const value = stack.value[i]!.get()
    if (value) return value
  }
  return EVERYTHING
})

/** A docked panel is mounted and the window is wide enough to draw it. */
const hasDock = computed(() => docks.value > 0 && roomy.value)

/** The dock is on screen: the one condition `CompanionAiPanel` draws on. */
const docked = computed(() => hasDock.value && open.value)

/** Is the companion visible right now, docked or as the drawer/sheet? */
const visible = computed(() => (hasDock.value ? open.value : overlay.value))

function reveal(): void {
  if (hasDock.value) {
    open.value = true
    persist(true)
  } else {
    overlay.value = true
  }
}

function hide(): void {
  if (hasDock.value) {
    open.value = false
    persist(false)
  }
  overlay.value = false
}

export function useAi() {
  watchWidth()
  return {
    open,
    overlay,
    visible,
    hasDock,
    docked,
    wide,
    roomy,
    context,
    request,
    /** Open the companion, with a passage attached or a question in the box. */
    show(next: AiRequest = {}) {
      if (next.prompt || next.quote || next.fresh) request.value = { ...next }
      reveal()
    },
    /** Open the companion and send a question. */
    ask(prompt: string, extra: Omit<AiRequest, 'prompt' | 'send'> = {}) {
      request.value = { ...extra, prompt, send: true }
      reveal()
    },
    hide,
    toggle() {
      if (visible.value) hide()
      else reveal()
    },
    /** The thread calls this once it has taken the request. */
    take(): AiRequest | null {
      const value = request.value
      request.value = null
      return value
    },
  }
}

/**
 * Register what this screen shows for as long as the calling component is
 * mounted. The newest registration wins; unmounting restores the one below.
 * Return `null` to step aside: a tab that stays mounted while hidden says
 * `() => (active ? context : null)`, so only the tab in front is heard.
 */
export function useAiContext(source: MaybeRefOrGetter<AiContext | null>): void {
  const token = ++nextToken
  const get = (): AiContext | null => toValue(source)
  stack.value = [...stack.value, { token, get }]
  // A getter over reactive state is read through `context`; nothing to watch.
  // A plain ref still needs the stack to notice its swaps.
  watch(
    () => toValue(source),
    () => {
      stack.value = [...stack.value]
    },
  )
  onBeforeUnmount(() => {
    stack.value = stack.value.filter((entry) => entry.token !== token)
  })
}

/** For the docked panel only: count it while it is mounted. */
export function useAiDock(): void {
  watchWidth()
  docks.value += 1
  // A dock appearing takes over from a drawer that was open on the last screen.
  if (overlay.value && roomy.value) {
    overlay.value = false
    open.value = true
  }
  onBeforeUnmount(() => {
    docks.value = Math.max(0, docks.value - 1)
  })
}
