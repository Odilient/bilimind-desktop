<script setup lang="ts">
// Timeline (player-design §5.11): a vertical rail; an ink run grows down it as you scroll and each dot
// pops lime as it passes the middle of the viewport (and stays lit). `turning: true` events get the big ringed dot.
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Course, CourseLesson } from '@bilimind/core';
import type { BlockOf } from './types.ts';
import BlockHead from './reading/BlockHead.vue';
import CiteChips from './reading/CiteChips.vue';
import { renderInline } from './reading/markdown.ts';
import { useCues } from './reading/cues.ts';
import './reading/reading.css';

const props = defineProps<{ block: BlockOf<'timeline'>; lesson: CourseLesson; course: Course }>();
const root = ref<HTMLElement | null>(null);
const list = ref<HTMLElement | null>(null);
useCues(root, () => props.block);

const events = computed(() => (props.block.payload?.events ?? []).map(e => ({
  when: e.when, turning: !!(e as { turning?: boolean }).turning,
  title: renderInline(e.title ?? ''), detail: renderInline(e.detail ?? ''),
})));

const lit = ref<boolean[]>([]);
const run = ref(0);
let raf = 0;

function measure() {
  raf = 0;
  const ul = list.value;
  if (!ul) return;
  const mid = window.innerHeight * 0.55;
  const top = ul.getBoundingClientRect().top;
  const items = Array.from(ul.querySelectorAll<HTMLElement>(':scope > li'));
  // monotonic: once the reader has passed an event it stays lit (scrolling back up never un-fills the rail)
  let last = 0;
  lit.value = items.map((li, i) => {
    const dot = li.querySelector<HTMLElement>('.pt');
    const r = (dot ?? li).getBoundingClientRect();
    const on = !!lit.value[i] || r.top + r.height / 2 < mid;
    if (on) last = r.top + r.height / 2 - top;
    return on;
  });
  run.value = Math.max(0, last - 8);   // from the current layout (fonts or images above may have moved it)
}
const schedule = () => { if (!raf) raf = requestAnimationFrame(measure); };

onMounted(() => {
  nextTick(measure);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
});
onBeforeUnmount(() => {
  window.removeEventListener('scroll', schedule);
  window.removeEventListener('resize', schedule);
  if (raf) cancelAnimationFrame(raf);
});
</script>

<template>
  <section ref="root" class="blk rule blk-tl" :data-block="block.id" data-type="timeline">
    <BlockHead type="timeline" :title="block.title" />
    <ol ref="list" class="tl">
      <i class="run" aria-hidden="true" :style="{ '--run': run + 'px' }" />
      <li v-for="(e, i) in events" :key="i" :class="{ in: lit[i], turn: e.turning }">
        <span class="when">{{ e.when }}</span>
        <span class="pt" aria-hidden="true" />
        <div>
          <p class="tt"><span :data-field="`events.${i}.title`" v-html="e.title" /><span v-if="e.turning" class="tag lime">Turning point</span></p>
          <p v-if="e.detail" class="dd" :data-field="`events.${i}.detail`" v-html="e.detail" />
        </div>
      </li>
    </ol>
    <CiteChips :cites="block.cites" :course="course" />
  </section>
</template>
