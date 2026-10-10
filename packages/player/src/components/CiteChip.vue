<script setup lang="ts">
// Citation chip "L4 · p.12": opens the one shared popover (CitePopover.vue) with the quoted passage.
// Blocks may use it directly: import CiteChip from '../components/CiteChip.vue'; <CiteChip :cite="c" />.
import { computed, inject } from 'vue';
import type { Cite } from '@bilimind/core';
import { COURSE_KEY } from '../course.ts';
import { citeLabel } from '../runtime/model.ts';
import { openCite } from '../runtime/ui.ts';

const props = defineProps<{ cite: Cite }>();
const course = inject(COURSE_KEY, null);
const label = computed(() => (course ? citeLabel(course, props.cite) : props.cite.locator || props.cite.file));
function open(e: MouseEvent) { openCite(props.cite, e.currentTarget as HTMLElement); }
</script>

<template>
  <button type="button" class="cite" aria-haspopup="dialog" aria-expanded="false" :aria-label="`Source: ${label}`" @click.stop="open">
    <i><svg aria-hidden="true"><use href="#i-file" /></svg></i>{{ label }}
  </button>
</template>
