<script setup lang="ts">
// Key points: the lesson in a handful of lines, numbered ink tiles with lime numerals (the terms look).
import { computed, ref } from 'vue';
import type { Course, CourseLesson } from '@bilimind/core';
import type { BlockOf } from './types.ts';
import BlockHead from './reading/BlockHead.vue';
import CiteChips from './reading/CiteChips.vue';
import { renderInline } from './reading/markdown.ts';
import { useCues } from './reading/cues.ts';
import './reading/reading.css';

const props = defineProps<{ block: BlockOf<'key_points'>; lesson: CourseLesson; course: Course }>();
const root = ref<HTMLElement | null>(null);
useCues(root, () => props.block);
const points = computed(() => (props.block.payload?.points ?? []).map(p => renderInline(p)));
</script>

<template>
  <section ref="root" class="blk card blk-kp" :data-block="block.id" data-type="key_points">
    <BlockHead type="key_points" :title="block.title">
      <template #act><span class="tag">{{ points.length }} {{ points.length === 1 ? 'point' : 'points' }}</span></template>
    </BlockHead>
    <ol class="kp">
      <li v-for="(p, i) in points" :key="i"><div class="kp-t" :data-field="`points.${i}`" v-html="p" /></li>
    </ol>
    <CiteChips :cites="block.cites" :course="course" />
  </section>
</template>
