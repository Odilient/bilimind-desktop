// `export`: Obsidian markdown, Anki CSV, .ics, REPORT.md, receipts. Split into markdown.ts / anki-csv.ts / ics.ts / report.ts / receipts.ts.
// Owner: WP4. Keep the export names and types (src/contracts.ts).
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { Course, PlanResult } from '@bilimind/core';
import type { ExportFn } from '../contracts.ts';
import { readJsonOrNull, writeJson, writeText } from '../course.ts';
import { LESSON_INDEX, assembleCourse, lessonMdName } from '../build.ts';
import { initReview } from '../review.ts';
import { ankiCsv } from './anki-csv.ts';
import { loadCrew, readCrewLog } from './crew.ts';
import { ics } from './ics.ts';
import { toMarkdown } from './markdown.ts';
import { report } from './report.ts';
import { longDay } from './time.ts';

export { toMarkdown } from './markdown.ts';
export { ankiCsv } from './anki-csv.ts';
export { ics } from './ics.ts';
export { report } from './report.ts';
export { computeReceipts } from './receipts.ts';

/** plan.md fallback when `plan` did not write one (WP2 owns the real one; never overwritten here). */
function fallbackPlanMd(course: Course): string {
  const L = [`# Plan: ${course.title}`, '', `> ${course.goal.sentence}`, ''];
  if (course.goal.assumptions.length) L.push('## Assumptions', '', ...course.goal.assumptions.map(a => `- ${a}`), '');
  L.push('## Days', '');
  for (const d of course.plan.days) {
    const names = d.lessons.map(id => course.lessons.find(l => l.id === id)?.title ?? id);
    L.push(`- **${longDay(d.date)}**${d.exam ? ` · ${d.label ?? 'Exam'}` : ''}${names.length ? `: ${names.join(', ')}` : ''}${d.reviews ? ` · ${d.reviews} reviews` : ''}`);
  }
  if (course.plan.cut.length) L.push('', '## Cut', '', ...course.plan.cut.map(c => `- **${c.title}**: ${c.reason}`));
  return L.join('\n') + '\n';
}

/** A PlanResult stand-in built from course.plan when crew/plan.json is missing (the .ics needs one). */
function planFromCourse(course: Course): PlanResult {
  return {
    goal: { deadline: course.goal.deadline, exam_at: course.goal.exam_at, minutes_per_day: course.goal.minutes_per_day, timezone: course.goal.timezone ?? 'Asia/Kuala_Lumpur' },
    start: course.plan.days[0]?.date ?? course.built_at.slice(0, 10),
    days: course.plan.days, lessons: course.lessons.map((l, i) => ({ key: l.id, title: l.title, day: l.day ?? '', minutes: l.minutes, weight: null, order: i })),
    cut: course.plan.cut.map(c => ({ ...c, weight: null })), capacity_min: course.plan.capacity_min,
    new_budget_min: 0, review_budget_min: 0, used_min: course.plan.used_min, reviews: 0, review_dates: {}, assumptions: course.goal.assumptions, warnings: course.plan.warnings,
  };
}

export const exportAll: ExportFn = async ctx => {
  await initReview(ctx);
  const crew = loadCrew(ctx.course);
  const course = await assembleCourse(ctx);
  const root = crew.paths.root;
  const files: string[] = [];
  const put = (rel: string, text: string) => { writeText(join(root, ...rel.split('/')), text); files.push(rel); };
  // G2 review: lesson numbers shift when the plan changes; remove the notes this command wrote last time first
  const tracked = join(crew.paths.crew, 'exported.json');
  for (const rel of readJsonOrNull<string[]>(tracked) ?? []) {
    if (/^lessons\/[^/]+\.md$/.test(rel)) { try { rmSync(join(root, ...rel.split('/')), { force: true }); } catch { /* best effort */ } }
  }
  for (const l of course.lessons) put(lessonMdName(l), toMarkdown(l, course));
  put(LESSON_INDEX, [`# ${course.title}`, '', 'Your lesson notes, in study order (Obsidian-ready Markdown).', '',
    ...course.lessons.map(l => `${l.n}. [${l.title}](${lessonMdName(l).replace(/^lessons\//, '')})`), ''].join(String.fromCharCode(10)));
  put('deck.csv', ankiCsv(course));
  put('reviews.ics', ics({ course, plan: crew.plan ?? planFromCourse(course), state: crew.state ?? null }));
  put('REPORT.md', report({ course, log: readCrewLog(ctx.course) }));
  if (!existsSync(crew.paths.planMd)) put('plan.md', fallbackPlanMd(course));
  writeJson(tracked, files);
  return { files };
};
