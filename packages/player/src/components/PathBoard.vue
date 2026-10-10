<script setup lang="ts">
// The path (player-design §3.4): ink milestones on a spine, subtopics on dotted Bézier ties, marks,
// mentor notes, cut topics with their reason, chapter pills, "You are here", the finish pill, and the
// "path fills" run after a lesson is completed (route #/?from=<lessonId>, §6.1).
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { BLOCK_META, MARK } from '@bilimind/core';
import type { Course, PathItem, PathTopic } from '@bilimind/core';
import { currentLesson, isExamGoal, keptStep, keptTopics, lessonById, lessonOrder, nextLesson } from '../runtime/model.ts';
import { isDone, setDone } from '../runtime/progress.ts';
import { examInfo, fmtMinutes } from '../runtime/time.ts';
import { go, lessonHref, route } from '../router.ts';
import { hop, reducedMotion } from '../runtime/motion.ts';

const props = defineProps<{ course: Course }>();
const emit = defineEmits<{ complete: [] }>();
const c = computed(() => props.course);
const exam = computed(() => examInfo(c.value.goal.exam_at, c.value.goal.timezone));
const lessonsCount = computed(() => lessonOrder(c.value).length);
const cur = computed(() => currentLesson(c.value, isDone));
const curTopicId = computed(() => {
  const id = cur.value?.id;
  if (!id) return '';
  return (c.value.path.find(t => t.lesson === id) ?? c.value.path.find(t => t.items.some(i => i.lesson === id)))?.id ?? '';
});
const allDone = computed(() => !cur.value && lessonsCount.value > 0);
const anyCut = computed(() => c.value.path.some(t => t.cut));
const keptCount = computed(() => keptTopics(c.value).length);
const cutCount = computed(() => c.value.path.length - keptCount.value);
// G2: steps are numbered along the kept line only, so "Step 3" means the same thing on the path, in the lesson and in the CTA
const stepNo = (t: PathTopic) => keptStep(c.value, t);

type Group = { name: string | null; items: PathItem[] };
interface Row { t: PathTopic; sec: string | null; side: 'l' | 'r'; groups: Group[]; state: string }
const rows = computed<Row[]>(() => {
  let prevSec: string | null | undefined;
  let k = 0;
  return c.value.path.map(t => {
    const sec = t.section && t.section !== prevSec ? t.section : null;
    if (t.section) prevSec = t.section;
    const groups: Group[] = [];
    for (const it of t.items) {
      const last = groups[groups.length - 1];
      if (it.group && last && last.name === it.group) last.items.push(it);
      else groups.push({ name: it.group, items: [it] });
    }
    const side: 'l' | 'r' = groups.length ? (k++ % 2 === 0 ? 'r' : 'l') : 'r';
    const state = t.cut ? 'cut' : t.lesson && isDone(t.lesson) ? 'done' : t.id === curTopicId.value ? 'cur' : '';
    return { t, sec, side, groups, state };
  });
});
const other = (s: 'l' | 'r'): 'l' | 'r' => (s === 'l' ? 'r' : 'l');
const markCls = (m: PathItem['mark']) => (m === 'recommended' ? 'rec' : m === 'alternative' ? 'alt' : m === 'anytime' ? 'any' : '');
// G2: a cut sub-item is grey whatever its outline badge; a kept sub-lesson is the one we point at (recommended)
const subMark = (it: PathItem) => (it.cut ? 'any' : it.lesson ? 'rec' : markCls(it.mark));
const icons = (t: PathTopic) => t.formats.slice(0, 3).map(f => BLOCK_META[f as keyof typeof BLOCK_META]?.icon ?? 'i-book');
const pct = (w: number | null) => (w && w > 0 ? `${Math.round(w * 100)}%` : '');

// ---------- wires + run ----------
const board = ref<HTMLElement | null>(null);
const wires = ref<string[]>([]);
const litTopic = ref('');
const run = ref(0);
const runAnimated = ref(true);
const showCta = ref(false);

function center(el: Element, b: DOMRect) { const r = el.getBoundingClientRect(); return r.top + r.height / 2 - b.top; }

function draw() {
  const el = board.value;
  if (!el) return;
  const B = el.getBoundingClientRect();
  const out: string[] = [];
  el.querySelectorAll<HTMLElement>('.p-row').forEach(r => {
    const tEl = r.querySelector('.p-topic');
    if (!tEl) return;
    const t = tEl.getBoundingClientRect();
    ([['.p-l', -1], ['.p-r', 1]] as const).forEach(([s, dir]) => {
      const side = r.querySelector(s);
      if (!side) return;
      Array.from(side.children).forEach(ch => {
        if (ch.classList.contains('p-note')) return;
        const cb = ch.getBoundingClientRect();
        const sx = (dir > 0 ? t.right : t.left) - B.left;
        const sy = t.top + t.height / 2 - B.top;
        const tx = (dir > 0 ? cb.left : cb.right) - B.left;
        const ty = cb.top + cb.height / 2 - B.top;
        const bend = Math.max(18, Math.abs(tx - sx) * 0.5);
        out.push(`${r.dataset.topic}|M${sx.toFixed(1)} ${sy.toFixed(1)} C${(sx + dir * bend).toFixed(1)} ${sy.toFixed(1)}, ${(tx - dir * bend).toFixed(1)} ${ty.toFixed(1)}, ${tx.toFixed(1)} ${ty.toFixed(1)}`);
      });
    });
  });
  wires.value = out;
  run.value = runTarget();
  // G2: the spine stops at the finish pill instead of running through "After the exam"
  const fin = el.querySelector('.p-fin');
  if (fin) el.style.setProperty('--spine-end', `${Math.round(center(fin, B))}px`);
}

/** Run length: down to the current milestone; to the finish pill when everything is done; 0 before any progress. */
function runTarget(id = curTopicId.value): number {
  const el = board.value;
  if (!el) return 0;
  const B = el.getBoundingClientRect();
  if (allDone.value) { const fin = el.querySelector('.p-fin'); return fin ? center(fin, B) : 0; }
  const anyDone = lessonOrder(c.value).some(l => isDone(l.id));
  if (!anyDone) return 0;
  const node = el.querySelector(`.p-row[data-topic="${CSS.escape(id)}"] .p-topic`);
  return node ? center(node, B) : 0;
}

let ro: ResizeObserver | null = null;
onMounted(async () => {
  await nextTick();
  runAnimated.value = false;
  draw();
  ro = new ResizeObserver(() => draw());
  if (board.value) ro.observe(board.value);
  if (document.fonts?.ready) void document.fonts.ready.then(() => draw());
  setTimeout(draw, 900);                     // after the rows' rise-in animation settles
  if (route.from) await playRun(route.from);
  else if (route.at) scrollToTopicOfLesson(route.at);
  requestAnimationFrame(() => { runAnimated.value = true; });
});
onBeforeUnmount(() => ro?.disconnect());

function topicIdOfLesson(lessonId: string): string {
  return (c.value.path.find(t => t.lesson === lessonId) ?? c.value.path.find(t => t.items.some(i => i.lesson === lessonId)))?.id ?? '';
}
function rowEl(topicId: string): HTMLElement | null {
  return board.value?.querySelector(`.p-row[data-topic="${CSS.escape(topicId)}"]`) ?? null;
}
function scrollToTopicOfLesson(lessonId: string) {
  const r = rowEl(topicIdOfLesson(lessonId));
  if (!r) return;
  const rect = r.getBoundingClientRect();
  window.scrollTo({ top: window.scrollY + rect.top - window.innerHeight * 0.4, behavior: 'auto' });
}

/** §6.1: stamp the finished milestone, grow the lime run to the next one, hop the token, offer Continue. */
async function playRun(fromLesson: string) {
  const fromTopic = topicIdOfLesson(fromLesson);
  try { history.replaceState(null, '', location.href.replace(/([?&])from=[^&#]*&?/, '$1').replace(/[?&]$/, '')); } catch { /* file:// may refuse */ }
  const fromRow = rowEl(fromTopic);
  if (!fromRow || !board.value) return;
  scrollToTopicOfLesson(fromLesson);
  const B = board.value.getBoundingClientRect();
  const fromNode = fromRow.querySelector('.p-topic')!;
  fromNode.classList.add('stamped');
  runAnimated.value = false;
  run.value = center(fromNode, B);
  await nextTick();
  await new Promise(r => setTimeout(r, reducedMotion() ? 0 : 300));
  runAnimated.value = true;
  run.value = runTarget();
  if (allDone.value) {
    setTimeout(() => emit('complete'), reducedMotion() ? 0 : 1000);
    return;
  }
  await new Promise(r => setTimeout(r, reducedMotion() ? 0 : 900));
  const tok = board.value?.querySelector<HTMLElement>('.token') ?? null;
  const curNode = rowEl(curTopicId.value)?.querySelector('.p-topic');
  if (tok && curNode && curTopicId.value !== fromTopic) {
    const a = fromNode.getBoundingClientRect();
    const b = curNode.getBoundingClientRect();
    await hop(tok, b.left - a.left, b.top - a.top);
    curNode.classList.add('pulse2');
    setTimeout(() => curNode.classList.remove('pulse2'), 2600);
  }
  const fromSec = c.value.path.find(t => t.id === fromTopic)?.section;
  const nextSec = c.value.path.find(t => t.id === curTopicId.value)?.section;
  if (fromSec && nextSec && fromSec !== nextSec) board.value?.querySelectorAll('.p-sec').forEach(s => { if (s.textContent?.trim() === fromSec) s.classList.add('flash-lime'); });
  showCta.value = true;
}

// ---------- brief popover ----------
const brief = reactive<{ t: PathTopic | null; item: PathItem | null; x: number; y: number }>({ t: null, item: null, x: 0, y: 0 });
// G2: playground and code share the eyebrow "Try it": one chip per label
const briefFormats = computed(() => [...new Map((brief.t?.formats ?? []).map(f => [BLOCK_META[f as keyof typeof BLOCK_META]?.eyebrow ?? f, f])).values()]);
function openBrief(t: PathTopic, e: MouseEvent, item: PathItem | null = null) {
  const el = e.currentTarget as HTMLElement;
  const r = el.getBoundingClientRect();
  const B = board.value!.getBoundingClientRect();
  const w = Math.min(340, window.innerWidth - 32);
  let x = r.right - B.left + 16;
  if (r.right + 16 + w > window.innerWidth - 8) x = r.left - B.left - w - 16;
  if (x + B.left < 8) x = 8 - B.left;
  brief.t = t; brief.item = item; brief.x = x; brief.y = r.top - B.top - 8;
}
function closeBrief() { brief.t = null; brief.item = null; }
function onDoc(e: MouseEvent) { const t = e.target as HTMLElement; if (brief.t && !t.closest('.brief') && !t.closest('.p-topic') && !t.closest('.p-sub')) closeBrief(); }
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closeBrief(); }
onMounted(() => { document.addEventListener('click', onDoc); document.addEventListener('keydown', onKey); });
onBeforeUnmount(() => { document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey); });

const briefLesson = computed(() => lessonById(c.value, brief.item ? brief.item.lesson : brief.t?.lesson));
function toggleDone() {
  const l = briefLesson.value;
  if (!l) return;
  const was = isDone(l.id);
  setDone(l.id, !was);
  closeBrief();
  void nextTick(() => draw());
  if (!was) { const n = nextLesson(c.value, l.id, isDone); if (!n) emit('complete'); }
}
function onTopic(t: PathTopic, e: MouseEvent) { openBrief(t, e); }
function onSub(t: PathTopic, it: PathItem, e: MouseEvent) {
  if (it.lesson && lessonById(c.value, it.lesson)) { go(lessonHref(it.lesson)); return; }
  openBrief(t, e, it);
}
const ctaLabel = computed(() => {
  const l = cur.value;
  if (!l) return '';
  const t = c.value.path.find(x => x.id === curTopicId.value);
  return `Continue · Step ${stepNo(t!) ?? l.n}, ${l.title.split(/[:,(]/)[0]!.trim()}`;
});
function onFinish() { if (allDone.value) emit('complete'); }
defineExpose({ redraw: draw });
</script>

<template>
  <section id="path" class="canvas-sec" style="margin-top: var(--sec-y); padding-top: 72px" aria-labelledby="path-h">
    <div class="p-head">
      <span class="eb"><span class="dot"><svg aria-hidden="true"><use href="#i-path" /></svg></span>Your path · {{ keptCount }} step{{ keptCount === 1 ? '' : 's' }} · {{ lessonsCount }} lesson{{ lessonsCount === 1 ? '' : 's' }}<template v-if="cutCount"> · {{ cutCount }} cut</template></span>
      <h2 id="path-h" class="display">One line <span class="hchip ink" aria-hidden="true"><svg><use href="#i-path" /></svg></span> to <span class="cob">{{ exam ? exam.weekdayLong + '.' : 'done.' }}</span></h2>
      <p class="lede">Ink boxes are the line. White ones hang off it. Lime means our pick.<template v-if="anyCut"> Dashed ones were cut to fit your days; the reason sits beside each.</template></p>
      <ul class="p-legend" aria-label="Marks">
        <li><span class="mk rec"></span>{{ MARK.recommended.label }}</li>
        <li><span class="mk alt"></span>{{ MARK.alternative.label }}</li>
        <li><span class="mk any"></span>{{ MARK.anytime.label }}</li>
      </ul>
    </div>

    <div ref="board" class="p-board">
      <span class="p-run" :style="{ '--run': run + 'px', transition: runAnimated ? '' : 'none' }" aria-hidden="true"></span>
      <svg class="p-wires" aria-hidden="true"><path v-for="w in wires" :key="w" :d="w.split('|')[1]" :class="{ lit: w.split('|')[0] === litTopic }" /></svg>
      <ol class="p-col">
        <template v-for="(r, i) in rows" :key="r.t.id">
          <li v-if="r.sec" class="p-sec">{{ r.sec }}</li>
          <li class="p-row rise" :data-topic="r.t.id" :style="{ '--i': Math.min(i, 12) }">
            <div v-for="side in (['l', 'r'] as const)" :key="side" :class="side === 'l' ? 'p-l' : 'p-r'" :style="{ order: side === 'l' ? 0 : 2 }">
              <template v-if="r.side === side">
                <template v-for="(g, gi) in r.groups" :key="gi">
                  <div v-if="g.name" class="p-grp"><em>{{ g.name }}</em>
                    <button v-for="it in g.items" :key="it.id" type="button" class="p-sub" :class="{ done: isDone(it.lesson), cut: it.cut }" @click.stop="onSub(r.t, it, $event)">
                      <span v-if="subMark(it)" class="mk" :class="subMark(it)"><svg v-if="isDone(it.lesson)" aria-hidden="true"><use href="#i-check" /></svg></span>{{ it.title }}
                    </button>
                  </div>
                  <template v-else>
                    <button v-for="it in g.items" :key="it.id" type="button" class="p-sub" :class="{ done: isDone(it.lesson), cut: it.cut }" @click.stop="onSub(r.t, it, $event)">
                      <span v-if="subMark(it)" class="mk" :class="subMark(it)"><svg v-if="isDone(it.lesson)" aria-hidden="true"><use href="#i-check" /></svg></span>{{ it.title }}
                    </button>
                  </template>
                </template>
              </template>
              <template v-if="other(r.side) === side">
                <div v-if="r.t.cut" class="p-note cutnote"><svg aria-hidden="true"><use href="#i-x" /></svg><span><b>Cut.</b> {{ r.t.cut_reason || 'Not needed for your goal.' }}</span></div>
                <div v-else-if="r.t.note" class="p-note"><svg aria-hidden="true"><use href="#i-spark" /></svg><span>{{ r.t.note }}</span></div>
              </template>
            </div>
            <div class="p-mid" style="order: 1; position: relative">
              <span v-if="r.state === 'cur'" class="token"><i><svg aria-hidden="true"><use href="#i-target" /></svg></i>You are here</span>
              <button type="button" class="p-topic" :class="r.state" :aria-describedby="`st-${r.t.id}`" @click.stop="onTopic(r.t, $event)" @mouseenter="litTopic = r.t.id" @mouseleave="litTopic = ''">
                <span class="no"><svg v-if="r.state === 'done'" class="ico" style="width:12px;height:12px" aria-hidden="true"><use href="#i-check" /></svg><svg v-else-if="r.t.cut" class="ico" style="width:11px;height:11px" aria-hidden="true"><use href="#i-x" /></svg><template v-else>{{ stepNo(r.t) }}</template></span>
                <span class="tt">{{ r.t.title }}</span>
                <span class="mt">{{ fmtMinutes(r.t.minutes) }} <svg v-for="(ic, k) in icons(r.t)" :key="k" aria-hidden="true"><use :href="'#' + ic" /></svg><span v-if="pct(r.t.weight)" class="wt" :title="`${pct(r.t.weight)} of last year's marks`">{{ pct(r.t.weight) }}</span></span>
                <span :id="`st-${r.t.id}`" class="sr-only">{{ r.state === 'done' ? 'Done' : r.state === 'cur' ? 'You are here' : r.state === 'cut' ? 'Cut from the plan' : '' }}, {{ r.t.minutes }} minutes</span>
              </button>
            </div>
          </li>
          <li v-if="showCta && r.state === 'cur'" class="p-cta"><a class="pill lime sm" :href="lessonHref(cur!.id)">{{ ctaLabel }}<span class="arr"><svg aria-hidden="true"><use href="#i-arrow" /></svg></span></a></li>
        </template>
      </ol>
      <button type="button" class="p-fin" :class="{ lit: allDone }" @click="onFinish">
        <span class="ck"><svg class="ico" style="width:12px;height:12px" aria-hidden="true"><use :href="allDone ? '#i-check' : '#i-flame'" /></svg></span>{{ exam ? `${isExamGoal(c) ? 'Exam' : 'Ready by'} · ${exam.weekday} ${exam.day}` : 'Path done' }}
      </button>
      <div v-if="c.further.length" class="p-further">
        <em>{{ isExamGoal(c) ? 'After the exam' : 'After that' }}</em>
        <span v-for="f in c.further" :key="f.title" class="p-sub" :title="f.topic"><span class="mk any"></span>{{ f.title }}</span>
      </div>

      <div v-if="brief.t" class="brief" role="dialog" :aria-label="brief.item ? brief.item.title : brief.t.title" :style="{ left: brief.x + 'px', top: brief.y + 'px' }">
        <button class="x" type="button" aria-label="Close" @click="closeBrief"><svg aria-hidden="true"><use href="#i-x" /></svg></button>
        <div class="place"><template v-if="stepNo(brief.t)"><span class="no">{{ stepNo(brief.t) }}</span>Step {{ stepNo(brief.t) }}</template><template v-else>Cut from the plan</template><template v-if="brief.t.section"> · {{ brief.t.section }}</template>
          <span v-if="brief.item?.mark" class="tag" :class="brief.item.mark === 'recommended' ? 'lime' : brief.item.mark === 'alternative' ? 'cob' : ''">{{ MARK[brief.item.mark].label }}</span>
          <span v-if="brief.item?.cut && !brief.t.cut" class="tag">Cut</span>
        </div>
        <h4>{{ brief.item ? brief.item.title : brief.t.title }}</h4>
        <p v-if="!brief.item && brief.t.summary">{{ brief.t.summary }}</p>
        <p v-if="brief.item">Part of {{ brief.t.title }}.<template v-if="brief.item.mark"> {{ MARK[brief.item.mark].blurb }}</template></p>
        <div v-if="!brief.item && brief.t.formats.length" class="fmts">
          <span v-for="f in briefFormats" :key="f" class="fmt"><i><svg aria-hidden="true"><use :href="'#' + (BLOCK_META[f as keyof typeof BLOCK_META]?.icon ?? 'i-book')" /></svg></i>{{ BLOCK_META[f as keyof typeof BLOCK_META]?.eyebrow || 'Reading' }}</span>
        </div>
        <p v-if="!brief.item && pct(brief.t.weight)"><b>{{ pct(brief.t.weight) }}</b> of last year's marks.</p>
        <div v-if="brief.t.cut" class="p-note cutnote" style="max-width:none"><svg aria-hidden="true"><use href="#i-x" /></svg><span>{{ brief.t.cut_reason }}</span></div>
        <div v-else-if="brief.t.note && !brief.item" class="p-note" style="max-width:none"><svg aria-hidden="true"><use href="#i-spark" /></svg><span>{{ brief.t.note }}</span></div>
        <div class="acts">
          <a v-if="briefLesson" class="pill dark sm" :href="lessonHref(briefLesson.id)">Open lesson<span class="arr"><svg aria-hidden="true"><use href="#i-arrow" /></svg></span></a>
          <button v-if="briefLesson" type="button" class="quiet" @click="toggleDone">{{ isDone(briefLesson.id) ? 'Mark not done' : 'Mark done' }}</button>
          <span v-if="!briefLesson && !brief.t.cut" class="quiet" style="text-decoration:none">Covered inside the step's lesson.</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style>
@media (max-width: 900px) { .p-mid { order: -1 !important; } .p-l { order: 1 !important; } .p-r { order: 2 !important; } }
</style>
