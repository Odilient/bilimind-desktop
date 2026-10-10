<script setup lang="ts">
// Worked example (player-design §5.12): the problem on a cobalt-soft panel, then steps revealed one at a
// time on an ink-numbered rail (attempt the next line before you see it), then the lime answer band
// and the common mistakes. "Show all" is for the second read.
import { computed, ref, watch } from 'vue';
import type { Course, CourseLesson } from '@bilimind/core';
import type { BlockOf } from './types.ts';
import BlockHead from './reading/BlockHead.vue';
import CiteChips from './reading/CiteChips.vue';
import Icon from './reading/Icon.vue';
import { renderInline, renderMarkdown } from './reading/markdown.ts';
import { useCues } from './reading/cues.ts';
import { emitPassed } from './reading/util.ts';
import './reading/reading.css';

const props = defineProps<{ block: BlockOf<'worked_example'>; lesson: CourseLesson; course: Course }>();
const root = ref<HTMLElement | null>(null);
useCues(root, () => props.block);

const p = computed(() => props.block.payload);
const problem = computed(() => renderMarkdown(p.value?.problem_markdown ?? ''));
const steps = computed(() => (p.value?.steps ?? []).map(s => ({ expr: s.expression ?? '', why: renderInline(s.explanation ?? '') })));
const mistakes = computed(() => (p.value?.common_mistakes ?? []).filter(Boolean).map(m => renderInline(m)));
const answer = computed(() => renderInline(p.value?.answer ?? ''));

const shown = ref(1);
const total = computed(() => steps.value.length);
const all = computed(() => shown.value >= total.value);
watch(() => props.block.id, () => { shown.value = 1; });

function next() {
  shown.value = Math.min(total.value, shown.value + 1);
  if (all.value) emitPassed(root.value, props.lesson?.id ?? '', props.block.id, 'all_steps');
}
function showAll() {
  shown.value = total.value;
  emitPassed(root.value, props.lesson?.id ?? '', props.block.id, 'all_steps');
}
function replay() { shown.value = 1; }
</script>

<template>
  <section ref="root" class="blk card blk-wx" :data-block="block.id" data-type="worked_example">
    <BlockHead type="worked_example" :title="block.title">
      <template #act>
        <button v-if="!all && total > 1" type="button" class="ghost" @click="showAll"><Icon name="i-eye" />Show all</button>
        <button v-else-if="total > 1" type="button" class="ghost" @click="replay"><Icon name="i-refresh" />Start over</button>
      </template>
    </BlockHead>
    <div class="wx-prob"><span class="we">Problem</span><div class="prose" data-field="problem_markdown" v-html="problem" /></div>
    <ol class="wx-steps" :aria-label="`Steps, ${shown} of ${total} shown`">
      <li v-for="(s, i) in steps" :key="i" :class="{ shown: i < shown, done: i < shown - 1 || (all && i < total), 'last-shown': i === shown - 1 }" :aria-hidden="i >= shown">
        <div>
          <span class="wx-n"><Icon v-if="i < shown - 1 || all" name="i-check" /><template v-else>{{ i + 1 }}</template></span>
          <div><pre class="wx-expr">{{ s.expr }}</pre><p class="wx-why" v-html="s.why" /></div>
        </div>
      </li>
    </ol>
    <div v-if="!all" class="wx-bar">
      <button type="button" class="pill lime sm" @click="next">Next step <Icon name="i-arrow" style="width:14px;height:14px" /></button>
      <span class="tag">{{ shown }} / {{ total }}</span>
      <span class="wx-link" style="text-decoration:none;cursor:default">Try the next line yourself first.</span>
    </div>
    <template v-else>
      <div class="wx-ans"><span class="we">Answer</span><b v-html="answer" /></div>
      <template v-if="mistakes.length">
        <p class="wx-miss-h">Common mistakes</p>
        <ul class="wx-miss"><li v-for="(m, i) in mistakes" :key="i"><Icon name="i-x" /><span v-html="m" /></li></ul>
      </template>
    </template>
    <CiteChips :cites="block.cites" :course="course" />
  </section>
</template>
