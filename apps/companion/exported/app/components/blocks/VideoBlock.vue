<script setup lang="ts">
import type { ResearchedResource, VideoBlock } from '~/types/api'
import BlockShell from './BlockShell.vue'
import ResourceCard from './ResourceCard.vue'

/**
 * EXPAND §3/§6 — a real video, in a real player.
 *
 * This block used to ship a search query, because SPEC forbade the generator from
 * inventing a URL and it had no other way to get one. The research stage removed
 * that constraint: every item here came back from the YouTube Data API, was checked
 * for `status.embeddable`, and carries the `videoId` the IFrame player needs.
 *
 * The player is always there — see ResourceCard for why the poster went away. A
 * video that cannot be embedded (rare: the uploader switched it off after we
 * checked) draws as a card with its thumbnail and opens on YouTube.
 */
const props = defineProps<{ block: VideoBlock }>()

const items = computed<ResearchedResource[]>(() =>
  (props.block.payload?.items ?? []).filter(
    (item): item is ResearchedResource =>
      Boolean(item) && typeof item === 'object' && typeof item.url === 'string',
  ),
)

/**
 * Where the first video starts. The timestamp belongs to the video the generator
 * was pointing at, which is the first one; the others are alternatives and start
 * where they start. Validation of the raw value lives in ResourceCard.
 */
const startSeconds = computed(() => props.block.payload?.start_seconds ?? null)
</script>

<template>
  <BlockShell
    :type="block.type"
    :source-material-ids="block.source_material_ids"
  >
    <ul
      v-if="items.length"
      class="flex flex-col gap-4"
    >
      <li
        v-for="(item, index) in items"
        :key="item.resource_id ?? index"
      >
        <ResourceCard
          :item="item"
          :start="index === 0 ? startSeconds : null"
        />
      </li>
    </ul>

    <p
      v-else
      class="text-[13px] text-text-faint italic"
    >
      No video was found for this lesson.
    </p>
  </BlockShell>
</template>
