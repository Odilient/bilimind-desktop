/**
 * Where a board's Y.Doc lives: IndexedDB on the device, and the item's update
 * log on the server (`GET /items/{id}/doc`, `POST /items/{id}/updates`, through
 * the repo, as pages do).
 *
 * The device copy loads first, so a board opens offline and instantly. The
 * server's snapshot and updates are merged in after; Yjs makes applying an
 * update twice harmless, so there is nothing to reconcile. Local edits are
 * batched for a moment and pushed as one merged update. If the push fails,
 * the batch waits in localStorage and goes out on the next `online` event, the
 * next retry, or the next time the board opens, whichever comes first.
 *
 * A load can also come back short: PowerSync answering offline for a board
 * this device never synced (`DocState.complete === false`), or no server at
 * all. An empty doc then proves nothing, so `complete` stays false, the load
 * is retried until it isn't, and nothing may set a template out meanwhile.
 */
import { ref, type Ref } from 'vue'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import type { CompanionRepo } from '../repo'
import { boardParts, type BoardParts } from './model'

/** The origin of updates that came from the server, so they aren't pushed back. */
export const REMOTE = { remote: true }

export type SyncState = 'loading' | 'saved' | 'saving' | 'offline'

export function toBase64(u: Uint8Array): string {
  let s = ''
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}

export function fromBase64(b: string): Uint8Array {
  const s = atob(b)
  const u = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i)
  return u
}

const pendingKey = (id: string) => `bm:board-pending:${id}`
const PUSH_DELAY = 700
const RETRY_MS = 15_000

export interface BoardSync {
  doc: Y.Doc
  parts: BoardParts
  /** The device copy is in. */
  local: Promise<void>
  /** The server's copy is in too, or it was unreachable. */
  ready: Promise<void>
  /** The doc holds everything the server has: an empty one really is empty. */
  complete: Ref<boolean>
  /** Resolves on the first complete load, however many retries that takes. */
  whenComplete: Promise<void>
  state: Ref<SyncState>
  /** Push whatever is queued now (before leaving the page). */
  flush(): Promise<void>
  destroy(): void
}

export function openBoard(id: string, repo: CompanionRepo): BoardSync {
  const doc = new Y.Doc()
  const parts = boardParts(doc)
  const state = ref<SyncState>('loading')
  const idb = import.meta.client && 'indexedDB' in window ? new IndexeddbPersistence(`bm-board:${id}`, doc) : null

  let queue: Uint8Array[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  let retry: ReturnType<typeof setInterval> | null = null
  let pushing = false
  let destroyed = false

  function remember() {
    try {
      if (queue.length) localStorage.setItem(pendingKey(id), toBase64(Y.mergeUpdates(queue)))
      else localStorage.removeItem(pendingKey(id))
    } catch {
      // Private mode or a full quota: the queue still lives in memory and in IndexedDB.
    }
  }

  async function flush() {
    if (timer) clearTimeout(timer)
    timer = null
    if (pushing || !queue.length) return
    pushing = true
    const merged = Y.mergeUpdates(queue)
    queue = []
    state.value = 'saving'
    try {
      await repo.pushDocUpdate(id, toBase64(merged))
      state.value = queue.length ? 'saving' : 'saved'
      remember()
    } catch {
      queue.unshift(merged)
      remember()
      state.value = 'offline'
    } finally {
      pushing = false
    }
    if (queue.length && state.value !== 'offline') schedule()
  }

  function schedule() {
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, PUSH_DELAY)
  }

  const onUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE || origin === idb || destroyed) return
    queue.push(update)
    remember()
    schedule()
  }
  doc.on('update', onUpdate)

  const complete = ref(false)
  let markComplete = () => {}
  const whenComplete = new Promise<void>((resolve) => (markComplete = resolve))
  let loading = false

  /** Merge the server's copy in; true once a load was complete. */
  async function loadRemote(): Promise<boolean> {
    if (loading || complete.value || destroyed) return complete.value
    loading = true
    try {
      const remote = await repo.pageDoc(id)
      doc.transact(() => {
        if (remote.snapshot) Y.applyUpdate(doc, fromBase64(remote.snapshot), REMOTE)
        for (const u of remote.updates) Y.applyUpdate(doc, fromBase64(u.update), REMOTE)
      }, REMOTE)
      if (state.value === 'loading' || state.value === 'offline') state.value = 'saved'
      if (remote.complete !== false) {
        complete.value = true
        markComplete()
      }
    } catch {
      state.value = 'offline'
    } finally {
      loading = false
    }
    return complete.value
  }

  const onOnline = () => {
    void flush()
    void loadRemote()
  }
  if (import.meta.client) {
    window.addEventListener('online', onOnline)
    retry = setInterval(() => {
      if (queue.length && state.value === 'offline') void flush()
      if (!complete.value) void loadRemote()
    }, RETRY_MS)
  }

  const local = (async () => {
    if (idb) await idb.whenSynced
    try {
      const left = localStorage.getItem(pendingKey(id))
      if (left) queue.push(fromBase64(left))
    } catch {
      // Nothing left over, or no storage to have left it in.
    }
  })()

  const ready = (async () => {
    await local
    await loadRemote()
    if (queue.length) await flush()
  })()

  return {
    doc,
    parts,
    local,
    ready,
    complete,
    whenComplete,
    state,
    flush,
    destroy() {
      destroyed = true
      if (timer) clearTimeout(timer)
      if (retry) clearInterval(retry)
      if (import.meta.client) window.removeEventListener('online', onOnline)
      void flush().finally(() => {
        doc.off('update', onUpdate)
        void idb?.destroy()
        doc.destroy()
      })
    },
  }
}

/**
 * Write a board that was just built (from a template) to both homes at once,
 * before anyone opens it: the server gets it as the first update in the log,
 * the device as its IndexedDB copy.
 */
export async function seedBoard(id: string, doc: Y.Doc, repo: CompanionRepo): Promise<void> {
  const update = Y.encodeStateAsUpdate(doc)
  if (import.meta.client && 'indexedDB' in window) {
    const copy = new Y.Doc()
    Y.applyUpdate(copy, update)
    const idb = new IndexeddbPersistence(`bm-board:${id}`, copy)
    await idb.whenSynced
    await idb.destroy()
    copy.destroy()
  }
  try {
    await repo.pushDocUpdate(id, toBase64(update))
  } catch {
    try {
      localStorage.setItem(pendingKey(id), toBase64(update))
    } catch {
      // The device copy above still holds it; the next open pushes the doc's state.
    }
  }
}
