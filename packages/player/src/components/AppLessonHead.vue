<script setup lang="ts">
// App mode lesson head (the desktop workspace): one context line, the title, the facts and a small Listen
// button. It replaces the cobalt head slab so the lesson reads like a page in an app, not a site.
import { computed } from 'vue';
import type { CourseLesson } from '@bilimind/core';
import { archetypeTag, taskBlocks } from '../runtime/model.ts';
import { fmtClock, fmtMinutes } from '../runtime/time.ts';
import { toggle, voice } from '../runtime/narration.ts';

const props = defineProps<{ lesson: CourseLesson; step: number; of: number }>();
const tag = computed(() => archetypeTag(props.lesson.archetype));
const checks = computed(() => props.lesson.blocks.reduce((n, b) => n + b.assessments.length, 0) || taskBlocks(props.lesson).length);
const on = computed(() => voice.key === props.lesson.id && voice.playing);
const sub = computed(() => {
  const n = props.lesson.narration;
  if (!n) return '';
  if (voice.key === props.lesson.id && voice.started) return `${fmtClock(voice.t)} / ${fmtClock(voice.duration)}`;
  return fmtClock(n.duration_ms);
});
</script>

<template>
  <header class="a-head" aria-labelledby="l-title">
    <p class="ctx">Step {{ step }} of {{ of }} · {{ tag.tag }} · {{ fmtMinutes(lesson.minutes) }}</p>
    <h1 id="l-title"><span class="s" data-s="title.0">{{ lesson.title }}</span></h1>
    <div class="facts">
      <span><svg aria-hidden="true"><use href="#i-list" /></svg>{{ lesson.blocks.length }} parts</span>
      <span v-if="checks"><svg aria-hidden="true"><use href="#i-quiz" /></svg>{{ checks }} checks</span>
      <button v-if="lesson.narration" type="button" class="listen" :class="{ on }" :aria-pressed="on" @click="toggle()">
        <svg aria-hidden="true"><use :href="on ? '#i-pause' : '#i-play'" /></svg>{{ on ? 'Pause' : 'Listen' }}<small>{{ sub }}</small>
      </button>
    </div>
  </header>
</template>
