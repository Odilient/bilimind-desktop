<script setup lang="ts">
import type { AnalogyBlock } from '~/types/api'
import BlockShell from './BlockShell.vue'
import Markdown from './Markdown.vue'

/**
 * EXPAND §2/§6 — a comparison to something the learner already knows.
 *
 * The analogy itself is plain prose, at the same size as the explainer around
 * it, because it is prose. What gets the box is `breaks_down_when`: an analogy
 * without its limit is a misconception that takes years to unlearn, so the
 * limit is the part that must survive skimming. The backend refuses to persist
 * an analogy that lacks it, so this field is always here.
 */
defineProps<{ block: AnalogyBlock }>()
</script>

<template>
  <BlockShell
    :type="block.type"
    :source-material-ids="block.source_material_ids"
  >
    <Markdown
      v-if="block.payload?.markdown"
      :source="block.payload.markdown"
    />

    <!-- Where the picture stops being true, in cobalt: a correction to the
         analogy, not to the learner, so it is the calm colour and not coral. -->
    <div
      v-if="block.payload?.breaks_down_when"
      class="mt-4 flex gap-3.5 rounded-[16px] bg-brand-soft px-4 py-4"
    >
      <span class="grid size-8 shrink-0 place-items-center rounded-[10px] bg-brand text-white">
        <UiIcon
          name="warning"
          :size="15"
          :stroke="2"
        />
      </span>
      <div class="min-w-0">
        <p class="eyebrow-loud mb-1.5 text-brand">Where the analogy breaks down</p>
        <p class="text-[14.5px] leading-relaxed text-text-body">
          {{ block.payload.breaks_down_when }}
        </p>
      </div>
    </div>
  </BlockShell>
</template>
