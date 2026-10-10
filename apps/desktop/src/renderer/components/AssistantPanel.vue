<script setup lang="ts">
// The docked assistant (right side of the course workspace), modelled on the web Assistant + AssistantBody:
// a scope switch, openers from the open lesson, a streamed thread with [n] citation chips, the cost of each
// answer, and a composer (Enter sends, Shift+Enter is a new line). A new lesson starts a new thread.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Icon from './Icon.vue';
import { state } from '../store';
import type { AssistantCite, AssistantEvent, AssistantScope } from '../env';
import { deriveOpeners, fmtAskCost, renderAnswer, type PlayerLesson } from '../workspace';

const props = defineProps<{
  courseId: string;
  lessonId: string | null;
  lessonTitle: string;
  lesson: PlayerLesson | null;
  sources: { name: string; rel: string }[];
}>();
const emit = defineEmits<{ close: [] }>();

interface Msg {
  id: number; role: 'user' | 'assistant'; text: string;
  cites?: AssistantCite[]; costUsd?: number; model?: string;
  streaming?: boolean; stopped?: boolean; error?: string;
}

const SCOPES: { v: AssistantScope; label: string; says: string }[] = [
  { v: 'lesson', label: 'This lesson', says: 'this lesson' },
  { v: 'course', label: 'Whole course', says: 'the whole course' },
  { v: 'files', label: 'Your files', says: 'your files' },
];
const scope = ref<AssistantScope>(props.lessonId ? 'lesson' : 'course');
const messages = ref<Msg[]>([]);
const draft = ref('');
const thread = ref<HTMLElement | null>(null);
const box = ref<HTMLTextAreaElement | null>(null);
let seq = 0;

/** The ask in flight: its id once ask() resolves; events that arrive before that wait in `early`. */
let live: { askId: string | null; msg: Msg; early: AssistantEvent[]; stop: boolean } | null = null;
const busy = ref(false);

const openers = computed(() => deriveOpeners(props.lessonId ? props.lesson : null, props.lessonId ? props.lessonTitle : ''));
const says = computed(() => SCOPES.find((s) => s.v === scope.value)!.says);

function scrollToEnd() {
  void nextTick(() => { if (thread.value) thread.value.scrollTop = thread.value.scrollHeight; });
}

/** Errors in plain English: main already words most of them; this only fills the gaps. */
function plain(message: string): string {
  const m = (message || '').trim();
  if (!m) return 'That question did not go through. Try again.';
  if (/not built yet/i.test(m)) return 'The assistant is not ready in this build yet. Everything else on this page works.';
  if (/ECONN|ENOTFOUND|ETIMEDOUT|fetch failed|network/i.test(m)) return 'Could not reach the AI service. Check your internet connection and try again.';
  if (/\b401\b|unauthori[sz]ed|invalid api key|authentication/i.test(m)) return 'The AI service did not accept your key. Check it in Settings.';
  if (/\b402\b|insufficient|balance/i.test(m)) return 'Your AI account is out of credit. Top it up, then ask again.';
  if (/\b429\b|rate limit/i.test(m)) return 'The AI service is busy right now. Wait a few seconds and ask again.';
  return m;
}
const needsKey = (e?: string) => !!e && /\bkey\b|settings/i.test(e);

function apply(e: AssistantEvent) {
  const l = live;
  if (!l) return;
  if (l.askId === null) { l.early.push(e); return; }
  if (e.askId !== l.askId) return;
  const m = l.msg;
  if (e.type === 'delta') { m.text += e.text; scrollToEnd(); return; }
  if (e.type === 'done') { m.text = e.text || m.text; m.cites = e.cites; m.costUsd = e.costUsd; m.model = e.model; }
  else m.error = plain(e.message);
  m.streaming = false;
  live = null; busy.value = false;
  scrollToEnd();
}

async function send(text?: string) {
  const question = (text ?? draft.value).trim();
  if (!question || busy.value) return;
  const history = messages.value
    .filter((m) => m.text && !m.error && !m.streaming)
    .slice(-8)
    .map((m) => ({ role: m.role, text: m.text }));
  messages.value.push({ id: ++seq, role: 'user', text: question });
  messages.value.push({ id: ++seq, role: 'assistant', text: '', streaming: true });
  const msg = messages.value[messages.value.length - 1];
  draft.value = '';
  fit();
  busy.value = true;
  const mine = { askId: null as string | null, msg, early: [] as AssistantEvent[], stop: false };
  live = mine;
  scrollToEnd();
  try {
    const { askId } = await window.bilimind.assistant.ask({
      courseId: props.courseId, lessonId: props.lessonId, scope: scope.value, question, history,
    });
    if (live !== mine) { if (mine.stop) void window.bilimind.assistant.cancel(askId); return; }
    mine.askId = askId;
    mine.early.splice(0).forEach(apply);
  } catch (err) {
    if (live !== mine) return;
    msg.streaming = false;
    msg.error = plain((err as Error).message);
    live = null; busy.value = false;
    scrollToEnd();
  }
}

function stop() {
  const l = live;
  if (!l) return;
  l.stop = true;
  if (l.askId) void window.bilimind.assistant.cancel(l.askId);
  l.msg.streaming = false;
  l.msg.stopped = true;
  live = null; busy.value = false;
}

function reset() {
  stop();
  messages.value = [];
  pop.value = null;
}

/* A new lesson means new grounding: carrying the old thread over would answer from the wrong place. */
watch(() => props.lessonId, (id, old) => {
  if (id === old) return;
  reset();
  if (id && scope.value === 'course') scope.value = 'lesson';
  if (!id && scope.value === 'lesson') scope.value = 'course';
});

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); void send(); }
}
function fit() {
  void nextTick(() => {
    const t = box.value;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, 132) + 'px';
  });
}

// ---------- citation popover ----------
const pop = ref<{ cite: AssistantCite; top: number; left: number; pinned: boolean } | null>(null);
const panel = ref<HTMLElement | null>(null);
let hideTimer = 0;
function citeAt(el: HTMLElement): AssistantCite | undefined {
  const id = Number(el.closest<HTMLElement>('[data-msg]')?.dataset.msg);
  const n = Number(el.dataset.n);
  return messages.value.find((m) => m.id === id)?.cites?.find((c) => c.n === n);
}
function showCite(el: HTMLElement, pinned: boolean) {
  const cite = citeAt(el);
  const host = panel.value;
  if (!cite || !host) return;
  clearTimeout(hideTimer);
  const r = el.getBoundingClientRect();
  const h = host.getBoundingClientRect();
  const left = Math.max(12, Math.min(r.left - h.left - 20, h.width - 12 - 276));
  const below = r.bottom - h.top + 8;
  const top = below + 180 > h.height ? Math.max(12, r.top - h.top - 8 - 170) : below;
  pop.value = { cite, top, left, pinned };
}
function onThreadClick(e: MouseEvent) {
  const el = (e.target as HTMLElement).closest<HTMLElement>('.cite');
  if (el) { e.stopPropagation(); showCite(el, true); return; }
  if (pop.value?.pinned) pop.value = null;
}
function onThreadOver(e: MouseEvent) {
  const el = (e.target as HTMLElement).closest<HTMLElement>('.cite');
  if (el && !pop.value?.pinned) showCite(el, false);
}
function onThreadOut(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest('.cite') || pop.value?.pinned) return;
  hideTimer = window.setTimeout(() => { if (pop.value && !pop.value.pinned) pop.value = null; }, 220);
}
function keepPop() { clearTimeout(hideTimer); }
function leavePop() { if (pop.value && !pop.value.pinned) pop.value = null; }
const popSource = computed(() => {
  const f = pop.value?.cite.file;
  if (!f) return null;
  const base = f.split(/[\\/]/).pop()!.toLowerCase();
  return props.sources.find((s) => s.rel === f || s.name.toLowerCase() === base) ?? null;
});
function openCiteFile() {
  const s = popSource.value;
  if (s) void window.bilimind.courses.openFile(props.courseId, s.rel).catch(() => {});
}

let unsub: (() => void) | null = null;
function onDoc(e: MouseEvent) {
  if (pop.value?.pinned && !(e.target as HTMLElement).closest('.citepop, .cite')) pop.value = null;
}
onMounted(() => {
  unsub = window.bilimind.assistant.onEvent(apply);
  document.addEventListener('click', onDoc);
});
onBeforeUnmount(() => { stop(); unsub?.(); document.removeEventListener('click', onDoc); clearTimeout(hideTimer); });
</script>

<template>
  <aside ref="panel" class="asst" aria-label="Assistant">
    <header class="ah">
      <span class="spark"><Icon name="i-spark" /></span>
      <b>Assistant</b>
      <span class="grow"></span>
      <button v-if="messages.length" class="iconbtn sm" title="New thread" aria-label="New thread" @click="reset"><Icon name="i-plus" /></button>
      <button class="iconbtn sm" title="Hide the assistant" aria-label="Hide the assistant" @click="emit('close')"><Icon name="i-panel-r" /></button>
    </header>

    <div class="scope">
      <div class="seg" role="radiogroup" aria-label="What the assistant answers from">
        <button v-for="s in SCOPES" :key="s.v" role="radio" :aria-checked="scope === s.v" :class="{ on: scope === s.v }"
                :disabled="s.v === 'lesson' && !lessonId" @click="scope = s.v">{{ s.label }}</button>
      </div>
    </div>

    <div ref="thread" class="thread" @click="onThreadClick" @mouseover="onThreadOver" @mouseout="onThreadOut">
      <template v-if="!messages.length">
        <p class="intro">Answers come from <b>{{ says }}</b>, with the place in your files for each claim. Tap a starting point:</p>
        <div class="openers">
          <button v-for="q in openers" :key="q" class="opener" @click="send(q)">{{ q }}</button>
        </div>
      </template>

      <template v-for="m in messages" :key="m.id">
        <div v-if="m.role === 'user'" class="bubble me">{{ m.text }}</div>
        <div v-else class="turn" :data-msg="m.id">
          <div v-if="m.error" class="bubble bad">
            {{ m.error }}
            <button v-if="needsKey(m.error)" class="pill sm light fix" @click="state.settingsOpen = true"><Icon name="i-key" /> Open Settings</button>
          </div>
          <div v-else-if="m.streaming && !m.text" class="bubble ai dots" aria-label="Thinking"><i></i><i></i><i></i></div>
          <div v-else class="bubble ai" :class="{ live: m.streaming }" v-html="renderAnswer(m.text, m.cites)"></div>
          <p v-if="m.stopped" class="under">Stopped.</p>
          <p v-else-if="m.model" class="under">{{ fmtAskCost(m.costUsd ?? 0) }} · {{ m.model }}<template v-if="m.cites?.length"> · {{ m.cites.length }} {{ m.cites.length === 1 ? 'source' : 'sources' }}</template></p>
        </div>
      </template>
    </div>

    <div class="composer">
      <div class="field-wrap">
        <textarea ref="box" v-model="draft" rows="1" :placeholder="lessonId && scope === 'lesson' ? 'Ask about this lesson…' : 'Ask about the course…'"
                  aria-label="Your question" @keydown="onKey" @input="fit"></textarea>
        <button v-if="busy" class="send stop" title="Stop" aria-label="Stop" @click="stop"><i></i></button>
        <button v-else class="send" title="Send (Enter)" aria-label="Send" :disabled="!draft.trim()" @click="send()"><Icon name="i-arrow-up" /></button>
      </div>
      <p class="hint">Enter to send · Shift+Enter for a new line</p>
    </div>

    <div v-if="pop" class="citepop" :style="{ top: pop.top + 'px', left: pop.left + 'px' }" @mouseenter="keepPop" @mouseleave="leavePop">
      <div class="cp-h"><span class="n">{{ pop.cite.n }}</span><b :title="pop.cite.file">{{ pop.cite.file.split(/[\\/]/).pop() }}</b></div>
      <p v-if="pop.cite.locator" class="cp-loc">{{ pop.cite.locator }}</p>
      <blockquote>{{ pop.cite.quote }}</blockquote>
      <button v-if="popSource" class="cp-open" @click="openCiteFile"><Icon name="i-ext" /> Open the file</button>
    </div>
  </aside>
</template>

<style scoped>
.asst { position: relative; width: 320px; flex: none; display: flex; flex-direction: column; min-height: 0; background: #fff; border-left: 1px solid var(--line); }
.ah { height: 52px; flex: none; display: flex; align-items: center; gap: 9px; padding: 0 10px 0 16px; border-bottom: 1px solid var(--line); }
.ah b { font: 600 14px/1 var(--body); }
.spark { width: 26px; height: 26px; border-radius: 50%; background: var(--cobalt-soft); color: var(--cobalt); display: grid; place-items: center; }
.spark .ico { width: 14px; height: 14px; }
.grow { flex: 1; }
.iconbtn.sm { width: 30px; height: 30px; }
.iconbtn.sm .ico { width: 15px; height: 15px; }

.scope { padding: 12px 14px 8px; flex: none; }
.scope .seg { display: flex; width: 100%; }
.scope .seg button { flex: 1; height: 30px; padding: 0 6px; font-size: 12px; }
.scope .seg button:disabled { opacity: .4; cursor: not-allowed; }

.thread { flex: 1; min-height: 0; overflow-y: auto; padding: 6px 14px 14px; display: flex; flex-direction: column; gap: 10px; user-select: text; }
.intro { margin: 2px 0 4px; font-size: 13px; line-height: 1.5; color: var(--text-2); }
.intro b { color: var(--ink-2); font-weight: 600; }
.openers { display: flex; flex-direction: column; gap: 7px; }
.opener { text-align: left; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line-2); background: #fff; font-size: 13px; line-height: 1.4; color: var(--ink-3); transition: border-color .15s, background .15s; }
.opener:hover { border-color: rgb(35 64 230 / 0.35); background: var(--cobalt-soft); }

.bubble { max-width: 92%; padding: 9px 12px; font-size: 13.5px; line-height: 1.55; border-radius: 14px; overflow-wrap: anywhere; }
.bubble.me { align-self: flex-end; background: var(--ink); color: #fff; border-bottom-right-radius: 4px; white-space: pre-wrap; }
.turn { align-self: flex-start; max-width: 100%; display: flex; flex-direction: column; gap: 4px; }
.turn .bubble { max-width: 100%; }
.bubble.ai { background: var(--canvas); border: 1px solid var(--line); border-bottom-left-radius: 4px; color: var(--ink-3); }
.bubble.bad { background: var(--coral-soft); color: #9A2B16; border-bottom-left-radius: 4px; font-weight: 500; }
.bubble.bad .fix { margin-top: 8px; display: flex; height: 30px; }
.bubble.live :deep(p:last-child)::after, .bubble.live :deep(li:last-child)::after { content: ""; display: inline-block; width: 7px; height: 14px; margin-left: 2px; vertical-align: -2px; background: var(--cobalt); border-radius: 2px; animation: blink 1s steps(2) infinite; }
.dots { display: flex; gap: 4px; padding: 12px 14px; }
.dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--text-3); animation: blink 1.2s infinite; }
.dots i:nth-child(2) { animation-delay: .2s; }
.dots i:nth-child(3) { animation-delay: .4s; }
@keyframes blink { 0%, 100% { opacity: .25; } 50% { opacity: 1; } }
.under { margin: 0 0 0 4px; font-size: 11.5px; color: var(--text-3); font-variant-numeric: tabular-nums; }

.bubble.ai :deep(p) { margin: 0 0 8px; }
.bubble.ai :deep(p:last-child) { margin-bottom: 0; }
.bubble.ai :deep(p.h) { font-weight: 700; color: var(--ink); }
.bubble.ai :deep(ul), .bubble.ai :deep(ol) { margin: 0 0 8px; padding-left: 18px; }
.bubble.ai :deep(li) { margin: 2px 0; }
.bubble.ai :deep(code) { font: 500 12.5px/1.4 ui-monospace, "Cascadia Code", Consolas, monospace; background: rgb(11 13 16 / 0.06); padding: 1px 4px; border-radius: 5px; }
.bubble.ai :deep(pre) { margin: 0 0 8px; padding: 9px 10px; background: var(--ink); color: #E8EAF0; border-radius: 10px; overflow-x: auto; }
.bubble.ai :deep(pre code) { background: none; padding: 0; color: inherit; }
.bubble.ai :deep(.cite) { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 4px; margin: 0 1px; border-radius: 6px; vertical-align: 1px;
  background: var(--cobalt-soft); color: var(--cobalt); font: 700 10.5px/1 var(--body); cursor: pointer; transition: background .15s, color .15s; }
.bubble.ai :deep(.cite:hover) { background: var(--cobalt); color: #fff; }

.composer { flex: none; padding: 10px 14px 12px; border-top: 1px solid var(--line); }
.field-wrap { display: flex; align-items: flex-end; gap: 8px; padding: 6px 6px 6px 12px; border-radius: 16px; border: 1px solid var(--line-2); background: #fff; transition: border-color .15s, box-shadow .15s; }
.field-wrap:focus-within { border-color: var(--cobalt); box-shadow: 0 0 0 4px rgb(35 64 230 / 0.10); }
textarea { flex: 1; min-height: 24px; max-height: 132px; resize: none; border: 0; outline: none; background: none; padding: 5px 0; font-size: 13.5px; line-height: 1.45; }
.send { width: 32px; height: 32px; flex: none; border-radius: 10px; background: var(--ink); color: #fff; display: grid; place-items: center; }
.send .ico { width: 15px; height: 15px; }
.send:disabled { opacity: .3; cursor: not-allowed; }
.send.stop { background: var(--coral); }
.send.stop i { width: 10px; height: 10px; border-radius: 2px; background: #fff; }
.hint { margin: 6px 2px 0; font-size: 11px; color: var(--text-3); }

.citepop { position: absolute; z-index: 5; width: 276px; padding: 12px 13px; border-radius: 14px; background: #fff; box-shadow: 0 0 0 1px var(--line-2), var(--shadow-lift); user-select: text; animation: fade .12s; }
.cp-h { display: flex; align-items: center; gap: 8px; min-width: 0; }
.cp-h .n { width: 18px; height: 18px; flex: none; border-radius: 6px; background: var(--cobalt); color: #fff; display: grid; place-items: center; font: 700 10.5px/1 var(--body); }
.cp-h b { font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cp-loc { margin: 4px 0 0 26px; font-size: 11.5px; color: var(--text-2); }
blockquote { margin: 9px 0 0; padding: 0 0 0 10px; border-left: 2px solid var(--lime-2); font-size: 12.5px; line-height: 1.5; color: var(--ink-3);
  display: -webkit-box; -webkit-line-clamp: 7; -webkit-box-orient: vertical; overflow: hidden; }
.cp-open { margin-top: 10px; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--cobalt); }
.cp-open .ico { width: 12px; height: 12px; }
</style>
