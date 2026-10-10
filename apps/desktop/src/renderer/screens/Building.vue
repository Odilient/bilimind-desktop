<script setup lang="ts">
// Screen 2: the crew at work. A dotted canvas of cards joined by dashed connectors (live ones march and carry a
// lime dot), and a rail with the clock, the cost, the plan and a feed of every step in plain words.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Icon from '../components/Icon.vue';
import { state, cancelRun, go, type CrewNode } from '../store';
import { ROLE_NAME, fmtClock, fmtCost, fmtDuration, type Role } from '../words';

const r = computed(() => state.run!);
const now = ref(Date.now());
let tick = 0;
const cost = ref(0);
onMounted(() => {
  tick = window.setInterval(() => {
    now.value = Date.now();
    const target = state.run?.cost ?? 0;
    cost.value += (target - cost.value) * 0.35;
    if (Math.abs(target - cost.value) < 1e-6) cost.value = target;
  }, 120);
});
onBeforeUnmount(() => clearInterval(tick));

const elapsed = computed(() => (r.value.endedAt ?? now.value) - r.value.startedAt);
const writers = computed(() => r.value.writerOrder.map((id) => r.value.nodes[id]));
const compact = computed(() => writers.value.length > 4);
const stepsDone = computed(() => Object.values(r.value.nodes).reduce((a, n) => a + n.steps, 0));
const wm = computed(() => (r.value.card ? "Ready" : r.value.error ? "Stopped" : ["Reading", "Planning", "Writing", "Checking", "Narrating", "Packing"][Math.min(r.value.phase, 5)]));
const PHASES = ['Read', 'Plan', 'Write', 'Check', 'Narrate', 'Pack'];
const ICON: Record<Role, string> = { lead: 'i-target', writer: 'i-pencil', coder: 'i-code', checker: 'i-scales', narrator: 'i-mic', packager: 'i-rocket' };
const JOB: Record<Role, string> = {
  lead: 'Reads your files, plans the path', writer: 'Writes one lesson', coder: 'Runs every code exercise',
  checker: 'Checks every answer against your files', narrator: 'Records the voice', packager: 'Packs one offline page',
};

const ticker = computed(() => {
  const working = Object.values(r.value.nodes).filter((n) => n.state === 'working' && n.now);
  if (r.value.error) return { who: 'Stopped', text: r.value.error, ms: 0 };
  if (r.value.card) return { who: 'Done', text: 'Your course is ready', ms: 0 };
  if (!working.length) return { who: 'Lead', text: r.value.runId ? 'Getting started' : 'Starting the crew', ms: 0 };
  const n = working.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))[0];
  const more = working.length - 1;
  return { who: n.role === 'writer' ? 'Writer' : ROLE_NAME[n.role], text: n.role === 'writer' ? `${n.now}: ${n.title}` : n.now, ms: now.value - (n.startedAt ?? now.value), more };
});

const days = computed(() => {
  const m = new Map<number, { key: string; title: string }[]>();
  for (const k of r.value.plan?.keep ?? []) {
    const d = k.day ?? 0;
    if (!m.has(d)) m.set(d, []);
    m.get(d)!.push(k);
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0]);
});
const showAllCut = ref(false);
const cut = computed(() => (showAllCut.value ? r.value.plan?.cut ?? [] : (r.value.plan?.cut ?? []).slice(0, 3)));

// ── Connectors ──────────────────────────────────────────────────────────────
const graph = ref<HTMLElement | null>(null);
const cards = new Map<string, HTMLElement>();
function bind(id: string) { return (el: unknown) => { if (el) cards.set(id, el as HTMLElement); else cards.delete(id); }; }
interface Edge { id: string; d: string; state: 'idle' | 'live' | 'done' }
const edges = ref<Edge[]>([]);
const size = ref({ w: 0, h: 0 });

function anchor(id: string, side: 'l' | 'r' | 't' | 'b') {
  const el = cards.get(id); const g = graph.value;
  if (!el || !g) return null;
  const a = el.getBoundingClientRect(); const b = g.getBoundingClientRect();
  if (side === 't' || side === 'b') return { x: a.left + a.width / 2 - b.left, y: (side === 't' ? a.top : a.bottom) - b.top };
  return { x: (side === 'r' ? a.right : a.left) - b.left, y: a.top + a.height / 2 - b.top };
}
function vcurve(from: string, to: string) {
  const p = anchor(from, 'b'); const q = anchor(to, 't');
  if (!p || !q) return '';
  return `M${p.x.toFixed(1)},${p.y.toFixed(1)} L${q.x.toFixed(1)},${q.y.toFixed(1)}`;
}
function curve(from: string, to: string) {
  const p = anchor(from, 'r'); const q = anchor(to, 'l');
  if (!p || !q) return '';
  const dx = Math.max(24, (q.x - p.x) / 2);
  return `M${p.x.toFixed(1)},${p.y.toFixed(1)} C${(p.x + dx).toFixed(1)},${p.y.toFixed(1)} ${(q.x - dx).toFixed(1)},${q.y.toFixed(1)} ${q.x.toFixed(1)},${q.y.toFixed(1)}`;
}
function edgeState(a: CrewNode | undefined, b: CrewNode | undefined): Edge['state'] {
  if (!a || !b) return 'idle';
  if (b.state === 'working' && a.state !== 'waiting') return 'live';
  if (b.state === 'done' && a.state === 'done') return 'done';
  return 'idle';
}
function layout() {
  const g = graph.value; if (!g) return;
  size.value = { w: g.clientWidth, h: g.clientHeight };
  const N = r.value.nodes; const out: Edge[] = [];
  const add = (a: string, b: string) => { const d = curve(a, b); if (d) out.push({ id: `${a}>${b}`, d, state: edgeState(N[a], N[b]) }); };
  const ws = r.value.writerOrder;
  if (ws.length) {
    for (const w of ws) { add('lead', w); add(w, 'coder'); add(w, 'checker'); }
  } else { add('lead', 'ghost'); add('ghost', 'coder'); add('ghost', 'checker'); }
  add('coder', 'narrator'); add('checker', 'narrator');
  const v = vcurve('narrator', 'packager');
  if (v) out.push({ id: 'narrator>packager', d: v, state: edgeState(N.narrator, N.packager) });
  edges.value = out;
}
let lay = 0;
let ro: ResizeObserver | null = null;
onMounted(() => {
  nextTick(layout);
  lay = window.setInterval(layout, 260);
  ro = new ResizeObserver(layout);
  if (graph.value) ro.observe(graph.value);
});
onBeforeUnmount(() => { clearInterval(lay); ro?.disconnect(); });
watch(() => r.value.writerOrder.length, () => nextTick(layout));

function stateLabel(n: CrewNode) {
  return n.state === 'working' ? 'Working' : n.state === 'done' ? 'Done' : n.state === 'failed' ? 'Problem' : n.state === 'skipped' ? 'Not needed' : 'Waiting';
}
function lessonDay(n: CrewNode) { return n.day ? `Day ${n.day}` : ''; }
const stepMs = (n: CrewNode) => (n.state === 'working' && n.startedAt ? now.value - n.startedAt : 0);
const filesShown = computed(() => r.value.files.slice(0, 5));
</script>

<template>
  <div class="bld">
    <section class="stage">
      <header class="top">
        <div class="tl">
          <span class="eb"><span class="dot"><Icon name="i-spark" /></span>{{ r.card ? 'Your course is ready' : r.error ? 'The run stopped' : 'Building your course' }}</span>
          <p class="sent" :title="r.sentence">“{{ r.sentence }}”</p>
        </div>
        <ol class="phases" aria-label="Progress">
          <li v-for="(p, i) in PHASES" :key="p" :class="{ done: r.phase > i || !!r.card, now: r.phase === i && !r.card && !r.error }">
            <span class="pn"><Icon v-if="r.phase > i || r.card" name="i-check" /><template v-else>{{ i + 1 }}</template></span>{{ p }}
          </li>
        </ol>
      </header>

      <Transition name="wm" mode="out-in"><span :key="wm" class="wm" aria-hidden="true">{{ wm }}</span></Transition>
      <div ref="graph" class="graph" :class="{ compact }">
        <svg class="wires" :viewBox="`0 0 ${size.w} ${size.h}`" :width="size.w" :height="size.h" aria-hidden="true">
          <g v-for="e in edges" :key="e.id">
            <path :d="e.d" class="wire" :class="e.state" />
            <circle v-if="e.state === 'live'" r="4.5" class="spark">
              <animateMotion :path="e.d" dur="1.5s" repeatCount="indefinite" />
            </circle>
          </g>
        </svg>

        <!-- Column 1: Lead -->
        <div class="col c1">
          <article :ref="bind('lead')" class="node lead" :class="r.nodes.lead.state">
            <header><span class="ri"><Icon name="i-target" /></span><b>Lead</b><span class="st"><i></i>{{ stateLabel(r.nodes.lead) }}</span></header>
            <p class="job">{{ JOB.lead }}</p>
            <div class="lfiles">
              <span v-for="(f, i) in filesShown" :key="f.path" class="lf" :class="{ scan: r.phase === 0 && r.nodes.lead.state === 'working' }" :style="{ animationDelay: `${i * 0.25}s` }">
                <Icon :name="f.role === 'past_paper' ? 'i-quiz' : 'i-file'" />{{ f.name }}
              </span>
              <span v-if="r.files.length > filesShown.length" class="lf more">+{{ r.files.length - filesShown.length }} more</span>
            </div>
            <p v-if="r.nodes.lead.state === 'working'" class="now"><span class="nt">{{ r.nodes.lead.now }}</span><span class="dots"><i></i><i></i><i></i></span></p>
            <p v-else-if="r.plan" class="last"><b>{{ r.plan.keep.length }}</b> kept · <b>{{ r.plan.cut.length }}</b> cut</p>
            <p v-else-if="r.nodes.lead.last" class="last">{{ r.nodes.lead.last }}</p>
          </article>
        </div>

        <!-- Column 2: one Writer per kept lesson -->
        <div class="col c2">
          <TransitionGroup name="pop">
            <article v-for="(w, i) in writers" :key="w.id" :ref="bind(w.id)" class="node writer" :class="w.state" :style="{ transitionDelay: `${i * 90}ms` }">
              <header>
                <span class="ri"><Icon name="i-pencil" /></span><b>Writer</b>
                <span v-if="lessonDay(w)" class="day">{{ lessonDay(w) }}</span>
                <span class="st dotonly" :title="stateLabel(w)"><i></i></span>
              </header>
              <p class="lt" :title="w.title">{{ w.title }}</p>
              <p v-if="w.state === 'working'" class="now"><span class="nt">{{ w.now.replace(' after the checks', '') }}</span><span class="nc">{{ fmtClock(stepMs(w)) }}</span><span class="dots"><i></i><i></i><i></i></span></p>
              <div v-if="!compact" class="strip" :class="w.state">
                <span :class="{ on: w.drafts > 0 || w.open > 0, run: w.open > 0 && !w.checks }">Write</span>
                <span :class="{ on: !!w.checks, bad: w.checks && w.checks.passed < w.checks.total }">Check</span>
                <span :class="{ on: w.checks && w.checks.passed === w.checks.total, pass: w.checks && w.checks.passed === w.checks.total }">Pass</span>
              </div>
              <p v-if="w.state !== 'working' && w.checks" class="last chk" :class="{ full: w.checks.passed === w.checks.total }"><Icon name="i-check" />{{ w.checks.passed }}/{{ w.checks.total }} checks</p>
            </article>
          </TransitionGroup>
          <article v-if="!writers.length" :ref="bind('ghost')" class="node ghost">
            <header><span class="ri"><Icon name="i-pencil" /></span><b>Writers</b></header>
            <p class="job">One per lesson, all at once. They appear when the plan is ready.</p>
          </article>
        </div>

        <!-- Column 3: Coder + Checker -->
        <div class="col c3">
          <article :ref="bind('coder')" class="node coder" :class="r.nodes.coder.state">
            <header><span class="ri"><Icon name="i-code" /></span><b>Coder</b><span class="st"><i></i>{{ stateLabel(r.nodes.coder) }}</span></header>
            <p class="job">{{ JOB.coder }}</p>
            <div v-if="r.nodes.coder.tests.total" class="big"><b>{{ r.nodes.coder.tests.passed }}</b>/{{ r.nodes.coder.tests.total }} <span>tests pass</span></div>
            <p v-if="r.nodes.coder.state === 'working'" class="now"><span class="nt">{{ r.nodes.coder.now }}</span><span class="dots"><i></i><i></i><i></i></span></p>
          </article>
          <article :ref="bind('checker')" class="node checker" :class="[r.nodes.checker.state, { alarm: r.moment && now - r.moment.at < 5200 }]">
            <header><span class="ri"><Icon name="i-scales" /></span><b>Checker</b><span class="st"><i></i>{{ stateLabel(r.nodes.checker) }}</span></header>
            <p class="job">{{ JOB.checker }}</p>
            <div v-if="r.nodes.checker.resolved" class="big"><b>{{ r.nodes.checker.resolved }}</b> <span>answers re-solved</span></div>
            <Transition name="moment">
              <div v-if="r.moment && now - r.moment.at < 5200" :key="r.moment.at" class="moment" :class="r.moment.stage">
                <div class="mrow rej"><Icon name="i-x" /><span><b>Rejected</b> an answer that contradicted your files</span></div>
                <div class="mrow rew"><Icon name="i-check" /><span><b>Rewritten</b> from your own files</span></div>
              </div>
            </Transition>
            <p v-if="r.nodes.checker.rejected && !(r.moment && now - r.moment.at < 5200)" class="last rejc"><b>{{ r.nodes.checker.rejected }}</b> rejected and rewritten</p>
            <p v-if="r.nodes.checker.state === 'working'" class="now"><span class="nt">{{ r.nodes.checker.now }}</span><span class="dots"><i></i><i></i><i></i></span></p>
          </article>
        </div>

        <!-- Column 4: Narrator + Packager -->
        <div class="col c4">
          <article :ref="bind('narrator')" class="node narrator" :class="r.nodes.narrator.state">
            <header><span class="ri"><Icon name="i-mic" /></span><b>Narrator</b><span class="st"><i></i>{{ stateLabel(r.nodes.narrator) }}</span></header>
            <p class="job">{{ JOB.narrator }}</p>
            <div class="eq" :class="{ on: r.nodes.narrator.state === 'working' }" aria-hidden="true"><i v-for="k in 14" :key="k" :style="{ animationDelay: `${(k * 137) % 900}ms` }"></i></div>
            <div v-if="r.nodes.narrator.minutes" class="big"><b>{{ r.nodes.narrator.minutes }}</b> <span>min of narration</span></div>
          </article>
          <article :ref="bind('packager')" class="node packager" :class="r.nodes.packager.state">
            <header><span class="ri"><Icon name="i-rocket" /></span><b>Packager</b><span class="st"><i></i>{{ stateLabel(r.nodes.packager) }}</span></header>
            <p class="job">{{ JOB.packager }}</p>
            <p v-if="r.nodes.packager.state === 'working'" class="now"><span class="nt">{{ r.nodes.packager.now }}</span><span class="dots"><i></i><i></i><i></i></span></p>
            <p v-else-if="r.nodes.packager.last" class="last">{{ r.nodes.packager.last }}</p>
          </article>
        </div>
      </div>

      <footer class="tick" :class="{ done: !!r.card, bad: !!r.error }">
        <span class="who">{{ ticker.who }}</span>
        <Transition name="tk" mode="out-in"><span :key="ticker.text" class="what">{{ ticker.text }}</span></Transition>
        <span v-if="ticker.ms > 1500" class="tms">{{ fmtClock(ticker.ms) }}</span>
        <span v-if="ticker.more" class="more">+{{ ticker.more }} more at work</span>
        <span class="grow"></span>
        <template v-if="r.error">
          <button class="pill dark" @click="cancelRun">Back to start</button>
        </template>
        <button v-else-if="r.card" class="pill lime" @click="go('finished')">See your course <span class="arr"><Icon name="i-arrow" /></span></button>
        <button v-else class="pill light" @click="cancelRun"><Icon name="i-x" /> Cancel</button>
      </footer>
    </section>

    <aside class="rail">
      <div class="slab cobalt meter">
        <div class="m1">
          <span class="ml">Time</span>
          <b class="clock">{{ fmtClock(elapsed) }}</b>
        </div>
        <div class="m2">
          <div><span class="ml">Cost so far</span><b>{{ fmtCost(cost) }}</b></div>
          <div><span class="ml">Steps done</span><b>{{ stepsDone }}</b></div>
        </div>
      </div>

      <div class="card plan">
        <div class="ch"><b>The plan</b><span v-if="r.plan">{{ r.plan.keep.length }} kept · {{ r.plan.cut.length }} cut</span></div>
        <div v-if="!r.plan" class="skel">
          <p>The Lead is reading your files and weighing every topic against your time.</p>
          <i></i><i></i><i></i>
        </div>
        <div v-else class="pl">
          <div v-for="[d, ls] in days" :key="d" class="pday">
            <span class="dn">{{ d ? `Day ${d}` : 'Any day' }}</span>
            <div class="pls"><span v-for="l in ls" :key="l.key" class="pk"><Icon name="i-check" />{{ l.title }}</span></div>
          </div>
          <div v-if="r.plan.cut.length" class="cuts">
            <span class="dn">Cut</span>
            <div class="cl">
              <div v-for="c in cut" :key="c.key" class="ct"><b>{{ c.title }}</b><span>{{ c.reason }}</span></div>
              <button v-if="r.plan.cut.length > 3" class="more" @click="showAllCut = !showAllCut">{{ showAllCut ? 'Show less' : `Show all ${r.plan.cut.length}` }}</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card feed">
        <div class="ch"><b>What just happened</b><span class="livedot" :class="{ off: !!r.endedAt }"><i></i>{{ r.endedAt ? 'Finished' : 'Live' }}</span></div>
        <TransitionGroup tag="ol" name="feed" class="fl">
          <li v-for="f in r.feed" :key="f.id" :class="[f.role, f.tone, { bad: !f.ok }]">
            <span class="fd"></span>
            <span class="ft"><b>{{ ROLE_NAME[f.role] }}</b> {{ f.text }}</span>
            <span v-if="f.ms !== undefined && f.ms > 0" class="fms">{{ fmtDuration(f.ms) }}</span>
          </li>
        </TransitionGroup>
        <p v-if="!r.feed.length" class="fempty">Steps appear here as the crew finishes them.</p>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.bld { height: 100%; display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 12px; padding: 0 var(--gut) var(--gut); }

/* ── Stage ─────────────────────────────────────────────── */
.stage {
  position: relative; border-radius: var(--r-card); overflow: hidden; display: flex; flex-direction: column; min-height: 0;
  background-color: var(--canvas);
  background-image: radial-gradient(rgb(35 64 230 / 0.16) 1.2px, transparent 1.3px);
  background-size: 22px 22px; background-position: 11px 11px;
  box-shadow: inset 0 0 0 1px var(--line);
}
.top { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; padding: 18px 20px 6px 22px; }
.tl { display: grid; gap: 8px; min-width: 0; justify-items: start; }
.sent { margin: 0; font: 600 14px/1.4 var(--body); color: var(--ink-3); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; max-width: 460px; }
.phases { list-style: none; margin: 0; padding: 4px; display: flex; gap: 2px; background: #fff; border-radius: 99px; box-shadow: var(--shadow-card); flex: none; }
.phases li { display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px 0 4px; border-radius: 99px; font-size: 12px; font-weight: 600; color: var(--text-3); transition: background .3s, color .3s; }
.pn { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: var(--page); font-size: 11px; }
.pn .ico { width: 11px; height: 11px; }
.phases li.done { color: var(--ink-3); }
.phases li.done .pn { background: var(--lime); color: var(--ink); }
.phases li.now { background: var(--cobalt); color: #fff; }
.phases li.now .pn { background: rgb(255 255 255 / 0.2); color: #fff; }

.graph { z-index: 1; position: relative; flex: 1; min-height: 0; display: grid; grid-template-columns: 1.08fr 1.08fr 1fr 1fr; gap: 26px; padding: 8px 22px 10px; align-items: center; }
.wires { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
.wire { fill: none; stroke: rgb(11 13 16 / 0.2); stroke-width: 1.6; stroke-dasharray: 5 6; transition: stroke .3s; }
.wire.done { stroke: rgb(35 64 230 / 0.45); }
.wire.live { stroke: var(--cobalt); stroke-width: 2; animation: march .7s linear infinite; }
@keyframes march { to { stroke-dashoffset: -11; } }
.spark { fill: var(--lime); stroke: var(--ink); stroke-width: 1.5; }
.col { position: relative; display: flex; flex-direction: column; justify-content: center; gap: 10px; min-height: 0; max-height: 100%; }
.c3, .c4 { gap: 40px; }

/* ── Node cards ────────────────────────────────────────── */
.node {
  position: relative; background: #fff; border-radius: 20px; padding: 12px 14px; display: grid; gap: 6px;
  box-shadow: var(--shadow-card), inset 0 0 0 1px var(--line); transition: box-shadow .3s, transform .3s, opacity .3s;
}
.node header { display: flex; align-items: center; gap: 8px; min-width: 0; }
.node header b { font: 700 13px/1 var(--display); letter-spacing: 0.02em; text-transform: uppercase; }
.ri { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: var(--cobalt-soft); color: var(--cobalt); flex: none; }
.ri .ico { width: 14px; height: 14px; }
.st { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 9px 0 7px; border-radius: 99px; background: var(--page); font-size: 11px; font-weight: 600; color: var(--text-3); white-space: nowrap; }
.st i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; opacity: .6; }
.job { margin: 0; font-size: 12px; line-height: 1.35; color: var(--text-2); }
.now .nt { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.now .nc { flex: none; font-variant-numeric: tabular-nums; color: var(--text-3); font-weight: 500; }
.now { margin: 0; font-size: 12px; font-weight: 600; color: var(--cobalt-2); display: flex; align-items: center; gap: 4px; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.last { margin: 0; font-size: 12px; line-height: 1.35; color: var(--text-2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.dots { display: inline-flex; gap: 2px; margin-left: 2px; }
.dots i { width: 3.5px; height: 3.5px; border-radius: 50%; background: currentColor; animation: blink 1.2s infinite; }
.dots i:nth-child(2) { animation-delay: .2s; } .dots i:nth-child(3) { animation-delay: .4s; }
@keyframes blink { 0%, 100% { opacity: .2; } 40% { opacity: 1; } }
.big { font: 700 26px/1 var(--display); letter-spacing: -0.04em; display: flex; align-items: baseline; gap: 2px; }
.big b { font-weight: 700; }
.big span { font: 500 12px/1 var(--body); letter-spacing: 0; color: var(--text-2); margin-left: 6px; }

.node.waiting { opacity: .62; }
.node.skipped { opacity: .4; }
.node.working { box-shadow: 0 0 0 2px var(--cobalt), 0 18px 36px -16px rgb(35 64 230 / 0.55); transform: translateY(-1px); }
.node.working .st { background: var(--ink); color: #fff; }
.node.working .st i { background: var(--lime); opacity: 1; animation: pulse-lime 1.4s infinite; }
.node.done .st { background: var(--green-soft); color: var(--green); }
.node.done .st i { opacity: 1; }
.node.done .ri { background: var(--green); color: #fff; }
.node.failed { box-shadow: 0 0 0 2px var(--coral); }
.node.failed .st { background: var(--coral-soft); color: var(--coral); }

/* Lead: the cobalt boss card */
.node.lead { background: var(--cobalt-grad); color: #fff; padding: 16px; gap: 10px; box-shadow: 0 24px 48px -24px rgb(13 22 96 / 0.7); }
.node.lead .ri { background: var(--lime); color: var(--ink); width: 32px; height: 32px; }
.node.lead header b { font-size: 15px; }
.node.lead .job { color: rgb(255 255 255 / 0.75); font-size: 12.5px; }
.node.lead .st { background: rgb(255 255 255 / 0.14); color: #fff; }
.node.lead.working { box-shadow: 0 0 0 2px var(--lime), 0 24px 48px -20px rgb(13 22 96 / 0.8); }
.node.lead.done .st { background: var(--lime); color: var(--ink); }
.node.lead.done .ri { background: var(--lime); color: var(--ink); }
.node.lead .now { color: var(--lime); }
.node.lead .last { color: rgb(255 255 255 / 0.85); }
.node.lead .last b { color: var(--lime); font-weight: 700; }
.lfiles { display: grid; gap: 4px; }
.lf { position: relative; overflow: hidden; display: block; line-height: 24px; height: 24px; padding: 0 8px; border-radius: 8px; background: rgb(255 255 255 / 0.1); font-size: 11.5px; white-space: nowrap; text-overflow: ellipsis; }
.lf .ico { width: 12px; height: 12px; color: var(--lime); display: inline-block; vertical-align: -2px; margin-right: 6px; }
.lf.more { color: rgb(255 255 255 / 0.65); }
.lf.scan::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgb(198 242 78 / 0.35), transparent); transform: translateX(-100%); animation: scan 1.8s infinite; animation-delay: inherit; }
@keyframes scan { to { transform: translateX(100%); } }

/* Writers */
.writer { padding: 10px 12px; gap: 4px; }
.writer .ri { width: 24px; height: 24px; }
.writer .ri .ico { width: 12px; height: 12px; }
.day { flex: none; white-space: nowrap; height: 20px; padding: 0 7px; border-radius: 99px; background: var(--lime); color: var(--ink); font-size: 10.5px; font-weight: 700; display: inline-grid; place-items: center; }
.lt { margin: 0; font-size: 12.5px; font-weight: 600; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.graph.compact .lt { -webkit-line-clamp: 1; }
.graph.compact .writer { padding: 8px 12px; }
.st.dotonly { padding: 0; width: 22px; justify-content: center; gap: 0; }
.st.dotonly i { width: 8px; height: 8px; }
.strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.strip span { height: 18px; border-radius: 6px; background: var(--page); color: var(--text-3); font-size: 10px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; display: grid; place-items: center; transition: background .3s, color .3s; }
.strip span.on { background: var(--cobalt-soft); color: var(--cobalt-2); }
.strip span.run { background: var(--cobalt); color: #fff; animation: breathe 1.2s ease-in-out infinite; }
.strip span.bad { background: var(--coral-soft); color: #B33A22; }
.strip span.pass { background: var(--lime); color: var(--ink); }
@keyframes breathe { 50% { opacity: .55; } }
.chk { display: flex; align-items: center; gap: 4px; font-weight: 600; }
.chk .ico { width: 12px; height: 12px; color: var(--text-3); }
.chk.full { color: var(--green); }
.chk.full .ico { color: var(--green); }
.ghost { background: rgb(255 255 255 / 0.6); border: 2px dashed var(--line-2); box-shadow: none; opacity: .9; }

/* Checker moment */
.checker.alarm { box-shadow: 0 0 0 2px var(--coral), 0 18px 36px -16px rgb(255 90 60 / 0.5); }
.moment { display: grid; gap: 4px; }
.mrow { display: flex; align-items: center; gap: 7px; padding: 6px 8px; border-radius: 10px; font-size: 11.5px; line-height: 1.3; transition: all .4s; }
.mrow .ico { width: 14px; height: 14px; flex: none; padding: 2px; border-radius: 50%; }
.mrow.rej { background: var(--coral-soft); color: #A2321C; }
.mrow.rej .ico { background: var(--coral); color: #fff; }
.mrow.rew { background: var(--lime-soft); color: var(--lime-ink); opacity: .25; transform: translateY(-4px); }
.mrow.rew .ico { background: var(--lime); color: var(--ink); }
.moment.rewritten .rej span { text-decoration: line-through; opacity: .6; }
.moment.rewritten .rew { opacity: 1; transform: none; }
.rejc { color: var(--coral); }
.rejc b { font-weight: 700; }

/* Narrator equaliser */
.eq { display: flex; align-items: center; gap: 3px; height: 26px; }
.eq i { flex: 1; height: 4px; border-radius: 99px; background: var(--line-2); transition: background .3s; }
.eq.on i { background: var(--cobalt); animation: eq 0.9s ease-in-out infinite; }
@keyframes eq { 0%, 100% { height: 4px; } 50% { height: 24px; } }
.narrator.done .eq i { background: var(--lime); height: 10px; }
.packager.done { background: var(--lime); }
.packager.done .ri { background: var(--ink); color: var(--lime); }
.packager.done .job, .packager.done .last { color: var(--ink-3); }
.packager.done .st { background: var(--ink); color: var(--lime); }

.pop-enter-active { transition: opacity .45s, transform .45s cubic-bezier(.2, .9, .3, 1.3); }
.pop-enter-from { opacity: 0; transform: translateX(-26px) scale(.92); }
.moment-enter-active, .moment-leave-active { transition: opacity .3s, transform .3s; }
.moment-enter-from, .moment-leave-to { opacity: 0; transform: scale(.96); }

/* Ticker */
.tick { display: flex; align-items: center; gap: 12px; margin: 0 14px 14px; padding: 10px 10px 10px 12px; background: var(--ink); color: #fff; border-radius: 22px; min-height: 64px; }
.who { flex: none; height: 30px; padding: 0 12px; border-radius: 99px; background: var(--lime); color: var(--ink); font: 700 12px/30px var(--display); letter-spacing: .04em; text-transform: uppercase; }
.what { font: 700 19px/1.2 var(--display); letter-spacing: -0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.more { flex: none; font-size: 12px; color: rgb(255 255 255 / 0.6); }
.tms { flex: none; font: 600 13px/1 var(--body); font-variant-numeric: tabular-nums; color: var(--lime); padding: 5px 8px; border-radius: 8px; background: rgb(255 255 255 / 0.08); }
.wm { position: absolute; left: 18px; bottom: 76px; font: 700 168px/0.8 var(--display); letter-spacing: -0.06em; text-transform: uppercase; color: rgb(35 64 230 / 0.055); pointer-events: none; white-space: nowrap; z-index: 0; }
.wm-enter-active, .wm-leave-active { transition: opacity .5s, transform .5s; }
.wm-enter-from { opacity: 0; transform: translateY(20px); }
.wm-leave-to { opacity: 0; transform: translateY(-20px); }
.grow { flex: 1; }
.tick .pill.light { background: rgb(255 255 255 / 0.1); color: #fff; border-color: rgb(255 255 255 / 0.18); box-shadow: none; }
.tick.bad .who { background: var(--coral); color: #fff; }
.tk-enter-active, .tk-leave-active { transition: opacity .2s, transform .2s; }
.tk-enter-from { opacity: 0; transform: translateY(8px); }
.tk-leave-to { opacity: 0; transform: translateY(-8px); }

/* ── Rail ──────────────────────────────────────────────── */
.rail { display: flex; flex-direction: column; gap: 12px; min-height: 0; }
.meter { padding: 18px 20px; border-radius: 28px; display: grid; gap: 12px; flex: none; }
.ml { display: block; font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: rgb(255 255 255 / 0.62); }
.clock { font: 700 54px/0.95 var(--display); letter-spacing: -0.05em; font-variant-numeric: tabular-nums; }
.m2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.m2 > div { padding: 10px 12px; border-radius: 16px; background: rgb(255 255 255 / 0.1); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.16); }
.m2 b { font: 700 22px/1.1 var(--display); letter-spacing: -0.03em; font-variant-numeric: tabular-nums; color: var(--lime); }
.m2 > div:last-child b { color: #fff; }
.card { background: #fff; border-radius: 24px; padding: 14px 16px; box-shadow: var(--shadow-card); min-height: 0; }
.ch { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.ch b { font: 700 14px/1 var(--display); text-transform: uppercase; letter-spacing: 0.01em; }
.ch > span { font-size: 12px; color: var(--text-2); font-weight: 500; }
.plan { flex: none; max-height: 42%; overflow-y: auto; }
.skel p { margin: 0 0 10px; font-size: 12.5px; color: var(--text-2); }
.skel i { display: block; height: 12px; border-radius: 6px; margin-top: 7px; background: linear-gradient(90deg, var(--page) 0%, #F7F8FB 50%, var(--page) 100%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
.skel i:nth-child(3) { width: 80%; } .skel i:nth-child(4) { width: 60%; }
@keyframes shimmer { to { background-position: -200% 0; } }
.pl { display: grid; gap: 8px; animation: fade .4s; }
.pday, .cuts { display: grid; grid-template-columns: 52px 1fr; gap: 8px; align-items: start; }
.dn { font-size: 11px; font-weight: 700; color: var(--cobalt); text-transform: uppercase; letter-spacing: .04em; padding-top: 5px; }
.cuts .dn { color: var(--coral); }
.pls { display: grid; gap: 4px; }
.pk { display: flex; align-items: center; gap: 6px; padding: 5px 9px; border-radius: 10px; background: var(--cobalt-soft); font-size: 12px; font-weight: 600; line-height: 1.3; }
.pk .ico { width: 12px; height: 12px; color: var(--cobalt); flex: none; }
.cl { display: grid; gap: 6px; }
.ct { display: grid; gap: 1px; padding: 6px 9px; border-radius: 10px; background: var(--page); }
.ct b { font-size: 12px; font-weight: 600; text-decoration: line-through; text-decoration-color: rgb(255 90 60 / 0.6); color: var(--ink-3); }
.ct span { font-size: 11.5px; color: var(--text-2); line-height: 1.35; }
.cl .more { justify-self: start; font-size: 12px; font-weight: 600; color: var(--cobalt); }
.feed { flex: 1; display: flex; flex-direction: column; padding-bottom: 6px; }
.livedot { display: inline-flex; align-items: center; gap: 6px; }
.livedot i { width: 7px; height: 7px; border-radius: 50%; background: var(--green); animation: pulse-lime 1.6s infinite; }
.livedot.off i { animation: none; background: var(--text-3); }
.fl { list-style: none; margin: 0 -6px; padding: 0; overflow-y: auto; flex: 1; min-height: 0; }
.fl li { display: grid; grid-template-columns: 10px 1fr auto; gap: 8px; align-items: start; padding: 7px 6px; border-radius: 10px; font-size: 12.5px; line-height: 1.38; color: var(--ink-3); }
.fd { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; background: var(--cobalt); }
.fl li.lead .fd { background: var(--navy); }
.fl li.coder .fd { background: var(--ink); }
.fl li.checker .fd { background: var(--green); }
.fl li.narrator .fd { background: var(--lime-2); }
.fl li.packager .fd { background: var(--text-3); }
.ft b { font-weight: 700; color: var(--ink); }
.fms { font-size: 11px; color: var(--text-3); font-variant-numeric: tabular-nums; padding-top: 1px; white-space: nowrap; }
.fl li.reject { background: var(--coral-soft); }
.fl li.reject .fd { background: var(--coral); }
.fl li.rewrite { background: var(--lime-soft); }
.fl li.plan { background: var(--cobalt-soft); }
.fl li.bad { color: var(--coral); }
.feed-enter-active { transition: opacity .2s, transform .2s; }
.feed-enter-from { opacity: 0; transform: translateY(-8px); }
.fempty { margin: 0; font-size: 12.5px; color: var(--text-3); }
</style>
