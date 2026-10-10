<script setup lang="ts">
// Narration dock (player-design §4.5): lime play, part name, waveform from peaks (click/drag to seek),
// time, speed, follow toggle; collapses to a circle when idle and scrolled; "Back to the voice" chip.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { CourseLesson } from '@bilimind/core';
import { waveBars } from '../runtime/cues.ts';
import { backToVoice, cycleRate, seek, seekFraction, toggle, voice } from '../runtime/narration.ts';
import { fmtClock } from '../runtime/time.ts';
import { partName } from '../runtime/model.ts';

const props = defineProps<{ lesson: CourseLesson }>();
const wave = ref<HTMLElement | null>(null);
const n = ref(64);
const mine = computed(() => voice.key === props.lesson.id);
const t = computed(() => (mine.value ? voice.t : 0));
const dur = computed(() => (mine.value && voice.duration) || props.lesson.narration?.duration_ms || 0);
const frac = computed(() => (dur.value ? Math.min(1, t.value / dur.value) : 0));
const bars = computed(() => waveBars(props.lesson.narration?.peaks?.values, n.value));
const playedN = computed(() => Math.floor(frac.value * n.value));
const part = computed(() => {
  const id = mine.value ? voice.cue.split('.')[0] : '';
  if (id === 'title' || !id) return props.lesson.title;
  const b = props.lesson.blocks.find(x => x.id === id);
  return b ? partName(b) : props.lesson.title;
});
const playing = computed(() => mine.value && voice.playing);
const scrolledDown = ref(false);
const mini = computed(() => !playing.value && !(mine.value && voice.started) && scrolledDown.value);

let ro: ResizeObserver | null = null;
function onScroll() { scrolledDown.value = window.scrollY > 700; }
onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true });
  if (wave.value) {
    ro = new ResizeObserver(() => { if (wave.value) n.value = Math.max(12, Math.floor(wave.value.clientWidth / 5)); });
    ro.observe(wave.value);
  }
});
onBeforeUnmount(() => { window.removeEventListener('scroll', onScroll); ro?.disconnect(); });

let dragging = false;
function fracAt(e: PointerEvent) { const r = wave.value!.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); }
function down(e: PointerEvent) { if (!mine.value) return; dragging = true; wave.value?.setPointerCapture(e.pointerId); seekFraction(fracAt(e)); }
function move(e: PointerEvent) { if (dragging) seekFraction(fracAt(e)); }
function up() { dragging = false; }
function key(e: KeyboardEvent) {
  if (e.key === 'ArrowRight') { seek(t.value + 5000); e.preventDefault(); }
  if (e.key === 'ArrowLeft') { seek(t.value - 5000); e.preventDefault(); }
}
const valueText = computed(() => `${fmtClock(t.value)} of ${fmtClock(dur.value)}`);
const rateLabel = computed(() => `${voice.rate}×`);
</script>

<template>
  <template v-if="lesson.narration">
    <button v-if="playing && voice.away" type="button" class="dock-back" @click="backToVoice"><i><svg aria-hidden="true"><use href="#i-down" /></svg></i>Back to the voice</button>
    <div class="dock" :class="{ mini }" role="region" aria-label="Narration">
      <button type="button" class="pp" :aria-pressed="playing" :aria-label="playing ? 'Pause' : 'Listen'" data-play @click="toggle()">
        <svg aria-hidden="true"><use :href="playing ? '#i-pause' : '#i-play'" /></svg>
      </button>
      <span class="who"><b>{{ playing ? 'Listening' : 'Listen' }}</b><small>{{ part }}</small></span>
      <span v-if="mine && voice.error" class="err">The audio file is missing from this folder. Everything else works.</span>
      <span v-else ref="wave" class="wave" role="slider" tabindex="0" aria-label="Seek" :aria-valuemin="0" :aria-valuemax="Math.round(dur / 1000)" :aria-valuenow="Math.round(t / 1000)" :aria-valuetext="valueText"
            @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @keydown="key">
        <i v-for="(h, i) in bars" :key="i" :class="{ p: i < playedN, now: i === playedN && playing }" :style="{ '--h': h.toFixed(2) }"></i>
      </span>
      <span class="tm">{{ fmtClock(t) }}<span class="total"> / {{ fmtClock(dur) }}</span></span>
      <button type="button" class="sp" :aria-label="`Speed ${voice.rate} times`" @click="cycleRate(1)">{{ rateLabel }}</button>
      <button type="button" class="fw" :aria-pressed="voice.follow" aria-label="Follow the voice" title="Follow the voice" @click="voice.follow = !voice.follow"><svg class="ico" aria-hidden="true"><use href="#i-down" /></svg></button>
    </div>
  </template>
</template>
