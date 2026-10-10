<script setup lang="ts">
// Scenario (WP5c): a situation worked through by choosing. Not graded: each choice shows what happens, the
// path continues, and every path ends at the debrief (held back until the end so it does not give the
// answer away). Reaching the debrief marks the block passed.
import { computed, nextTick, ref } from 'vue';
import { fieldSentences } from '@bilimind/core';
import type { Course, CourseLesson } from '@bilimind/core';
import type { BlockOf } from './types.ts';
import { renderInline, renderMd } from '../assessments/md.ts';
import { vSentences } from '../assessments/sentences.ts';
import { isPassedStored, markPassed } from '../assessments/store.ts';
import { nextStepId } from '../assessments/scenario.ts';
import TaskShell from '../assessments/ui/TaskShell.vue';
import Ico from '../assessments/ui/Ico.vue';

const props = defineProps<{ block: BlockOf<'scenario'>; lesson: CourseLesson; course: Course }>();
type Step = BlockOf<'scenario'>['payload']['steps'][number];
type Opt = Step['options'][number];

const steps = computed(() => props.block.payload.steps ?? []);
const path = ref<{ step: Step; option: Opt }[]>([]);
const currentId = ref<string | null>(steps.value[0]?.id ?? null);
const current = computed(() => steps.value.find(s => s.id === currentId.value) ?? null);
const finished = computed(() => current.value === null && path.value.length > 0);
const missteps = computed(() => path.value.filter(e => !e.option.correct).length);
const passed = ref(isPassedStored(props.course.id, props.lesson.id, props.block.id));
const root = ref<HTMLElement | null>(null);
const live = ref('');

async function choose(step: Step, option: Opt) {
  path.value = [...path.value, { step, option }];
  currentId.value = nextStepId(steps.value, option, path.value.length);
  live.value = option.correct ? 'Good call.' : 'That has consequences.';
  if (currentId.value === null) {
    if (!passed.value) { passed.value = true; markPassed(props.course.id, props.lesson.id, props.block.id); }
  }
  await nextTick();
  const target = root.value?.querySelector(currentId.value === null ? '.sc-debrief' : '.sc-now');
  (target as HTMLElement | null)?.focus?.({ preventScroll: true });
}
function restart() { path.value = []; currentId.value = steps.value[0]?.id ?? null; }
const debrief = computed(() => props.block.payload.debrief_markdown?.trim() ?? '');
const summary = computed(() => missteps.value === 0
  ? 'Clean run: every choice was the one that fixes the cause.'
  : `You took ${missteps.value} wrong turn${missteps.value === 1 ? '' : 's'}. That is the point of rehearsing here and not on the day.`);
</script>

<template>
  <TaskShell :block="block" :passed="passed">
    <template #actions>
      <span v-if="steps.length > 1" class="tag quiet num">{{ Math.min(path.length + (finished ? 0 : 1), steps.length) }} of {{ steps.length }}</span>
      <button v-if="path.length" type="button" class="btn ghost sm wt-clear" @click="restart"><Ico name="refresh" />Start over</button>
    </template>
    <div ref="root" class="sc">
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-sentences="fieldSentences(block, 'setup_markdown')" class="md sm sc-setup" v-html="renderMd(block.payload.setup_markdown)" />

      <ol v-if="path.length" class="sc-path">
        <li v-for="(e, i) in path" :key="i" class="sc-out" :class="e.option.correct ? 'good' : 'warn'">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <p class="sc-q" v-html="renderInline(e.step.prompt)" />
          <p class="sc-pick"><span class="sc-ic"><Ico :name="e.option.correct ? 'check' : 'warning'" /></span>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <span>You chose: <b v-html="renderInline(e.option.text)" /></span></p>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="md sm sc-res" v-html="renderMd(e.option.outcome_markdown)" />
        </li>
      </ol>

      <div v-if="current" class="sc-now" tabindex="-1" :key="`${current.id}-${path.length}`">
        <span class="eyebrow-s">{{ path.length ? 'What next?' : 'Your move' }}</span>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <p class="sc-prompt" v-html="renderInline(current.prompt)" />
        <div class="sc-opts">
          <button v-for="(o, i) in current.options" :key="o.id" type="button" class="sc-opt" :data-option="o.id" @click="choose(current, o)">
            <span class="k">{{ String.fromCharCode(65 + i) }}</span>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <span v-html="renderInline(o.text)" />
            <Ico name="arrow" />
          </button>
        </div>
      </div>

      <div v-if="finished" class="sc-debrief" tabindex="-1">
        <span class="sc-de">Debrief</span>
        <p class="sc-sum">{{ summary }}</p>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-if="debrief" class="md sm" v-html="renderMd(debrief)" />
        <button type="button" class="btn ink sm" @click="restart"><Ico name="refresh" />Try another path</button>
      </div>
    </div>
    <span class="sr-only" aria-live="polite">{{ live }}</span>
  </TaskShell>
</template>

<style>
.bmx .sc { display: grid; gap: 16px; }
.bmx .sc-setup { padding: 14px 16px; border-radius: var(--r-row); background: var(--sunken); box-shadow: var(--hair); }
.bmx .sc-path { margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; }
.bmx .sc-out { display: grid; gap: 6px; padding: 14px 16px; border-radius: var(--r-row); animation: pop .35s var(--ease-out); }
.bmx .sc-out.good { background: var(--lime-soft); box-shadow: inset 0 0 0 1px var(--lime-line); }
.bmx .sc-out.warn { background: var(--amber-soft); box-shadow: inset 0 0 0 1px rgb(214 168 40 / 0.35); }
.bmx .sc-q { margin: 0; font: var(--t-cap); color: var(--text-2); }
.bmx .sc-pick { display: flex; align-items: flex-start; gap: 8px; margin: 0; font: 500 15px/1.45 var(--body); color: var(--ink); }
.bmx .sc-pick b { font-weight: 600; }
.bmx .sc-ic { width: 22px; height: 22px; flex: none; border-radius: 50%; display: grid; place-items: center; }
.bmx .sc-ic .bm-ico { width: 12px; height: 12px; }
.bmx .sc-out.good .sc-ic { background: var(--lime); color: var(--ink); }
.bmx .sc-out.warn .sc-ic { background: var(--amber-ink); color: #fff; }
.bmx .sc-res { color: var(--ink-3); padding-left: 30px; }
.bmx .sc-now { display: grid; gap: 10px; outline: none; animation: pop .35s var(--ease-out); }
.bmx .sc-prompt { margin: 0; font: 600 18px/1.4 var(--body); color: var(--text); }
.bmx .sc-opts { display: grid; gap: 8px; }
.bmx .sc-opt { display: grid; grid-template-columns: 28px minmax(0, 1fr) 16px; align-items: center; gap: 12px; min-height: 54px; padding: 10px 16px 10px 12px; border-radius: var(--r-row); background: var(--surface); box-shadow: var(--hair-strong); font: 500 15.5px/1.4 var(--body); color: var(--ink-3); text-align: left; transition: background var(--d-fast), box-shadow var(--d-fast), transform var(--d-press); }
.bmx .sc-opt .k { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; box-shadow: inset 0 0 0 1.5px rgb(11 13 16 / 0.16); font: 600 12.5px/1 var(--display); color: var(--text-3); }
.bmx .sc-opt > .bm-ico { width: 14px; height: 14px; color: var(--text-3); opacity: 0; transition: opacity var(--d-fast), transform var(--d-fast); }
.bmx .sc-opt:hover { background: var(--sunken); box-shadow: var(--hair-ink); }
.bmx .sc-opt:hover > .bm-ico { opacity: 1; transform: translateX(2px); }
.bmx .sc-opt:active { transform: scale(.995); }
.bmx .sc-debrief { display: grid; gap: 10px; justify-items: start; padding: 20px 22px; border-radius: var(--r-sm); background: var(--ink-grad); color: #fff; outline: none; animation: pop .4s var(--ease-pop-2); }
.bmx .sc-de { font: var(--t-eyebrow); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--lime); }
.bmx .sc-sum { margin: 0; font: 600 19px/1.35 var(--display); letter-spacing: -0.015em; }
.bmx .sc-debrief .md { color: rgb(255 255 255 / 0.84); }
.bmx .sc-debrief .md strong, .bmx .sc-debrief .md b { color: #fff; }
.bmx .sc-debrief .md code { background: rgb(255 255 255 / 0.14); color: #fff; }
.bmx .sc-debrief .btn.ink { background: var(--lime); color: var(--ink); }
.bmx .sc-debrief :focus-visible { outline-color: var(--lime); }
</style>
