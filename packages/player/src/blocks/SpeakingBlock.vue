<script setup lang="ts">
// Speaking drill (WP5c, player-design 5.13, PLAN 0 #9: record-and-compare with self-rating, never live
// recognition scoring). One phrase at a time: play the native mp3, record yourself with MediaRecorder (live
// waveform from an AnalyserNode), play your take back beside the native one, rate it. A blocked microphone
// shows one friendly line and the drill keeps working (listen and repeat aloud).
import { computed, onBeforeUnmount, ref } from 'vue';
import type { Course, CourseLesson } from '@bilimind/core';
import type { BlockOf } from './types.ts';
import { renderMd } from '../assessments/md.ts';
import { isPassedStored, loadUi, markPassed, saveUi } from '../assessments/store.ts';
import TaskShell from '../assessments/ui/TaskShell.vue';
import Ico from '../assessments/ui/Ico.vue';

const props = defineProps<{ block: BlockOf<'speaking'>; lesson: CourseLesson; course: Course }>();
type SelfRating = 'nailed' | 'close' | 'again';
const items = computed(() => props.block.payload.items ?? []);
const lang = computed(() => props.block.payload.language || undefined);
const uiKey = `${props.lesson.id}/${props.block.id}`;

const idx = ref(0);
const item = computed(() => items.value[idx.value]);
const ratings = ref<Record<number, SelfRating>>(loadUi<Record<number, SelfRating>>(props.course.id, uiKey, {}));
const takes = ref<Record<number, string>>({});
const playing = ref<'native' | 'yours' | null>(null);
const nativeBroken = ref<Record<number, boolean>>({});
const recording = ref(false);
const micMsg = ref('');
const bars = ref<number[]>(Array.from({ length: 32 }, () => 0.12));
const passed = ref(isPassedStored(props.course.id, props.lesson.id, props.block.id));
const live = ref('');

const audio = typeof Audio !== 'undefined' ? new Audio() : null;
if (audio) {
  audio.preload = 'none';
  audio.onended = () => { playing.value = null; };
  audio.onerror = () => { if (playing.value === 'native') nativeBroken.value = { ...nativeBroken.value, [idx.value]: true }; playing.value = null; };
}
function play(kind: 'native' | 'yours') {
  if (!audio) return;
  if (playing.value === kind) { audio.pause(); playing.value = null; return; }
  const src = kind === 'native' ? item.value?.audio : takes.value[idx.value];
  if (!src) return;
  audio.pause();
  audio.src = src;
  audio.currentTime = 0;
  playing.value = kind;
  audio.play().catch(() => {
    if (kind === 'native') nativeBroken.value = { ...nativeBroken.value, [idx.value]: true };
    playing.value = null;
  });
}

let stream: MediaStream | null = null;
let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let ctx: AudioContext | null = null;
let raf = 0;
let stopTimer: ReturnType<typeof setTimeout> | undefined;

async function record() {
  if (recording.value) { stopRec(); return; }
  micMsg.value = '';
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    micMsg.value = 'Recording is not available in this browser. Listen, then say it aloud and rate yourself.';
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    const name = (e as { name?: string })?.name ?? '';
    micMsg.value = name === 'NotFoundError' || name === 'OverconstrainedError'
      ? 'No microphone found. Listen, then say it aloud and rate yourself.'
      : 'The microphone is blocked. Allow it from the address bar to record; you can still listen and rate yourself.';
    return;
  }
  try {
    audio?.pause(); playing.value = null;
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(m => MediaRecorder.isTypeSupported?.(m));
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunks = [];
    const at = idx.value;
    recorder.ondataavailable = ev => { if (ev.data.size) chunks.push(ev.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' });
      if (takes.value[at]) URL.revokeObjectURL(takes.value[at]!);
      takes.value = { ...takes.value, [at]: URL.createObjectURL(blob) };
      live.value = 'Recorded. Play yours next to the native voice, then rate it.';
      cleanupStream();
    };
    recorder.start();
    recording.value = true;
    meter(stream);
    stopTimer = setTimeout(stopRec, 12_000);
  } catch {
    micMsg.value = 'Recording could not start here. Listen, then say it aloud and rate yourself.';
    cleanupStream();
  }
}
function meter(s: MediaStream) {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const an = ctx.createAnalyser();
    an.fftSize = 64;
    ctx.createMediaStreamSource(s).connect(an);
    const data = new Uint8Array(an.frequencyBinCount);
    const tick = () => {
      an.getByteFrequencyData(data);
      bars.value = bars.value.map((v, i) => v + ((Math.max(0.12, (data[i % data.length] ?? 0) / 255)) - v) * 0.35);
      raf = requestAnimationFrame(tick);
    };
    tick();
  } catch { /* the waveform is decoration */ }
}
function stopRec() {
  clearTimeout(stopTimer);
  if (recorder && recorder.state !== 'inactive') recorder.stop(); else cleanupStream();
  recording.value = false;
}
function cleanupStream() {
  cancelAnimationFrame(raf);
  bars.value = bars.value.map(() => 0.12);
  stream?.getTracks().forEach(t => t.stop());
  stream = null;
  ctx?.close().catch(() => {});
  ctx = null;
  recording.value = false;
}
onBeforeUnmount(() => {
  stopRec(); cleanupStream(); audio?.pause();
  Object.values(takes.value).forEach(u => URL.revokeObjectURL(u));
});

function go(d: number) {
  if (recording.value) stopRec();
  audio?.pause(); playing.value = null;
  idx.value = Math.max(0, Math.min(items.value.length - 1, idx.value + d));
}
const RATE: [SelfRating, string][] = [['nailed', 'Nailed it'], ['close', 'Close'], ['again', 'Again']];
function rateIt(r: SelfRating) {
  ratings.value = { ...ratings.value, [idx.value]: r };
  saveUi(props.course.id, uiKey, ratings.value);
  if (items.value.every((_, i) => ratings.value[i]) && !passed.value) {
    passed.value = true;
    markPassed(props.course.id, props.lesson.id, props.block.id);
  }
  if (idx.value < items.value.length - 1) setTimeout(() => go(1), 450);
}
const rated = computed(() => Object.keys(ratings.value).length);
</script>

<template>
  <TaskShell :block="block" :passed="passed">
    <template #actions>
      <span class="tag quiet num">{{ rated }}/{{ items.length }} rated</span>
    </template>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-if="block.payload.intro_markdown" class="md sm spk-intro" v-html="renderMd(block.payload.intro_markdown)" />
    <div v-if="item" class="spk-card" :key="idx">
      <p class="spk-ph" :lang="lang">{{ item.text }}</p>
      <p v-if="item.translation" class="spk-tr">{{ item.translation }}</p>
      <p v-if="item.phonetic" class="spk-pn">{{ item.phonetic }}</p>
      <div class="spk-ctl">
        <button type="button" class="spk-nat" :class="{ on: playing === 'native' }" :disabled="!item.audio || nativeBroken[idx]"
          :aria-label="playing === 'native' ? 'Stop the native voice' : 'Play the native voice'" :title="!item.audio || nativeBroken[idx] ? 'Native audio is not in this copy of the course' : 'Native voice'"
          data-native @click="play('native')">
          <span v-if="playing === 'native'" class="eq" aria-hidden="true"><i /><i /><i /></span>
          <Ico v-else name="speaker" />
        </button>
        <button type="button" class="spk-rec" :class="{ on: recording }" :aria-pressed="recording"
          :aria-label="recording ? 'Stop recording' : 'Record yourself'" data-record @click="record">
          <Ico :name="recording ? 'stop' : 'mic'" />
        </button>
        <button type="button" class="spk-you" :class="{ show: !!takes[idx], on: playing === 'yours' }" :disabled="!takes[idx]"
          :aria-label="playing === 'yours' ? 'Stop your take' : 'Play your take'" @click="play('yours')">
          <Ico :name="playing === 'yours' ? 'pause' : 'user'" />
        </button>
      </div>
      <p class="spk-lab">
        <span>Native</span><span>{{ recording ? 'Listening… tap to stop' : 'Record' }}</span><span :class="{ show: !!takes[idx] }">Yours</span>
      </p>
      <div v-if="recording" class="spk-wave" aria-hidden="true"><i v-for="(v, i) in bars" :key="i" :style="{ '--v': v.toFixed(3) }" /></div>
      <p v-if="micMsg" class="spk-msg" role="status">{{ micMsg }}</p>
      <p v-if="nativeBroken[idx]" class="spk-msg quiet">The native clip is not in this copy of the course. Read it aloud from the text.</p>

      <div class="spk-res">
        <span class="eyebrow-s">Compare by ear, then rate it</span>
        <div class="spk-rate" role="radiogroup" aria-label="How did it sound?">
          <button v-for="[r, lab] in RATE" :key="r" type="button" role="radio" class="sr" :class="[r, { on: ratings[idx] === r }]"
            :aria-checked="ratings[idx] === r" :data-rate="r" @click="rateIt(r)">{{ lab }}</button>
        </div>
      </div>
    </div>
    <div v-if="items.length > 1" class="spk-pg">
      <button type="button" class="btn ghost sm" :disabled="idx === 0" aria-label="Previous phrase" @click="go(-1)"><Ico name="back" /></button>
      <span class="spk-dots" aria-hidden="true">
        <i v-for="(_, i) in items" :key="i" :class="[ratings[i] ?? '', { now: i === idx }]" />
      </span>
      <span class="spk-pos num">{{ idx + 1 }} / {{ items.length }}</span>
      <button type="button" class="btn ghost sm" :disabled="idx === items.length - 1" aria-label="Next phrase" @click="go(1)"><Ico name="arrow" /></button>
    </div>
    <span class="sr-only" aria-live="polite">{{ live }}</span>
  </TaskShell>
</template>

<style>
.bmx .spk-intro { margin-bottom: 14px; color: var(--text-2); }
.bmx .spk-card { display: grid; justify-items: center; gap: 6px; padding: clamp(18px, 3vw, 32px) 16px; border-radius: var(--r-sm); background: var(--surface-2); box-shadow: var(--hair); text-align: center; animation: pop .3s var(--ease-out); }
.bmx .spk-ph { margin: 0; font: 600 clamp(24px, 2.6vw, 34px)/1.15 var(--display); letter-spacing: -0.025em; color: var(--text); text-wrap: balance; }
.bmx .spk-tr { margin: 0; font: 400 15px/1.45 var(--body); color: var(--text-2); }
.bmx .spk-pn { margin: 0; font: italic 400 14px/1.4 var(--body); color: var(--text-3); }
.bmx .spk-ctl { display: flex; align-items: center; justify-content: center; gap: 18px; margin-top: 18px; }
.bmx .spk-nat { position: relative; width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; background: var(--ink); color: #fff; box-shadow: var(--sh-play); transition: transform var(--d-press), opacity var(--d-fast); }
.bmx .spk-nat .bm-ico { width: 20px; height: 20px; }
.bmx .spk-nat[disabled] { opacity: .35; cursor: not-allowed; box-shadow: none; }
.bmx .spk-nat:active:not([disabled]), .bmx .spk-you:active:not([disabled]) { transform: scale(.94); }
.bmx .eq { display: flex; align-items: flex-end; gap: 3px; height: 16px; }
.bmx .eq i { width: 3px; height: 100%; border-radius: 2px; background: var(--lime); transform-origin: bottom; animation: eq .8s ease-in-out infinite; }
.bmx .eq i:nth-child(2) { animation-delay: -.25s; } .bmx .eq i:nth-child(3) { animation-delay: -.5s; }
@keyframes eq { 0%, 100% { transform: scaleY(.3); } 50% { transform: scaleY(1); } }
.bmx .spk-rec { position: relative; width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; background: var(--lime); color: var(--ink); box-shadow: 0 14px 28px -12px rgb(100 140 10 / 0.6); transition: transform var(--d-press), background var(--d-fast); }
.bmx .spk-rec .bm-ico { width: 24px; height: 24px; }
.bmx .spk-rec:active { transform: scale(.95); }
.bmx .spk-rec.on { background: var(--ink); color: #fff; animation: ping 1.3s ease-out infinite; }
.bmx .spk-rec.on::after { content: ""; position: absolute; top: 12px; right: 12px; width: 10px; height: 10px; border-radius: 50%; background: var(--coral); animation: pulse 1s infinite; }
.bmx .spk-you { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--surface); box-shadow: var(--hair-strong); color: var(--ink-3); opacity: .35; transition: opacity var(--d-base), transform var(--d-press), background var(--d-fast); }
.bmx .spk-you.show { opacity: 1; }
.bmx .spk-you.on { background: var(--cobalt); color: #fff; box-shadow: none; }
.bmx .spk-you .bm-ico { width: 16px; height: 16px; }
.bmx .spk-lab { display: grid; grid-template-columns: 52px 64px 40px; gap: 18px; margin: 6px 0 0; font: var(--t-cap); color: var(--text-3); }
.bmx .spk-lab span { white-space: nowrap; display: flex; justify-content: center; }
.bmx .spk-lab span:last-child { opacity: .35; } .bmx .spk-lab span.show { opacity: 1; }
.bmx .spk-wave { display: flex; align-items: center; justify-content: center; gap: 3px; height: 36px; margin-top: 10px; }
.bmx .spk-wave i { width: 3px; height: 100%; border-radius: 3px; background: var(--ink); transform: scaleY(var(--v, .12)); transition: transform 60ms linear; }
.bmx .spk-msg { margin: 10px 0 0; max-width: 44ch; padding: 9px 13px; border-radius: 12px; background: var(--note-bg); color: var(--note-ink); font: 500 13.5px/1.45 var(--body); }
.bmx .spk-msg.quiet { background: var(--fill); color: var(--text-2); }
.bmx .spk-res { grid-template-columns: minmax(0, 1fr); text-align: center; display: grid; justify-items: center; gap: 10px; width: 100%; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--line); }
.bmx .spk-rate { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.bmx .spk-rate .sr { height: 40px; padding: 0 16px; border-radius: 99px; font: 600 14px/1 var(--body); background: var(--surface); box-shadow: var(--hair-strong); color: var(--ink-3); transition: background var(--d-fast), transform var(--d-press), box-shadow var(--d-fast); }
.bmx .spk-rate .sr:active { transform: scale(.96); }
.bmx .spk-rate .sr.nailed.on { background: var(--lime); color: var(--ink); box-shadow: none; }
.bmx .spk-rate .sr.close.on { background: var(--cobalt-soft); color: var(--cobalt); box-shadow: none; }
.bmx .spk-rate .sr.again.on { background: var(--coral-soft); color: var(--coral-ink); box-shadow: none; }
.bmx .spk-pg { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 14px; }
.bmx .spk-pg .btn.sm { width: 36px; padding: 0; }
.bmx .spk-dots { display: flex; gap: 5px; }
.bmx .spk-dots i { width: 8px; height: 8px; border-radius: 50%; background: var(--dot-idle); }
.bmx .spk-dots i.nailed { background: var(--lime-2); } .bmx .spk-dots i.close { background: var(--cobalt); } .bmx .spk-dots i.again { background: var(--coral); }
.bmx .spk-dots i.now { background: var(--surface); box-shadow: inset 0 0 0 2px var(--ink); }
.bmx .spk-pos { font: var(--t-cap); color: var(--text-3); }
</style>
