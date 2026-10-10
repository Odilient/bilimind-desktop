<script setup lang="ts">
// Screen 1: make a course. One cobalt slab (sentence + folder + build), then the list of your courses.
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import Icon from '../components/Icon.vue';
import KeyCard from '../components/KeyCard.vue';
import { state, startRun, openCourse } from '../store';
import { OBJ, objectFor } from '../images';
import { mockPrimeExample } from '../mock';
import { ROLE_LABEL, fmtDate, isStaged, nbHyphen } from '../words';
import type { FolderFile } from '../env';

const PLACEHOLDER = "My Data Structures final is Wednesday 9am. The slides and last year's paper are in this folder. I have 45 minutes a day. Get me ready.";
const EXAMPLES = [
  { tag: 'Exam', label: 'Data Structures final', icon: 'i-school', text: PLACEHOLDER },
  { tag: 'Shop', label: 'Day-one training for new boba crew', icon: 'i-cards', text: 'We hire new crew every few weeks at Mutiara Tea Bar. Turn our SOP folder into a day-one course they must pass before their first shift, narrated in English and Malay.' },
  { tag: 'Language', label: 'Survival Malay', icon: 'i-globe', text: "I'm an international student at Taylor's with zero Malay. Make me a survival course for my first month (mamak, Grab, campus) that also starts me on Bahasa Melayu Komunikasi. I have 20 minutes a day for 2 weeks." },
];

const ta = ref<HTMLTextAreaElement | null>(null);
const over = ref(false);
const busy = ref(false);
const err = ref('');
const hasKey = computed(() => {
  const s = state.settings;
  return !!s && s.keys[s.provider]?.set;
});
const ready = computed(() => state.draft.sentence.trim().length > 8 && !!state.draft.src);
const folderName = computed(() => state.draft.src.split(/[\\/]/).filter(Boolean).pop() ?? '');
// files dropped or chosen one by one sit in a staging folder: name them by count, not by that temp path
const staged = computed(() => isStaged(state.draft.src));
const nFiles = computed(() => state.draft.files.length);
const srcTitle = computed(() => !staged.value ? folderName.value
  : nFiles.value === 1 ? state.draft.files[0]!.name : `${nFiles.value} files`);
const srcSub = computed(() => staged.value ? (nFiles.value === 1 ? 'Only this file goes in' : 'Only these files go in')
  : `${nFiles.value} ${nFiles.value === 1 ? 'file' : 'files'}`);

function grow() {
  const el = ta.value; if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight + 2, 220)}px`;   // + the 1px borders (border-box), else a scrollbar shows
}
watch(() => state.draft.sentence, () => nextTick(grow));
onMounted(grow);

function useExample(text: string) {
  state.draft.sentence = text;
  mockPrimeExample(text);
  ta.value?.focus();
}
async function setFolder(path: string | null) {
  if (!path) return;
  err.value = '';
  state.draft.src = path;
  try {
    const r = await window.bilimind.inspectFolder(path);
    state.draft.files = r.files;
    if (!r.files.length) err.value = isStaged(path) ? 'BiliMind cannot read those files. Use PDF, Word, PowerPoint or text.'
      : 'No files BiliMind can read in that folder (PDF, Word, PowerPoint, text).';
  } catch (e) { err.value = (e as Error).message; state.draft.files = []; }
}
async function pick() {
  try { await setFolder(await window.bilimind.pickFolder()); } catch (e) { err.value = (e as Error).message; }
}
async function pickFiles() {
  try { await setFolder(await window.bilimind.pickFiles()); } catch (e) { err.value = (e as Error).message; }
}
// the preload already told main every dropped path; pickFolder() answers with the dropped folder, or a staging
// folder holding just the dropped files, without a dialog
function onDrop() { over.value = false; void pick(); }
function clearFolder() { state.draft.src = ''; state.draft.files = []; err.value = ''; }
async function build() {
  if (!ready.value || busy.value) return;
  busy.value = true;
  await startRun();
  busy.value = false;
}
function fileIcon(f: FolderFile) {
  if (f.role === 'sop') return 'i-list';
  if (/pptx?|key/.test(f.ext)) return 'i-image';
  return 'i-file';
}
function size(b: number) { return b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`; }
</script>

<template>
  <div class="home">
    <section class="slab cobalt hero">
      <img class="obj o1" :src="OBJ.docs" alt="" />
      <div class="left">
        <span class="eb on-dark"><span class="dot"><Icon name="i-spark" /></span>Open source · runs on your computer</span>
        <h1 class="disp">Your files in,<br /><span class="hchip"><Icon name="i-arrow" /></span> a course <span class="lime">out.</span></h1>
        <p class="lede">Drop in your slides, past papers or your shop's SOP and say what you need in one sentence. A crew of six writes the lessons, runs the code, checks every answer against your files and records the voice.</p>
        <div class="ex">
          <span class="ex-l">Try one</span>
          <button v-for="x in EXAMPLES" :key="x.tag" class="exchip" :class="{ on: state.draft.sentence === x.text }" @click="useExample(x.text)">
            <span class="exi"><Icon :name="x.icon" /></span><b>{{ x.tag }}</b>{{ x.label }}
          </button>
        </div>
      </div>

      <div class="composer">
        <label class="lbl" for="sentence"><span class="n">1</span> What do you need?</label>
        <textarea id="sentence" ref="ta" v-model="state.draft.sentence" rows="3" :placeholder="`e.g. ${PLACEHOLDER}`" @input="grow"></textarea>

        <div class="lbl"><span class="n">2</span> Your files</div>
        <div v-if="!state.draft.src" class="drop" :class="{ over }" role="button" tabindex="0"
             @click="pick" @keydown.enter.self="pick" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="onDrop">
          <span class="up"><Icon name="i-arrow-up" /></span>
          <b>Drop your files or a folder</b>
          <span class="kinds">Slides, past papers, notes, an SOP: PDF, Word, PowerPoint, text</span>
          <span class="picks">
            <button class="pill sm light" @click.stop="pickFiles"><Icon name="i-file" />Choose files</button>
            <button class="pill sm light" @click.stop="pick"><Icon name="i-folder" />Choose a folder</button>
          </span>
        </div>
        <div v-else class="folder" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="onDrop" :class="{ over }">
          <div class="fhead">
            <span class="fi"><Icon :name="staged ? 'i-file' : 'i-folder'" /></span>
            <div class="fname"><b>{{ srcTitle }}</b><span>{{ srcSub }}</span></div>
            <button class="pill sm light" @click="staged ? pickFiles() : pick()">Change</button>
            <button class="iconbtn" :aria-label="staged ? 'Remove files' : 'Remove folder'" @click="clearFolder"><Icon name="i-x" /></button>
          </div>
          <div class="files">
            <span v-for="f in state.draft.files" :key="f.path" class="file" :title="`${f.name} · ${size(f.bytes)}`">
              <Icon :name="fileIcon(f)" />
              <span class="fn">{{ f.name }}</span>
              <span class="role" :class="f.role">{{ ROLE_LABEL[f.role] }}</span>
            </span>
          </div>
        </div>
        <p v-if="err" class="err"><Icon name="i-warning" /> {{ err }}</p>

        <KeyCard v-if="state.settings && !hasKey" inline class="kc" />
        <div v-else class="go">
          <span class="hint">{{ ready ? 'About 5 minutes. You can watch the crew work.' : !state.draft.src ? 'Add your files to start.' : 'Say what you need in a sentence.' }}</span>
          <button class="pill lime big" :disabled="!ready || busy" @click="build">Build my course <span class="arr"><Icon name="i-arrow" /></span></button>
        </div>
      </div>
    </section>

    <section class="mine">
      <div class="mhead">
        <h2 class="disp">Your courses <span class="hchip cobalt"><Icon name="i-book" /></span></h2>
        <span class="sub">{{ state.courses.length ? `${state.courses.length} on this computer, each one a folder you own` : '' }}</span>
      </div>
      <div v-if="state.courses.length" class="cards">
        <button v-for="c in state.courses" :key="c.id" class="card" :class="c.status" @click="c.status === 'ready' && openCourse(c)">
          <div class="art"><img :src="objectFor(c)" alt="" /></div>
          <div class="body">
            <span class="date">{{ fmtDate(c.createdAt) }}<template v-if="c.status !== 'ready'"> · {{ c.status === 'building' ? 'building' : 'stopped' }}</template></span>
            <b class="title">{{ nbHyphen(c.title) }}</b>
            <div class="meta">
              <span><Icon name="i-book" />{{ c.lessons }} {{ c.lessons === 1 ? 'lesson' : 'lessons' }}</span>
              <span v-if="c.checks" class="ok"><Icon name="i-check" />{{ c.checks.passed }}/{{ c.checks.total }} checks</span>
              <span v-if="c.minutes"><Icon name="i-speaker" />{{ Math.round(c.minutes) }} min</span>
            </div>
          </div>
          <span class="open"><Icon name="i-arrow" /></span>
        </button>
      </div>
      <div v-else class="empty">
        <img :src="OBJ.rocket" alt="" />
        <div><b>No courses yet.</b><span>Your first course lands here, as a folder on this computer you can open any time, even offline.</span></div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home { height: 100%; overflow-y: auto; padding: 0 var(--gut) 28px; }
.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.02fr); gap: 36px; padding: 40px 40px 40px 48px; min-height: 520px; }
.left { display: flex; flex-direction: column; gap: 22px; position: relative; z-index: 1; }
h1 { font-size: clamp(52px, 5.4vw, 76px); margin-top: 6px; }
.lede { margin: 0; max-width: 470px; font-size: 16px; line-height: 1.55; color: rgb(255 255 255 / 0.74); }
.ex { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: auto; }
.ex-l { width: 100%; font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: rgb(255 255 255 / 0.6); }
.exchip {
  display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 14px 0 5px; border-radius: 99px;
  background: rgb(255 255 255 / 0.1); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.2); color: #fff; font-size: 13px; font-weight: 500;
  transition: background .15s, transform .15s;
}
.exchip:hover { background: rgb(255 255 255 / 0.18); }
.exchip.on { background: #fff; color: var(--ink); }
.exchip b { font-weight: 700; }
.exi { width: 28px; height: 28px; border-radius: 50%; background: var(--lime); color: var(--ink); display: grid; place-items: center; }
.exi .ico { width: 14px; height: 14px; }

.obj { position: absolute; pointer-events: none; filter: drop-shadow(0 18px 24px rgb(5 10 60 / 0.35)); }
.o1 { width: 132px; right: 18px; top: -26px; z-index: 2; transform: rotate(8deg); }

.composer {
  position: relative; z-index: 1; align-self: start; display: flex; flex-direction: column; gap: 10px;
  background: #fff; color: var(--ink); border-radius: var(--r-md); padding: 22px; box-shadow: 0 30px 60px -30px rgb(5 10 60 / 0.6);
  animation: rise .5s both;
}
.lbl { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 700; letter-spacing: .02em; color: var(--ink-3); }
.lbl .n { width: 20px; height: 20px; border-radius: 50%; background: var(--cobalt); color: #fff; font-size: 11px; display: grid; place-items: center; }
textarea {
  resize: none; border: 1px solid var(--line-2); border-radius: 18px; padding: 14px 16px; min-height: 92px; max-height: 220px;
  font-size: 15.5px; line-height: 1.5; outline: none; background: var(--canvas); overflow-y: auto; scrollbar-width: thin; transition: border-color .15s, box-shadow .15s, background .15s;
}
textarea::placeholder { color: var(--text-3); opacity: 1; font-weight: 400; }
textarea:focus { border-color: var(--cobalt); background: #fff; box-shadow: 0 0 0 4px rgb(35 64 230 / 0.12); }
.drop {
  display: grid; justify-items: center; gap: 4px; text-align: center; padding: 18px 16px; border-radius: 18px; cursor: pointer;
  border: 2px dashed rgb(35 64 230 / 0.35); background: var(--cobalt-soft); transition: background .15s, border-color .15s;
}
.drop:hover, .drop.over { background: #E2E7FD; border-color: var(--cobalt); }
.drop b { font-size: 14.5px; }
.drop .kinds { font-size: 12.5px; color: var(--text-2); }
.picks { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 8px; }
.picks .pill { gap: 6px; }
.picks .ico { width: 14px; height: 14px; color: var(--cobalt); }
.up { width: 36px; height: 36px; border-radius: 50%; background: var(--cobalt); color: #fff; display: grid; place-items: center; margin-bottom: 4px; }
.up .ico { width: 17px; height: 17px; }
.folder { border-radius: 18px; background: var(--canvas); box-shadow: inset 0 0 0 1px var(--line); padding: 10px; display: grid; gap: 10px; }
.folder.over { box-shadow: inset 0 0 0 2px var(--cobalt); }
.fhead { display: flex; align-items: center; gap: 10px; }
.fi { width: 36px; height: 36px; border-radius: 12px; background: var(--cobalt); color: var(--lime); display: grid; place-items: center; }
.fi .ico { width: 18px; height: 18px; }
.fname { flex: 1; min-width: 0; display: grid; }
.fname b { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fname span { font-size: 12px; color: var(--text-2); }
.files { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; max-height: 136px; overflow-y: auto; }
.file { display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 4px 0 10px; border-radius: 99px; background: #fff; box-shadow: inset 0 0 0 1px var(--line); font-size: 12.5px; min-width: 0; animation: rise .35s both; }
.file .ico { width: 14px; height: 14px; color: var(--cobalt); }
.fn { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; font-weight: 500; }
.role { flex: none; }
.role { height: 22px; padding: 0 8px; border-radius: 99px; display: inline-grid; place-items: center; font-size: 11px; font-weight: 700; background: var(--page); color: var(--text-2); }
.role.lecture { background: var(--cobalt-soft); color: var(--cobalt-2); }
.role.past_paper { background: var(--lime); color: var(--ink); }
.role.sop { background: var(--ink); color: var(--lime); }
.err { margin: 0; display: flex; gap: 6px; align-items: center; font-size: 13px; color: var(--coral); font-weight: 600; }
.go { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 6px; }
.hint { font-size: 12.5px; color: var(--text-2); }
.kc { margin-top: 4px; }

.mine { padding: 34px 8px 0; }
.mhead { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.mhead h2 { font-size: 40px; }
.sub { font-size: 13px; color: var(--text-2); }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
.card {
  position: relative; display: flex; align-items: stretch; gap: 0; text-align: left; background: #fff; border-radius: 24px;
  box-shadow: var(--shadow-card); overflow: hidden; transition: transform .2s, box-shadow .2s; min-height: 132px;
}
.card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lift); }
.card .art { width: 112px; flex: none; background: var(--cobalt-soft); display: grid; place-items: center; position: relative; }
.card:nth-child(3n+2) .art { background: var(--lime-soft); }
.card:nth-child(3n+3) .art { background: #E9ECF6; }
.card .art img { width: 88px; filter: drop-shadow(0 10px 14px rgb(13 22 96 / 0.22)); transition: transform .3s; }
.card:hover .art img { transform: rotate(-6deg) scale(1.06); }
.body { padding: 16px 44px 16px 16px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.date { font-size: 12px; color: var(--text-3); font-weight: 500; }
.title { font: 700 17px/1.2 var(--display); letter-spacing: -0.02em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.meta { display: flex; flex-wrap: wrap; gap: 6px 10px; margin-top: auto; }
.meta span { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text-2); font-weight: 500; }
.meta .ico { width: 13px; height: 13px; color: var(--cobalt); }
.meta .ok .ico { color: var(--green); }
.open { position: absolute; right: 14px; top: 14px; width: 28px; height: 28px; border-radius: 50%; background: var(--page); display: grid; place-items: center; transition: background .2s, color .2s; }
.open .ico { width: 13px; height: 13px; }
.card:hover .open { background: var(--lime); }
.card.failed { opacity: .7; }
.empty { display: flex; align-items: center; gap: 18px; padding: 22px 26px; border-radius: 24px; border: 2px dashed var(--line-2); color: var(--text-2); }
.empty img { width: 84px; }
.empty b { display: block; color: var(--ink); font-size: 16px; }
.empty span { font-size: 14px; }
</style>
