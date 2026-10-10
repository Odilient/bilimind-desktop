/// <reference types="vite/client" />
// window.bilimind, exactly as typed in apps/desktop/CONTRACT.md (the preload exposes it via contextBridge).

export type ProviderId = 'deepseek' | 'openrouter';

export interface Settings {
  provider: ProviderId;
  keys: Record<ProviderId, { set: boolean; last4?: string }>;
  narrate: boolean;
  outRoot: string;
  version: string;
}

export interface FolderFile {
  name: string;
  path: string;
  ext: string;
  bytes: number;
  role: 'lecture' | 'past_paper' | 'sop' | 'notes' | 'other';
}

export interface CourseCard {
  id: string;
  title: string;
  sentence: string;
  createdAt: string;
  status: 'ready' | 'building' | 'failed';
  lessons: number;
  minutes?: number;
  checks?: { passed: number; total: number };
  rejected?: number;
  codeTests?: { passed: number; total: number };
  costUsd?: number;
  wallMs?: number;
}

export type RunEvent =
  | { runId: string; type: 'started'; course: string }
  | { runId: string; type: 'step-start'; agent: string; cmd: string; lesson?: string }
  | { runId: string; type: 'step-end'; agent: string; cmd: string; lesson?: string; ok: boolean; ms: number; costUsd: number; result?: string; error?: string }
  | { runId: string; type: 'line'; text: string }
  | { runId: string; type: 'plan'; keep: { key: string; title: string; day?: number }[]; cut: { key: string; title: string; reason: string }[] }
  | { runId: string; type: 'done'; course: string; card: CourseCard }
  | { runId: string; type: 'error'; message: string };

export interface BiliMindApi {
  settings: {
    get(): Promise<Settings>;
    save(p: { provider?: ProviderId; key?: { provider: ProviderId; value: string }; narrate?: boolean; outRoot?: string }): Promise<Settings>;
    testKey(provider: ProviderId): Promise<{ ok: boolean; balance?: string; error?: string }>;
  };
  pickFolder(): Promise<string | null>;
  inspectFolder(path: string): Promise<{ path: string; files: FolderFile[] }>;
  courses: {
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
  openExternal(url: string): Promise<void>;
  platform: string;
}

declare global {
  interface Window {
    bilimind: BiliMindApi;
    /** Set by mock.ts when it installs the browser mock (no Electron preload). */
    __bilimindMock?: boolean;
  }
}
