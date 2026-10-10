<script setup lang="ts">
// Lists every lesson's blocks; ?only=code,quiz limits the types, ?lesson=<id> one lesson.
import type { Course } from '@bilimind/core';
import { blockComponent } from '../../blocks/registry.ts';
import CitePopover from '../../components/CitePopover.vue';

const props = defineProps<{ course: Course }>();
const q = new URLSearchParams(location.search);
const only = (q.get('only') ?? '').split(',').filter(Boolean);
const lessonId = q.get('lesson');
const lessons = props.course.lessons.filter(l => !lessonId || l.id === lessonId);
const shown = (t: string) => !only.length || only.includes(t);
</script>

<template>
  <main class="hz">
    <h1 id="bm-title">{{ course.title }}</h1>
    <article v-for="l in lessons" :key="l.id" :data-lesson="l.id">
      <h2>{{ l.n }}. {{ l.title }}</h2>
      <template v-for="b in l.blocks" :key="b.id">
        <component :is="blockComponent(b.type)" v-if="shown(b.type)" :block="b" :lesson="l" :course="course" />
      </template>
    </article>
    <CitePopover />
  </main>
</template>

<style>
body { background: var(--bg); }
.hz { max-width: 820px; margin: 0 auto; padding: 32px 16px 120px; }
.hz h1 { font: var(--t-h1-sm); text-transform: uppercase; letter-spacing: var(--track-display); margin: 0 0 24px; }
.hz h2 { font: var(--t-h2); letter-spacing: var(--track-h); margin: 40px 0 20px; }
</style>
