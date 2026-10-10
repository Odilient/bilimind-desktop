// `exam-map`: past paper -> questions with marks (regex) -> each part matched to outline topics by explainable term
// overlap (title x3, summary x2, the topic's own source chunks x1, idf across topics) -> weights = share of marks.
// Deterministic; writes crew/exam-map.json (ExamMap) and crew/exam-map.md (each question, its marks, why it matched).
// `--assign "Q3=<key>"` (whole question) or "Q3b=<key>" (one part) lets the Lead override.
// Owner: WP2. Keep the export names and types (src/contracts.ts).
import type { Chunk, ExamMap, ExamQuestion, OutlineResult, TopicWeight } from '@bilimind/core';
import type { ExamMapData, ExamMapFn, ParseExamQuestions, ReadExamMap } from './contracts.ts';
import { BilimindError } from './contracts.ts';
import { coursePaths, readJsonOrNull, writeJson, writeText } from './course.ts';
import { readIngest } from './ingest/index.ts';
import { readOutline } from './outline.ts';
import { terms } from './prompts/context.ts';

// ---------- parsing ----------
const MARKS_RE = /[[(]\s*(\d{1,3})\s*(?:marks?|mks?|m)?\s*[\])]/gi;
const HEADER_RE = /^[ \t]*(?:question|q)[ \t]*\.?[ \t]*(\d{1,2})\b(.*)$/gim;
const NUMBERED_RE = /^[ \t]*(\d{1,2})[.)][ \t]+(.*)$/gm;
const PART_RE = /^[ \t]*\(([a-h])\)[ \t]*/gm;

const lastMarks = (s: string): number | null => {
  let m: RegExpExecArray | null, last: number | null = null;
  MARKS_RE.lastIndex = 0;
  while ((m = MARKS_RE.exec(s))) { if (/mark|mk|m\b/i.test(m[0]) || /^\[/.test(m[0])) last = Number(m[1]); }
  return last;
};
const headerMarks = (line: string): number | null => {
  const m = /[[(]\s*(\d{1,3})\s*marks?\s*[\])]/i.exec(line);
  return m ? Number(m[1]) : null;
};
const clean = (s: string) => s.replace(/\bEND OF (?:QUESTION )?PAPER\b[\s\S]*$/i, '').replace(/\s+/g, ' ').trim();
const headerTitle = (rest: string) => clean(rest.replace(/[[(]\s*\d{1,3}\s*marks?\s*[\])]/i, '').replace(/^[\s:.\-–—]+/, ''));

/** "Question N" / "QN" headers (or "N." numbering), "(a)" parts, "[N marks]"/"(N marks)" -> one ExamQuestion per part. */
export const parseExamQuestions: ParseExamQuestions = (text, file) => {
  const src = text.replace(/\r\n?/g, '\n');
  let heads = [...src.matchAll(HEADER_RE)].map(m => ({ at: m.index!, end: m.index! + m[0].length, n: m[1]!, rest: m[2] ?? '' }));
  if (!heads.length) heads = [...src.matchAll(NUMBERED_RE)]   // fallback: "1." / "2)" numbering
    .map(m => ({ at: m.index!, end: m.index! + m[0].length, n: m[1]!, rest: m[2] ?? '' }));
  const seen = new Set<string>();
  heads = heads.filter(h => (seen.has(h.n) ? false : (seen.add(h.n), true)));
  const out: ExamQuestion[] = [];
  heads.forEach((h, i) => {
    const body = src.slice(h.end, heads[i + 1]?.at ?? src.length);
    const title = headerTitle(h.rest);
    const qMarks = headerMarks(h.rest);
    const parts = [...body.matchAll(PART_RE)].map(m => ({ at: m.index!, letter: m[1]!, end: m.index! + m[0].length }));
    const base = (part: string | null, txt: string, marks: number): ExamQuestion => ({
      id: `Q${h.n}${part ?? ''}`, number: h.n, part, text: txt, marks, file, locator: null, chunk_id: null,
      matches: [], assigned: null, assigned_by: 'auto',
    });
    if (!parts.length) {
      const txt = clean(`${title} ${body}`.replace(MARKS_RE, ''));
      out.push(base(null, txt.slice(0, 900), qMarks ?? lastMarks(body) ?? 0));
      return;
    }
    const rows = parts.map((p, j) => {
      const raw = body.slice(p.end, parts[j + 1]?.at ?? body.length);
      return { letter: p.letter, marks: lastMarks(raw), txt: clean(raw.replace(MARKS_RE, ' ')).slice(0, 900) };
    });
    const known = rows.reduce((s, r) => s + (r.marks ?? 0), 0);
    const missing = rows.filter(r => r.marks === null);
    const share = qMarks !== null && missing.length ? Math.max(0, qMarks - known) / missing.length : 0;
    for (const r of rows) {
      const q = base(r.letter, title ? `${title}: ${r.txt}` : r.txt, r.marks ?? Math.round(share * 100) / 100);
      out.push(q);
    }
  });
  return out;
};

// ---------- chunk text (chunks overlap by ~150 chars inside a section) ----------
/** Joins one file's chunks back into its text, removing the in-section overlap; spans map offsets to chunks. */
export function joinFileChunks(chunks: Chunk[]): { text: string; spans: { start: number; end: number; chunk: Chunk }[] } {
  const sorted = [...chunks].sort((a, b) => a.ordinal - b.ordinal);
  let text = '';
  const spans: { start: number; end: number; chunk: Chunk }[] = [];
  let prev: Chunk | null = null;
  for (const c of sorted) {
    let add = c.content;
    if (prev && prev.locator === c.locator) {
      let k = Math.min(400, prev.content.length, c.content.length);
      while (k >= 20 && !prev.content.endsWith(c.content.slice(0, k))) k--;
      if (k >= 20) add = c.content.slice(k);
      else text += '\n';
    } else if (text) text += '\n';
    spans.push({ start: text.length, end: text.length + add.length, chunk: c });
    text += add;
    prev = c;
  }
  return { text, spans };
}

// ---------- matching ----------
/** Crude stem so hashing~hash, heaps~heap, probing~probe~probes (one suffix, stem >= 4 chars). */
export function examStem(w: string): string {
  for (const [suf, rep] of [['ings', ''], ['ing', ''], ['ies', 'y'], ['es', ''], ['s', ''], ['ed', ''], ['e', '']] as const) {
    if (w.endsWith(suf) && w.length - suf.length + rep.length >= 4) return w.slice(0, w.length - suf.length) + rep;
  }
  return w;
}

interface TopicDoc { key: string; title: string; weights: Map<string, number> }

function topicDocs(outline: OutlineResult, chunkById: Map<number, Chunk>): TopicDoc[] {
  return outline.lessons.map(l => {
    const w = new Map<string, number>();
    const add = (text: string, weight: number) => { for (const t of terms(text, 100000)) { const s = examStem(t); w.set(s, Math.max(w.get(s) ?? 0, 0) + weight); } };
    add(l.title, 3); add(`${l.summary} ${l.concept_key.replace(/[._]/g, ' ')} ${l.key.replace(/_/g, ' ')}`, 2);
    const chunkTerms = new Map<string, number>();
    for (const id of l.chunk_ids) {
      const c = chunkById.get(id);
      if (!c) continue;
      for (const t of new Set(terms(c.content, 100000).map(examStem))) chunkTerms.set(t, (chunkTerms.get(t) ?? 0) + 1);
    }
    for (const [t, n] of chunkTerms) w.set(t, (w.get(t) ?? 0) + Math.min(3, n) * 0.5);
    return { key: l.key, title: l.title, weights: w };
  });
}

/** G2 review: the section heading ("Hashing: ...") is prepended to every part and biased matches. Score the part's
 * own text only (`body`); the heading (`head`) and the other parts of the same question only break near-ties. */
export const NEAR_TIE = 0.15;
function scoreParts(q: ExamQuestion, docs: TopicDoc[]): { body: ExamQuestion['matches']; head: Map<string, number> } {
  const m = /^([^:]{3,60}):\s*/.exec(q.text);
  if (!m) return { body: scoreText(q.text, docs), head: new Map() };
  const headScores = scoreText(m[1]!, docs);
  const body = scoreText(q.text.slice(m[0].length), docs);
  return { body: body.length ? body : headScores, head: new Map(headScores.map(x => [x.key, x.score])) };
}
/** Re-orders the near-tied top matches (within 15% of the best part-text score): first the topic family the
 * question's other parts went to ("part (a)" context), then the heading, then the part-text score. */
function breakTies(body: ExamQuestion['matches'], head: Map<string, number>, siblingVotes: (key: string) => number): ExamQuestion['matches'] {
  const top = body[0]?.score ?? 0;
  const near = body.filter(x => top - x.score <= top * NEAR_TIE);
  if (near.length < 2) return body;
  const ranked = [...near].sort((a, b) => siblingVotes(b.key) - siblingVotes(a.key) || (head.get(b.key) ?? 0) - (head.get(a.key) ?? 0) || b.score - a.score);
  return [...ranked, ...body.filter(x => !near.includes(x))];
}
function scoreText(text: string, docs: TopicDoc[]): ExamQuestion['matches'] {
  const qTerms = terms(text, 60);
  const df = new Map<string, number>();
  for (const t of qTerms) { const s = examStem(t); df.set(s, docs.filter(d => d.weights.has(s)).length); }
  return docs.map(d => {
    let score = 0;
    const hit: string[] = [];
    for (const t of qTerms) {
      const s = examStem(t), w = d.weights.get(s);
      if (!w) continue;
      hit.push(t);
      score += w * Math.log(1 + docs.length / (df.get(s) || 1));
    }
    return { key: d.key, score: Math.round(score * 100) / 100, terms: hit };
  }).filter(m => m.score > 0).sort((a, b) => b.score - a.score);
}

/** A subtopic is a side lesson: its marks count towards its parent topic unless it clearly wins (by 25% or more). */
export const SUBTOPIC_MARGIN = 1.25;
function pickTopic(all: ExamQuestion['matches'], parentOf: Map<string, string | undefined>): string | null {
  const best = all[0];
  if (!best) return null;
  const parent = parentOf.get(best.key);
  const p = parent ? all.find(m => m.key === parent) : undefined;
  return p && best.score < p.score * SUBTOPIC_MARGIN ? p.key : best.key;
}

function weightsOf(questions: ExamQuestion[], outline: OutlineResult, total: number): TopicWeight[] {
  const ws = outline.lessons.map(l => {
    const qs = questions.filter(q => q.assigned === l.key);
    const marks = qs.reduce((s, q) => s + q.marks, 0);
    return { key: l.key, title: l.title, marks, share: total ? Math.round((marks / total) * 1000) / 1000 : 0, questions: qs.map(q => q.id) };
  });
  return ws.sort((a, b) => b.share - a.share);
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** A subtopic whose best-matching questions were counted in its parent: {into: parent key, questions}. */
export function foldedInto(map: Pick<ExamMap, 'questions'>, key: string): { into: string; questions: string[] } | null {
  const qs = map.questions.filter(q => (q as ExamQuestion & { folded_from?: string }).folded_from === key && q.assigned);
  return qs.length ? { into: qs[0]!.assigned!, questions: qs.map(q => q.id) } : null;
}

export function examMapMarkdown(map: ExamMap, outline: OutlineResult, files: string[]): string {
  const title = new Map(outline.lessons.map(l => [l.key, l.title]));
  const L: string[] = [`# Exam map`, '', `Past paper: ${files.map(f => `\`sources/${f}\``).join(', ')} · ${map.questions.length} questions and parts · ${map.total_marks} marks`, ''];
  L.push('## What the paper weights', '', '| Topic | Marks | Share | Questions |', '|---|---:|---:|---|');
  for (const w of map.weights) {
    const f = foldedInto(map, w.key);
    if (!w.marks && f) L.push(`| ${w.title} (\`${w.key}\`) | — | counted in ${title.get(f.into) ?? f.into} (${f.questions.join(', ')}) | — |`);
    else L.push(`| ${w.title} (\`${w.key}\`) | ${w.marks} | ${pct(w.share)} | ${w.questions.join(', ') || '—'} |`);
  }
  L.push('', '## Every question, and why it matched', '', '| Q | Marks | Counted towards | Matched terms | Runner-up |', '|---|---:|---|---|---|');
  for (const q of map.questions) {
    const best = q.matches.find(m => m.key === q.assigned) ?? q.matches[0];
    const runner = q.matches.find(m => m.key !== q.assigned);
    const to = q.assigned ? `${title.get(q.assigned) ?? q.assigned}${q.assigned_by === 'lead' ? ' (set by the Lead)' : ''}` : '**unmatched**';
    L.push(`| ${q.id} | ${q.marks} | ${to} | ${best?.terms.slice(0, 6).join(', ') || '—'} | ${runner ? `${title.get(runner.key) ?? runner.key} (${runner.score})` : '—'} |`);
  }
  L.push('', '## Question text', '');
  for (const q of map.questions) L.push(`- **${q.id}** [${q.marks}]${q.locator ? ` (${q.locator})` : ''}: ${q.text.slice(0, 220)}${q.text.length > 220 ? '…' : ''}`);
  if (map.unmatched.length) L.push('', '## Unmatched', '', `${map.unmatched.join(', ')}: no topic shares enough words with these. Assign them by hand if a topic covers them.`);
  L.push('', '## Fix a wrong match', '', 'Run `exam-map --assign "Q3=<topic key>"` (a whole question) or `--assign "Q3b=<topic key>"` (one part). Topic keys:', '');
  L.push(outline.lessons.map(l => `\`${l.key}\``).join(' · '), '');
  return L.join('\n');
}

export const examMap: ExamMapFn = async (ctx, opts) => {
  const p = coursePaths(ctx.course);
  const ingest = readIngest(ctx.course);
  const outline = readOutline(ctx.course);
  const papers = ingest.files.filter(f => f.role === 'past_paper');
  if (!papers.length) throw new BilimindError('No past paper among the sources.',
    'If one of the files is a past paper, run `ingest --role "<file>=past_paper"`; otherwise skip exam-map and plan from the outline alone.');
  const chunkById = new Map(ingest.chunks.map(c => [c.id, c]));
  const docs = topicDocs(outline, chunkById);
  const parentOf = new Map(outline.lessons.map(l => [l.key, l.track === 'subtopic' ? l.branch_of : undefined]));
  const questions: ExamQuestion[] = [];
  const scored = new Map<ExamQuestion, ReturnType<typeof scoreParts>>();
  papers.forEach((f, fi) => {
    const { text, spans } = joinFileChunks(ingest.chunks.filter(c => c.material_id === f.material_id));
    for (const q of parseExamQuestions(text, f.name)) {
      if (fi > 0) q.id = `P${fi + 1}-${q.id}`;
      const probe = q.text.replace(/^[^:]*:\s*/, '').slice(0, 40);
      const at = probe ? text.replace(/\s+/g, ' ').indexOf(probe) : -1;
      const span = at >= 0 ? spans.find(s => text.slice(0, s.end).replace(/\s+/g, ' ').length > at) : undefined;
      if (span) { q.chunk_id = span.chunk.id; q.locator = span.chunk.locator; }
      scored.set(q, scoreParts(q, docs));
      questions.push(q);
    }
  });
  // pass 1: each part on its own text; pass 2: near-ties go to the family its sibling parts chose
  const family = (k: string | null) => (k ? parentOf.get(k) ?? k : null);
  const first = new Map(questions.map(q => [q, pickTopic(scored.get(q)!.body, parentOf)]));
  for (const q of questions) {
    const { body, head } = scored.get(q)!;
    const siblings = questions.filter(o => o !== q && o.number === q.number && o.file === q.file);
    const votes = (key: string) => siblings.filter(o => family(first.get(o) ?? null) === family(key)).length;
    const all = breakTies(body, head, votes);
    q.assigned = pickTopic(all, parentOf);
    // the best-matching subtopic was folded into its parent: remember it (plan/report say "counted in <parent>")
    if (all[0] && q.assigned && all[0].key !== q.assigned && parentOf.get(all[0].key) === q.assigned) (q as ExamQuestion & { folded_from?: string }).folded_from = all[0].key;
    q.matches = [...all.filter(m => m.key === q.assigned), ...all.filter(m => m.key !== q.assigned)].slice(0, 3);
  }
  if (!questions.length) throw new BilimindError(`Found no "Question N" / "(a)" / "[N marks]" structure in ${papers.map(f => f.name).join(', ')}.`,
    'Check the file is a text PDF (not a scan); exam-map needs question numbers and marks.');

  const keys = new Set(outline.lessons.map(l => l.key));
  // G2 review: earlier --assign fixes persist; a later call re-applies them unless it assigns the same question again
  const previous = readJsonOrNull<ExamMap>(p.examMap);
  const assign: Record<string, string> = {};
  for (const q of previous?.questions ?? []) if (q.assigned_by === 'lead' && q.assigned && keys.has(q.assigned)) assign[q.id] = q.assigned;
  const kept = new Set(Object.keys(assign));     // earlier fixes: skipped quietly if the paper no longer has that part
  const reapplied: string[] = [];
  for (const [rawId, key] of Object.entries(opts.assign ?? {})) {
    // a new fix replaces earlier fixes of the same question or its parts (Q1 replaces Q1a..; never Q10a)
    const id = rawId.trim().toUpperCase();
    for (const k of Object.keys(assign)) if (k.toUpperCase() === id || new RegExp(`^${id.replace(/[^A-Z0-9-]/g, '')}[A-H]$`).test(k.toUpperCase())) delete assign[k];
    kept.delete(rawId);
    assign[rawId] = key;
  }
  for (const [rawId, key] of Object.entries(assign)) {
    if (!keys.has(key)) throw new BilimindError(`--assign ${rawId}=${key}: no topic with key "${key}".`, `Topic keys: ${[...keys].join(', ')}`);
    const id = rawId.trim().toUpperCase();
    const hit = questions.filter(q => q.id.toUpperCase() === id || `Q${q.number}` === id || q.id.toUpperCase().startsWith(id + '-'));
    if (!hit.length && kept.has(rawId)) continue;
    if (!hit.length) throw new BilimindError(`--assign: no question ${rawId}.`, `Questions: ${questions.map(q => q.id).join(', ')}`);
    if (kept.has(rawId)) reapplied.push(`${rawId}=${key}`);
    for (const q of hit) { q.assigned = key; q.assigned_by = 'lead'; delete (q as ExamQuestion & { folded_from?: string }).folded_from; }
  }

  const total = questions.reduce((s, q) => s + q.marks, 0);
  const map: ExamMap = {
    questions, total_marks: total, weights: weightsOf(questions, outline, total),
    unmatched: questions.filter(q => !q.assigned).map(q => q.id),
  };
  writeJson(p.examMap, map);
  writeText(p.examMapMd, examMapMarkdown(map, outline, papers.map(f => f.name)));
  const data: ExamMapData = {
    questions: questions.length, total_marks: total,
    weights: map.weights.filter(w => w.marks > 0).map(w => ({ key: w.key, title: w.title, marks: w.marks, share: w.share, questions: w.questions })),
    unmatched: map.unmatched,
  };
  // a subtopic whose questions are counted in its parent is not a zero-mark topic (G2 review)
  const folded: Record<string, { into: string; questions: string[] }> = {};
  for (const w of map.weights) { const f = foldedInto(map, w.key); if (!w.marks && f) folded[w.key] = f; }
  const zero = map.weights.filter(w => w.marks === 0 && !folded[w.key]).map(w => w.key);
  return Object.assign(data, { zero_mark_topics: zero, ...(Object.keys(folded).length ? { counted_in_parent: folded } : {}), report: 'crew/exam-map.md', ...(reapplied.length ? { reapplied } : {}) });
};

export const readExamMap: ReadExamMap = course => readJsonOrNull<ExamMap>(coursePaths(course).examMap);
