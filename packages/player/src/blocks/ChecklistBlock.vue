<script setup lang="ts">
// Checklist (WP5c): the list the learner keeps open while working. Interactive ticks with the "why" under
// each item. Ticks are not kept across visits on purpose (a checklist is used once per job); ticking every
// item marks the block passed.
import { computed, ref } from 'vue';
import type { Course, CourseLesson } from '@bilimind/core';
import type { BlockOf } from './types.ts';
import { renderInline, renderMd } from '../assessments/md.ts';
import { isPassedStored, markPassed } from '../assessments/store.ts';
import TaskShell from '../assessments/ui/TaskShell.vue';
import Ico from '../assessments/ui/Ico.vue';

const props = defineProps<{ block: BlockOf<'checklist'>; lesson: CourseLesson; course: Course }>();
const items = computed(() => props.block.payload.items ?? []);
const ticks = ref<boolean[]>(items.value.map(() => false));
const count = computed(() => ticks.value.filter(Boolean).length);
const all = computed(() => items.value.length > 0 && count.value === items.value.length);
const passed = ref(isPassedStored(props.course.id, props.lesson.id, props.block.id));

function toggle(i: number) {
  ticks.value[i] = !ticks.value[i];
  if (all.value && !passed.value) { passed.value = true; markPassed(props.course.id, props.lesson.id, props.block.id); }
}
function clear() { ticks.value = items.value.map(() => false); }
</script>

<template>
  <TaskShell :block="block" :title="block.title || block.payload.title" :passed="passed">
    <template #actions>
      <span class="tag num" :class="all ? 'ok' : 'quiet'">{{ count }}/{{ items.length }}</span>
      <button v-if="count" type="button" class="btn ghost sm wt-clear" @click="clear"><Ico name="refresh" />Clear</button>
    </template>
    <div class="cl-bar" aria-hidden="true"><i :style="{ width: `${items.length ? (count / items.length) * 100 : 0}%` }" /></div>
    <ul class="cl-list">
      <li v-for="(it, i) in items" :key="i">
        <label class="tick" :class="{ on: ticks[i] }">
          <input type="checkbox" :checked="ticks[i]" @change="toggle(i)" />
          <span class="box"><Ico name="check" /></span>
          <span class="cl-t">
            <!-- eslint-disable-next-line vue/no-v-html -->
            <span class="cl-x" v-html="renderInline(it.text)" />
            <span v-if="it.why" class="cl-why" v-html="renderInline(it.why)" />
          </span>
        </label>
      </li>
    </ul>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-if="block.payload.note" class="cl-note md sm" v-html="renderMd(block.payload.note)" />
    <p v-if="all" class="wt-all"><Ico name="check" />All {{ items.length }} checked.</p>
  </TaskShell>
</template>

<style>
.bmx .cl-bar { height: 6px; margin: -2px 0 10px; border-radius: 99px; background: var(--fill-2); overflow: hidden; }
.bmx .cl-bar i { display: block; height: 100%; border-radius: inherit; background: var(--lime-2); transition: width var(--d-slow) var(--ease-out); }
.bmx .cl-list { margin: 0 -12px; padding: 0; list-style: none; display: grid; gap: 2px; }
.bmx .cl-t { display: grid; gap: 3px; min-width: 0; }
.bmx .cl-x { font: 500 16px/1.45 var(--body); color: var(--ink); }
.bmx .tick.on .cl-x { color: var(--text-2); text-decoration: line-through; text-decoration-color: rgb(11 13 16 / 0.3); }
.bmx .cl-why { font: 400 14px/1.45 var(--body); color: var(--text-2); }
.bmx .cl-note { margin-top: 12px; padding: 12px 14px; border-radius: var(--r-row); background: var(--note-bg); box-shadow: inset 0 0 0 1px var(--note-line); color: var(--note-ink); }
</style>
