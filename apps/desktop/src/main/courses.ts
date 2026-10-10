// Courses list, folder inspection and the course-folder actions (reveal, open a file, move to trash).
import { shell } from 'electron';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { listSourceFiles } from '@bilimind/engine/course';
import { roleScores } from '@bilimind/engine/ingest/roles';
import type { CourseCard, FolderFile } from '../shared/contract.ts';
import { readCard } from '../shared/cards.ts';
import { getSettings } from './settings.ts';

/** Folders of runs this app session started, with their live status (building until done/error). */
export const liveRuns = new Map<string, CourseCard['status']>();

function examplesRoot(): string | null {
  const d = process.env.BILIMIND_EXAMPLES;
  return d && existsSync(d) ? resolve(d) : null;
}

const norm = (p: string) => resolve(p).toLowerCase();

function subdirs(root: string): string[] {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
      .map(d => join(root, d.name));
  } catch { return []; }
}

function liveStatus(dir: string): CourseCard['status'] | undefined {
  for (const [k, v] of liveRuns) if (norm(k) === norm(dir)) return v;
  return undefined;
}

export function listCourses(): CourseCard[] {
  const cards: CourseCard[] = [];
  const seen = new Set<string>();
  const add = (dir: string, onlyReady: boolean) => {
    const key = norm(dir);
    if (seen.has(key)) return;
    const live = liveStatus(dir);
    if (onlyReady && !live && !existsSync(join(dir, 'course.json'))) return;
    const card = readCard(dir, live);
    if (card) { seen.add(key); cards.push(card); }
  };
  for (const dir of subdirs(getSettings().outRoot)) add(dir, false);
  for (const dir of liveRuns.keys()) add(resolve(dir), false);
  const ex = examplesRoot();
  if (ex) for (const dir of subdirs(ex)) add(dir, true);
  return cards.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}

/** A course id from the renderer must be a course folder under the output folder or the examples folder. */
export function checkCourseId(id: unknown): string {
  if (typeof id !== 'string' || !id || !isAbsolute(id)) throw new Error('Unknown course.');
  const dir = resolve(id);
  const roots = [getSettings().outRoot, examplesRoot()].filter((r): r is string => !!r).map(norm);
  const known = roots.includes(norm(dirname(dir))) || liveStatus(dir) !== undefined;
  if (!known || !(existsSync(join(dir, 'course.json')) || existsSync(join(dir, 'crew')))) throw new Error('Unknown course.');
  return dir;
}

export function getCourse(id: string): CourseCard | null {
  let dir: string;
  try { dir = checkCourseId(id); } catch { return null; }
  return readCard(dir, liveStatus(dir));
}

export function playerUrl(id: string): string {
  const dir = checkCourseId(id);
  return pathToFileURL(join(dir, 'index.html')).href;
}

export async function reveal(id: string): Promise<void> {
  const dir = checkCourseId(id);
  const index = join(dir, 'index.html');
  if (existsSync(index)) shell.showItemInFolder(index);
  else await shell.openPath(dir);
}

export async function openFile(id: string, rel: string): Promise<void> {
  const dir = checkCourseId(id);
  const target = resolve(dir, String(rel ?? ''));
  const r = relative(dir, target);
  if (!r || r.startsWith('..') || isAbsolute(r)) throw new Error('That file is not in this course.');
  if (!existsSync(target)) throw new Error(`${basename(target)} is not in this course yet.`);
  const err = await shell.openPath(target);
  if (err) throw new Error(err);
}

export async function removeCourse(id: string): Promise<void> {
  const dir = checkCourseId(id);
  const ex = examplesRoot();
  if (ex && norm(dirname(dir)) === norm(ex)) throw new Error('Example courses cannot be removed.');
  if (liveStatus(dir) === 'building') throw new Error('Stop the run before removing this course.');
  await shell.trashItem(dir);
  for (const k of [...liveRuns.keys()]) if (norm(k) === norm(dir)) liveRuns.delete(k);
}

// ---------- the folder a learner drops in ----------
const TEXT_EXTS = new Set(['.md', '.markdown', '.txt']);

function guessRole(name: string, ext: string, abs: string): FolderFile['role'] {
  let text = '';
  if (TEXT_EXTS.has(ext)) { try { text = readFileSync(abs, 'utf8').slice(0, 20_000); } catch { /* unreadable */ } }
  const s = roleScores(name, text);
  if (s.past_paper >= 4 && s.past_paper >= s.lecture && s.past_paper >= s.sop) return 'past_paper';
  if (s.sop >= 5 && s.sop >= s.lecture) return 'sop';
  if (TEXT_EXTS.has(ext) || /notes?\b/i.test(name)) return 'notes';
  if (['.pdf', '.pptx', '.docx', '.html', '.htm'].includes(ext)) return 'lecture';
  return 'other';
}

export function inspectFolder(path: string): { path: string; files: FolderFile[] } {
  if (typeof path !== 'string' || !path) throw new Error('Pick a folder first.');
  const dir = resolve(path);
  let st;
  try { st = statSync(dir); } catch { throw new Error('That folder does not exist.'); }
  if (!st.isDirectory()) throw new Error('That is a file, not a folder.');
  const files = listSourceFiles(dir).slice(0, 200).map(abs => {
    const ext = extname(abs).toLowerCase();
    let bytes = 0;
    try { bytes = statSync(abs).size; } catch { /* gone */ }
    const name = basename(abs);
    return { name, path: abs, ext, bytes, role: guessRole(name, ext, abs) };
  });
  return { path: dir, files };
}
