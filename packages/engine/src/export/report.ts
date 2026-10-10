// REPORT.md: what each agent did, every check, the Checker's rulings, code fixes, cost and wall time.
// Every count is recomputed from crew/log.jsonl (the same tallies as the receipts slab) or read from the course.
// Owner: WP4.
import type { CourseAssessment, LogEvent } from '@bilimind/core';
import type { Report } from '../contracts.ts';
import { tallyChecks, tallyCode, tallyVerdicts, totalCost, wallMs, countCards } from './receipts.ts';
import { DEFAULT_TIMEZONE, clockText, localOf, longDay, zoned } from './time.ts';

const cell = (s: unknown) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
export function duration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${s % 60} s`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}
export const usd = (n: number): string => `$${n < 0.01 ? n.toFixed(4) : n.toFixed(2)}`;

export const report: Report = ({ course, log }) => {
  const tz = course.goal?.timezone || DEFAULT_TIMEZONE;
  const checks = tallyChecks(log);
  const code = tallyCode(log);
  const verdicts = tallyVerdicts(log);
  const cost = totalCost(log);
  const wall = wallMs(log);
  const items: (CourseAssessment & { lesson: string })[] = course.lessons.flatMap(l => l.blocks.flatMap(b => b.assessments.map(a => ({ ...a, lesson: l.id }))));
  const beyond = items.filter(a => a.labels?.includes('beyond_slides'));
  const supported = items.filter(a => a.verdict === 'supported');
  const unchecked = items.filter(a => !a.verdict || a.verdict === 'unchecked' || a.verdict === 'pending');
  const excluded = course.receipts?.excluded ?? [];
  const agents = [...new Set(log.map(e => e.agent).filter(Boolean))];
  const built = zoned(new Date(course.built_at), tz);
  const lessonTitle = new Map(course.lessons.map(l => [l.id, l.title]));
  const narrationMin = Math.round((course.lessons.reduce((s, l) => s + (l.narration?.duration_ms ?? 0), 0) + (course.narration?.duration_ms ?? 0)) / 6000) / 10;
  const files = course.sources.length;
  const pages = course.sources.reduce((s, x) => s + x.pages, 0);

  const L: string[] = [];
  L.push(`# What the agents did: ${course.title}`, '');
  L.push(`Built ${longDay(built.date)} at ${clockText(built.hm)} (${tz}) · ${course.lessons.length} lessons · ${agents.length} agents · text-model cost ${usd(cost)} · wall time ${duration(wall)}.`, '');
  L.push(`> ${course.goal.sentence || course.lede}`, '');

  L.push('## In numbers', '', '| What | Count |', '|---|---|');
  L.push(`| Files read | ${files} (${pages} pages) |`);
  L.push(`| Topics on the path | ${course.path.length} (${course.path.filter(t => t.cut).length} cut) |`);
  L.push(`| Lessons written | ${course.lessons.length} |`);
  L.push(`| Agents | ${agents.length} (${agents.join(', ') || 'none logged'}) |`);
  L.push(`| Checks | ${checks.passed}/${checks.run} passed, ${checks.repaired} repaired, ${checks.flagged} still flagged |`);
  L.push(`| Code tests (reference solutions) | ${code.passed}/${code.run} passed, ${code.fixed} exercise${code.fixed === 1 ? '' : 's'} fixed by the Coder${code.disabled ? `, ${code.disabled} self-marked` : ''} |`);
  L.push(`| Quiz answers checked against your files | ${verdicts.applied} rulings, ${verdicts.refused} quote${verdicts.refused === 1 ? '' : 's'} refused as not verbatim |`);
  L.push(`| Rejected (contradicted by your files) | ${excluded.length} |`);
  L.push(`| Rewritten | ${verdicts.rewrites} |`);
  L.push(`| Labelled "Beyond your slides" | ${beyond.length} |`);
  L.push(`| Narration | ${narrationMin} min |`);
  L.push(`| Anki cards | ${countCards(course.lessons)} |`);
  L.push(`| Study minutes | ${course.lessons.reduce((s, l) => s + l.minutes, 0)} |`);
  L.push(`| Text-model cost | ${usd(cost)} |`);
  L.push(`| WorkBuddy credits | ${course.receipts?.credits ?? 'read them from WorkBuddy'} |`);
  L.push(`| Wall time | ${duration(wall)} |`, '');

  L.push('## The plan', '');
  if (course.goal.exam_at) {
    const e = localOf(course.goal.exam_at, tz);
    L.push(`Exam: ${longDay(e.date)} at ${clockText(e.hm)}. ${course.goal.minutes_per_day} minutes a day, ${course.plan.capacity_min} minutes in all, ${course.plan.used_min} planned.`, '');
  }
  if (course.goal.assumptions.length) L.push('Assumptions the Lead made (it never asks):', '', ...course.goal.assumptions.map(a => `- ${a}`), '');
  if (course.plan.weights.length) {
    L.push('| Topic | Marks on the past paper | Share | Questions |', '|---|---|---|---|',
      ...course.plan.weights.map(w => `| ${cell(w.title)} | ${w.marks} | ${Math.round(w.share * 100)}% | ${cell(w.questions.join(', '))} |`), '');
  }
  L.push('Kept, in order:', '', ...course.lessons.map(l => `${l.n}. ${l.title} (${l.minutes} min${l.day ? `, ${l.day}` : ''})`), '');
  if (course.plan.cut.length) L.push('Cut:', '', ...course.plan.cut.map(c => `- **${c.title}**: ${c.reason}`), '');
  if (course.plan.warnings.length) L.push('Warnings:', '', ...course.plan.warnings.map(w => `- ${w}`), '');

  L.push('## Who did what', '', '| Agent | Steps | Failed | Cost | Time |', '|---|---|---|---|---|');
  for (const a of agents) {
    const ev = log.filter(e => e.agent === a);
    const cmds = [...new Set(ev.map(e => e.cmd))].join(', ');
    L.push(`| ${cell(a)} | ${ev.length} (${cell(cmds)}) | ${ev.filter(e => !e.ok).length} | ${usd(ev.reduce((s, e) => s + (e.cost_usd || 0), 0))} | ${duration(ev.reduce((s, e) => s + (e.ms || 0), 0))} |`);
  }
  L.push('');

  L.push('## Checks per lesson', '');
  const checkRows = Object.entries(checks.lessons);
  if (!checkRows.length) L.push('No `check` runs were logged.', '');
  else {
    L.push('| Lesson | Rounds | First round | Last round | Still flagged |', '|---|---|---|---|---|');
    for (const [k, c] of checkRows) {
      const t = (d: typeof c.first) => `${d.passed}/${d.total ?? d.passed + (d.failed?.length ?? 0)}`;
      L.push(`| ${cell(lessonTitle.get(k) ?? k)} | ${c.rounds} | ${t(c.first)} | ${t(c.last)} | ${c.last.failed?.length ?? 0} |`);
    }
    L.push('');
    const flagged = checkRows.flatMap(([k, c]) => (c.last.failed ?? []).map(f => `- ${lessonTitle.get(k) ?? k}${f.block ? `, block b${f.block}` : ''}${f.item ? `, ${f.item}` : ''}: **${f.rule}** ${f.detail}`));
    if (flagged.length) L.push('Still flagged after the last round:', '', ...flagged, '');
  }

  L.push("## The Checker's rulings", '');
  L.push(`${supported.length} supported by a verbatim quote from your files, ${beyond.length} beyond your slides (labelled in the course), ${excluded.length} rejected, ${unchecked.length} not ruled on.`, '');
  if (excluded.length) {
    L.push('Rejected items (never shown to you):', '');
    for (const x of excluded) {
      L.push(`- **${lessonTitle.get(x.lesson) ?? x.lesson} ${x.item}**: ${x.prompt}`, `  - Why: ${x.reason}`);
      if (x.quote) L.push(`  - Your file says: "${x.quote}"${x.cite ? ` (${x.cite.file.replace(/^sources\//, '')}, ${x.cite.locator})` : ''}`);
      if (x.replaced_by) L.push(`  - Rewritten as ${x.replaced_by}.`);
    }
    L.push('');
  }
  if (beyond.length) L.push('Beyond your slides:', '', ...beyond.map(a => `- ${lessonTitle.get(a.lesson) ?? a.lesson} ${a.id}: ${a.prompt}`), '');

  L.push('## Code exercises', '');
  const codeRows = Object.entries(code.blocks);
  if (!codeRows.length) L.push('No `code-test` runs were logged.', '');
  else {
    L.push('| Exercise | First run | Last run | Starter fails a test |', '|---|---|---|---|');
    for (const [k, b] of codeRows) {
      const [lesson, blk] = k.split('/');
      const r = (x: typeof b.first) => (x.disabled ? 'self-marked' : `${x.reference?.passed ?? 0}/${x.reference?.total ?? 0}`);
      L.push(`| ${cell(lessonTitle.get(lesson!) ?? lesson)} ${blk} | ${r(b.first)} | ${r(b.last)} | ${b.last.disabled ? 'n/a' : (b.last.starter?.passed ?? 0) < (b.last.starter?.total ?? 0) ? 'yes' : 'no'} |`);
    }
    L.push('');
  }

  // G2 review: the note text lives in args (CLI) or data.text (run); empty notes are skipped
  const noteText = (e: LogEvent) => String(e.result || (typeof e.data?.text === 'string' ? e.data.text : '') || e.args || '').replace(/^--text\s+/, '').trim();
  const notes = log.filter(e => e.cmd === 'note' && noteText(e));
  if (notes.length) {
    L.push("## Decisions in the agents' own words", '');
    for (const n of notes) L.push(`- **${n.agent}** (${zoned(new Date(n.ts), tz).hm}): ${noteText(n)}`);
    L.push('');
  }

  L.push('## Timeline', '', '| Time | Agent | Step | Result | Took | Cost |', '|---|---|---|---|---|---|');
  for (const e of log) {
    L.push(`| ${zoned(new Date(e.ts), tz).time} | ${cell(e.agent)} | ${cell(e.cmd)}${e.lesson ? ` ${cell(e.lesson)}` : ''} | ${e.ok ? '' : 'FAILED: '}${cell(e.result ?? (e.cmd === 'note' ? e.args : '') ?? '')} | ${duration(e.ms || 0)} | ${e.cost_usd ? usd(e.cost_usd) : ''} |`);
  }
  L.push('');
  const failed = log.filter((e: LogEvent) => !e.ok);
  if (failed.length) L.push('## Failures and retries', '', ...failed.map(e => `- ${zoned(new Date(e.ts), tz).time} ${e.agent} \`${e.cmd}\`: ${e.result ?? 'error'}`), '');
  L.push('---', '', '*Every number above is recomputed from `crew/log.jsonl` and the course files. Made with BiliMind for WorkBuddy.*');
  return L.join('\n') + '\n';
};
