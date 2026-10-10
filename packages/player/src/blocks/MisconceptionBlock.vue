<script setup lang="ts">
// Misconception (player-design §5.2): the wrong belief as quiet reported speech, why it seems right in
// small type, then the `truth` callout as the one loud element (what must survive skimming).
import { computed, ref } from 'vue';
import type { Course, CourseLesson } from '@bilimind/core';
import type { BlockOf } from './types.ts';
import BlockHead from './reading/BlockHead.vue';
import CiteChips from './reading/CiteChips.vue';
import Icon from './reading/Icon.vue';
import { renderInline, renderMarkdown } from './reading/markdown.ts';
import { useCues } from './reading/cues.ts';
import './reading/reading.css';

const props = defineProps<{ block: BlockOf<'misconception'>; lesson: CourseLesson; course: Course }>();
const root = ref<HTMLElement | null>(null);
useCues(root, () => props.block);
const p = computed(() => props.block.payload);
const belief = computed(() => renderInline(p.value?.belief ?? ''));
const why = computed(() => renderInline(p.value?.why_it_seems_right ?? ''));
const truth = computed(() => renderMarkdown(p.value?.what_is_true ?? ''));
const tell = computed(() => (p.value?.tell ? renderInline(p.value.tell) : ''));
</script>

<template>
  <section ref="root" class="blk card warnish blk-mc" :data-block="block.id" data-type="misconception">
    <BlockHead type="misconception" :title="block.title" />
    <span class="mc-lbl">What people often think</span>
    <p class="belief" data-field="belief" v-html="belief" />
    <p v-if="why" class="mc-why"><span class="lbl">Why it seems right</span><span v-html="why" /></p>
    <aside class="callout truth">
      <span class="ci"><Icon name="i-check" /></span>
      <div><div class="ce">What is actually true</div><div class="prose" data-field="what_is_true" v-html="truth" /></div>
    </aside>
    <p v-if="tell" class="mc-tell"><Icon name="i-target" /><span><b>How to catch it: </b><span v-html="tell" /></span></p>
    <CiteChips :cites="block.cites" :course="course" />
  </section>
</template>
