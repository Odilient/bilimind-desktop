import type {
  Assessment,
  Attachment,
  Attempt,
  Block,
  BlockType,
  ConceptArchetype,
  CourseStatus,
  LessonTrack,
  NodeStatus,
  ProgressState,
} from '~/types/api'
import type { GradedPayload } from '~/components/assessments/AssessmentItem.vue'

/**
 * Everything one open node needs: its content, this learner's attempts, time on
 * task, mark-complete, regeneration and expansion.
 *
 * Lives in a composable rather than the page because the workspace opens
 * several nodes at once — each tab gets its own instance, and closing a tab has
 * to bank the learner's time rather than lose it.
 */

interface NodeProgressPayload {
  state: ProgressState
  time_spent_seconds: number
  completed_at: string | null
  last_seen_at: string | null
}

export interface NodeBrief {
  id: number
  key: string
  title: string
  status: NodeStatus
  layer?: number
  /**
   * Which line the neighbour sits on. `NodeSummaryResource::brief()` has always
   * sent it — it is what lets a lesson say "then X" about the next step and
   * never about a detour — but it was missing here, so every read of it was an
   * implicit `any`.
   */
  track?: LessonTrack
}

/** What has been written so far (Services\\Course\\LessonDraft), while it is written. */
export interface LessonDraftState {
  note: string
  thinking?: string
  thinking_length?: number
  /** A null payload is a part with answers in it: named, not shown, until it is saved. */
  blocks?: { type: string; payload: unknown }[]
  writing?: { type: string; text: string } | null
}

/** The wire shape of `GET /api/nodes/{node}` (NodeSummaryResource). */
export interface PlayerNode {
  draft?: LessonDraftState | null
  id: number
  course_id: number
  key: string
  title: string
  summary: string | null
  concept_key: string | null
  /** EXPAND §1 — null on nodes generated before archetypes existed. */
  archetype?: ConceptArchetype | null
  archetype_label?: string | null
  layer: number
  position: number
  /** Where this lesson sits relative to the course's one main line. */
  track?: LessonTrack
  track_label?: string
  estimated_minutes: number
  status: NodeStatus
  status_label?: string
  is_expanded?: boolean
  planned_block_types?: BlockType[]
  failure_reason: string | null
  /** Seconds it has been writing, counted by the server. See `Node` in types/api. */
  writing_for?: number | null
  /** EDIT — see `Node` in types/api. */
  current_revision_id?: number | null
  edited_at?: string | null
  progress?: NodeProgressPayload
  blocks?: Block[]
  /** Files the owner added to this lesson as extra context. Not content. */
  attachments?: Attachment[]
  assessments?: Assessment[]
  prerequisites?: NodeBrief[]
  next_nodes?: NodeBrief[]
  course?: { id: number; title: string; language: string; status: CourseStatus }
}

export const REGENERATE_PRESETS = [
  { label: 'more practical', instruction: 'Make it more practical — more worked examples, fewer definitions.' },
  { label: 'shorter', instruction: 'Shorter. Cut anything that is not load-bearing.' },
  { label: 'go deeper', instruction: 'Go deeper. Assume I already know the basics.' },
  { label: 'harder practice', instruction: 'Add a harder assessment that makes me apply this, not recall it.' },
]

/** How often accumulated seconds are shipped to the API. */
const PING_SECONDS = 30

export function useNodePlayer(
  nodeId: MaybeRefOrGetter<number>,
  onCourseChanged?: () => void,
  isForeground: MaybeRefOrGetter<boolean> = true,
) {
  const api = useApi()
  const toast = useToast()

  const id = computed(() => toValue(nodeId))
  const foreground = computed(() => toValue(isForeground))

  /**
   * Fetched with `useAsyncApi` rather than in `onMounted`, so the node's prose
   * is server-rendered. This is the one screen in the product people read for
   * forty-five minutes; shipping it as an empty skeleton that fills in after
   * hydration would give up first paint on the only content that matters.
   *
   * The promise is handed back as `ready` rather than awaited here: this
   * composable registers lifecycle hooks, and an await inside it would drop the
   * component instance for everything after that point. The caller awaits it at
   * the top level of `<script setup>`, where the compiler preserves the
   * instance for us.
   *
   * Each tab is keyed by node id, so the cache key is stable per instance.
   */
  const asyncNode = useAsyncApi<PlayerNode>(
    `player-node-${id.value}`,
    () => `/nodes/${id.value}`,
    { watch: [id] },
  )

  const { data: fetched, status, error } = asyncNode

  /*
   * Grading, progress and regeneration all write the node back, so there are
   * two sources for it: whatever was last fetched, and whatever this session
   * has since changed. `local` holds the latter and wins when set.
   *
   * A plain `ref` seeded from `fetched` would not do — it is created before the
   * fetch resolves, and a watcher copying the value across does not flush
   * before the server renders, so the node would arrive empty in the HTML.
   */
  const local = ref<PlayerNode | null>(null)

  const node = computed<PlayerNode | null>({
    get: () => local.value ?? fetched.value,
    set: (value) => {
      local.value = value
    },
  })

  /** A refetch is newer than anything local by definition. */
  watch(fetched, () => {
    local.value = null
  })

  const loadError = computed(() => error.value?.message ?? null)
  const loading = computed(() => status.value === 'pending' && !node.value)

  async function load(): Promise<void> {
    try {
      local.value = await api.get<PlayerNode>(`/nodes/${id.value}`)
    } catch {
      /* `loadError` already reflects the async-data failure. */
    }
  }

  /* -- Content ------------------------------------------------------------- */

  const blocks = computed<Block[]>(() =>
    [...(node.value?.blocks ?? [])].sort((a, b) => a.position - b.position || a.id - b.id),
  )

  const assessments = computed<Assessment[]>(() => node.value?.assessments ?? [])

  /**
   * `GET /api/nodes/{id}` already embeds this learner's attempts on every
   * assessment, so graded state survives a reload without a request per item.
   */
  const embeddedAttempts = computed<Record<number, Attempt[]> | null>(() => {
    const list = assessments.value
    if (list.length === 0) return {}
    if (!list.some((assessment) => Array.isArray(assessment.attempts))) return null

    const map: Record<number, Attempt[]> = {}
    for (const assessment of list) {
      map[assessment.id] = [...(assessment.attempts ?? [])].sort((a, b) => b.id - a.id)
    }
    return map
  })

  const attempts = ref<Record<number, Attempt[]>>({})

  /** Fallback for an API build that does not embed attempts: fetch per item. */
  async function loadAttempts(): Promise<void> {
    const embedded = embeddedAttempts.value
    if (embedded) {
      attempts.value = embedded
      return
    }

    const ids = assessments.value.map((assessment) => assessment.id)
    if (ids.length === 0) {
      attempts.value = {}
      return
    }

    const loaded = await Promise.allSettled(
      ids.map(async (item) => [item, await api.get<Attempt[]>(`/assessments/${item}/attempts`)] as const),
    )

    const next: Record<number, Attempt[]> = {}
    for (const outcome of loaded) {
      if (outcome.status === 'fulfilled') next[outcome.value[0]] = outcome.value[1]
    }
    attempts.value = next
  }

  const passedCount = computed(
    () =>
      assessments.value.filter((assessment) =>
        (attempts.value[assessment.id] ?? []).some((attempt) => attempt.passed === true),
      ).length,
  )

  function onGraded(payload: GradedPayload): void {
    attempts.value = {
      ...attempts.value,
      [payload.assessmentId]: [payload.attempt, ...(attempts.value[payload.assessmentId] ?? [])],
    }

    if (payload.nodeState && node.value) {
      node.value = {
        ...node.value,
        progress: {
          state: payload.nodeState,
          time_spent_seconds: node.value.progress?.time_spent_seconds ?? 0,
          completed_at: node.value.progress?.completed_at ?? null,
          last_seen_at: new Date().toISOString(),
        },
      }
    }

    if (payload.nodeCompleted) {
      toast.success({
        title: 'Lesson complete',
        body: 'Every assessment here has been passed.',
      })
      onCourseChanged?.()
    }
  }

  /* -- Time on task -------------------------------------------------------- */

  const pending = ref(0)
  const timeSpent = ref(0)
  const marking = ref(false)

  const state = computed<ProgressState>(() => node.value?.progress?.state ?? 'available')
  const completed = computed(() => state.value === 'completed')

  watch(
    node,
    (value) => {
      timeSpent.value = value?.progress?.time_spent_seconds ?? 0
    },
    { immediate: true },
  )

  /** Ship accumulated seconds. `beacon` keeps the request alive past unload. */
  function flushTime(beacon = false): void {
    const seconds = Math.floor(pending.value)
    if (seconds <= 0) return

    pending.value = 0
    timeSpent.value += seconds

    if (beacon) {
      api.beacon(`/nodes/${id.value}/progress`, { time_spent_seconds: seconds })
      return
    }

    void api.post(`/nodes/${id.value}/progress`, { time_spent_seconds: seconds }).catch(() => {
      // Put the seconds back so the next ping tries again.
      pending.value += seconds
      timeSpent.value -= seconds
    })
  }

  let ticker: ReturnType<typeof setInterval> | undefined

  function onUnload(): void {
    flushTime(true)
  }

  async function setState(target: ProgressState): Promise<void> {
    if (!node.value || marking.value) return

    const before = node.value.progress?.state ?? 'available'
    marking.value = true

    node.value = {
      ...node.value,
      progress: {
        state: target,
        time_spent_seconds: timeSpent.value,
        completed_at: target === 'completed' ? new Date().toISOString() : null,
        last_seen_at: new Date().toISOString(),
      },
    }

    try {
      await api.post(`/nodes/${id.value}/progress`, { state: target })
      onCourseChanged?.()
    } catch (error) {
      if (node.value) {
        node.value = {
          ...node.value,
          progress: {
            state: before,
            time_spent_seconds: timeSpent.value,
            completed_at: node.value.progress?.completed_at ?? null,
            last_seen_at: node.value.progress?.last_seen_at ?? null,
          },
        }
      }
      toast.error(error instanceof Error ? error.message : 'Could not update progress.')
    } finally {
      marking.value = false
    }
  }

  function toggleComplete(): void {
    void setState(completed.value ? 'in_progress' : 'completed')
  }

  /* -- Regeneration and expansion ------------------------------------------ */

  const working = ref(false)
  const workingLabel = ref('')
  /** A first write and a rewrite end in different words. */
  let rewriting = false

  let poller: ReturnType<typeof setTimeout> | undefined

  const inFlight = computed(
    () => working.value || node.value?.status === 'queued' || node.value?.status === 'generating',
  )

  function stopPolling(): void {
    if (poller) clearTimeout(poller)
    poller = undefined
  }

  /**
   * Poll until the node leaves `queued`/`generating`. Not SSE: node-level work
   * is a single job with one outcome, and the course stream already carries the
   * counts a progress bar needs.
   */
  async function pollNode(deadline: number): Promise<void> {
    if (Date.now() > deadline) {
      working.value = false
      toast.warn({
        title: 'Still working',
        body: 'This lesson is taking longer than usual. It will appear here as soon as it is written.',
      })
      return
    }

    try {
      const fresh = await api.get<PlayerNode>(`/nodes/${id.value}`)
      node.value = fresh

      if (fresh.status === 'ready' || fresh.status === 'failed') {
        working.value = false
        stopPolling()
        await loadAttempts()
        onCourseChanged?.()

        if (fresh.status === 'ready') toast.success(rewriting ? 'Lesson rewritten' : 'Lesson written')
        else toast.error({ title: 'Generation failed', body: fresh.failure_reason ?? undefined })

        return
      }
    } catch {
      /* transient — keep polling */
    }

    poller = setTimeout(() => void pollNode(deadline), 1200)
  }

  /**
   * Twenty minutes, not five: with lessons written two at a time, one asked
   * for behind a batch can legitimately wait several minutes before its own
   * couple of minutes begin. Giving up at five said "taking longer than usual"
   * about a lesson that was simply in line.
   */
  function beginPolling(label: string): void {
    working.value = true
    workingLabel.value = label
    stopPolling()
    poller = setTimeout(() => void pollNode(Date.now() + 20 * 60_000), 1200)
  }

  /** The lesson as the screen should show it the instant it is asked for. */
  function showQueued(): void {
    if (node.value) node.value = { ...node.value, status: 'queued', failure_reason: null, writing_for: null }
  }

  async function regenerate(instruction: string): Promise<boolean> {
    if (!node.value || working.value) return false

    const steer = instruction.trim()
    // Busy before the request, not after it: the gap is a second press.
    working.value = true
    rewriting = true

    try {
      await api.post(`/nodes/${id.value}/regenerate`, steer === '' ? {} : { instruction: steer })
      showQueued()
      beginPolling(steer === '' ? 'Rewriting this lesson' : `Rewriting: “${steer}”`)
      return true
    } catch (error) {
      working.value = false
      toast.error(error instanceof Error ? error.message : 'Could not start the rewrite.')
      return false
    }
  }

  /** Stub nodes are generated through the course expand endpoint. */
  async function expand(instruction = ''): Promise<void> {
    if (!node.value || working.value) return

    // Busy before the request, not after it. The button disables on `working`,
    // and the time the request takes is exactly when a second press used to
    // send a second one.
    working.value = true
    workingLabel.value = 'Writing this lesson'
    rewriting = false
    const courseId = node.value.course_id
    const nodeId = node.value.id

    try {
      await api.post(`/courses/${courseId}/expand`, { node_ids: [nodeId], instruction: instruction.trim() || null })
      showQueued()
      beginPolling('Writing this lesson')
      onCourseChanged?.()
    } catch (error) {
      // 409: it is already queued or being written. That is what was asked
      // for, and the server charged nothing for asking twice, so follow it.
      if ((error as { status?: number }).status === 409) {
        showQueued()
        beginPolling('Writing this lesson')
        onCourseChanged?.()
        return
      }
      working.value = false
      toast.error(error instanceof Error ? error.message : 'Could not start generation.')
    }
  }

  /* -- Lifecycle ----------------------------------------------------------- */

  onMounted(async () => {
    await loadAttempts()

    if (node.value?.status === 'queued' || node.value?.status === 'generating') {
      beginPolling('Writing this lesson')
    }

    /* Every open tab is mounted, so "is this node on screen" is two questions:
       is the browser tab visible, and is this the foreground pane. */
    ticker = setInterval(() => {
      if (document.visibilityState !== 'visible' || !foreground.value) return
      pending.value += 1
      if (pending.value >= PING_SECONDS) flushTime()
    }, 1000)

    window.addEventListener('beforeunload', onUnload)
    window.addEventListener('pagehide', onUnload)
  })

  onBeforeUnmount(() => {
    if (ticker) clearInterval(ticker)
    window.removeEventListener('beforeunload', onUnload)
    window.removeEventListener('pagehide', onUnload)
    stopPolling()
    flushTime()
  })

  watch(assessments, () => {
    if (import.meta.client) void loadAttempts()
  })

  /* Switching away from a tab banks its seconds now. Otherwise a learner who
     reads three nodes in a row and closes the browser loses up to 30s on each. */
  watch(foreground, (isForeground) => {
    if (!isForeground) flushTime()
  })

  return {
    /** Await at the top level of `<script setup>` to server-render the node. */
    ready: asyncNode,
    node,
    loading,
    loadError,
    blocks,
    assessments,
    attempts,
    passedCount,
    state,
    completed,
    marking,
    timeSpent,
    working,
    workingLabel,
    inFlight,
    load,
    loadAttempts,
    onGraded,
    setState,
    toggleComplete,
    regenerate,
    expand,
  }
}
