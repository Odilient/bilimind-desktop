<script setup lang="ts">
// Flashcards (WP5c, player-design 5.7): a physical deck, 3D flip, Again / Hard / Good / Easy rated with
// core FSRS (bm:<id>:fsrs, cardId '<lesson>/<block>/c<n>', due capped before the exam). Each button shows
// the real next interval. "Again" deals the card once more at the end of this session.
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
import { cardId } from '@bilimind/core';
import type { Course, CourseLesson } from '@bilimind/core';
import type { BlockOf } from './types.ts';
import { renderInline } from '../assessments/md.ts';
import { isPassedStored, markPassed, previewIntervals, rate, RATINGS } from '../assessments/store.ts';
import type { Rating } from '../assessments/store.ts';
import TaskShell from '../assessments/ui/TaskShell.vue';
import CiteChip from '../components/CiteChip.vue';
import Ico from '../assessments/ui/Ico.vue';

const props = defineProps<{ block: BlockOf<'flashcards'>; lesson: CourseLesson; course: Course }>();
const cards = computed(() => props.block.payload.cards ?? []);
const idOf = (i: number) => cardId(props.lesson.id, props.block.id, i);

const queue = ref<number[]>(cards.value.map((_, i) => i));
const pos = ref(0);
const flipped = ref(false);
const fly = ref<'' | 'out-l' | 'out-r'>('');
const dealing = ref(false);
const last = ref<Record<number, Rating>>({});
const requeued = ref<Set<number>>(new Set());
const done = ref(false);
const passed = ref(isPassedStored(props.course.id, props.lesson.id, props.block.id));
const intervals = ref<Record<Rating, string> | null>(null);
const live = ref('');
const cardEl = ref<HTMLElement | null>(null);

const current = computed(() => queue.value[pos.value] ?? 0);
const card = computed(() => cards.value[current.value]);
const remembered = computed(() => Object.values(last.value).filter(r => r !== 'again').length);
const again = computed(() => Object.values(last.value).filter(r => r === 'again').length);
const LABEL: Record<Rating, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' };
const firstCite = computed(() => (props.block.cites ?? []).find(c => c.quote) ?? null);

function flip() {
  if (done.value || fly.value) return;
  flipped.value = !flipped.value;
  if (flipped.value) {
    intervals.value = previewIntervals(props.course, idOf(current.value));
    live.value = `Answer: ${card.value?.back ?? ''}`;
  }
}
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let t: ReturnType<typeof setTimeout> | undefined;
onBeforeUnmount(() => clearTimeout(t));

function rateIt(r: Rating) {
  if (!flipped.value || fly.value) return;
  const i = current.value;
  try { rate(props.course, idOf(i), r); } catch { /* storage only */ }
  last.value = { ...last.value, [i]: r };
  if (r === 'again' && !requeued.value.has(i)) { requeued.value = new Set([...requeued.value, i]); queue.value = [...queue.value, i]; }
  fly.value = r === 'again' ? 'out-l' : 'out-r';
  t = setTimeout(async () => {
    flipped.value = false;
    fly.value = '';
    if (pos.value + 1 >= queue.value.length) {
      done.value = true;
      if (!passed.value) { passed.value = true; markPassed(props.course.id, props.lesson.id, props.block.id); }
      live.value = `Deck done. ${remembered.value} remembered, ${again.value} to see again.`;
      return;
    }
    pos.value += 1;
    dealing.value = true;
    await nextTick();
    cardEl.value?.focus({ preventScroll: true });
    setTimeout(() => { dealing.value = false; }, 380);
  }, reduced() ? 0 : 340);
}
function restart() {
  queue.value = cards.value.map((_, i) => i);
  pos.value = 0; flipped.value = false; done.value = false; last.value = {}; requeued.value = new Set();
}
function onKey(e: KeyboardEvent) {
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); return; }
  if (flipped.value && ['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); rateIt(RATINGS[Number(e.key) - 1]!); }
}
function dotClass(i: number) {
  if (!done.value && i === current.value) return 'now';
  const r = last.value[i];
  return r === 'again' ? 'again' : r ? 'good' : '';
}
</script>

<template>
  <TaskShell :block="block" :passed="passed" frame="plain" :hide-cites="true">
    <template #actions>
      <span class="tag quiet num">{{ cards.length }} cards</span>
    </template>
    <div class="fc" :class="{ flipped }">
      <div v-if="!done" class="fc-deck" @keydown="onKey">
        <div class="fc-fly" :class="fly">
          <div ref="cardEl" class="fc-card" :class="{ flipped, deal: dealing }" role="button" tabindex="0" :aria-pressed="flipped"
            :aria-label="flipped ? `Answer: ${card?.back}` : `Card ${pos + 1}: ${card?.front}. Press Space to flip.`" @click="flip">
            <div class="fc-face fc-front">
              <span class="corner">Card</span><span class="count num">{{ Math.min(pos + 1, queue.length) }} / {{ queue.length }}</span>
              <!-- eslint-disable-next-line vue/no-v-html -->
              <p v-html="renderInline(card?.front)" />
              <span class="hint">Tap or press Space</span>
            </div>
            <div class="fc-face fc-back">
              <span class="corner">Answer</span><span class="count num">{{ Math.min(pos + 1, queue.length) }} / {{ queue.length }}</span>
              <div class="bk">
                <!-- eslint-disable-next-line vue/no-v-html -->
                <p v-html="renderInline(card?.back)" />
                <CiteChip v-if="firstCite && flipped" :cite="firstCite" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="fc-end">
        <span class="fe-ic"><Ico name="check" /></span>
        <p class="fe-h">Deck done · {{ remembered }} remembered, {{ again }} to see again</p>
        <p class="fe-s">They come back before your exam, spaced out so you remember them on the day. Also in your Anki deck.</p>
        <button type="button" class="btn ghost sm" @click="restart"><Ico name="refresh" />Go through again</button>
      </div>

      <div v-if="!done" class="rate" role="group" aria-label="How well did you know it?">
        <button v-for="(r, i) in RATINGS" :key="r" type="button" :class="r" :tabindex="flipped ? 0 : -1" :data-rate="r" @click="rateIt(r)">
          {{ LABEL[r] }}<small>{{ intervals?.[r] || `key ${i + 1}` }}</small>
        </button>
      </div>
      <div class="fc-dots" aria-hidden="true">
        <i v-for="(_, i) in cards" :key="i" :class="dotClass(i)" />
      </div>
    </div>
    <span class="sr-only" aria-live="polite">{{ live }}</span>
  </TaskShell>
</template>

<style>
.bmx .fc { display: grid; justify-items: center; gap: 18px; padding: 6px 0 4px; }
.bmx .fc-deck { position: relative; width: min(100%, 560px); aspect-ratio: 16 / 10; perspective: 1400px; }
.bmx .fc-deck::before, .bmx .fc-deck::after { content: ""; position: absolute; inset: 0; border-radius: 24px; background: var(--surface); box-shadow: var(--hair-strong); }
.bmx .fc-deck::before { transform: translateY(16px) rotate(-2.5deg) scale(.96); opacity: .65; }
.bmx .fc-deck::after { transform: translateY(8px) rotate(1.8deg) scale(.98); opacity: .9; }
.bmx .fc-fly { position: absolute; inset: 0; z-index: 1; transition: transform 360ms var(--ease-out), opacity 360ms var(--ease-out); }
.bmx .fc-fly.out-l { transform: translateX(-120%) rotate(-12deg); opacity: 0; }
.bmx .fc-fly.out-r { transform: translateX(120%) rotate(10deg); opacity: 0; }
.bmx .fc-card { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform var(--d-flip) var(--ease-io); cursor: pointer; }
.bmx .fc-card.flipped { transform: rotateY(180deg); }
.bmx .fc-card:focus-visible { outline: none; }
.bmx .fc-card:focus-visible .fc-face { box-shadow: var(--hair-strong), 0 0 0 4px var(--ink); }
.bmx .fc-card.deal { animation: deal 360ms var(--ease-pop) both; }
@keyframes deal { from { transform: translateY(16px) scale(.95); opacity: .5; } }
.bmx .fc-face { position: absolute; inset: 0; display: grid; place-items: center; padding: 40px 44px; border-radius: 24px; text-align: center; -webkit-backface-visibility: hidden; backface-visibility: hidden; }
.bmx .fc-front { background: var(--surface); box-shadow: var(--hair-strong), var(--sh-lift); }
.bmx .fc-front p { margin: 0; font: 600 clamp(22px, 3vw, 32px)/1.15 var(--display); letter-spacing: -0.025em; color: var(--text); text-wrap: balance; }
.bmx .fc-back { transform: rotateY(180deg); background: var(--cobalt-grad); color: #fff; box-shadow: var(--sh-slab); }
.bmx .fc-back .bk { display: grid; justify-items: center; gap: 12px; }
.bmx .fc-back p { margin: 0; max-width: 36ch; font: 500 19px/1.45 var(--body); }
.bmx .fc-back code { background: rgb(255 255 255 / 0.16); color: #fff; }
.bmx .fc-face .corner, .bmx .fc-face .count { position: absolute; top: 16px; font: var(--t-eyebrow); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--text-3); }
.bmx .fc-face .corner { left: 18px; } .bmx .fc-face .count { right: 18px; }
.bmx .fc-back .corner { color: var(--lime); } .bmx .fc-back .count { color: rgb(255 255 255 / 0.6); }
.bmx .fc-face .hint { position: absolute; left: 0; right: 0; bottom: 16px; font: var(--t-cap); color: var(--text-3); }
.bmx .rate { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; width: min(100%, 560px); opacity: 0; translate: 0 8px; pointer-events: none; transition: opacity var(--d-base), translate var(--d-base) var(--ease-out); }
.bmx .fc.flipped .rate { opacity: 1; translate: 0 0; pointer-events: auto; }
.bmx .rate button { display: grid; gap: 5px; justify-items: center; align-content: center; height: 60px; border-radius: 16px; font: 600 14.5px/1 var(--body); transition: transform var(--d-press), filter var(--d-fast); }
.bmx .rate button:hover { filter: brightness(.97); }
.bmx .rate button:active { transform: scale(.96); }
.bmx .rate small { font: 500 11.5px/1 var(--body); opacity: .8; }
.bmx .rate .again { background: var(--coral-soft); color: var(--coral-ink); }
.bmx .rate .hard { background: var(--fill); color: var(--ink-3); }
.bmx .rate .good { background: var(--cobalt-soft); color: var(--cobalt); }
.bmx .rate .easy { background: var(--lime); color: var(--ink); }
.bmx .fc-dots { display: flex; flex-wrap: wrap; justify-content: center; gap: 5px; }
.bmx .fc-dots i { width: 8px; height: 8px; border-radius: 50%; background: var(--dot-idle); }
.bmx .fc-dots i.good { background: var(--lime-2); } .bmx .fc-dots i.again { background: var(--coral); } .bmx .fc-dots i.now { background: var(--surface); box-shadow: inset 0 0 0 2px var(--ink); }
.bmx .fc-end { display: grid; justify-items: center; gap: 8px; width: min(100%, 560px); padding: 34px 24px; border-radius: 24px; background: var(--surface); box-shadow: var(--hair-strong), var(--sh-card); text-align: center; animation: pop .4s var(--ease-pop-2); }
.bmx .fe-ic { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: var(--lime); color: var(--ink); }
.bmx .fe-ic .bm-ico { width: 20px; height: 20px; }
.bmx .fe-h { margin: 6px 0 0; font: 600 21px/1.25 var(--display); letter-spacing: -0.02em; color: var(--text); }
.bmx .fe-s { margin: 0 0 8px; max-width: 42ch; font: 400 14.5px/1.5 var(--body); color: var(--text-2); }
@media (max-width: 420px) { .bmx .fc-deck { aspect-ratio: 4 / 3; } .bmx .rate button { height: 56px; } .bmx .fc-face { padding: 34px 22px; } }
@media (prefers-reduced-motion: reduce) { .bmx .fc-card, .bmx .fc-fly { transition: none; } }
</style>
