/**
 * Focus: a Pomodoro kept beside the work, never a page of its own.
 *
 * It starts from the thing being done (a row of the plan, Today's card,
 * ⌘K), runs 25 minutes, then a 5-minute break, 15 after every fourth
 * block, and shows as a pill at the top of every screen the way a
 * recording does (`FocusPill`). A tap on the pill goes back to the work;
 * the plan row it belongs to counts down in place of its minutes.
 *
 *   const focus = useFocus()
 *   focus.start({ label: 'Read chapter 3', taskId: t.id, to: '/app/courses/…' })
 *   focus.left.value   // ms left in this phase
 *
 * Kept per device in localStorage (`bm:focus`) as the moment the phase
 * ends, not a count of seconds, so a reload, a closed lid or a second tab
 * all read the same clock.
 */
import { computed, readonly, ref } from 'vue'

export const FOCUS_MIN = 25
const BREAK_MIN = 5
const LONG_BREAK_MIN = 15
const MINUTE = 60_000

export interface FocusState {
  phase: 'focus' | 'break'
  /** When this phase ends; null while paused. */
  ends_at: number | null
  /** While paused, what was left of the phase, in ms. */
  paused_left: number
  /** What is being worked on: a plan task's title, or '' from ⌘K. */
  label: string
  task_id: string | null
  /** Where the work is, so the pill can take you back to it. */
  to: string | null
  /** Focus blocks finished in this run; every fourth earns the long break. */
  rounds: number
}

const KEY = 'bm:focus'

function read(): FocusState | null {
  if (!import.meta.client) return null
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as FocusState) : null
  } catch {
    return null
  }
}

const state = ref<FocusState | null>(read())
const now = ref(Date.now())
let ticking: ReturnType<typeof setInterval> | undefined
let listening = false

/** The clock only ticks while a phase is running. */
function tick(): void {
  if (!import.meta.client) return
  now.value = Date.now()
  const running = Boolean(state.value?.ends_at)
  if (running && !ticking) ticking = setInterval(() => (now.value = Date.now()), 1000)
  if (!running && ticking) {
    clearInterval(ticking)
    ticking = undefined
  }
}

function save(next: FocusState | null): void {
  state.value = next
  tick()
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next))
    else localStorage.removeItem(KEY)
  } catch {
    // Private mode: it holds for this tab only.
  }
}

function listen(): void {
  if (listening || !import.meta.client) return
  listening = true
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY) return
    state.value = read()
    tick()
  })
  tick()
}

const left = computed(() => {
  const s = state.value
  if (!s) return 0
  return s.ends_at ? Math.max(0, s.ends_at - now.value) : s.paused_left
})

function start(
  work: { label?: string; taskId?: string | null; to?: string | null },
  rounds = state.value?.rounds ?? 0,
): void {
  save({
    phase: 'focus',
    ends_at: Date.now() + FOCUS_MIN * MINUTE,
    paused_left: 0,
    label: work.label ?? '',
    task_id: work.taskId ?? null,
    to: work.to ?? null,
    rounds,
  })
}

function pause(): void {
  const s = state.value
  if (s?.ends_at) save({ ...s, ends_at: null, paused_left: Math.max(0, s.ends_at - Date.now()) })
}

function resume(): void {
  const s = state.value
  if (s && !s.ends_at) save({ ...s, ends_at: Date.now() + s.paused_left })
}

function stop(): void {
  save(null)
}

/**
 * A phase that has run out moves on: a focus block becomes its break, a
 * break ends the run. Returns the phase that ended, or null if none had.
 * The break counts from when the block ended, not from now, so every open
 * tab writes the same next state and a lid closed through both just ends.
 */
function advance(): FocusState | null {
  const s = state.value
  if (!s?.ends_at || s.ends_at > Date.now()) return null
  if (s.phase === 'focus') {
    const rounds = s.rounds + 1
    const minutes = rounds % 4 === 0 ? LONG_BREAK_MIN : BREAK_MIN
    save({ ...s, phase: 'break', ends_at: s.ends_at + minutes * MINUTE, rounds })
  } else {
    save(null)
  }
  return s
}

export function useFocus() {
  listen()
  return { state: readonly(state), left, start, pause, resume, stop, advance }
}
