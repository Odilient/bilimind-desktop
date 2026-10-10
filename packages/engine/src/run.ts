// `run`: builders-only harness, the whole pipeline without agents. Never mentioned in SKILL.md.
// Owner: WP6. Also home of `summarize` (the one-line result every command writes to crew/log.jsonl, which REPORT.md
// and the receipts' per-agent log show) and `logStep` (the log wrapper the CLI and this harness share).
import type { LogEvent } from '@bilimind/core';
import { BilimindError } from './contracts.ts';
import type {
  CheckData, CodeTestData, Ctx, DraftData, ExamMapData, IngestData, OutlineData, PlanData, RunFn, VerdictData,
} from './contracts.ts';
import { appendLog } from './log.ts';
import { init, setGoal, todayIn } from './course.ts';
import type { GoalInput } from './contracts.ts';
import type { ExamMap, Goal, Lesson, OutlineResult } from '@bilimind/core';
import { existsSync } from 'node:fs';
import { ingest, readIngest } from './ingest/index.ts';
import { outline, readOutline } from './outline.ts';
import { examMap, readExamMap } from './exam.ts';
import { buildPlan, plan } from './plan.ts';
import { goalDefaults } from './prompts/context.ts';
import { coursePaths, readJsonOrNull, writeJson } from './course.ts';
import { autoCheck, factCheck } from './autocheck.ts';
import { clockSkewMs, skewedNow } from './clock.ts';
import { draft } from './draft.ts';
import { check } from './validate/index.ts';
import { codeTest } from './codework.ts';
import { evidence } from './evidence.ts';
import { narrate } from './tts.ts';
import { exportAll } from './export/index.ts';
import { build } from './build.ts';
import { note } from './log.ts';

// ---------- one-line results (REPORT.md, receipts log) ----------
type AnyData = Record<string, unknown> | null | undefined;
const n = (v: unknown) => (typeof v === 'number' ? v : Array.isArray(v) ? v.length : 0);
const plural = (k: number, w: string) => `${k} ${w}${k === 1 ? '' : 's'}`;

/** The one-line, human result of a command, from its `data`. Never throws. */
export function summarize(cmd: string, data: unknown): string {
  const d = (data ?? {}) as Record<string, unknown>;
  try {
    switch (cmd) {
      case 'init': return `course folder ${String(d.course ?? '').split('/').pop()}`;
      case 'goal': {
        const g = (d.goal ?? {}) as Partial<Goal>;
        return `exam ${g.exam_at ?? 'not given'}, ${g.minutes_per_day ?? '?'} min/day, ${g.audience ?? '?'}, ${plural(n(g.assumptions), 'assumption')}`;
      }
      case 'ingest': {
        const x = d as unknown as IngestData;
        const scans = (x.files ?? []).reduce((s, f) => s + n(f.scanned_pages), 0);
        const papers = (x.files ?? []).filter(f => f.role === 'past_paper').length;
        return `${plural(n(x.files), 'file')}, ${plural(n(x.chunks), 'chunk')}${papers ? `, ${plural(papers, 'past paper')}` : ''}${scans ? `, ${plural(scans, 'scanned page')}` : ''}${n(x.thin_files) ? `, thin: ${x.thin_files.join(', ')}` : ''}`;
      }
      case 'outline': {
        const x = d as unknown as OutlineData;
        return `${plural(n(x.topics), 'topic')}${x.allows_code ? ', with code' : ''}: ${(x.topics ?? []).map(t => t.key).join(', ')}`;
      }
      case 'exam-map': {
        const x = d as unknown as ExamMapData;
        const top = (x.weights ?? []).slice(0, 3).map(w => `${w.key} ${Math.round(w.share * 100)}%`).join(', ');
        return `${plural(x.questions ?? 0, 'question')}, ${x.total_marks ?? 0} marks${top ? `: ${top}` : ''}${n(x.unmatched) ? `, unmatched ${x.unmatched.join(', ')}` : ''}`;
      }
      case 'plan': {
        const x = d as unknown as PlanData;
        return `${plural(n(x.lessons), 'lesson')}, ${x.used_min}/${x.capacity_min} min, ${plural(x.reviews ?? 0, 'review')}${n(x.warnings) ? `, ${plural(n(x.warnings), 'warning')}` : ''}`;
      }
      case 'draft': {
        const x = d as unknown as DraftData;
        return `${plural(n(x.blocks), 'block')}, ${plural(x.items ?? 0, 'question')}${x.code_blocks ? `, ${plural(x.code_blocks, 'code exercise')}` : ''}, ${plural(x.cites ?? 0, 'citation')}`;
      }
      case 'check': {
        const x = d as unknown as CheckData;
        const rules = [...new Set((x.failed ?? []).map(f => f.rule))].join(', ');
        return `${x.passed}/${x.total ?? x.passed + n(x.failed)} checks${n(x.failed) ? `, failed: ${rules}` : ''}${n(x.auto_fixed) ? `, ${n(x.auto_fixed)} auto-fixed` : ''}`;
      }
      case 'code-test': {
        const x = d as unknown as CodeTestData;
        return (x.blocks ?? []).map(b => b.disabled ? `b${b.block} self-marked`
          : `b${b.block} reference ${b.reference.passed}/${b.reference.total}, starter ${b.starter.passed}/${b.starter.total}`).join('; ') || 'no code exercises';
      }
      case 'evidence': return `${plural(n(d.items), 'item')} -> ${String(d.packet ?? '')}`;
      case 'fact-check': return `${n(d.fixed)} of ${plural(n(d.errors), 'error')} fixed in place${n(d.skipped) ? `, ${n(d.skipped)} left` : ''}`;
      case 'verdict': {
        const x = d as unknown as VerdictData;
        const auto = d as { checked?: number; agreed?: number; rewritten?: unknown[] };
        if (typeof auto.checked === 'number') return `re-solved ${auto.checked}: ${auto.agreed ?? 0} agree with the key, ${x.excluded} wrong key${x.excluded === 1 ? '' : 's'} rejected${n(auto.rewritten) ? ` and rewritten` : ''}, ${x.labelled} beyond the slides`;
        return `${x.applied} applied${n(x.refused) ? `, ${n(x.refused)} refused` : ''}${x.excluded ? `, ${x.excluded} excluded` : ''}${x.labelled ? `, ${x.labelled} labelled beyond slides` : ''}`;
      }
      case 'rewrite-item': {
        const it = (d.item ?? {}) as Record<string, unknown>;
        return `new ${String(it.id ?? '?')} replaces ${String(it.replaces ?? '?')} (pending)`;
      }
      case 'narrate': return `${plural(n(d.clips), 'clip')}, ${Number(d.minutes ?? 0).toFixed(1)} min${n(d.failed) ? `, ${n(d.failed)} failed` : ''}`;
      case 'export': return `${plural(n(d.files), 'file')}`;
      case 'build': return `index.html ${d.size_kb ?? '?'} KB, ${plural(n(d.lessons), 'lesson')}`;
      case 'note': return typeof d.text === 'string' ? d.text : '';
      case 'due': return `${plural(n(d.questions), 'question')} due`;
      case 'grade': return `${(d.results as { correct: boolean }[] | undefined)?.filter(r => r.correct).length ?? 0}/${n(d.results)} correct`;
      case 'plant': return `${plural(n(d.planted), 'planted error')}`;
      case 'plant-score': return `caught ${d.caught}/${d.planted}, missed ${d.missed}, false alarms ${d.false_alarms}`;
      case 'status': return Object.entries((d.stages ?? {}) as Record<string, string>).filter(([, v]) => v === 'done').map(([k]) => k).join(', ');
      case 'run': return `${plural(n(d.lessons), 'lesson')}, $${Number(d.cost_usd ?? 0).toFixed(4)}, ${Math.round(Number(d.ms ?? 0) / 1000)} s`;
      default: return '';
    }
  } catch {
    return '';
  }
}

/** Append one LogEvent to crew/log.jsonl; never throws (log.ts may still be a stub). */
export function logStep(course: string, ev: Omit<LogEvent, 'ts'> & { ts?: string }): void {
  try { appendLog(course, { ts: ev.ts ?? new Date().toISOString(), ...ev } as LogEvent); } catch { /* never fail a command on logging */ }
}

// ---------- the unattended reading of the sentence (agents do this in WorkBuddy) ----------
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const addDays = (date: string, k: number) => { const t = new Date(`${date}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + k); return t.toISOString().slice(0, 10); };

/** Heuristic GoalInput from the user's sentence: date, time, minutes a day, audience. Every guess is an assumption. */
export function parseSentence(sentence: string, now: Date, timezone = 'Asia/Kuala_Lumpur'): GoalInput {
  const s = sentence.toLowerCase();
  const assume: string[] = [];
  const today = todayIn(timezone, now);
  const [ty, tm] = today.split('-').map(Number) as [number, number];

  let deadline: string | undefined;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/))) deadline = iso(+m[1]!, +m[2]!, +m[3]!);
  else if ((m = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/))
    || (m = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/))) {
    const day = Number(/\d/.test(m[1]!) ? m[1] : m[2]);
    const mon = MONTHS.indexOf((/\d/.test(m[1]!) ? m[2] : m[1])!.slice(0, 3)) + 1;
    let y = ty;
    if (mon < tm - 1) y += 1;
    deadline = iso(y, mon, day);
  } else if ((m = s.match(/\bin\s+(\d{1,2})\s+days?\b/))) deadline = addDays(today, Number(m[1]));
  else if (/\btomorrow\b/.test(s)) deadline = addDays(today, 1);
  else if (/\bnext week\b/.test(s)) deadline = addDays(today, 7);
  else {
    const wd = WEEKDAYS.findIndex(w => new RegExp(`\\b${w}\\b`).test(s));
    if (wd >= 0) {
      const cur = new Date(`${today}T00:00:00Z`).getUTCDay();
      deadline = addDays(today, ((wd - cur + 7) % 7) || 7);
      assume.push(`"${WEEKDAYS[wd]}" read as ${deadline}.`);
    }
  }
  if (!deadline) { deadline = addDays(today, 7); assume.push(`No date in the sentence: assumed the exam is in 7 days (${deadline}).`); }

  let examTime: string | undefined;
  if ((m = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/))) {
    let h = Number(m[1]) % 12;
    if (m[3] === 'pm') h += 12;
    examTime = `${String(h).padStart(2, '0')}:${m[2] ?? '00'}`;
  } else if ((m = s.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/))) examTime = `${m[1]!.padStart(2, '0')}:${m[2]}`;

  let minutes = 45;
  if ((m = s.match(/(\d+(?:\.\d+)?)\s*(?:h|hrs?|hours?)\b(?:\s*(?:a|per|each|every)\s*day)?/))) minutes = Math.round(Number(m[1]) * 60);
  else if ((m = s.match(/(\d+)\s*(?:min|mins|minutes?)\b/))) minutes = Number(m[1]);
  else assume.push('No daily time in the sentence: assumed 45 minutes a day.');
  minutes = Math.min(720, Math.max(5, minutes));
  assume.unshift(`Read your sentence as: exam ${deadline}${examTime ? ` at ${examTime}` : ''}, ${minutes} minutes a day.`);

  const staff = /\b(staff|employee|new hire|onboard\w*|shift|barista|crew|sop|first day|day one)\b/.test(s);
  return {
    deadline, examTime, minutesPerDay: minutes, audience: staff ? 'staff' : 'student', lang: 'en',
    codeLang: staff ? 'none' : 'js', assume, timezone,
  };
}

// ---------- keep / cut (the Lead decides this in WorkBuddy) ----------
// G2 review: the old heuristic gave new lessons a fixed 60% of the days, ranked by raw share and cut a subtopic
// whenever its parent was cut. Now: rank by marks per minute over each topic's prerequisite closure (a subtopic
// brings its parent along), add greedily while the real day-by-day plan (lessons + the reviews they create) still
// fits every day, then fill leftover minutes. Study order: decks by their heaviest kept topic, outline order inside.
type Topic = OutlineData['topics'][number];
export interface ChooseResult { keep: string[]; cut: Record<string, string>; order: string[] }

/** The deck (source material) a topic is mostly about, from its outline chunk ids. */
function deckOf(outlineLessons: Lesson[] | null, key: string, chunkDeck: Map<number, number>): number | null {
  const l = outlineLessons?.find(x => x.key === key);
  const count = new Map<number, number>();
  for (const id of l?.chunk_ids ?? []) { const d = chunkDeck.get(id); if (d !== undefined) count.set(d, (count.get(d) ?? 0) + 1); }
  let best: number | null = null, n = 0;
  for (const [d, k] of count) if (k > n) { best = d; n = k; }
  return best;
}

/** Topological study order: decks ordered by their heaviest kept topic (descending share), outline order inside a deck. */
export function studyOrder(keep: string[], topics: Topic[], share: Map<string, number>, deck: (k: string) => number | null): string[] {
  const idx = new Map(topics.map((t, i) => [t.key, i]));
  const groups = new Map<string, string[]>();
  for (const k of keep) { const g = String(deck(k) ?? `t:${k}`); groups.set(g, [...(groups.get(g) ?? []), k]); }
  const ranked = [...groups.values()].map(ks => ks.sort((a, b) => idx.get(a)! - idx.get(b)!))
    .sort((a, b) => Math.max(...b.map(k => share.get(k) ?? 0)) - Math.max(...a.map(k => share.get(k) ?? 0)) || idx.get(a[0]!)! - idx.get(b[0]!)!);
  const out = ranked.flat();
  // parents always before their subtopics
  for (const t of topics) {
    if (!t.parent || !out.includes(t.key) || !out.includes(t.parent)) continue;
    const i = out.indexOf(t.key), j = out.indexOf(t.parent);
    if (j > i) { out.splice(j, 1); out.splice(i, 0, t.parent); }
  }
  return out;
}

export function chooseLessons(topics: OutlineData['topics'], weights: ExamMapData['weights'] | null, goal: Partial<Goal>,
  now: Date, maxLessons = 6, ctx?: { outline?: OutlineResult | null; ingest?: { chunks: { id: number; material_id: number }[] } | null; examMap?: ExamMap | null }): ChooseResult {
  const share = new Map((weights ?? []).map(w => [w.key, w.share]));
  const byKey = new Map(topics.map(t => [t.key, t]));
  const chunkDeck = new Map((ctx?.ingest?.chunks ?? []).map(c => [c.id, c.material_id]));
  const deck = (k: string) => deckOf(ctx?.outline?.lessons ?? null, k, chunkDeck);
  const today = todayIn(goal.timezone ?? 'Asia/Kuala_Lumpur', now);
  const g = goalDefaults(goal as Goal);
  // the real plan decides feasibility: every day within minutes_per_day once reviews are counted
  const fits = (keys: string[]): boolean => {
    if (!ctx?.outline) {
      const examDay = goal.deadline ?? goal.exam_at?.slice(0, 10) ?? null;
      const days = examDay ? Math.max(1, Math.round((Date.parse(`${examDay}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)) : 7;
      return keys.reduce((s, k) => s + (byKey.get(k)?.minutes ?? 0), 0) <= days * g.minutes_per_day * 0.7;
    }
    try {
      const p = buildPlan({ goal: g, outline: ctx.outline, examMap: ctx.examMap ?? null, keep: keys, order: studyOrder(keys, topics, share, deck), start: today });
      return !p.warnings.some(w => /over the daily|more than the whole/i.test(w));
    } catch { return false; }
  };
  // the plan clamps a lesson to ~70% of a day (plan.ts); rank with the minutes the plan will really use
  const dayCap = Math.max(10, Math.round((g.minutes_per_day * 0.7) / 5) * 5);
  const minutesOf = (k: string) => Math.max(1, Math.min(byKey.get(k)?.minutes ?? 15, dayCap));
  const keptRateOf = (k: string) => (share.get(k) ?? 0) / minutesOf(k);
  const keep: string[] = [];
  const closure = (k: string): string[] => {
    const t = byKey.get(k);
    const need = t?.parent && byKey.has(t.parent) && !keep.includes(t.parent) ? [t.parent, k] : [k];
    return need.filter(x => !keep.includes(x));
  };
  // 1. marks per minute, greedily
  for (;;) {
    const cands = topics.filter(t => !keep.includes(t.key)).map(t => {
      const add = closure(t.key);
      const marks = add.reduce((s, k) => s + (share.get(k) ?? 0), 0);
      const mins = add.reduce((s, k) => s + minutesOf(k), 0);
      return { key: t.key, add, marks, rate: marks / mins };
    }).filter(c => c.marks > 0 && keep.length + c.add.length <= maxLessons)
      .sort((a, b) => b.rate - a.rate || b.marks - a.marks);
    const pick = cands.find(c => fits([...keep, ...c.add]));
    if (!pick) break;
    keep.push(...pick.add);
  }
  // 1b. G2 review: never cut a topic the paper weights >= 10% when time allows. Swap out the lightest kept topics
  // (under 10%, not a parent of another kept topic) while that makes the heavy one fit and raises the kept marks.
  const marksOf = (ks: string[]) => ks.reduce((s, k) => s + (share.get(k) ?? 0), 0);
  for (const t of [...topics].filter(t => (share.get(t.key) ?? 0) >= 0.1 && !keep.includes(t.key)).sort((a, b) => (share.get(b.key) ?? 0) - (share.get(a.key) ?? 0))) {
    const add = closure(t.key);
    if (keep.length + add.length <= maxLessons && fits([...keep, ...add])) { keep.push(...add); continue; }
    const light = keep.filter(k => (share.get(k) ?? 0) < 0.1 && !keep.some(o => byKey.get(o)?.parent === k))
      .sort((a, b) => keptRateOf(a) - keptRateOf(b));
    const drop: string[] = [];
    for (const k of light) {
      drop.push(k);
      const rest = keep.filter(x => !drop.includes(x));
      if (marksOf(drop) >= marksOf(add)) break;
      if (rest.length + add.length <= maxLessons && fits([...rest, ...add])) {
        keep.splice(0, keep.length, ...rest, ...add);
        break;
      }
    }
  }
  // 2. no past paper (or nothing fitted): core topics in outline order while they fit
  if (!keep.length) for (const t of topics) { if (keep.length < Math.min(2, topics.length) || (keep.length < maxLessons && fits([...keep, t.key]))) keep.push(t.key); }
  // 3. leftover minutes. With a past paper only the timed-paper capstone is worth them (a zero-mark topic is not on
  // the exam; the minutes go to spaced reviews instead); without one, core topics in outline order while they fit.
  const foldedSubs = new Set((ctx?.examMap?.questions ?? []).map(q => (q as { folded_from?: string }).folded_from).filter(Boolean));
  for (const t of [...topics].sort((a, b) => (a.track === 'core' ? 0 : 1) - (b.track === 'core' ? 0 : 1))) {
    if (keep.includes(t.key) || keep.length >= maxLessons) continue;
    if (weights && t.archetype !== 'performance' && !foldedSubs.has(t.key)) continue;
    const add = closure(t.key);
    if (keep.length + add.length <= maxLessons && fits([...keep, ...add])) keep.push(...add);
  }
  // cut reasons that name the trade
  const keptRate = (k: string) => (share.get(k) ?? 0) / minutesOf(k);
  const best = [...keep].sort((a, b) => keptRate(b) - keptRate(a))[0];
  const titleOf = (k: string) => byKey.get(k)?.title ?? k;
  const folded = new Map<string, string[]>();
  for (const q of ctx?.examMap?.questions ?? []) {
    const from = (q as { folded_from?: string }).folded_from;
    if (from) folded.set(from, [...(folded.get(from) ?? []), q.id]);
  }
  const cut: Record<string, string> = {};
  for (const t of topics) {
    if (keep.includes(t.key)) continue;
    const s = share.get(t.key) ?? 0;
    const parentKept = t.parent && keep.includes(t.parent);
    const fq = folded.get(t.key);
    cut[t.key] = fq?.length && t.parent
      ? `Its exam questions (${fq.join(', ')}) are counted in ${parentKept ? 'the lesson' : 'its parent'} ${titleOf(t.parent)}${parentKept ? ', which covers them' : ''}.`
      : weights && s === 0 ? (t.archetype === 'performance' ? 'A full timed paper does not fit the days left; the lessons rehearse each question type instead.' : `No marks in the past paper; the minutes went to topics that carry them.`)
      : best ? `Cut for ${titleOf(best)} (${Math.round((share.get(best) ?? 0) * 100)}% of marks in ${minutesOf(best)} min): ${Math.round(s * 100)}% in ${minutesOf(t.key)} min${t.parent && !parentKept ? ` plus its parent topic` : ''} did not fit the days left.`
      : 'It did not fit the days left before the exam.';
  }
  const order = studyOrder(keep, topics, share, deck);
  return { keep: order, cut, order };
}

// ---------- the pipeline ----------
export interface RunOptions {
  src: string; sentence: string; slug?: string; outRoot?: string; noCache?: boolean;
  concurrency?: number;            // parallel Writers (default 4)
  maxLessons?: number;             // default 6
  repairRounds?: number;           // re-draft with the check failures as the note (default 1)
  narrate?: boolean;               // default true
  template?: string;               // player template for build
  model?: string; maxUsd?: number;
  progress?: (line: string) => void;
  now?: () => Date;
  /** G2: continue in an existing course folder (no init); drafts already in crew/lessons are reused, not re-drafted. */
  course?: string;
  reuseDrafts?: boolean;
  /** G2: unattended Checker passes (default on): re-solve every auto-marked item, proof-read every lesson. */
  autoCheck?: boolean;
  factCheck?: boolean;
  start?: string;                  // plan day 1 (YYYY-MM-DD); default today in the goal's zone, by the server clock
}
export interface RunStep { cmd: string; agent: string; lesson?: string; ok: boolean; ms: number; cost_usd: number; result?: string; error?: string }
export interface RunData { course: string; lessons: number; cost_usd: number; ms: number; steps: RunStep[]; failed_steps: number; warnings: string[] }

async function pool<T>(items: T[], limit: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (i < items.length) { const t = items[i++]!; await fn(t); }
  });
  await Promise.all(workers);
}

export async function runPipeline(o: RunOptions): Promise<RunData> {
  const t0 = Date.now();
  // G2: the PC clock may be hours off; plan, report, log and .ics dates use the server time
  const now = o.now ?? skewedNow(await clockSkewMs(o.course));
  const progress = o.progress ?? ((l: string) => process.stderr.write(l + '\n'));
  const steps: RunStep[] = [];
  const warnings: string[] = [];
  let total = 0;

  const course = o.course ?? (await init({ src: o.src, sentence: o.sentence, slug: o.slug, outRoot: o.outRoot }, now())).course;
  if (o.course) {
    // resume: `goal` keeps the sentence `init` wrote; without it the outline prompt (and its cache key) would change
    const gp = coursePaths(course).goal;
    const prev = readJsonOrNull<Record<string, unknown>>(gp);
    if (!prev?.sentence) writeJson(gp, { ...(prev ?? {}), sentence: o.sentence });
  }
  if (!o.course) logStep(course, { ts: now().toISOString(), agent: 'Lead', cmd: 'init', args: o.src, ok: true, result: summarize('init', { course }), ms: Date.now() - t0, cost_usd: 0, data: { course } });
  progress(`[run] course ${course}`);

  async function step<D>(cmd: string, agent: string, fn: (ctx: Ctx) => Promise<D>, opt: { lesson?: string; args?: string; optional?: boolean } = {}): Promise<D | null> {
    const ctx: Ctx = { course, agent, noCache: !!o.noCache, model: o.model, maxUsd: o.maxUsd, spend: { usd: 0, calls: 0 }, now,
      progress: l => progress(`  ${agent}${opt.lesson ? ` [${opt.lesson}]` : ''}: ${l}`) };
    const s0 = Date.now();
    progress(`[run] ${agent}: ${cmd}${opt.lesson ? ` ${opt.lesson}` : ''}`);
    try {
      const data = await fn(ctx);
      const ms = Date.now() - s0;
      const result = summarize(cmd, data);
      total += ctx.spend.usd;
      steps.push({ cmd, agent, lesson: opt.lesson, ok: true, ms, cost_usd: ctx.spend.usd, result });
      logStep(course, { ts: now().toISOString(), agent, cmd, args: opt.args, ok: true, result, ms, cost_usd: ctx.spend.usd, lesson: opt.lesson, data: data as Record<string, unknown> });
      progress(`[run]   ok ${Math.round(ms / 100) / 10}s ${result}`);
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      total += ctx.spend.usd;
      steps.push({ cmd, agent, lesson: opt.lesson, ok: false, ms: Date.now() - s0, cost_usd: ctx.spend.usd, error: msg });
      logStep(course, { ts: now().toISOString(), agent, cmd, args: opt.args, ok: false, result: msg, ms: Date.now() - s0, cost_usd: ctx.spend.usd, lesson: opt.lesson });
      progress(`[run]   FAILED ${msg}`);
      if (opt.optional) { warnings.push(`${cmd}${opt.lesson ? ` ${opt.lesson}` : ''}: ${msg}`); return null; }
      throw e;
    }
  }

  const goalInput = parseSentence(o.sentence, now());
  const g = await step('goal', 'Lead', ctx => setGoal(ctx, goalInput), { args: o.sentence.slice(0, 80) });
  const ing = await step('ingest', 'Lead', ctx => ingest(ctx, {}));
  const out = await step('outline', 'Lead', ctx => outline(ctx, {}));
  if (!ing || !out || !g) throw new BilimindError('run stopped before planning', 'See the steps above.');
  const em = ing.files.some(f => f.role === 'past_paper') ? await step('exam-map', 'Lead', ctx => examMap(ctx, {}), { optional: true }) : null;
  const startNow = o.start ? new Date(`${o.start}T12:00:00+08:00`) : now();
  const { keep, cut, order } = chooseLessons(out.topics, em?.weights ?? null, g.goal, startNow, o.maxLessons ?? 6,
    { outline: readOutline(course), ingest: readIngest(course), examMap: readExamMap(course) });
  await step('note', 'Lead', ctx => note(ctx, { text: `Kept ${keep.join(', ')} (by marks per minute, heaviest deck first); cut ${Object.keys(cut).join(', ') || 'nothing'}.` }), { optional: true });
  const pl = await step('plan', 'Lead', ctx => plan(ctx, { keep, cut, order, ...(o.start ? { start: o.start } : {}) }), { args: `--keep ${keep.join(',')} --order ${order.join(',')}` });
  const lessons = pl?.lessons ?? [];

  const titles = new Map(out.topics.map(t => [t.key, t.title]));
  const withCode: string[] = [];
  await pool(lessons.map(l => l.key), o.concurrency ?? 4, async key => {
    const agent = `Writer · ${titles.get(key) ?? key}`;
    const reuse = o.reuseDrafts && existsSync(coursePaths(course).lessonJson(key));
    let d: DraftData | null = reuse ? draftSummary(course, key) : await step('draft', agent, ctx => draft(ctx, { lesson: key }), { lesson: key, args: `--lesson ${key}`, optional: true });
    // an unusable reply (bad JSON twice) usually lands on a fresh attempt: one retry, so a kept lesson is not lost
    if (!d && !reuse) d = await step('draft', agent, ctx => draft(ctx, { lesson: key }), { lesson: key, args: `--lesson ${key} (retry)`, optional: true });
    if (!d) return;
    let c = await step('check', agent, ctx => check(ctx, { lesson: key }), { lesson: key, args: `--lesson ${key}`, optional: true });
    let codeBlocks = d.code_blocks;
    // Q14b (item cites) and Q15 are for the Checker / advice: a full re-draft cannot fix them
    const needsRedraft = (cd: CheckData | null) => !!cd && cd.failed.some(f => !/^Q14b|^Q15/.test(f.rule));
    for (let r = 0; r < (o.repairRounds ?? 1) && !reuse && needsRedraft(c); r++) {
      const fix = c!.failed.filter(f => !/^Q14b|^Q15/.test(f.rule)).slice(0, 6).map(f => `${f.rule}${f.block ? ` (b${f.block})` : ''}: ${f.suggestion || f.detail}`).join('; ');
      const d2 = await step('draft', agent, ctx => draft(ctx, { lesson: key, note: `Fix these check failures: ${fix}` }), { lesson: key, args: `--lesson ${key} --note`, optional: true });
      if (!d2) break;
      codeBlocks = d2.code_blocks;
      c = await step('check', agent, ctx => check(ctx, { lesson: key }), { lesson: key, args: `--lesson ${key}`, optional: true });
    }
    if (codeBlocks > 0) withCode.push(key);
  });

  for (const key of withCode) {
    const ct = await step('code-test', 'Coder', ctx => codeTest(ctx, { lesson: key, mode: 'run' }), { lesson: key, args: `--lesson ${key}`, optional: true });
    for (const b of ct?.blocks ?? []) {
      if (b.disabled || b.reference.passed === b.reference.total) continue;
      await step('code-test', 'Coder', ctx => codeTest(ctx, { lesson: key, block: b.block, mode: 'disable',
        reason: `Reference solution passed ${b.reference.passed}/${b.reference.total} tests in the unattended run.` }),
      { lesson: key, args: `--lesson ${key} --block ${b.block} --disable`, optional: true });
    }
  }
  // G2: the unattended Checker. One fast call per lesson proof-reads the teaching text (arithmetic, traces, slide
  // attributions), one re-solves every auto-marked item and rules on it; wrong keys are rewritten and re-solved.
  for (const l of lessons) {
    if (!existsSync(coursePaths(course).lessonJson(l.key))) continue;
    if (o.factCheck !== false) await step('fact-check', 'Checker', ctx => factCheck(ctx, { lesson: l.key }), { lesson: l.key, args: `--lesson ${l.key}`, optional: true });
    if (o.autoCheck !== false) {
      await step('check', 'Checker', ctx => check(ctx, { lesson: l.key }), { lesson: l.key, args: `--lesson ${l.key}`, optional: true });
      await step('verdict', 'Checker', ctx => autoCheck(ctx, { lesson: l.key }), { lesson: l.key, args: `--lesson ${l.key} --auto`, optional: true });
    }
    await step('evidence', 'Checker', ctx => evidence(ctx, { lesson: l.key }), { lesson: l.key, args: `--lesson ${l.key}`, optional: true });
  }
  if (o.narrate !== false) await step('narrate', 'Lead', ctx => narrate(ctx, {}), { optional: true });
  await step('export', 'Lead', ctx => exportAll(ctx), { optional: true });
  const b = await step('build', 'Lead', ctx => build(ctx, o.template ? { template: o.template } : {}));

  const data: RunData = {
    course, lessons: b?.lessons ?? 0, cost_usd: Math.round(total * 1e6) / 1e6, ms: Date.now() - t0, steps,
    failed_steps: steps.filter(s => !s.ok).length, warnings,
  };
  return data;
}

/** DraftData for a draft already on disk (resume runs). */
function draftSummary(course: string, key: string): DraftData | null {
  const d = readJsonOrNull<{ blocks?: { type: string; source_material_ids?: number[] | null; assessments?: unknown[] }[] }>(coursePaths(course).lessonJson(key));
  if (!d?.blocks) return null;
  return { blocks: d.blocks.map(b => b.type as DraftData['blocks'][number]), items: d.blocks.reduce((s, b) => s + (b.assessments?.length ?? 0), 0),
    code_blocks: d.blocks.filter(b => b.type === 'code').length, cites: new Set(d.blocks.flatMap(b => b.source_material_ids ?? [])).size };
}

/** Contract entry (RunFn): the same pipeline with defaults. */
export const run: RunFn = async opts => {
  const d = await runPipeline(opts);
  return { course: d.course, lessons: d.lessons, cost_usd: d.cost_usd, ms: d.ms };
};
