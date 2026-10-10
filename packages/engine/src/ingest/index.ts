// Ingest: pdf (unpdf, Page N / Slide N), pptx (fflate, Slide N + notes), docx (mammoth), md/txt/html; chunker; digest; roles.
// Owner: WP1. Keep the export names and types (src/contracts.ts); replace the stubs in place.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { Chunk, FileKind, FileRole, IngestResult, SourceFile } from '@bilimind/core';
import { FILE_ROLES } from '@bilimind/core';
import { BilimindError } from '../contracts.ts';
import type { ExtractFile, ExtractedFile, Ingest, ReadIngest } from '../contracts.ts';
import { coursePaths, readJson, writeJson } from '../course.ts';
import { extractPdf } from './pdf.ts';
import { extractPptx } from './pptx.ts';
import { extractDocx } from './docx.ts';
import { extractText } from './text.ts';
import { wordCount } from './tidy.ts';
import { chunkSections } from './chunk.ts';
import { buildDigest } from './digest.ts';
import { detectRole } from './roles.ts';

export { chunkSections, chunkText, CHUNK_SIZE, CHUNK_OVERLAP } from './chunk.ts';
export { buildDigest, formatNoun, spread } from './digest.ts';
export { detectRole, roleScores } from './roles.ts';
export { extractPptxBuffer, drawingText } from './pptx.ts';
export { htmlToSections } from './html.ts';
export { markdownSections } from './text.ts';
export { stripRepeatedLines } from './pdf.ts';

const KIND_BY_EXT: Record<string, FileKind> = {
  '.pdf': 'pdf', '.pptx': 'pptx', '.docx': 'docx', '.md': 'md', '.markdown': 'md', '.txt': 'txt', '.html': 'html', '.htm': 'html',
};

/** Files that are never course material: licences, status notes, temp/lock files, dotfiles. */
export function isIgnoredSource(name: string): boolean {
  const n = name.toLowerCase();
  return n.startsWith('.') || n.startsWith('~$') || /^(licen[cs]e|copying|status|notice)([-_. ][^/]*)?(\.(md|markdown|txt))?$/.test(n) && !/\.(pdf|docx|pptx|html?)$/.test(n);
}

export function kindOf(name: string): FileKind | null {
  return KIND_BY_EXT[extname(name).toLowerCase()] ?? null;
}

export const extractFile: ExtractFile = async absPath => {
  const kind = kindOf(absPath);
  switch (kind) {
    case 'pdf': return extractPdf(absPath);
    case 'pptx': return extractPptx(absPath);
    case 'docx': return extractDocx(absPath);
    case 'md': case 'txt': case 'html': return extractText(absPath, kind);
    default: throw new BilimindError(`Unsupported file type: ${absPath}`, 'Use PDF, PPTX, DOCX, Markdown, TXT or HTML.');
  }
};

/**
 * Display title from the file name: "CSC2103-L02-hash-tables.pdf" -> "Lecture 2 · Hash tables",
 * "week-7_trees.pdf" -> "Week 7 · Trees", "past-paper.pdf" -> "Past paper".
 */
export function titleFromName(name: string): string {
  const stem = name.replace(/\.[^.]+$/, '');
  const tokens = stem.split(/[-_\s]+/).filter(Boolean);
  let prefix = '';
  const rest: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const lec = /^(?:l|lec|lecture)(\d{1,2})$/i.exec(t);
    const wk = /^(?:w|wk|week)(\d{1,2})$/i.exec(t);
    const ch = /^(?:ch|chap|chapter)(\d{1,2})$/i.exec(t);
    if (!prefix && lec) { prefix = `Lecture ${Number(lec[1])}`; continue; }
    if (!prefix && wk) { prefix = `Week ${Number(wk[1])}`; continue; }
    if (!prefix && ch) { prefix = `Chapter ${Number(ch[1])}`; continue; }
    if (!prefix && /^(?:lecture|week|chapter)$/i.test(t) && /^\d{1,2}$/.test(tokens[i + 1] ?? '')) {
      prefix = `${t[0]!.toUpperCase()}${t.slice(1).toLowerCase()} ${Number(tokens[i + 1])}`; i++; continue;
    }
    if (i === 0 && tokens.length > 1 && /^[A-Z]{2,5}\d{3,5}[A-Z]?$/.test(t)) continue;   // course code
    rest.push(t);
  }
  let body = rest.join(' ');
  if (body && body === body.toLowerCase()) body = body[0]!.toUpperCase() + body.slice(1);
  if (prefix && body) return `${prefix} · ${body}`;
  return prefix || body || stem;
}

const JUNK_TITLE = /^(untitled|microsoft (word|powerpoint)|powerpoint presentation|presentation\d*|document\d*|slides?\s*\d*|ai slides|canva|copy of|title)\b/i;

/**
 * A readable title from document metadata when it is meaningful, else null:
 * "CSC2103 Data Structures - Lecture 2: Hash Tables" -> "Lecture 2 · Hash Tables";
 * "CSC2103 Data Structures - Sample Final Examination" -> "Sample Final Examination".
 */
export function titleFromMeta(meta: string | undefined): string | null {
  const t = (meta ?? '').replace(/\s+/g, ' ').trim();
  if (t.length < 4 || JUNK_TITLE.test(t) || /\.(pdf|docx?|pptx?)$/i.test(t)) return null;
  const unit = /\b(lecture|lec|week|chapter|topic|unit|module)\s*(\d{1,2})\s*[:\-–—.]\s*(.+)$/i.exec(t);
  let out = t;
  if (unit) {
    const word = unit[1]!.toLowerCase() === 'lec' ? 'Lecture' : unit[1]![0]!.toUpperCase() + unit[1]!.slice(1).toLowerCase();
    out = `${word} ${Number(unit[2])} · ${unit[3]!.trim()}`;
  } else {
    const parts = t.split(/\s+[-–—|]\s+/);
    if (parts.length > 1 && /\b[A-Z]{2,5}\s?\d{3,5}[A-Z]?\b/.test(parts[0]!)) out = parts.slice(1).join(' - ');
  }
  return out.length > 90 ? out.slice(0, 89).trimEnd() + '…' : out;
}

const THIN_WORDS = 120;

/** Read sources/ (top level and one folder down), extract, chunk, role, digest. Exported for the run harness and tests. */
export async function ingestFolder(sourcesDir: string, opts: { roles?: Record<string, FileRole>; progress?: (l: string) => void } = {}): Promise<IngestResult> {
  if (!existsSync(sourcesDir)) throw new BilimindError(`No sources folder at ${sourcesDir}`, 'Run `init --src <folder>` first.');
  const names: string[] = [];
  for (const n of readdirSync(sourcesDir)) {
    const abs = join(sourcesDir, n);
    if (statSync(abs).isDirectory()) {
      if (isIgnoredSource(n) || n.startsWith('_')) continue;
      for (const m of readdirSync(abs)) if (statSync(join(abs, m)).isFile()) names.push(`${n}/${m}`);
    } else names.push(n);
  }
  const usable = names
    .filter(n => { const base = n.split('/').pop()!; return !isIgnoredSource(base) && kindOf(base) !== null; })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  const skipped = names.filter(n => !usable.includes(n));
  if (skipped.length) opts.progress?.(`ingest: skipped ${skipped.join(', ')}`);
  if (!usable.length) throw new BilimindError('No readable files in sources/.', 'Add PDF, PPTX, DOCX or Markdown files to the source folder and run init again.');

  const overrides = new Map<string, FileRole>();
  for (const [k, v] of Object.entries(opts.roles ?? {})) {
    if (!(FILE_ROLES as readonly string[]).includes(v)) throw new BilimindError(`Unknown role "${v}" for ${k}.`, `Roles: ${FILE_ROLES.join(', ')}.`);
    overrides.set(k.toLowerCase(), v);
  }
  const overrideFor = (name: string): FileRole | undefined => {
    const n = name.toLowerCase(), base = n.split('/').pop()!;
    return overrides.get(n) ?? overrides.get(base) ?? [...overrides].find(([k]) => base.includes(k))?.[1];
  };

  const files: SourceFile[] = [];
  const chunks: Chunk[] = [];
  let nextChunk = 1;
  for (let i = 0; i < usable.length; i++) {
    const rel = usable[i]!;
    const base = rel.split('/').pop()!;
    const kind = kindOf(base)!;
    let ex: ExtractedFile & { title?: string };
    try {
      ex = await extractFile(join(sourcesDir, rel));
    } catch (e) {
      opts.progress?.(`ingest: could not read ${rel} (${(e as Error).message.slice(0, 120)})`);
      ex = { kind, pages: 0, sections: [], scanned_pages: [] };
    }
    const text = ex.sections.map(s => s.text).join('\n\n');
    const sf: SourceFile = {
      material_id: i + 1,
      name: rel,
      path: `sources/${rel}`,
      title: titleFromMeta(ex.title) ?? titleFromName(base),
      kind: ex.kind,
      role: overrideFor(rel) ?? detectRole(base, text),
      pages: ex.pages,
      words: wordCount(text),
      scanned_pages: ex.scanned_pages,
    };
    if (ex.landscape !== undefined) sf.landscape = ex.landscape;
    const mine = chunkSections(sf, ex.sections, nextChunk);
    nextChunk += mine.length;
    files.push(sf);
    chunks.push(...mine);
    const unit = ex.kind === 'pptx' || ex.landscape ? 'slides' : ex.kind === 'pdf' ? 'pages' : 'sections';
    opts.progress?.(`ingest: ${rel} · ${sf.pages} ${unit} · ${sf.words} words · ${sf.role}${sf.scanned_pages.length ? ` · ${sf.scanned_pages.length} without text` : ''}`);
  }
  const thin_files = files.filter(f => f.words < THIN_WORDS || (f.pages > 0 && f.scanned_pages.length >= f.pages / 2)).map(f => f.name);
  return { files, chunks, digest: buildDigest(files, chunks), thin_files };
}

export const ingest: Ingest = async (ctx, opts) => {
  const paths = coursePaths(ctx.course);
  const result = await ingestFolder(paths.sources, { roles: opts.roles, progress: ctx.progress });
  writeJson(paths.ingest, result);
  return {
    files: result.files.map(f => ({ name: f.name, kind: f.kind, role: f.role, pages: f.pages, words: f.words, scanned_pages: f.scanned_pages })),
    chunks: result.chunks.length,
    thin_files: result.thin_files,
  };
};

export const readIngest: ReadIngest = course => readJson<IngestResult>(coursePaths(course).ingest);

/**
 * The full text of one file rebuilt from its chunks WITHOUT the 150-char overlaps (joining raw chunks would repeat
 * text, e.g. count "[5 marks]" twice in a past paper). Each place starts with a "[Page 2]" / "[Slide 4]" marker
 * unless `markers: false`. Use it for exam parsing and anything that reads a whole file.
 */
export function sourceText(ing: Pick<IngestResult, 'chunks'>, materialId: number, opts: { markers?: boolean } = {}): string {
  const mine = ing.chunks.filter(c => c.material_id === materialId).sort((a, b) => a.ordinal - b.ordinal);
  const out: string[] = [];
  let prev: Chunk | null = null;
  for (const c of mine) {
    const samePlace = prev !== null && prev.locator === c.locator && prev.page === c.page;
    let body = c.content;
    if (samePlace) {
      const p = prev!.content;
      for (let k = Math.min(p.length, body.length, 400); k >= 20; k--) {
        if (body.startsWith(p.slice(p.length - k))) { body = body.slice(k).replace(/^\s+/, ''); break; }
      }
      if (body) out.push(body);
    } else {
      out.push(opts.markers === false || !c.locator ? body : `[${c.locator}]\n${body}`);
    }
    prev = c;
  }
  return out.join('\n\n');
}
