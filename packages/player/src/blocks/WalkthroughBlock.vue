<script setup lang="ts">
// Walkthrough (WP5c): a procedure in the order it is done. Steps sit on an ink rail and are ticked off,
// so "where was I" has an answer after scrolling away (ticks kept in bm:<id>:ui). The next open step is
// highlighted. Narrated: intro, each step title and detail (spans for the dock's sentence highlight).
import { computed, ref } from 'vue';
import { fieldSentences } from '@bilimind/core';
import type { Course, CourseLesson } from '@bilimind/core';
import type { BlockOf } from './types.ts';
import { renderInline, renderMd } from '../assessments/md.ts';
import { vSentences } from '../assessments/sentences.ts';
import { loadUi, saveUi } from '../assessments/store.ts';
import TaskShell from '../assessments/ui/TaskShell.vue';
import Ico from '../assessments/ui/Ico.vue';

const props = defineProps<{ block: BlockOf<'walkthrough'>; lesson: CourseLesson; course: Course }>();
const steps = computed(() => props.block.payload.steps ?? []);
const key = `${props.lesson.id}/${props.block.id}`;
const done = ref<number[]>(loadUi<number[]>(props.course.id, key, []).filter(n => typeof n === 'number'));
const cur = computed(() => steps.value.findIndex((_, i) => !done.value.includes(i)));
const all = computed(() => steps.value.length > 0 && done.value.length >= steps.value.length);
const S = (field: string) => fieldSentences(props.block, field);

function toggle(i: number) {
  done.value = done.value.includes(i) ? done.value.filter(x => x !== i) : [...done.value, i];
  saveUi(props.course.id, key, done.value.length ? done.value : null);
}
function clear() { done.value = []; saveUi(props.course.id, key, null); }
</script>

<template>
  <TaskShell :block="block">
    <template #actions>
      <span class="tag num" :class="all ? 'ok' : 'quiet'">{{ done.length }}/{{ steps.length }} done</span>
      <button v-if="done.length" type="button" class="btn ghost sm wt-clear" @click="clear"><Ico name="refresh" />Start over</button>
    </template>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-if="block.payload.intro" v-sentences="S('intro')" class="md sm wt-intro" v-html="renderMd(block.payload.intro)" />
    <ol class="wt">
      <li v-for="(s, i) in steps" :key="i" class="wt-s" :class="{ done: done.includes(i), cur: i === cur }">
        <button type="button" class="wt-n" :aria-pressed="done.includes(i)" :aria-label="`Step ${i + 1}: ${done.includes(i) ? 'done' : 'mark done'}`" @click="toggle(i)">
          <Ico v-if="done.includes(i)" name="check" /><template v-else>{{ s.n || i + 1 }}</template>
        </button>
        <div class="wt-b">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <h4 v-sentences="S(`steps.${i}.title`)" class="wt-t" v-html="renderInline(s.title)" />
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-sentences="S(`steps.${i}.detail_markdown`)" class="md sm" v-html="renderMd(s.detail_markdown)" />
          <div v-if="s.warning" class="wt-warn"><Ico name="warning" /><span><b>Watch out</b><span v-html="renderInline(s.warning)" /></span></div>
          <button type="button" class="wt-check" :class="{ on: done.includes(i) }" :aria-pressed="done.includes(i)" @click="toggle(i)">
            <span class="box"><Ico name="check" /></span>
            <span v-html="renderInline(s.check || 'Done with this step')" />
          </button>
        </div>
      </li>
    </ol>
    <p v-if="all" class="wt-all"><Ico name="check" />Every step done. Try it once more without looking.</p>
  </TaskShell>
</template>

<style>
.bmx .wt-intro { margin-bottom: 18px; color: var(--text-2); }
.bmx .wt { margin: 0; padding: 0; list-style: none; display: grid; }
.bmx .wt-s { position: relative; display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 14px; padding-bottom: 22px; }
.bmx .wt-s:last-child { padding-bottom: 0; }
.bmx .wt-s::before { content: ""; position: absolute; left: 16px; top: 36px; bottom: 2px; width: 2px; border-radius: 2px; background: var(--rule-strong); }
.bmx .wt-s:last-child::before { display: none; }
.bmx .wt-s.done::before { background: var(--lime-2); }
.bmx .wt-n { position: relative; z-index: 1; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--ink); color: #fff; font: 600 13.5px/1 var(--display); transition: background var(--d-fast), transform var(--d-press), box-shadow var(--d-fast); }
.bmx .wt-n .bm-ico { width: 15px; height: 15px; }
.bmx .wt-n:active { transform: scale(.94); }
.bmx .wt-s.cur .wt-n { box-shadow: var(--ring-hot); }
.bmx .wt-s.done .wt-n { background: var(--lime); color: var(--ink); animation: stamp .35s var(--ease-pop); }
.bmx .wt-b { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; padding-top: 4px; }
.bmx .wt-t { margin: 0; font: var(--t-h4); letter-spacing: var(--track-h); color: var(--text); }
.bmx .wt-s.done .wt-t, .bmx .wt-s.done .md { color: var(--text-2); }
.bmx .wt-warn { display: flex; gap: 10px; padding: 10px 12px; border-radius: 12px; background: var(--coral-soft); color: var(--ink-3); font: 400 14px/1.5 var(--body); }
.bmx .wt-warn .bm-ico { width: 15px; height: 15px; margin-top: 2px; color: var(--coral-ink); }
.bmx .wt-warn b { display: block; font: var(--t-eyebrow); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--coral-ink); margin: 2px 0 3px; }
.bmx .wt-check { justify-self: start; display: inline-flex; align-items: center; gap: 10px; min-height: 40px; padding: 6px 14px 6px 8px; border-radius: 12px; background: var(--sunken); box-shadow: var(--hair); font: 500 14px/1.4 var(--body); color: var(--ink-3); text-align: left; transition: background var(--d-fast), box-shadow var(--d-fast); }
.bmx .wt-check:hover { background: var(--fill); }
.bmx .wt-check.on { background: var(--lime-soft); box-shadow: inset 0 0 0 1px var(--lime-line); color: var(--lime-ink); }
.bmx .wt-all { display: flex; align-items: center; gap: 8px; margin: 18px 0 0; font: 600 14.5px/1.4 var(--body); color: var(--lime-ink); }
.bmx .wt-all .bm-ico { width: 16px; height: 16px; }
</style>
