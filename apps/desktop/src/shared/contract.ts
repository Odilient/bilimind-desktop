// The main <-> renderer contract (apps/desktop/CONTRACT.md), as types. Imported by main, preload, worker and renderer.
/** 'bilimind' = BiliMind free (no key, the default on a fresh install); 'deepseek' / 'openrouter' = the user's own key. */
export type ProviderId = 'bilimind' | 'deepseek' | 'openrouter';

export interface Settings {
  provider: ProviderId;
  keys: Record<ProviderId, { set: boolean; last4?: string }>;   // the key itself never reaches the renderer; bilimind is { set: freeTier }
  freeTier: boolean;                                           // BiliMind free offered (FREE_TIER_ON in the engine config)
  narrate: boolean;                                            // Edge TTS narration (free)
  outRoot: string;                                             // default <Documents>/BiliMind
  version: string;
}

export interface SettingsPatch {
  provider?: ProviderId;
  key?: { provider: ProviderId; value: string };
  narrate?: boolean;
  outRoot?: string;
}

export interface FolderFile { name: string; path: string; ext: string; bytes: number; role: 'lecture' | 'past_paper' | 'sop' | 'notes' | 'other' }

export interface CourseCard {
  id: string;                 // absolute course folder path
  title: string; sentence: string; createdAt: string;   // ISO
  status: 'ready' | 'building' | 'failed';
  lessons: number; minutes?: number;                     // narration minutes if known
  checks?: { passed: number; total: number };
  rejected?: number; codeTests?: { passed: number; total: number };
  costUsd?: number; wallMs?: number;
}

export type RunEvent =
  | { runId: string; type: 'started'; course: string }
  | { runId: string; type: 'step-start'; agent: string; cmd: string; lesson?: string }
  | { runId: string; type: 'step-end'; agent: string; cmd: string; lesson?: string; ok: boolean; ms: number; costUsd: number; result?: string; error?: string }
  | { runId: string; type: 'line'; text: string }
  | { runId: string; type: 'plan'; keep: { key: string; title: string; day?: number }[]; cut: { key: string; title: string; reason: string }[] }
  | { runId: string; type: 'done'; course: string; card: CourseCard }
  | { runId: string; type: 'error'; message: string };

/** One lesson as the course workspace lists it (from <course>/course.json). route = the player's hash route, e.g. '#/l/<id>'. */
export interface OutlineLesson { id: string; title: string; day?: number; minutes?: number; route: string }
export interface CourseOutline {
  id: string; title: string; sentence: string;
  lessons: OutlineLesson[];
  sources: { name: string; rel: string; bytes: number }[];     // the learner's files in <course>/sources (rel to the course folder)
}
export type AssistantScope = 'lesson' | 'course' | 'files';
export interface AssistantAsk {
  courseId: string; lessonId?: string | null; scope: AssistantScope; question: string;
  history: { role: 'user' | 'assistant'; text: string }[];
}
export interface AssistantCite { n: number; file: string; locator?: string; quote: string }
export type AssistantEvent =
  | { askId: string; type: 'delta'; text: string }
  | { askId: string; type: 'done'; text: string; cites: AssistantCite[]; costUsd: number; model: string }
  | { askId: string; type: 'error'; message: string };

export interface BilimindApi {
  settings: {
    get(): Promise<Settings>;
    save(p: SettingsPatch): Promise<Settings>;
    testKey(provider: ProviderId): Promise<{ ok: boolean; balance?: string; note?: string; error?: string }>;
  };
  pickFolder(): Promise<string | null>;
  /** File dialog (multi-select): copies the chosen files into a fresh staging folder and returns that folder. */
  pickFiles(): Promise<string | null>;
  inspectFolder(path: string): Promise<{ path: string; files: FolderFile[] }>;
  courses: {
    outline(id: string): Promise<CourseOutline>;
    list(): Promise<CourseCard[]>;
    get(id: string): Promise<CourseCard | null>;
    playerUrl(id: string): Promise<string>;
    reveal(id: string): Promise<void>;
    openFile(id: string, rel: 'plan.md' | 'REPORT.md' | 'deck.csv' | 'reviews.ics' | string): Promise<void>;
    remove(id: string): Promise<void>;
  };
  run: {
    start(o: { src: string; sentence: string }): Promise<{ runId: string }>;
    cancel(runId: string): Promise<void>;
    onEvent(cb: (e: RunEvent) => void): () => void;
  };
  assistant: {
    ask(o: AssistantAsk): Promise<{ askId: string }>;
    cancel(askId: string): Promise<void>;
    onEvent(cb: (e: AssistantEvent) => void): () => void;
  };
  openExternal(url: string): Promise<void>;
  platform: string;
}

/** IPC channel names (preload <-> main). */
export const IPC = {
  settingsGet: 'bm:settings:get',
  settingsSave: 'bm:settings:save',
  settingsTestKey: 'bm:settings:testKey',
  pickFolder: 'bm:pickFolder',
  pickFiles: 'bm:pickFiles',
  inspectFolder: 'bm:inspectFolder',
  coursesOutline: 'bm:courses:outline',
  assistantAsk: 'bm:assistant:ask',
  assistantCancel: 'bm:assistant:cancel',
  assistantEvent: 'bm:assistant:event',
  coursesList: 'bm:courses:list',
  coursesGet: 'bm:courses:get',
  coursesPlayerUrl: 'bm:courses:playerUrl',
  coursesReveal: 'bm:courses:reveal',
  coursesOpenFile: 'bm:courses:openFile',
  coursesRemove: 'bm:courses:remove',
  runStart: 'bm:run:start',
  runCancel: 'bm:run:cancel',
  runEvent: 'bm:run:event',
  openExternal: 'bm:openExternal',
  dropped: 'bm:dropped',            // preload -> main: paths of the files/folders dropped on the page (see preload)
} as const;

/** Messages between main and the run worker (utilityProcess). */
export interface WorkerStart { type: 'start'; runId: string; src: string; sentence: string; outRoot: string; template?: string; narrate: boolean }
export type WorkerMsg = RunEvent;
