import * as Y from 'yjs'
import type { CompanionRepo } from '../repo'
import { attachDocPersistence, type DocPersistence, type DocStatus } from './persistence'

/**
 * One live Y.Doc for an item, loaded and kept saved.
 *
 *   const { ydoc, status } = useDoc(() => route.params.id, repo)
 *
 * `ydoc` stays null until the server's state and the local copy are both in,
 * so an editor bound to it never starts on an empty document and then jumps.
 * Changing the id tears the old document down (pushing what's left) and opens
 * the new one. Pages use it; boards can use it the same way.
 */
export function useDoc(itemId: MaybeRefOrGetter<string | null | undefined>, repo: CompanionRepo) {
  const ydoc = shallowRef<Y.Doc | null>(null)
  const status = ref<DocStatus>('loading')
  const reachedServer = ref(false)

  let current: DocPersistence | null = null
  let stopStatus: (() => void) | null = null
  let generation = 0

  function teardown(): void {
    stopStatus?.()
    stopStatus = null
    current?.destroy()
    current = null
    const doc = ydoc.value
    ydoc.value = null
    // Let anything bound to it (the editor) unbind first.
    if (doc) queueMicrotask(() => doc.destroy())
  }

  watch(
    () => toValue(itemId),
    async (id) => {
      const mine = ++generation
      teardown()
      status.value = 'loading'
      if (!id || !import.meta.client) return

      const doc = new Y.Doc()
      const persistence = attachDocPersistence(repo, id, doc)
      current = persistence
      stopStatus = watch(
        [persistence.status, persistence.reachedServer],
        ([s, reached]) => {
          status.value = s
          reachedServer.value = reached
        },
        { immediate: true },
      )

      await persistence.ready
      if (mine !== generation) return
      ydoc.value = doc
    },
    { immediate: true },
  )

  if (getCurrentScope()) onScopeDispose(teardown)

  return {
    ydoc,
    status: readonly(status),
    reachedServer: readonly(reachedServer),
    flush: () => current?.flush() ?? Promise.resolve(),
  }
}
