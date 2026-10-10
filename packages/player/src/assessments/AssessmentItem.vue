<script setup lang="ts">
// One assessment item: prompt, the kind's input, "How sure are you?", Check, then the grade from core
// gradeItem() and the cited explanation (only after Check). Answers reschedule the item's FSRS card
// (cardId '<lesson>/<item>'), using the confidence pick. Self-marked kinds use SelfMarkedItem's own flow.
import { computed, inject, ref } from 'vue';
import { cardId, gradeItem } from '@bilimind/core';
import type { Course, CourseAssessment, GradeResult, ItemResponse } from '@bilimind/core';
import { COURSE_KEY } from '../course.ts';
import { rate, ratingFor } from './store.ts';
import type { Confidence } from './store.ts';
import { renderInline } from './md.ts';
import ChoiceItem from './ChoiceItem.vue';
import OrderingItem from './OrderingItem.vue';
import NumericItem from './NumericItem.vue';
import ClozeItem from './ClozeItem.vue';
import SelfMarkedItem from './SelfMarkedItem.vue';
import CiteChip from '../components/CiteChip.vue';
import { quoteLead, sameText } from '../runtime/model.ts';
import Ico from './ui/Ico.vue';

const props = withDefaults(defineProps<{
  item: CourseAssessment;
  lessonId: string;
  blockId: string;
  n?: number;
  total?: number;
  deliverables?: string[];
  hidePrompt?: boolean;
}>(), { n: 1, total: 1, hidePrompt: false });
const emit = defineEmits<{ graded: [id: string, result: GradeResult] }>();
const course = inject(COURSE_KEY, null) as Course | null;

const uid = computed(() => `q-${props.lessonId}-${props.blockId}-${props.item.id}`);
const selfMarked = computed(() => ['short_answer', 'essay', 'project', 'code'].includes(props.item.kind));
const kindComp = computed(() => {
  switch (props.item.kind) {
    case 'mcq': case 'multi_select': return ChoiceItem;
    case 'ordering': return OrderingItem;
    case 'numeric': return NumericItem;
    case 'cloze': return ClozeItem;
    default: return null;
  }
});

const response = ref<ItemResponse | null>(null);
const checked = ref(false);
const result = ref<GradeResult | null>(null);
const confidence = ref<Confidence | null>(null);
const attempts = ref(0);
const live = ref('');

const labels = computed(() => props.item.labels ?? []);
const beyond = computed(() => labels.value.includes('beyond_slides'));
const rewritten = computed(() => labels.value.includes('rewritten'));
const cites = computed(() => (props.item.cites ?? []).filter(c => c && c.quote));
// G2: a Checker ruling may copy the slide quote into the explanation. The quote is shown once, as
// "Your slide says: ...", next to its chip; the explanation is kept only when it says something else.
const quotes = computed(() => cites.value.slice(0, 2).map(c => ({
  c, lead: quoteLead(course, c), q: c.quote.length > 240 ? c.quote.slice(0, 237).trimEnd() + '…' : c.quote,
})));
const explanation = computed(() => {
  const e = (props.item.explanation ?? '').trim();
  return e && cites.value.some(c => sameText(e, c.quote)) ? '' : e;
});
const hasWhy = computed(() => !!explanation.value || cites.value.length > 0 || beyond.value || rewritten.value);

const CONF: [Confidence, string][] = [['guess', 'Guessing'], ['think', 'Fairly sure'], ['sure', 'Certain']];
const calibration = computed(() => {
  if (!result.value || !confidence.value) return '';
  const ok = result.value.correct;
  if (confidence.value === 'sure') return ok ? 'Certain and right: this one is yours.' : 'Certain but wrong: the most useful kind of mistake. It comes back sooner.';
  if (confidence.value === 'guess') return ok ? 'A lucky guess counts, but it comes back soon to make sure.' : 'You knew you were guessing. Read the why below.';
  return ok ? 'Right, and now you know why.' : 'Close to knowing it. Read the why below.';
});

function record(r: GradeResult) {
  result.value = r;
  attempts.value += 1;
  live.value = r.correct ? 'Correct.' : r.feedback;
  if (course && attempts.value === 1 && r.status !== 'pending') {
    try { rate(course, cardId(props.lessonId, props.item.id), ratingFor(r.correct, r.ratio, confidence.value)); } catch { /* storage only */ }
  }
  emit('graded', props.item.id, r);
}
function check() {
  if (!response.value || checked.value) return;
  checked.value = true;
  record(gradeItem(props.item, response.value));
}
function retry() {
  checked.value = false;
  result.value = null;
  confidence.value = null;
  response.value = null;
}
function onSelf(r: GradeResult) { checked.value = true; record(r); }
</script>

<template>
  <div class="q" :class="[item.kind, { checked, right: result?.correct, wrong: checked && result && !result.correct }]" :data-item="item.id">
    <div class="q-top">
      <span v-if="total > 1" class="q-n">Question {{ n }} of {{ total }}</span>
      <span v-if="beyond" class="tag note" title="The Checker found no passage in your notes for this question">Beyond your slides</span>
      <span v-if="rewritten" class="tag quiet opt-long" title="The first version was rejected by the Checker and rewritten">Rewritten after a check</span>
    </div>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <p v-if="!hidePrompt && item.kind !== 'cloze'" class="q-q" v-html="renderInline(item.prompt)" />

    <SelfMarkedItem v-if="selfMarked" :item="item" :uid="uid" :deliverables="deliverables" @graded="onSelf" />
    <template v-else-if="kindComp">
      <component :is="kindComp" v-model:response="response" :item="item" :checked="checked" :uid="uid" :result="result" @submit="check" />

      <div v-if="!checked" class="conf" :class="{ show: !!response }" role="radiogroup" aria-label="How sure are you?">
        <span class="cl">How sure are you?</span>
        <button v-for="[c, lab] in CONF" :key="c" type="button" role="radio" class="cb" :class="[c, { on: confidence === c }]"
          :aria-checked="confidence === c" :disabled="!response" @click="confidence = confidence === c ? null : c">{{ lab }}</button>
      </div>

      <div class="q-f">
        <button v-if="!checked" type="button" class="btn ink" :disabled="!response" @click="check">Check</button>
        <template v-else-if="result">
          <span class="verdict" :class="result.correct ? 'ok' : result.ratio > 0 ? 'part' : 'bad'">
            <Ico :name="result.correct ? 'check' : 'x'" />
            {{ result.correct ? 'Correct' : result.ratio > 0 ? `${Math.round(result.ratio * 100)}% right` : 'Not quite' }}
          </span>
          <button v-if="!result.correct" type="button" class="btn ghost sm" @click="retry"><Ico name="refresh" />Try again</button>
        </template>
      </div>
      <p v-if="checked && result && !result.correct" class="q-fb">{{ result.feedback }}</p>
      <p v-if="checked && calibration" class="q-cal" :class="confidence">{{ calibration }}</p>
    </template>
    <p v-else class="q-fb">This kind of question cannot be answered here yet.</p>

    <div class="why" :class="{ open: checked && hasWhy, bad: checked && result && !result.correct }" :aria-hidden="!(checked && hasWhy)">
      <div>
        <div v-if="checked && hasWhy" class="wb">
          <span class="we">{{ explanation ? 'Why' : 'Where this comes from' }}</span>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <span v-if="explanation" class="wt" v-html="renderInline(explanation)" />
          <span v-for="(x, i) in quotes" :key="i" class="wq"><b>{{ x.lead }}:</b> <q>{{ x.q }}</q> <CiteChip :cite="x.c" /></span>
          <CiteChip v-for="(c, i) in cites.slice(2)" :key="'more' + i" :cite="c" />
          <span v-if="beyond" class="wbeyond">
            <Ico name="flag" />Beyond your slides: the Checker found no passage in your notes that covers this. Treat it as extra reading, not exam material.
          </span>
          <span v-if="rewritten" class="wre">This question was rewritten after the Checker rejected the first version against your notes.</span>
        </div>
      </div>
    </div>
    <span class="sr-only" aria-live="polite">{{ live }}</span>
  </div>
</template>

<style>
/* Quiz items (player-design 5.6, 5.8, ordering with buttons). */
.bmx .q { display: grid; gap: 12px; min-width: 0; }
.bmx .q + .q { margin-top: 22px; padding-top: 22px; border-top: 1px solid var(--line); }
.bmx .q-top { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-height: 0; }
.bmx .q-top:empty { display: none; }
.bmx .q-n { font: var(--t-eyebrow); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--text-3); margin-right: 2px; }
.bmx .q-q { margin: 0; font: 600 18px/1.45 var(--body); color: var(--text); text-wrap: pretty; }
.bmx .q-hint { margin: -4px 0 2px; font: var(--t-cap); color: var(--text-3); }
.bmx .opts { display: grid; gap: 8px; margin: 0; padding: 0; border: 0; min-width: 0; }
.bmx .opt { position: relative; display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; align-items: center; gap: 12px; min-height: 54px; padding: 10px 16px 10px 12px; border-radius: var(--r-row); background: var(--surface); box-shadow: var(--hair-strong); font: 500 15.5px/1.4 var(--body); color: var(--ink-3); cursor: pointer; text-align: left; transition: background var(--d-fast), box-shadow var(--d-fast), transform var(--d-press), opacity var(--d-fast); }
.bmx .opt input { position: absolute; opacity: 0; pointer-events: none; }
.bmx .opt .k { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; box-shadow: inset 0 0 0 1.5px rgb(11 13 16 / 0.16); font: 600 12.5px/1 var(--display); color: var(--text-3); transition: background var(--d-fast), color var(--d-fast); }
.bmx .opt .k .bm-ico { width: 13px; height: 13px; }
.bmx .opts.multi .opt .k { border-radius: 8px; }
.bmx .opt:hover { background: var(--sunken); }
.bmx .opt:active { transform: scale(.995); }
.bmx .opt.sel { box-shadow: var(--hair-ink); color: var(--ink); }
.bmx .opt.sel .k { background: var(--ink); color: #fff; box-shadow: none; }
.bmx .opt:has(input:focus-visible) { outline: 3px solid var(--ink); outline-offset: 2px; }
.bmx .q.checked .opt { cursor: default; }
.bmx .opt.right { background: var(--ok-fill); box-shadow: var(--ok-ring); color: var(--ink); }
.bmx .opt.right .k { background: var(--lime); color: var(--ink); box-shadow: none; }
.bmx .opt.wrong { background: var(--bad-fill); box-shadow: var(--bad-ring); color: var(--ink); animation: shake .32s var(--ease-out); }
.bmx .opt.wrong .k { background: var(--coral-ink); color: #fff; box-shadow: none; }
.bmx .opt.missed { box-shadow: inset 0 0 0 1.5px var(--lime-2); background-image: repeating-linear-gradient(135deg, transparent 0 8px, rgb(198 242 78 / 0.14) 8px 16px); }
.bmx .opt.missed .k { color: var(--lime-ink); box-shadow: inset 0 0 0 1.5px var(--lime-2); }
.bmx .opt.dim { opacity: .62; }
.bmx .opt .flag { font: 600 11.5px/1 var(--body); color: var(--lime-ink); white-space: nowrap; }
.bmx .opt.wrong .flag { color: var(--coral-ink); }

.bmx .conf { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; opacity: .5; transition: opacity var(--d-base); }
.bmx .conf.show { opacity: 1; }
.bmx .conf .cl { font: 600 13px/1 var(--body); color: var(--text-2); margin-right: 4px; }
.bmx .conf .cb { height: 32px; padding: 0 13px; border-radius: 99px; font: 600 13px/1 var(--body); color: var(--ink-3); background: var(--surface); box-shadow: var(--hair-strong); transition: background var(--d-fast), box-shadow var(--d-fast), color var(--d-fast), transform var(--d-press); }
.bmx .conf .cb:hover:not([disabled]) { background: var(--fill); }
.bmx .conf .cb:active:not([disabled]) { transform: scale(.96); }
.bmx .conf .cb.on { background: var(--cobalt); color: #fff; box-shadow: none; }
.bmx .conf .cb[disabled] { cursor: default; }

.bmx .q-f { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
.bmx .q-note { font: var(--t-cap); color: var(--text-3); }
.bmx .verdict { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 14px 0 10px; border-radius: 99px; font: 700 14px/1 var(--body); animation: stamp .45s var(--ease-pop) both; }
.bmx .verdict .bm-ico { width: 14px; height: 14px; }
.bmx .verdict.ok { background: var(--lime); color: var(--ink); }
.bmx .verdict.part { background: var(--amber-soft); color: var(--amber-ink); }
.bmx .verdict.bad { background: var(--coral-soft); color: var(--coral-ink); }
.bmx .q-fb { margin: 0; font: 400 14.5px/1.5 var(--body); color: var(--text-2); max-width: 68ch; }
.bmx .q-cal { margin: -4px 0 0; font: 500 13.5px/1.45 var(--body); color: var(--cobalt); }

.bmx .why { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--d-slow) var(--ease-out); }
.bmx .why.open { grid-template-rows: 1fr; }
.bmx .why > div { overflow: hidden; min-height: 0; }
.bmx .why .wb { margin-top: 2px; padding: 14px 16px; border-radius: var(--r-row); background: var(--lime-soft); font: 400 14.5px/1.55 var(--body); color: var(--ink-3); }
.bmx .why.bad .wb { background: var(--sunken); box-shadow: var(--hair); }
.bmx .why .we { display: block; margin-bottom: 4px; font: var(--t-eyebrow); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--lime-ink); }
.bmx .why.bad .we { color: var(--text-2); }
.bmx .why .wbeyond, .bmx .why .wre { display: flex; gap: 8px; margin-top: 8px; font: 500 13px/1.45 var(--body); color: var(--note-ink); }
.bmx .why .wbeyond .bm-ico { width: 14px; height: 14px; margin-top: 2px; }
.bmx .why .wre { color: var(--text-2); }
.bmx .why .wq { display: block; margin-top: 6px; overflow-wrap: anywhere; }
.bmx .why .wq b { font-weight: 600; color: var(--ink); }
.bmx .why .wq q { font-style: italic; }
.bmx .why .wq .cite { vertical-align: middle; margin-left: 2px; }

.bmx .ord { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; position: relative; }
.bmx .ord li { position: relative; display: grid; grid-template-columns: 26px minmax(0, 1fr) auto; align-items: center; gap: 12px; min-height: 56px; padding: 8px 8px 8px 12px; border-radius: var(--r-row); background: var(--surface); box-shadow: var(--hair-strong); font: 500 15.5px/1.4 var(--body); color: var(--ink-3); transition: background var(--d-fast), box-shadow var(--d-fast); }
.bmx .ord .pos { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--fill-2); font: 600 12px/1 var(--display); color: var(--text-2); }
.bmx .ord .pos .bm-ico { width: 12px; height: 12px; }
.bmx .ord .mv { display: flex; gap: 4px; }
.bmx .ord .mvb { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; color: var(--ink-3); background: var(--fill); transition: background var(--d-fast), transform var(--d-press); }
.bmx .ord .mvb .bm-ico { width: 15px; height: 15px; }
.bmx .ord .mvb:hover:not([disabled]) { background: var(--fill-hover); }
.bmx .ord .mvb:active:not([disabled]) { transform: scale(.94); }
.bmx .ord .mvb[disabled] { opacity: .35; cursor: default; }
.bmx .ord li.ok { background: var(--ok-fill); box-shadow: var(--ok-ring); color: var(--ink); }
.bmx .ord li.ok .pos { background: var(--lime); color: var(--ink); }
.bmx .ord li.bad { background: var(--bad-fill); box-shadow: var(--bad-ring); color: var(--ink); }
.bmx .ord li.bad .pos { background: var(--coral-ink); color: #fff; }
.bmx .ord .flag { padding-right: 8px; font: 600 12px/1 var(--body); color: var(--coral-ink); white-space: nowrap; }
.bmx .ordmv-move { transition: transform 500ms var(--ease-out); }
.bmx .ord-show { margin-top: 10px; }

.bmx .num-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.bmx .num-f { display: inline-flex; align-items: center; gap: 8px; height: 52px; padding: 0 14px; border-radius: var(--r-row); background: var(--surface); box-shadow: var(--hair-strong); transition: box-shadow var(--d-fast), background var(--d-fast); }
.bmx .num-f:focus-within { box-shadow: inset 0 0 0 2px var(--cobalt); }
.bmx .num-f input { width: 9ch; border: 0; outline: none; background: transparent; font: 600 20px/1 var(--body); color: var(--ink); font-variant-numeric: tabular-nums; }
.bmx .num-f input::placeholder { font-size: 15px; font-weight: 500; color: var(--placeholder); }
.bmx .num-f .u { font: 500 15px/1 var(--body); color: var(--text-2); }
.bmx .num-f .bm-ico { width: 16px; height: 16px; }
.bmx .num-f.ok { background: var(--ok-fill); box-shadow: var(--ok-ring); color: var(--lime-ink); }
.bmx .num-f.bad { background: var(--bad-fill); box-shadow: var(--bad-ring); color: var(--coral-ink); }

.bmx .cz { font: 600 18px/2.1 var(--body); color: var(--text); }
.bmx .gap { position: relative; display: inline-block; vertical-align: baseline; margin: 0 2px; }
.bmx .gap input { width: calc(var(--w, 8) * 1ch + 1.4em); max-width: 100%; height: 1.75em; padding: 0 .5em; border: 0; border-radius: 8px 8px 4px 4px; background: var(--fill-2); box-shadow: inset 0 -2px 0 var(--cobalt); font: 600 .95em/1 var(--body); color: var(--ink); text-align: center; transition: background var(--d-fast), box-shadow var(--d-fast); }
.bmx .gap input:focus { outline: none; background: var(--surface); box-shadow: inset 0 0 0 2px var(--cobalt); }
.bmx .gap.ok input { background: var(--lime-soft); box-shadow: inset 0 -2px 0 var(--lime-2); color: var(--lime-ink); }
.bmx .gap.bad input { background: var(--coral-soft); box-shadow: inset 0 -2px 0 var(--coral); color: var(--coral-ink); text-decoration: line-through; }
.bmx .gap .fix { position: absolute; left: 50%; bottom: calc(100% + 2px); translate: -50% 0; padding: 5px 9px; border-radius: 8px; background: var(--ink); color: #fff; font: 600 12.5px/1 var(--body); white-space: nowrap; animation: pop .3s var(--ease-pop-2); z-index: 2; }

.bmx .selfm { display: grid; gap: 12px; }
.bmx .sa { position: relative; display: block; }
.bmx .sa textarea { width: 100%; min-height: 112px; padding: 14px 16px 28px; border: 0; border-radius: var(--r-row); background: var(--surface-2); box-shadow: var(--hair-strong); font: 400 16px/1.55 var(--body); color: var(--ink); resize: vertical; transition: box-shadow var(--d-fast), background var(--d-fast); }
.bmx .sa textarea:focus { outline: none; background: var(--surface); box-shadow: inset 0 0 0 2px var(--cobalt); }
.bmx .sa .wc { position: absolute; right: 12px; bottom: 9px; font: var(--t-cap); color: var(--text-3); pointer-events: none; }
.bmx .smi-cmp { display: grid; gap: 14px; animation: pop .3s var(--ease-out); }
.bmx .model { padding: 14px 16px; border-radius: var(--r-row); background: var(--cobalt-soft); }
.bmx .model .eyebrow-s { color: var(--cobalt); display: block; margin-bottom: 6px; }
.bmx .rub { display: grid; gap: 14px; }
.bmx .rrow { display: grid; gap: 8px; }
.bmx .rc { margin: 0; font: 600 15px/1.4 var(--body); color: var(--text); }
.bmx .rc small { font: 500 12px/1 var(--body); color: var(--text-3); margin-left: 6px; }
.bmx .lv { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.bmx .lv.quick { grid-template-columns: repeat(3, minmax(0, 160px)); }
.bmx .lvb { display: grid; gap: 4px; align-content: start; text-align: left; padding: 10px 12px; border-radius: 12px; background: var(--surface); box-shadow: var(--hair-strong); color: var(--ink-3); transition: background var(--d-fast), box-shadow var(--d-fast), transform var(--d-press); }
.bmx .lvb b { font: 600 13.5px/1.2 var(--body); color: var(--ink); }
.bmx .lvb small { font: 400 12.5px/1.4 var(--body); color: var(--text-2); }
.bmx .lvb:hover:not([disabled]) { background: var(--fill); }
.bmx .lvb:active:not([disabled]) { transform: scale(.98); }
.bmx .lvb.on { box-shadow: var(--hair-ink); background: var(--surface); }
.bmx .lvb.on.excellent, .bmx .quick .lvb.on:first-child { background: var(--lime-soft); box-shadow: var(--ok-ring); }
.bmx .lvb.on.poor { background: var(--coral-soft); box-shadow: var(--bad-ring); }
.bmx .lvb[disabled] { cursor: default; }
@media (max-width: 640px) { .bmx .lv { grid-template-columns: minmax(0, 1fr); } .bmx .lv.quick { grid-template-columns: repeat(3, minmax(0, 1fr)); } .bmx .opt { grid-template-columns: 28px minmax(0, 1fr); } .bmx .opt .flag { grid-column: 2; } }
.bmx .dlv { margin: -6px -12px 0; padding: 0; list-style: none; display: grid; gap: 2px; }
.bmx .dlv-h { margin: 4px 0 0; }
</style>
