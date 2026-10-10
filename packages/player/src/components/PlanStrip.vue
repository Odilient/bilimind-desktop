<script setup lang="ts">
// Study-plan strip (player-design §3.3): a live countdown to the exam, one card per planned day
// (today ink, exam lime, past days done or hatched), and the calendar / Anki exports.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Course, PlanDay } from '@bilimind/core';
import { countdownText, dayParts, examInfo, now, ymdIn } from '../runtime/time.ts';
import { isDone } from '../runtime/progress.ts';

const props = defineProps<{ course: Course }>();
const tz = computed(() => props.course.goal.timezone);
const tickNow = ref(now());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => { timer = setInterval(() => { tickNow.value = now(); }, 30_000); });
onBeforeUnmount(() => clearInterval(timer));

const today = computed(() => ymdIn(tickNow.value, tz.value));
const exam = computed(() => examInfo(props.course.goal.exam_at, tz.value));
const left = computed(() => countdownText(props.course.goal.exam_at, tickNow.value));

interface DayView { d: PlanDay; cls: string[]; name: string; date: number; dots: { cls: string }[]; cap: string; tag: string }
const days = computed<DayView[]>(() => props.course.plan.days.map(d => {
  const p = dayParts(d.date);
  const isToday = d.date === today.value;
  const past = d.date < today.value;
  const n = d.lessons.length;
  const doneN = d.lessons.filter(isDone).length;
  const dots = d.lessons.map(id => ({ cls: isDone(id) ? 'done' : '' }));
  if (d.reviews > 0) dots.push({ cls: 'rv' });
  let cap = '';
  // G2: one time format (the countdown's), and the day's minutes already include its reviews
  if (d.exam) cap = exam.value ? `Exam · ${exam.value.time}` : d.label || 'Exam';
  else if (n && doneN === n) cap = `${n} lesson${n > 1 ? 's' : ''} · done`;
  else if (n) cap = `${n} lesson${n > 1 ? 's' : ''} · ${d.minutes} min`;
  else if (d.reviews) cap = `Review · ${d.reviews} lesson${d.reviews > 1 ? 's' : ''} · ${d.minutes} min`;
  else cap = 'Rest day';
  const missed = past && n > 0 && doneN < n && !d.exam;
  if (missed) cap = `${n - doneN} still to do`;
  const cls = [isToday ? 'today' : '', d.exam ? 'exam' : '', past ? 'past' : '', missed ? 'missed' : ''].filter(Boolean);
  return { d, cls, name: p.weekday, date: p.day, dots, cap, tag: d.exam ? 'Exam' : isToday ? 'Today' : '' };
}));

const ics = computed(() => props.course.exports.find(e => e.kind === 'ics'));
const anki = computed(() => props.course.exports.find(e => e.kind === 'apkg') ?? props.course.exports.find(e => e.kind === 'anki_csv'));
</script>

<template>
  <div class="c-plan" role="list" aria-label="Your study plan">
    <div v-if="exam && left" class="count rise" role="listitem" style="--i:0">
      <span class="dn"><svg aria-hidden="true"><use href="#i-timer" /></svg>Exam in</span>
      <span class="dd" data-countdown>{{ left }}</span>
      <span class="cap">{{ exam.weekdayLong }} {{ exam.day }}, {{ exam.time }}</span>
    </div>
    <div v-for="(v, i) in days" :key="v.d.date" class="day rise" :class="v.cls" role="listitem" :style="{ '--i': i + 1 }" :data-day="v.d.date">
      <span v-if="v.tag" class="tg"><svg v-if="v.d.exam" aria-hidden="true"><use href="#i-flame" /></svg>{{ v.tag }}</span>
      <span class="dn">{{ v.name }}</span>
      <span class="dd">{{ v.date }}</span>
      <span class="dots" aria-hidden="true"><i v-for="(dot, k) in v.dots" :key="k" :class="dot.cls"></i></span>
      <span class="cap">{{ v.cap }}</span>
    </div>
    <div v-if="ics || anki" class="exports">
      <a v-if="ics" class="pill light sm" :href="ics.file" download><svg class="ico" aria-hidden="true"><use href="#i-cal" /></svg>Add to calendar</a>
      <a v-if="anki" class="pill light sm" :href="anki.file" download><svg class="ico" aria-hidden="true"><use href="#i-cards" /></svg>Anki deck</a>
    </div>
  </div>
</template>
