// `plan --keep k1,k2 [--cut "k=reason"] [--order ...] [--start YYYY-MM-DD]`: the Lead decides what to keep and cut;
// this enforces the arithmetic. Capacity = study days x minutes (60% new lessons, 40% reviews), kept lessons in
// order (the Lead's --order, else outline order = prerequisite order), dated day by day, review dates counted
// BACKWARDS from the exam with core reviewDatesBackwardsFromExam. Warns (never blocks) on over-capacity, a cut
// topic that carries past-paper marks, thin lessons, and the variety gate on the selection.
// Writes crew/plan.json (PlanResult) and plan.md. Owner: WP2. Keep the export names and types (src/contracts.ts).
import { LABEL, daysBetween, reviewDatesBackwardsFromExam, varietyViolation } from '@bilimind/core';
import type { CutLesson, ExamMap, Goal, Lesson, OutlineResult, PlanDay, PlanResult, PlannedLesson } from '@bilimind/core';
import type { PlanData, PlanFn, ReadPlan } from './contracts.ts';
import { BilimindError } from './contracts.ts';
import { coursePaths, readJsonOrNull, writeJson, writeText } from './course.ts';
import { readOutline } from './outline.ts';
import { foldedInto, readExamMap } from './exam.ts';
import { goalDefaults } from './prompts/context.ts';

export const PLAN_NEW_SHARE = 0.6;
export const PLAN_REVIEW_MINUTES = 5;     // one spaced review of one lesson (its quiz items + cards)
const DAY = 86_400_000;

const dayNum = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => isoDay(dayNum(d) + n * DAY);

/** Today's calendar date in a time zone (YYYY-MM-DD). */
export function planToday(now: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch { return now.toISOString().slice(0, 10); }
}
const pretty = (d: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(dayNum(d)));
const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);

export interface PlanInput {
  goal: Goal; outline: OutlineResult; examMap: ExamMap | null;
  keep: string[]; cut?: Record<string, string>; order?: string[]; start: string;
}

/** Split ordered minutes into at most k consecutive non-empty groups minimising the largest group sum (n is small). */
export function partitionByMinutes(m: number[], k: number): number[][] {
  const n = m.length;
  if (!n) return [];
  k = Math.max(1, Math.min(k, n));
  const pre = [0];
  for (const x of m) pre.push(pre[pre.length - 1]! + x);
  const sum = (a: number, b: number) => pre[b]! - pre[a]!;        // items a..b-1
  const best: number[][] = Array.from({ length: k + 1 }, () => Array(n + 1).fill(Infinity));
  const cut: number[][] = Array.from({ length: k + 1 }, () => Array(n + 1).fill(0));
  best[0]![0] = 0;
  for (let g = 1; g <= k; g++) for (let i = 1; i <= n; i++) for (let p = g - 1; p < i; p++) {
    const v = Math.max(best[g - 1]![p]!, sum(p, i));
    if (v < best[g]![i]!) { best[g]![i] = v; cut[g]![i] = p; }
  }
  const out: number[][] = [];
  for (let g = k, i = n; g >= 1; g--) { const p = cut[g]![i]!; out.unshift(Array.from({ length: i - p }, (_, j) => p + j)); i = p; }
  return out;
}

/**
 * Default study order of the kept lessons: families (a topic plus its kept subtopics) ranked by their past-paper
 * share, descending; a subtopic always follows its parent; outline order breaks ties and orders a family inside.
 * Without a past paper this is the outline order.
 */
export function defaultStudyOrder(keep: string[], outline: OutlineResult, examMap: ExamMap | null): string[] {
  const nodes = outline.lessons.filter(l => keep.includes(l.key));
  const idx = new Map(outline.lessons.map((l, i) => [l.key, i]));
  if (!examMap) return nodes.map(l => l.key);
  const share = new Map(examMap.weights.map(w => [w.key, w.share]));
  const kept = new Set(nodes.map(l => l.key));
  // root of a node among the kept lessons (follow branch_of while the parent is kept; guard cycles)
  const rootOf = (k: string): string => {
    let cur = k;
    for (let i = 0; i < 8; i++) {
      const p = outline.lessons.find(l => l.key === cur)?.branch_of;
      if (!p || p === cur || !kept.has(p)) break;
      cur = p;
    }
    return cur;
  };
  const fam = new Map<string, string[]>();
  for (const l of nodes) { const r = rootOf(l.key); fam.set(r, [...(fam.get(r) ?? []), l.key]); }
  const famShare = (ks: string[]) => Math.round(ks.reduce((s, k) => s + (share.get(k) ?? 0), 0) * 1000);
  return [...fam.entries()]
    .map(([root, ks]) => ({ root, ks: [root, ...ks.filter(k => k !== root).sort((a, b) => idx.get(a)! - idx.get(b)!)] }))
    .sort((a, b) => famShare(b.ks) - famShare(a.ks) || idx.get(a.root)! - idx.get(b.root)!)
    .flatMap(f => f.ks);
}

/** The pure planner (no I/O): what `plan` writes. */
export function buildPlan(inp: PlanInput): PlanResult {
  const { goal, outline, examMap } = inp;
  const warnings: string[] = [];
  const byKey = new Map(outline.lessons.map(l => [l.key, l]));
  const keys = outline.lessons.map(l => l.key);
  const unknown = [...inp.keep, ...Object.keys(inp.cut ?? {})].filter(k => !byKey.has(k));
  if (unknown.length) throw new BilimindError(`Unknown lesson key(s): ${unknown.join(', ')}.`, `Outline keys: ${keys.join(', ')}`);
  const keep = [...new Set(inp.keep)];
  if (!keep.length) throw new BilimindError('Nothing to keep: pass --keep k1,k2,...', `Outline keys: ${keys.join(', ')}`);
  for (const k of Object.keys(inp.cut ?? {})) if (keep.includes(k)) warnings.push(`${k} is in both --keep and --cut; it is kept.`);

  const weight = new Map((examMap?.weights ?? []).map(w => [w.key, w.share]));
  const weightOf = (k: string) => (examMap ? weight.get(k) ?? 0 : null);

  // order: the Lead's --order first (unknown keys ignored), then the rest of keep in study order: topological over
  // parent/subtopic links (a subtopic right after its parent), heavier past-paper share first (G2 review: the 30%
  // topic was learned last and got the fewest spaced reviews), outline order on ties
  const ordered: string[] = [];
  for (const k of inp.order ?? []) {
    if (!keep.includes(k)) { warnings.push(`--order names ${k}, which is not kept; ignored.`); continue; }
    if (!ordered.includes(k)) ordered.push(k);
  }
  for (const k of defaultStudyOrder(keep, outline, examMap)) if (!ordered.includes(k)) ordered.push(k);

  // calendar
  const examDay = goal.deadline ?? goal.exam_at?.slice(0, 10) ?? null;
  const start = inp.start;
  let studyDays: string[];
  if (!examDay) {
    studyDays = daysBetween(start, addDays(start, 6));
    warnings.push('No exam date in the goal: planned 7 study days and reviews counted forward from each lesson.');
  } else if (dayNum(start) >= dayNum(examDay)) {
    studyDays = [start];
    warnings.push(`The exam (${examDay}) is not after the start day (${start}): everything is planned for one day.`);
  } else {
    studyDays = daysBetween(start, addDays(examDay, -1));
  }
  const capacity = studyDays.length * goal.minutes_per_day;

  // lessons -> days (G2 review): pack in study order so that each day's lesson minutes PLUS the reviews already due
  // that day stay within minutes_per_day; a lesson that does not fit moves to the next day. The last study day is
  // kept for reviews when everything fits before it. A lesson longer than ~70% of a day is clamped (split it).
  const cap = Math.max(10, Math.round((goal.minutes_per_day * 0.7) / 5) * 5);
  const minutes = (k: string) => Math.min(byKey.get(k)!.estimated_minutes, Math.max(cap, 10));
  for (const k of ordered) if (byKey.get(k)!.estimated_minutes > cap)
    warnings.push(`${k} is sized at ${byKey.get(k)!.estimated_minutes} min, more than 70% of a ${goal.minutes_per_day}-minute day; planned as ${cap} min (split it into two lessons if it really needs more).`);
  const used = ordered.reduce((s, k) => s + minutes(k), 0);
  const pack = (days: string[]): { lessons: PlannedLesson[]; review_dates: Record<string, string[]>; ok: boolean } => {
    const out: PlannedLesson[] = [];
    const rd: Record<string, string[]> = {};
    const load = new Map<string, number>();
    let di = 0, ok = true;
    ordered.forEach((k, i) => {
      const m = minutes(k);
      while (di < days.length - 1 && (load.get(days[di]!) ?? 0) + m > goal.minutes_per_day && out.some(l => l.day === days[di])) di++;
      while (di < days.length - 1 && (load.get(days[di]!) ?? 0) + m > goal.minutes_per_day) di++;
      const day = days[di]!;
      if ((load.get(day) ?? 0) + m > goal.minutes_per_day) ok = false;
      load.set(day, (load.get(day) ?? 0) + m);
      out.push({ key: k, title: byKey.get(k)!.title, day, minutes: m, weight: weightOf(k), order: i + 1 });
      rd[k] = reviewDatesBackwardsFromExam(day, examDay, 4);
      for (const d of rd[k]!) load.set(d, (load.get(d) ?? 0) + PLAN_REVIEW_MINUTES);
    });
    // a review that lands on an over-full day makes the whole packing not ok
    for (const [d, v] of load) if (studyDays.includes(d) && v > goal.minutes_per_day) ok = false;
    return { lessons: out, review_dates: rd, ok };
  };
  let packed = studyDays.length > 1 ? pack(studyDays.slice(0, -1)) : pack(studyDays);
  if (!packed.ok && studyDays.length > 1) { const all = pack(studyDays); if (all.ok || !packed.ok) packed = all; }
  const lessons = packed.lessons;
  const review_dates = packed.review_dates;
  const reviewsOn = (d: string) => lessons.filter(l => review_dates[l.key]!.includes(d)).length;
  const reviews = Object.values(review_dates).reduce((s, ds) => s + ds.length, 0);
  // G2 review: new lessons get whatever the projected reviews leave (not a fixed 60%)
  const reviewBudget = reviews * PLAN_REVIEW_MINUTES;
  const newBudget = Math.max(0, capacity - reviewBudget);

  const lastDay = examDay ?? studyDays[studyDays.length - 1]!;
  const days: PlanDay[] = daysBetween(start, dayNum(lastDay) < dayNum(start) ? start : lastDay).map(date => {
    const learn = lessons.filter(l => l.day === date);
    const r = reviewsOn(date);
    const day: PlanDay = { date, lessons: learn.map(l => l.key), reviews: r, minutes: learn.reduce((s, l) => s + l.minutes, 0) + r * PLAN_REVIEW_MINUTES };
    if (!(examDay && date === examDay) && day.minutes > goal.minutes_per_day)
      warnings.push(`${date} needs ${day.minutes} min (lessons plus reviews), over the daily ${goal.minutes_per_day} min. Cut a lesson or move one with --order.`);
    if (examDay && date === examDay) { day.exam = true; day.label = `Exam${goal.exam_time ? ' ' + goal.exam_time : ''}`; }
    return day;
  });

  // cut: the Lead's reasons, plus every lesson neither kept nor cut
  const cut: CutLesson[] = [];
  for (const l of outline.lessons) {
    if (keep.includes(l.key)) continue;
    const given = inp.cut?.[l.key]?.trim();
    const w = weightOf(l.key);
    const f = examMap ? foldedInto(examMap, l.key) : null;
    // G2 review: a subtopic whose questions are counted in its parent never gets "No marks in the past paper"
    const reason = (given && !(f && /no marks/i.test(given)) ? given : '') || (f ? `Its exam questions (${f.questions.join(', ')}) are counted in ${byKey.get(f.into)?.title ?? 'its parent topic'}${keep.includes(f.into) ? ', which is kept and covers them' : ''}.`
      : w === 0 ? 'No marks in the past paper, and the days are better spent on topics that carry them.'
      : 'Not kept: there is no time for it before the exam.');
    cut.push({ key: l.key, title: l.title, reason, weight: w });
  }

  // warnings (advice, never a block)
  if (used > capacity) warnings.push(`Kept lessons need ${used} min of new study, more than the whole ${capacity} min available (${studyDays.length} days x ${goal.minutes_per_day} min). Cut a lesson.`);
  else if (used > newBudget) warnings.push(`Kept lessons need ${used} min of new study and their ${reviews} reviews ${reviewBudget} min: ${used + reviewBudget} of ${capacity} min. Some reviews will be short.`);
  for (const c of cut) if (c.weight && c.weight >= 0.1) warnings.push(`Cut lesson ${c.key} carries ${pct(c.weight)} of the past paper's marks.`);
  for (const l of lessons) if (byKey.get(l.key)!.thin) warnings.push(`${l.key} is thin in your sources: expect "Beyond your slides" labels in it.`);
  for (const l of lessons) if (examDay && !review_dates[l.key]!.length && studyDays.length > 1)
    warnings.push(`${l.key} is learned the day before the exam and gets no spaced review${l.weight ? ` (it carries ${pct(l.weight)} of the marks)` : ''}; move it earlier with --order if it matters.`);
  // G2 review: the heaviest kept topic should get at least as many spaced reviews as a lighter one
  const heavy = [...lessons].filter(l => l.weight !== null).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))[0];
  if (heavy) {
    const lighter = lessons.find(l => l !== heavy && (l.weight ?? 0) < (heavy.weight ?? 0) && (review_dates[l.key]?.length ?? 0) > (review_dates[heavy.key]?.length ?? 0));
    if (lighter) warnings.push(`${heavy.key} carries the most marks (${pct(heavy.weight)}) but gets ${review_dates[heavy.key]?.length ?? 0} review(s), fewer than ${lighter.key}; study it earlier with --order.`);
  }
  const v = varietyViolation(lessons.map(l => ({ title: l.title, archetype: byKey.get(l.key)!.archetype })), { strictSmall: true });
  if (v) warnings.push(`Variety (advice only, the Lead may keep this selection): ${v}`);

  return {
    goal: { deadline: examDay, exam_at: goal.exam_at, minutes_per_day: goal.minutes_per_day, timezone: goal.timezone },
    start, days, lessons, cut, capacity_min: capacity, new_budget_min: newBudget, review_budget_min: reviewBudget,
    used_min: used, reviews, review_dates, assumptions: [...goal.assumptions], warnings,
  };
}

/** plan.md: what the crew decided, in the order a student reads it. */
export function planMarkdown(plan: PlanResult, outline: OutlineResult, examMap: ExamMap | null, goal: Goal): string {
  const byKey = new Map<string, Lesson>(outline.lessons.map(l => [l.key, l]));
  const studyDays = plan.days.filter(d => !d.exam).length;
  const L: string[] = [`# Study plan: ${outline.title}`, ''];
  if (goal.sentence) L.push(`> ${goal.sentence}`, '');
  const exam = plan.goal.deadline ? `Exam: ${pretty(plan.goal.deadline)}${goal.exam_time ? ` at ${goal.exam_time}` : ''} (${plan.goal.timezone})` : 'No exam date given';
  L.push(`${exam} · ${studyDays} study day${studyDays === 1 ? '' : 's'} x ${plan.goal.minutes_per_day} min = ${plan.capacity_min} min `
    + `(${plan.new_budget_min} for new lessons, ${plan.review_budget_min} for reviews) · kept lessons need ${plan.used_min} min`, '');
  if (plan.assumptions.length) { L.push('## Assumptions', ''); for (const a of plan.assumptions) L.push(`- ${a}`); L.push(''); }
  if (examMap) {
    L.push('## What the past paper weights', '', '| Topic | Marks | Share | Questions |', '|---|---:|---:|---|');
    for (const w of examMap.weights) {
      const f = foldedInto(examMap, w.key);
      if (!w.marks && f) L.push(`| ${w.title} | — | counted in ${byKey.get(f.into)?.title ?? f.into} (${f.questions.join(', ')}) | — |`);
      else L.push(`| ${w.title} | ${w.marks} | ${pct(w.share)} | ${w.questions.join(', ') || '—'} |`);
    }
    L.push('');
  }
  L.push('## Kept, in study order', '', '| # | Lesson | Kind | Minutes | Day | Past-paper share |', '|---:|---|---|---:|---|---:|');
  for (const l of plan.lessons) L.push(`| ${l.order} | ${l.title} | ${LABEL[byKey.get(l.key)!.archetype]} | ${l.minutes} | ${pretty(l.day)} | ${pct(l.weight)} |`);
  L.push('');
  if (plan.cut.length) {
    L.push('## Cut, and why', '');
    for (const c of plan.cut) L.push(`- **${c.title}**${c.weight !== null && !(examMap && !c.weight && foldedInto(examMap, c.key)) ? ` (${pct(c.weight)} of marks)` : ''}: ${c.reason}`);
    L.push('');
  }
  L.push('## Day by day', '');
  const titleOf = (k: string) => byKey.get(k)?.title ?? k;
  for (const d of plan.days) {
    if (d.exam) { L.push(`### ${pretty(d.date)}: ${d.label ?? 'Exam'}`, '', '- Exam day. No new lessons.', ''); continue; }
    const reviewing = plan.lessons.filter(l => plan.review_dates[l.key]?.includes(d.date)).map(l => l.title);
    L.push(`### ${pretty(d.date)} · ${d.minutes} min`, '');
    for (const k of d.lessons) L.push(`- Learn: ${titleOf(k)} (${plan.lessons.find(l => l.key === k)?.minutes ?? byKey.get(k)?.estimated_minutes ?? 0} min)`);
    if (reviewing.length) L.push(`- Review: ${reviewing.join(', ')} (${reviewing.length * PLAN_REVIEW_MINUTES} min)`);
    if (!d.lessons.length && !reviewing.length) L.push('- Rest, or redo the questions you got wrong.');
    L.push('');
  }
  L.push('## Review dates (counted back from the exam)', '', '| Lesson | Reviews |', '|---|---|');
  for (const l of plan.lessons) L.push(`| ${l.title} | ${(plan.review_dates[l.key] ?? []).map(pretty).join(', ') || '—'} |`);
  L.push('', '`reviews.ics` puts these in your calendar; the course page shows what is due today.', '');
  if (plan.warnings.length) { L.push('## Warnings', ''); for (const w of plan.warnings) L.push(`- ${w}`); L.push(''); }
  return L.join('\n');
}

export const plan: PlanFn = async (ctx, opts) => {
  const p = coursePaths(ctx.course);
  const goal = goalDefaults(readJsonOrNull<Goal>(p.goal));
  const outline = readOutline(ctx.course);
  const examMap = readExamMap(ctx.course);
  const start = opts.start ?? planToday(ctx.now(), goal.timezone);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new BilimindError(`--start must be YYYY-MM-DD (got ${start}).`);
  const result = buildPlan({ goal, outline, examMap, keep: opts.keep, cut: opts.cut, order: opts.order, start });
  writeJson(p.plan, result);
  writeText(p.planMd, planMarkdown(result, outline, examMap, goal));
  const data: PlanData = {
    lessons: result.lessons.map(l => ({ key: l.key, title: l.title, day: l.day, minutes: l.minutes })),
    capacity_min: result.capacity_min, used_min: result.used_min, reviews: result.reviews, warnings: result.warnings,
  };
  return Object.assign(data, { cut: result.cut.map(c => ({ key: c.key, reason: c.reason })), plan_md: 'plan.md' });
};

export const readPlan: ReadPlan = course => readJsonOrNull<PlanResult>(coursePaths(course).plan);
