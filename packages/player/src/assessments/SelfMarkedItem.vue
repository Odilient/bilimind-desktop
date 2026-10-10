<script setup lang="ts">
// short_answer / essay / project (and a code item outside a code block): write, then compare with the model
// answer and mark yourself against the rubric (core gradeSelf + rubricRatio). The model answer is only put
// in the DOM after "Compare".
import { computed, ref } from 'vue';
import { gradeSelf, rubricRatio } from '@bilimind/core';
import type { CourseAssessment, GradeResult } from '@bilimind/core';
import { renderMd } from './md.ts';
import Ico from './ui/Ico.vue';

const props = defineProps<{ item: CourseAssessment; uid: string; deliverables?: string[] }>();
const emit = defineEmits<{ graded: [result: GradeResult] }>();

type Level = 'excellent' | 'acceptable' | 'poor';
const text = ref('');
const ticks = ref<boolean[]>((props.deliverables ?? []).map(() => false));
const comparing = ref(false);
const result = ref<GradeResult | null>(null);
const rubric = computed(() => props.item.rubric ?? []);
const levels = ref<(Level | null)[]>(rubric.value.map(() => null));
const quick = ref<number | null>(null);
const model = computed(() => {
  const k = (props.item.answer_key ?? {}) as { reference_answer?: string; reference_solution?: string };
  return k.reference_answer || (k.reference_solution ? '```js\n' + k.reference_solution + '\n```' : '');
});
const minWords = computed(() => (props.item.kind === 'essay' ? 40 : props.item.kind === 'project' ? 0 : 8));
const words = computed(() => (text.value.trim() ? text.value.trim().split(/\s+/).length : 0));
const canCompare = computed(() => props.item.kind === 'project' ? (words.value > 0 || ticks.value.some(Boolean)) : words.value >= Math.min(minWords.value, 3));
const allMarked = computed(() => (rubric.value.length ? levels.value.every(l => l !== null) : quick.value !== null));
const QUICK: [number, string][] = [[1, 'Nailed it'], [0.6, 'Partly'], [0, 'Missed it']];
const LV: [Level, string][] = [['excellent', 'Excellent'], ['acceptable', 'Acceptable'], ['poor', 'Not yet']];

function save() {
  const ratio = rubric.value.length ? rubricRatio(rubric.value, levels.value) : (quick.value ?? 0);
  result.value = gradeSelf(props.item, ratio);
  emit('graded', result.value);
}
function again() { result.value = null; comparing.value = false; levels.value = rubric.value.map(() => null); quick.value = null; }
</script>

<template>
  <div class="selfm">
    <p v-if="deliverables?.length" class="eyebrow-s dlv-h">What to hand in</p>
    <ul v-if="deliverables?.length" class="dlv">
      <li v-for="(d, i) in deliverables" :key="i">
        <label class="tick" :class="{ on: ticks[i] }">
          <input v-model="ticks[i]" type="checkbox" :disabled="!!result" />
          <span class="box"><Ico name="check" /></span>
          <span>{{ d }}</span>
        </label>
      </li>
    </ul>
    <label class="sa">
      <span class="sr-only">Your answer</span>
      <textarea v-model="text" :id="uid" :rows="item.kind === 'essay' ? 7 : item.kind === 'project' ? 4 : 4" :disabled="!!result"
        :placeholder="item.kind === 'project' ? 'Paste a link, your code, or notes on what you built' : 'Write your answer in your own words'" />
      <span class="wc">{{ words }} word{{ words === 1 ? '' : 's' }}</span>
    </label>
    <div v-if="!comparing" class="q-f">
      <button type="button" class="btn ink" :disabled="!canCompare" @click="comparing = true">
        Compare with the model answer <Ico name="arrow" />
      </button>
      <span class="q-note">You mark this one yourself. Write first, then compare.</span>
    </div>
    <div v-else class="smi-cmp">
      <div v-if="model" class="model">
        <span class="eyebrow-s">Model answer</span>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="md sm" v-html="renderMd(model)" />
      </div>
      <div v-if="rubric.length" class="rub">
        <span class="eyebrow-s">Mark yourself, one row at a time</span>
        <div v-for="(r, i) in rubric" :key="i" class="rrow">
          <p class="rc">{{ r.criterion }} <small v-if="rubric.length > 1">{{ Math.round(r.weight * 100) }}%</small></p>
          <div class="lv" role="radiogroup" :aria-label="r.criterion">
            <button v-for="[lv, lab] in LV" :key="lv" type="button" role="radio" class="lvb" :class="[lv, { on: levels[i] === lv }]"
              :aria-checked="levels[i] === lv" :disabled="!!result" @click="levels[i] = lv">
              <b>{{ lab }}</b><small>{{ r[lv] }}</small>
            </button>
          </div>
        </div>
      </div>
      <div v-else class="lv quick" role="radiogroup" aria-label="How did you do?">
        <button v-for="[v, lab] in QUICK" :key="lab" type="button" role="radio" class="lvb" :class="{ on: quick === v }"
          :aria-checked="quick === v" :disabled="!!result" @click="quick = v"><b>{{ lab }}</b></button>
      </div>
      <div class="q-f">
        <button v-if="!result" type="button" class="btn ink" :disabled="!allMarked" @click="save">Save my mark</button>
        <template v-else>
          <span class="tag stamp" :class="result.passed ? 'ok' : 'bad'">{{ Math.round(result.ratio * 100) }}% · self-marked</span>
          <button type="button" class="btn ghost sm" @click="again">Mark again</button>
        </template>
      </div>
    </div>
  </div>
</template>
