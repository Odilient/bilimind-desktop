// Dropped or picked files. Loose files are copied into a fresh staging folder so a run reads exactly what the
// learner gave it, never the rest of the folder they came from. A single dropped folder is used as it is.
//
// Staging lives in <temp>/bilimind-inbox/<yyyymmdd-hhmmss>/<name from the first file>/, never under the output
// folder: the engine leaves files inside outRoot out of a run, and the courses list would show it. The inner folder
// name becomes the course folder name (engine init slugifies basename(src)). A run copies the files into
// <course>/sources at once, so staging folders older than a day are cleared on the next staging.
import { app, dialog, type BrowserWindow, type OpenDialogOptions } from 'electron';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { SKIP_FILE, SOURCE_EXTS, listSourceFiles } from '@bilimind/engine/course';
import { getSettings, userDir } from './settings.ts';

/** Staging folder name; the renderer (words.ts isStaged) looks for it to show "3 files" instead of a temp path. */
export const INBOX_DIR = 'bilimind-inbox';
const DROP_TTL_MS = 5_000;
const KEEP_MS = 24 * 3600_000;

let dropped: { paths: string[]; at: number } | null = null;

/** The preload sends every path dropped on the window (string[]; a single string is tolerated). */
export function rememberDrop(paths: unknown): void {
  const list = (Array.isArray(paths) ? paths : [paths]).filter((p): p is string => typeof p === 'string' && p.trim() !== '');
  dropped = list.length ? { paths: list, at: Date.now() } : null;
}

/** A drop from the last few seconds, consumed: one folder as it is, anything else staged. null = nothing dropped. */
export async function pickDropped(): Promise<string | null> {
  const d = dropped;
  dropped = null;
  if (!d || Date.now() - d.at > DROP_TTL_MS) return null;
  const items = existing(d.paths);
  if (!items.length) return null;
  if (items.length === 1 && items[0]!.dir) return items[0]!.path;
  return stageInto(inboxRoot(), items.map(i => i.path));
}

/** Native dialog for one or many files; the chosen files are staged. null = cancelled. */
export async function pickFilesDialog(win: BrowserWindow | null): Promise<string | null> {
  dropped = null;
  const opts: OpenDialogOptions = {
    title: 'Choose your files',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Slides, documents and notes', extensions: [...SOURCE_EXTS].map(e => e.slice(1)) },
      { name: 'All files', extensions: ['*'] },
    ],
  };
  const r = win && !win.isDestroyed() ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
  if (r.canceled || !r.filePaths.length) return null;
  return stageInto(inboxRoot(), r.filePaths);
}

// ---------- staging ----------
interface Item { path: string; dir: boolean }

function existing(paths: string[]): Item[] {
  const out: Item[] = [];
  const seen = new Set<string>();
  for (const p of paths) {
    const abs = resolve(p);
    const k = abs.toLowerCase();
    if (seen.has(k)) continue;
    try {
      const st = statSync(abs);
      if (st.isDirectory() || st.isFile()) { seen.add(k); out.push({ path: abs, dir: st.isDirectory() }); }
    } catch { /* gone */ }
  }
  return out;
}

function inboxRoot(): string {
  const tmp = join(app.getPath('temp'), INBOX_DIR);
  const out = resolve(getSettings().outRoot).toLowerCase();
  return (tmp.toLowerCase() + sep).startsWith(out + sep) ? join(userDir(), INBOX_DIR) : tmp;
}

const pad = (n: number) => String(n).padStart(2, '0');
const stampOf = (d: Date) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

/** A readable folder name from the first item ("CSC2103-L01 arrays.pdf" -> "CSC2103-L01 arrays"). */
function nameFor(first: Item | undefined): string {
  if (!first) return 'My files';
  const raw = first.dir ? basename(first.path) : basename(first.path, extname(first.path));
  let n = raw.replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60).replace(/[. ]+$/, '').trim();
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(n)) n += ' files';
  return n || 'My files';
}

/** Remove staging folders older than a day (their files were copied into a course when it started). */
function sweep(root: string, now: number): void {
  let names: string[];
  try { names = readdirSync(root); } catch { return; }
  for (const name of names) {
    const p = join(root, name);
    try { if (now - statSync(p).mtimeMs > KEEP_MS) rmSync(p, { recursive: true, force: true }); } catch { /* in use */ }
  }
}

/**
 * Copy the given files and folders into a fresh folder under `root` and return it. Folders keep their name and
 * bring only the files the engine reads (same walk as a run); loose files the engine cannot read are left out, so
 * the file list on screen matches what the run will use.
 */
export function stageInto(root: string, paths: string[], now = new Date()): string {
  const items = existing(paths);
  mkdirSync(root, { recursive: true });
  sweep(root, now.getTime());
  const stamp = stampOf(now);
  let box = join(root, stamp);
  for (let i = 2; existsSync(box); i++) box = join(root, `${stamp}-${i}`);
  const dir = join(box, nameFor(items[0]));
  mkdirSync(dir, { recursive: true });

  const used = new Set<string>();
  const unique = (name: string) => {
    const ext = extname(name);
    const stem = name.slice(0, name.length - ext.length);
    let n = name;
    for (let i = 2; used.has(n.toLowerCase()); i++) n = `${stem} (${i})${ext}`;
    used.add(n.toLowerCase());
    return n;
  };
  for (const it of items) {
    if (it.dir) {
      const files = listSourceFiles(it.path);
      if (!files.length) continue;
      const top = unique(basename(it.path) || 'folder');
      for (const f of files) {
        const to = join(dir, top, relative(it.path, f));
        mkdirSync(dirname(to), { recursive: true });
        copyFileSync(f, to);
      }
    } else {
      const name = basename(it.path);
      if (SKIP_FILE.test(name) || !SOURCE_EXTS.has(extname(name).toLowerCase())) continue;
      copyFileSync(it.path, join(dir, unique(name)));
    }
  }
  return dir;
}
