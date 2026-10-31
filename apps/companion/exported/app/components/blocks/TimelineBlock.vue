<script setup lang="ts">
import type { TimelineBlock } from '~/types/api'
import BlockShell from './BlockShell.vue'

/**
 * EXPAND §2/§6 — how something got to be the way it is.
 *
 * `when` is a free-text string, not a date: a timeline may span "1970s", "v2.0"
 * and "after the 2016 outage" in the same lesson, and forcing those into a date
 * type would either lose them or invent precision that was never there.
 */
defineProps<{ block: TimelineBlock }>()
</script>

<template>
  <BlockShell
    :type="block.type"
    :source-material-ids="block.source_material_ids"
  >
    <ol
      v-if="block.payload?.events?.length"
      class="flex flex-col"
    >
      <li
        v-for="(event, index) in block.payload.events"
        :key="index"
        class="relative grid grid-cols-[minmax(52px,auto)_14px_minmax(0,1fr)] gap-x-3.5 pb-5 last:pb-0"
      >
        <!-- The course player's timeline: the date in cobalt on the left, a
             lime bead on a grey spine, the event to the right. -->
        <p
          class="num pt-px text-right font-display text-[15px] font-semibold tracking-[-0.02em] text-brand tabular-nums"
        >
          {{ event.when }}
        </p>

        <span
          class="relative flex justify-center"
          aria-hidden="true"
        >
          <span
            v-if="index < block.payload.events.length - 1"
            class="absolute top-4 -bottom-5 w-[2px] rounded-full bg-surface-track"
          />
          <span class="relative z-10 mt-1 size-3 rounded-full bg-lime-2 ring-3 ring-surface" />
        </span>

        <div class="min-w-0">
          <p class="font-display text-[16px] leading-snug font-semibold tracking-[-0.015em]">
            {{ event.title }}
          </p>
          <p
            v-if="event.detail"
            class="mt-1 text-[14px] leading-relaxed text-text-soft"
          >
            {{ event.detail }}
          </p>
        </div>
      </li>
    </ol>

    <p
      v-else
      class="text-[13px] text-text-faint italic"
    >
      No timeline was generated for this lesson.
    </p>
  </BlockShell>
</template>
