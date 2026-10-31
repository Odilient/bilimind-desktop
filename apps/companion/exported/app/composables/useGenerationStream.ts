import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { Course, CourseStatus, CourseNode } from '~/types/api'

/**
 * Live generation progress for one course (SPEC §4 "Progress streaming").
 *
 * It polls `GET /api/courses/{id}` and derives the snapshot from the node
 * list. There used to be a Server-Sent Events feed in front of this, but an
 * `EventSource` cannot send an `Authorization` header, so once the API moved
 * to bearer tokens every stream was a 401 followed by this same polling — and
 * a long-held socket also pins a PHP worker for the whole build. Polling is
 * the transport, not the fallback.
 *
 *   const gen = useGenerationStream(() => course.value?.id ?? null)
 *   gen.percent.value   // 0–100
 *   gen.done.value      // true once the course reaches a terminal state
 *
 * Polling stops on `done`, when the course id changes and when the owning
 * scope is disposed.
 */

export interface GenerationSnapshot {
  status: CourseStatus
  nodesTotal: number
  nodesReady: number
  nodesFailed: number
  percent: number
  done: boolean
}

export type GenerationTransport = 'idle' | 'poll'

export interface UseGenerationStreamOptions {
  /** Open the connection as soon as a course id is available. Default `true`. */
  immediate?: boolean
  /** Polling interval in ms. Default 1600. */
  pollInterval?: number
  /** Called on every poll with the snapshot and the course it was read from. */
  onProgress?: (snapshot: GenerationSnapshot, course: Course) => void
  /** Called exactly once per run, when the course reaches a terminal state. */
  onDone?: (snapshot: GenerationSnapshot) => void
}

export interface UseGenerationStreamReturn {
  status: Ref<CourseStatus>
  nodesTotal: Ref<number>
  nodesReady: Ref<number>
  nodesFailed: Ref<number>
  percent: Ref<number>
  done: Ref<boolean>
  /** Non-fatal: the last poll failed. Cleared on the next success. */
  error: Ref<string | null>
  transport: Ref<GenerationTransport>
  /** True while polling. */
  active: Ref<boolean>
  snapshot: ComputedRef<GenerationSnapshot>
  start: () => void
  stop: () => void
  restart: () => void
}

/** Terminal course states — mirrors `App\Enums\CourseStatus::isTerminal()`. */
const TERMINAL: readonly CourseStatus[] = ['ready', 'failed', 'outlined', 'clarifying']

function clampPercent(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

function toInt(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
}

export function useGenerationStream(
  courseId: MaybeRefOrGetter<number | null | undefined>,
  options: UseGenerationStreamOptions = {},
): UseGenerationStreamReturn {
  const { immediate = true, pollInterval = 1600, onProgress, onDone } = options

  const api = useApi()

  const status = ref<CourseStatus>('outlining')
  const nodesTotal = ref(0)
  const nodesReady = ref(0)
  const nodesFailed = ref(0)
  const percent = ref(0)
  const done = ref(false)
  const error = ref<string | null>(null)
  const transport = ref<GenerationTransport>('idle')
  const active = ref(false)

  let pollTimer: ReturnType<typeof setTimeout> | null = null
  let announcedDone = false
  /** Guards late callbacks from a connection that has already been replaced. */
  let run = 0

  const snapshot = computed<GenerationSnapshot>(() => ({
    status: status.value,
    nodesTotal: nodesTotal.value,
    nodesReady: nodesReady.value,
    nodesFailed: nodesFailed.value,
    percent: percent.value,
    done: done.value,
  }))

  function clearTimers(): void {
    if (!pollTimer) return
    clearTimeout(pollTimer)
    pollTimer = null
  }

  function stop(): void {
    run += 1
    clearTimers()
    active.value = false
    transport.value = 'idle'
  }

  function apply(next: GenerationSnapshot, course: Course): void {
    status.value = next.status
    nodesTotal.value = next.nodesTotal
    nodesReady.value = next.nodesReady
    nodesFailed.value = next.nodesFailed
    percent.value = next.percent

    onProgress?.(snapshot.value, course)
  }

  function finish(): void {
    done.value = true
    stop()
    if (announcedDone) return
    announcedDone = true
    onDone?.(snapshot.value)
  }

  /* ---- Poll the course itself --------------------------------------------- */

  function snapshotFromCourse(course: Course): GenerationSnapshot {
    const nodes: CourseNode[] = Array.isArray(course?.nodes) ? course.nodes : []
    const total = nodes.length
    const ready = nodes.filter((node) => node.status === 'ready').length
    const failed = nodes.filter((node) => node.status === 'failed').length
    const inFlight = nodes.filter(
      (node) => node.status === 'queued' || node.status === 'generating',
    ).length

    const courseStatus = (course?.status as CourseStatus) ?? status.value
    const settled = Math.min(ready + failed, total)

    return {
      status: courseStatus,
      nodesTotal: total,
      nodesReady: ready,
      nodesFailed: failed,
      percent:
        total > 0
          ? clampPercent((settled / total) * 100)
          : courseStatus === 'ready' || courseStatus === 'outlined'
            ? 100
            : 0,
      done: TERMINAL.includes(courseStatus) && inFlight === 0,
    }
  }

  async function pollOnce(id: number, token: number): Promise<void> {
    try {
      const course = await api.get<Course>(`/courses/${id}`)
      if (token !== run) return

      const next = snapshotFromCourse(course)
      apply(next, course)

      if (next.done) {
        finish()
        return
      }
      error.value = null
    } catch (err) {
      if (token !== run) return
      error.value = err instanceof Error ? err.message : 'Lost contact with the server.'
    }

    if (token !== run) return
    pollTimer = setTimeout(() => void pollOnce(id, token), pollInterval)
  }

  function startPolling(id: number): void {
    if (done.value) return

    clearTimers()

    transport.value = 'poll'
    active.value = true

    const token = run
    void pollOnce(id, token)
  }

  function start(): void {
    if (!import.meta.client) return

    const id = toValue(courseId)
    if (typeof id !== 'number' || !Number.isFinite(id) || id <= 0) return

    stop()
    run += 1
    done.value = false
    announcedDone = false
    error.value = null

    startPolling(id)
  }

  function restart(): void {
    start()
  }

  watch(
    () => toValue(courseId),
    (id, previous) => {
      if (id === previous) return
      stop()
      done.value = false
      announcedDone = false
      nodesTotal.value = 0
      nodesReady.value = 0
      nodesFailed.value = 0
      percent.value = 0
      if (immediate && typeof id === 'number' && id > 0) start()
    },
  )

  if (immediate && getCurrentInstance()) {
    onMounted(() => start())
  }

  // Belt and braces: the scope hook covers composable reuse outside a component,
  // the unmount hook covers keep-alive teardown order.
  if (getCurrentScope()) onScopeDispose(() => stop())
  if (getCurrentInstance()) onBeforeUnmount(() => stop())

  return {
    status,
    nodesTotal,
    nodesReady,
    nodesFailed,
    percent,
    done,
    error,
    transport,
    active,
    snapshot,
    start,
    stop,
    restart,
  }
}
