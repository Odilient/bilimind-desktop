import type { Block, BlockType } from '~/types/api'
import type { PlayerNode } from '~/composables/useNodePlayer'
import { normalisePayload } from '~/components/editor/schema'
import { ApiError } from '~/composables/useApi'

/**
 * EDIT — the draft of one lesson while its owner is changing it.
 *
 * The player (`useNodePlayer`) holds what the server last said; this holds
 * what the person has typed since, and reconciles the two. It owns the four
 * things an editor has to get right and a form does not:
 *
 *   - **Autosave with an optimistic lock.** Every change is saved 1.5s after
 *     the last keystroke, on blur and on Done, as the complete block list
 *     (the endpoint's contract), naming the revision the draft started from.
 *     A 409 means another tab got there first; the draft freezes rather than
 *     overwriting, and `reload()` starts again from the latest version.
 *   - **Undo that survives autosave.** History is a stack of whole-draft
 *     snapshots — blocks are small JSON, so this is the cheapest correct undo —
 *     and it is local, so undoing after a save simply saves again.
 *   - **Blocks that do not have ids yet.** A new block is keyed locally until
 *     the first save returns it; ids are mapped back by position, because
 *     the endpoint keeps the order it was given.
 *   - **A way out that means it.** Because autosave has already written half
 *     of the session, `cancel()` cannot simply drop the draft: it restores the
 *     revision the session opened on. `cancelSelection()` is the same promise
 *     one block down — close this editor and forget what I typed into it.
 */
export interface DraftBlock {
  /** Stable local identity for `v-for` and selection; `b{id}` once saved. */
  key: string
  id: number | null
  type: BlockType
  payload: Record<string, unknown>
  source_material_ids: number[] | null
}

export interface Draft {
  title: string
  summary: string
  estimated_minutes: number
  blocks: DraftBlock[]
}

const AUTOSAVE_MS = 1500
const HISTORY_LIMIT = 120
/** Keystrokes in the same field within this window share one undo step. */
const COALESCE_MS = 900
const REWRITE_POLL_MS = 2000
const REWRITE_DEADLINE_MS = 5 * 60_000

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function sortedBlocks(node: PlayerNode): Block[] {
  return [...(node.blocks ?? [])].sort((a, b) => a.position - b.position || a.id - b.id)
}

export function useLessonEditor(input: {
  nodeId: MaybeRefOrGetter<number>
  node: Ref<PlayerNode | null>
  /** Hand a fresh server copy back to the player. */
  apply: (node: PlayerNode) => void
  /** The course strip needs to know a title changed. */
  onSaved?: () => void
}) {
  const api = useApi()
  const toast = useToast()

  const id = computed(() => toValue(input.nodeId))

  const editing = ref(false)
  const draft = ref<Draft | null>(null)
  const dirty = ref(false)
  const saving = ref(false)
  const savedAt = ref<number | null>(null)
  const conflict = ref(false)
  /** The last validation message, shown by the strip until the next save. */
  const problem = ref<string | null>(null)
  /** The block whose editor is open. */
  const selectedKey = ref<string | null>(null)
  /** Ids of blocks the model is rewriting right now. */
  const rewriting = ref<number[]>([])
  /** Whether anything from this session has already reached the server. */
  const persisted = ref(false)
  /** CANCEL — putting the lesson back the way this session found it. */
  const cancelling = ref(false)

  /** Whether leaving now without saving would throw something away. */
  const changed = computed(() => dirty.value || persisted.value)

  let baseRevisionId: number | null = null
  /** The revision this session opened on; where Cancel goes back to. */
  let startRevisionId: number | null = null
  /** The lesson had nothing in it (being written by hand); Cancel empties it again. */
  let startedEmpty = false
  /** The selected block's payload as it was when it was selected. */
  let selectionWas: string | null = null
  let counter = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  /* -- Undo ------------------------------------------------------------------ */

  const past: string[] = []
  const future: string[] = []
  const canUndo = ref(false)
  const canRedo = ref(false)

  let lastCoalesceKey: string | null = null
  let lastCommitAt = 0

  function snapshot(): string {
    return JSON.stringify(draft.value)
  }

  function syncUndoFlags(): void {
    canUndo.value = past.length > 0
    canRedo.value = future.length > 0
  }

  function afterChange(): void {
    dirty.value = true
    syncUndoFlags()
    schedule()
  }

  /**
   * Apply one change to the draft, remembering the state before it. Changes
   * carrying the same `coalesce` key in quick succession — typing in one
   * field — become a single undo step, so Ctrl-Z takes back a word, not a
   * letter.
   */
  function commit(mutate: (current: Draft) => void, coalesce: string | null = null): void {
    if (!draft.value) return

    const now = Date.now()
    const merge = coalesce !== null && coalesce === lastCoalesceKey && now - lastCommitAt < COALESCE_MS

    if (!merge) {
      past.push(snapshot())
      if (past.length > HISTORY_LIMIT) past.shift()
      future.length = 0
    }

    lastCoalesceKey = coalesce
    lastCommitAt = now

    mutate(draft.value)
    afterChange()
  }

  function undo(): void {
    const previous = past.pop()
    if (previous === undefined) return
    future.push(snapshot())
    draft.value = JSON.parse(previous) as Draft
    lastCoalesceKey = null
    afterChange()
  }

  function redo(): void {
    const next = future.pop()
    if (next === undefined) return
    past.push(snapshot())
    draft.value = JSON.parse(next) as Draft
    lastCoalesceKey = null
    afterChange()
  }

  /* -- Lifecycle ------------------------------------------------------------- */

  function fromNode(node: PlayerNode): Draft {
    return {
      title: node.title,
      summary: node.summary ?? '',
      estimated_minutes: node.estimated_minutes,
      blocks: sortedBlocks(node).map((block) => ({
        key: `b${block.id}`,
        id: block.id,
        type: block.type,
        payload: clone((block.payload ?? {}) as unknown as Record<string, unknown>),
        source_material_ids: block.source_material_ids ?? null,
      })),
    }
  }

  function begin(): void {
    const node = input.node.value
    if (!node) return

    draft.value = fromNode(node)
    baseRevisionId = node.current_revision_id ?? null
    startRevisionId = baseRevisionId
    startedEmpty = (node.blocks ?? []).length === 0
    editing.value = true
    dirty.value = false
    persisted.value = false
    conflict.value = false
    problem.value = null
    selectedKey.value = null
    selectionWas = null
    past.length = 0
    future.length = 0
    lastCoalesceKey = null
    syncUndoFlags()
  }

  /** Save what is pending and leave edit mode. Stays in it on a conflict. */
  async function finish(): Promise<void> {
    selectedKey.value = null
    selectionWas = null
    const ok = await flush()
    if (ok && !conflict.value) {
      editing.value = false
      draft.value = null
    }
  }

  /** Leave without saving what is pending. */
  function discard(): void {
    if (timer) clearTimeout(timer)
    timer = undefined
    editing.value = false
    draft.value = null
    dirty.value = false
    persisted.value = false
    selectedKey.value = null
    selectionWas = null
  }

  /**
   * CANCEL — leave, and put the lesson back the way this session found it.
   *
   * Autosave means "cancel" cannot just drop the draft: half of it is already
   * on the server. So what has not been sent is dropped, and what has is
   * undone by restoring the revision the session opened on — which also brings
   * back assessments and their answer keys, something a plain save cannot do.
   * The restore is itself an entry in History, because going back is an event.
   *
   * Nothing was sent (the common case: a change of mind within a second and a
   * half) means no request at all.
   */
  async function cancel(): Promise<boolean> {
    cancelling.value = true

    try {
      // A save already in flight would land on top of the restore and put the
      // changes back, so it is waited out first. The deadline is for the
      // request that never answers: better a stale restore than a stuck button.
      const deadline = Date.now() + 10_000
      while (saving.value && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 60))
      }

      if (timer) clearTimeout(timer)
      timer = undefined

      if (!persisted.value) {
        discard()
        return true
      }

      // A first draft has no earlier version: going back is having nothing again,
      // which the server reads as unwritten (a stub) once more.
      if (startedEmpty) {
        input.apply(await api.patch<PlayerNode>(`/nodes/${id.value}`, { blocks: [], base_revision_id: baseRevisionId }))
        input.onSaved?.()
        discard()
        toast.success('Changes discarded')
        return true
      }

      const revisionId = await originRevisionId()

      if (revisionId === null) {
        toast.warn({
          title: 'Kept your changes',
          body: 'There is no earlier version of this lesson to go back to.',
        })
        discard()
        return false
      }

      const fresh = await api.post<PlayerNode>(`/revisions/${revisionId}/restore`)
      input.apply(fresh)
      input.onSaved?.()
      discard()
      toast.success('Changes discarded')
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not undo your changes.')
      return false
    } finally {
      cancelling.value = false
    }
  }

  /**
   * The revision Cancel goes back to. Usually the one the lesson was on when
   * editing began; a lesson written before revisions existed had none, and the
   * first save captured its pre-edit state, so on that path the oldest row is
   * the one to restore.
   */
  async function originRevisionId(): Promise<number | null> {
    if (startRevisionId !== null) return startRevisionId

    const list = await api.get<Array<{ id: number }>>(`/nodes/${id.value}/revisions`)

    return list[list.length - 1]?.id ?? null
  }

  /** Start again from the server's latest version, after a conflict. */
  async function reload(): Promise<void> {
    try {
      const fresh = await api.get<PlayerNode>(`/nodes/${id.value}`)
      input.apply(fresh)
      await nextTick()
      begin()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not reload this lesson.')
    }
  }

  /* -- Mutations ------------------------------------------------------------- */

  function find(key: string): DraftBlock | undefined {
    return draft.value?.blocks.find((block) => block.key === key)
  }

  function select(key: string | null): void {
    selectedKey.value = key
    selectionWas = key === null ? null : JSON.stringify(find(key)?.payload ?? null)
  }

  /**
   * Close the open block's editor, undoing what was typed into it. It goes
   * through `commit`, so Cancel is itself undoable — Ctrl-Z brings the typing
   * back — and the autosave that follows writes the block as it was.
   */
  function cancelSelection(): void {
    const key = selectedKey.value
    const was = selectionWas

    selectedKey.value = null
    selectionWas = null

    if (key === null || was === null) return

    const block = find(key)
    if (!block || JSON.stringify(block.payload) === was) return

    const payload = JSON.parse(was) as Record<string, unknown> | null
    if (payload === null) return

    commit((current) => {
      const target = current.blocks.find((item) => item.key === key)
      if (target) target.payload = payload
    })
  }

  function setTitle(value: string): void {
    commit((current) => {
      current.title = value
    }, 'title')
  }

  function setSummary(value: string): void {
    commit((current) => {
      current.summary = value
    }, 'summary')
  }

  function setMinutes(value: number): void {
    commit((current) => {
      current.estimated_minutes = Math.max(1, Math.min(600, Math.round(value) || 1))
    }, 'minutes')
  }

  function updatePayload(key: string, payload: Record<string, unknown>, field: string | null = null): void {
    commit(
      (current) => {
        const block = current.blocks.find((item) => item.key === key)
        if (block) block.payload = payload
      },
      field === null ? null : `${key}:${field}`,
    )
  }

  function insert(index: number, type: BlockType, payload: Record<string, unknown>): string {
    const key = `n${++counter}`

    commit((current) => {
      current.blocks.splice(Math.max(0, Math.min(index, current.blocks.length)), 0, {
        key,
        id: null,
        type,
        payload,
        source_material_ids: null,
      })
    })

    return key
  }

  function remove(key: string): void {
    commit((current) => {
      current.blocks = current.blocks.filter((block) => block.key !== key)
    })
    if (selectedKey.value === key) {
      selectedKey.value = null
      selectionWas = null
    }
  }

  function move(key: string, toIndex: number): void {
    commit((current) => {
      const from = current.blocks.findIndex((block) => block.key === key)
      if (from === -1) return
      const [block] = current.blocks.splice(from, 1)
      if (!block) return
      const target = Math.max(0, Math.min(toIndex, current.blocks.length))
      current.blocks.splice(target, 0, block)
    })
  }

  function shift(key: string, delta: number): void {
    const from = draft.value?.blocks.findIndex((block) => block.key === key) ?? -1
    if (from === -1) return
    move(key, from + delta)
  }

  function duplicate(key: string): string | null {
    const source = find(key)
    if (!source || !draft.value) return null

    const index = draft.value.blocks.indexOf(source)
    const payload = clone(source.payload)
    // A copy of a quiz would claim the same questions twice.
    if ('assessment_ids' in payload) payload.assessment_ids = []

    const created = insert(index + 1, source.type, payload)
    select(created)
    return created
  }

  /* -- Saving ---------------------------------------------------------------- */

  function schedule(): void {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void flush(), AUTOSAVE_MS)
  }

  /**
   * Send the draft. Returns whether the draft is now clean. New blocks get
   * their ids from the response by position — the endpoint keeps the order it
   * was given — matched through the snapshot that was sent, so typing while
   * the save is in flight cannot pair the wrong rows.
   */
  async function flush(): Promise<boolean> {
    if (timer) clearTimeout(timer)
    timer = undefined

    const current = draft.value
    if (!current) return true
    if (!dirty.value) return true
    if (saving.value || conflict.value) return false

    saving.value = true
    problem.value = null

    const sent = current.blocks.map((block) => block.key)

    const body = {
      title: current.title.trim() || input.node.value?.title || 'Untitled lesson',
      summary: current.summary.trim() === '' ? null : current.summary,
      estimated_minutes: current.estimated_minutes,
      base_revision_id: baseRevisionId,
      blocks: current.blocks.map((block) => ({
        id: block.id,
        type: block.type,
        payload: normalisePayload(block.type, block.payload),
        source_material_ids: block.source_material_ids,
      })),
    }

    const before = snapshot()

    try {
      const fresh = await api.patch<PlayerNode>(`/nodes/${id.value}`, body)
      const serverBlocks = sortedBlocks(fresh)

      if (draft.value) {
        const idByKey = new Map<string, number>()
        sent.forEach((key, index) => {
          const server = serverBlocks[index]
          if (server) idByKey.set(key, server.id)
        })

        for (const block of draft.value.blocks) {
          const assigned = idByKey.get(block.key)
          if (block.id === null && assigned !== undefined) {
            block.id = assigned
            if (selectedKey.value === block.key) selectedKey.value = `b${assigned}`
            block.key = `b${assigned}`
          }
        }

        // Rewriting the keys above changed the snapshot text; only the content
        // decides whether more typing happened meanwhile.
        dirty.value = snapshot() !== before && JSON.stringify(stripKeys(draft.value)) !== JSON.stringify(stripKeys(JSON.parse(before) as Draft))
      }

      baseRevisionId = fresh.current_revision_id ?? null
      persisted.value = true
      input.apply(fresh)
      savedAt.value = Date.now()
      input.onSaved?.()

      if (dirty.value) schedule()
      return !dirty.value
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        conflict.value = true
        toast.warn({
          title: 'This lesson changed elsewhere',
          body: 'Reload it to see the latest version before editing again.',
        })
      } else if (error instanceof ApiError && error.status === 422) {
        problem.value = firstError(error) ?? error.message
        toast.error({ title: 'Not saved', body: problem.value })
      } else {
        toast.error(error instanceof Error ? error.message : 'Could not save this lesson.')
        schedule()
      }
      return false
    } finally {
      saving.value = false
    }
  }

  function stripKeys(value: Draft): Omit<Draft, 'blocks'> & { blocks: Array<Omit<DraftBlock, 'key' | 'id'>> } {
    return {
      ...value,
      blocks: value.blocks.map(({ key: _key, id: _id, ...rest }) => rest),
    }
  }

  function firstError(error: ApiError): string | null {
    for (const messages of Object.values(error.errors)) {
      if (messages[0]) return messages[0]
    }
    return null
  }

  /* -- Rewrite with AI --------------------------------------------------------- */

  const pollers = new Map<number, ReturnType<typeof setTimeout>>()

  function isRewriting(key: string): boolean {
    const block = find(key)
    return !!block && block.id !== null && rewriting.value.includes(block.id)
  }

  /**
   * Ask the model to rewrite one block. Unsaved typing is saved first, so the
   * rewrite starts from what is on screen and a brand-new block has an id.
   */
  async function rewrite(key: string, instruction: string): Promise<boolean> {
    const block = find(key)
    if (!block) return false

    if (block.id === null || dirty.value) {
      const ok = await flush()
      if (!ok) return false
    }

    const saved = find(key) ?? draft.value?.blocks.find((item) => item.id === block.id)
    const blockId = saved?.id ?? block.id
    if (blockId === null) return false

    const steer = instruction.trim()

    try {
      await api.post(`/nodes/${id.value}/blocks/${blockId}/rewrite`, steer === '' ? {} : { instruction: steer })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start the rewrite.')
      return false
    }

    rewriting.value = [...rewriting.value, blockId]
    selectedKey.value = null
    selectionWas = null
    watchRewrite(blockId, Date.now() + REWRITE_DEADLINE_MS)
    return true
  }

  function watchRewrite(blockId: number, deadline: number): void {
    const existing = pollers.get(blockId)
    if (existing) clearTimeout(existing)

    pollers.set(
      blockId,
      setTimeout(() => void pollRewrite(blockId, deadline), REWRITE_POLL_MS),
    )
  }

  function settle(blockId: number): void {
    rewriting.value = rewriting.value.filter((item) => item !== blockId)
    const poller = pollers.get(blockId)
    if (poller) clearTimeout(poller)
    pollers.delete(blockId)
  }

  async function pollRewrite(blockId: number, deadline: number): Promise<void> {
    if (Date.now() > deadline) {
      settle(blockId)
      toast.warn({
        title: 'Still rewriting',
        body: 'This part is taking longer than usual. It will update here when it is done.',
      })
      return
    }

    try {
      const fresh = await api.get<PlayerNode>(`/nodes/${id.value}`)
      const server = (fresh.blocks ?? []).find((block) => block.id === blockId)

      if (!server) {
        settle(blockId)
        return
      }

      if (!server.rewriting) {
        settle(blockId)
        baseRevisionId = fresh.current_revision_id ?? null
        input.apply(fresh)

        if (draft.value) {
          // Kept in undo history: "Rewrite with AI" is a change you can take back.
          commit((current) => {
            const block = current.blocks.find((item) => item.id === blockId)
            if (!block) return
            block.payload = clone((server.payload ?? {}) as unknown as Record<string, unknown>)
            block.source_material_ids = server.source_material_ids ?? null
          })
          // The draft now matches the server for this block; nothing to save.
          dirty.value = false
          if (timer) clearTimeout(timer)
          timer = undefined
        }

        if (server.rewrite_error) {
          toast.error({ title: 'Could not rewrite that part', body: server.rewrite_error })
        } else {
          toast.success('Part rewritten')
          input.onSaved?.()
        }
        return
      }
    } catch {
      /* transient — keep polling */
    }

    watchRewrite(blockId, deadline)
  }

  /* -- Keyboard ----------------------------------------------------------------- */

  /** Ctrl/Cmd-Z and Shift-Z while editing. Bound by the view, not here. */
  function onKeydown(event: KeyboardEvent): void {
    if (!editing.value) return
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return
    if (event.key.toLowerCase() !== 'z') return

    const target = event.target as HTMLElement | null
    const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    // Inside a field the browser's own undo is the one people expect.
    if (typing) return

    event.preventDefault()
    if (event.shiftKey) redo()
    else undo()
  }

  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer)
    for (const poller of pollers.values()) clearTimeout(poller)
    if (dirty.value) void flush()
  })

  return {
    editing,
    draft,
    dirty,
    saving,
    savedAt,
    conflict,
    problem,
    selectedKey,
    canUndo,
    canRedo,
    rewriting,
    persisted,
    cancelling,
    changed,
    begin,
    finish,
    cancel,
    cancelSelection,
    discard,
    reload,
    flush,
    undo,
    redo,
    select,
    setTitle,
    setSummary,
    setMinutes,
    updatePayload,
    insert,
    remove,
    move,
    shift,
    duplicate,
    rewrite,
    isRewriting,
    onKeydown,
  }
}
