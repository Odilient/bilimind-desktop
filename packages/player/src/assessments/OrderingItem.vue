<script setup lang="ts">
// ordering with up/down buttons (PLAN 3.2 P0; drag is P2). After grading: rows in the right place go lime,
// the others coral with "goes 2nd"; "Show the right order" slides every row into place (TransitionGroup FLIP).
import { computed, ref, watch } from 'vue';
import { expectedOrder } from '@bilimind/core';
import type { CourseAssessment, ItemResponse } from '@bilimind/core';
import { renderInline } from './md.ts';
import Ico from './ui/Ico.vue';

const props = defineProps<{ item: CourseAssessment; checked: boolean; uid: string }>();
const response = defineModel<ItemResponse | null>('response', { default: null });

type Opt = { id: string; text: string };
const base = computed<Opt[]>(() => ('options' in props.item && props.item.options ? props.item.options : []) as Opt[]);
const rows = ref<Opt[]>([...base.value]);
const live = ref('');
const showing = ref(false);
const touched = ref(false);

function sync() { response.value = { kind: 'ordering', order: rows.value.map(r => r.id) }; }
sync();

function move(i: number, d: -1 | 1) {
  const j = i + d;
  if (props.checked || j < 0 || j >= rows.value.length) return;
  const a = [...rows.value];
  [a[i], a[j]] = [a[j]!, a[i]!];
  rows.value = a;
  touched.value = true;
  live.value = `Moved to position ${j + 1} of ${a.length}.`;
  sync();
}

watch(() => props.checked, c => {
  if (c) return;
  showing.value = false;
  rows.value = [...base.value];
  touched.value = false;
  sync();
});

const right = computed(() => (props.checked ? expectedOrder(props.item) : []));
const ord = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
function state(id: string, i: number): string {
  if (!props.checked) return '';
  return right.value[i] === id ? 'ok' : 'bad';
}
function goes(id: string): string { const at = right.value.indexOf(id); return at >= 0 ? `goes ${ord(at + 1)}` : ''; }
function showRight() {
  const byId = new Map(base.value.map(o => [o.id, o]));
  rows.value = right.value.map(id => byId.get(id)).filter((o): o is Opt => !!o);
  showing.value = true;
}
const anyWrong = computed(() => rows.value.some((o, i) => state(o.id, i) === 'bad'));
</script>

<template>
  <div class="ordw">
    <p class="q-hint">Use the arrows to put the steps in order, first at the top.</p>
    <TransitionGroup tag="ol" name="ordmv" class="ord">
      <li v-for="(o, i) in rows" :key="o.id" :class="showing ? 'ok' : state(o.id, i)">
        <span class="pos">
          <Ico v-if="checked && (showing || state(o.id, i) === 'ok')" name="check" />
          <template v-else>{{ i + 1 }}</template>
        </span>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <span class="ot" v-html="renderInline(o.text)" />
        <span v-if="checked && !showing && state(o.id, i) === 'bad'" class="flag">{{ goes(o.id) }}</span>
        <span v-if="!checked" class="mv">
          <button type="button" class="mvb" :disabled="i === 0" :aria-label="`Move up: ${o.text}`" @click="move(i, -1)"><Ico name="up" /></button>
          <button type="button" class="mvb" :disabled="i === rows.length - 1" :aria-label="`Move down: ${o.text}`" @click="move(i, 1)"><Ico name="down" /></button>
        </span>
      </li>
    </TransitionGroup>
    <button v-if="checked && !showing && anyWrong" type="button" class="btn ghost sm ord-show" @click="showRight">Show the right order</button>
    <span class="sr-only" aria-live="polite">{{ live }}</span>
  </div>
</template>
