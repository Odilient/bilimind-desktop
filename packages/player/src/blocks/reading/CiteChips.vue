<script setup lang="ts">
// The block's source chips, inside the card footer (player-design §5.17). Each chip is the shell's
// CiteChip, so every chip in the player opens the ONE shared popover (components/CitePopover.vue) with
// the quote marked in the excerpt and "Open page N". Because these chips render inside the block,
// the shell's BlockFrame does not add its own row under the card (it checks for `.cite`).
import { computed } from 'vue';
import type { Cite, Course } from '@bilimind/core';
import CiteChip from '../../components/CiteChip.vue';

const props = defineProps<{ cites: readonly Cite[]; course: Course; label?: string }>();
const list = computed(() => (props.cites ?? []).filter(c => c && c.quote));
</script>

<template>
  <div v-if="list.length" class="blk-foot cites-row">
    <span class="cites-l">{{ label ?? 'From your files' }}</span>
    <CiteChip v-for="(c, i) in list" :key="i" :cite="c" />
  </div>
</template>
