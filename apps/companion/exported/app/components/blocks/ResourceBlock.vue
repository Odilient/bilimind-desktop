<script setup lang="ts">
import type { ResearchedResource, ResourceBlock } from '~/types/api'
import { spansRow } from '~/utils/resourceLayout'
import BlockShell from './BlockShell.vue'
import ResourceCard from './ResourceCard.vue'

/**
 * EXPAND §3/§6 — links that go somewhere.
 *
 * Every item here came from the research stage, which searched, then fetched the
 * URL and kept only what answered. The old `search_query` fallback is gone: the
 * generator is no longer allowed to write a URL at all, so a block that reaches
 * this component has real, checked addresses in it or does not exist.
 *
 * Articles are lines and videos are players, and both take the whole row —
 * a reading list is scanned top to bottom, and a player half a column wide is
 * a player nobody can read the captions in. Only the covered things (docs, a
 * book, a tool) share a row, two-up once the lesson column can afford it: a
 * container query, not a viewport one, because the column is what narrows
 * when the assistant docks.
 */
const props = defineProps<{ block: ResourceBlock }>()

const items = computed<ResearchedResource[]>(() =>
  (props.block.payload?.items ?? []).filter(
    (item): item is ResearchedResource =>
      Boolean(item) && typeof item === 'object' && typeof item.url === 'string',
  ),
)

const note = computed(() => {
  const raw = props.block.payload?.note
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null
})
</script>

<template>
  <BlockShell
    :type="block.type"
    :source-material-ids="block.source_material_ids"
  >
    <div
      v-if="items.length"
      class="@container"
    >
      <ul class="grid grid-cols-1 gap-3 @lg:grid-cols-2">
        <li
          v-for="(item, index) in items"
          :key="item.resource_id ?? index"
          :class="spansRow(item) && '@lg:col-span-2'"
        >
          <ResourceCard :item="item" />
        </li>
      </ul>

      <p
        v-if="note"
        class="mt-3 text-[12.5px] leading-relaxed text-text-muted"
      >
        {{ note }}
      </p>
    </div>

    <p
      v-else
      class="text-[13px] text-text-faint italic"
    >
      No further reading was found for this lesson.
    </p>
  </BlockShell>
</template>
