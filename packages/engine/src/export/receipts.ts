// The receipts slab ("Checked before you saw it"): every number computed from crew/log.jsonl (each command's
// LogEvent.data) plus the course itself. Nothing here is estimated or typed by hand.
// Owner: WP4.
import type { CourseLesson, LogEvent, Receipts } from '@bilimind/core';
import type { CheckData, CodeTestData, ComputeReceipts, VerdictData } from '../contracts.ts';
import { DEFAULT_TIMEZONE, zoned } from './time.ts';
import { quizCard } from './anki-csv.ts';

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const okEvents = (log: LogEvent[], cmd: string) => log.filter(e => e.ok && e.cmd === cmd);
const lessonOf = (e: LogEvent): string => e.lesson ?? (typeof e.data?.lesson === 'string' ? e.data.lesson : '') ?? '';

export interface CheckTally { run: number; passed: number; repaired: number; flagged: number; lessons: Record<string, { first: CheckData; last: CheckData; rounds: number }> }

/** Latest `check` round per lesson: run/passed/flagged; repaired = failures fixed since round 1 + auto-fixes. */
export function tallyChecks(log: LogEvent[]): CheckTally {
  const lessons: CheckTally['lessons'] = {};
  for (const e of okEvents(log, 'check')) {
    const d = e.data as unknown as CheckData | undefined;
    if (!d || typeof d !== 'object') continue;
    const key = lessonOf(e) || '?';
    const cur = lessons[key];
    if (!cur) lessons[key] = { first: d, last: d, rounds: 1 };
    else { cur.last = d; cur.rounds += 1; }
  }
  let run = 0, passed = 0, repaired = 0, flagged = 0;
  for (const { first, last } of Object.values(lessons)) {
    const failedLast = Array.isArray(last.failed) ? last.failed.length : 0;
    const failedFirst = Array.isArray(first.failed) ? first.failed.length : 0;
    run += num(last.total) || num(last.passed) + failedLast;
    passed += num(last.passed);
    flagged += failedLast;
    repaired += Math.max(0, failedFirst - failedLast) + (Array.isArray(last.auto_fixed) ? last.auto_fixed.length : 0);
  }
  return { run, passed, repaired, flagged, lessons };
}

export interface CodeTally { run: number; passed: number; fixed: number; disabled: number; blocks: Record<string, { first: CodeTestData['blocks'][number]; last: CodeTestData['blocks'][number] }> }

/** Latest code-test report per lesson block: tests run/passed against the reference; fixed = failed first, passes now. */
export function tallyCode(log: LogEvent[]): CodeTally {
  const blocks: CodeTally['blocks'] = {};
  for (const e of okEvents(log, 'code-test')) {
    const d = e.data as unknown as CodeTestData | undefined;
    for (const b of Array.isArray(d?.blocks) ? d!.blocks : []) {
      if (!b || typeof b.block !== 'number') continue;
      const key = `${lessonOf(e) || '?'}/b${b.block}`;
      const cur = blocks[key];
      if (!cur) blocks[key] = { first: b, last: b };
      else cur.last = b;
    }
  }
  let run = 0, passed = 0, fixed = 0, disabled = 0;
  for (const { first, last } of Object.values(blocks)) {
    if (last.disabled) { disabled += 1; continue; }
    run += num(last.reference?.total);
    passed += num(last.reference?.passed);
    const firstFailed = num(first.reference?.total) > num(first.reference?.passed);
    const nowPasses = num(last.reference?.total) > 0 && num(last.reference?.passed) === num(last.reference?.total);
    if (firstFailed && nowPasses) fixed += 1;
  }
  return { run, passed, fixed, disabled, blocks };
}

export interface VerdictTally { applied: number; refused: number; excluded: number; labelled: number; rewrites: number }
export function tallyVerdicts(log: LogEvent[]): VerdictTally {
  let applied = 0, refused = 0, excluded = 0, labelled = 0;
  for (const e of okEvents(log, 'verdict')) {
    const d = e.data as unknown as VerdictData | undefined;
    applied += num(d?.applied);
    refused += Array.isArray(d?.refused) ? d!.refused.length : 0;
    excluded += num(d?.excluded);
    labelled += num(d?.labelled);
  }
  // verdict --auto rewrites inside the same command (data.rewritten), the WorkBuddy Checker via rewrite-item
  const autoRewrites = okEvents(log, 'verdict').reduce((s, e) => s + (Array.isArray((e.data as { rewritten?: unknown[] } | undefined)?.rewritten) ? (e.data as { rewritten: unknown[] }).rewritten.length : 0), 0);
  return { applied, refused, excluded, labelled, rewrites: okEvents(log, 'rewrite-item').length + autoRewrites };
}

/** Wall time of the run: first event start to last event end. */
export function wallMs(log: LogEvent[]): number {
  const times = log.map(e => ({ end: Date.parse(e.ts), ms: num(e.ms) })).filter(t => Number.isFinite(t.end));
  if (!times.length) return 0;
  const start = Math.min(...times.map(t => t.end - t.ms));
  const end = Math.max(...times.map(t => t.end));
  return Math.max(0, Math.round(end - start));
}

export const totalCost = (log: LogEvent[]): number => Math.round(log.reduce((s, e) => s + num(e.cost_usd), 0) * 1e6) / 1e6;

/** One line per log event for "See what each agent did". */
export function receiptLog(log: LogEvent[], tz: string = DEFAULT_TIMEZONE): Receipts['log'] {
  return log.filter(e => e.cmd).map(e => {
    const at = new Date(e.ts);
    const result = e.result ?? (e.cmd === 'note' ? e.args ?? '' : '') ?? '';
    return {
      t: Number.isFinite(at.getTime()) ? zoned(at, tz).time : '',
      agent: e.agent || 'Lead',
      action: e.cmd,
      result: e.ok ? String(result || 'done') : `failed: ${result || 'error'}`,
    };
  });
}

const allItems = (lessons: readonly CourseLesson[]) => lessons.flatMap(l => l.blocks.flatMap(b => b.assessments));
const AUTO = new Set(['mcq', 'multi_select', 'ordering', 'numeric', 'cloze']);

/**
 * One identity per agent: "Writer binary_search_trees_operations" and "Writer · Binary search trees…" are the same
 * Writer (G2 review: the receipts counted duplicate names as extra agents).
 */
export function agentIdentity(agent: string, lessons: readonly CourseLesson[]): string {
  const a = (agent || 'Lead').trim();
  const role = (a.match(/^(lead|writer|coder|checker)\b/i)?.[1] ?? a).toLowerCase();
  if (role !== 'writer') return role;
  const rest = a.replace(/^writer\s*[·:-]?\s*/i, '').trim().toLowerCase();
  const hit = lessons.find(l => rest === l.id.toLowerCase() || rest === l.title.toLowerCase() || (rest.length > 8 && l.title.toLowerCase().startsWith(rest.replace(/…$/, ''))));
  return `writer:${hit?.id ?? rest}`;
}

/** Flashcards + cloze items (what goes into deck.csv). */
export function countCards(lessons: readonly CourseLesson[]): number {
  let n = 0;
  for (const l of lessons) for (const b of l.blocks) {
    if (b.type === 'flashcards') n += (b.payload as { cards?: unknown[] }).cards?.length ?? 0;
    n += b.assessments.filter(a => a.kind === 'cloze').length;
  }
  // same as deck.csv: plus every quiz item with a short checkable answer (G2 review)
  for (const l of lessons) for (const b of l.blocks) n += b.assessments.filter(a => a.kind !== 'cloze' && quizCard(a)).length;
  return n;
}

export const computeReceipts: ComputeReceipts = ({ course, log, files, excluded }) => {
  const checks = tallyChecks(log);
  const code = tallyCode(log);
  const verdicts = tallyVerdicts(log);
  const lessons = course.lessons ?? [];
  const narrationMs = lessons.reduce((s, l) => s + num(l.narration?.duration_ms), 0) + num(course.narration?.duration_ms);
  const tz = course.goal?.timezone || DEFAULT_TIMEZONE;
  return {
    files: files.length,
    pages: files.reduce((s, f) => s + Math.max(0, Math.round(num(f.pages))), 0),
    steps: (course.path ?? []).length,
    lessons: lessons.length,
    agents: new Set(log.map(e => e.agent).filter(Boolean).map(a => agentIdentity(a, lessons))).size,
    checks: { run: checks.run, passed: checks.passed, repaired: checks.repaired, flagged: checks.flagged },
    tests: { run: code.run, passed: code.passed },
    code_fixed: code.fixed,
    // items that carry a ruling now (a supported/not_covered/contradicted status), not ruling events
    quiz_checked: Math.min(verdicts.applied, allItems(lessons).filter(a => AUTO.has(a.kind) && a.verdict && a.verdict !== 'pending' && a.verdict !== 'unchecked').length + excluded.length),
    quiz_items: allItems(lessons).filter(a => AUTO.has(a.kind)).length + excluded.length,
    cut_steps: (course.path ?? []).filter(t => t.cut).length,
    blocks: lessons.reduce((s, l) => s + l.blocks.length, 0),
    items: allItems(lessons).length,
    code_exercises: lessons.reduce((s, l) => s + l.blocks.filter(b => b.type === 'code').length, 0),
    rejected: excluded.length,
    rewritten: verdicts.rewrites,
    labels: { beyond_slides: allItems(lessons).filter(a => a.labels?.includes('beyond_slides')).length },
    narration_min: Math.round(narrationMs / 6000) / 10,
    cards: countCards(lessons),
    minutes: lessons.reduce((s, l) => s + num(l.minutes), 0),
    cost_usd: totalCost(log),
    credits: null,
    wall_ms: wallMs(log),
    log: receiptLog(log, tz),
    excluded,
  };
};
