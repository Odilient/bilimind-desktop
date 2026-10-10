<script setup lang="ts">
// Explainer (player-design §5.1): plain prose on the page, no frame; the lesson's first paragraph is the
// lead. Safe markdown (escaped first, no raw HTML). Bold terms the lesson defines (its own practice cards)
// get a dotted underline + ink tooltip, and every bold term shows as a chip under the prose.
import { computed, ref } from 'vue';
import type { Course, CourseLesson } from '@bilimind/core';
import type { BlockOf } from './types.ts';
import BlockHead from './reading/BlockHead.vue';
import CiteChips from './reading/CiteChips.vue';
import { lessonGlossary, markKeyTerms, renderMarkdown } from './reading/markdown.ts';
import { useCues } from './reading/cues.ts';
import './reading/reading.css';

const props = defineProps<{ block: BlockOf<'explainer'>; lesson: CourseLesson; course: Course }>();
const root = ref<HTMLElement | null>(null);
useCues(root, () => props.block);

const isFirst = computed(() => props.lesson?.blocks?.[0]?.id === props.block.id);
const glossary = computed(() => lessonGlossary(props.lesson ?? { blocks: [] }));
const rendered = computed(() => markKeyTerms(renderMarkdown(props.block.payload?.markdown ?? '', { lead: isFirst.value }), glossary.value));
const chips = computed(() => rendered.value.terms.slice(0, 10));

// one tooltip for in-prose terms and chips
const tip = ref<{ term: string; def: string; x: number; y: number; up: boolean } | null>(null);
const pinned = ref<number | null>(null);

function showFor(el: HTMLElement, idx: number) {
  const t = rendered.value.terms[idx];
  if (!t?.def || !root.value) return;
  const box = root.value.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const w = Math.min(300, window.innerWidth - 32);
  const x = Math.max(0, Math.min(r.left - box.left, box.width - w));
  // chips sit at the bottom of the block: their tip opens upwards; in-prose terms open below
  const up = el.classList.contains('kt-chip');
  tip.value = { term: t.term, def: t.def, x, y: up ? r.top - box.top - 8 : r.bottom - box.top + 8, up };
}
function hide() { if (pinned.value === null) tip.value = null; }
function termOf(e: Event): HTMLElement | null {
  const el = (e.target as HTMLElement | null)?.closest?.('[data-kt]') as HTMLElement | null;
  return el && root.value?.contains(el) ? el : null;
}
function onOver(e: Event) { const el = termOf(e); if (el) showFor(el, Number(el.dataset.kt)); }
function onOut(e: Event) { if (termOf(e)) hide(); }
function chip(e: MouseEvent, idx: number) {
  if (pinned.value === idx) { pinned.value = null; tip.value = null; return; }
  pinned.value = idx;
  showFor(e.currentTarget as HTMLElement, idx);
}
function unpin() { pinned.value = null; tip.value = null; }
</script>

<template>
  <section ref="root" class="blk blk-explainer" :data-block="block.id" data-type="explainer"
    @mouseover="onOver" @mouseout="onOut" @focusin="onOver" @focusout="onOut">
    <BlockHead type="explainer" :title="block.title" />
    <div class="prose" data-field="markdown" v-html="rendered.html" />
    <div v-if="chips.length" class="kt-row" @mouseleave="unpin">
      <span class="kt-l">Key terms</span>
      <button v-for="(t, i) in chips" :key="i" type="button" class="kt-chip" :class="{ def: !!t.def }"
        :data-kt="t.def ? i : undefined" :aria-expanded="t.def ? pinned === i : undefined"
        :tabindex="t.def ? 0 : -1" @click="t.def && chip($event, i)">
        <i>{{ String(i + 1).padStart(2, '0') }}</i>{{ t.term }}
      </button>
    </div>
    <div v-if="tip" class="kt-tip" :class="{ up: tip.up }" role="tooltip" :style="{ left: tip.x + 'px', top: tip.y + 'px' }">
      <b>{{ tip.term }}</b>{{ tip.def }}<br><small>In your practice cards</small>
    </div>
    <CiteChips :cites="block.cites" :course="course" />
  </section>
</template>
