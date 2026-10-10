<script setup lang="ts">
// Dialogue (WP5c, offline role-play): the scene, who you are, the goal, the partner's opening line (voiced
// when the course has the clip). The learner answers in writing after saying it aloud; each hint phrase
// lights up when a reply covers it. The goal counts as met when every hint is covered or the learner says so.
// For a live partner, the learner can hand the scene to WorkBuddy.
import { computed, onBeforeUnmount, ref } from 'vue';
import { fieldSentences, normaliseAnswer } from '@bilimind/core';
import type { Course, CourseLesson } from '@bilimind/core';
import type { BlockOf } from './types.ts';
import { renderMd } from '../assessments/md.ts';
import { vSentences } from '../assessments/sentences.ts';
import { isPassedStored, markPassed } from '../assessments/store.ts';
import TaskShell from '../assessments/ui/TaskShell.vue';
import Ico from '../assessments/ui/Ico.vue';

const props = defineProps<{ block: BlockOf<'dialogue'>; lesson: CourseLesson; course: Course }>();
const p = computed(() => props.block.payload);
const hints = computed(() => p.value.hints ?? []);
const replies = ref<string[]>([]);
const draft = ref('');
const selfMet = ref(false);
const passed = ref(isPassedStored(props.course.id, props.lesson.id, props.block.id));
const playing = ref(false);
const audioBroken = ref(false);
const copied = ref(false);

const STOP = new Set('a an the is are be to of and or in on at for it its this that with as by your you i we they not but so do does'.split(' '));
const words = (s: string) => normaliseAnswer(s).split(' ').filter(w => w && !STOP.has(w));
function covers(text: string, hint: string): boolean {
  const have = new Set(words(text));
  const want = words(hint);
  if (!want.length) return false;
  return want.filter(w => have.has(w)).length / want.length >= 0.6;
}
const covered = computed(() => hints.value.map(h => replies.value.some(r => covers(r, h))));
const nCovered = computed(() => covered.value.filter(Boolean).length);
const met = computed(() => selfMet.value || (hints.value.length > 0 && nCovered.value === hints.value.length));

function send() {
  const t = draft.value.trim();
  if (!t) return;
  replies.value = [...replies.value, t];
  draft.value = '';
  if (met.value) pass();
}
function pass() { if (!passed.value) { passed.value = true; markPassed(props.course.id, props.lesson.id, props.block.id); } }
function claim() { selfMet.value = true; pass(); }

const audio = typeof Audio !== 'undefined' ? new Audio() : null;
if (audio) {
  audio.preload = 'none';
  audio.onended = () => { playing.value = false; };
  audio.onerror = () => { audioBroken.value = true; playing.value = false; };
}
function playOpening() {
  if (!audio || !p.value.opening_audio) return;
  if (playing.value) { audio.pause(); playing.value = false; return; }
  audio.src = p.value.opening_audio;
  playing.value = true;
  audio.play().catch(() => { audioBroken.value = true; playing.value = false; });
}
onBeforeUnmount(() => audio?.pause());

const livePrompt = computed(() => `Play the ${p.value.ai_role} in this role-play and stay in character. I am the ${p.value.learner_role}. Scene: ${p.value.scenario_markdown} My goal: ${p.value.goal}${p.value.opening_line ? ` Start with: "${p.value.opening_line}"` : ''} Reply in ${p.value.language === 'en' ? 'English' : `the language "${p.value.language}"`}, one short turn at a time, and correct my mistakes gently.`);
async function copyPrompt() {
  try { await navigator.clipboard.writeText(livePrompt.value); copied.value = true; setTimeout(() => { copied.value = false; }, 1800); }
  catch { copied.value = false; }
}
</script>

<template>
  <TaskShell :block="block" :passed="passed || met">
    <template #actions>
      <span v-if="hints.length" class="tag num" :class="nCovered === hints.length ? 'ok' : 'quiet'">{{ nCovered }}/{{ hints.length }} points</span>
    </template>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-sentences="fieldSentences(block, 'scenario_markdown')" class="md sm dl-scene" v-html="renderMd(p.scenario_markdown)" />
    <div class="dl-roles">
      <span class="dl-role"><small>They are</small><b>{{ p.ai_role }}</b></span>
      <span class="dl-role"><small>You are</small><b>{{ p.learner_role }}</b></span>
      <span class="dl-goal"><Ico name="target" /><span><small>Your goal</small>{{ p.goal }}</span></span>
    </div>

    <div class="dl-chat">
      <div v-if="p.opening_line" class="dl-msg them">
        <span class="who">{{ p.ai_role }}</span>
        <p :lang="p.language">{{ p.opening_line }}</p>
        <button v-if="p.opening_audio && !audioBroken" type="button" class="dl-play" :aria-label="playing ? 'Stop' : 'Play the opening line'" @click="playOpening">
          <Ico :name="playing ? 'pause' : 'speaker'" />{{ playing ? 'Playing' : 'Hear it' }}
        </button>
      </div>
      <div v-for="(r, i) in replies" :key="i" class="dl-msg you">
        <span class="who">You</span>
        <p :lang="p.language">{{ r }}</p>
      </div>
    </div>

    <div v-if="!met" class="dl-in">
      <label class="sr-only" :for="`dl-${lesson.id}-${block.id}`">Your reply</label>
      <textarea :id="`dl-${lesson.id}-${block.id}`" v-model="draft" rows="2" :lang="p.language"
        placeholder="Say it out loud first, then type what you said" @keydown.enter.exact.prevent="send" />
      <button type="button" class="btn ink" :disabled="!draft.trim()" @click="send">Reply <Ico name="arrow" /></button>
    </div>
    <div v-if="hints.length" class="dl-hints">
      <span class="eyebrow-s">Phrases to lean on</span>
      <span v-for="(h, i) in hints" :key="i" class="dl-hint" :class="{ on: covered[i] }" :lang="p.language">
        <Ico v-if="covered[i]" name="check" />{{ h }}
      </span>
    </div>
    <div class="dl-foot">
      <p v-if="met" class="wt-all"><Ico name="check" />Goal reached{{ selfMet && nCovered < hints.length ? ' (your call)' : '' }}.</p>
      <button v-else-if="replies.length" type="button" class="btn ghost sm" @click="claim">I reached the goal</button>
      <button type="button" class="btn soft sm dl-live" @click="copyPrompt">
        <Ico :name="copied ? 'check' : 'copy'" />{{ copied ? 'Copied: paste it into WorkBuddy' : 'Practise live with WorkBuddy' }}
      </button>
    </div>
  </TaskShell>
</template>

<style>
.bmx .dl-scene { padding: 14px 16px; border-radius: var(--r-row); background: var(--sunken); box-shadow: var(--hair); }
.bmx .dl-roles { display: grid; grid-template-columns: minmax(0, .7fr) minmax(0, .7fr) minmax(0, 1.6fr); gap: 8px; margin: 12px 0 16px; }
.bmx .dl-role, .bmx .dl-goal { display: grid; gap: 3px; align-content: start; padding: 10px 12px; border-radius: 12px; background: var(--surface); box-shadow: var(--hair-strong); font: 600 14.5px/1.35 var(--body); color: var(--ink); }
.bmx .dl-role small, .bmx .dl-goal small { display: block; font: var(--t-eyebrow); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--text-3); }
.bmx .dl-goal { grid-template-columns: 18px minmax(0, 1fr); gap: 10px; background: var(--lime-wash); box-shadow: inset 0 0 0 1px var(--lime-line); font-weight: 500; }
.bmx .dl-goal > .bm-ico { width: 18px; height: 18px; color: var(--lime-ink); margin-top: 1px; }
.bmx .dl-goal small { color: var(--lime-ink); margin-bottom: 3px; }
.bmx .dl-chat { display: grid; gap: 10px; }
.bmx .dl-msg { display: grid; gap: 4px; max-width: min(520px, 88%); padding: 12px 14px; border-radius: 18px; animation: pop .3s var(--ease-out); }
.bmx .dl-msg p { margin: 0; font: 500 16px/1.45 var(--body); }
.bmx .dl-msg .who { font: var(--t-eyebrow); letter-spacing: var(--track-eyebrow); text-transform: uppercase; }
.bmx .dl-msg.them { justify-self: start; border-bottom-left-radius: 6px; background: var(--fill); color: var(--ink); }
.bmx .dl-msg.them .who { color: var(--text-3); }
.bmx .dl-msg.you { justify-self: end; border-bottom-right-radius: 6px; background: var(--cobalt); color: #fff; }
.bmx .dl-msg.you .who { color: rgb(255 255 255 / 0.7); }
.bmx .dl-play { justify-self: start; display: inline-flex; align-items: center; gap: 6px; height: 30px; margin-top: 4px; padding: 0 12px 0 9px; border-radius: 99px; background: var(--ink); color: #fff; font: 600 12.5px/1 var(--body); }
.bmx .dl-play .bm-ico { width: 13px; height: 13px; }
.bmx .dl-in { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: end; margin-top: 14px; }
.bmx .dl-in textarea { width: 100%; min-height: 52px; padding: 12px 14px; border: 0; border-radius: 16px; background: var(--surface-2); box-shadow: var(--hair-strong); font: 400 16px/1.45 var(--body); color: var(--ink); resize: vertical; }
.bmx .dl-in textarea:focus { outline: none; background: var(--surface); box-shadow: inset 0 0 0 2px var(--cobalt); }
.bmx .dl-hints { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 14px; }
.bmx .dl-hints .eyebrow-s { margin-right: 4px; }
.bmx .dl-hint { display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 4px 12px; border-radius: 99px; background: var(--surface); box-shadow: var(--hair-strong); font: 500 13.5px/1.3 var(--body); color: var(--ink-3); transition: background var(--d-fast), box-shadow var(--d-fast); }
.bmx .dl-hint .bm-ico { width: 12px; height: 12px; }
.bmx .dl-hint.on { background: var(--lime-soft); box-shadow: inset 0 0 0 1px var(--lime-line); color: var(--lime-ink); animation: stamp .35s var(--ease-pop); }
.bmx .dl-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 14px; }
.bmx .dl-foot .wt-all { margin: 0; }
.bmx .dl-live { margin-left: auto; }
@media (max-width: 640px) { .bmx .dl-roles { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } .bmx .dl-goal { grid-column: 1 / -1; } .bmx .dl-live { margin-left: 0; } .bmx .dl-in { grid-template-columns: minmax(0, 1fr); } }
</style>
