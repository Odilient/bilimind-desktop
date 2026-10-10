<script setup lang="ts">
// Reference table ("Look it up"): the table a learner comes back to. Cobalt table with the first column
// as the key; a filter appears above four rows (nobody reads a reference top to bottom); one card per row
// under 640px. Silent for narration.
import { computed, ref } from 'vue';
import type { Course, CourseLesson } from '@bilimind/core';
import type { BlockOf } from './types.ts';
import BlockHead from './reading/BlockHead.vue';
import CiteChips from './reading/CiteChips.vue';
import Icon from './reading/Icon.vue';
import { escapeHtml, hasGreek, keepCase, renderInline } from './reading/markdown.ts';
import './reading/reading.css';

const props = defineProps<{ block: BlockOf<'reference_table'>; lesson: CourseLesson; course: Course }>();
const p = computed(() => props.block.payload);
const title = computed(() => props.block.title || p.value?.title || null);
const columns = computed(() => p.value?.columns ?? []);
const rows = computed(() => p.value?.rows ?? []);
const wide = computed(() => columns.value.length >= 5);
const filterable = computed(() => rows.value.length > 4);
const q = ref('');

/** Big-O-ish / numeric cells get the display face (they are the thing you look up). */
const isNum = (s: string) => /^\s*(?:[OΘΩθ]\(.{1,24}\)|~?[-+]?\d[\d.,]*\s*%?\s*[a-zA-Z]{0,4})\s*$/.test(s);

function mark(html: string, needle: string): string {
  if (!needle) return html;
  const n = escapeHtml(needle).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // only mark inside text, never inside a tag
  return html.replace(/(^|>)([^<]+)/g, (_m, lead: string, txt: string) => lead + txt.replace(new RegExp(n, 'gi'), x => `<mark>${x}</mark>`));
}

const view = computed(() => {
  const needle = q.value.trim().toLowerCase();
  return rows.value
    .filter(r => !needle || r.some(c => String(c ?? '').toLowerCase().includes(needle)))
    .map(r => columns.value.map((_, k) => {
      const raw = String(r[k] ?? '');
      return { html: mark(renderInline(raw || '—'), q.value.trim()), num: k > 0 && isNum(raw) };
    }));
});
const note = computed(() => (p.value?.note ? renderInline(p.value.note) : ''));
</script>

<template>
  <section class="blk card blk-rt" :class="{ wide }" :data-block="block.id" data-type="reference_table">
    <BlockHead type="reference_table" :title="title">
      <template #act>
        <label v-if="filterable" class="rt-filter"><Icon name="i-search" /><span class="sr-only">Filter the table</span>
          <input v-model="q" type="search" placeholder="Find a row…" autocomplete="off" /></label>
        <span v-else class="tag">{{ rows.length }} rows</span>
      </template>
    </BlockHead>
    <div class="cmp-wrap">
      <table class="cmp rt">
        <thead><tr><th v-for="(c, k) in columns" :key="k" scope="col" v-html="keepCase(c)" /></tr></thead>
        <tbody>
          <tr v-for="(r, i) in view" :key="i">
            <td v-for="(c, k) in r" :key="k" :class="{ k: k === 0, num: c.num, gk: hasGreek(columns[k] ?? '') }" :data-axis="columns[k]" v-html="c.html" />
          </tr>
        </tbody>
      </table>
      <p v-if="!view.length" class="rt-empty">No row mentions “{{ q }}”.</p>
    </div>
    <p v-if="note" class="rt-note"><Icon name="i-bulb" /><span v-html="note" /></p>
    <CiteChips :cites="block.cites" :course="course" />
  </section>
</template>
