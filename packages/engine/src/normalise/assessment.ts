// Port of NodeExpander::normaliseAssessment / capMultipleChoice / demoteToShortAnswer / reconcileCodeAssessments
// (engine-port.md §5.1). Output items match core ASSESSMENT_SCHEMAS (minus `id`, assigned by the lesson
// normaliser). Tightened for the core schemas: an mcq/multi_select/ordering/numeric/cloze item whose answer key
// cannot be repaired is DROPPED (the player could not grade it), an mcq with several correct ids becomes
// multi_select, and a rubric keeps 2-4 rows.
import { ASSESSMENT_KINDS, BLOOM, GRADERS } from '@bilimind/core';
import type { AnswerKey, Assessment, AssessmentKind, Grader, RubricRow } from '@bilimind/core';
import { cap, isObj, letter, number, stringList, text } from './util.ts';
import type { Raw } from './util.ts';
import { workProblems } from '../validate/arith.ts';

export type DraftItem = Omit<Assessment, 'id'> & { id?: string };
export interface ItemResult { item: DraftItem | null; why?: string; note?: string }

const HAS_OPTIONS: readonly AssessmentKind[] = ['mcq', 'multi_select', 'ordering'];
const DEFAULT_GRADER: Record<AssessmentKind, Grader> = {
  mcq: 'deterministic', multi_select: 'deterministic', ordering: 'deterministic', numeric: 'deterministic', cloze: 'deterministic',
  code: 'deterministic', short_answer: 'llm_rubric', essay: 'llm_rubric', project: 'llm_rubric',
};
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/ /g, '_');

function options(v: unknown): { id: string; text: string }[] | null {
  if (!Array.isArray(v)) return null;
  const out: { id: string; text: string }[] = [];
  const seen = new Set<string>();
  v.forEach((row, i) => {
    if (out.length >= 8) return;
    const t = isObj(row) ? text(row, 'text') : typeof row === 'string' ? row.trim() || null : null;   // bare strings too
    if (t === null) return;
    const id = (isObj(row) ? text(row, 'id') : null) ?? letter(i);
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id: cap(id, 8, ''), text: cap(t, 600) });
  });
  return out.length ? out : null;
}

export function rubric(v: unknown): RubricRow[] | null {
  if (!Array.isArray(v)) return null;
  const rows: RubricRow[] = [];
  for (const row of v) {
    const criterion = text(row, 'criterion');
    if (criterion === null) continue;
    rows.push({ criterion, weight: Math.max(0, number((row as Raw).weight) ?? 0),
      excellent: text(row, 'excellent') ?? '—', acceptable: text(row, 'acceptable') ?? '—', poor: text(row, 'poor') ?? '—' });
    if (rows.length >= 4) break;
  }
  if (rows.length < 2) return null;
  const total = rows.reduce((s, r) => s + r.weight, 0);
  for (const r of rows) r.weight = total > 0 ? Math.round((r.weight / total) * 1e4) / 1e4 : Math.round((1 / rows.length) * 1e4) / 1e4;
  return rows;
}

function correctIds(key: Raw, opts: { id: string }[] | null): string[] {
  const raw = key.correct_option_ids ?? key.correct_option_id ?? key.correct ?? key.answer;
  const ids = Array.isArray(raw) ? raw : raw !== undefined && raw !== null ? [raw] : [];
  const valid = (opts ?? []).map(o => o.id);
  const out: string[] = [];
  for (const id of ids) {
    const s = typeof id === 'string' || typeof id === 'number' ? String(id).trim() : '';
    if (valid.includes(s) && !out.includes(s)) out.push(s);
  }
  return out;
}

function completeOrdering(key: Raw, opts: { id: string }[] | null): string[] | null {
  if (!opts || opts.length < 2) return null;
  const expected = opts.map(o => o.id).sort();
  for (const k of ['correct_order', 'order', 'sequence', 'correct_option_ids']) {
    if (!Array.isArray(key[k])) continue;
    const given = (key[k] as unknown[]).filter(v => typeof v === 'string' || typeof v === 'number').map(v => String(v).trim());
    if (given.length === expected.length && new Set(given).size === given.length && [...given].sort().join('\u0000') === expected.join('\u0000')) return given;
  }
  return null;
}

/** One raw item -> a core-shaped item (no id), or null with the reason. */
export function normaliseItem(raw: unknown): ItemResult {
  if (!isObj(raw)) return { item: null, why: 'an item was not an object' };
  let kind = norm(raw.kind) as AssessmentKind;
  let prompt = typeof raw.prompt === 'string' ? raw.prompt.trim() : '';
  if (!(ASSESSMENT_KINDS as readonly string[]).includes(kind) || prompt === '') return { item: null, why: `an item with kind "${String(raw.kind)}" or no prompt was dropped` };
  const opts = HAS_OPTIONS.includes(kind) ? options(raw.options) : null;
  if (HAS_OPTIONS.includes(kind) && (!opts || opts.length < 2)) return { item: null, why: `a ${kind} item with fewer than 2 options was dropped` };
  let grader = norm(raw.grader) as Grader;
  if (!(GRADERS as readonly string[]).includes(grader)) grader = DEFAULT_GRADER[kind];
  const rub = rubric(raw.rubric);
  const rawKey: Raw = isObj(raw.answer_key) ? raw.answer_key : {};
  let key: AnswerKey | undefined;
  let note: string | undefined;

  switch (kind) {
    case 'mcq': case 'multi_select': {
      const ids = correctIds(rawKey, opts);
      if (!ids.length) return { item: null, why: `a ${kind} item had no correct option that exists` };
      if (kind === 'mcq' && ids.length > 1) { kind = 'multi_select'; note = 'an mcq with several correct options became multi_select'; }
      key = { correct_option_ids: ids };
      grader = 'deterministic';
      if (kind === 'multi_select') {
        const fixed = multiPrompt(prompt, ids.length);
        if (fixed !== prompt) { prompt = fixed; note = [note, 'a multi_select prompt that promised the wrong number of answers now says "Select all that apply"'].filter(Boolean).join('; '); }
      }
      break;
    }
    case 'ordering': {
      const order = completeOrdering(rawKey, opts);
      if (!order) return { item: null, why: 'an ordering item whose key does not list every option exactly once was dropped' };
      key = { correct_order: order };
      grader = 'deterministic';
      break;
    }
    case 'numeric': {
      const value = number(rawKey.value ?? rawKey.answer ?? rawKey.expected);
      if (value === null) return { item: null, why: 'a numeric item had no numeric answer' };
      const tol = number(rawKey.tolerance);
      const unit = text(rawKey, 'unit');
      // G2 review: the prompt asks numeric items for a short `work` derivation. Its arithmetic is recomputed and its
      // last number must equal the value; a wrong key (a 69-mod-10 probe count keyed as 5) drops the item rather than
      // mark students wrong. The work is kept on the key (check Q9 and the Checker's packet show it).
      const work = typeof rawKey.work === 'string' && rawKey.work.trim() ? cap(rawKey.work.trim(), 600) : null;
      const bad = work ? workProblems(work, value, tol) : [];
      if (bad.length) return { item: null, why: `a numeric item was dropped: ${bad[0]}` };
      key = { value, ...(tol !== null && tol >= 0 ? { tolerance: tol } : {}), ...(unit ? { unit } : {}), ...(work ? { work } : {}) } as AnswerKey;
      grader = 'deterministic';
      break;
    }
    case 'cloze': {
      const accepted = stringList(rawKey.accepted ?? rawKey.answers ?? (typeof rawKey.answer === 'string' ? [rawKey.answer] : null), 12);
      if (!accepted.length) return { item: null, why: 'a cloze item had no accepted answers' };
      key = { accepted };
      grader = 'deterministic';
      break;
    }
    case 'code': {
      const sol = text(rawKey, 'reference_solution');
      const tests = stringList(rawKey.tests, 12);
      key = { ...(sol ? { reference_solution: sol } : {}), ...(tests.length ? { tests } : {}) };
      if (grader === 'deterministic' && !sol && !tests.length) grader = rub ? 'llm_rubric' : 'self';
      break;
    }
    default: {   // short_answer, essay, project
      const ref = text(rawKey, 'reference_answer');
      key = ref ? { reference_answer: ref } : undefined;
      if (grader === 'deterministic') grader = rub ? 'llm_rubric' : 'self';
    }
  }
  // A rubric-graded item without a rubric falls back to self-assessment, never to a bare score.
  if (grader === 'llm_rubric' && !rub) grader = 'self';
  const max = number(raw.max_score);
  const bloom = norm(raw.bloom);
  // the Writer's "why" (shown after submit; verdict keeps it); a numeric item without one explains with its working
  const why = text(raw, 'explanation') ?? (kind === 'numeric' ? ((key as Raw | undefined)?.work as string | undefined) ?? null : null);
  const item: DraftItem = {
    kind, prompt,
    bloom: ((BLOOM as readonly string[]).includes(bloom) ? bloom : 'understand') as DraftItem['bloom'],
    grader,
    ...(opts ? { options: opts } : {}),
    ...(key ? { answer_key: key } : {}),
    ...(rub ? { rubric: rub } : {}),
    max_score: max !== null ? Math.max(1, Math.min(100, Math.trunc(max))) : 100,
    ...(why ? { explanation: cap(why, 600) } : {}),
  };
  return { item, ...(note ? { note } : {}) };
}

/** "Which two ..." / "Select three ..." (a count the prompt promises). Kept in step with validate/rules.ts MULTI_COUNT. */
const MULTI_COUNT = /\b(which|select|choose|pick|tick|identify|name)\s+(two|three|four|2|3|4)\b/i;
const MULTI_HINT = /more than one|all that apply|select all|choose all|tick all/i;
const COUNTS: Record<string, number> = { two: 2, three: 3, four: 4, '2': 2, '3': 3, '4': 4 };
/**
 * G2 review: "Which two statements are true?" with three correct ids cannot be scored by a student who follows the
 * prompt: drop the count and say "(Select all that apply.)". A count that matches the key is kept.
 */
export function multiPrompt(prompt: string, correct: number): string {
  const m = MULTI_COUNT.exec(prompt);
  let out = prompt;
  if (m && COUNTS[m[2]!.toLowerCase()] !== correct) out = out.replace(MULTI_COUNT, (_all, verb: string) => verb).replace(/\s{2,}/g, ' ');
  if (!MULTI_HINT.test(out) && !(m && COUNTS[m[2]!.toLowerCase()] === correct)) out = `${out.trimEnd()} (Select all that apply.)`;
  return out;
}

/** reconcileCodeAssessments: a code item's test names are DERIVED from its block's tests[].name. */
export function reconcileCode(items: DraftItem[], payload: Raw): DraftItem[] {
  const names = [...new Set((Array.isArray(payload.tests) ? payload.tests : []).map(t => (isObj(t) ? text(t, 'name') : null)).filter((n): n is string => !!n))];
  return items.map(a => {
    if (a.kind !== 'code') return a;
    if (!names.length) {
      const { tests: _t, ...rest } = a.answer_key ?? {};
      return { ...a, grader: 'self', answer_key: rest };
    }
    const out: DraftItem = { ...a, answer_key: { ...(a.answer_key ?? {}), tests: names } };
    if (out.grader === 'self' && !out.rubric) out.grader = 'deterministic';
    return out;
  });
}

/** demoteToShortAnswer: the learner must PRODUCE the answer; reference_answer = the correct option's text. */
export function demoteToShortAnswer(a: DraftItem): DraftItem | null {
  const id = a.answer_key?.correct_option_ids?.[0];
  const ref = a.options?.find(o => o.id === id)?.text;
  if (!ref) return null;
  const { options: _o, rubric: _r, ...rest } = a;
  return { ...rest, kind: 'short_answer', grader: 'self', answer_key: { reference_answer: ref } };
}
