<script setup lang="ts">
// Diagram (player-design §5.4): a wide card with the drawing on a small dotted canvas. Source order:
// payload.svg (pre-rendered by the build, sanitised) -> Mermaid lazy-loaded from jsDelivr with the cobalt
// theme -> offline: the flow as chips + the alt text. Edges draw in when the diagram enters the viewport.
// "Full screen" opens it in a dialog. The caption is what narration reads.
import { computed, nextTick, onMounted, ref } from 'vue';
import type { Course, CourseLesson } from '@bilimind/core';
import type { BlockOf } from './types.ts';
import BlockHead from './reading/BlockHead.vue';
import CiteChips from './reading/CiteChips.vue';
import Icon from './reading/Icon.vue';
import { renderInline } from './reading/markdown.ts';
import { useCues } from './reading/cues.ts';
import { flowFromMermaid, renderMermaid, sanitizeSvg } from './reading/mermaid.ts';
import { prefersReducedMotion, useInView } from './reading/util.ts';
import './reading/reading.css';

const props = defineProps<{ block: BlockOf<'diagram'>; lesson: CourseLesson; course: Course }>();
const root = ref<HTMLElement | null>(null);
const host = ref<HTMLElement | null>(null);
const dlg = ref<HTMLDialogElement | null>(null);
useCues(root, () => props.block);

const p = computed(() => props.block.payload);
const caption = computed(() => (p.value?.caption ? renderInline(p.value.caption) : ''));
const flow = computed(() => flowFromMermaid(p.value?.source ?? ''));

const state = ref<'loading' | 'drawn' | 'offline' | 'broken'>('loading');
const svg = ref('');

onMounted(async () => {
  const pre = p.value?.svg ? sanitizeSvg(p.value.svg) : null;
  if (pre) { svg.value = pre; state.value = 'drawn'; await nextTick(); prepare(); return; }
  if (!p.value?.source) { state.value = 'broken'; return; }
  try {
    const out = await renderMermaid(p.value.source);
    const clean = sanitizeSvg(out) ?? out;
    svg.value = clean;
    state.value = 'drawn';
    await nextTick();
    prepare();
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    state.value = /offline|timeout|no mermaid/.test(msg) ? 'offline' : 'broken';
  }
});

// edge draw-in (Web Animations API: never fights the SVG's own transform attributes)
let pending = false;
let seen = false;
function prepare() {
  const el = host.value?.querySelector('svg');
  if (!el) return;
  el.removeAttribute('height');
  const vb = el.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
  if (vb && vb.length === 4 && vb[2]! > 0) el.style.setProperty('--nat', `${Math.round(Math.max(300, vb[2]!))}px`);
  if (seen) animate(); else pending = true;
}
function animate() {
  pending = false;
  const el = host.value?.querySelector('svg');
  if (!el || prefersReducedMotion() || typeof (el as Element).animate !== 'function') return;
  const edges = Array.from(el.querySelectorAll<SVGPathElement>('.flowchart-link, path.relation, .messageLine0, .messageLine1, .transition'));
  edges.forEach((path, i) => {
    let len = 600;
    try { len = Math.ceil(path.getTotalLength()) || 600; } catch { /* not measurable */ }
    path.animate([{ strokeDasharray: `${len}`, strokeDashoffset: `${len}` }, { strokeDasharray: `${len}`, strokeDashoffset: '0' }],
      { duration: 800, delay: 120 + i * 60, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
  });
  const nodes = Array.from(el.querySelectorAll<SVGGElement>('.node, .cluster, .actor, .note'));
  nodes.forEach((n, i) => n.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: i * 50, easing: 'ease-out', fill: 'backwards' }));
  el.querySelectorAll<SVGElement>('.edgeLabel').forEach((l, i) =>
    l.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 500 + i * 60, fill: 'backwards' }));
}
useInView(root, () => { seen = true; if (pending) animate(); }, 0.2);

function full() {
  const d = dlg.value;
  if (!d) return;
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
}
function closeFull() { const d = dlg.value; if (!d) return; if (typeof d.close === 'function') d.close(); else d.removeAttribute('open'); }
function backdrop(e: MouseEvent) { if (e.target === dlg.value) closeFull(); }
</script>

<template>
  <section ref="root" class="blk card wide blk-dgm" :data-block="block.id" data-type="diagram">
    <BlockHead type="diagram" :title="block.title">
      <template #act>
        <button v-if="state === 'drawn'" type="button" class="ghost" @click="full"><Icon name="i-expand" />Full screen</button>
        <span v-else-if="state === 'offline'" class="tag">Text version</span>
      </template>
    </BlockHead>
    <figure class="dgm" :aria-label="p?.alt_text">
      <div class="pane" :class="{ drawn: state === 'drawn' }">
        <div v-if="state === 'drawn'" ref="host" class="svg-host" role="img" :aria-label="p?.alt_text" v-html="svg" />
        <div v-else-if="state === 'loading'" class="skel" aria-hidden="true"><i /><i /><i /><span class="skel-l">Drawing the diagram…</span></div>
        <template v-else>
          <ol v-if="flow && flow.linear" class="flow" :aria-label="p?.alt_text">
            <li v-for="(s, i) in flow.steps" :key="s.id"><span class="nd">{{ s.label }}</span><Icon v-if="i < flow.steps.length - 1" name="i-arrow" class="ar" /></li>
          </ol>
          <div class="alt" :style="flow && flow.linear ? '' : 'margin-top:0'">
            <span class="ci"><Icon name="i-flow" /></span>
            <div>{{ p?.alt_text }}<small>{{ state === 'offline' ? 'The drawing needs an internet connection the first time; this is the same diagram in words.' : 'This diagram could not be drawn, so here it is in words.' }}</small></div>
          </div>
        </template>
      </div>
      <p v-if="state === 'drawn'" class="swipe" aria-hidden="true">Swipe to see the whole diagram<Icon name="i-arrow" /></p>
      <figcaption v-if="caption" data-field="caption" v-html="caption" />
    </figure>
    <CiteChips :cites="block.cites" :course="course" />
    <dialog ref="dlg" class="dgm-dlg" :aria-label="block.title ?? 'Diagram'" @click="backdrop">
      <div class="dh"><b>{{ block.title ?? 'Diagram' }}</b><button type="button" class="ghost" @click="closeFull"><Icon name="i-x" />Close</button></div>
      <div class="pane" v-html="svg" />
    </dialog>
  </section>
</template>
