<script setup lang="ts">
// Lesson head slab (player-design §4.2): step + learner tag, the title (cue title.0 when narrated),
// meta chips, the "Listen" orb and the archetype's 3D object.
import { computed, ref } from 'vue';
import type { Course, CourseLesson } from '@bilimind/core';
import { archetypeTag, taskBlocks } from '../runtime/model.ts';
import { fmtClock, fmtMinutes } from '../runtime/time.ts';
import { toggle, voice } from '../runtime/narration.ts';
import Orb from './Orb.vue';

const props = defineProps<{ course: Course; lesson: CourseLesson; step: number; of: number }>();
const tag = computed(() => archetypeTag(props.lesson.archetype));
const words = computed(() => props.lesson.title.trim().split(/\s+/));
const long = computed(() => props.lesson.title.length > 30);
const checks = computed(() => props.lesson.blocks.reduce((n, b) => n + b.assessments.length, 0) || taskBlocks(props.lesson).length);
const on = computed(() => voice.key === props.lesson.id && voice.playing);
const sub = computed(() => {
  const n = props.lesson.narration;
  if (!n) return 'Narration not ready';
  if (voice.key === props.lesson.id && voice.error) return 'Audio file not found';
  if (voice.key === props.lesson.id && voice.started) return `${fmtClock(voice.t)} / ${fmtClock(voice.duration)}`;
  return `${fmtClock(n.duration_ms)} · read to you`;
});
const objOk = ref(true);
const obj = computed(() => `img/${tag.value.object}.webp`);
</script>

<template>
  <section class="slab l-head" :class="course.skin" aria-labelledby="l-title">
    <i class="beams" aria-hidden="true"></i><i class="grain" aria-hidden="true"></i>
    <div class="copy">
      <span class="eb on-dark rise" style="--i:0"><span class="dot"><svg aria-hidden="true"><use :href="'#' + tag.icon" /></svg></span>Step {{ step }} of {{ of }} · {{ tag.tag }}</span>
      <h1 id="l-title" class="display rise" :class="{ long }" style="--i:1"><span class="s" data-s="title.0">{{ words[0] }}{{ ' ' }}<span class="hchip" aria-hidden="true"><svg><use :href="'#' + tag.icon" /></svg></span>{{ ' ' + words.slice(1).join(' ') }}</span></h1>
      <div class="meta rise" style="--i:2">
        <span class="meta-chip"><svg aria-hidden="true"><use href="#i-time" /></svg>{{ fmtMinutes(lesson.minutes) }}</span>
        <span class="meta-chip"><svg aria-hidden="true"><use href="#i-list" /></svg>{{ lesson.blocks.length }} parts</span>
        <span v-if="checks" class="meta-chip"><svg aria-hidden="true"><use href="#i-quiz" /></svg>{{ checks }} checks</span>
        <span v-if="lesson.narration" class="meta-chip"><svg aria-hidden="true"><use href="#i-speaker" /></svg>Narrated</span>
      </div>
    </div>
    <div class="side rise" style="--i:3">
      <Orb :label="on ? 'Listening' : 'Listen'" :sub="sub" :on="on" :amp="voice.key === lesson.id ? voice.amp : 0" :disabled="!lesson.narration" @toggle="toggle()" />
    </div>
    <img v-if="objOk" class="obj" :src="obj" alt="" @error="objOk = false" />
  </section>
</template>
