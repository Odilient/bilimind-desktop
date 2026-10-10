<script setup lang="ts">
// Audio ("Listen"): a short spoken passage with an ink transport bar (lime play, scrubber, time) and the
// transcript to read along (narration highlights it too). Plays payload.src (an Edge TTS clip made by
// `bilimind narrate`); without it, or when the file is missing, the browser's own voice reads the script.
// Starting it pauses any other media on the page and announces itself with a `bm:audio` window event.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { spokenText } from '@bilimind/core';
import type { Course, CourseLesson } from '@bilimind/core';
import type { BlockOf } from './types.ts';
import BlockHead from './reading/BlockHead.vue';
import CiteChips from './reading/CiteChips.vue';
import Icon from './reading/Icon.vue';
import { renderMarkdown } from './reading/markdown.ts';
import { useCues } from './reading/cues.ts';
import './reading/reading.css';

const props = defineProps<{ block: BlockOf<'audio'>; lesson: CourseLesson; course: Course }>();
const root = ref<HTMLElement | null>(null);
const el = ref<HTMLAudioElement | null>(null);
useCues(root, () => props.block);

const p = computed(() => props.block.payload);
const script = computed(() => renderMarkdown(p.value?.script_markdown ?? ''));
const plain = computed(() => spokenText(p.value?.script_markdown ?? '').replace(/\n/g, ' '));
const src = computed(() => p.value?.src ?? '');

const hasSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
const mode = ref<'file' | 'speech' | 'none'>(src.value ? 'file' : hasSpeech ? 'speech' : 'none');
const playing = ref(false);
const pos = ref(0);
const dur = ref((p.value?.duration_estimate_s ?? 0) || Math.round(plain.value.split(/\s+/).length / 2.5));
const myId = `au-${Math.random().toString(36).slice(2)}`;

const fmt = (s: number) => { const t = Math.max(0, Math.round(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const pct = computed(() => (dur.value > 0 ? Math.min(100, (pos.value / dur.value) * 100) : 0));
const label = computed(() => (mode.value === 'speech' ? 'Browser voice' : mode.value === 'none' ? 'Audio is not included in this copy' : 'Narrated passage'));

function announce() { window.dispatchEvent(new CustomEvent('bm:audio', { detail: { id: myId } })); }
function others(e: Event) { if ((e as CustomEvent).detail?.id !== myId && playing.value) pause(); }
function mediaElsewhere(e: Event) { if (e.target !== el.value && playing.value && e.target instanceof HTMLMediaElement) pause(); }

// file playback
function onMeta() { if (el.value && Number.isFinite(el.value.duration) && el.value.duration > 0) dur.value = el.value.duration; }
function onTime() { if (el.value) pos.value = el.value.currentTime; }
function onEnd() { playing.value = false; pos.value = dur.value; }
function onErr() { if (mode.value === 'file') { mode.value = hasSpeech ? 'speech' : 'none'; playing.value = false; } }

// speech playback
let utter: SpeechSynthesisUtterance | null = null;
let speechStart = 0;
let tick: ReturnType<typeof setInterval> | undefined;
function speak(fromChar = 0) {
  const synth = window.speechSynthesis;
  synth.cancel();
  const text = plain.value.slice(fromChar);
  utter = new SpeechSynthesisUtterance(text);
  const lang = (p.value?.language || props.course?.language || 'en').toLowerCase();
  const voice = synth.getVoices().find(v => v.lang.toLowerCase().startsWith(lang.slice(0, 2)) && /natural|online|neural/i.test(v.name))
    ?? synth.getVoices().find(v => v.lang.toLowerCase().startsWith(lang.slice(0, 2)));
  if (voice) utter.voice = voice;
  utter.lang = voice?.lang ?? lang;
  utter.rate = 1;
  utter.onboundary = ev => { pos.value = ((fromChar + ev.charIndex) / Math.max(1, plain.value.length)) * dur.value; };
  utter.onend = () => { if (utter && playing.value) { playing.value = false; pos.value = dur.value; clearInterval(tick); } };
  speechStart = performance.now() - (fromChar / Math.max(1, plain.value.length)) * dur.value * 1000;
  clearInterval(tick);
  tick = setInterval(() => { if (playing.value) pos.value = Math.max(pos.value, Math.min(dur.value, (performance.now() - speechStart) / 1000)); }, 250);
  synth.speak(utter);
}

function play() {
  if (mode.value === 'none') return;
  announce();
  playing.value = true;
  if (mode.value === 'file' && el.value) {
    if (pos.value >= dur.value - 0.2) el.value.currentTime = 0;
    el.value.play().catch(() => onErr());
  } else if (mode.value === 'speech') {
    const from = pos.value >= dur.value - 0.2 ? 0 : Math.floor((pos.value / Math.max(1, dur.value)) * plain.value.length);
    if (from === 0) pos.value = 0;
    speak(from);
  }
}
function pause() {
  playing.value = false;
  if (mode.value === 'file') el.value?.pause();
  else if (mode.value === 'speech') { utter = null; window.speechSynthesis.cancel(); clearInterval(tick); }
}
function toggle() { if (playing.value) pause(); else play(); }
function seek(e: MouseEvent) {
  const t = e.currentTarget as HTMLElement;
  const r = t.getBoundingClientRect();
  const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  pos.value = f * dur.value;
  if (mode.value === 'file' && el.value) el.value.currentTime = pos.value;
  else if (mode.value === 'speech' && playing.value) speak(Math.floor(f * plain.value.length));
}
function key(e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.preventDefault();
  const d = e.key === 'ArrowLeft' ? -5 : 5;
  pos.value = Math.min(dur.value, Math.max(0, pos.value + d));
  if (mode.value === 'file' && el.value) el.value.currentTime = pos.value;
}

onMounted(() => {
  window.addEventListener('bm:audio', others);
  document.addEventListener('play', mediaElsewhere, true);
});
onBeforeUnmount(() => {
  window.removeEventListener('bm:audio', others);
  document.removeEventListener('play', mediaElsewhere, true);
  if (playing.value) pause();
  clearInterval(tick);
});
</script>

<template>
  <section ref="root" class="blk card blk-au" :data-block="block.id" data-type="audio">
    <BlockHead type="audio" :title="block.title">
      <template #act><span class="tag">{{ fmt(dur) }}</span></template>
    </BlockHead>
    <div class="au-bar on-dark">
      <button type="button" class="au-pp" :class="{ playing }" :disabled="mode === 'none'" :aria-label="playing ? 'Pause' : 'Play'" :aria-pressed="playing" @click="toggle">
        <Icon :name="playing ? 'i-pause' : 'i-play'" />
      </button>
      <div class="au-mid">
        <div class="au-top"><b>{{ label }}</b><small>{{ fmt(pos) }} / {{ fmt(dur) }}</small></div>
        <div class="au-track" role="slider" tabindex="0" aria-label="Position" :aria-valuemin="0" :aria-valuemax="Math.round(dur)" :aria-valuenow="Math.round(pos)"
          :style="{ '--p': pct + '%' }" @click="seek" @keydown="key"><i /></div>
      </div>
    </div>
    <audio v-if="src && mode === 'file'" ref="el" :src="src" preload="metadata" @loadedmetadata="onMeta" @timeupdate="onTime" @ended="onEnd" @error="onErr" />
    <div class="au-script"><span class="lbl">Read along</span><div class="prose" data-field="script_markdown" v-html="script" /></div>
    <CiteChips :cites="block.cites" :course="course" />
  </section>
</template>
