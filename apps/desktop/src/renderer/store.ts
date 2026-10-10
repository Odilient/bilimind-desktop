// The whole app state: one reactive object and a tiny screen machine (home -> building -> finished -> course).
import { reactive } from 'vue';
import type { CourseCard, FolderFile, RunEvent, Settings } from './env';
import { roleOf, sayStep, sayLine, doingNow, type Role } from './words';

export type Screen = 'home' | 'building' | 'finished' | 'course';
export type NodeState = 'waiting' | 'working' | 'done' | 'failed' | 'skipped';

export interface CrewNode {
  id: string; role: Role; title: string; day?: number;
  state: NodeState; open: number; steps: number; failed: number;
  now: string; last: string; startedAt?: number;
  /** checker: the rejected-and-rewritten moments */
  rejected: number; rewritten: number; resolved: number;
  /** coder: tests (latest run per exercise; a self-marked exercise leaves the count) */
  tests: { passed: number; total: number };
  testsBy: Record<string, { passed: number; total: number }>;
  drafts: number;
  /** writer: checks passed of total on the last check (the Checker's own re-check of the lesson replaces it: final) */
  checks?: { passed: number; total: number };
  final?: boolean;
  minutes?: number;
}
export interface FeedItem { id: number; at: number; role: Role; text: string; ms?: number; ok: boolean; tone?: 'reject' | 'rewrite' | 'plan' }

export interface RunState {
  runId: string; src: string; sentence: string; files: FolderFile[];
  startedAt: number; endedAt?: number; cost: number;
  phase: number;               // 0 read, 1 plan, 2 write, 3 check, 4 narrate, 5 pack
  nodes: Record<string, CrewNode>;
  writerOrder: string[];
  plan?: { keep: { key: string; title: string; day?: number }[]; cut: { key: string; title: string; reason: string }[] };
  feed: FeedItem[];
  moment?: { lesson: string; at: number; stage: 'rejected' | 'rewritten' };
  card?: CourseCard; error?: string; course?: string;
}

export const state = reactive({
  screen: 'home' as Screen,
  settings: null as Settings | null,
  courses: [] as CourseCard[],
  settingsOpen: false,
  run: null as RunState | null,
  course: null as CourseCard | null,     // the course on the finished / course screens
  draft: { sentence: '', src: '', files: [] as FolderFile[] },
});

const api = () => window.bilimind;
let unsub: (() => void) | null = null;
let feedId = 0;

export async function loadSettings() { state.settings = await api().settings.get(); }
export async function loadCourses() { state.courses = await api().courses.list(); }
export function go(screen: Screen) { state.screen = screen; }

function node(id: string, role: Role, title: string, day?: number): CrewNode {
  return { id, role, title, day, state: 'waiting', open: 0, steps: 0, failed: 0, now: '', last: '', rejected: 0, rewritten: 0, resolved: 0, tests: { passed: 0, total: 0 }, testsBy: {}, drafts: 0 };
}

function freshRun(runId: string, src: string, sentence: string, files: FolderFile[]): RunState {
  return {
    runId, src, sentence, files, startedAt: Date.now(), cost: 0, phase: 0, writerOrder: [], feed: [],
    nodes: {
      lead: node('lead', 'lead', 'Lead'),
      coder: node('coder', 'coder', 'Coder'),
      checker: node('checker', 'checker', 'Checker'),
      narrator: node('narrator', 'narrator', 'Narrator'),
      packager: node('packager', 'packager', 'Packager'),
    },
  };
}

const PHASE: Record<string, number> = {
  init: 0, goal: 0, ingest: 0, outline: 1, 'exam-map': 1, plan: 1, draft: 2, 'code-test': 3, 'fact-check': 3,
  verdict: 3, evidence: 3, 'rewrite-item': 3, narrate: 4, export: 5, build: 5,
};

function writerKey(r: RunState, agent: string, lesson?: string): string {
  if (lesson) return lesson;
  const title = agent.replace(/^Writer\s*·\s*/i, '').trim();
  const found = Object.values(r.nodes).find((x) => x.role === 'writer' && x.title === title);
  return found ? found.id : title || 'writer';
}
function lessonTitle(r: RunState, lesson?: string, agent?: string): string | undefined {
  if (lesson && r.nodes[`w:${lesson}`]) return r.nodes[`w:${lesson}`].title;
  const k = r.plan?.keep.find((x) => x.key === lesson);
  if (k) return k.title;
  if (agent && /^Writer/i.test(agent)) return agent.replace(/^Writer\s*·\s*/i, '').trim();
  return undefined;
}
function nodeFor(r: RunState, agent: string, cmd: string, lesson?: string): CrewNode {
  const role = roleOf(agent, cmd);
  if (role !== 'writer') return r.nodes[role];
  const key = writerKey(r, agent, lesson);
  const id = `w:${key}`;
  if (!r.nodes[id]) {
    r.nodes[id] = node(id, 'writer', lessonTitle(r, lesson, agent) ?? key);
    r.writerOrder.push(id);
  }
  return r.nodes[id];
}
function push(r: RunState, role: Role, text: string | null, ok = true, ms?: number, tone?: FeedItem['tone']) {
  if (!text) return;
  r.feed.unshift({ id: ++feedId, at: Date.now(), role, text, ok, ms, tone });
  if (r.feed.length > 200) r.feed.length = 200;
}

export function applyEvent(e: RunEvent) {
  const r = state.run;
  if (!r || e.runId !== r.runId) return;
  switch (e.type) {
    case 'started': r.course = e.course; break;
    case 'line': push(r, 'lead', sayLine(e.text, new Map((r.plan?.keep ?? []).map((k) => [k.key, k.title])))); break;
    case 'plan': {
      r.plan = { keep: [...e.keep].sort((a, b) => (a.day ?? 99) - (b.day ?? 99)), cut: e.cut };
      for (const k of r.plan.keep) {
        const id = `w:${k.key}`;
        if (!r.nodes[id]) { r.nodes[id] = node(id, 'writer', k.title, k.day); r.writerOrder.push(id); }
        else { r.nodes[id].title = k.title; r.nodes[id].day = k.day; }
      }
      r.writerOrder.sort((a, b) => (r.nodes[a].day ?? 99) - (r.nodes[b].day ?? 99));
      push(r, 'lead', `Kept ${e.keep.length} ${e.keep.length === 1 ? 'lesson' : 'lessons'}, cut ${e.cut.length} that did not fit your time`, true, undefined, 'plan');
      break;
    }
    case 'step-start': {
      const n = nodeFor(r, e.agent, e.cmd, e.lesson);
      n.open++; n.state = 'working'; n.startedAt = Date.now();
      n.now = doingNow(e.cmd, n.role === 'writer' ? undefined : lessonTitle(r, e.lesson, e.agent));
      // a Writer only re-drafts after a check sent the lesson back; a retry after a bad reply is still "Writing"
      if (n.role === 'writer') n.now = e.cmd === 'draft' ? (n.checks && n.checks.passed < n.checks.total ? 'Rewriting after the checks' : 'Writing the lesson') : 'Checking the lesson';
      r.phase = Math.max(r.phase, PHASE[e.cmd] ?? r.phase);
      break;
    }
    case 'step-end': {
      const n = nodeFor(r, e.agent, e.cmd, e.lesson);
      n.open = Math.max(0, n.open - 1); n.steps++;
      if (!e.ok) n.failed++;
      r.cost += e.costUsd || 0;
      r.phase = Math.max(r.phase, PHASE[e.cmd] ?? r.phase);
      const title = lessonTitle(r, e.lesson, e.agent);
      const text = sayStep(e.cmd, e.result, e.ok, title, e.error);
      if (text) n.last = text;
      const res = e.result ?? '';
      if (e.cmd === 'check' && (n.role === 'writer' || n.role === 'checker')) {
        const m = /(\d+)\/(\d+) checks/.exec(res);
        // the Checker's re-check is the lesson's final score: show it on that lesson's Writer card
        const w = n.role === 'writer' ? n : e.lesson ? r.nodes[`w:${e.lesson}`] : undefined;
        if (m && w && !(n.role === 'writer' && w.final)) { w.checks = { passed: +m[1], total: +m[2] }; if (n.role === 'checker') w.final = true; }
      }
      if (e.cmd === 'code-test') {
        const ex = `${e.lesson ?? ''}:${/^(b\d+)/.exec(res)?.[1] ?? ''}`;
        const m = /reference (\d+)\/(\d+)/.exec(res);
        if (m) n.testsBy[ex] = { passed: +m[1], total: +m[2] };
        else if (/self-marked/.test(res)) delete n.testsBy[ex];
        const all = Object.values(n.testsBy);
        n.tests = { passed: all.reduce((a, x) => a + x.passed, 0), total: all.reduce((a, x) => a + x.total, 0) };
      }
      if (e.cmd === 'draft' && e.ok) n.drafts++;
      if (e.cmd === 'narrate') { const m = /([\d.]+) min/.exec(res); if (m) n.minutes = +m[1]; }
      let tone: FeedItem['tone'];
      if (e.cmd === 'verdict') {
        const m = /re-solved (\d+)/.exec(res); if (m) n.resolved += +m[1];
        const rej = /(\d+) wrong keys? rejected/.exec(res);
        if (rej && +rej[1] > 0) {
          n.rejected += +rej[1]; tone = 'reject';
          if (/rewritten/.test(res)) n.rewritten += +rej[1];
          r.moment = { lesson: title ?? 'a lesson', at: Date.now(), stage: 'rejected' };
          const at = r.moment.at;
          setTimeout(() => { if (state.run?.moment?.at === at) state.run.moment.stage = 'rewritten'; }, 1600);
        }
      }
      if (e.cmd === 'rewrite-item') { tone = 'rewrite'; if (r.moment) r.moment.stage = 'rewritten'; }
      push(r, n.role, text, e.ok, e.ms, tone);
      n.state = n.open > 0 ? 'working' : !e.ok ? 'failed' : 'done';
      if (n.open === 0) n.now = '';
      break;
    }
    case 'done': {
      r.endedAt = Date.now(); r.card = e.card; r.phase = 6;
      for (const n of Object.values(r.nodes)) { if (n.state === 'working') n.state = 'done'; else if (n.state === 'waiting') n.state = 'skipped'; }
      state.course = e.card;
      loadCourses();
      setTimeout(() => { if (state.run === r && state.screen === 'building') go('finished'); }, 1400);
      break;
    }
    case 'error': {
      r.error = e.message; r.endedAt = Date.now();
      for (const n of Object.values(r.nodes)) if (n.state === 'working') n.state = 'failed';
      push(r, 'lead', `Stopped: ${e.message}`, false);
      break;
    }
  }
}

export async function startRun() {
  const d = state.draft;
  const sentence = d.sentence.trim();
  if (!sentence || !d.src) return;
  unsub?.();
  state.run = freshRun('', d.src, sentence, d.files);
  const pending: RunEvent[] = [];
  unsub = api().run.onEvent((e) => { if (state.run && !state.run.runId) pending.push(e); else applyEvent(e); });
  go('building');
  try {
    const { runId } = await api().run.start({ src: d.src, sentence });
    state.run.runId = runId;
    state.run.startedAt = Date.now();
    pending.splice(0).forEach(applyEvent);
  } catch (err) {
    state.run.error = (err as Error).message || String(err);
    state.run.endedAt = Date.now();
  }
}

export async function cancelRun() {
  const r = state.run;
  if (r?.runId && !r.endedAt) await api().run.cancel(r.runId);
  unsub?.(); unsub = null;
  state.run = null;
  go('home');
  loadCourses();
}

export function openCourse(c: CourseCard) { state.course = c; go('course'); }
