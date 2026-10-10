// The SaaS chunker (Chunker.php): 1200-char hard ceiling, 150-char overlap snapped to a word boundary, paragraph
// breaks first, whitespace second. Sections are never packed together (contract: a chunk keeps its section's locator,
// so "Slide 14" always means slide 14).
import type { Chunk } from '@bilimind/core';
import type { ChunkSections } from '../contracts.ts';
import { normaliseText } from './tidy.ts';

export const CHUNK_SIZE = 1200;
export const CHUNK_OVERLAP = 150;
/** Sections with less text than this ("Questions?", "Thank you") make no chunk. */
export const MIN_CHUNK_CHARS = 20;
const SEP = '\n\n';

const len = (s: string): number => [...s].length;
const sub = (s: string, a: number, b?: number): string => [...s].slice(a, b).join('');

function splitOnWordBoundaries(paragraph: string, max: number): string[] {
  const pieces: string[] = [];
  let remaining = paragraph;
  while (len(remaining) > max) {
    const window = sub(remaining, 0, max + 1);
    let cut = 0;
    for (const m of window.matchAll(/\s+/gu)) cut = len(window.slice(0, m.index));
    if (cut <= 0) cut = max;
    const piece = sub(remaining, 0, cut).trimEnd();
    if (piece) pieces.push(piece);
    remaining = sub(remaining, cut).trimStart();
  }
  if (remaining.trim()) pieces.push(remaining.trim());
  return pieces;
}

function tail(chunk: string, overlap: number): string {
  if (overlap <= 0) return '';
  const n = len(chunk);
  if (n <= overlap) return chunk.trim();
  const start = n - overlap;
  let t = sub(chunk, start);
  if (!/\s/u.test(sub(chunk, start - 1, start))) t = t.replace(/^\S+\s*/u, '');
  return t.trim();
}

const join = (buffer: string, paragraph: string): string => (buffer.trim() === '' ? paragraph : buffer + SEP + paragraph);

/** Port of Chunker::chunk for one section's text. */
export function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const t = normaliseText(text);
  if (!t) return [];
  const maxPiece = Math.max(1, size - Math.max(0, overlap) - SEP.length);
  const paragraphs: string[] = [];
  for (const raw of t.split(/\n{2,}/)) {
    const p = raw.trim();
    if (!p) continue;
    if (len(p) <= maxPiece) paragraphs.push(p);
    else paragraphs.push(...splitOnWordBoundaries(p, maxPiece));
  }
  const chunks: string[] = [];
  let buffer = '';
  for (const p of paragraphs) {
    let candidate = join(buffer, p);
    if (len(candidate) <= size) { buffer = candidate; continue; }
    if (buffer.trim()) { chunks.push(buffer); buffer = tail(buffer, overlap); }
    candidate = join(buffer, p);
    buffer = len(candidate) <= size ? candidate : p;
  }
  if (buffer.trim()) chunks.push(buffer);
  return chunks.map(c => c.trim()).filter(Boolean);
}

export const chunkSections: ChunkSections = (file, sections, firstId) => {
  const out: Chunk[] = [];
  let id = firstId;
  let ordinal = 1;
  for (const s of sections) {
    for (const piece of chunkText(s.text)) {
      if (len(piece.replace(/\s+/g, '')) < MIN_CHUNK_CHARS && sections.length > 1) continue;
      out.push({ id: id++, material_id: file.material_id, title: file.title, ordinal: ordinal++, locator: s.locator, page: s.page, content: piece });
    }
  }
  return out;
};
