// Outline digest (MaterialRetriever::digestForCourse): <= 6000 chars, every non-past-paper file gets an equal share
// (at least 400), chunks picked EVENLY across the file so the digest represents the whole deck, not its intro.
// Our chunks are one slide each (no packing), so we take more of them and clip each line instead of taking 1-2 whole chunks.
import type { Chunk, SourceFile } from '@bilimind/core';
import type { BuildDigest } from '../contracts.ts';
import { clip } from './tidy.ts';

/** The FORMAT, not the provenance: the outline plans differently for a slide deck than for a document. */
export function formatNoun(f: Pick<SourceFile, 'kind' | 'landscape' | 'role'>): string {
  if (f.role === 'past_paper') return 'past exam paper';
  if (f.role === 'syllabus') return 'course syllabus';
  if (f.role === 'sop') return 'procedure document';
  if (f.kind === 'pptx' || (f.kind === 'pdf' && f.landscape)) return 'slide deck';
  if (f.kind === 'md' || f.kind === 'txt') return 'personal notes';
  if (f.kind === 'html') return 'web page';
  return 'document';
}

/** index = round(i * (total - 1) / (wanted - 1)) */
export function spread<T>(items: T[], wanted: number): T[] {
  if (wanted >= items.length) return items.slice();
  if (wanted <= 1) return items.slice(0, 1);
  const out: T[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < wanted; i++) {
    const idx = Math.round(i * (items.length - 1) / (wanted - 1));
    if (!seen.has(idx)) { seen.add(idx); out.push(items[idx]!); }
  }
  return out;
}

const LINE_TARGET = 170;   // chars per digest line: a slide title plus its first point or two
/** Reference/licence/thank-you slides say nothing about what to teach. */
const BACK_MATTER = /^\s*(references?|bibliography|sources|licen[cs]e|attribution|thank you|questions\?)\b/i;

export const buildDigest: BuildDigest = (files, chunks, maxChars = 6000) => {
  if (maxChars <= 0) return '';
  let pool = files.filter(f => f.role !== 'past_paper');
  if (!pool.length) pool = files.slice();
  pool = pool.filter(f => chunks.some(c => c.material_id === f.material_id));
  if (!pool.length) return '';
  const budget = Math.max(400, Math.floor(maxChars / pool.length));
  const parts: string[] = [];
  let used = 0;
  for (const f of pool) {
    const remaining = maxChars - used;
    if (remaining <= 200) break;
    const b = Math.min(budget, remaining);
    const header = `### Material #${f.material_id} — "${clip(f.title, 120)}" (${formatNoun(f)})`;
    const mine: Chunk[] = chunks.filter(c => c.material_id === f.material_id).sort((a, z) => a.ordinal - z.ordinal);
    // One line per locator (a long slide split in two chunks shows once).
    const firstPerPlace: Chunk[] = [];
    const seen = new Set<string>();
    for (const c of mine) {
      const k = c.locator ?? `#${c.ordinal}`;
      if (seen.has(k) || BACK_MATTER.test(c.content)) continue;
      seen.add(k); firstPerPlace.push(c);
    }
    if (!firstPerPlace.length) continue;
    const room = b - header.length - 1;
    const wanted = Math.max(1, Math.min(firstPerPlace.length, Math.floor(room / LINE_TARGET)));
    const picked = spread(firstPerPlace, wanted);
    const per = Math.max(80, Math.floor(room / picked.length) - 2);
    const lines = [header];
    let size = header.length;
    for (const c of picked) {
      const where = c.locator ? `[${clip(c.locator, 60)}] ` : '';
      const body = c.content.replace(/\s+/g, ' ').trim();
      const avail = per - where.length;
      if (avail < 30) continue;
      const text = [...body].length > avail ? clip(body, avail - 1).trimEnd() + '…' : body;
      const line = where + text;
      if (size + line.length + 1 > b) break;
      lines.push(line);
      size += line.length + 1;
    }
    const section = lines.join('\n');
    parts.push(section);
    used += section.length + 2;
  }
  const out = parts.join('\n\n');
  return [...out].length > maxChars ? clip(out, maxChars - 1) + '…' : out;
};
