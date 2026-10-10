<script setup lang="ts">
// Quiz (WP5c): every item graded by core grade.ts, the cited "why" only after Check, "Beyond your slides"
// labels, a "how sure are you?" pick before the reveal. Header tag counts passed items; the block counts as
// passed (bm:<id>:progress) when every item has passed once.
import { computed, ref } from 'vue';
import type { Course, CourseLesson, GradeResult } from '@bilimind/core';
import type { BlockOf } from './types.ts';
import { renderInline } from '../assessments/md.ts';
import { isPassedStored, markPassed } from '../assessments/store.ts';
import TaskShell from '../assessments/ui/TaskShell.vue';
import AssessmentItem from '../assessments/AssessmentItem.vue';

const props = defineProps<{ block: BlockOf<'quiz'>; lesson: CourseLesson; course: Course }>();

const items = computed(() => props.block.assessments ?? []);
const passedIds = ref<Set<string>>(new Set());
const wasPassed = ref(isPassedStored(props.course.id, props.lesson.id, props.block.id));
const allPassed = computed(() => wasPassed.value || (items.value.length > 0 && items.value.every(i => passedIds.value.has(i.id))));
const checkedCount = computed(() => items.value.filter(i => (i.cites?.length || i.verdict === 'supported')).length);

function onGraded(id: string, r: GradeResult) {
  const next = new Set(passedIds.value);
  if (r.passed) next.add(id);
  passedIds.value = next;
  if (items.value.every(i => next.has(i.id)) && !wasPassed.value) {
    wasPassed.value = true;
    markPassed(props.course.id, props.lesson.id, props.block.id);
  }
}
</script>

<template>
  <TaskShell :block="block" :passed="allPassed">
    <template #actions>
      <span v-if="checkedCount" class="tag quiet opt-long">Answers checked against your slides</span>
      <span v-if="items.length > 1" class="tag num" :class="{ ok: passedIds.size === items.length }" :key="passedIds.size">
        {{ passedIds.size }}/{{ items.length }} passed
      </span>
    </template>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <p v-if="block.payload.intro" class="quiz-intro" v-html="renderInline(block.payload.intro)" />
    <AssessmentItem v-for="(it, i) in items" :key="it.id" :item="it" :lesson-id="lesson.id" :block-id="block.id"
      :n="i + 1" :total="items.length" @graded="onGraded" />
    <p v-if="!items.length" class="q-fb">No questions in this check yet.</p>
  </TaskShell>
</template>

<style>
.bmx .quiz-intro { margin: -4px 0 18px; font: 400 16px/1.55 var(--body); color: var(--text-2); }
</style>
