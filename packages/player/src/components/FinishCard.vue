<script setup lang="ts">
// End of every lesson (player-design §4.8 + §6.1 step 1): tasks done, "Mark complete" (stamp + confetti),
// then "Up next" as a mini milestone.
import { computed, ref } from 'vue';
import type { Course, CourseLesson } from '@bilimind/core';
import { BLOCK_META } from '@bilimind/core';
import { fmtMinutes } from '../runtime/time.ts';
import { lessonHref } from '../router.ts';
import { stepLabel, topicOf } from '../runtime/model.ts';

const props = defineProps<{ course: Course; lesson: CourseLesson; step: number; done: boolean; passed: Set<string>; next: CourseLesson | null }>();
const emit = defineEmits<{ complete: [el: HTMLElement]; undo: [] }>();
const btn = ref<HTMLElement | null>(null);
const tasks = computed(() => props.lesson.blocks.filter(b => BLOCK_META[b.type]?.task));
const passedN = computed(() => tasks.value.filter(b => props.passed.has(b.id)).length);
const nextTopic = computed(() => (props.next ? topicOf(props.course, props.next.id) : undefined));
const reviews = computed(() => (props.course.review?.cards ?? []).filter(c => c.lesson === props.lesson.id).length);
</script>

<template>
  <section class="fin" aria-labelledby="fin-h" data-finish>
    <span class="eyebrow">End of step {{ step }}</span>
    <template v-if="!done">
      <h3 id="fin-h">Done with this lesson?</h3>
      <div v-if="tasks.length" class="bar"><span><i :style="{ width: (tasks.length ? (passedN / tasks.length) * 100 : 0) + '%' }"></i></span>{{ passedN }} of {{ tasks.length }} tasks done</div>
      <div class="acts">
        <button ref="btn" type="button" class="pill lime lg" data-complete @click="emit('complete', btn!)">Mark complete<span class="arr"><svg aria-hidden="true"><use href="#i-check" /></svg></span></button>
        <span v-if="reviews" class="quiet" style="text-decoration:none">{{ reviews }} card{{ reviews > 1 ? 's' : '' }} from this lesson join your reviews.</span>
      </div>
    </template>
    <template v-else>
      <span id="fin-h" class="band">Lesson done. <span class="hchip ink" aria-hidden="true"><svg><use href="#i-check" /></svg></span></span>
      <button type="button" class="quiet" style="justify-self:start" @click="emit('undo')">Not done yet? Undo</button>
    </template>
    <div v-if="next" class="up">
      <span class="eyebrow">{{ next.n < lesson.n ? 'Still open' : 'Up next' }}</span>
      <a class="p-topic" :href="lessonHref(next.id)">
        <span class="no">{{ stepLabel(course, next.id).step }}</span><span class="tt">{{ next.title }}</span>
        <span class="mt">{{ fmtMinutes(next.minutes) }}</span>
      </a>
      <div v-if="nextTopic?.items.length" class="subs">
        <span v-for="it in nextTopic.items.filter(x => !x.cut)" :key="it.id" class="p-sub"><span v-if="it.mark || it.lesson" class="mk" :class="it.lesson || it.mark === 'recommended' ? 'rec' : it.mark === 'alternative' ? 'alt' : 'any'"></span>{{ it.title }}</span>
      </div>
    </div>
    <div v-else-if="done" class="up"><span class="eyebrow">That was the last lesson on the path.</span></div>
  </section>
</template>
