<script setup lang="ts">
// Example: a concrete case in prose, framed as a card with the "Example" eyebrow and its own title.
import { computed, ref } from 'vue';
import type { Course, CourseLesson } from '@bilimind/core';
import type { BlockOf } from './types.ts';
import BlockHead from './reading/BlockHead.vue';
import CiteChips from './reading/CiteChips.vue';
import { renderMarkdown } from './reading/markdown.ts';
import { useCues } from './reading/cues.ts';
import './reading/reading.css';

const props = defineProps<{ block: BlockOf<'example'>; lesson: CourseLesson; course: Course }>();
const root = ref<HTMLElement | null>(null);
useCues(root, () => props.block);
const title = computed(() => props.block.title || props.block.payload?.title || null);
const body = computed(() => renderMarkdown(props.block.payload?.markdown ?? '', { dropHeading: title.value ?? undefined }));
</script>

<template>
  <section ref="root" class="blk card blk-example" :data-block="block.id" data-type="example">
    <BlockHead type="example" :title="title" />
    <div class="ex-body"><div class="prose" data-field="markdown" v-html="body" /></div>
    <CiteChips :cites="block.cites" :course="course" />
  </section>
</template>
