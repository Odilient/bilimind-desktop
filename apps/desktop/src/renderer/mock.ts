// Browser mock of window.bilimind (installed only when the Electron preload is missing: vite dev / preview,
// screenshots). The data is real: mock/data.json is generated from the three showcase courses by
// mock/gen-mock-data.mjs. A run replays the first unattended pass of the matching showcase run with its real
// step order, parallelism, durations and costs; long waits are compressed (gap^0.6) so the replay lasts ~22 s.
// URL switches: ?nokey (no AI key saved), ?empty (no courses yet), ?free (BiliMind free on), ?replay=<seconds> (replay length).
import type { AssistantCite, AssistantEvent, BiliMindApi, CourseCard, CourseOutline, FolderFile, RunEvent, Settings } from './env';
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
    keys: { bilimind: { set: q.has('free') }, deepseek: q.has('nokey') ? { set: false } : { set: true, last4: '7f3a' }, openrouter: { set: false } },
    freeTier: q.has('free'),
    narrate: true,
    outRoot: 'C:\\Users\\you\\Documents\\BiliMind',
    version: '0.2.1',
  };
  const built: CourseCard[] = [];
  const listeners = new Set<(e: RunEvent) => void>();
  const emit = (e: RunEvent) => listeners.forEach((cb) => cb(e));
  let timers: number[] = [];
  let lastPicked = COURSES[0];
  const askListeners = new Set<(e: AssistantEvent) => void>();
  const emitAsk = (e: AssistantEvent) => askListeners.forEach((cb) => cb(e));
  let asks: number[] = [];

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
    async pickFiles() { return null; },
    async inspectFolder(path) {
      const c = mockCourseFor(path);
      return { path, files: c.files.map(({ pages: _p, ...f }) => f) };
    },
    courses: {
      async outline(id) {
        const c = COURSES.find((x) => id === x.card.id || id.startsWith(`${x.card.id}-`)) ?? mockCourseFor(id);
        const out: CourseOutline = {
          id, title: c.card.title, sentence: c.sentence,
          lessons: [...c.plan.keep].sort((a, b) => (a.day ?? 99) - (b.day ?? 99))
            .map((k) => ({ id: k.key, title: k.title, day: k.day, route: `#/l/${encodeURIComponent(k.key)}` })),
          sources: c.files.map((f) => ({ name: f.name, rel: `sources/${f.name}`, bytes: f.bytes })),
        };
        return out;
      },
      async list() { return q.has('empty') ? [...built] : [...built, ...COURSES.map((c) => c.card)]; },
      async get(id) { return [...built, ...COURSES.map((c) => c.card)].find((c) => c.id === id) ?? null; },
      async playerUrl(id) {
        const slug = id.split(/[\\/]/).pop()!.replace(/-\d+$/, '');
        // Served from the repo root (screenshots): apps/desktop/dist/renderer/index.html -> showcase/courses/<id>.
        // A copy that lives elsewhere (the pitch deck's app/) names the showcase folder in window.__BM_SHOWCASE.
        const base = (window as unknown as { __BM_SHOWCASE?: string }).__BM_SHOWCASE
          ?? new URL('../../../../showcase/courses/', location.href).href;
        return new URL(`${slug}/index.html`, base).href;
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
    assistant: {
      async ask(o) {
        const askId = `ask-${Date.now()}`;
        const c = COURSES.find((x) => o.courseId === x.card.id || o.courseId.startsWith(`${x.card.id}-`)) ?? COURSES[0];
        const { text, cites } = cannedAnswer(c, o.lessonId ?? '');
        const words = text.split(/(?<=\s)/);
        let at = 500;
        for (let i = 0; i < words.length; i += 3) {
          const chunk = words.slice(i, i + 3).join('');
          asks.push(window.setTimeout(() => emitAsk({ askId, type: 'delta', text: chunk }), (at += 40)));
        }
        // cost and model of the real recorded ask in showcase/courses/ds-final/crew/assistant.jsonl
        asks.push(window.setTimeout(() => emitAsk({ askId, type: 'done', text, cites, costUsd: 0.000545, model: 'deepseek-flash' }), at + 200));
        return { askId };
      },
      async cancel() { asks.forEach(clearTimeout); asks = []; },
      onEvent(cb) { askListeners.add(cb); return () => askListeners.delete(cb); },
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

/** A canned, grounded answer for the mock assistant: claims pointing at the course's files, keyed loosely on the
 *  open lesson. The Data Structures answers quote the showcase sources word for word (slide numbers as printed);
 *  the hash-table one follows the real recorded ask in showcase/courses/ds-final/crew/assistant.jsonl. */
function cannedAnswer(c: MockCourse, lessonId: string): { text: string; cites: AssistantCite[] } {
  if (c.example === 'exam' && /heap|priority/.test(lessonId)) {
    return {
      text: 'A binary heap is a complete binary tree where every parent is ≤ its children, so the minimum sits at the root [1].\n\n'
        + 'Because the shape leaves no gaps, it lives in an array with no pointers:\n- left child of i: `2i + 1`\n- right child of i: `2i + 2`\n- parent of i: `(i - 1) / 2`, rounded down\n\n'
        + "Last year's paper asked for exactly these three formulas [2].",
      cites: [
        { n: 1, file: 'sources/CSC2103-L04-binary-heaps.pdf', locator: 'Slide 4', quote: 'min-heap: every parent ≤ its children, so the minimum is at the root' },
        { n: 2, file: 'sources/past-paper.pdf', locator: 'Question 3 (b)', quote: 'A binary heap is stored in an array starting at index 0. Give the index of the parent, the left child and the right child of the node at index i.' },
      ],
    };
  }
  if (c.example === 'exam' && /search_tree|bst/.test(lessonId)) {
    return {
      text: 'Every node splits the keys: smaller ones go left, larger ones go right [1].\n\n'
        + 'So a search drops one level per step and costs O(h), where h is the height of the tree. A balanced tree keeps h near log n; a tree built from sorted keys is a list, and h becomes n [2].',
      cites: [
        { n: 1, file: 'sources/CSC2103-L03-bst-and-avl-trees.pdf', locator: 'Slide 4', quote: 'For every node: all keys in the left subtree are smaller, all keys in the right subtree are larger' },
        { n: 2, file: 'sources/CSC2103-L03-bst-and-avl-trees.pdf', locator: 'Slide 5', quote: 'Each step goes one level down: cost is O(h), h = height' },
      ],
    };
  }
  if (c.example === 'exam') {
    return {
      text: 'The diagram is one key going through one hash function, with three possible landings.\n\n'
        + '- **Start:** key `k` goes into `h(k) = k mod m`, which gives a bucket index [1].\n'
        + '- **Bucket empty:** not found. Constant time.\n'
        + '- **One matching entry:** the value comes back. Constant time, the O(1) average.\n'
        + '- **Several entries:** search walks the chain. If all n keys land in one bucket, it is O(n) [2].\n\n'
        + 'So the same function gives O(1) or O(n). The average case depends on how evenly the keys spread.',
      cites: [
        { n: 1, file: 'sources/CSC2103-L02-hash-tables.pdf', locator: 'Slide 4', quote: 'A hash function turns a key into an index: index = hash(key) mod m' },
        { n: 2, file: 'sources/CSC2103-L02-hash-tables.pdf', locator: 'Slide 8', quote: 'Worst case: every key lands in one chain, so search is O(n)' },
      ],
    };
  }
  const [a, b] = [c.files[0]?.name ?? 'notes.pdf', c.files[1]?.name ?? c.files[0]?.name ?? 'notes.pdf'];
  return {
    text: 'The short version, from your own files: start with the step your files repeat most, then practise it once out loud [1].\n\n'
      + 'The second file adds the detail people miss on day one, so read that part twice [2].',
    cites: [
      { n: 1, file: `sources/${a}`, locator: 'p. 1', quote: 'The first thing to get right, every time.' },
      { n: 2, file: `sources/${b}`, locator: 'p. 2', quote: 'The detail that is easy to miss on the first day.' },
    ],
  };
}

/** In mock mode, make the next "pick a folder" return the showcase folder that matches this example. */
export function mockPrimeExample(sentence: string): void {
  const api = window.bilimind as unknown as { __pick?: (s: string) => void };
  api.__pick?.(sentence);
}
