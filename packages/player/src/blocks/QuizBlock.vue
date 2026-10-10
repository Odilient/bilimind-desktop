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
// G2: only items the Checker ruled on count as checked (a cite alone is the Writer's claim)
const checkedCount = computed(() => items.value.filter(i => i.verdict === 'supported').length);
// G2: after the Checker drops an item, "Four items. Two of them..." no longer matches; hide a stale count
const NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const intro = computed(() => {
  const t = (props.block.payload.intro ?? '').trim();
  const m = t.match(/^(\w+)\s+(?:short\s+|quick\s+)?(?:items?|questions?)/i);
  if (!m) return t;
  const n = NUM[m[1]!.toLowerCase()] ?? Number(m[1]);
  return Number.isFinite(n) && n !== items.value.length ? '' : t;
});

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
    <p v-if="intro" class="quiz-intro" v-html="renderInline(intro)" />
    <AssessmentItem v-for="(it, i) in items" :key="it.id" :item="it" :lesson-id="lesson.id" :block-id="block.id"
      :n="i + 1" :total="items.length" @graded="onGraded" />
    <p v-if="!items.length" class="q-fb">No questions in this check yet.</p>
  </TaskShell>
</template>

<style>
.bmx .quiz-intro { margin: -4px 0 18px; font: 400 16px/1.55 var(--body); color: var(--text-2); }
</style>
