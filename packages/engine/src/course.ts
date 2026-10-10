// Course folder plumbing (PLAN §2.4): paths, `--course` resolution, JSON helpers (implemented, WP0),
// plus the `init`, `goal` and `status` commands (stubs; owner WP6, or whoever gets there first).
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { BilimindError } from './contracts.ts';
import type { CoursePathsFn, Init, ResolveCourse, SetGoal, Status } from './contracts.ts';

export const OUT_DIR_NAME = 'bilimind-out';

export const coursePaths: CoursePathsFn = course => {
  const root = resolve(course);
  const crew = join(root, 'crew');
  return {
    root, crew,
    sources: join(root, 'sources'), audio: join(root, 'audio'), img: join(root, 'img'), lessonsMd: join(root, 'lessons'), review: join(root, 'review'),
    courseJson: join(root, 'course.json'), indexHtml: join(root, 'index.html'), planMd: join(root, 'plan.md'), reportMd: join(root, 'REPORT.md'),
    reviewsIcs: join(root, 'reviews.ics'), deckCsv: join(root, 'deck.csv'),
    reviewState: join(root, 'review', 'state.json'), reviewHistory: join(root, 'review', 'history.jsonl'), reviewOutbox: join(root, 'review', 'outbox.json'),
    goal: join(crew, 'goal.json'), ingest: join(crew, 'ingest.json'), outline: join(crew, 'outline.json'),
    examMap: join(crew, 'exam-map.json'), examMapMd: join(crew, 'exam-map.md'), plan: join(crew, 'plan.json'),
    log: join(crew, 'log.jsonl'), cache: join(crew, 'cache'), narrationJson: join(crew, 'narration.json'),
    lessonJson: key => join(crew, 'lessons', `${key}.json`),
    checksJson: key => join(crew, 'checks', `${key}.json`),
    codeDir: (key, block) => join(crew, 'code', `${key}-b${block}`),
    evidenceMd: key => join(crew, 'evidence', `${key}.md`),
    verdictsJson: key => join(crew, 'verdicts', `${key}.json`),
  };
};

/** `--course` given -> that folder; else the newest folder under <cwd>/bilimind-out/. */
export const resolveCourse: ResolveCourse = (course, cwd) => {
  if (course) {
    const abs = resolve(cwd, course);
    if (!existsSync(abs)) throw new BilimindError(`Course folder not found: ${course}`, 'Run `init` first, or pass --course <folder>.');
    return abs;
  }
  const out = join(cwd, OUT_DIR_NAME);
  const dirs = existsSync(out)
    ? readdirSync(out).map(n => join(out, n)).filter(p => statSync(p).isDirectory()).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
    : [];
  if (!dirs.length) throw new BilimindError(`No course under ${OUT_DIR_NAME}/`, 'Run `init --src <folder> --sentence "<text>"` first.');
  return dirs[0]!;
};

// ---------- JSON helpers (every lane uses these for crew/ files) ----------
export function readJson<T>(path: string): T {
  if (!existsSync(path)) throw new BilimindError(`Missing ${path}`, 'Run the earlier step first (see `status`).');
  return JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, '')) as T;
}
export function readJsonOrNull<T>(path: string): T | null {
  return existsSync(path) ? readJson<T>(path) : null;
}
export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}
export function writeText(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

// ---------- commands (stubs) ----------
export const init: Init = async () => { throw new Error('not implemented: init'); };
export const setGoal: SetGoal = async () => { throw new Error('not implemented: setGoal'); };
export const status: Status = async () => { throw new Error('not implemented: status'); };
