<script setup lang="ts">
import type { KeyPointsBlock } from '~/types/api'
import BlockShell from './BlockShell.vue'

/**
 * The summary. Rules between rows rather than a box around them: these are the
 * takeaways from the surrounding prose, not a separate object, and boxing them
 * invites skipping straight here.
 */
const props = defineProps<{ block: KeyPointsBlock }>()

const { renderInline } = useMarkdown()

const points = computed(() =>
  (props.block.payload?.points ?? [])
    .filter((point): point is string => typeof point === 'string' && point.trim() !== '')
    .map((point) => renderInline(point.trim())),
)
</script>

<template>
  <BlockShell
    :type="block.type"
    :source-material-ids="block.source_material_ids"
  >
    <ul
      v-if="points.length"
      class="flex flex-col"
    >
      <li
        v-for="(point, index) in points"
        :key="index"
        class="flex items-start gap-3.5 border-t border-border-rule py-3 text-[15px] leading-[1.55] text-text-body first:border-t-0 first:pt-1"
      >
        <!-- The course player's numbered ink square: a key point is a thing to
             keep, and a count makes "five of them" visible before reading. -->
        <span
          class="mt-px grid h-[22px] w-[26px] shrink-0 place-items-center rounded-[7px] bg-chip font-display text-[11px] font-semibold text-accent"
          aria-hidden="true"
          >{{ String(index + 1).padStart(2, '0') }}</span
        >
        <span
          class="md min-w-0"
          v-html="point"
        />
      </li>
    </ul>
    <p
      v-else
      class="text-[13px] text-text-faint italic"
    >
      No key points were generated for this lesson.
    </p>
  </BlockShell>
</template>

<style scoped>
.md :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.87em;
  padding: 1px 6px;
  border-radius: var(--radius-xs);
  background: var(--surface-sunken);
  color: var(--text);
}

.md :deep(strong) {
  color: var(--text);
  font-weight: 600;
}

.md :deep(a) {
  color: var(--brand);
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
