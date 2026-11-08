import type { CompanionStore } from '../../store'
import { fetchFileUrl, knownFileUrl, type WithFileUrl } from '../../files'

/**
 * The link an image or file block shows, resolved when it's drawn rather than
 * trusted from the document: the API's links are signed and expire, so the one
 * saved when the file was added is a fallback.
 */
export function useFileUrl(store: CompanionStore, itemId: () => string | null, saved: () => string | null) {
  const asked = ref<string | null>(null)
  const item = computed(() => store.get('items', itemId()) as WithFileUrl | null)
  const url = computed(() => (item.value ? knownFileUrl(item.value) : null) ?? asked.value ?? saved())

  watch(
    item,
    async (row) => {
      if (row && !knownFileUrl(row)) asked.value = await fetchFileUrl(row)
    },
    { immediate: true },
  )

  return url
}
