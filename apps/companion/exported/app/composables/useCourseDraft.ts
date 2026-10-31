import type {
  ClarifyDraftAnswer,
  Course,
  CourseDraft,
  CourseDraftPayload,
  CourseDraftStep,
} from '~/types/api'

/**
 * The create flow, made durable.
 *
 * `/create` used to hold everything the learner did in component state and
 * nowhere else — the topic they typed, the chips they tapped on the clarifying
 * questions — while carrying no identity in its URL. A reload threw all of it
 * away and left no way back to the course row that had, in fact, already been
 * created. This composable is the other half of that fix: the URL carries a
 * uuid from the first keystroke, and everything under it is saved against that
 * uuid as it changes.
 *
 * Two rules make the autosave safe to leave running:
 *
 *   - It is debounced, and a save in flight never queues a second one; the last
 *     state always wins because the whole form goes up every time.
 *   - It never surfaces an error. A failed autosave is a thing the learner can
 *     do nothing about, and a toast about it in the middle of typing is worse
 *     than the risk it warns of. `saving` and `savedAt` are exposed instead, so
 *     the page can say "Saved" quietly and say nothing when it can't.
 */

/** Debounce for autosave. Long enough not to fire on every keystroke. */
const SAVE_AFTER_MS = 700

export interface CourseDraftState extends CourseDraftPayload {
  topic: string
  goal: string
  language: string
  level: NonNullable<CourseDraftPayload['level']>
  minutes_per_week: number
  material_ids: number[]
  skip_clarify: boolean
  clarify: Record<string, ClarifyDraftAnswer>
}

function blankState(): CourseDraftState {
  return {
    topic: '',
    goal: '',
    language: 'en',
    level: 'any',
    minutes_per_week: 0,
    material_ids: [],
    skip_clarify: false,
    clarify: {},
  }
}

/** Server payloads are half-typed by nature; fill every hole before use. */
function hydrate(payload: CourseDraftPayload | null | undefined): CourseDraftState {
  const base = blankState()
  if (!payload) return base

  const clarify: Record<string, ClarifyDraftAnswer> = {}
  for (const [id, answer] of Object.entries(payload.clarify ?? {})) {
    clarify[id] = {
      chips: Array.isArray(answer?.chips) ? answer.chips.filter((c) => typeof c === 'string') : [],
      text: typeof answer?.text === 'string' ? answer.text : '',
    }
  }

  return {
    topic: payload.topic ?? base.topic,
    goal: payload.goal ?? base.goal,
    language: payload.language ?? base.language,
    level: payload.level ?? base.level,
    minutes_per_week: payload.minutes_per_week ?? base.minutes_per_week,
    material_ids: Array.isArray(payload.material_ids) ? payload.material_ids : [],
    skip_clarify: payload.skip_clarify ?? base.skip_clarify,
    clarify,
  }
}

export function useCourseDraft(uuid: string) {
  const api = useApi()

  const state = reactive<CourseDraftState>(blankState())
  const step = ref<CourseDraftStep>('compose')

  /** The course this draft produced, once it has produced one. */
  const course = ref<Course | null>(null)

  const loading = ref(true)
  const saving = ref(false)
  const savedAt = ref<Date | null>(null)

  /** Nothing is saved until the learner has actually said something. */
  const dirty = ref(false)

  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight: Promise<void> | null = null
  let discarded = false

  /**
   * Set while `load()` writes the server's own answer back into `state`. The
   * autosave watcher cannot tell that apart from the learner typing, and
   * without this every visit to a draft would immediately PUT it back
   * unchanged — one pointless write per page load, and an `updated_at` that
   * keeps bumping so an abandoned draft never ages out.
   */
  let hydrating = false

  function body() {
    return {
      step: step.value,
      topic: state.topic,
      goal: state.goal,
      language: state.language,
      level: state.level,
      minutes_per_week: state.minutes_per_week,
      material_ids: [...state.material_ids],
      skip_clarify: state.skip_clarify,
      clarify: state.clarify,
      ...(course.value?.id ? { course_id: course.value.id } : {}),
    }
  }

  /**
   * Push the current state. Coalescing rather than queueing: a save that starts
   * while another is in flight waits for it and then sends the state as it is
   * *then*, which is the state the learner would want kept anyway.
   */
  async function flush(): Promise<void> {
    if (discarded || !dirty.value) return

    if (inFlight) {
      await inFlight.catch(() => {})
    }

    saving.value = true
    inFlight = api
      .put<CourseDraft>(`/course-drafts/${uuid}`, body())
      .then(() => {
        savedAt.value = new Date()
      })
      .catch(() => {
        // Deliberately silent — see the note at the top of this file.
      })
      .finally(() => {
        saving.value = false
        inFlight = null
      })

    await inFlight
  }

  function schedule(): void {
    if (discarded || hydrating) return
    dirty.value = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void flush(), SAVE_AFTER_MS)
  }

  /**
   * Read whatever is saved under this uuid. A 404 is the normal answer for a
   * uuid the learner has only just arrived at, and means "nothing yet" rather
   * than an error worth showing.
   */
  async function load(): Promise<CourseDraft | null> {
    loading.value = true
    hydrating = true

    let saved: CourseDraft | null = null

    try {
      const draft = await api.get<CourseDraft>(`/course-drafts/${uuid}`)
      Object.assign(state, hydrate(draft.payload))
      step.value = draft.step
      course.value = draft.course
      savedAt.value = draft.updated_at ? new Date(draft.updated_at) : null
      saved = draft
    } catch {
      /* nothing saved under this uuid yet — the caller composes from scratch */
    }

    loading.value = false

    // Let the watcher run once against the values just written before listening
    // for real edits again, and only then hand control back: whatever the
    // caller does next must count as a change.
    await nextTick()
    hydrating = false

    return saved
  }

  /**
   * The flow is over — the learner is on their way to the workspace, or has
   * thrown the draft away. Either way the row goes and autosave stops, so a
   * pending timer cannot resurrect it a moment later.
   */
  async function discard(): Promise<void> {
    discarded = true
    if (timer) clearTimeout(timer)
    timer = null
    if (inFlight) await inFlight.catch(() => {})

    try {
      await api.del(`/course-drafts/${uuid}`)
    } catch {
      // The nightly prune collects it if this never lands.
    }
  }

  /** Record the course this draft produced, and save that immediately. */
  function attach(created: Course, next: CourseDraftStep): void {
    course.value = created
    step.value = next
    dirty.value = true
    void flush()
  }

  // Autosave. `step` is in here too: which screen the learner is on is part of
  // what has to come back, not just what they typed into it.
  watch(() => [{ ...state }, step.value], schedule, { deep: true })

  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer)
    // A last save on the way out, for the learner who navigates away mid-typing
    // rather than reloading. Fire-and-forget by necessity.
    void flush()
  })

  return { state, step, course, loading, saving, savedAt, load, flush, discard, attach }
}

/** A fresh draft address. `crypto.randomUUID` is available on both sides of SSR. */
export function newDraftUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  // Only reachable on an ancient browser over plain http, where `crypto` is not
  // exposed. Not cryptographically anything — but neither is the address bar.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

/** Whether a route param is shaped like something we minted. */
export function isDraftUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
}
