<script setup lang="ts">
// Lesson (#/l/<id>): head slab, mentor note, table of blocks, the 720px reading column with every block
// through the registry, the finish card, and the narration dock (player-design §4).
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
// G2: the lede is one "By the end you can..." sentence, not the whole node summary
const firstSentence = (t?: string | null): string => (t ?? '').split(/(?<=[.!?])\s+(?=[A-Z])/)[0] ?? '';
import type { Course, CourseLesson } from '@bilimind/core';
import { lessonById, nextLesson, stepLabel, topicOf } from '../runtime/model.ts';
import { isDone, lessonProgress, markSeen, progress, setDone } from '../runtime/progress.ts';
import { loadNarration, relight, seekCue, voice } from '../runtime/narration.ts';
import { keepWrapped } from '../runtime/wrap.ts';
import { confetti, flash, reducedMotion } from '../runtime/motion.ts';
import { go, homeHref, route } from '../router.ts';
import LessonBar from '../components/LessonBar.vue';
import LessonHead from '../components/LessonHead.vue';
import LessonToc from '../components/LessonToc.vue';
import BlockFrame from '../components/BlockFrame.vue';
import FinishCard from '../components/FinishCard.vue';
import NarrationDock from '../components/NarrationDock.vue';

const props = defineProps<{ course: Course; lessonId: string }>();
const lesson = computed<CourseLesson | undefined>(() => lessonById(props.course, props.lessonId));
const step = computed(() => stepLabel(props.course, props.lessonId));
const topic = computed(() => topicOf(props.course, props.lessonId));
const lp = computed(() => progress.lessons[props.lessonId]);
const seen = computed(() => new Set(lp.value?.seen ?? []));
const passed = computed(() => new Set(lp.value?.passed ?? []));
const done = computed(() => isDone(props.lessonId));
const next = computed(() => nextLesson(props.course, props.lessonId, id => id !== props.lessonId && isDone(id)));
const currentIndex = ref(0);
const col = ref<HTMLElement | null>(null);
const listening = computed(() => voice.key === props.lessonId && voice.started);
const speaking = computed(() => (voice.key === props.lessonId && voice.playing ? voice.cue.split('.')[0] ?? '' : ''));

let stopWrap: (() => void) | null = null;
let io: IntersectionObserver | null = null;
let raf = 0;

function setup() {
  const l = lesson.value;
  if (!l) return;
  lessonProgress(l.id);
  loadNarration(l.id, l.narration, l.title);
  stopWrap?.();
  io?.disconnect();
  void nextTick(() => {
    if (!col.value) return;
    stopWrap = keepWrapped(col.value, id => l.blocks.find(b => b.id === id));
    relight();
    io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const need = Math.min(e.boundingClientRect.height * 0.6, window.innerHeight * 0.4);
        if (e.intersectionRect.height >= need - 1) markSeen(l.id, (e.target as HTMLElement).dataset.frame ?? '');
      }
    }, { threshold: [0, 0.25, 0.6, 1], rootMargin: '0px 0px -20% 0px' });
    col.value.querySelectorAll('[data-frame]').forEach(f => io!.observe(f));
    if (route.block) jump(route.block, false);
    else window.scrollTo({ top: 0, behavior: 'auto' });
    onScroll();
  });
}

function onScroll() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    const frames = col.value?.querySelectorAll<HTMLElement>('[data-frame]');
    if (!frames?.length) return;
    let idx = 0;
    const line = window.innerHeight * 0.4;
    frames.forEach((f, i) => { if (f.getBoundingClientRect().top < line) idx = i; });
    currentIndex.value = idx;
  });
}

function jump(blockId: string, smooth = true) {
  const el = document.getElementById(`bf-${blockId}`);
  if (!el) return;
  el.scrollIntoView({ block: 'start', behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
  flash(el);
}

function onColClick(e: MouseEvent) {
  const s = (e.target as HTMLElement).closest<HTMLElement>('.s[data-s]');
  if (!s || !listening.value) return;
  if ((e.target as HTMLElement).closest('a, button, input, textarea, label, .cite')) return;
  seekCue(s.dataset.s!);
}

function complete(from?: HTMLElement) {
  const l = lesson.value;
  if (!l) return;
  if (done.value) { go(homeHref(`at=${encodeURIComponent(l.id)}`)); return; }
  setDone(l.id, true);
  const r = from?.getBoundingClientRect();
  confetti(r ? r.left + r.width / 2 : window.innerWidth / 2, r ? r.top + r.height / 2 : 80, 18, ['#C6F24E', '#2340E6', '#0B0D10', '#FF5A3C']);
  setTimeout(() => go(homeHref(`from=${encodeURIComponent(l.id)}`)), reducedMotion() ? 200 : 1100);
}
function undo() { if (lesson.value) setDone(lesson.value.id, false); }

onMounted(() => { setup(); window.addEventListener('scroll', onScroll, { passive: true }); });
watch(() => props.lessonId, () => setup());
watch(() => route.block, b => { if (b) jump(b); });
onBeforeUnmount(() => { stopWrap?.(); io?.disconnect(); window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); });
</script>

<template>
  <div v-if="lesson" :key="lesson.id" class="view lesson" data-view="lesson" :data-lesson="lesson.id">
    <LessonBar :lesson="lesson" :step="step.step" :seen="seen.size" :total="lesson.blocks.length" :current-index="currentIndex" :done="done" :passed="passed"
               @complete="complete()" @jump="jump" />
    <LessonHead :course="course" :lesson="lesson" :step="step.step" :of="step.of" />
    <div class="l-wrap">
      <LessonToc :lesson="lesson" :seen="seen" :passed="passed" :current-index="currentIndex" :speaking="speaking" @jump="jump" />
      <main ref="col" class="l-col" :class="{ listening }" @click="onColClick">
        <p class="lede l-lede">{{ firstSentence(lesson.summary) }}</p>
        <aside v-if="topic?.note" class="callout note"><span class="ci"><svg aria-hidden="true"><use href="#i-spark" /></svg></span><div><div class="ce">Mentor note</div><p>{{ topic.note }}</p></div></aside>
        <aside v-if="lesson.thin" class="callout warn"><span class="ci"><svg aria-hidden="true"><use href="#i-warning" /></svg></span><div><div class="ce">Thin sources</div><p>Your files say little about this topic, so parts of this lesson go beyond them. Those answers carry a "beyond your slides" label.</p></div></aside>
        <BlockFrame v-for="b in lesson.blocks" :key="b.id" :block="b" :lesson="lesson" :course="course" />
        <FinishCard :course="course" :lesson="lesson" :step="step.step" :done="done" :passed="passed" :next="next" @complete="complete" @undo="undo" />
      </main>
    </div>
    <NarrationDock :lesson="lesson" />
  </div>
  <div v-else class="empty" data-view="missing">
    <h1 class="display">Lesson not found</h1>
    <p class="lede">This course has no lesson called “{{ lessonId }}”.</p>
    <a class="pill dark" :href="homeHref()">Back to the path</a>
  </div>
</template>
