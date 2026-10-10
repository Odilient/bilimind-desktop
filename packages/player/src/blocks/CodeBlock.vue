<script setup lang="ts">
// Runnable code (WP5c, player-design 5.5): the task, then the ink stage. Run executes the JS tests in a
// Blob worker (killed after 1.5 s), rows flip to pass/fail one by one, core gradeCode() scores the run.
// Hints unlock after the first run. A "Tested before delivery" badge says the reference solution passed
// every check in the Coder's run (the engine ships no code block whose reference fails).
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { gradeCode } from '@bilimind/core';
import type { Course, CourseLesson, GradeResult } from '@bilimind/core';
import type { BlockOf } from './types.ts';
import { renderMd } from '../assessments/md.ts';
import { runJs, TIMEOUT_MS } from '../assessments/runner.ts';
import type { RunResult } from '../assessments/runner.ts';
import { highlight } from '../assessments/highlight.ts';
import { isPassedStored, loadUi, markPassed, saveUi } from '../assessments/store.ts';
import TaskShell from '../assessments/ui/TaskShell.vue';
import Ico from '../assessments/ui/Ico.vue';
import CodeEditor from '../assessments/CodeEditor.vue';
import SelfMarkedItem from '../assessments/SelfMarkedItem.vue';

const props = defineProps<{ block: BlockOf<'code'>; lesson: CourseLesson; course: Course }>();
const p = computed(() => props.block.payload);
const item = computed(() => props.block.assessments.find(a => a.kind === 'code') ?? props.block.assessments[0] ?? null);
const tests = computed(() => p.value.tests ?? []);
const isJs = computed(() => p.value.language === 'javascript');
const selfGraded = computed(() => !tests.value.length || item.value?.grader === 'self');
const runnable = computed(() => isJs.value && (p.value.mode === 'function' || p.value.mode === 'debug'));
const graded = computed(() => runnable.value && !selfGraded.value);
const reference = computed(() => ((item.value?.answer_key ?? {}) as { reference_solution?: string }).reference_solution ?? '');
const tested = computed(() => graded.value && !!reference.value);

const uiKey = `${props.lesson.id}/${props.block.id}`;
const saved = loadUi<{ code?: string; runs?: number }>(props.course.id, uiKey, {});
const code = ref(saved.code ?? p.value.starter_code ?? '');
let saveTimer: ReturnType<typeof setTimeout> | undefined;
watch(code, v => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveUi(props.course.id, uiKey, v === p.value.starter_code ? null : { code: v }), 400);
});
onBeforeUnmount(() => clearTimeout(saveTimer));

type RowState = 'idle' | 'run' | 'pass' | 'fail';
const rows = ref<{ name: string; s: RowState; detail: string }[]>(tests.value.map(t => ({ name: t.name, s: 'idle', detail: '' })));
const running = ref(false);
const runs = ref(0);
const last = ref<RunResult | null>(null);
const grade = ref<GradeResult | null>(null);
const tab = ref<'checks' | 'console'>('checks');
const hintsShown = ref(0);
const showRef = ref(false);
const passed = ref(isPassedStored(props.course.id, props.lesson.id, props.block.id));
const burst = ref(0);
const live = ref('');

const hints = computed(() => p.value.hints ?? []);
const passCount = computed(() => rows.value.filter(r => r.s === 'pass').length);
const allGreen = computed(() => !!grade.value?.correct);
const statusText = computed(() => {
  if (running.value) return 'Running…';
  if (!last.value) return graded.value ? `${tests.value.length} checks ready` : 'Ready';
  if (last.value.timedOut) return `Stopped after ${(TIMEOUT_MS / 1000).toFixed(1)} s`;
  if (!graded.value) return `Ran in ${last.value.ms} ms`;
  return `${passCount.value}/${tests.value.length} passing · ${last.value.ms} ms`;
});
const glyph = computed(() => ({ javascript: 'JS', python: 'PY', sql: 'SQL', html: 'HTML' } as Record<string, string>)[p.value.language] ?? 'JS');
const fileName = computed(() => ({ javascript: 'solution.js', python: 'solution.py', sql: 'query.sql', html: 'index.html' } as Record<string, string>)[p.value.language] ?? 'solution.js');
const langName = computed(() => ({ javascript: 'JavaScript', python: 'Python', sql: 'SQL', html: 'HTML' } as Record<string, string>)[p.value.language] ?? p.value.language);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function run() {
  if (running.value) return;
  running.value = true;
  tab.value = graded.value ? 'checks' : 'console';
  rows.value = rows.value.map(r => ({ ...r, s: 'run', detail: '' }));
  const res = await runJs(code.value, graded.value ? tests.value : []);
  last.value = res;
  runs.value += 1;
  if (graded.value) {
    for (let i = 0; i < rows.value.length; i++) {
      const out = res.results.find(r => r.name === rows.value[i]!.name);
      const ok = !!out?.passed;
      const detail = !out ? '' : ok ? '' : out.error ? out.error : `expected ${out.expected}, got ${out.actual}`;
      rows.value[i] = { name: rows.value[i]!.name, s: ok ? 'pass' : 'fail', detail };
      await sleep(120);
    }
    grade.value = item.value ? gradeCode(item.value, res.passed, tests.value.map(t => t.name), res.timedOut) : null;
    live.value = grade.value?.feedback ?? '';
    if (grade.value?.correct) {
      burst.value += 1;
      if (!passed.value) { passed.value = true; markPassed(props.course.id, props.lesson.id, props.block.id); }
    }
  } else {
    tab.value = 'console';
    live.value = res.runtimeError || res.syntaxError || 'Ran.';
  }
  running.value = false;
}
function reset() {
  code.value = p.value.starter_code ?? '';
  rows.value = tests.value.map(t => ({ name: t.name, s: 'idle', detail: '' }));
  last.value = null;
  grade.value = null;
}
function nextHint() { if (runs.value > 0 && hintsShown.value < hints.value.length) hintsShown.value += 1; }
const consoleLines = computed(() => {
  const r = last.value;
  if (!r) return [];
  const out = r.logs.map(l => ({ cls: l.k === 'log' ? '' : 'err', t: l.t }));
  if (r.syntaxError && !out.length) out.push({ cls: 'err', t: r.syntaxError });
  if (r.runtimeError) out.push({ cls: 'err', t: r.runtimeError });
  if (r.timedOut && !out.length) out.push({ cls: 'err', t: `Stopped after ${(TIMEOUT_MS / 1000).toFixed(1)} seconds. An endless loop?` });
  return out;
});
const confetti = computed(() => Array.from({ length: 14 }, (_, i) => ({
  '--dx': `${Math.round(Math.cos((i / 14) * Math.PI * 2) * (60 + (i % 3) * 22))}px`,
  '--dy': `${Math.round(Math.sin((i / 14) * Math.PI * 2) * (46 + (i % 4) * 14) - 30)}px`,
  '--r': `${(i * 47) % 360}deg`,
  background: ['var(--lime)', 'var(--cobalt-3)', '#fff', 'var(--lime-2)'][i % 4],
})));
</script>

<template>
  <TaskShell :block="block" :passed="passed">
    <template #actions>
      <span v-if="tested" class="tag cob opt-long" title="The Coder ran these checks against a reference solution before the course was delivered">
        <Ico name="shield" />Tested before delivery
      </span>
    </template>

    <div class="cb-task">
      <div v-if="p.mode === 'debug' && p.symptom_markdown" class="cb-symptom">
        <span class="ci"><Ico name="warning" /></span>
        <div><span class="ce">What it does now</span>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="md sm" v-html="renderMd(p.symptom_markdown)" />
        </div>
      </div>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="md sm" v-html="renderMd(p.instructions_markdown)" />
      <div class="cb-tags">
        <span v-if="graded" class="tag quiet">{{ tests.length }} check{{ tests.length === 1 ? '' : 's' }}</span>
        <span class="tag quiet">{{ langName }}</span>
        <span class="tag quiet">{{ isJs ? 'Runs on your laptop' : 'Runs in the full app' }}</span>
        <span v-if="tested" class="tag ok"><Ico name="check" />Reference solution passes {{ tests.length }}/{{ tests.length }}</span>
        <span v-else-if="selfGraded && item" class="tag note">Mark it yourself</span>
      </div>
    </div>

    <div class="code-stage" :class="{ passed: allGreen }">
      <div class="cs-h">
        <span class="gl">{{ glyph }}</span>
        <b>{{ fileName }}</b>
        <span class="mt">{{ p.mode }}{{ graded ? ` · ${tests.length} checks` : '' }}</span>
        <span class="rs" :class="isJs ? (last && graded ? (allGreen ? 'ready' : 'failing') : 'ready') : ''"><i />{{ isJs ? (last && graded ? `${passCount}/${tests.length} passing` : 'Ready') : 'Read-only here' }}</span>
      </div>
      <CodeEditor v-model="code" :language="p.language" :label="`Code editor, ${langName}`" @run="run" />
      <div class="cs-tabs" role="tablist">
        <button v-if="graded" type="button" role="tab" :aria-selected="tab === 'checks'" @click="tab = 'checks'">Checks</button>
        <button type="button" role="tab" :aria-selected="tab === 'console'" @click="tab = 'console'">Console</button>
      </div>
      <ul v-if="graded && tab === 'checks'" class="cs-checks">
        <li v-for="r in rows" :key="r.name" :data-s="r.s" :data-test="r.name">
          <span class="st"><Ico v-if="r.s === 'pass'" name="check" /><Ico v-else-if="r.s === 'fail'" name="x" /></span>
          <span class="nm">{{ r.name }}<span v-if="r.detail" class="dt">{{ r.detail }}</span></span>
        </li>
      </ul>
      <pre v-else class="cs-console" aria-live="off"><template v-if="consoleLines.length"><span v-for="(l, i) in consoleLines" :key="i" :class="l.cls">{{ l.t }}
</span></template><span v-else class="dim">{{ last ? 'No output. Use console.log to print.' : 'Press Run. Anything you console.log shows up here.' }}</span></pre>
      <div class="cs-foot">
        <span class="runw">
          <button type="button" class="cs-run" :disabled="!isJs || running" data-run @click="run"><Ico name="play" />{{ running ? 'Running' : 'Run' }}</button>
          <span v-for="b in burst ? confetti : []" :key="`${burst}-${b['--r']}`" class="cf" :style="b" />
        </span>
        <span class="cs-kbd">Ctrl ⏎</span>
        <span class="cs-st" :class="last ? (allGreen ? 'good' : graded ? 'bad' : '') : ''" data-status>{{ statusText }}</span>
        <span class="grow" />
        <button type="button" class="cs-ghost" @click="reset">Reset</button>
        <button v-if="hints.length" type="button" class="cs-ghost" :aria-disabled="runs === 0 || hintsShown >= hints.length"
          :title="runs === 0 ? 'Have a go first. A hint read before trying replaces the trying.' : ''" @click="nextHint">
          <Ico v-if="runs === 0" name="lock" />Hint{{ hints.length > 1 ? ` ${Math.min(hintsShown + 1, hints.length)}/${hints.length}` : '' }}
        </button>
      </div>
    </div>

    <p v-if="hints.length && runs === 0" class="cb-lock">Hints unlock after your first run. Have a go first: a hint read before trying replaces the trying.</p>
    <ol v-if="hintsShown" class="cb-hints">
      <li v-for="(h, i) in hints.slice(0, hintsShown)" :key="i"><span class="hn">Hint {{ i + 1 }}</span>{{ h }}</li>
    </ol>
    <p v-if="grade && !allGreen" class="q-fb cb-fb">{{ grade.feedback }}</p>
    <p v-if="allGreen" class="cb-win"><Ico name="check" />All {{ tests.length }} checks pass. Same checks the Coder ran on the reference solution.</p>

    <template v-if="graded && reference && runs >= 2 && !allGreen">
      <button v-if="!showRef" type="button" class="btn ghost sm cb-ref-b" @click="showRef = true">See the reference solution</button>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <pre v-else class="cb-ref" v-html="highlight(reference, p.language)" />
    </template>

    <SelfMarkedItem v-if="!graded && item" class="cb-self" :item="item" :uid="`code-${lesson.id}-${block.id}`" />
    <span class="sr-only" aria-live="polite">{{ live }}</span>
  </TaskShell>
</template>

<style>
.bmx .cb-task { display: grid; gap: 12px; }
.bmx .cb-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.bmx .cb-symptom { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 12px; padding: 14px 16px 14px 14px; border-radius: var(--r-sm); background: var(--coral-soft); color: var(--ink-3); }
.bmx .cb-symptom .ci { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; background: var(--coral-ink); color: #fff; }
.bmx .cb-symptom .ci .bm-ico { width: 16px; height: 16px; }
.bmx .cb-symptom .ce { display: block; margin: 3px 0 6px; font: var(--t-eyebrow); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--coral-ink); }

.bmx .code-stage { position: relative; margin-top: 16px; border-radius: var(--r-sm); overflow: hidden; background: var(--code-bg); color: var(--code-text); box-shadow: 0 30px 50px -30px rgb(0 0 0 / 0.55); transition: box-shadow var(--d-base); }
.bmx .code-stage.passed { box-shadow: 0 0 0 2px var(--lime), 0 30px 60px -26px rgb(198 242 78 / 0.45); }
.bmx .cs-h { display: flex; align-items: center; gap: 9px; height: 44px; padding: 0 12px; border-bottom: 1px solid var(--code-line); font-size: 12.5px; white-space: nowrap; }
.bmx .cs-h .gl { width: 24px; height: 24px; border-radius: 7px; flex: none; display: grid; place-items: center; background: #1E2A44; color: var(--code-fn); font: 700 9.5px/1 var(--body); letter-spacing: .02em; }
.bmx .cs-h b { color: #fff; font-weight: 600; font-size: 13px; }
.bmx .cs-h .mt { color: var(--code-dim); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; }
.bmx .cs-h .rs { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--code-dim); }
.bmx .cs-h .rs i { width: 7px; height: 7px; border-radius: 50%; background: var(--code-com); }
.bmx .cs-h .rs.ready i { background: var(--code-pass); }
.bmx .cs-ed { font-variant-ligatures: none; font-feature-settings: "liga" 0, "calt" 0; display: grid; grid-template-columns: 44px minmax(0, 1fr); max-height: calc(22 * 1.7em + 28px); overflow: auto; font: var(--t-code); cursor: text; }
.bmx .cs-ed .gut { margin: 0; padding: 14px 12px 14px 0; text-align: right; color: var(--code-gutter); white-space: pre; user-select: none; font: inherit; }
.bmx .cs-ed .area { position: relative; display: grid; width: max-content; min-width: 100%; }
.bmx .cs-ed .gut, .bmx .cs-ed .hl { margin: 0; }
.bmx .cs-ed .hl, .bmx .cs-ed textarea { font-variant-ligatures: none; font-feature-settings: "liga" 0, "calt" 0; grid-area: 1 / 1; margin: 0; padding: 14px 16px 14px 2px; border: 0; font: inherit; letter-spacing: 0; white-space: pre; tab-size: 2; word-wrap: normal; overflow-wrap: normal; }
.bmx .cs-ed .hl { pointer-events: none; color: var(--code-text); overflow: visible; min-height: calc(8 * 1.7em + 28px); }
.bmx .cs-ed textarea { position: relative; inset: auto; width: 100%; height: 100%; min-width: 0; resize: none; overflow: hidden; background: transparent; color: transparent; caret-color: var(--lime); outline: none; -webkit-text-fill-color: transparent; }
.bmx .cs-ed textarea::selection { background: rgb(35 64 230 / 0.6); color: transparent; -webkit-text-fill-color: transparent; }
.bmx .cs-ed:focus-within { box-shadow: inset 0 0 0 1.5px rgb(198 242 78 / 0.5); }
.bmx .tk-k { color: var(--code-kw); } .bmx .tk-f { color: var(--code-fn); } .bmx .tk-s { color: var(--code-str); } .bmx .tk-n { color: var(--code-num); } .bmx .tk-c { color: var(--code-com); font-style: italic; }
.bmx .cs-tabs { display: flex; gap: 2px; padding: 0 10px; border-top: 1px solid var(--code-line); border-bottom: 1px solid var(--code-line); }
.bmx .cs-tabs button { padding: 10px 10px 8px; border-bottom: 2px solid transparent; font: 500 12.5px/1 var(--body); color: #7C8290; }
.bmx .cs-tabs button[aria-selected="true"] { color: #fff; border-bottom-color: var(--lime); }
.bmx .cs-checks { margin: 0; padding: 6px 14px; list-style: none; min-height: 120px; }
.bmx .cs-checks li { display: grid; grid-template-columns: 16px minmax(0, 1fr); gap: 10px; padding: 9px 0; border-top: 1px solid rgb(255 255 255 / 0.06); }
.bmx .cs-checks li:first-child { border-top: 0; }
.bmx .cs-checks .st { width: 16px; height: 16px; margin-top: 1px; border-radius: 50%; display: grid; place-items: center; color: var(--code-bg); }
.bmx .cs-checks .st .bm-ico { display: block; width: 10px; height: 10px; }
.bmx .cs-checks [data-s="idle"] .st::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #3A3F4B; }
.bmx .cs-checks [data-s="run"] .st { border: 2px solid #3A3F4B; border-top-color: var(--lime); animation: spin .7s linear infinite; }
.bmx .cs-checks [data-s="pass"] .st { background: var(--code-pass); animation: stamp .3s var(--ease-pop); }
.bmx .cs-checks [data-s="fail"] .st { background: var(--code-fail); animation: stamp .3s var(--ease-pop); }
.bmx .cs-checks .nm { font-size: 13px; line-height: 1.4; color: #C9CDD6; min-width: 0; }
.bmx .cs-checks .dt { display: block; margin-top: 3px; font: 500 12px/1.5 var(--mono); color: var(--code-dim); white-space: pre-wrap; overflow-wrap: anywhere; }
.bmx .cs-checks [data-s="fail"] .dt { color: #FF9D85; }
.bmx .cs-console { margin: 0; padding: 12px 16px; min-height: 120px; max-height: 240px; overflow: auto; font: 500 12.5px/1.6 var(--mono); white-space: pre-wrap; color: var(--code-text); }
.bmx .cs-console .err { color: #FF9D85; }
.bmx .cs-console .dim { color: var(--code-dim); }
.bmx .cs-foot { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--code-bg-2); border-top: 1px solid var(--code-line); }
.bmx .runw { position: relative; display: inline-flex; }
.bmx .cs-run { height: 36px; padding: 0 14px 0 10px; border-radius: 10px; display: inline-flex; align-items: center; gap: 7px; background: var(--lime); color: var(--ink); font: 700 13px/1 var(--body); transition: transform var(--d-press), background var(--d-fast); }
.bmx .cs-run:hover:not([disabled]) { background: var(--lime-hover); }
.bmx .cs-run:active:not([disabled]) { transform: scale(.96); }
.bmx .cs-run[disabled] { opacity: .6; cursor: default; }
.bmx .cs-run .bm-ico { width: 11px; height: 11px; }
.bmx .cs-run:focus-visible, .bmx .cs-ghost:focus-visible, .bmx .cs-tabs button:focus-visible { outline: 3px solid var(--lime); outline-offset: 2px; }
.bmx .cf { position: absolute; left: 50%; top: 50%; width: 7px; height: 10px; border-radius: 2px; pointer-events: none; z-index: 3; animation: cf 900ms var(--ease-out) forwards; }
@keyframes cf { 0% { transform: translate(-50%, -50%) rotate(0); opacity: 1; } 100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(var(--r)); opacity: 0; } }
.bmx .cs-kbd { font: 500 11px/1 var(--mono); color: var(--code-gutter); }
.bmx .cs-st { min-width: 0; font: 500 12px/1 var(--mono); color: var(--code-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bmx .cs-st.good { color: var(--code-pass); } .bmx .cs-st.bad { color: var(--code-fail); }
.bmx .cs-foot .grow { flex: 1; }
.bmx .cs-ghost { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 9px; font: 500 12.5px/1 var(--body); color: var(--code-dim); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.12); white-space: nowrap; }
.bmx .cs-ghost:hover { color: #fff; }
.bmx .cs-ghost .bm-ico { width: 11px; height: 11px; }
.bmx .cs-ghost[aria-disabled="true"] { opacity: .45; cursor: not-allowed; }
.bmx .cb-lock { margin: 10px 0 0; font: var(--t-cap); color: var(--text-3); }
.bmx .cb-hints { margin: 14px 0 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.bmx .cb-hints li { padding: 12px 14px; border-radius: var(--r-row); background: var(--note-bg); box-shadow: inset 0 0 0 1px var(--note-line); color: var(--note-ink); font: 400 14.5px/1.5 var(--body); animation: pop .3s var(--ease-out); }
.bmx .cb-hints .hn { display: block; margin-bottom: 3px; font: var(--t-eyebrow); letter-spacing: var(--track-eyebrow); text-transform: uppercase; }
.bmx .cb-fb { margin-top: 12px; }
.bmx .q-fb.cb-fb { margin-top: 14px; }
.bmx .cs-h .rs.failing i { background: var(--coral); }
.bmx .cb-win { display: flex; align-items: center; gap: 8px; margin: 14px 0 0; padding: 12px 14px; border-radius: var(--r-row); background: var(--lime-soft); box-shadow: inset 0 0 0 1px var(--lime-line); color: var(--lime-ink); font: 600 14.5px/1.4 var(--body); animation: pop .35s var(--ease-pop-2); }
.bmx .cb-win .bm-ico { width: 16px; height: 16px; }
.bmx .cb-ref-b { margin-top: 12px; }
.bmx .cb-ref { margin: 12px 0 0; padding: 14px 16px; border-radius: var(--r-row); background: var(--code-bg); color: var(--code-text); font: var(--t-code); overflow: auto; white-space: pre; }
.bmx .cb-self { margin-top: 16px; }
@media (max-width: 640px) { .bmx .cs-ed { font-size: 13px; grid-template-columns: 34px minmax(0, 1fr); } .bmx .cs-kbd { display: none; } .bmx .cs-foot { flex-wrap: wrap; } }
</style>
