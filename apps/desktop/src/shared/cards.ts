// CourseCard from a course folder (main and worker). Cheap: course.json (its receipts carry the numbers), with
// crew/goal.json, crew/plan.json and crew/log.jsonl as fallbacks for courses that are still building or failed.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { CourseCard } from './contract.ts';

function readJson<T>(p: string): T | null {
  try { return JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, '')) as T; } catch { return null; }
}

interface Receipts {
  checks?: { run?: number; passed?: number };
  tests?: { run?: number; passed?: number };
  rejected?: number; narration_min?: number; cost_usd?: number; wall_ms?: number; lessons?: number;
}
interface CourseJson {
  title?: string; built_at?: string;
  goal?: { sentence?: string };
  lessons?: unknown[];
  receipts?: Receipts;
}

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** Title for a course that has no course.json yet: the sentence's first clause, else the folder name. */
export function titleFromSentence(sentence: string, folder: string): string {
  const s = sentence.trim().split(/(?<=[.!?])\s/)[0] ?? '';
  const t = s.length > 70 ? `${s.slice(0, 67).trimEnd()}...` : s;
  return t || folder.replace(/[-_]+/g, ' ');
}

/** Sum of cost_usd and wall time from crew/log.jsonl (used while a course has no receipts). */
function logTotals(logPath: string): { costUsd: number; first?: string; last?: string } {
  let costUsd = 0; let first: string | undefined; let last: string | undefined;
  try {
    for (const line of readFileSync(logPath, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line) as { ts?: string; cost_usd?: number };
        costUsd += Number(e.cost_usd) || 0;
        if (e.ts) { first ??= e.ts; last = e.ts; }
      } catch { /* partial line */ }
    }
  } catch { /* no log */ }
  return { costUsd: Math.round(costUsd * 1e6) / 1e6, first, last };
}

/**
 * Card for a course folder, or null when the folder is not a course.
 * `status` overrides the status read from disk (the main process knows which runs are still going).
 */
export function readCard(dir: string, status?: CourseCard['status']): CourseCard | null {
  const courseJson = join(dir, 'course.json');
  const goalJson = join(dir, 'crew', 'goal.json');
  const hasCourse = existsSync(courseJson);
  if (!hasCourse && !existsSync(goalJson)) return null;
  const goal = readJson<{ sentence?: string; created_at?: string; goal?: { sentence?: string } }>(goalJson);
  const sentence = goal?.sentence ?? goal?.goal?.sentence ?? '';
  let mtime: string;
  try { mtime = statSync(dir).mtime.toISOString(); } catch { mtime = new Date().toISOString(); }

  if (hasCourse && status !== 'building') {
    const c = readJson<CourseJson>(courseJson);
    if (c) {
      const r = c.receipts ?? {};
      const card: CourseCard = {
        id: dir,
        title: c.title || titleFromSentence(c.goal?.sentence ?? sentence, basename(dir)),
        sentence: c.goal?.sentence ?? sentence,
        createdAt: goal?.created_at ?? c.built_at ?? mtime,
        status: status ?? 'ready',
        lessons: Array.isArray(c.lessons) ? c.lessons.length : num(r.lessons) ?? 0,
      };
      if (num(r.narration_min)) card.minutes = num(r.narration_min);
      if (r.checks && num(r.checks.run)) card.checks = { passed: num(r.checks.passed) ?? 0, total: num(r.checks.run)! };
      if (num(r.rejected) !== undefined) card.rejected = num(r.rejected);
      if (r.tests && num(r.tests.run)) card.codeTests = { passed: num(r.tests.passed) ?? 0, total: num(r.tests.run)! };
      if (num(r.cost_usd) !== undefined) card.costUsd = num(r.cost_usd);
      if (num(r.wall_ms) !== undefined) card.wallMs = num(r.wall_ms);
      return card;
    }
  }

  const plan = readJson<{ lessons?: unknown[] }>(join(dir, 'crew', 'plan.json'));
  const t = logTotals(join(dir, 'crew', 'log.jsonl'));
  const card: CourseCard = {
    id: dir,
    title: titleFromSentence(sentence, basename(dir)),
    sentence,
    createdAt: goal?.created_at ?? t.first ?? mtime,
    status: status ?? (hasCourse ? 'ready' : 'failed'),
    lessons: Array.isArray(plan?.lessons) ? plan!.lessons!.length : 0,
    costUsd: t.costUsd,
  };
  if (t.first && t.last) card.wallMs = Math.max(0, Date.parse(t.last) - Date.parse(t.first));
  return card;
}
