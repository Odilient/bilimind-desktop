<script setup lang="ts">
// Reflection ("Think about it"): ungraded by design. The note autosaves in this browser only
// (localStorage bm:<courseId>:notes), and saying so is part of the block. A real answer (a sentence
// or more) marks the block passed.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Course, CourseLesson } from '@bilimind/core';
import type { BlockOf } from './types.ts';
import BlockHead from './reading/BlockHead.vue';
import CiteChips from './reading/CiteChips.vue';
import Icon from './reading/Icon.vue';
import { renderInline } from './reading/markdown.ts';
import { useCues } from './reading/cues.ts';
import { emitPassed, store } from './reading/util.ts';
import './reading/reading.css';

const props = defineProps<{ block: BlockOf<'reflection'>; lesson: CourseLesson; course: Course }>();
const root = ref<HTMLElement | null>(null);
useCues(root, () => props.block);

const prompt = computed(() => renderInline(props.block.payload?.prompt ?? ''));
const key = computed(() => `bm:${props.course?.id ?? 'course'}:notes`);
const id = computed(() => `${props.lesson?.id ?? ''}/${props.block.id ?? ''}`);
const note = ref('');
const saved = ref<'idle' | 'saved'>('idle');
const done = ref(false);
const words = computed(() => (note.value.trim() ? note.value.trim().split(/\s+/).length : 0));

function readAll(): Record<string, string> {
  try { return JSON.parse(store.get(key.value) ?? '{}') as Record<string, string>; } catch { return {}; }
}
onMounted(() => {
  note.value = readAll()[id.value] ?? '';
  done.value = words.value >= 8;
});

let t: ReturnType<typeof setTimeout> | undefined;
let flash: ReturnType<typeof setTimeout> | undefined;
watch(note, v => {
  clearTimeout(t);
  t = setTimeout(() => {
    const all = readAll();
    if (v.trim()) all[id.value] = v; else delete all[id.value];
    store.set(key.value, JSON.stringify(all));
    saved.value = 'saved';
    clearTimeout(flash);
    flash = setTimeout(() => { saved.value = 'idle'; }, 1800);
    if (!done.value && words.value >= 8) { done.value = true; emitPassed(root.value, props.lesson?.id ?? '', props.block.id, 'reflected'); }
  }, 500);
});
onBeforeUnmount(() => { clearTimeout(t); clearTimeout(flash); });
</script>

<template>
  <section ref="root" class="blk card task blk-rf" :class="{ passed: done }" :data-block="block.id" data-type="reflection">
    <BlockHead type="reflection" :title="block.title">
      <template #act><span v-if="done" class="tag ok stamp"><Icon name="i-check" style="width:11px;height:11px" />Written</span></template>
    </BlockHead>
    <p class="rf-q" data-field="prompt" v-html="prompt" />
    <div class="rf-box">
      <textarea v-model="note" :aria-label="block.payload?.prompt ?? 'Your reflection'" rows="4" placeholder="Two or three honest sentences. Nobody grades this." />
    </div>
    <div class="rf-foot">
      <Icon name="i-pencil" />
      <span>Saved only in this browser{{ words ? ` · ${words} ${words === 1 ? 'word' : 'words'}` : '' }}</span>
      <span v-if="saved === 'saved'" class="tag ok">Saved</span>
    </div>
    <CiteChips :cites="block.cites" :course="course" />
  </section>
</template>
