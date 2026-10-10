<script setup lang="ts">
// SHELL STUB (WP0). Owner: WP5a (routing, home, lesson view, dock, cites). Shows the course title and every
// lesson's blocks through the registry so the build and the block convention can be checked end to end.
import { inject } from 'vue';
import { LEARNER_TAG } from '@bilimind/core';
import { COURSE_KEY } from './course.ts';
import { blockComponent, missingBlockComponents } from './blocks/registry.ts';

defineProps<{ errors: string[] }>();
const course = inject(COURSE_KEY, null);
const missing = missingBlockComponents();
</script>

<template>
  <main v-if="course" class="bm-app" :data-course="course.id">
    <h1 id="bm-title">{{ course.title }}</h1>
    <p>{{ course.lede }}</p>
    <p v-if="errors.length" class="bm-warn">{{ errors.length }} problem(s) in course.json; see the console.</p>
    <p v-if="missing.length" class="bm-warn">No renderer yet: {{ missing.join(', ') }}</p>
    <article v-for="lesson in course.lessons" :key="lesson.id" :id="`l-${lesson.id}`">
      <h2>{{ lesson.n }}. {{ lesson.title }} <small>{{ LEARNER_TAG[lesson.archetype].tag }}</small></h2>
      <component :is="blockComponent(block.type)" v-for="block in lesson.blocks" :key="block.id"
        :block="block" :lesson="lesson" :course="course" />
    </article>
  </main>
  <main v-else class="bm-app"><h1>No course</h1><p v-for="e in errors" :key="e">{{ e }}</p></main>
</template>

<style>
body { margin: 0; font-family: system-ui, sans-serif; background: #eceef2; color: #0b0d10; }
.bm-app { max-width: 820px; margin: 0 auto; padding: 24px 16px; }
.blk { margin: 16px 0; padding: 16px; background: #fff; border-radius: 16px; }
.stub { white-space: pre-wrap; font-size: 12px; color: #5a6070; margin: 0; }
.bm-warn { color: #b3261e; }
</style>
