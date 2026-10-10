<script setup lang="ts">
// Playground / explorable (player-design §5.14): sliders bound to the lesson's compute(i) formula. The
// formula runs in a Blob Web Worker (1.5 s kill); one batch per change = the current value + a 28-point
// sweep of the first input, drawn as a cobalt area chart with a marker at the current setting. Crossing
// payload.discover fills that zone lime and says "You found it", which marks the block passed.
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import type { Course, CourseLesson } from '@bilimind/core';
import type { BlockOf } from './types.ts';
import BlockHead from './reading/BlockHead.vue';
import CiteChips from './reading/CiteChips.vue';
import Icon from './reading/Icon.vue';
import { keepCase, renderMarkdown } from './reading/markdown.ts';
import { useCues } from './reading/cues.ts';
import { emitPassed, store } from './reading/util.ts';
import {
  PlaygroundRunner, buildCalls, chartGeometry, crossed, fmtInput, fmtOutput, sweepXs,
  type Discover, type PlayInput,
} from './reading/playground.ts';
import './reading/reading.css';

const props = defineProps<{ block: BlockOf<'playground'>; lesson: CourseLesson; course: Course }>();
const root = ref<HTMLElement | null>(null);
useCues(root, () => props.block);

const p = computed(() => props.block.payload);
const inputs = computed<PlayInput[]>(() => (p.value?.inputs ?? []) as PlayInput[]);
const discover = computed<Discover | undefined>(() => (p.value as { discover?: Discover } | undefined)?.discover);
const guide = computed(() => renderMarkdown(p.value?.guidance_markdown ?? ''));
const swept = computed(() => inputs.value[0]);

const values = reactive<Record<string, number>>({});
function reset() { for (const i of inputs.value) values[i.key] = i.default; }
watch(inputs, reset, { immediate: true });

const output = ref<number | null>(null);
const sweep = ref<(number | null)[]>([]);
const error = ref<string | null>(null);
const busy = ref(false);

const runner = new PlaygroundRunner();
let timer: ReturnType<typeof setTimeout> | undefined;
let ticket = 0;

async function evaluate() {
  const formula = p.value?.formula_js;
  if (!formula || !inputs.value.length) { error.value = 'This explorable has no formula.'; return; }
  const mine = ++ticket;
  busy.value = true;
  const r = await runner.run(formula, buildCalls(inputs.value, values));
  if (mine !== ticket) return;
  busy.value = false;
  if (r.error || r.values[0] === null || r.values[0] === undefined) {
    error.value = r.timedOut ? 'The calculation took too long, so it was stopped.' : 'This calculation could not run here.';
    output.value = null;
    sweep.value = r.values.slice(1);
    return;
  }
  error.value = null;
  output.value = r.values[0];
  sweep.value = r.values.slice(1);
}
function schedule() { clearTimeout(timer); timer = setTimeout(() => void evaluate(), 60); }
watch(values, schedule, { deep: true });
onMounted(() => void evaluate());
onBeforeUnmount(() => { clearTimeout(timer); runner.dispose(); });

// discovery (persisted per course so a reload keeps the lime chip)
const foundKey = computed(() => `bm:${props.course?.id ?? 'course'}:found`);
const foundId = computed(() => `${props.lesson?.id ?? ''}/${props.block.id ?? ''}`);
const found = ref(false);
onMounted(() => {
  try { found.value = (JSON.parse(store.get(foundKey.value) ?? '[]') as string[]).includes(foundId.value); } catch { found.value = false; }
});
const crossing = computed(() => crossed(discover.value, values));
watch(crossing, now => {
  if (!now || found.value) return;
  found.value = true;
  try {
    const list = new Set(JSON.parse(store.get(foundKey.value) ?? '[]') as string[]);
    list.add(foundId.value);
    store.set(foundKey.value, JSON.stringify([...list]));
  } catch { /* not persisted */ }
  emitPassed(root.value, props.lesson?.id ?? '', props.block.id, 'discover');
});

// slider fill (--p)
const pct = (i: PlayInput) => {
  const span = i.max - i.min;
  return span > 0 ? `${(((values[i.key] ?? i.default) - i.min) / span) * 100}%` : '0%';
};

// chart: measured width so text stays crisp
const plot = ref<HTMLElement | null>(null);
const width = ref(560);
const H = 240;
let ro: ResizeObserver | null = null;
onMounted(() => {
  if (!plot.value) return;
  width.value = Math.round(plot.value.clientWidth) || 560;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(([e]) => { const w = Math.round(e?.contentRect.width ?? 0); if (w > 0) width.value = w; });
    ro.observe(plot.value);
  }
});
onBeforeUnmount(() => ro?.disconnect());
const chartH = computed(() => (width.value < 480 ? 200 : H));

const geom = computed(() => {
  const s = swept.value;
  return chartGeometry({
    w: width.value, h: chartH.value, xs: sweepXs(s), ys: sweep.value,
    current: s ? values[s.key] ?? s.default : null, currentY: output.value,
    step: s?.step ?? 1, discover: discover.value, sweptKey: s?.key,
  });
});
const pillW = computed(() => Math.max(34, fmtOutput(output.value).length * 7.4 + 16));
const gradId = computed(() => `exArea-${props.block.id ?? 'x'}`);
const unit = computed(() => p.value?.output_unit ?? '');
</script>

<template>
  <section ref="root" class="blk card task wide blk-ex" :class="{ passed: found }" :data-block="block.id" data-type="playground">
    <BlockHead type="playground" :title="block.title">
      <template #act>
        <span v-if="found" class="tag ok stamp"><Icon name="i-check" style="width:11px;height:11px" />Found it</span>
        <button type="button" class="ghost" @click="reset"><Icon name="i-refresh" />Reset</button>
      </template>
    </BlockHead>
    <div class="ex-guide"><div class="prose" data-field="guidance_markdown" v-html="guide" /></div>
    <div class="ex-grid">
      <div class="ex-ctl">
        <div v-for="i in inputs" :key="i.key" class="ex-row">
          <label :for="`ex-${block.id}-${i.key}`"><span>{{ i.label }}</span>
            <output :for="`ex-${block.id}-${i.key}`">{{ fmtInput(values[i.key] ?? i.default, i.step) }}<small v-if="i.unit">{{ i.unit }}</small></output>
          </label>
          <input :id="`ex-${block.id}-${i.key}`" v-model.number="values[i.key]" class="range" type="range"
            :min="i.min" :max="i.max" :step="i.step" :style="{ '--p': pct(i) }" />
          <span class="lim"><span>{{ fmtInput(i.min, i.step) }}</span><span>{{ fmtInput(i.max, i.step) }}</span></span>
        </div>
        <div class="ex-out" aria-live="polite">
          <span class="we" v-html="keepCase(p?.output_label ?? 'Result')" />
          <b>{{ fmtOutput(output) }}<small v-if="unit && output !== null">{{ unit }}</small></b>
          <p v-if="error" class="err">{{ error }}</p>
        </div>
        <div v-if="found && discover" class="ex-found" role="status"><i><Icon name="i-check" /></i><span>You found it: {{ discover.say }}</span></div>
        <div v-else-if="discover" class="ex-hint"><Icon name="i-target" />Something happens somewhere on this range. Find it.</div>
      </div>
      <div ref="plot" class="ex-plot">
        <p class="cap"><span>{{ p?.output_label ?? 'Result' }}<template v-if="unit"> ({{ unit }})</template></span><span v-if="swept">as {{ swept.label }} changes →</span></p>
        <svg class="ex-chart" :viewBox="`0 0 ${width} ${chartH}`" :style="{ height: chartH + 'px' }" role="img"
          :aria-label="`${p?.output_label ?? 'Output'} as ${swept?.label ?? 'the input'} varies`">
          <defs>
            <linearGradient :id="gradId" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stop-color="#2340E6" stop-opacity="0.18" /><stop offset="1" stop-color="#2340E6" stop-opacity="0" />
            </linearGradient>
          </defs>
          <template v-if="geom.zone">
            <rect class="zone" :class="{ on: found }" :x="geom.zone.x" :y="geom.pad.t" :width="Math.max(0, geom.zone.w)" :height="chartH - geom.pad.t - geom.pad.b" rx="6" />
            <line class="zone-l" :class="{ on: found }" :x1="discover && discover.op.startsWith('>') ? geom.zone.x : geom.zone.x + geom.zone.w" :x2="discover && discover.op.startsWith('>') ? geom.zone.x : geom.zone.x + geom.zone.w" :y1="geom.pad.t" :y2="chartH - geom.pad.b" />
          </template>
          <g class="grid">
            <line v-for="(t, k) in geom.yTicks" :key="'y' + k" :x1="geom.pad.l" :x2="width - geom.pad.r" :y1="t.y" :y2="t.y" />
          </g>
          <text v-for="(t, k) in geom.yTicks" :key="'yl' + k" class="ax" :x="geom.pad.l - 8" :y="t.y + 4" text-anchor="end">{{ t.label }}</text>
          <text v-for="(t, k) in geom.xTicks" :key="'xl' + k" class="ax" :x="t.x" :y="chartH - 6" text-anchor="middle">{{ t.label }}</text>
          <path v-if="geom.area" class="area" :d="geom.area" :style="{ fill: `url(#${gradId})` }" />
          <path v-if="geom.path" class="line" :d="geom.path" />
          <template v-if="geom.markerX !== null">
            <line class="mark" :x1="geom.markerX" :x2="geom.markerX" :y1="geom.pad.t" :y2="chartH - geom.pad.b" />
            <template v-if="geom.markerY !== null">
              <circle class="dot" :cx="geom.markerX" :cy="geom.markerY" r="6" />
              <g :transform="`translate(${Math.min(width - geom.pad.r - pillW, Math.max(geom.pad.l, geom.markerX - pillW / 2))}, ${Math.max(0, geom.markerY - 34)})`">
                <rect class="pill-bg" :width="pillW" height="22" rx="11" />
                <text class="pill-tx" :x="pillW / 2" y="15" text-anchor="middle">{{ fmtOutput(output) }}</text>
              </g>
            </template>
          </template>
        </svg>
      </div>
    </div>
    <CiteChips :cites="block.cites" :course="course" />
  </section>
</template>
