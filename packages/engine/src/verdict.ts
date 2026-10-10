// `verdict`: applies the Checker's rulings; refuses non-verbatim quotes.
// Owner: WP3. Keep the export names and types (src/contracts.ts); replace the stubs in place.
// A ruling is accepted only when its quote is a verbatim (whitespace-normalised) substring of one of the item's chunks
// (validate/lesson.ts itemChunkIds: its own cite_chunk_ids + its block's source_material_ids, else the lesson's).
// Normalisation: NFKC, curly quotes -> straight, dashes/minus -> '-', soft hyphens dropped, whitespace collapsed.
// `...` / `…` inside a quote skips words: every piece must appear, in order, in the SAME chunk. Case is kept.
// Accepted rulings update the draft item (never deleting it) and append to crew/verdicts/<k>.json.
import type { Assessment, Chunk, ItemLabel, Verdict } from '@bilimind/core';
import { VERDICTS } from '@bilimind/core';
import { BilimindError } from './contracts.ts';
import type { Ctx, FindQuote, ReadVerdicts, VerdictData, VerdictFn, VerdictInput } from './contracts.ts';
import { coursePaths, readJsonOrNull, writeJson } from './course.ts';
import { loadDraft, saveDraft, withLessonLock } from './validate/check.ts';
import { chunksFor, findItem, itemChunkIds, loadCourseData, outlineLessonOf } from './validate/lesson.ts';
import type { CourseData } from './validate/lesson.ts';

export const normaliseQuoteText = (t: string): string => t
  .normalize('NFKC')
  .replace(/[‘’‚‛′`´]/g, "'")
  .replace(/[“”„‟″«»]/g, '"')
  .replace(/[‐-―−﹘﹣－]/g, '-')
  .replace(/­/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/** The quote split into the pieces that must all appear in order ("a ... b" -> ["a", "b"]); surrounding quote marks dropped. */
export function quotePieces(quote: string): string[] {
  let q = normaliseQuoteText(quote);
  q = q.replace(/^["'\s]+|["'\s]+$/g, '').replace(/^\.\.\.\s*|\s*\.\.\.$/g, '').replace(/^["'\s]+|["'\s]+$/g, '');
  return q.split(/\s*\.\.\.\s*/).map(x => x.trim()).filter(Boolean);
}

function chunkHas(content: string, pieces: string[]): boolean {
  const hay = normaliseQuoteText(content);
  let from = 0;
  for (const p of pieces) {
    const at = hay.indexOf(p, from);
    if (at < 0) return false;
    from = at + p.length;
  }
  return pieces.length > 0;
}

export const findQuote: FindQuote = (quote, chunks) => {
  const pieces = quotePieces(quote ?? '');
  if (!pieces.length) return null;
  return chunks.find(c => chunkHas(c.content, pieces)) ?? null;
};

export const readVerdicts: ReadVerdicts = (course, key) => readJsonOrNull<Verdict[]>(coursePaths(course).verdictsJson(key)) ?? [];

const wordsIn = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

const ANSWER_STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'its', 'not', 'only', 'one', 'two', 'all', 'each',
  'every', 'into', 'than', 'then', 'when', 'which', 'what', 'have', 'has', 'can', 'will', 'more', 'less', 'same', 'other', 'both', 'none']);
/** Numbers and content words of an item's accepted answer (deterministic kinds only; [] = no check). */
export function answerTerms(item: Assessment): string[] {
  const k = (item.answer_key ?? {}) as Record<string, unknown>;
  const opt = (id: unknown) => (item.options ?? []).find(o => o.id === id)?.text ?? '';
  let text = '';
  if (item.kind === 'mcq' || item.kind === 'multi_select') text = ((k.correct_option_ids as unknown[]) ?? []).map(opt).join(' ');
  else if (item.kind === 'cloze') text = ((k.accepted as unknown[]) ?? []).map(String).join(' ');
  else return [];   // numeric and ordering answers are computed (a trace, a probe count): the slide states the rule, not the result
  const toks = normaliseQuoteText(text).toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}()^.]*/gu) ?? [];
  return [...new Set(toks.map(t => t.replace(/[.]+$/, '')).filter(t => /\d/.test(t) || (t.length >= 3 && !ANSWER_STOP.has(t))))];
}
/** True when the chunk mentions at least one answer term (or the item has none to check). */
export function mentionsAnswer(content: string, item: Assessment): boolean {
  const terms = answerTerms(item);
  if (!terms.length) return true;
  const hay = normaliseQuoteText(content).toLowerCase();
  return terms.some(t => (/^\d+$/.test(t) ? new RegExp(`(^|[^\\d.])${t}([^\\d]|$)`).test(hay) : hay.includes(t)));
}

export const verdict: VerdictFn = async (ctx, opts) => {
  const key = opts.lesson;
  if (!key) throw new BilimindError('verdict needs --lesson <key>', 'Lesson keys are in crew/outline.json.');
  const rulings = opts.rulings ?? [];
  if (!rulings.length) throw new BilimindError('No rulings given', 'Pass --item q3 --verdict supported --quote "<verbatim>" --reason "<why>", or --file rulings.json.');
  const data = loadCourseData(ctx.course);
  if (!data.ingest) throw new BilimindError('crew/ingest.json is missing', 'Run `ingest` first: quotes are checked against the source chunks.');
  return withLessonLock(ctx.course, key, () => applyRulings(ctx, key, rulings, data));
};

function applyRulings(ctx: Ctx, key: string, rulings: VerdictInput[], data: CourseData): VerdictData {
  const lesson = loadDraft(ctx.course, key);
  const fallback = outlineLessonOf(data, key)?.chunk_ids ?? [];
  const history = readVerdicts(ctx.course, key);
  const at = ctx.now().toISOString();
  const result: VerdictData = { applied: 0, refused: [], excluded: 0, labelled: 0 };
  const accepted: Verdict[] = [];

  for (const r of rulings) {
    const id = String(r.item ?? '').trim();
    const refuse = (why: string) => { result.refused.push({ item: id || '(none)', why }); ctx.progress(`verdict ${key} ${id}: REFUSED, ${why}`); };
    const ref = findItem(lesson, id);
    if (!ref) { refuse(`no item ${id || '(empty id)'} in lesson ${key}`); continue; }
    if (!(VERDICTS as readonly string[]).includes(r.verdict)) { refuse(`verdict must be supported, contradicted or not_covered (got "${r.verdict}")`); continue; }
    const quote = String(r.quote ?? '').trim();
    const reason = String(r.reason ?? '').trim();
    const ids = itemChunkIds(lesson, ref.block, ref.item, fallback);
    const chunks = chunksFor(data, ids);
    let chunk: Chunk | null = null;
    if (!quote) {
      if (r.verdict !== 'not_covered') { refuse(`a ${r.verdict} ruling needs a verbatim quote from the item's excerpts`); continue; }
    } else {
      const pieces = quotePieces(quote);
      const joined = pieces.join(' ');
      if (wordsIn(joined) < 3 && joined.length < 12) { refuse(`quote "${quote}" is too short to decide anything (use at least 3 words)`); continue; }
      chunk = findQuote(quote, chunks);
      if (!chunk) {
        refuse(chunks.length
          ? `quote is not verbatim in the item's excerpts (chunks ${ids.join(', ')}); copy it exactly from crew/evidence/${key}.md`
          : 'the item cites no source chunks, so no quote can be verified; rule not_covered with an empty quote');
        continue;
      }
    }
    if (r.verdict === 'contradicted' && !reason) { refuse('a contradicted ruling needs a reason (it is shown in the receipts)'); continue; }
    // G2 review: a "supported" quote must come from a slide that mentions the answer (a number or keyword of it);
    // an ADT bullet run is not evidence for a load-factor answer.
    if (r.verdict === 'supported' && chunk && !mentionsAnswer(chunk.content, ref.item)) {
      refuse(`quote does not mention the answer: chunk ${chunk.id} has none of "${answerTerms(ref.item).slice(0, 5).join('", "')}"`);
      continue;
    }

    const item = ref.item;
    const prevQuote = item.quote;
    item.status = r.verdict;
    item.reason = reason;
    if (quote) item.quote = quote; else delete item.quote;
    if (chunk) item.cite_chunk_ids = [chunk.id];
    const labels = new Set<ItemLabel>((item.labels ?? []).filter(l => l !== 'beyond_slides'));
    if (r.verdict === 'not_covered') labels.add('beyond_slides');
    if (labels.size) item.labels = [...labels]; else delete item.labels;
    // G2 review: keep the Writer's explanation (a slide fragment is not a "why"); the quote lives on as the item's
    // cite (cite_chunk_ids + quote), which the player shows as "Your slide says". Only an item with no explanation
    // falls back to the quote.
    if (r.verdict === 'supported' && !item.explanation?.trim()) item.explanation = quote;
    else if (r.verdict !== 'supported' && item.explanation && item.explanation === prevQuote) delete item.explanation;

    const round = item.replaces ? 2 : 1 + history.filter(v => v.item === id).length + accepted.filter(v => v.item === id).length;
    accepted.push({ lesson: key, item: id, verdict: r.verdict, quote, reason, chunk_id: chunk?.id ?? null, round, at });
    result.applied++;
    if (r.verdict === 'contradicted') {
      result.excluded++;
      lesson.repairs = [...(lesson.repairs ?? []), `checker: ${id} contradicted by chunk ${chunk?.id}: ${reason}`];
    }
    if (r.verdict === 'not_covered') result.labelled++;
    ctx.progress(`verdict ${key} ${id}: ${r.verdict}${chunk ? ` (chunk ${chunk.id})` : ''}`);
  }

  if (accepted.length) {
    saveDraft(ctx.course, lesson);
    writeJson(coursePaths(ctx.course).verdictsJson(key), [...history, ...accepted]);
  }
  return result;
}
