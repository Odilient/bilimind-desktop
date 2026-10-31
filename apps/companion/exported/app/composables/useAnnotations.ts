import type { Annotation, BoardAnnotation } from '~/types/api'
import { ApiError, AUTH_COOKIE } from '~/composables/useApi'
import { newUuid, simplifyStroke } from '~/utils/markup'

/**
 * One step of markup history. `before` is null for a mark that did not exist
 * yet; `after` is null for one that was removed.
 */
interface HistoryEntry {
  uuid: string
  before: Annotation | null
  after: Annotation | null
}

interface ChangeOptions {
  /** `false` while undoing or redoing, so the step is not recorded twice. */
  record?: boolean
}

/** How long the pen has to be still before its marks go to the server. */
const SAVE_DELAY = 1000

/** UpsertAnnotationsRequest::MAX_BATCH. */
const BATCH = 50

const HISTORY_CAP = 100

/** A whiteboard's first size. Wide enough for a diagram, short enough to see whole. */
export const BOARD_WIDTH = 1200
export const BOARD_HEIGHT = 800

const NONE: Annotation[] = []

/**
 * MARKUP — a reader's private marks on one lesson: load, keep, save, undo.
 *
 * Local-first, because a pen that waits for a server is not a pen. Every
 * change lands in `annotations` at once and the save runs behind it: a
 * one-second debounce that coalesces everything touched in the meantime into
 * one batch PUT, keyed by uuids the client minted, so a retried save converges
 * and a stroke drawn while the last save was in flight is simply in the next.
 * Removals go out as one DELETE each — there is no batch for them, and there
 * is no hurry.
 *
 * The failure case is the whole design of the save path. A save that fails
 * leaves its marks dirty, so the next stroke retries it; the toast offers a
 * retry too, and says so once rather than once per second. Nothing is ever
 * thrown away on the client's side. Success is silent.
 *
 * Undo covers highlights, notes and drawings on pictures. It deliberately does
 * NOT cover strokes on a whiteboard: a board is its own tab with its own undo,
 * and pressing Undo in the lesson to erase a stroke you cannot see is a bug
 * wearing a feature's clothes.
 */
export function useAnnotations(nodeId: MaybeRefOrGetter<number>) {
  const api = useApi()
  const toast = useToast()
  const { isAuthenticated } = useAuth()

  const annotations = ref<Annotation[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const saving = ref(false)

  const undoStack = ref<HistoryEntry[]>([])
  const redoStack = ref<HistoryEntry[]>([])
  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  /**
   * Marks that could not be put back on the page, per block, reported by the
   * highlight layer after it paints. A highlight whose quote is gone from an
   * edited lesson is counted here and never drawn in the wrong place.
   */
  const orphansByBlock = ref<Record<number, number>>({})
  const orphans = computed(() =>
    Object.values(orphansByBlock.value).reduce((sum, count) => sum + count, 0),
  )

  const byBlockMap = computed(() => {
    const map = new Map<number, Annotation[]>()
    for (const annotation of annotations.value) {
      if (annotation.block_id === null) continue
      const list = map.get(annotation.block_id)
      if (list) list.push(annotation)
      else map.set(annotation.block_id, [annotation])
    }
    return map
  })

  const boards = computed(
    () => annotations.value.filter((a): a is BoardAnnotation => a.kind === 'board'),
  )

  /* -- The save queue ------------------------------------------------------ */

  /** Uuids changed since the last save. */
  const dirty = new Set<string>()
  /** Uuids removed locally that the server still has. */
  const doomed = new Set<string>()
  /** Uuids the server is known to hold. Decides whether a removal needs a DELETE. */
  const persisted = new Set<string>()

  let timer: ReturnType<typeof setTimeout> | null = null
  let flushing = false
  let flushAgain = false
  let warned = false

  function id(): number {
    return toValue(nodeId)
  }

  function find(uuid: string): Annotation | undefined {
    return annotations.value.find((a) => a.uuid === uuid)
  }

  function byBlock(blockId: number): Annotation[] {
    return byBlockMap.value.get(blockId) ?? NONE
  }

  function reportOrphans(blockId: number, count: number): void {
    if ((orphansByBlock.value[blockId] ?? 0) === count) return
    orphansByBlock.value = { ...orphansByBlock.value, [blockId]: count }
  }

  /* -- Loading ------------------------------------------------------------- */

  /**
   * Signed-out readers have no marks and must not be asked: a 401 from here
   * would bounce them to the login page from a lesson they were allowed to
   * read. The 404 for "not yours to see" is equally quiet.
   *
   * The companion demo is the one reader with marks and no account: its
   * lessons have negative ids and `useApi` answers them in memory.
   */
  async function load(): Promise<void> {
    if (!import.meta.client) return

    const node = id()
    if (!node) return
    if (!isAuthenticated.value && !(node < 0 && isCompanionDemo())) return

    loading.value = true
    try {
      const rows = await api.get<Annotation[]>(`/nodes/${node}/annotations`)
      annotations.value = rows
      persisted.clear()
      for (const row of rows) persisted.add(row.uuid)
      loaded.value = true
    } catch (cause) {
      if (cause instanceof ApiError && (cause.status === 404 || cause.status === 401)) return
      toast.error({
        title: 'Your highlights and drawings could not be loaded',
        body: cause instanceof Error ? cause.message : undefined,
        action: { label: 'Try again', handler: () => void load() },
      })
    } finally {
      loading.value = false
    }
  }

  /* -- Changing ------------------------------------------------------------ */

  function apply(uuid: string, next: Annotation | null): void {
    const list = annotations.value
    const at = list.findIndex((a) => a.uuid === uuid)

    if (next === null) {
      if (at >= 0) annotations.value = list.filter((a) => a.uuid !== uuid)
      return
    }

    if (at >= 0) {
      const copy = list.slice()
      copy[at] = next
      annotations.value = copy
    } else {
      annotations.value = [...list, next]
    }
  }

  function record(entry: HistoryEntry): void {
    undoStack.value = [...undoStack.value.slice(-(HISTORY_CAP - 1)), entry]
    redoStack.value = []
  }

  /**
   * Create or replace a mark. The node id is stamped here rather than trusted
   * from the caller, because the caller is a block that knows its own id and
   * not necessarily the lesson's.
   */
  function upsert(input: Annotation, options: ChangeOptions = {}): Annotation {
    const next = { ...input, node_id: id() } as Annotation
    const before = find(next.uuid) ?? null

    apply(next.uuid, next)
    doomed.delete(next.uuid)
    dirty.add(next.uuid)

    if (options.record !== false && next.kind !== 'board') {
      record({ uuid: next.uuid, before, after: next })
    }

    schedule()

    return next
  }

  function remove(uuid: string, options: ChangeOptions = {}): void {
    const before = find(uuid)
    if (!before) return

    apply(uuid, null)
    dirty.delete(uuid)
    if (persisted.has(uuid)) doomed.add(uuid)

    if (options.record !== false && before.kind !== 'board') {
      record({ uuid, before, after: null })
    }

    schedule()
  }

  function createBoard(title?: string): BoardAnnotation {
    const board: BoardAnnotation = {
      uuid: newUuid(),
      node_id: id(),
      block_id: null,
      kind: 'board',
      anchor: { logical_width: BOARD_WIDTH, logical_height: BOARD_HEIGHT },
      data: { strokes: [], title: title ?? `Whiteboard ${boards.value.length + 1}` },
      updated_at: null,
    }

    return upsert(board) as BoardAnnotation
  }

  function restore(uuid: string, state: Annotation | null): void {
    if (state) upsert(state, { record: false })
    else remove(uuid, { record: false })
  }

  function undo(): void {
    const entry = undoStack.value[undoStack.value.length - 1]
    if (!entry) return
    undoStack.value = undoStack.value.slice(0, -1)
    restore(entry.uuid, entry.before)
    redoStack.value = [...redoStack.value, entry]
  }

  function redo(): void {
    const entry = redoStack.value[redoStack.value.length - 1]
    if (!entry) return
    redoStack.value = redoStack.value.slice(0, -1)
    restore(entry.uuid, entry.after)
    undoStack.value = [...undoStack.value, entry]
  }

  /* -- Saving -------------------------------------------------------------- */

  /** The wire shape: what the request validates, nothing it ignores. */
  function wire(annotation: Annotation) {
    return {
      uuid: annotation.uuid,
      kind: annotation.kind,
      block_id: annotation.block_id,
      anchor: annotation.anchor,
      data: annotation.data,
    }
  }

  function schedule(): void {
    if (!import.meta.client) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void flush()
    }, SAVE_DELAY)
  }

  function fail(cause: unknown): void {
    if (warned) return
    warned = true

    const body =
      cause instanceof ApiError
        ? (cause.allMessages[0] ?? cause.message)
        : 'Check your connection and try again.'

    toast.error({
      title: 'Your marks could not be saved',
      body,
      action: {
        label: 'Try again',
        handler: () => {
          warned = false
          void flush()
        },
      },
    })
  }

  /**
   * Send everything dirty, then everything doomed. One flush at a time: a
   * change that arrives mid-flight sets a flag and gets its own flush after.
   */
  async function flush(node = id()): Promise<void> {
    if (!import.meta.client) return
    if (flushing) {
      flushAgain = true
      return
    }
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (dirty.size === 0 && doomed.size === 0) return

    flushing = true
    saving.value = true

    try {
      const pending: Annotation[] = []
      for (const uuid of dirty) {
        const annotation = find(uuid)
        if (annotation) pending.push(annotation)
      }
      dirty.clear()

      for (let at = 0; at < pending.length; at += BATCH) {
        const chunk = pending.slice(at, at + BATCH)

        try {
          const saved = await api.put<Annotation[]>(`/nodes/${node}/annotations`, {
            annotations: chunk.map(wire),
          })
          for (const row of saved) persisted.add(row.uuid)
          warned = false
        } catch (cause) {
          for (const annotation of chunk) {
            if (!doomed.has(annotation.uuid)) dirty.add(annotation.uuid)
          }
          fail(cause)
        }
      }

      const removals = [...doomed].filter((uuid) => persisted.has(uuid))
      doomed.clear()

      for (const uuid of removals) {
        try {
          await api.del(`/annotations/${uuid}`)
          persisted.delete(uuid)
        } catch (cause) {
          // Already gone is the outcome we wanted.
          if (cause instanceof ApiError && cause.isNotFound) {
            persisted.delete(uuid)
            continue
          }
          doomed.add(uuid)
          fail(cause)
        }
      }
    } finally {
      flushing = false
      saving.value = false
      if (flushAgain) {
        flushAgain = false
        schedule()
      }
    }
  }

  /**
   * The tab is closing with the last second of ink unsaved. `keepalive` lets
   * the request outlive the page; the token is read straight off the cookie
   * because there is no time left for anything nicer. Best effort, no retry —
   * whatever this misses, the next open of the lesson will not have.
   */
  function flushOnHide(): void {
    if (dirty.size === 0 || !isAuthenticated.value) return

    const rows: ReturnType<typeof wire>[] = []
    for (const uuid of dirty) {
      const annotation = find(uuid)
      if (annotation) rows.push(wire(annotation))
      if (rows.length === BATCH) break
    }
    if (rows.length === 0) return

    const raw = document.cookie.match(new RegExp(`(?:^|; )${AUTH_COOKIE}=([^;]*)`))?.[1]
    const token = raw ? decodeURIComponent(raw) : null

    void fetch(api.url(`/nodes/${id()}/annotations`), {
      method: 'PUT',
      keepalive: true,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ annotations: rows }),
    }).catch(() => undefined)
  }

  if (import.meta.client) {
    window.addEventListener('pagehide', flushOnHide)
    onScopeDispose(() => {
      window.removeEventListener('pagehide', flushOnHide)
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      void flush()
    })
  }

  /* A pane that is re-pointed at another lesson finishes the last one's save
     first; the ids in a flush are captured at the time it starts. */
  watch(
    () => toValue(nodeId),
    (next, previous) => {
      if (previous) void flush(previous)
      annotations.value = []
      undoStack.value = []
      redoStack.value = []
      orphansByBlock.value = {}
      dirty.clear()
      doomed.clear()
      persisted.clear()
      loaded.value = false
      if (next) void load()
    },
  )

  return {
    annotations,
    loaded,
    loading,
    saving,
    orphans,
    boards,
    canUndo,
    canRedo,
    load,
    byBlock,
    upsert,
    remove,
    createBoard,
    undo,
    redo,
    flush,
    reportOrphans,
    simplifyStroke,
  }
}
