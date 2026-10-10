<script setup lang="ts">
// cloze (player-design 5.8): the sentence stays a sentence, each ____ becomes an inline gap sized to the
// answer. After grading, right gaps go lime, wrong gaps coral and struck with the accepted word above.
import { computed, ref, watch } from 'vue';
import { expectedBlanks, matchesAny } from '@bilimind/core';
import type { CourseAssessment, ItemResponse } from '@bilimind/core';
import { renderInline } from './md.ts';

const props = defineProps<{ item: CourseAssessment; checked: boolean; uid: string }>();
const response = defineModel<ItemResponse | null>('response', { default: null });
const emit = defineEmits<{ submit: [] }>();

const GAP = /_{3,}|\[\s*blank\s*\]|\{\{\s*\w*\s*\}\}/gi;
const parts = computed(() => {
  const p = props.item.prompt.split(GAP);
  return p.length > 1 ? p : [p[0] ?? '', ''];        // no gap marker: one gap after the prompt
});
const gaps = computed(() => parts.value.length - 1);
const blanks = computed(() => expectedBlanks(props.item));
const width = (i: number) => Math.max(6, Math.min(26, ...(blanks.value[i] ?? blanks.value[0] ?? ['xxxxxx']).map(a => a.length)));

const vals = ref<string[]>(Array.from({ length: gaps.value }, () => ''));
watch(vals, v => {
  response.value = v.some(x => x.trim()) ? { kind: 'cloze', text: v.map(x => x.trim()) } : null;
}, { deep: true });
watch(() => props.checked, c => { if (!c) { vals.value = vals.value.map(() => ''); response.value = null; } });

function gapState(i: number): '' | 'ok' | 'bad' {
  if (!props.checked) return '';
  const acc = blanks.value[i] ?? [];
  return vals.value[i] && matchesAny(vals.value[i]!, acc) ? 'ok' : 'bad';
}
const fix = (i: number) => (blanks.value[i] ?? [])[0] ?? '';
</script>

<template>
  <p class="cz q-q">
    <template v-for="(txt, i) in parts" :key="i">
      <!-- eslint-disable-next-line vue/no-v-html -->
      <span v-html="renderInline(txt)" />
      <span v-if="i < gaps" class="gap" :class="gapState(i)" :style="{ '--w': width(i) }">
        <input v-model="vals[i]" :aria-label="`Blank ${i + 1}`" autocomplete="off" spellcheck="false" :disabled="checked"
          :id="i === 0 ? uid : undefined" @keydown.enter.prevent="response && emit('submit')" />
        <span v-if="gapState(i) === 'bad' && fix(i)" class="fix">{{ fix(i) }}</span>
      </span>
    </template>
  </p>
</template>
