import type { InjectionKey } from 'vue'
import type { Course, CourseNode } from '~/types/api'
import type { RunLang, SandboxTest } from '~/composables/useWasmSandbox'

/**
 * Workspace shell state: which tabs are open, which panel the sidebar shows,
 * and where the assistant lives.
 *
 * This is deliberately *not* in the URL beyond the active tab. A learner who
 * comes back after four days should find the same three nodes open they left
 * open, and a URL that encodes a whole tab set is a URL nobody can share.
 */

export interface NodeTab {
  kind: 'node'
  id: string
  nodeId: number
}

/**
 * A code sandbox opened from a lesson's coding exercise, living as its own tab
 * in the workspace strip — the app has tabs, so a coding task opens in one, not
 * in a separate browser window. Seeded from the exercise; what the learner does
 * here is a scratchpad and does not feed back into the graded exercise.
 */
export interface SandboxTab {
  kind: 'sandbox'
  id: string
  title: string
  lang: RunLang
  code: string
  tests?: SandboxTest[]
}

/**
 * MARKUP — a whiteboard opened from a lesson, living as its own tab. A fixed
 * canvas never reflows, which is why the pen is offered here and on images but
 * not over prose. The drawing itself is a private markup record (kind `board`)
 * keyed by `uuid`; the tab only knows which lesson it belongs to and its name.
 */
export interface BoardTab {
  kind: 'board'
  id: string
  nodeId: number
  uuid: string
  title: string
}

export type WorkspaceTab = { kind: 'map'; id: 'map' } | NodeTab | SandboxTab | BoardTab

export interface OpenSandboxPayload {
  /** Stable key (e.g. the exercise's block id) so re-opening focuses its tab. */
  key: string | number
  title: string
  lang: RunLang
  code: string
  tests?: SandboxTest[]
}

/**
 * Provided by the workspace page so a lesson's code exercise — mounted deep in
 * the block tree — can open a sandbox tab without reaching for the course id or
 * a popup window. Injected with a fallback, so a read-only/shared view where no
 * workspace is provided simply does nothing.
 */
export const OPEN_SANDBOX: InjectionKey<(payload: OpenSandboxPayload) => void> = Symbol('openSandbox')

export type SidebarView = 'nodes' | 'plan' | 'files'
export type AssistantMode = 'docked' | 'float' | 'closed'

export function nodeTabId(nodeId: number): string {
  return `node:${nodeId}`
}

interface CourseWorkspaceState {
  tabs: WorkspaceTab[]
  activeId: string | null
  sidebar: SidebarView
  /** The opening tab has been chosen for this visit (see `openInitial`). */
  arrived: boolean
}

function emptyState(): CourseWorkspaceState {
  return { tabs: [], activeId: null, sidebar: 'nodes', arrived: false }
}

/**
 * Tabs live per course, so opening a second course does not inherit the first
 * one's strip.
 *
 * One `useState` holding a map keyed by course id, rather than a `useState` per
 * course: the key has to be a literal string, and the page component is reused
 * across `/ada/algebra` → `/ada/calculus`, so there is no single call site
 * where a per-course key could be resolved.
 */
export function useWorkspace(courseId: MaybeRefOrGetter<number>) {
  const all = useState<Record<number, CourseWorkspaceState>>('workspace:courses', () => ({}))

  const id = computed(() => toValue(courseId))

  function state(): CourseWorkspaceState {
    return all.value[id.value] ?? emptyState()
  }

  function patch(changes: Partial<CourseWorkspaceState>): void {
    all.value = { ...all.value, [id.value]: { ...state(), ...changes } }
  }

  const tabs = computed<WorkspaceTab[]>({
    get: () => state().tabs,
    set: (value) => patch({ tabs: value }),
  })

  const activeId = computed<string | null>({
    get: () => state().activeId,
    set: (value) => patch({ activeId: value }),
  })

  const sidebar = computed<SidebarView>({
    get: () => state().sidebar,
    set: (value) => patch({ sidebar: value }),
  })

  /* The assistant's home is a preference about the whole app, not about one
     course, so it is not namespaced. */
  const assistant = useState<AssistantMode>('workspace:assistant', () => 'docked')

  /*
   * Whether the lesson list is shown at all. Same scope as the assistant's
   * home — a person who tucks it away wants it tucked away in every course —
   * and remembered on the device, because it is about this screen's width.
   */
  const sidebarOpen = useState<boolean>('workspace:sidebarOpen', () => true)

  if (import.meta.client) {
    onMounted(() => {
      try {
        const stored = localStorage.getItem('bilimind:sidebar')
        if (stored === 'closed') sidebarOpen.value = false
      } catch {
        /* storage may be unavailable */
      }
    })

    watch(sidebarOpen, (open) => {
      try {
        localStorage.setItem('bilimind:sidebar', open ? 'open' : 'closed')
      } catch {
        /* storage may be unavailable */
      }
    })
  }

  const active = computed<WorkspaceTab | null>(
    () => tabs.value.find((t) => t.id === activeId.value) ?? null,
  )

  const activeNodeId = computed<number | null>(() =>
    active.value?.kind === 'node' ? active.value.nodeId : null,
  )

  function focus(id: string): void {
    if (tabs.value.some((t) => t.id === id)) activeId.value = id
  }

  function openMap(): void {
    if (!tabs.value.some((t) => t.kind === 'map')) {
      tabs.value = [{ kind: 'map', id: 'map' }, ...tabs.value]
    }
    activeId.value = 'map'
  }

  function openNode(nodeId: number): void {
    const id = nodeTabId(nodeId)
    if (!tabs.value.some((t) => t.id === id)) {
      tabs.value = [...tabs.value, { kind: 'node', id, nodeId }]
    }
    activeId.value = id
  }

  /**
   * Open (or focus) a sandbox tab for a coding exercise. Re-opening the same
   * exercise focuses the tab it already has rather than reseeding it, so a
   * learner who tabbed away to read something does not lose their experiment.
   */
  function openSandbox(payload: OpenSandboxPayload): void {
    const id = `sandbox:${payload.key}`

    if (!tabs.value.some((t) => t.id === id)) {
      tabs.value = [
        ...tabs.value,
        {
          kind: 'sandbox',
          id,
          title: payload.title,
          lang: payload.lang,
          code: payload.code,
          tests: payload.tests,
        },
      ]
    }

    activeId.value = id
  }

  /** Open (or focus) the whiteboard `uuid` that belongs to lesson `nodeId`. */
  function openBoard(nodeId: number, uuid: string, title: string): void {
    const id = `board:${uuid}`

    if (!tabs.value.some((t) => t.id === id)) {
      tabs.value = [...tabs.value, { kind: 'board', id, nodeId, uuid, title }]
    }

    activeId.value = id
  }

  /**
   * Closing the active tab hands focus to its neighbour rather than to the
   * first tab — the same thing every editor does, and the thing that keeps a
   * "close, read, close, read" pass through a tier feeling continuous.
   */
  function close(id: string): void {
    const index = tabs.value.findIndex((t) => t.id === id)
    if (index === -1) return

    const remaining = tabs.value.filter((t) => t.id !== id)
    tabs.value = remaining

    if (activeId.value === id) {
      const neighbour = remaining[index] ?? remaining[index - 1] ?? null
      activeId.value = neighbour?.id ?? null
    }

    // The last lesson closed: the course's map is what is left of it, not a
    // blank pane. Closing the map itself is a real choice and is kept.
    if (remaining.length === 0 && id !== 'map') openMap()
  }

  /**
   * Move a reading run forward: focus `nodeId`, and drop the tab it came from.
   *
   * `openNode` appends, which is right when a lesson is opened from the list or
   * the roadmap and wrong when the learner presses "next" at the bottom of one —
   * eight lessons read in a row otherwise leave eight tabs clipped to 172px in a
   * scrolling strip, and none of the seven behind is a place anyone is going
   * back to.
   *
   * `replacing` is closed only when it is the tab actually being left, so a
   * lesson open in another tab with an answer typed into it is never thrown
   * away. Whether this lesson is safe to close is the caller's judgement, not
   * this function's.
   */
  function openNext(nodeId: number, replacing: string | null): void {
    const target = nodeTabId(nodeId)

    openNode(nodeId)

    if (replacing && replacing !== target) close(replacing)
  }

  /**
   * Drop tabs for nodes the course no longer has. Cheap insurance against a
   * regenerated outline leaving a tab pointing at a deleted node.
   */
  function reconcile(nodes: CourseNode[]): void {
    const live = new Set(nodes.map((n) => n.id))
    // Map and sandbox tabs are not bound to a node; lesson and whiteboard tabs can go stale.
    const kept = tabs.value.filter(
      (t) => (t.kind !== 'node' && t.kind !== 'board') || live.has(t.nodeId),
    )

    if (kept.length !== tabs.value.length) {
      tabs.value = kept
      if (!kept.some((t) => t.id === activeId.value)) {
        activeId.value = kept[kept.length - 1]?.id ?? null
      }
    }
  }

  /**
   * What to show when no tab is open: the map. A learner arriving without a
   * `?node=` — or one who closed every tab and is now looking at the course
   * again — wants to see where they are on the path, and the map says that and
   * marks the lesson they were on. Opening the "resume" lesson here instead was
   * the surprise: close everything, and the first lesson popped back open on
   * the next refresh of the course.
   *
   * `requested` comes from `?node=`, which is how the old per-node URLs and the
   * today screen's "continue" link arrive, so continuing still lands on the lesson.
   */
  function openInitial(course: Course, requested?: number | null): void {
    if (requested && course.nodes.some((n) => n.id === requested)) {
      openNode(requested)
      if (!state().arrived) patch({ arrived: true })
      return
    }

    // Once per visit. This runs again every time the course is refetched —
    // which is every few seconds while lessons are being written — and a map
    // the learner closed on purpose must not keep coming back.
    if (state().arrived) return

    if (tabs.value.length > 0) {
      patch({ arrived: true })
      return
    }

    openMap()
    patch({ arrived: true })
  }

  return {
    tabs,
    activeId,
    active,
    activeNodeId,
    sidebar,
    sidebarOpen,
    assistant,
    focus,
    openMap,
    openNode,
    openNext,
    openSandbox,
    openBoard,
    close,
    reconcile,
    openInitial,
  }
}
