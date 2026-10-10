<script setup lang="ts">
// Screen 4: the course workspace. Left, the course and its lessons; centre, the lesson in the course's own
// player (index.html?app=1: no website chrome) or the study plan / your files; right, the docked assistant.
// In Electron the player is a <webview> (audio plays and seeks); in the browser mock it is a same-origin iframe.
// The sidebar moves the player by setting its hash route (no reload); the player's in-page navigation moves
// the sidebar and the assistant back. Progress and the open lesson's parts come from the player's __bmApp.
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import Icon from '../components/Icon.vue';
import CourseSidebar from '../components/CourseSidebar.vue';
import AssistantPanel from '../components/AssistantPanel.vue';
import { state, go } from '../store';
import type { CourseOutline, OutlineLesson } from '../env';
import { fmtBytes, lessonIdOf, type PlayerLesson, type PlayerOutline, type WorkView } from '../workspace';

interface WebviewEl extends HTMLElement {
  executeJavaScript(code: string): Promise<unknown>;
  getURL(): string;
}

const isMock = !!window.__bilimindMock;
const course = computed(() => state.course!);
const outline = ref<CourseOutline | null>(null);
const fromPlayer = ref<PlayerOutline | null>(null);
const src = ref('');
const err = ref('');
const view = ref<WorkView>('lesson');
const current = ref('');
const done = ref<string[]>([]);
const playerLesson = ref<PlayerLesson | null>(null);
const note = ref('');
const frame = ref<HTMLElement | null>(null);
const assistantOpen = ref(readPref('assistant') !== '0');
let wantFirst = false;
let poll = 0;
let detach: (() => void) | null = null;

const lessons = computed<OutlineLesson[]>(() => outline.value?.lessons ?? fromPlayer.value?.lessons ?? []);
const sources = computed(() => outline.value?.sources ?? fromPlayer.value?.sources.map((s) => ({ ...s, bytes: 0 })) ?? []);
const title = computed(() => outline.value?.title || fromPlayer.value?.title || course.value.title);
const sentence = computed(() => outline.value?.sentence || course.value.sentence);
const currentLesson = computed(() => lessons.value.find((l) => l.id === current.value) ?? null);
// the lesson stays the assistant's grounding while the plan or files panel covers it (the web keeps the tab open too)
const askLesson = computed(() => current.value || null);
const askTitle = computed(() => currentLesson.value?.title ?? playerLesson.value?.title ?? '');
const days = computed(() => {
  const out: { label: string; items: OutlineLesson[]; minutes: number }[] = [];
  for (const l of lessons.value) {
    const label = l.day ? `Day ${l.day}` : 'Any day';
    let g = out.find((x) => x.label === label);
    if (!g) { g = { label, items: [], minutes: 0 }; out.push(g); }
    g.items.push(l); g.minutes += l.minutes ?? 0;
  }
  return out;
});

function readPref(k: string): string | null { try { return localStorage.getItem(`bm-desktop:${k}`); } catch { return null; } }
function writePref(k: string, v: string) { try { localStorage.setItem(`bm-desktop:${k}`, v); } catch { /* storage blocked */ } }

// ---------- the player frame ----------
async function exec<T>(code: string): Promise<T | null> {
  const el = frame.value;
  if (!el) return null;
  try {
    if (isMock) {
      const w = (el as HTMLIFrameElement).contentWindow as (Window & { eval(c: string): unknown }) | null;
      return w ? (w.eval(code) as T) : null;
    }
    return (await (el as WebviewEl).executeJavaScript(code)) as T;
  } catch { return null; }
}
function navigate(route: string) {
  const hash = route.startsWith('#') ? route : `#${route}`;
  void exec(`location.hash = ${JSON.stringify(hash)}`);
}
function onRoute(url: string) {
  const id = lessonIdOf(url);
  current.value = id;
  if (id) { if (view.value === 'path') view.value = 'lesson'; }
  else if (view.value === 'lesson') view.value = 'path';
  const hash = url.includes('#') ? url.slice(url.indexOf('#')) : '#/';
  writePref(`last:${course.value.id}`, hash.replace(/[?&]from=[^&]*/, ''));
  void sync();
}
/** Read what the player knows: done lessons, the open lesson's parts, and the outline if main gave none. */
async function sync() {
  const r = await exec<{ done: string[]; lesson: PlayerLesson | null; outline: PlayerOutline | null } | null>(
    `window.__bmApp ? { done: __bmApp.done(), lesson: __bmApp.lesson(), outline: ${outline.value ? 'null' : '__bmApp.outline()'} } : null`);
  if (!r) return;
  done.value = r.done ?? [];
  playerLesson.value = r.lesson;
  if (r.outline && !outline.value) fromPlayer.value = r.outline;
  if (wantFirst && lessons.value.length) { wantFirst = false; if (!current.value) openLesson(lessons.value[0]); }
}
function bind(el: HTMLElement) {
  detach?.();
  if (isMock) {
    const f = el as HTMLIFrameElement;
    const onHash = () => onRoute(f.contentWindow?.location.href ?? '');
    const onLoad = () => { f.contentWindow?.addEventListener('hashchange', onHash); setTimeout(onHash, 60); };
    f.addEventListener('load', onLoad);
    detach = () => { f.removeEventListener('load', onLoad); f.contentWindow?.removeEventListener('hashchange', onHash); };
    return;
  }
  const w = el as WebviewEl;
  const onNav = (e: Event) => { const x = e as Event & { url: string; isMainFrame: boolean }; if (x.isMainFrame !== false) onRoute(x.url); };
  const onReady = () => onRoute(w.getURL());
  w.addEventListener('did-navigate-in-page', onNav);
  w.addEventListener('dom-ready', onReady);
  detach = () => { w.removeEventListener('did-navigate-in-page', onNav); w.removeEventListener('dom-ready', onReady); };
}

// ---------- actions ----------
function openLesson(l: OutlineLesson) {
  view.value = 'lesson';
  if (current.value !== l.id) navigate(l.route);
}
function setView(v: WorkView) {
  note.value = '';
  if (v === 'path') { view.value = 'path'; if (current.value) navigate('#/'); return; }
  view.value = v === 'lesson' ? (current.value ? 'lesson' : 'path') : v;
}
function toggleAssistant(open: boolean) { assistantOpen.value = open; writePref('assistant', open ? '1' : '0'); }
async function openFile(rel: string) {
  note.value = '';
  try { await window.bilimind.courses.openFile(course.value.id, rel); }
  catch { note.value = `Could not open ${rel.split('/').pop()}. It may have been moved out of the course folder.`; }
}
const reveal = () => window.bilimind.courses.reveal(course.value.id);
const back = () => go('home');
const extOf = (name: string) => (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? '').toLowerCase();
const fileIcon = (name: string) => (/^(png|jpe?g|webp|gif)$/.test(extOf(name)) ? 'i-image' : /^(mp3|wav|m4a|ogg)$/.test(extOf(name)) ? 'i-mic' : 'i-file');

onMounted(async () => {
  const id = course.value.id;
  const [u, o] = await Promise.allSettled([window.bilimind.courses.playerUrl(id), window.bilimind.courses.outline(id)]);
  if (o.status === 'fulfilled') outline.value = o.value;
  if (u.status === 'rejected') { err.value = (u.reason as Error)?.message || 'This course could not be opened.'; return; }
  const base = u.value.split('#')[0];
  const saved = readPref(`last:${id}`);
  const first = lessons.value[0]?.route;
  const known = (r: string) => !lessonIdOf(r) || !lessons.value.length || lessons.value.some((l) => l.id === lessonIdOf(r));
  const start = saved && known(saved) ? saved : first ?? '#/';
  wantFirst = !saved && !first;
  src.value = `${base}${base.includes('?') ? '&' : '?'}app=1${start.startsWith('#') ? start : `#${start}`}`;
  current.value = lessonIdOf(start);
  view.value = current.value ? 'lesson' : 'path';
  await nextTick();
  if (frame.value) bind(frame.value);
  poll = window.setInterval(() => { if (!document.hidden) void sync(); }, 3000);
});
onBeforeUnmount(() => { detach?.(); clearInterval(poll); });
</script>

<template>
  <div class="ws">
    <CourseSidebar :title="title" :sentence="sentence" :lessons="lessons" :files="sources.length" :view="view" :current="current" :done="done"
                   @lesson="openLesson" @view="setView" @back="back" @reveal="reveal" />

    <section class="centre">
      <p v-if="err" class="err">{{ err }}</p>
      <template v-else-if="src">
        <iframe v-if="isMock" ref="frame" :src="src" title="Lesson" allow="autoplay; fullscreen"></iframe>
        <webview v-else ref="frame" :src="src" allowpopups="false" webpreferences="autoplayPolicy=no-user-gesture-required"></webview>
      </template>

      <!-- Study plan -->
      <div v-if="view === 'plan'" class="panel">
        <div class="pin">
          <p class="ctx">Study plan · {{ lessons.length }} {{ lessons.length === 1 ? 'lesson' : 'lessons' }}</p>
          <h1>What to do each day</h1>
          <p v-if="sentence" class="lede">Made for: “{{ sentence }}”</p>
          <div class="days">
            <div v-for="d in days" :key="d.label" class="day">
              <div class="dh"><b>{{ d.label }}</b><span v-if="d.minutes">{{ Math.round(d.minutes) }} min</span></div>
              <button v-for="l in d.items" :key="l.id" class="dl" :class="{ done: done.includes(l.id) }" @click="openLesson(l)">
                <span class="tick"><Icon v-if="done.includes(l.id)" name="i-check" /></span>
                <span class="t">{{ l.title }}</span>
                <span v-if="l.minutes" class="m">{{ Math.round(l.minutes) }} min</span>
                <Icon name="i-chev" class="go" />
              </button>
            </div>
          </div>
          <div class="acts">
            <button class="pill sm dark" @click="openFile('plan.md')"><Icon name="i-ext" /> Open plan.md</button>
            <button class="pill sm light" @click="openFile('reviews.ics')"><Icon name="i-bell" /> Add reviews to your calendar</button>
            <button class="pill sm light" @click="setView('path')"><Icon name="i-path" /> See the course path</button>
          </div>
          <p v-if="note" class="note">{{ note }}</p>
        </div>
      </div>

      <!-- Your files -->
      <div v-else-if="view === 'files'" class="panel">
        <div class="pin">
          <p class="ctx">Your files · {{ sources.length }}</p>
          <h1>What this course was built from</h1>
          <p class="lede">Every lesson, check and assistant answer points back to these files. Click one to open it.</p>
          <div class="files">
            <button v-for="f in sources" :key="f.rel" class="file" :title="f.rel" @click="openFile(f.rel)">
              <span class="fi"><Icon :name="fileIcon(f.name)" /></span>
              <span class="t"><b>{{ f.name }}</b><small>{{ extOf(f.name).toUpperCase() || 'File' }}<template v-if="f.bytes"> · {{ fmtBytes(f.bytes) }}</template></small></span>
              <Icon name="i-ext" class="go" />
            </button>
            <p v-if="!sources.length" class="empty">No files listed for this course.</p>
          </div>
          <div class="acts"><button class="pill sm light" @click="reveal"><Icon name="i-folder" /> Open the course folder</button></div>
          <p v-if="note" class="note">{{ note }}</p>
        </div>
      </div>
    </section>

    <AssistantPanel v-if="assistantOpen" :course-id="course.id" :lesson-id="askLesson" :lesson-title="askTitle" :lesson="playerLesson"
                    :sources="sources" @close="toggleAssistant(false)" />
    <aside v-else class="rail">
      <button class="open" title="Show the assistant" aria-label="Show the assistant" @click="toggleAssistant(true)">
        <span class="spark"><Icon name="i-spark" /></span><span class="lbl">Assistant</span>
      </button>
    </aside>
  </div>
</template>

<style scoped>
.ws { height: 100%; display: flex; min-height: 0; background: #fff; }
.centre { flex: 1; min-width: 0; position: relative; background: #fff; }
iframe, webview { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: flex; }
.err { margin: 24px; color: var(--coral); font-weight: 600; }

.panel { position: absolute; inset: 0; z-index: 2; overflow-y: auto; background: #fff; user-select: text; }
.pin { max-width: 720px; margin: 0 auto; padding: 30px 32px 48px; }
.ctx { margin: 0; font-size: 12.5px; font-weight: 500; color: var(--text-3); }
.panel h1 { margin: 8px 0 0; font: 700 28px/1.12 var(--display); letter-spacing: -0.025em; }
.lede { margin: 10px 0 0; font-size: 14.5px; line-height: 1.55; color: var(--text-2); }
.days { margin-top: 24px; display: grid; gap: 12px; }
.day { border-radius: 18px; background: var(--canvas); box-shadow: inset 0 0 0 1px var(--line); padding: 8px; }
.dh { display: flex; align-items: baseline; justify-content: space-between; padding: 6px 10px 8px; }
.dh b { font: 700 14px/1 var(--display); letter-spacing: -0.01em; }
.dh span { font-size: 12px; color: var(--text-3); }
.dl { width: 100%; display: flex; align-items: center; gap: 12px; padding: 11px 12px; border-radius: 12px; background: #fff; box-shadow: 0 0 0 1px var(--line); text-align: left; font-size: 14px; transition: box-shadow .15s; }
.dl + .dl { margin-top: 6px; }
.dl:hover { box-shadow: 0 0 0 1px rgb(35 64 230 / 0.35), 0 4px 14px rgb(11 13 16 / 0.06); }
.dl .t { flex: 1; min-width: 0; font-weight: 600; color: var(--ink-2); }
.dl .m { font-size: 12.5px; color: var(--text-3); white-space: nowrap; }
.tick { width: 20px; height: 20px; flex: none; border-radius: 50%; box-shadow: inset 0 0 0 2px var(--line-2); display: grid; place-items: center; }
.tick .ico { width: 11px; height: 11px; }
.dl.done .tick { background: var(--lime); box-shadow: none; }
.dl.done .t { color: var(--text-2); }
.go { width: 13px; height: 13px; color: var(--text-3); }
.acts { margin-top: 22px; display: flex; flex-wrap: wrap; gap: 8px; }
.note { margin: 12px 0 0; font-size: 13px; color: #9A2B16; }
.files { margin-top: 22px; display: grid; gap: 8px; }
.file { display: flex; align-items: center; gap: 12px; padding: 11px 14px 11px 11px; border-radius: 14px; background: #fff; box-shadow: 0 0 0 1px var(--line); text-align: left; transition: box-shadow .15s; }
.file:hover { box-shadow: 0 0 0 1px rgb(35 64 230 / 0.35), 0 4px 14px rgb(11 13 16 / 0.06); }
.fi { width: 36px; height: 36px; flex: none; border-radius: 10px; background: var(--cobalt-soft); color: var(--cobalt); display: grid; place-items: center; }
.fi .ico { width: 17px; height: 17px; }
.file .t { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.file b { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.file small { font-size: 12px; color: var(--text-3); }
.empty { font-size: 13px; color: var(--text-3); }

.rail { width: 52px; flex: none; border-left: 1px solid var(--line); background: var(--canvas); display: flex; justify-content: center; padding-top: 10px; }
.rail .open { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 8px 6px 12px; border-radius: 14px; transition: background .15s; }
.rail .open:hover { background: rgb(11 13 16 / 0.05); }
.rail .spark { width: 32px; height: 32px; border-radius: 50%; background: var(--cobalt); color: #fff; display: grid; place-items: center; }
.rail .spark .ico { width: 15px; height: 15px; }
.rail .lbl { writing-mode: vertical-rl; font-size: 12.5px; font-weight: 600; color: var(--ink-3); letter-spacing: .02em; }
</style>
