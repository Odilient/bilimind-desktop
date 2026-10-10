<script setup lang="ts">
// One lesson column with every WP5b block type from the fixture, in fixture order, each in the shell's frame.
import { computed } from 'vue';
import type { Course, CourseBlock, CourseLesson } from '@bilimind/core';
import BlockFrame from '../../../components/BlockFrame.vue';
import CitePopover from '../../../components/CitePopover.vue';

const props = defineProps<{ course: Course; types: readonly string[]; samples: CourseLesson[] }>();
const rows = computed(() => {
  const out: { lesson: CourseLesson; block: CourseBlock }[] = [];
  for (const t of props.types) {
    for (const lesson of props.course.lessons) {
      const block = lesson.blocks.find(b => b.type === t);
      if (block) { out.push({ lesson, block }); break; }
    }
  }
  return out;
});
</script>

<template>
  <div class="hx">
    <header class="hx-head"><span class="eyebrow">WP5b · reading and visual blocks</span><h1>{{ course.title }}</h1></header>
    <main class="l-col">
      <template v-for="r in rows" :key="r.lesson.id + r.block.id">
        <p class="hx-label" :class="{ wide: ['diagram', 'comparison', 'playground', 'reference_table'].includes(r.block.type) }">{{ r.block.type }} · {{ r.lesson.id }}/{{ r.block.id }}</p>
        <BlockFrame :block="r.block" :lesson="r.lesson" :course="course" />
      </template>
    </main>
    <header class="hx-head hx-samples"><span class="eyebrow">Engine-port sample lessons (model output, via fromSaasLesson)</span></header>
    <main v-for="l in samples" :key="l.id" class="l-col" :data-sample="l.id">
      <template v-for="b in l.blocks.filter(x => types.includes(x.type))" :key="b.id">
        <p class="hx-label">{{ b.type }} · {{ l.id }}/{{ b.id }}</p>
        <BlockFrame :block="b" :lesson="l" :course="course" />
      </template>
    </main>
    <CitePopover />
  </div>
</template>

<style>
.hx { max-width: 1180px; margin: 0 auto; padding: 40px var(--gut) 160px; }
.hx-head { max-width: var(--read-w); margin: 0 auto 32px; }
.hx-head h1 { margin: 8px 0 0; font: var(--t-h2); letter-spacing: var(--track-h); }
.hx-label { margin: 12px 0 -18px; font: 500 11.5px/1 var(--mono); color: var(--text-3); }
.hx-samples { margin-top: 80px; }
.hx main + main { margin-top: 44px; }
.hx-label.wide { grid-column: wide; width: 100%; max-width: var(--wide-w); justify-self: center; }
</style>
