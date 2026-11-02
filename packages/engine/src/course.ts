// Course folder plumbing (PLAN §2.4): paths, `--course` resolution, JSON helpers (implemented, WP0),
// plus the `init`, `goal` and `status` commands (stubs; owner WP6, or whoever gets there first).
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import type { CodeLanguage, Goal } from '@bilimind/core';
import { BilimindError } from './contracts.ts';
import type { CoursePathsFn, Init, ResolveCourse, SetGoal, Status, StatusData } from './contracts.ts';
import { defaultTimeZone } from './export/time.ts';

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

// ---------- commands: init, goal, status (WP6) ----------

/** File types ingest can read. Anything else in the source folder is left out of sources/. */
export const SOURCE_EXTS = new Set(['.pdf', '.pptx', '.docx', '.md', '.markdown', '.txt', '.html', '.htm']);
/** Never course material: licence/status notes that sit next to the real files (they would be cited otherwise). */
export const SKIP_FILE = /^(licen[cs]e[^\\/]*\.(md|txt)|status\.md|~\$.*|\..*|thumbs\.db|desktop\.ini)$/i;
const SKIP_DIR = new Set(['node_modules', '.git', OUT_DIR_NAME, 'crew', '.codebuddy', '.workbuddy', '.vscode', '__pycache__']);

export const slugify = (s: string): string =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/, '');

/** Absolute path with forward slashes: works as `--course` in Git Bash and PowerShell alike. */
export const portablePath = (p: string): string => resolve(p).replace(/\\/g, '/');

/** Source files under `src` (depth <= 4), skipping LICENSE*.md, STATUS.md, dotfiles, Office lock files and bilimind-out/. */
export function listSourceFiles(src: string, depth = 4): string[] {
  const out: string[] = [];
  const walk = (dir: string, d: number) => {
    let names: string[];
    try { names = readdirSync(dir).sort(); } catch { return; }
    for (const name of names) {
      const abs = join(dir, name);
      let st;
      try { st = statSync(abs); } catch { continue; }
      if (st.isDirectory()) { if (d < depth && !SKIP_DIR.has(name) && !name.startsWith('.')) walk(abs, d + 1); continue; }
      if (SKIP_FILE.test(name)) continue;
      if (SOURCE_EXTS.has(extname(name).toLowerCase())) out.push(abs);
    }
  };
  walk(resolve(src), 0);
  return out;
}

export const init: Init = async (opts, now = new Date()) => {
  const src = resolve(opts.src || '.');
  if (!existsSync(src) || !statSync(src).isDirectory())
    throw new BilimindError(`Source folder not found: ${opts.src}`, 'Pass --src <folder> with the slides and notes (default: the current folder).');
  const sentence = (opts.sentence ?? '').trim();
  if (!sentence) throw new BilimindError('The sentence is empty.', 'Pass the user\'s request verbatim with --sentence "<text>".');
  const outRoot = resolve(opts.outRoot ?? join(process.cwd(), OUT_DIR_NAME));
  const files = listSourceFiles(src).filter(f => !resolve(f).startsWith(outRoot + sep));
  if (!files.length)
    throw new BilimindError(`No readable files in ${src}`, 'Put PDF, PPTX, DOCX, Markdown or TXT files in the folder (LICENSE*.md and STATUS.md are skipped).');
  if (files.length > 80)
    throw new BilimindError(`Too many files under ${src} (${files.length})`, 'Point --src at the one folder that holds this course\'s slides, notes and past papers.');

  const base = slugify(opts.slug ?? '') || slugify(basename(src)) || 'course';
  let slug = base;
  for (let i = 2; existsSync(join(outRoot, slug)); i++) slug = `${base}-${i}`;
  const course = join(outRoot, slug);
  const p = coursePaths(course);
  for (const d of [p.sources, p.crew, join(p.crew, 'lessons')]) mkdirSync(d, { recursive: true });

  const used = new Set<string>();
  for (const f of files) {
    let name = basename(f);
    if (used.has(name.toLowerCase())) {
      const rel = relative(src, dirname(f)).split(sep).filter(Boolean).join('-');
      name = `${slugify(rel) || 'dup'}-${name}`;
      for (let i = 2; used.has(name.toLowerCase()); i++) name = `${i}-${basename(f)}`;
    }
    used.add(name.toLowerCase());
    copyFileSync(f, join(p.sources, name));
  }
  writeJson(p.goal, { sentence, created_at: now.toISOString() });
  return { course: portablePath(course) };
};

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const CODE_LANG: Record<string, CodeLanguage | null> = {
  js: 'javascript', javascript: 'javascript', node: 'javascript', ts: 'javascript', typescript: 'javascript',
  py: 'python', python: 'python', sql: 'sql', html: 'html', none: null, no: null, off: null, '': null,
};

/** Offset for a zone on a date (Intl longOffset); falls back to UTC. */
export function zoneOffset(timeZone: string, isoDate: string, time = '12:00'): string {
  try {
    const d = new Date(`${isoDate}T${time}:00Z`);
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(d).find(x => x.type === 'timeZoneName');
    const m = part?.value.match(/GMT([+-]\d{2}):?(\d{2})?/);
    if (m) return `${m[1]}:${m[2] ?? '00'}`;
    if (part?.value === 'GMT') return '+00:00';
  } catch { /* unknown zone */ }
  return '+00:00';
}

/** Today's date (YYYY-MM-DD) in a time zone. */
export function todayIn(timeZone: string, now: Date): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch { return now.toISOString().slice(0, 10); }
}

export const setGoal: SetGoal = async (ctx, input) => {
  const p = coursePaths(ctx.course);
  const prev = readJsonOrNull<Partial<Goal>>(p.goal) ?? {};
  const timezone = input.timezone || prev.timezone || defaultTimeZone();
  const assumptions = [...(prev.assumptions ?? [])];
  const assume = (s: string) => { if (s.trim() && !assumptions.includes(s.trim())) assumptions.push(s.trim()); };

  const minutes = Number(input.minutesPerDay);
  if (!Number.isFinite(minutes) || minutes < 5 || minutes > 720)
    throw new BilimindError(`--minutes-per-day must be 5-720, got ${input.minutesPerDay}`, 'Read the daily time from the sentence; if none, assume 45 and record it with --assume.');
  if (input.audience !== 'student' && input.audience !== 'staff')
    throw new BilimindError(`--audience must be student or staff, got ${input.audience}`, 'Use --audience student (exam prep) or --audience staff (workplace onboarding).');
  const cl = String(input.codeLang ?? 'none').trim().toLowerCase();
  if (!(cl in CODE_LANG)) throw new BilimindError(`Unknown --code-lang ${input.codeLang}`, 'Use --code-lang js (stage default) or none.');
  const language = (input.lang || 'en').trim();
  if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(language)) throw new BilimindError(`--lang must be a language code like en or ms, got ${input.lang}`, 'Use --lang en.');

  let deadline: string | null = null;
  let examTime: string | null = null;
  if (input.deadline) {
    const m = String(input.deadline).trim().match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{1,2}:\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/);
    if (!m || Number.isNaN(Date.parse(`${m[1]}T00:00:00Z`)))
      throw new BilimindError(`--deadline is not an ISO date: ${input.deadline}`, 'Use --deadline 2026-10-14 (and --exam-time 09:00), in the user\'s time zone.');
    deadline = m[1]!;
    if (m[2]) examTime = m[2].padStart(5, '0');
  }
  if (input.examTime) {
    const t = String(input.examTime).trim();
    if (!HHMM.test(t)) throw new BilimindError(`--exam-time must be HH:MM (24 h), got ${input.examTime}`, 'For "9am" pass --exam-time 09:00.');
    examTime = t.padStart(5, '0');
  }
  let examAt: string | null = null;
  if (deadline) {
    if (!examTime) { examTime = '09:00'; assume('No exam time given: assumed 09:00.'); }
    examAt = `${deadline}T${examTime}:00${zoneOffset(timezone, deadline, examTime)}`;
    if (Date.parse(examAt) < ctx.now().getTime()) ctx.progress(`warning: the deadline ${examAt} is in the past by this PC's clock`);
  } else {
    assume('No deadline given: the plan uses a 7-day window.');
  }
  for (const a of input.assume ?? []) assume(a);

  const goal: Goal = {
    sentence: prev.sentence ?? '',
    ...(prev.topic ? { topic: prev.topic } : {}),
    ...(prev.title ? { title: prev.title } : {}),
    deadline,
    exam_time: deadline ? examTime : null,
    exam_at: examAt,
    timezone,
    minutes_per_day: Math.round(minutes),
    audience: input.audience,
    language,
    code_language: CODE_LANG[cl] ?? null,
    assumptions,
    created_at: ctx.now().toISOString(),
  };
  writeJson(p.goal, goal);
  return { goal };
};

const STAGE_ORDER = ['init', 'goal', 'ingest', 'outline', 'exam_map', 'plan', 'narrate', 'export', 'build'] as const;
const NEXT_HINT: Record<typeof STAGE_ORDER[number], string> = {
  init: 'init --src <folder> --sentence "<text>"',
  goal: 'goal --deadline <date> --exam-time HH:MM --minutes-per-day N --audience student --lang en --code-lang js',
  ingest: 'ingest', outline: 'outline', exam_map: 'exam-map (only when a past paper exists)', plan: 'plan --keep k1,k2,...',
  narrate: 'narrate', export: 'export', build: 'build',
};

export const status: Status = async ctx => {
  const p = coursePaths(ctx.course);
  const goal = readJsonOrNull<Partial<Goal>>(p.goal);
  const has = (f: string) => existsSync(f);
  const nonEmptyDir = (d: string) => { try { return readdirSync(d).length > 0; } catch { return false; } };
  const stages = {
    init: has(p.goal) || nonEmptyDir(p.sources) ? 'done' : 'todo',
    goal: goal && typeof goal.minutes_per_day === 'number' ? 'done' : 'todo',
    ingest: has(p.ingest) ? 'done' : 'todo',
    outline: has(p.outline) ? 'done' : 'todo',
    exam_map: has(p.examMap) ? 'done' : 'todo',
    plan: has(p.plan) ? 'done' : 'todo',
    narrate: has(p.narrationJson) ? 'done' : 'todo',
    export: has(p.reportMd) || has(p.reviewsIcs) ? 'done' : 'todo',
    build: has(p.indexHtml) ? 'done' : 'todo',
  } as const;

  let keys: string[] = [];
  try {
    const plan = readJsonOrNull<{ lessons?: { key: string }[] }>(p.plan);
    const outline = plan ? null : readJsonOrNull<{ lessons?: { key: string }[] }>(p.outline);
    keys = (plan?.lessons ?? outline?.lessons ?? []).map(l => l.key);
  } catch { /* unreadable json: fall back to the drafts on disk */ }
  const lessonDir = join(p.crew, 'lessons');
  if (existsSync(lessonDir)) for (const f of readdirSync(lessonDir)) if (f.endsWith('.json') && !keys.includes(f.slice(0, -5))) keys.push(f.slice(0, -5));
  const lessons: Record<string, 'todo' | 'drafted' | 'checked' | 'verified'> = {};
  for (const k of keys) {
    let verified = false;
    try { verified = (readJsonOrNull<unknown[]>(p.verdictsJson(k)) ?? []).length > 0; } catch { /* ignore */ }
    lessons[k] = verified ? 'verified' : has(p.checksJson(k)) ? 'checked' : has(p.lessonJson(k)) ? 'drafted' : 'todo';
  }
  const firstTodo = STAGE_ORDER.find(s => stages[s] === 'todo' && s !== 'exam_map');
  const draftsLeft = Object.entries(lessons).filter(([, v]) => v === 'todo').map(([k]) => k);
  const next = firstTodo && STAGE_ORDER.indexOf(firstTodo) <= STAGE_ORDER.indexOf('plan')
    ? NEXT_HINT[firstTodo]
    : draftsLeft.length ? `draft --lesson ${draftsLeft[0]} (todo: ${draftsLeft.join(', ')})`
    : firstTodo ? NEXT_HINT[firstTodo] : 'done: open index.html';
  const data: StatusData & { next: string } = { stages, lessons, next };
  return data;
};
