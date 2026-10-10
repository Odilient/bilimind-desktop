<script setup lang="ts">
// The shell's frame around every block: an anchor (#bf-<id>), the wide measure for wide formats,
// the block's source chips (unless the block renders its own .cite chips), and an error boundary so
// one broken block never blanks the lesson.
import { computed, nextTick, onErrorCaptured, onMounted, ref } from 'vue';
import type { Course, CourseBlock, CourseLesson } from '@bilimind/core';
import { blockComponent } from '../blocks/registry.ts';
import CiteChip from './CiteChip.vue';

const props = defineProps<{ block: CourseBlock; lesson: CourseLesson; course: Course }>();
const WIDE = new Set(['diagram', 'comparison', 'playground', 'reference_table']);
const wide = computed(() => WIDE.has(props.block.type));
const failed = ref(false);
const el = ref<HTMLElement | null>(null);
const ownCites = ref(false);
const cites = computed(() => props.block.cites.filter(c => c && c.quote));

onErrorCaptured((err) => {
  console.warn(`[bilimind] block ${props.block.id} (${props.block.type}) failed to render:`, err);
  failed.value = true;
  return false;
});
onMounted(() => nextTick(() => {
  const root = el.value;
  if (!root) return;
  ownCites.value = Array.from(root.querySelectorAll('.cite')).some(c => !c.closest('.bf-cites'));
}));
</script>

<template>
  <div :id="`bf-${block.id}`" ref="el" class="bf" :class="{ wide }" :data-frame="block.id" :data-type="block.type">
    <div v-if="failed" class="bf-err">This part could not be shown. The rest of the lesson is fine.</div>
    <component :is="blockComponent(block.type)" v-else :block="block" :lesson="lesson" :course="course" />
    <div v-if="cites.length && !ownCites && !failed" class="bf-cites"><span>From your files</span><CiteChip v-for="(c, i) in cites" :key="i" :cite="c" /></div>
  </div>
</template>
