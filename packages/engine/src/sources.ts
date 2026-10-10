// G2 review fixes for grounding: which chunks a lesson may be taught and cited from.
// - Front matter (title slides, "Learning outcomes", "References and licence") is never retrieved or cited.
// - Slides a node's summary names ("slide 7", "slides 4-6", "slide 5 of your first deck") are always handed to the
//   Writer, resolved against the deck the lesson is mostly about.
// - Chunks a cut sibling topic owns (it ranked them higher) are dropped, and off-deck chunks are dropped when the
//   dominant deck already has enough; core lessons get up to 8 chunks.
// - Prose that says "slide N" is tied back to that slide's chunk, so the citation chip and the Checker cover it.
import type { Chunk, IngestResult, Lesson, OutlineResult, PlanResult, SourceFile } from '@bilimind/core';

const FRONT_HEAD = /^\s*(learning (outcomes|objectives|goals)|references( and licen[cs]es?)?|bibliography|further reading|acknowledge?ments?|agenda|contents|table of contents|licen[cs]e)\b/i;

/** A title slide, learning-outcomes slide or references slide: never evidence for an answer. */
export function isFrontMatter(c: Pick<Chunk, 'content' | 'ordinal'>): boolean {
  const text = (c.content ?? '').trim();
  const first = text.split('\n')[0] ?? '';
  if (FRONT_HEAD.test(first)) return true;
  const words = text.split(/\s+/).filter(Boolean).length;
  // a deck's first slide naming the lecture/week ("CSC2103 Data Structures | Lecture 1") is its title slide
  if (c.ordinal === 1 && words < 90 && /\b(lecture|week|chapter|module|unit)\s*\d+\b/i.test(first)) return true;
  if (c.ordinal === 1 && words < 90 && /licen[cs]e|attribution|not official material/i.test(text)) return true;
  return false;
}

export interface SlideMention { text: string; n: number; deckHint: number | null }

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
const MENTION = /\bslides?\s+(\d{1,3})((?:\s*(?:,|-|–|to|and|&)\s*\d{1,3})*)(\s+(?:of|in|from)\s+(?:your|the)\s+(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+(?:deck|lecture|set of slides))?/gi;
const LECTURE = /\b(?:lecture|L)\s*0?(\d{1,2})\b/i;

/** "slide 3", "slides 5 and 7", "slides 4-6", "slide 9 of your first deck" -> slide numbers (+ which deck, when said). */
export function slideMentions(text: string): SlideMention[] {
  const out: SlideMention[] = [];
  for (const m of (text ?? '').matchAll(MENTION)) {
    const deckHint = m[4] ? ORDINALS.indexOf(m[4].toLowerCase()) : null;
    const nums = [Number(m[1])];
    const rest = m[2] ?? '';
    for (const r of rest.matchAll(/(,|-|–|to|and|&)\s*(\d{1,3})/g)) {
      const n = Number(r[2]);
      if ((r[1] === '-' || r[1] === '–' || r[1] === 'to') && n > nums[nums.length - 1]! && n - nums[nums.length - 1]! <= 8) {
        for (let k = nums[nums.length - 1]! + 1; k <= n; k++) nums.push(k);
      } else nums.push(n);
    }
    for (const n of nums) if (n > 0) out.push({ text: m[0], n, deckHint: deckHint !== null && deckHint >= 0 ? deckHint : null });
  }
  return out;
}

/** Lecture decks (not past papers), in material order: "your first deck" = index 0. */
export const lectureFiles = (files: SourceFile[]): SourceFile[] =>
  files.filter(f => f.role !== 'past_paper' && f.role !== 'other').sort((a, b) => a.material_id - b.material_id);

/** The chunk for slide N of a deck (locator "Slide N", else page N of a landscape deck). */
export function slideChunk(chunks: Chunk[], materialId: number, n: number): Chunk | null {
  const mine = chunks.filter(c => c.material_id === materialId);
  return mine.find(c => (c.locator ?? '').trim().toLowerCase() === `slide ${n}`)
    ?? mine.find(c => c.page === n && /slide/i.test(c.locator ?? ''))
    ?? null;
}

/** The deck most of these chunks come from (ties: the first one seen). */
export function dominantDeck(chunks: Chunk[]): number | null {
  const count = new Map<number, number>();
  for (const c of chunks) count.set(c.material_id, (count.get(c.material_id) ?? 0) + 1);
  let best: number | null = null, n = 0;
  for (const [id, k] of count) if (k > n) { best = id; n = k; }
  return best;
}

/** Deck named in a text ("Lecture 2", "L03"), resolved to a lecture file. */
export function deckNamed(text: string, files: SourceFile[]): number | null {
  const m = LECTURE.exec(text ?? '');
  if (!m) return null;
  const n = Number(m[1]);
  const f = lectureFiles(files).find(x => new RegExp(`(?:^|[^a-z0-9])(?:l|lec|lecture|week|w)[-_ ]?0*${n}(?=[^0-9]|$)`, 'i').test(x.name));
  return f?.material_id ?? null;
}

/** Resolve slide mentions in a text to chunks: an explicit deck ("first deck", "Lecture 2") wins, else `deck`. */
export function resolveMentions(text: string, chunks: Chunk[], files: SourceFile[], deck: number | null): { mention: SlideMention; chunk: Chunk }[] {
  const lectures = lectureFiles(files);
  const named = deckNamed(text, files);
  const out: { mention: SlideMention; chunk: Chunk }[] = [];
  for (const m of slideMentions(text)) {
    const d = m.deckHint !== null ? lectures[m.deckHint]?.material_id ?? null : named ?? deck;
    if (d === null) continue;
    const c = slideChunk(chunks, d, m.n);
    if (c && !isFrontMatter(c) && !out.some(o => o.chunk.id === c.id)) out.push({ mention: m, chunk: c });
  }
  return out;
}

export interface RefineInput {
  ingest: Pick<IngestResult, 'files' | 'chunks'>;
  pool: Chunk[];                       // teaching chunks (no past paper, no front matter)
  lesson: Lesson;
  outline: OutlineResult;
  plan?: PlanResult | null;
  lexical: (limit: number) => Chunk[]; // the existing retrieval (minisearch) over the pool
}

/**
 * The chunks a lesson is written from. Named slides first, then the outline's chunks and fresh lexical hits from the
 * lesson's dominant deck; chunks a cut sibling owns are dropped; off-deck chunks only when the deck has too few.
 */
export function refineLessonChunks(r: RefineInput): Chunk[] {
  const { pool, lesson, outline } = r;
  const files = r.ingest.files;
  const byId = new Map(pool.map(c => [c.id, c]));
  const limit = lesson.track === 'core' ? 8 : 6;
  const base = (lesson.chunk_ids ?? []).map(id => byId.get(id)).filter((c): c is Chunk => !!c);
  const text = `${lesson.title}. ${lesson.summary ?? ''}`;
  // "slide 5 of your first deck" names the deck outright; else "Lecture 2"; else the deck most outline chunks are from
  const hinted = slideMentions(text).find(m => m.deckHint !== null)?.deckHint;
  const hintedDeck = hinted !== undefined && hinted !== null ? lectureFiles(files)[hinted]?.material_id ?? null : null;
  const deck = hintedDeck ?? deckNamed(text, files) ?? dominantDeck(base) ?? dominantDeck(r.lexical(6));
  const forced = resolveMentions(text, pool, files, deck).map(x => x.chunk);

  // ownership: a chunk belongs to the outline node that ranked it highest; cut nodes' chunks are not ours
  const kept = new Set((r.plan?.lessons ?? []).map(l => l.key));
  const cut = new Set(outline.lessons.filter(l => l.key !== lesson.key && (r.plan ? !kept.has(l.key) : false)).map(l => l.key));
  const rank = (l: Lesson, id: number) => { const i = (l.chunk_ids ?? []).indexOf(id); return i < 0 ? Infinity : i; };
  const ownedByCut = (c: Chunk) => {
    const mine = rank(lesson, c.id);
    return outline.lessons.some(o => cut.has(o.key) && (rank(o, c.id) < mine
      || resolveMentions(`${o.title}. ${o.summary ?? ''}`, pool, files, dominantDeck((o.chunk_ids ?? []).map(id => byId.get(id)).filter((x): x is Chunk => !!x))).some(m => m.chunk.id === c.id)));
  };
  const forcedIds = new Set(forced.map(c => c.id));
  const candidates: Chunk[] = [];
  for (const c of [...base, ...r.lexical(12)]) {
    if (forcedIds.has(c.id) || candidates.some(x => x.id === c.id)) continue;
    if (ownedByCut(c)) continue;
    candidates.push(c);
  }
  const onDeck = candidates.filter(c => deck === null || c.material_id === deck);
  const offDeck = candidates.filter(c => deck !== null && c.material_id !== deck);
  const picked: Chunk[] = [...forced];
  for (const c of onDeck) { if (picked.length >= limit) break; picked.push(c); }
  // off-deck chunks only when the lesson's own deck gave fewer than 2
  if (picked.length < 2) for (const c of offDeck) { if (picked.length >= Math.min(limit, 3)) break; picked.push(c); }
  // reading order: deck, then slide
  return picked.slice(0, Math.max(limit, forced.length))
    .sort((a, b) => (a.material_id === deck ? 0 : 1) - (b.material_id === deck ? 0 : 1) || a.material_id - b.material_id || a.ordinal - b.ordinal);
}
