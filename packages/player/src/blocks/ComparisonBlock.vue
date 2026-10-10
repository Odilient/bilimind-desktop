<script setup lang="ts">
// Comparison (player-design §5.15): a cobalt compare table at reading size (axes as uppercase column
// heads, item names in Space Grotesk), "best for" lines under it; one card per item under 640px.
// An optional payload.recommended (item name) marks the lime "Our pick" row.
import { computed, ref } from 'vue';
import type { Course, CourseLesson } from '@bilimind/core';
import type { BlockOf } from './types.ts';
import BlockHead from './reading/BlockHead.vue';
import CiteChips from './reading/CiteChips.vue';
import Icon from './reading/Icon.vue';
import { hasGreek, keepCase, renderInline, renderMarkdown } from './reading/markdown.ts';
import { useCues } from './reading/cues.ts';
import './reading/reading.css';

const props = defineProps<{ block: BlockOf<'comparison'>; lesson: CourseLesson; course: Course }>();
const root = ref<HTMLElement | null>(null);
useCues(root, () => props.block);

const p = computed(() => props.block.payload);
const axes = computed(() => p.value?.axes ?? []);
const pick = computed(() => String((p.value as { recommended?: string } | undefined)?.recommended ?? '').trim().toLowerCase());
const items = computed(() => (p.value?.items ?? []).map(it => ({
  name: it.name,
  win: !!pick.value && it.name.trim().toLowerCase() === pick.value,
  cells: axes.value.map((_, k) => renderInline(it.values?.[k] ?? '—')),
  best: it.best_for ? renderInline(it.best_for) : '',
})));
const intro = computed(() => (p.value?.intro ? renderMarkdown(p.value.intro) : ''));
</script>

<template>
  <section ref="root" class="blk card wide blk-cmp" :data-block="block.id" data-type="comparison">
    <BlockHead type="comparison" :title="block.title" />
    <div v-if="intro" class="cmp-intro"><div class="prose" data-field="intro" v-html="intro" /></div>
    <div class="cmp-wrap">
      <table class="cmp">
        <thead><tr><th scope="col"><span class="sr-only">Option</span></th><th v-for="(a, k) in axes" :key="k" scope="col" v-html="keepCase(a)" /></tr></thead>
        <tbody>
          <tr v-for="(it, r) in items" :key="r" :class="{ win: it.win }">
            <td class="k">{{ it.name }}</td>
            <td v-for="(c, k) in it.cells" :key="k" :class="{ gk: hasGreek(axes[k] ?? '') }" :data-axis="axes[k]" v-html="c" />
          </tr>
        </tbody>
      </table>
    </div>
    <ul v-if="items.some(i => i.best)" class="best">
      <template v-for="(it, r) in items" :key="r">
        <li v-if="it.best"><Icon name="i-target" /><span><b>{{ it.name }}</b> — <span :data-field="`items.${r}.best_for`" v-html="it.best" /></span></li>
      </template>
    </ul>
    <CiteChips :cites="block.cites" :course="course" />
  </section>
</template>
