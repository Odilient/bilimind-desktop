// Browser mock of window.bilimind (installed only when the Electron preload is missing: vite dev / preview,
// screenshots). The data is real: mock/data.json is generated from the three showcase courses by
// mock/gen-mock-data.mjs. A run replays the first unattended pass of the matching showcase run with its real
// step order, parallelism, durations and costs; long waits are compressed (gap^0.6) so the replay lasts ~22 s.
// URL switches: ?nokey (no AI key saved), ?empty (no courses yet), ?replay=<seconds> (replay length).
import type { BiliMindApi, CourseCard, FolderFile, RunEvent, Settings } from './env';
import data from './mock/data.json';

interface MockStep { agent: string; cmd: string; lesson?: string; ok: boolean; ms: number; costUsd: number; result?: string; start: number; end: number }
interface MockCourse {
  example: string; object: string; sentence: string;
  files: (FolderFile & { pages?: number })[];
  plan: { keep: { key: string; title: string; day?: number }[]; cut: { key: string; title: string; reason: string }[] };
  steps: MockStep[]; card: CourseCard;
}

const COURSES = (data as { courses: MockCourse[] }).courses;
const q = new URLSearchParams(location.search);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Which showcase run matches a folder path or a sentence. */
export function mockCourseFor(text: string): MockCourse {
  const t = text.toLowerCase();
  if (/boba|tea bar|sop|crew|shop/.test(t)) return COURSES.find((c) => c.example === 'shop')!;
  if (/malay|bahasa|language|survival/.test(t)) return COURSES.find((c) => c.example === 'language')!;
  return COURSES.find((c) => c.example === 'exam')!;
}
/** The 3D object a showcase course wears (used by the course list in mock mode). */
export function mockObjectFor(id: string): string | undefined {
  return COURSES.find((c) => c.card.id === id)?.object;
}

export function installMock(): void {
  if (window.bilimind) return;
  window.__bilimindMock = true;

  const settings: Settings = {
    provider: 'deepseek',
    keys: { deepseek: q.has('nokey') ? { set: false } : { set: true, last4: '7f3a' }, openrouter: { set: false } },
    narrate: true,
    outRoot: 'C:\\Users\\you\\Documents\\BiliMind',
    version: '0.1.0',
  };
  const built: CourseCard[] = [];
  const listeners = new Set<(e: RunEvent) => void>();
  const emit = (e: RunEvent) => listeners.forEach((cb) => cb(e));
  let timers: number[] = [];
  let lastPicked = COURSES[0];

  const api: BiliMindApi = {
    settings: {
      async get() { return structuredClone(settings); },
      async save(p) {
        if (p.provider) settings.provider = p.provider;
        if (p.key) settings.keys[p.key.provider] = { set: true, last4: p.key.value.slice(-4) };
        if (typeof p.narrate === 'boolean') settings.narrate = p.narrate;
        if (p.outRoot) settings.outRoot = p.outRoot;
        return structuredClone(settings);
      },
      async testKey(provider) {
        await sleep(700);
        return settings.keys[provider].set ? { ok: true, balance: '$4.82' } : { ok: false, error: 'No key saved yet.' };
      },
    },
    async pickFolder() {
      await sleep(150);
      return lastPicked.files[0]?.path.replace(/\\[^\\]+$/, '') ?? null;
    },
    async inspectFolder(path) {
      const c = mockCourseFor(path);
      return { path, files: c.files.map(({ pages: _p, ...f }) => f) };
    },
    courses: {
      async list() { return q.has('empty') ? [...built] : [...built, ...COURSES.map((c) => c.card)]; },
      async get(id) { return [...built, ...COURSES.map((c) => c.card)].find((c) => c.id === id) ?? null; },
      async playerUrl(id) {
        const slug = id.split(/[\\/]/).pop()!.replace(/-\d+$/, '');
        // Served from the repo root (screenshots): apps/desktop/dist/renderer/index.html -> showcase/courses/<id>.
        return new URL(`../../../../showcase/courses/${slug}/index.html`, location.href).href;
      },
      async reveal(id) { console.info('[mock] reveal', id); },
      async openFile(id, rel) { console.info('[mock] open', id, rel); },
      async remove(id) { const i = built.findIndex((c) => c.id === id); if (i >= 0) built.splice(i, 1); },
    },
    run: {
      async start({ src, sentence }) {
        const c = mockCourseFor(`${src} ${sentence}`);
        const runId = `mock-${Date.now()}`;
        replay(c, runId);
        return { runId };
      },
      async cancel() { timers.forEach(clearTimeout); timers = []; },
      onEvent(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    },
    async openExternal(url) { console.info('[mock] open', url); },
    platform: 'win32',
  };

  /** Example chips call this so "click the folder" picks the matching showcase folder. */
  (api as unknown as { __pick: (s: string) => void }).__pick = (s: string) => { lastPicked = mockCourseFor(s); };

  function replay(c: MockCourse, runId: string) {
    const total = Number(q.get('replay')) * 1000 || 22_000;
    const pts = [...new Set(c.steps.flatMap((s) => [s.start, s.end]))].sort((a, b) => a - b);
    const at = new Map<number, number>();
    let acc = 0;
    pts.forEach((p, i) => { if (i) acc += Math.pow(pts[i] - pts[i - 1], 0.6); at.set(p, acc); });
    const k = (total - 1500) / (acc || 1);
    const t = (ms: number) => 600 + (at.get(ms) ?? 0) * k;
    const course = c.card.id.split('\\').pop()!;
    const plan: { t: number; e: RunEvent }[] = [{ t: 0, e: { runId, type: 'started', course } }];
    plan.push({ t: 250, e: { runId, type: 'line', text: `Found ${c.files.length} files in your folder` } });
    for (const s of c.steps) {
      const t0 = t(s.start);
      const t1 = Math.max(t(s.end), t0 + 260);
      plan.push({ t: t0, e: { runId, type: 'step-start', agent: s.agent, cmd: s.cmd, lesson: s.lesson } });
      plan.push({ t: t1, e: { runId, type: 'step-end', agent: s.agent, cmd: s.cmd, lesson: s.lesson, ok: s.ok, ms: s.ms, costUsd: s.costUsd, result: s.result } });
      if (s.cmd === 'plan' && s.agent === 'Lead') plan.push({ t: t1 + 20, e: { runId, type: 'plan', ...c.plan } });
    }
    const end = Math.max(...plan.map((p) => p.t));
    // The finished card carries the recorded first pass: its real wall time and its real text-model cost.
    const last = c.steps[c.steps.length - 1];
    const card: CourseCard = {
      ...c.card, id: `${c.card.id}-${Date.now() % 100000}`, createdAt: new Date().toISOString(),
      wallMs: last.end, costUsd: c.steps.reduce((a, s) => a + s.costUsd, 0),
    };
    plan.push({ t: end + 900, e: { runId, type: 'done', course, card } });
    plan.sort((a, b) => a.t - b.t);
    timers = plan.map(({ t: when, e }) => window.setTimeout(() => {
      if (e.type === 'done') built.unshift(card);
      emit(e);
    }, when));
  }

  window.bilimind = api;
}

/** In mock mode, make the next "pick a folder" return the showcase folder that matches this example. */
export function mockPrimeExample(sentence: string): void {
  const api = window.bilimind as unknown as { __pick?: (s: string) => void };
  api.__pick?.(sentence);
}
