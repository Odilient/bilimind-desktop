import type { DiffToken, Revision, RevisionDetail } from '~/types/api'
import type { PlayerNode } from '~/composables/useNodePlayer'

/**
 * EDIT — a lesson's history, as the History panel and the preview need it.
 *
 * The list is cheap (no snapshots) and is refetched whenever the node's
 * current revision changes, so an autosave shows up in the panel without a
 * button. A revision's content is fetched when it is opened, and its field
 * diffs one at a time when a reader asks to see one.
 */
export function useRevisions(nodeId: MaybeRefOrGetter<number | null>) {
  const api = useApi()
  const toast = useToast()

  const id = computed(() => toValue(nodeId))

  const revisions = ref<Revision[]>([])
  const loading = ref(false)
  const failed = ref<string | null>(null)

  const detail = ref<RevisionDetail | null>(null)
  const opening = ref<number | null>(null)
  const restoring = ref(false)

  async function load(): Promise<void> {
    if (!id.value) {
      revisions.value = []
      return
    }

    loading.value = true
    failed.value = null

    try {
      revisions.value = await api.get<Revision[]>(`/nodes/${id.value}/revisions`)
    } catch (error) {
      failed.value = error instanceof Error ? error.message : 'Could not load the history.'
    } finally {
      loading.value = false
    }
  }

  async function open(revisionId: number): Promise<RevisionDetail | null> {
    opening.value = revisionId

    try {
      const loaded = await api.get<RevisionDetail>(`/revisions/${revisionId}`)
      detail.value = loaded
      return loaded
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not open that version.')
      return null
    } finally {
      opening.value = null
    }
  }

  function close(): void {
    detail.value = null
  }

  async function fieldDiff(revisionId: number, blockId: number, field: string): Promise<DiffToken[]> {
    const result = await api.get<{ tokens: DiffToken[] }>(`/revisions/${revisionId}/field`, {
      query: { block: blockId, field },
    })
    return result.tokens
  }

  async function restore(revisionId: number): Promise<PlayerNode | null> {
    if (restoring.value) return null
    restoring.value = true

    try {
      const node = await api.post<PlayerNode>(`/revisions/${revisionId}/restore`)
      detail.value = null
      await load()
      toast.success('Version restored')
      return node
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not restore that version.')
      return null
    } finally {
      restoring.value = false
    }
  }

  watch(id, () => {
    detail.value = null
    void load()
  })

  return {
    revisions,
    loading,
    failed,
    detail,
    opening,
    restoring,
    load,
    open,
    close,
    fieldDiff,
    restore,
  }
}
