<script setup lang="ts">
// Course hero slab (player-design §3.2): skin cobalt | ink | lime, title with inline chips and the exam
// countdown, lede, four stats, the Continue CTA and the "Hear the plan" orb; the course's 3D object
// breaks out of the slab with three floating fact tags.
import { computed, ref } from 'vue';
import type { Course } from '@bilimind/core';
import { builtWhen, countdownChip, examInfo, fmtClock, fmtMinutes, now, ymdIn } from '../runtime/time.ts';
import { currentLesson, isExamGoal, lessonOrder, questionCount, stepLabel, totalMinutes } from '../runtime/model.ts';
import { isDone, progress } from '../runtime/progress.ts';
import { lessonHref } from '../router.ts';
import { loadNarration, toggle, voice } from '../runtime/narration.ts';
import Orb from './Orb.vue';

const props = defineProps<{ course: Course }>();
const c = computed(() => props.course);
const tz = computed(() => c.value.goal.timezone);
const today = computed(() => ymdIn(now(), tz.value));
const exam = computed(() => examInfo(c.value.goal.exam_at, tz.value));
const chip = computed(() => countdownChip(exam.value?.ymd, today.value));

const words = computed(() => c.value.title.trim().split(/\s+/));
const firstWord = computed(() => words.value[0] ?? '');
const middle = computed(() => words.value.slice(1, -1).join(' '));
const lastWord = computed(() => (words.value.length > 1 ? words.value[words.value.length - 1]! : ''));
const long = computed(() => c.value.title.length > 26);
const xlong = computed(() => c.value.title.length > 40);   // G2: 51-char titles wrapped to 5 lines
const chipIcon = computed(() => c.value.chips[0] || 'i-spark');

const lessons = computed(() => lessonOrder(c.value));
const stats = computed(() => [
  { n: String(lessons.value.length), l: lessons.value.length === 1 ? 'lesson' : 'lessons' },
  { n: fmtMinutes(totalMinutes(c.value)), l: 'to learn' },
  { n: String(questionCount(c.value)), l: 'questions' },
  { n: String(c.value.receipts.cards), l: 'cards' },
].filter(s => s.n !== '0'));

const started = computed(() => Object.values(progress.lessons).some(l => l.done || l.seen.length > 0));
const cur = computed(() => currentLesson(c.value, isDone));
const cta = computed(() => {
  if (!cur.value) return { label: 'Path done · Review it', href: lessonHref(lessons.value[0]!.id) };
  if (!started.value) return { label: 'Start the path', href: lessonHref(cur.value.id) };
  const s = stepLabel(c.value, cur.value.id);
  const short = cur.value.title.length > 26 ? cur.value.title.split(/[:,(]/)[0]!.trim() : cur.value.title;
  return { label: `Continue · Step ${s.step}, ${short}`, href: lessonHref(cur.value.id) };
});

const planOn = computed(() => voice.key === 'plan' && voice.playing);
const orbSub = computed(() => {
  if (!c.value.narration) return 'Narration not ready';
  if (voice.key === 'plan' && voice.error) return 'Audio file not found';
  if (voice.key === 'plan' && voice.started) return `${fmtClock(voice.t)} / ${fmtClock(voice.duration)}`;
  return `${fmtClock(c.value.narration.duration_ms)} · read out loud`;
});
function hearPlan() {
  if (!c.value.narration) return;
  loadNarration('plan', c.value.narration, `${c.value.title}: the plan`);
  toggle();
}

const objSrc = computed(() => c.value.object || 'img/obj-book.webp');
const objOk = ref(true);
const due = computed(() => (isExamGoal(c.value) ? 'Exam' : 'Ready by'));
// the engine's lede opens "Exam Sunday 18 October at 9:00."; a non-exam goal (onboarding, a language month) reads "Ready by"
const lede = computed(() => (isExamGoal(c.value) ? c.value.lede : c.value.lede.replace(/^Exam (.+?) at [^.]*\d\./, 'Ready by $1.')));
const tags = computed(() => [
  { cls: 't1', icon: 'i-file', text: 'Grounded in your files' },
  { cls: 't2', icon: c.value.allows_code ? 'i-code' : 'i-speaker', text: c.value.allows_code ? 'Code that runs' : 'Read out loud' },
  { cls: 't3', icon: 'i-cal', text: exam.value ? `${due.value} · ${exam.value.weekday} ${exam.value.day}` : `${lessons.value.length} lessons` },
]);
const eyebrow = computed(() => {
  const f = c.value.receipts.files;
  const when = builtWhen(c.value.built_at, now(), tz.value);
  return `Built from ${f} of your file${f === 1 ? '' : 's'}${when ? ' · ' + when : ''}`;
});
</script>

<template>
  <section class="slab c-hero" :class="c.skin" aria-labelledby="bm-title">
    <i class="beams" aria-hidden="true"></i><i class="grain" aria-hidden="true"></i>
    <div class="copy">
      <span class="eb on-dark rise" style="--i:0"><span class="dot"><svg aria-hidden="true"><use href="#i-spark" /></svg></span>{{ eyebrow }}</span>
      <h1 id="bm-title" class="display hero rise" :class="{ long, xlong }" style="--i:1">
        {{ firstWord }}{{ ' ' }}<span class="hchip" aria-hidden="true"><svg><use :href="'#' + chipIcon" /></svg></span>{{ middle ? ' ' + middle : '' }}{{ lastWord ? ' ' : '' }}<span v-if="lastWord" class="lime">{{ lastWord }}</span>{{ chip ? ' ' : '' }}<span v-if="chip" class="hchip pill">{{ chip }}</span>
      </h1>
      <p class="lede rise" style="--i:2">{{ lede }}</p>
      <ul class="c-stats rise" style="--i:3">
        <li v-for="s in stats" :key="s.l"><b>{{ s.n }}</b><span>{{ s.l }}</span></li>
      </ul>
      <div class="c-acts rise" style="--i:4">
        <a class="pill lg" :class="c.skin === 'lime' ? 'ink-cta' : 'lime'" :href="cta.href" data-cta>{{ cta.label }}<span class="arr"><svg aria-hidden="true"><use href="#i-arrow" /></svg></span></a>
        <Orb :label="planOn ? 'Pause the plan' : 'Hear the plan'" :sub="orbSub" :on="planOn" :amp="voice.key === 'plan' ? voice.amp : 0" :disabled="!c.narration" @toggle="hearPlan" />
      </div>
    </div>
    <div class="stage" aria-hidden="true">
      <img v-if="objOk" class="obj" :src="objSrc" alt="" @error="objOk = false" />
      <span v-for="(t, i) in tags" :key="t.cls" class="ftag rise" :class="t.cls" :style="{ '--i': 5 + i }"><i><svg class="ico"><use :href="'#' + t.icon" /></svg></i>{{ t.text }}</span>
    </div>
  </section>
</template>
