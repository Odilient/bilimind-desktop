// minisearch over chunks with the SaaS term recipe (MaterialRetriever::forNode); top 6 per lesson, at least 2.
// Owner: WP1. Keep the export names and types (src/contracts.ts); replace the stubs in place.
import MiniSearch from 'minisearch';
import type { Chunk, IngestResult } from '@bilimind/core';
import type { BuildIndex, RetrievalIndex, RetrieveForLesson, SearchTerms } from './contracts.ts';
import { isFrontMatter } from './sources.ts';

export const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'these', 'those',
  'what', 'when', 'how', 'why', 'into', 'onto', 'your', 'you', 'are',
  'was', 'were', 'will', 'shall', 'can', 'its', 'his', 'her', 'their',
  'about', 'over', 'under', 'between', 'introduction', 'intro', 'overview',
  'basics', 'fundamentals', 'part', 'chapter', 'lesson', 'module', 'section',
]);
const MIN_TERM = 3;
const PREFIX_TERM = 4;
const MAX_TERMS = 24;
/** Chunk content handed to prompts is capped here (engine-port §6.2). */
export const CONTENT_CAP = 4000;

/** Lowercase, letters/digits only, >= 3 chars, no stopwords, de-duplicated, at most 24. */
export const searchTerms: SearchTerms = text => {
  const raw = (text ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  if (!raw) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tok of raw.split(/\s+/)) {
    if ([...tok].length < MIN_TERM || STOPWORDS.has(tok) || seen.has(tok)) continue;
    seen.add(tok);
    out.push(tok);
    if (out.length >= MAX_TERMS) break;
  }
  return out;
};

const tokenize = (text: string): string[] => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Substring scoring (the SaaS LIKE fallback): one point per term the chunk contains. */
function substringHits(chunks: Chunk[], terms: string[], limit: number): { chunk: Chunk; score: number; terms: string[] }[] {
  const ts = terms.slice(0, 12);
  const hits: { chunk: Chunk; score: number; terms: string[] }[] = [];
  for (const c of chunks) {
    const lc = c.content.toLowerCase();
    const matched = ts.filter(t => lc.includes(t));
    if (matched.length) hits.push({ chunk: c, score: matched.length, terms: matched });
  }
  return hits.sort((a, b) => b.score - a.score || a.chunk.material_id - b.chunk.material_id || a.chunk.ordinal - b.chunk.ordinal).slice(0, limit);
}

export const buildIndex: BuildIndex = chunks => {
  const byId = new Map<number, Chunk>();
  for (const c of chunks) byId.set(c.id, c);
  const ms = new MiniSearch<{ id: number; content: string; locator: string; title: string }>({
    fields: ['content', 'locator', 'title'],
    idField: 'id',
    tokenize,
    processTerm: t => (t.length < 2 ? null : t),
    searchOptions: { boost: { content: 1, locator: 0.5, title: 0.5 } },
  });
  ms.addAll(chunks.map(c => ({ id: c.id, content: c.content, locator: c.locator ?? '', title: c.title })));
  const all = [...byId.values()];
  const index: RetrievalIndex = {
    search(text, limit) {
      const terms = searchTerms(text);
      if (!terms.length || limit <= 0) return [];
      const results = ms.search(terms.join(' '), {
        combineWith: 'OR',
        prefix: term => term.length >= PREFIX_TERM,
        fuzzy: false,
        processTerm: t => (t.length < MIN_TERM || STOPWORDS.has(t) ? null : t),
      });
      const hits = results.slice(0, limit).map(r => ({ chunk: byId.get(Number(r.id))!, score: Math.round(r.score * 1000) / 1000, terms: r.queryTerms }))
        .filter(h => h.chunk);
      // Zero full-text hits is not "nothing relevant": a term inside a compound is only reachable by substring.
      return hits.length ? hits : substringHits(all, terms, limit);
    },
  };
  return index;
};

/**
 * Top `limit` (6) chunks for a lesson from title + summary + concept_key. When fewer than `minimum` (2) come back,
 * substring scoring and then 5-letter stems fill the gap, so every lesson has its best 2 chunks even on weak overlap.
 * Chunks with zero overlap are never added (a citation must be about the lesson).
 */
export const retrieveForLesson: RetrieveForLesson = (index, chunks, lesson, opts = {}) => {
  const limit = Math.max(1, opts.limit ?? 6);
  const minimum = Math.min(limit, Math.max(0, opts.minimum ?? 2));
  const text = [lesson.title, lesson.summary, lesson.concept_key?.replace(/[_-]+/g, ' ')].filter(Boolean).join(' ');
  const picked: Chunk[] = index.search(text, limit).map(h => h.chunk);
  if (picked.length < minimum) {
    const terms = searchTerms(text);
    const have = new Set(picked.map(c => c.id));
    const pool = chunks.filter(c => !have.has(c.id));
    const extra = substringHits(pool, terms, minimum - picked.length);
    if (picked.length + extra.length < minimum) {
      const stems = [...new Set(terms.filter(t => t.length >= 6).map(t => t.slice(0, 5)))];
      const taken = new Set(extra.map(e => e.chunk.id));
      extra.push(...substringHits(pool.filter(c => !taken.has(c.id)), stems, minimum - picked.length - extra.length));
    }
    picked.push(...extra.map(e => e.chunk));
  }
  return picked.slice(0, limit).map(c => (c.content.length > CONTENT_CAP ? { ...c, content: c.content.slice(0, CONTENT_CAP) } : c));
};

/** Chunks that lessons may cite: everything except past papers (an exam question is not evidence for an answer). */
export function lectureChunks(ing: Pick<IngestResult, 'files' | 'chunks'>): Chunk[] {
  const exclude = new Set(ing.files.filter(f => f.role === 'past_paper').map(f => f.material_id));
  return ing.chunks.filter(c => !exclude.has(c.material_id) && !isFrontMatter(c));
}

/**
 * Excerpts for a prompt (engine-port §6.2): `[material_id=37 · Week 7 - Trees.pdf · Slide 14]` + the text, within
 * maxChars. The id printed is the CHUNK id, so the model's source_material_ids are chunk-level citations.
 */
export function renderChunks(chunks: Chunk[], maxChars = 8000): string {
  const parts: string[] = [];
  let used = 0;
  for (const c of chunks) {
    const where = c.locator ? c.locator.slice(0, 60) : `part ${c.ordinal}`;
    const header = `[material_id=${c.id} · ${c.title.slice(0, 80)} · ${where}]`;
    const body = c.content.trim();
    const entry = `${header}\n${body}`;
    if (used + entry.length + 2 > maxChars) {
      const room = maxChars - used - header.length - 4;
      if (room > 200) parts.push(`${header}\n${body.slice(0, room - 1)}…`);
      break;
    }
    parts.push(entry);
    used += entry.length + 2;
  }
  return parts.join('\n\n');
}
