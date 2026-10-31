import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import type { CompanionRepo } from '../repo'
import { fromBase64, toBase64 } from './base64'

/**
 * Keeps one Y.Doc (a page's or a board's) in step with the server and with the
 * browser's own copy.
 *
 * Three places hold the document, and each has one job:
 *  - the server (`items.snapshot` plus the `item_updates` log) is the record;
 *  - IndexedDB (y-indexeddb) makes a reload, or a train with no signal, show
 *    the page instantly and keep every keystroke;
 *  - the in-memory Y.Doc is what the editor binds to.
 *
 * Loading applies the server's state first and the local copy second. Yjs
 * merges in any order, so what matters is only the comparison afterwards: if
 * the local copy holds anything the server doesn't (typed offline, or the tab
 * closed before the last push), that difference is pushed straight away. Then
 * every local edit is batched, merged into one update and pushed after a short
 * pause, so typing a paragraph costs one request, not forty.
 *
 * Nothing here knows about ProseMirror, so boards reuse it as is.
 */

/** Marks updates that came from the server, so they're never pushed back. */
export const REMOTE_ORIGIN = Symbol('companion-doc-remote')

export type DocStatus = 'loading' | 'saving' | 'saved' | 'offline'

export interface DocPersistenceOptions {
  /** Pause after the last edit before pushing. */
  debounceMs?: number
  /** Push at least this often while someone types without pausing. */
  maxWaitMs?: number
  /** Skip IndexedDB (tests, or a browser that blocks it). */
  local?: boolean
}

export interface DocPersistence {
  readonly ydoc: Y.Doc
  readonly status: Ref<DocStatus>
  /**
   * True when the load holds everything the server has for this document: the
   * server answered, and didn't say its answer was partial (`complete: false`,
   * PowerSync offline for a doc this device never synced). Only then may a
   * page be set out; otherwise the editor opens on what's local, typing still
   * works and merges, and the set-out waits for the first complete load.
   */
  readonly reachedServer: Ref<boolean>
  /** Resolves once the server's state and the local copy are both applied. */
  readonly ready: Promise<void>
  /** Push whatever is queued now. */
  flush(): Promise<void>
  /** Stop listening, push what's left, close IndexedDB. The Y.Doc is the caller's. */
  destroy(): void
}

/** IndexedDB's name for one document. */
export function localDocName(itemId: string): string {
  return `bm-doc:${itemId}`
}

/** A Y.Doc holding exactly what the server has. */
export function docFromState(state: { snapshot: string | null; updates: { update: string }[] }): Y.Doc {
  const doc = new Y.Doc()
  if (state.snapshot) Y.applyUpdate(doc, fromBase64(state.snapshot))
  for (const row of state.updates) Y.applyUpdate(doc, fromBase64(row.update))
  return doc
}

/** y-indexeddb never settles where IndexedDB is blocked; don't hang the page on it. */
function settleWithin<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))])
}

export function attachDocPersistence(
  repo: CompanionRepo,
  itemId: string,
  ydoc: Y.Doc,
  options: DocPersistenceOptions = {},
): DocPersistence {
  const debounceMs = options.debounceMs ?? 700
  const maxWaitMs = options.maxWaitMs ?? 4000
  const useLocal = (options.local ?? true) && typeof indexedDB !== 'undefined'

  const status = ref<DocStatus>('loading')
  const reachedServer = ref(false)

  let local: IndexeddbPersistence | null = null
  let queue: Uint8Array[] = []
  let firstQueuedAt = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let failures = 0
  let inflight: Promise<void> | null = null
  let destroyed = false

  function schedule(): void {
    if (timer) clearTimeout(timer)
    const waited = Date.now() - firstQueuedAt
    timer = setTimeout(() => void flush(), Math.max(0, Math.min(debounceMs, maxWaitMs - waited)))
  }

  function enqueue(update: Uint8Array): void {
    if (!queue.length) firstQueuedAt = Date.now()
    queue.push(update)
    if (status.value !== 'offline') status.value = 'saving'
    if (!retryTimer) schedule()
  }

  function flush(): Promise<void> {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (inflight) return inflight.then(() => (queue.length ? flush() : undefined))
    if (!queue.length) return Promise.resolve()

    const batch = queue
    queue = []
    const merged = batch.length === 1 ? batch[0]! : Y.mergeUpdates(batch)

    inflight = repo
      .pushDocUpdate(itemId, toBase64(merged))
      .then(() => {
        failures = 0
        status.value = queue.length ? 'saving' : 'saved'
      })
      .catch(() => {
        // Keep the edit at the front of the line and try again later. The local
        // copy already has it, so even closing the tab now loses nothing: the
        // next load finds the difference and pushes it.
        queue.unshift(merged)
        failures++
        status.value = 'offline'
        if (!destroyed && !retryTimer) {
          const wait = Math.min(30_000, 1000 * 2 ** Math.min(failures, 5))
          retryTimer = setTimeout(() => {
            retryTimer = null
            void flush()
          }, wait)
        }
      })
      .finally(() => {
        inflight = null
        if (queue.length && !retryTimer && !destroyed) schedule()
      })

    return inflight
  }

  function onUpdate(update: Uint8Array, origin: unknown): void {
    // The server's own state, and the local copy replaying itself, are not edits.
    if (origin === REMOTE_ORIGIN || (local && origin === local)) return
    enqueue(update)
  }

  function onHidden(): void {
    if (document.visibilityState === 'hidden') void flush()
  }

  async function load(): Promise<void> {
    let serverDoc: Y.Doc | null = null

    try {
      const state = await repo.pageDoc(itemId)
      serverDoc = docFromState(state)
      reachedServer.value = state.complete !== false
      Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(serverDoc), REMOTE_ORIGIN)
    } catch {
      reachedServer.value = false
    }

    if (useLocal && !destroyed) {
      try {
        local = new IndexeddbPersistence(localDocName(itemId), ydoc)
        await settleWithin(local.whenSynced, 2500)
      } catch {
        local = null
      }
    }

    if (destroyed) return

    ydoc.on('update', onUpdate)

    if (serverDoc) {
      // Anything the local copy knows that the server doesn't goes up now.
      // Comparing snapshots (state vector plus delete set) rather than update
      // length: an update always carries the whole delete set, so it is never
      // empty once anything was ever deleted.
      if (!Y.equalSnapshots(Y.snapshot(ydoc), Y.snapshot(serverDoc))) {
        enqueue(Y.encodeStateAsUpdate(ydoc, Y.encodeStateVector(serverDoc)))
        await flush()
      } else {
        status.value = 'saved'
      }
      serverDoc.destroy()
    } else {
      status.value = 'offline'
    }

    if (import.meta.client) {
      document.addEventListener('visibilitychange', onHidden)
      window.addEventListener('pagehide', flushNow)
    }
  }

  function flushNow(): void {
    void flush()
  }

  const ready = load()

  return {
    ydoc,
    status,
    reachedServer,
    ready,
    flush,
    destroy() {
      if (destroyed) return
      destroyed = true
      ydoc.off('update', onUpdate)
      if (retryTimer) clearTimeout(retryTimer)
      retryTimer = null
      void flush()
      if (import.meta.client) {
        document.removeEventListener('visibilitychange', onHidden)
        window.removeEventListener('pagehide', flushNow)
      }
      // Closes the database; the stored document stays for the next visit.
      void local?.destroy()
      local = null
    },
  }
}
