// Deterministic graders: port of backend/app/Services/Grading/DeterministicGrader.php + AnswerNormaliser +
// GradingPolicy (engine-port.md §4.2). Used by the player AND by `bilimind grade`, so an item grades the
// same everywhere. Feedback never reveals the key (no ids, no accepted strings, no expected value).
import type { AnswerKey, AssessmentKind, AssessmentOption } from './types.ts';

/** Minimal shape a grader needs; both the draft Assessment and the course item satisfy it. */
export interface GradableItem {
  kind: AssessmentKind;
  grader?: string;                        // 'self' on a code item = exercise disabled by the Coder: learner marks it
  options?: AssessmentOption[];
  answer_key?: (AnswerKey & Record<string, unknown>) | null;
  max_score?: number;
}

export interface GradeResult {
  kind: AssessmentKind;
  status: 'graded' | 'pending' | 'self';   // pending = no usable key / nothing to grade; self = learner marks it
  score: number;                          // integer points on the item's own scale
  max_score: number;
  ratio: number;                          // 0..1
  correct: boolean;                       // full marks
  passed: boolean;                        // >= 70% (passMark)
  feedback: string;
  direction?: 'too_high' | 'too_low' | 'exact';   // numeric only
  meta?: Record<string, unknown>;
}

// ---------- GradingPolicy ----------
export const PASS_PERCENT = 70;
export const passMark = (maxScore: number): number => Math.ceil(Math.max(0, maxScore) * PASS_PERCENT / 100);
export const isPassed = (score: number, maxScore: number): boolean => score >= passMark(maxScore);
export const scoreFromRatio = (ratio: number, maxScore: number): number =>
  Math.round(Math.max(0, Math.min(1, ratio)) * Math.max(0, maxScore));

const DEFAULT_MAX = 100;
const maxOf = (item: GradableItem) => (item.max_score && item.max_score > 0 ? item.max_score : DEFAULT_MAX);

function result(item: GradableItem, ratio: number, feedback: string, extra: Partial<GradeResult> = {}): GradeResult {
  const max = maxOf(item);
  const score = scoreFromRatio(ratio, max);
  return { kind: item.kind, status: 'graded', score, max_score: max, ratio: Math.max(0, Math.min(1, ratio)),
    correct: score === max, passed: isPassed(score, max), feedback, ...extra };
}
function pending(item: GradableItem, feedback: string, status: 'pending' | 'self' = 'pending'): GradeResult {
  return { kind: item.kind, status, score: 0, max_score: maxOf(item), ratio: 0, correct: false, passed: false, feedback };
}
const missingKey = (item: GradableItem) => pending(item, 'This item has no answer key, so it cannot be auto-graded.');

// ---------- AnswerNormaliser ----------
/**
 * trim, casefold, drop apostrophes/quotes entirely ("don't" === "dont"), every other punctuation/symbol run
 * becomes one space, collapse whitespace. No accent folding, no stemming.
 */
export function normaliseAnswer(value: string): string {
  return value
    .replace(/['‘’“”"`]+/gu, '')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}
export function matchesAny(value: string, accepted: readonly unknown[]): boolean {
  const needle = normaliseAnswer(value);
  if (!needle) return false;
  return accepted.some(c => (typeof c === 'string' || typeof c === 'number') && normaliseAnswer(String(c)) === needle);
}

/**
 * Tolerant number parsing: strips spaces / thin spaces / apostrophes, the LAST of ',' and '.' is the decimal
 * separator ("13,04" and "13.04" are both 13.04; "1.234,5" is 1234.5; "1,234.5" is 1234.5), first number wins,
 * a trailing unit is ignored. Returns null when nothing numeric is found.
 */
export function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  let t = value.trim();
  if (!t) return null;
  t = t.replace(/[    ']/g, '');
  const lastComma = t.lastIndexOf(',');
  const lastDot = t.lastIndexOf('.');
  if (lastComma !== -1 && (lastDot === -1 || lastComma > lastDot)) t = t.replace(/\./g, '').replace(/,/g, '.');
  else t = t.replace(/,/g, '');
  const m = t.match(/-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

// ---------- key readers (aliases, as the PHP grader) ----------
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter(x => (typeof x === 'string' || typeof x === 'number') && String(x).trim() !== '').map(x => String(x).trim()) : [];

export function expectedOptionIds(item: GradableItem): string[] {
  const k = (item.answer_key ?? {}) as Record<string, unknown>;
  for (const c of ['correct_option_ids', 'correct', 'option_ids', 'accepted', 'values']) {
    const ids = strList(k[c]);
    if (ids.length) return [...new Set(ids)];
  }
  for (const c of ['correct_option_id', 'option_id', 'value']) {
    const v = k[c];
    if ((typeof v === 'string' || typeof v === 'number') && String(v).trim()) return [String(v).trim()];
  }
  // last resort: options flagged correct: true
  return (item.options ?? []).filter(o => (o as unknown as { correct?: unknown }).correct === true).map(o => o.id);
}

export function expectedOrder(item: GradableItem): string[] {
  const k = (item.answer_key ?? {}) as Record<string, unknown>;
  for (const c of ['correct_order', 'order', 'sequence', 'correct_option_ids', 'correct', 'answer', 'values']) {
    const ids = strList(k[c]);
    if (ids.length > 1 && new Set(ids).size === ids.length) return ids;   // duplicates make "before" undefined
  }
  return [];
}

export function expectedBlanks(item: GradableItem): string[][] {
  const k = (item.answer_key ?? {}) as Record<string, unknown>;
  if (Array.isArray(k.blanks)) {
    return k.blanks.map(b => (Array.isArray(b) ? strList(b)
      : b && typeof b === 'object' ? strList((b as Record<string, unknown>).accepted)
      : strList([b]))).filter(b => b.length);
  }
  const acc = strList(k.accepted);
  return acc.length ? [acc] : [];
}

// ---------- graders ----------
/** mcq: exact option id. */
export function gradeMcq(item: GradableItem, optionId: string | null | undefined): GradeResult {
  const expected = expectedOptionIds(item);
  if (!expected.length) return missingKey(item);
  const ok = !!optionId && expected.includes(optionId);
  return result(item, ok ? 1 : 0, ok ? 'Correct.'
    : 'Not quite. Re-read the lesson section this question came from, then try again — the wording of the options matters here.',
  { meta: { rule: 'exact_option_id' } });
}

/** multi_select: Jaccard |S ∩ E| / |S ∪ E| partial credit; over-selecting costs marks. */
export function gradeMultiSelect(item: GradableItem, optionIds: readonly string[]): GradeResult {
  const expected = expectedOptionIds(item);
  if (!expected.length) return missingKey(item);
  const selected = [...new Set(optionIds.filter(Boolean))];
  const inter = selected.filter(id => expected.includes(id));
  const union = new Set([...selected, ...expected]);
  const ratio = union.size === 0 ? 1 : inter.length / union.size;
  const missed = expected.length - inter.length;
  const spurious = selected.length - inter.length;
  let feedback: string;
  if (inter.length === expected.length && spurious <= 0) feedback = 'Correct — you found every option that applies and included none that do not.';
  else {
    const parts = [`You identified ${inter.length} of the ${expected.length} options that apply.`];
    if (missed > 0) parts.push(`${missed} ${missed === 1 ? 'is' : 'are'} still missing.`);
    if (spurious > 0) parts.push(`You also selected ${spurious} option${spurious === 1 ? '' : 's'} that ${spurious === 1 ? 'does' : 'do'} not belong — partial credit is the overlap between your set and the correct set, so over-selecting costs marks.`);
    feedback = parts.join(' ');
  }
  return result(item, ratio, feedback, { meta: { rule: 'jaccard_partial_credit', matched: inter.length, expected: expected.length, missed, spurious, ratio: Math.round(ratio * 10000) / 10000 } });
}

/**
 * ordering: credit = (consecutive pairs in correct relative order / pairs) x (placed / expected).
 * Never reveals the order.
 */
export function gradeOrdering(item: GradableItem, order: readonly string[]): GradeResult {
  const expected = expectedOrder(item);
  if (expected.length < 2) return missingKey(item);
  const rank = new Map(expected.map((id, i) => [id, i]));
  const given = order.filter(id => id !== '');
  if (!given.length) return result(item, 0, 'Nothing was submitted for this ordering item.', { meta: { rule: 'consecutive_pair_order', pairs_total: 0, pairs_correct: 0 } });
  const ranked = given.map(id => rank.get(id)).filter((p): p is number => p !== undefined);
  const pairs = Math.max(0, ranked.length - 1);
  let correctPairs = 0;
  for (let i = 0; i < pairs; i++) if (ranked[i]! < ranked[i + 1]!) correctPairs++;
  let inPlace = 0;
  given.forEach((id, i) => { if (expected[i] === id) inPlace++; });
  const coverage = ranked.length / expected.length;
  const ratio = pairs === 0 ? 0 : (correctPairs / pairs) * coverage;
  const perfect = correctPairs === pairs && pairs === expected.length - 1;
  let feedback: string;
  if (ranked.length < expected.length) feedback = `Only ${ranked.length} of the ${expected.length} steps were placed, so this cannot score full marks. Every step belongs somewhere in the sequence.`;
  else if (pairs > 0 && correctPairs === pairs) feedback = 'Correct — the whole sequence is in the right order.';
  else feedback = `${correctPairs} of the ${pairs} consecutive pairs are in the right relative order. Work out which step cannot happen until another one is finished, and move that pair first.`;
  return result(item, perfect ? 1 : ratio, feedback, { meta: { rule: 'consecutive_pair_order', pairs_total: pairs, pairs_correct: correctPairs, items_expected: expected.length, items_in_exact_place: inPlace } });
}

/** numeric: within tolerance (default: float noise only); feedback says only too high / too low. */
export function gradeNumeric(item: GradableItem, raw: string | number | null | undefined): GradeResult {
  const k = (item.answer_key ?? {}) as Record<string, unknown>;
  const expected = parseNumber(k.value ?? k.answer ?? k.expected);
  if (expected === null) return missingKey(item);
  let tolerance = parseNumber(k.tolerance);
  const pct = parseNumber(k.tolerance_pct ?? k.tolerance_percent);
  if (tolerance === null && pct !== null) tolerance = Math.abs(expected) * (pct / 100);
  tolerance = Math.max(tolerance ?? 0, Math.abs(expected) * 1e-9, 1e-9);   // 0.1 + 0.2 must count as 0.3
  const given = parseNumber(raw);
  if (given === null) {
    return result(item, 0, raw === null || raw === undefined || raw === ''
      ? 'Nothing was submitted for this item.'
      : 'That could not be read as a number. Enter digits only — units and words are not needed.', { meta: { rule: 'numeric_tolerance', parsed: false } });
  }
  const delta = given - expected;
  const ok = Math.abs(delta) <= tolerance;
  const unit = typeof k.unit === 'string' ? k.unit.trim() : '';
  const direction = ok ? 'exact' : delta > 0 ? 'too_high' : 'too_low';
  const feedback = ok ? 'Correct.'
    : `That is too ${delta > 0 ? 'high' : 'low'}. Re-check the units${unit ? ` (the answer is expected in ${unit})` : ''} and the order of operations — an answer off by a factor of ten is almost always a unit conversion, and an answer off by a little is usually a rounding step taken too early.`;
  return result(item, ok ? 1 : 0, feedback, { direction, meta: { rule: 'numeric_tolerance', parsed: true, direction } });
}

/** cloze: normalised string match per blank (positional); a single string grades blank 1. */
export function gradeCloze(item: GradableItem, answer: string | readonly string[]): GradeResult {
  const blanks = expectedBlanks(item);
  if (!blanks.length) return missingKey(item);
  const given = typeof answer === 'string' ? [answer] : [...answer];
  const wrong: number[] = [];
  let right = 0;
  blanks.forEach((accepted, i) => {
    const a = given[i] ?? '';
    if (a !== '' && matchesAny(a, accepted)) right++; else wrong.push(i + 1);
  });
  const total = blanks.length;
  let feedback: string;
  if (right === total) feedback = total === 1 ? 'Correct.' : `Correct — all ${total} blanks match an accepted answer.`;
  else if (total === 1) feedback = 'That is not one of the accepted answers. Spelling, spacing, capitalisation and punctuation are all ignored, so check the term itself rather than its formatting.';
  else feedback = `${right} of ${total} blanks are right. Blank${wrong.length === 1 ? '' : 's'} ${wrong.join(', ')} did not match an accepted answer — capitalisation, spacing and punctuation are ignored, so re-check the terms themselves.`;
  return result(item, right / total, feedback, { meta: { rule: 'normalised_string_match', blanks_total: total, blanks_correct: right } });
}

/** code: score = passed declared test names / declared names. `declared` = the block's tests[].name. */
export function gradeCode(item: GradableItem, passedNames: readonly string[], declared: readonly string[], timedOut = false): GradeResult {
  if (item.grader === 'self') return pending(item, 'Mark this exercise yourself against the instructions.', 'self');
  const names = declared.length ? [...declared] : strList((item.answer_key as Record<string, unknown> | undefined)?.tests);
  if (!names.length) return pending(item, 'This exercise has no tests, so mark it yourself against the instructions.', 'self');
  const passed = names.filter(n => passedNames.includes(n));
  const failed = names.filter(n => !passedNames.includes(n));
  let feedback: string;
  if (timedOut && passed.length === 0) feedback = 'Your code ran past the time limit and was stopped, so no test could complete. Look for a loop that never ends or a recursive call with no base case.';
  else if (passed.length === names.length) feedback = `All ${names.length} test${names.length === 1 ? '' : 's'} passed.`;
  else {
    const shown = failed.slice(0, 5);
    feedback = `${passed.length} of ${names.length} tests passed. Still failing: ${shown.map(n => `"${n}"`).join(', ')}${failed.length > shown.length ? ` (+${failed.length - shown.length} more)` : ''}. Run them again after each change — the first failing test is usually the one worth fixing.`;
  }
  return result(item, passed.length / names.length, feedback, { meta: { rule: 'declared_tests', passed: passed.length, total: names.length, timed_out: timedOut } });
}

/**
 * short_answer / essay / project offline: the learner sees the rubric + reference answer and marks themselves.
 * `selfRatio` 0..1 (e.g. rubric levels: excellent 1, acceptable 0.6, poor 0, weighted by row weight).
 */
export function gradeSelf(item: GradableItem, selfRatio: number | null | undefined): GradeResult {
  if (selfRatio === null || selfRatio === undefined || Number.isNaN(selfRatio)) return pending(item, 'Write your answer, then compare it with the rubric and mark it yourself.', 'self');
  const r = result(item, selfRatio, 'Self-marked against the rubric.');
  return { ...r, status: 'self' };
}
/** Rubric levels -> ratio: excellent 1, acceptable 0.6, poor 0, weighted by row weight (weights renormalised). */
export const RUBRIC_LEVEL_VALUE = { excellent: 1, acceptable: 0.6, poor: 0 } as const;
export function rubricRatio(rows: readonly { weight: number }[], levels: readonly (keyof typeof RUBRIC_LEVEL_VALUE | null)[]): number {
  const ws = rows.map(r => Math.max(0, r.weight));
  const sum = ws.reduce((a, b) => a + b, 0);
  const w = sum > 0 ? ws : rows.map(() => 1);      // all-zero weights: equal split
  const total = sum > 0 ? sum : rows.length || 1;
  return rows.reduce((s, _r, i) => {
    const lv = levels[i];
    return s + (lv ? RUBRIC_LEVEL_VALUE[lv] * w[i]! : 0);
  }, 0) / total;
}

// ---------- one entry point ----------
export type ItemResponse =
  | { kind: 'mcq'; option_id: string | null }
  | { kind: 'multi_select'; option_ids: string[] }
  | { kind: 'ordering'; order: string[] }
  | { kind: 'numeric'; value: string | number | null }
  | { kind: 'cloze'; text: string | string[] }
  | { kind: 'code'; passed: string[]; declared: string[]; timed_out?: boolean }
  | { kind: 'short_answer' | 'essay' | 'project'; self_ratio: number | null };

export function gradeItem(item: GradableItem, response: ItemResponse): GradeResult {
  switch (response.kind) {
    case 'mcq': return gradeMcq(item, response.option_id);
    case 'multi_select': return gradeMultiSelect(item, response.option_ids);
    case 'ordering': return gradeOrdering(item, response.order);
    case 'numeric': return gradeNumeric(item, response.value);
    case 'cloze': return gradeCloze(item, response.text);
    case 'code': return gradeCode(item, response.passed, response.declared, response.timed_out);
    default: return gradeSelf(item, response.self_ratio);
  }
}

/**
 * Grade a free-text reply (P2 `bilimind grade "1 b, 2 chaining, 3 O(n)"`): mcq takes an option id or the
 * option's text; multi_select "a, c" / "a c"; ordering "c a d b"; numeric and cloze as typed.
 * short_answer/essay/project/code come back as status 'pending' (not gradable from text).
 */
export function gradeFromText(item: GradableItem, reply: string): GradeResult {
  const t = reply.trim();
  const ids = (item.options ?? []).map(o => o.id.toLowerCase());
  const toIds = (s: string) => s.split(/[\s,;/]+/).map(x => x.trim().toLowerCase().replace(/[().]/g, '')).filter(x => ids.includes(x))
    .map(x => item.options!.find(o => o.id.toLowerCase() === x)!.id);
  switch (item.kind) {
    case 'mcq': {
      const byId = toIds(t)[0];
      const byText = (item.options ?? []).find(o => normaliseAnswer(o.text) === normaliseAnswer(t))?.id;
      return gradeMcq(item, byId ?? byText ?? null);
    }
    case 'multi_select': return gradeMultiSelect(item, toIds(t));
    case 'ordering': return gradeOrdering(item, toIds(t));
    case 'numeric': return gradeNumeric(item, t);
    case 'cloze': return gradeCloze(item, t);
    default: return pending(item, 'This item is marked against its rubric, not from a one-line reply.');
  }
}
