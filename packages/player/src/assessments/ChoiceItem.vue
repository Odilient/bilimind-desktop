<script setup lang="ts">
// mcq + multi_select options (player-design 5.6). Native radio/checkbox inputs, visually hidden; the label
// row is the target. Correct options are only marked after the parent has graded (checked = true).
import { computed, ref, watch } from 'vue';
import { expectedOptionIds } from '@bilimind/core';
import type { CourseAssessment, ItemResponse } from '@bilimind/core';
import { renderInline } from './md.ts';
import Ico from './ui/Ico.vue';

const props = defineProps<{ item: CourseAssessment; checked: boolean; uid: string }>();
const response = defineModel<ItemResponse | null>('response', { default: null });

type Opt = { id: string; text: string };
const multi = computed(() => props.item.kind === 'multi_select');
const base = computed<Opt[]>(() => ('options' in props.item && props.item.options ? props.item.options : []) as Opt[]);
const order = ref<Opt[]>([...base.value]);
const picked = ref<string[]>([]);

function shuffle(list: Opt[]): Opt[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  // never deal the same order twice in a row
  return a.length > 1 && a.every((o, i) => o.id === order.value[i]?.id) ? [...a.slice(1), a[0]!] : a;
}
watch(() => props.checked, c => {
  if (c) return;              // "Try again": clear and reshuffle
  picked.value = [];
  response.value = null;
  order.value = shuffle(base.value);
});

function toggle(id: string) {
  if (props.checked) return;
  if (multi.value) picked.value = picked.value.includes(id) ? picked.value.filter(x => x !== id) : [...picked.value, id];
  else picked.value = [id];
  response.value = multi.value
    ? (picked.value.length ? { kind: 'multi_select', option_ids: [...picked.value] } : null)
    : { kind: 'mcq', option_id: picked.value[0] ?? null };
}

const correct = computed(() => (props.checked ? expectedOptionIds(props.item) : []));
function state(id: string): string {
  const sel = picked.value.includes(id);
  if (!props.checked) return sel ? 'sel' : '';
  const ok = correct.value.includes(id);
  if (sel && ok) return 'right';
  if (sel && !ok) return 'wrong';
  if (ok) return multi.value ? 'missed' : 'right reveal';
  return 'dim';
}
const nRight = computed(() => (multi.value ? expectedOptionIds(props.item).length : 1));
</script>

<template>
  <fieldset class="opts" :class="{ multi }">
    <legend class="sr-only">Options</legend>
    <p v-if="multi" class="q-hint">Select all that apply · {{ nRight }} are right</p>
    <label v-for="(o, i) in order" :key="o.id" class="opt" :class="state(o.id)">
      <input :type="multi ? 'checkbox' : 'radio'" :name="uid" :value="o.id" :checked="picked.includes(o.id)"
        :disabled="checked" @change="toggle(o.id)" />
      <span class="k">
        <Ico v-if="state(o.id).startsWith('right') || state(o.id) === 'missed'" name="check" />
        <Ico v-else-if="state(o.id) === 'wrong'" name="x" />
        <template v-else>{{ String.fromCharCode(65 + i) }}</template>
      </span>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <span class="ot" v-html="renderInline(o.text)" />
      <span v-if="state(o.id) === 'missed'" class="flag">Missed</span>
      <span v-else-if="state(o.id) === 'wrong'" class="flag">Your pick</span>
      <span v-else-if="checked && state(o.id) === 'right'" class="flag">Your pick</span>
      <span v-else-if="state(o.id) === 'right reveal'" class="flag">Answer</span>
    </label>
  </fieldset>
</template>
