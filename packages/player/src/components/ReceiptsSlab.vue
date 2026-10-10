<script setup lang="ts">
// "Checked before you saw it" (player-design §3.5): the agents' receipts in student language, the
// answers the Checker threw out (and why), and the per-agent log behind a disclosure.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Course } from '@bilimind/core';
import { fmtMinutes } from '../runtime/time.ts';
import CiteChip from './CiteChip.vue';

const props = defineProps<{ course: Course }>();
const r = computed(() => props.course.receipts);
const steps = computed(() => {
  const x = r.value;
  // G2 review: cut path steps, from course.path (plan.cut also lists cut subtopics)
  const cut = x.cut_steps ?? props.course.path.filter(t => t.cut).length;
  const total = x.quiz_items ?? x.quiz_checked;
  const code = x.tests.run > 0
    ? { n: `${x.tests.passed}/${x.tests.run}`, l: `code tests passed${x.code_fixed ? `, ${x.code_fixed} fixed by the Coder` : ''}` }
    : { n: `${x.checks.passed}/${x.checks.run}`, l: `lesson checks passed${x.checks.repaired ? `, ${x.checks.repaired} repaired` : ''}` };
  return [
    { icon: 'i-file', n: String(x.files), l: `file${x.files === 1 ? '' : 's'} read, ${x.pages} pages` },
    { icon: 'i-path', n: String(x.steps), l: `steps planned${cut ? `, ${cut} cut to fit your days` : ''}` },
    { icon: 'i-pencil', n: String(x.lessons), l: `lesson${x.lessons === 1 ? '' : 's'} written by ${x.agents} agents` },
    { icon: 'i-code', ...code },
    x.quiz_checked > 0
      ? { icon: 'i-quiz', n: total && total !== x.quiz_checked ? `${x.quiz_checked}/${total}` : String(x.quiz_checked), l: `auto-marked answers re-solved and checked against your files${x.rejected ? `, ${x.rejected} rejected` : ''}` }
      : { icon: 'i-quiz', n: String(total ?? 0), l: 'auto-marked questions, not yet checked against your files' },
    { icon: 'i-mic', n: x.narration_min >= 1 ? fmtMinutes(x.narration_min) : `${Math.round(x.narration_min * 60)}s`, l: 'of narration recorded' },
  ];
});
const extras = computed(() => {
  const x = r.value;
  const out: { b: string; t: string }[] = [];
  if (x.rewritten) out.push({ b: String(x.rewritten), t: `question${x.rewritten > 1 ? 's' : ''} rewritten after a rejection` });
  if (x.labels.beyond_slides) out.push({ b: String(x.labels.beyond_slides), t: `answer${x.labels.beyond_slides > 1 ? 's' : ''} labelled "beyond your slides"` });
  if (x.tests.run > 0 && x.checks.run) out.push({ b: `${x.checks.passed}/${x.checks.run}`, t: 'lesson checks passed' });
  if (x.checks.repaired) out.push({ b: String(x.checks.repaired), t: 'repairs made before you saw it' });
  if (x.wall_ms) out.push({ b: fmtWall(x.wall_ms), t: 'from files to course' });
  if (x.cost_usd || x.cost_usd === 0) out.push({ b: `$${x.cost_usd < 0.01 ? x.cost_usd.toFixed(4) : x.cost_usd.toFixed(2)}`, t: 'in text-model calls' });
  if (x.credits != null) out.push({ b: String(x.credits), t: 'WorkBuddy credits' });
  return out;
});
const ledeText = computed(() => {
  const x = r.value;
  const total = x.quiz_items ?? x.quiz_checked;
  if (!x.quiz_checked) return `WorkBuddy split the work across ${x.agents} agents and ran ${x.checks.run} checks on the lessons.`;
  return `WorkBuddy split the work across ${x.agents} agents. The Checker re-solved ${x.quiz_checked === total ? 'every auto-marked answer' : `${x.quiz_checked} of ${total} auto-marked answers`} and checked ${x.quiz_checked === 1 ? 'it' : 'them'} against the page ${x.quiz_checked === 1 ? 'it came' : 'they came'} from.`;
});
function fmtWall(ms: number): string { const s = Math.round(ms / 1000); return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`; }
const open = ref(false);
const el = ref<HTMLElement | null>(null);
const seen = ref(false);
let io: IntersectionObserver | null = null;
onMounted(() => {
  if (!el.value || typeof IntersectionObserver === 'undefined') { seen.value = true; return; }
  io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { seen.value = true; io?.disconnect(); } }, { threshold: 0.3 });
  io.observe(el.value);
});
onBeforeUnmount(() => io?.disconnect());
</script>

<template>
  <section ref="el" class="slab ink c-proof" :class="{ in: seen }" aria-labelledby="proof-h">
    <span class="eb on-dark"><span class="dot"><svg aria-hidden="true"><use href="#i-check" /></svg></span>How this course was made</span>
    <h2 id="proof-h" class="display" style="margin-top: 20px">Checked <span class="hchip" aria-hidden="true"><svg><use href="#i-check" /></svg></span> <span class="lime">before you saw it.</span></h2>
    <p class="lede">{{ ledeText }}</p>
    <ul class="c-steps">
      <li v-for="(s, i) in steps" :key="s.icon">
        <span class="ic"><svg aria-hidden="true"><use :href="'#' + s.icon" /></svg></span><b>{{ s.n }}</b><span>{{ s.l }}</span><i v-if="i === 0" class="pulse" aria-hidden="true"></i>
      </li>
    </ul>
    <div v-if="extras.length" class="extra">
      <span v-for="x in extras" :key="x.t" class="tag"><b>{{ x.b }}</b>{{ x.t }}</span>
    </div>
    <div v-if="r.excluded.length" class="caught">
      <article v-for="x in r.excluded" :key="x.lesson + x.item" class="caught-card on-dark">
        <span class="hd"><svg aria-hidden="true"><use href="#i-x" /></svg>Rejected by the Checker</span>
        <s>{{ x.prompt }}</s>
        <p>{{ x.reason }}</p>
        <p v-if="x.quote">Your file says: <q>{{ x.quote }}</q><CiteChip v-if="x.cite" :cite="x.cite" /></p>
        <span v-if="x.replaced_by" class="fix"><svg aria-hidden="true"><use href="#i-check" /></svg>Rewritten, re-checked, and now in the lesson</span>
      </article>
    </div>
    <button v-if="r.log.length" type="button" class="log-toggle" :aria-expanded="open" aria-controls="agent-log" @click="open = !open">
      {{ open ? 'Hide' : 'See' }} what each agent did <svg aria-hidden="true"><use href="#i-down" /></svg>
    </button>
    <ol v-if="open" id="agent-log" class="log">
      <li v-for="(e, i) in r.log" :key="i"><span class="t">{{ e.t }}</span><span class="a">{{ e.agent }}</span><span class="c">{{ e.action }}</span><span class="r">{{ e.result }}</span></li>
    </ol>
  </section>
</template>
