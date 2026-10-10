<script setup lang="ts">
// Analogy (player-design §5.2): the comparison in prose, then a `tip` callout "Where the analogy breaks".
import { computed, ref } from 'vue';
import type { Course, CourseLesson } from '@bilimind/core';
import type { BlockOf } from './types.ts';
import BlockHead from './reading/BlockHead.vue';
import CiteChips from './reading/CiteChips.vue';
import Icon from './reading/Icon.vue';
import { renderMarkdown } from './reading/markdown.ts';
import { useCues } from './reading/cues.ts';
import './reading/reading.css';

const props = defineProps<{ block: BlockOf<'analogy'>; lesson: CourseLesson; course: Course }>();
const root = ref<HTMLElement | null>(null);
useCues(root, () => props.block);
const body = computed(() => renderMarkdown(props.block.payload?.markdown ?? ''));
const breaks = computed(() => renderMarkdown(props.block.payload?.breaks_down_when ?? ''));
</script>

<template>
  <section ref="root" class="blk card blk-analogy" :data-block="block.id" data-type="analogy">
    <BlockHead type="analogy" :title="block.title" />
    <div class="prose an-body" data-field="markdown" v-html="body" />
    <aside v-if="block.payload?.breaks_down_when" class="callout tip">
      <span class="ci"><Icon name="i-warning" /></span>
      <div><div class="ce">Where the analogy breaks</div><div class="prose" data-field="breaks_down_when" v-html="breaks" /></div>
    </aside>
    <CiteChips :cites="block.cites" :course="course" />
  </section>
</template>
