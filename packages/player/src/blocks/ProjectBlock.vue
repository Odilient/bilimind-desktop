<script setup lang="ts">
// Project (WP5c): the brief, the deliverables as a tick list, then the submission item marked by the
// learner against its rubric (core gradeSelf + rubricRatio; the model answer appears only after "Compare").
import { computed, ref } from 'vue';
import { fieldSentences } from '@bilimind/core';
import type { Course, CourseLesson, GradeResult } from '@bilimind/core';
import type { BlockOf } from './types.ts';
import { renderMd } from '../assessments/md.ts';
import { vSentences } from '../assessments/sentences.ts';
import { isPassedStored, markPassed } from '../assessments/store.ts';
import TaskShell from '../assessments/ui/TaskShell.vue';
import AssessmentItem from '../assessments/AssessmentItem.vue';
import SelfMarkedItem from '../assessments/SelfMarkedItem.vue';

const props = defineProps<{ block: BlockOf<'project'>; lesson: CourseLesson; course: Course }>();
const p = computed(() => props.block.payload);
const items = computed(() => props.block.assessments ?? []);
const passed = ref(isPassedStored(props.course.id, props.lesson.id, props.block.id));
const fallbackItem = computed(() => ({
  id: 'project', kind: 'project' as const, prompt: 'Mark your build against the brief.', bloom: 'create' as const,
  grader: 'self' as const, max_score: 100,
}));

function onGraded(_id: string, r: GradeResult) {
  if (r.passed && !passed.value) { passed.value = true; markPassed(props.course.id, props.lesson.id, props.block.id); }
}
function onFallback(r: GradeResult) { onGraded('project', r); }
</script>

<template>
  <TaskShell :block="block" :title="block.title || p.title" :passed="passed">
    <template #actions><span class="tag quiet opt-long">Self-marked with a rubric</span></template>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-sentences="fieldSentences(block, 'brief_markdown')" class="md sm pj-brief" v-html="renderMd(p.brief_markdown)" />
    <AssessmentItem v-for="it in items" :key="it.id" :item="it" :lesson-id="lesson.id" :block-id="block.id"
      :deliverables="p.deliverables" @graded="onGraded" />
    <SelfMarkedItem v-if="!items.length" :item="fallbackItem" :uid="`pj-${lesson.id}-${block.id}`" :deliverables="p.deliverables" @graded="onFallback" />
  </TaskShell>
</template>

<style>
.bmx .pj-brief { margin-bottom: 16px; }
</style>
