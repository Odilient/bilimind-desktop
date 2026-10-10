// `build`: assemble course.json from crew/, validate (core validateCourse), paste into the template (core injectCourse), write index.html.
// Owner: WP4. Keep the export names and types (src/contracts.ts); replace the stubs in place.
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COURSE_SCHEMA_VERSION, LEARNER_TAG, excludedItems, injectCourse, validateCourse } from '@bilimind/core';
import type {
  Archetype, Cite, Course, CourseExport, CourseLesson, CourseSource, ExcludedItem, Narration, PathTopic, ReviewState, SaasLesson, Skin,
} from '@bilimind/core';
import { BilimindError } from './contracts.ts';
import type { AssembleCourse, BuildFn, Ctx } from './contracts.ts';
import { coursePaths, writeJson, writeText } from './course.ts';
import { loadCrew, makeCiteResolver, plannedLessons, readCrewLog, readLicenceNotes, sourceRef, toCourseLesson } from './export/crew.ts';
import type { Crew } from './export/crew.ts';
import { computeReceipts } from './export/receipts.ts';
import { prerenderDiagrams } from './export/mermaid-svg.ts';
import { clockText, isoInZone, localOf, longDay, zoned } from './export/time.ts';
import { initReview } from './review.ts';
import { foldedInto } from './exam.ts';

const HERE = (() => { try { return dirname(fileURLToPath(import.meta.url)); } catch { return process.cwd(); } })();

/** The standard export pills (filtered to existing files by `build`). */
export function standardExports(lessons: readonly CourseLesson[]): CourseExport[] {
  const first = lessons[0];
  return [
    { kind: 'ics', label: 'Study plan .ics', file: 'reviews.ics' },
    { kind: 'anki_csv', label: 'Anki deck', file: 'deck.csv' },
    ...(first ? [{ kind: 'markdown' as const, label: 'Notes for Obsidian', file: LESSON_INDEX }] : []),
    { kind: 'plan', label: 'The plan', file: 'plan.md' },
    { kind: 'report', label: 'What the agents did', file: 'REPORT.md' },
  ];
}
/** The notes index `export` writes (links every lesson note; G2 review: the pill used to open lesson 1 only). */
export const LESSON_INDEX = 'lessons/README.md';
/** 'lessons/01-hash_tables.md' */
export const lessonMdName = (l: Pick<CourseLesson, 'n' | 'id'>): string => `lessons/${String(l.n).padStart(2, '0')}-${l.id}.md`;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-') || 'course';

/** Chip label for a source: 'L4' for lecture 4, 'Paper' for a past paper. */
function shortLabel(name: string, role: string): string | undefined {
  const m = name.match(/(?:^|[^a-z])(?:l|lec|lecture|week|w)[-_ ]?0*(\d{1,2})(?=[^0-9]|$)/i);
  if (m) return `L${m[1]}`;
  if (role === 'past_paper') return 'Paper';
  if (role === 'sop') return 'SOP';
  return undefined;
}

const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
/** G2 review: a quiz intro written at draft time ("Four items. Two of them...") keeps its count after the Checker
 * drops an item; when the leading count no longer matches the live items, drop that opening sentence. */
export function fixQuizIntros(l: CourseLesson): CourseLesson {
  for (const b of l.blocks) {
    if (b.type !== 'quiz') continue;
    const p = b.payload as { intro?: string };
    const m = typeof p.intro === 'string' ? /^\s*(\d+|[A-Za-z]+)\s+(?:items?|questions?|quick questions?|short questions?)\b[^.!?]*[.!?]\s*/i.exec(p.intro) : null;
    if (!m) continue;
    const word = m[1]!.toLowerCase();
    const n = /^\d+$/.test(word) ? Number(word) : COUNT_WORDS.indexOf(word);
    if (n < 0 || n === b.assessments.length) continue;
    const rest = p.intro!.slice(m[0].length).replace(/^(?:\d+|[A-Za-z]+) of (?:them|these)\b[^.!?]*[.!?]\s*/i, '').trim();
    if (rest) p.intro = rest; else delete p.intro;
  }
  return l;
}

/** Display titles longer than this wrap to 4-5 hero lines and push the plan strip below the fold (G2 review). */
export const TITLE_MAX = 32;
const TITLE_TAIL_STOP = new Set(['and', 'or', 'of', 'the', 'a', 'an', 'for', 'to', 'in', 'on', 'with', 'from', '&', '-', '–', '—', ':']);
/** A short display title (<= 32 characters): drops 'from your ... slides' tails, then the part after a colon or dash,
 * then whole words from the end. 'Data Structures exam prep from your CSC2103 slides' -> 'Data Structures exam prep'. */
export function shortTitle(title: string, max = TITLE_MAX): string {
  let t = title.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const steps: ((x: string) => string)[] = [
    x => x.replace(/\s*\([^)]*\)\s*/g, ' ').trim(),
    x => x.replace(/\s+(?:from|using|based on|built from|made from|with|for)\s+(?:your|my|the|these|our)\b.*$/i, '').trim(),
    x => { const m = /^(.{8,}?)\s*(?::|\s[-–—]\s|\|)\s*.+$/.exec(x); return m ? m[1]!.trim() : x; },
  ];
  for (const f of steps) { const n = f(t); if (n.length >= 6) t = n; if (t.length <= max) return t; }
  const words = t.split(' ');
  while (words.length > 1 && words.join(' ').length > max) words.pop();
  while (words.length > 1 && TITLE_TAIL_STOP.has(words[words.length - 1]!.toLowerCase())) words.pop();
  const out = words.join(' ').replace(/[\s:,;–—-]+$/, '');
  return out.length <= max ? out : out.slice(0, max - 1).trimEnd() + '…';
}

function courseLede(crew: Crew, lessons: CourseLesson[], checked?: { n: number; of: number }): string {
  const g = crew.goal;
  const n = lessons.length;
  const parts: string[] = [];
  if (g.exam_at) {
    const { date, hm } = localOf(g.exam_at, crew.timezone);
    parts.push(`Exam ${longDay(date)} at ${clockText(hm)}.`);
  } else if (g.deadline) parts.push(`Ready by ${longDay(g.deadline)}.`);
  // G2 review: only claim checking that happened (receipts: items ruled on by the Checker)
  parts.push(`${n} lesson${n === 1 ? '' : 's'}, ${g.minutes_per_day} min a day${checked && checked.n > 0
    ? `, ${checked.n === checked.of ? (checked.of === 1 ? 'the auto-marked answer' : 'every auto-marked answer') : `${checked.n} of ${checked.of} auto-marked answers`} checked against your files.` : '.'}`);
  const lede = parts.join(' ');
  return lede.length > 140 ? lede.slice(0, 139) + '…' : lede;
}

function pickSkin(crew: Crew): Skin {
  const s = (crew.goal as unknown as { skin?: string }).skin;
  if (s === 'cobalt' || s === 'ink' || s === 'lime') return s;
  return crew.goal.audience === 'staff' ? 'lime' : 'cobalt';
}

function pickObject(crew: Crew, lessons: CourseLesson[]): string {
  const o = (crew.goal as unknown as { object?: string }).object;
  if (o && /^[a-z0-9-]+$/.test(o)) return `img/${o}.webp`;
  if (crew.goal.audience === 'staff') return 'img/obj-check.webp';
  const counts = new Map<Archetype, number>();
  for (const l of lessons) counts.set(l.archetype, (counts.get(l.archetype) ?? 0) + 1);
  if ((counts.get('communicative') ?? 0) * 2 >= lessons.length && lessons.length) return 'img/obj-mic.webp';
  return 'img/obj-book.webp';
}

function pickChips(allowsCode: boolean, lessons: CourseLesson[]): string[] {
  const chips: string[] = allowsCode ? ['i-code'] : [];
  for (const l of lessons) {
    const icon = LEARNER_TAG[l.archetype]?.icon;
    if (icon && !chips.includes(icon)) chips.push(icon);
    if (chips.length >= 3) break;
  }
  return chips;
}

function buildPath(crew: Crew, lessons: CourseLesson[]): PathTopic[] {
  const nodes = [...(crew.outline.lessons ?? [])].sort((a, b) => a.index - b.index);
  const kept = new Set(lessons.map(l => l.id));
  const lessonOf = new Map(lessons.map(l => [l.id, l]));
  const cutReason = new Map((crew.plan?.cut ?? []).map(c => [c.key, c.reason]));
  const hasPlan = !!crew.plan?.lessons?.length;
  const weights = crew.examMap ? new Map(crew.examMap.weights.map(w => [w.key, w.share])) : null;
  const byIndex = new Map(nodes.map(n => [n.index, n]));
  const parentKey = (n: typeof nodes[number]): string | null => {
    if (n.track !== 'subtopic') return null;
    if (n.branch_of && nodes.some(x => x.key === n.branch_of && x.key !== n.key)) return n.branch_of;
    const p = n.parent !== null && n.parent !== undefined ? byIndex.get(n.parent) : undefined;
    return p && p.key !== n.key ? p.key : null;
  };
  const isCut = (key: string) => cutReason.has(key) || (hasPlan && !kept.has(key));
  const reasonOf = (key: string) => cutReason.get(key) ?? (hasPlan && !kept.has(key) ? 'Not in this plan.' : null);
  const topics: PathTopic[] = [];
  const topicByKey = new Map<string, PathTopic>();
  for (const n of nodes) {
    if (parentKey(n)) continue;
    const l = lessonOf.get(n.key);
    const t: PathTopic = {
      id: n.key, step: topics.length + 1, title: n.title || n.key, section: n.section ?? null,
      lesson: kept.has(n.key) ? n.key : null,
      minutes: l?.minutes ?? (n.estimated_minutes > 0 ? n.estimated_minutes : 15),
      note: n.note ?? null,
      ...(n.summary ? { summary: n.summary } : {}),
      archetype: l?.archetype ?? n.archetype,
      formats: (n.planned_block_types ?? l?.formats ?? []).filter(f => f !== 'quiz').slice(0, 3),
      weight: weights ? Math.min(1, Math.max(0, weights.get(n.key) ?? 0)) : null,
      cut: isCut(n.key),
      cut_reason: isCut(n.key) ? reasonOf(n.key) : null,
      items: [],
    };
    topics.push(t);
    topicByKey.set(n.key, t);
  }
  for (const n of nodes) {
    const pk = parentKey(n);
    if (!pk) continue;
    const parent = topicByKey.get(pk);
    const item = {
      id: n.key, title: n.title || n.key, mark: n.mark ?? null, lesson: kept.has(n.key) ? n.key : null, group: n.group ?? null,
      minutes: lessonOf.get(n.key)?.minutes ?? n.estimated_minutes ?? 0,
      ...(isCut(n.key) ? { cut: true } : {}),
    };
    if (parent) parent.items.push(item);
  }
  // a kept lesson the outline does not list (should not happen) still gets a milestone
  for (const l of lessons) {
    const onPath = topics.some(t => t.lesson === l.id || t.items.some(i => i.lesson === l.id));
    if (!onPath) topics.push({ id: l.id, step: topics.length + 1, title: l.title, section: l.section ?? null, lesson: l.id, minutes: l.minutes,
      note: null, archetype: l.archetype, formats: l.formats.filter(f => f !== 'quiz').slice(0, 3), weight: null, cut: false, cut_reason: null, items: [] });
  }
  return topics;
}

function reviewCards(state: ReviewState | null, lessons: CourseLesson[], tz: string) {
  if (!state) return [];
  const ids = new Map(lessons.map(l => [l.id, new Set([...l.blocks.map(b => b.id), ...l.blocks.flatMap(b => b.assessments.map(a => a.id))])]));
  return state.cards
    .filter(c => { const s = ids.get(c.lesson); return !!s && (!c.item || s.has(c.item)) && (!c.block || s.has(c.block)); })
    .map(c => ({
      id: c.id, lesson: c.lesson, kind: c.kind,
      ...(c.item ? { item: c.item } : {}), ...(c.block ? { block: c.block } : {}), ...(c.card !== undefined ? { card: c.card } : {}),
      due: isoInZone(new Date(c.fsrs.due), tz),
    }));
}

/** Count of cites per source file across blocks, items and excluded items. */
function citeCounts(lessons: CourseLesson[], excluded: ExcludedItem[]): Map<string, number> {
  const m = new Map<string, number>();
  const add = (c: Cite | undefined) => { if (c) m.set(c.file, (m.get(c.file) ?? 0) + 1); };
  for (const l of lessons) for (const b of l.blocks) { b.cites.forEach(add); for (const a of b.assessments) (a.cites ?? []).forEach(add); }
  excluded.forEach(e => add(e.cite));
  return m;
}

/** Everything but the receipts (they are computed from it). Pure: reads crew/, writes nothing. */
export function assembleFromCrew(crew: Crew, now: Date, warn: (m: string) => void = () => {}): Course {
  const tz = crew.timezone;
  const resolveCite = makeCiteResolver(crew.ingest);
  const entries = plannedLessons(crew, warn);
  if (!entries.length) throw new BilimindError('No lesson drafts to build from.', 'Run `draft --lesson <key>` for each kept lesson (see plan.md), then build.');
  const lessons: CourseLesson[] = [];
  const excluded: ExcludedItem[] = [];
  for (const e of entries) {
    const narration = (crew.narration?.lessons?.[e.key] ?? null) as Narration | null;
    lessons.push(fixQuizIntros(toCourseLesson(e, { resolveCite, narration, warn })));
    excluded.push(...excludedItems(e.key, e.draft as unknown as SaasLesson, resolveCite));
  }
  const files = crew.ingest?.files ?? [];
  const counts = citeCounts(lessons, excluded);
  const licence = readLicenceNotes(crew.paths.sources);
  const sources: CourseSource[] = files.map((f, i) => {
    const file = sourceRef(f);
    const short = shortLabel(f.name, f.role);
    const lic = licence.byFile.get(f.name);
    return {
      id: `s${i + 1}`, title: f.title || f.name, ...(short ? { short } : {}), file, kind: f.kind, role: f.role,
      pages: Math.max(0, Math.round(f.pages || 0)), cited: counts.get(file) ?? 0, ...(lic ? { license: lic } : {}),
    };
  });
  const ids = new Set(lessons.map(l => l.id));
  const state = crew.state;
  const dueByDay = new Map<string, number>();
  for (const c of state?.cards ?? []) {
    if (!ids.has(c.lesson)) continue;
    const d = zoned(new Date(c.fsrs.due), tz).date;
    dueByDay.set(d, (dueByDay.get(d) ?? 0) + 1);
  }
  const plan = crew.plan;
  const g = crew.goal;
  const allowsCode = !!crew.outline.allows_code;
  const narrationPlan = crew.narration?.plan;
  const course: Omit<Course, 'receipts'> & { receipts?: Course['receipts'] } = {
    schema: COURSE_SCHEMA_VERSION,
    id: slug(basename(crew.course)),
    title: shortTitle(crew.outline.title || g.title || g.topic || 'Your course'),
    lede: courseLede(crew, lessons),
    skin: pickSkin(crew),
    object: pickObject(crew, lessons),
    chips: pickChips(allowsCode, lessons),
    language: g.language || 'en',
    built_at: isoInZone(now, tz),
    allows_code: allowsCode,
    code_language: allowsCode ? (g.code_language ?? crew.outline.code_language ?? 'javascript') : null,
    ...(licence.attribution ? { attribution: licence.attribution } : {}),
    goal: {
      sentence: g.sentence,
      exam_at: g.exam_at && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(g.exam_at) ? g.exam_at : null,
      deadline: g.deadline && /^\d{4}-\d{2}-\d{2}$/.test(g.deadline) ? g.deadline : null,
      minutes_per_day: g.minutes_per_day,
      audience: g.audience,
      assumptions: g.assumptions,
      timezone: tz,
    },
    plan: {
      days: (plan?.days ?? []).map(d => ({
        date: d.date,
        lessons: (d.lessons ?? []).filter(k => ids.has(k)),
        // G2 review: one source of truth with plan.md and reviews.ics: the lessons the plan reviews that day
        reviews: plan?.review_dates ? (plan.lessons ?? []).filter(l => ids.has(l.key) && (plan.review_dates[l.key] ?? []).includes(d.date)).length
          : state ? dueByDay.get(d.date) ?? 0 : Math.max(0, Math.round(d.reviews ?? 0)),
        minutes: Math.max(0, d.minutes ?? 0),
        ...(d.exam ? { exam: true } : {}),
        ...(d.label ? { label: d.label } : d.exam && g.exam_at ? { label: `Exam ${clockText(localOf(g.exam_at, tz).hm)}` } : {}),
      })),
      weights: (crew.examMap?.weights ?? []).filter(w => w.key && w.title).map(w => {
        // G2 review: a subtopic whose questions were counted in its parent says so (REPORT: 'counted in <parent> (Q2a)')
        const f = !w.marks && crew.examMap ? foldedInto(crew.examMap, w.key) : null;
        return { key: w.key, title: w.title, marks: w.marks, share: Math.min(1, Math.max(0, w.share)), questions: f ? f.questions : w.questions ?? [],
          ...(f ? { counted_in: f.into } : {}) };
      }),
      cut: (plan?.cut ?? []).filter(c => c.key && c.title).map(c => ({ key: c.key, title: c.title, reason: c.reason || 'Cut to fit the days you have.' })),
      capacity_min: Math.max(0, plan?.capacity_min ?? 0),
      used_min: Math.max(0, plan?.used_min ?? lessons.reduce((s, l) => s + l.minutes, 0)),
      warnings: plan?.warnings ?? [],
    },
    path: buildPath(crew, lessons),
    further: (crew.outline.further ?? []).filter(f => f.title && f.topic),
    lessons,
    narration: narrationPlan ? { src: narrationPlan.src, duration_ms: narrationPlan.duration_ms, voice: narrationPlan.voice,
      sentences: narrationPlan.sentences, ...(narrationPlan.peaks ? { peaks: narrationPlan.peaks } : {}) } : null,
    sources,
    exports: standardExports(lessons),
    review: { generated_at: isoInZone(state?.updated_at ? new Date(state.updated_at) : now, tz), cards: reviewCards(state, lessons, tz) },
  };
  const receipts = computeReceipts({ course: course as Omit<Course, 'receipts'>, log: readCrewLog(crew.course), files, excluded });
  course.lede = courseLede(crew, lessons, { n: receipts.quiz_checked, of: receipts.quiz_items ?? receipts.quiz_checked });
  // keep the contract key order: receipts before sources
  const { sources: s, exports: x, review: r, ...head } = course;
  return { ...head, receipts, sources: s, exports: x, review: r } as Course;
}

export const assembleCourse: AssembleCourse = async (ctx: Ctx) =>
  assembleFromCrew(loadCrew(ctx.course), ctx.now(), m => ctx.progress(`build: ${m}`));

// ---------- template + assets ----------
const STUB_TEMPLATE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>BiliMind course</title>
<style>:root{--cobalt:#2340e6;--ink:#0b1020;--paper:#f6f7fb}body{margin:0;font:16px/1.5 system-ui,sans-serif;background:var(--paper);color:var(--ink)}
main{max-width:760px;margin:0 auto;padding:32px 16px}h1{color:var(--cobalt)}li{margin:6px 0}.n{color:#666}</style></head>
<body><main><h1 id="t">BiliMind course</h1><p id="l"></p><ol id="ls"></ol>
<p class="n">Preview template: the full player (packages/player) was not built yet.</p></main>
<script id="bm-course" type="application/json">__BM_COURSE__</script>
<script>(function(){var el=document.getElementById('bm-course');var c=JSON.parse(el.textContent);
document.title=c.title;document.getElementById('t').textContent=c.title;document.getElementById('l').textContent=c.lede;
var ol=document.getElementById('ls');c.lessons.forEach(function(x){var li=document.createElement('li');li.textContent=x.title+' ('+x.minutes+' min, '+x.blocks.length+' blocks)';ol.appendChild(li);});})();</script>
</body></html>
`;

function findUp(rel: string, from: string = HERE, levels = 7): string | null {
  let dir = from;
  for (let i = 0; i < levels; i++) {
    const p = join(dir, rel);
    if (existsSync(p)) return p;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

/** Template: --template, $BILIMIND_TEMPLATE, <skill>/templates/player.html, packages/player/dist/player.html, else a stub. */
export function resolveTemplate(explicit?: string): { html: string; source: string } {
  const candidates = [
    explicit, process.env.BILIMIND_TEMPLATE,
    join(HERE, '..', 'templates', 'player.html'),
    findUp(join('templates', 'player.html')),
    findUp(join('packages', 'player', 'dist', 'player.html')),
    findUp(join('player', 'dist', 'player.html')),
  ].filter((p): p is string => !!p);
  for (const p of candidates) {
    if (existsSync(p) && statSync(p).isFile()) {
      const html = readFileSync(p, 'utf8');
      if (html.includes('__BM_COURSE__')) return { html, source: p };
    }
  }
  if (explicit) throw new BilimindError(`Template not found or has no placeholder: ${explicit}`, 'Pass the built player (packages/player/dist/player.html).');
  return { html: STUB_TEMPLATE, source: 'stub' };
}

/** Folder holding obj-*.webp: $BILIMIND_ASSETS, <skill>/assets, or the repo's design reference. */
export function resolveAssetsDir(): string | null {
  const candidates = [
    process.env.BILIMIND_ASSETS,
    join(HERE, '..', 'assets'),
    findUp('assets'),
    findUp(join('plan', 'reference', 'design', 'hero-v7', 'img', '11'), HERE, 8),
  ].filter((p): p is string => !!p);
  return candidates.find(p => existsSync(join(p, 'obj-book.webp'))) ?? null;
}

/** The 3D objects a course shows: its hero object, each lesson's archetype object, the trophy (course complete). */
export function objectsUsed(course: Pick<Course, 'object' | 'lessons'>): string[] {
  const names = new Set<string>();
  if (course.object) names.add(basename(course.object));
  for (const l of course.lessons) { const o = LEARNER_TAG[l.archetype]?.object; if (o) names.add(`${o}.webp`); }
  names.add('obj-trophy.webp');
  return [...names];
}

export const build: BuildFn = async (ctx, opts = {}) => {
  const p = coursePaths(ctx.course);
  if (!existsSync(p.reviewState)) {
    try { await initReview(ctx); } catch (e) { ctx.progress(`build: review schedule skipped (${(e as Error).message})`); }
  }
  const course = await assembleCourse(ctx);
  course.exports = course.exports.filter(x => existsSync(join(p.root, x.file)));
  // G2 review: scripted test rulings must never reach a page a judge sees
  const scripted = course.receipts.excluded.filter(e => /scripted test|\bG2:/i.test(`${e.reason} ${e.prompt}`));
  if (scripted.length) throw new BilimindError(`course.json would show ${scripted.length} scripted test ruling(s) (${scripted.map(e => `${e.lesson}/${e.item}`).join(', ')}).`,
    'Rebuild from a clean copy of the course folder: scripted rulings belong in a throwaway copy only.');
  // a lesson whose latest check is older than its latest draft was never re-checked: say so
  for (const l of course.lessons) {
    try {
      const chk = statSync(p.checksJson(l.id)).mtimeMs, drf = statSync(p.lessonJson(l.id)).mtimeMs;
      if (chk + 1000 < drf) ctx.progress(`build: warning: ${l.id} changed after its last check; run \`check --lesson ${l.id}\``);
    } catch { ctx.progress(`build: warning: ${l.id} has no check report; run \`check --lesson ${l.id}\``); }
  }
  const v = validateCourse(course);
  if (!v.ok) {
    throw new BilimindError(`course.json failed validation (${v.errors.length} problems): ${v.errors.slice(0, 4).join('; ')}`,
      'Fix the named lesson in crew/lessons/<key>.json (run `check --lesson <key>`), then run `build` again.');
  }
  for (const s of course.sources) if (!existsSync(join(p.root, s.file))) ctx.progress(`build: warning: ${s.file} is missing (citation links to it will not open)`);
  // G2 review: diagrams as inline SVG (no CDN when the course is opened offline)
  const dg = await prerenderDiagrams(course, p.crew, l => ctx.progress(l));
  if (dg.rendered || dg.cached) ctx.progress(`build: ${dg.rendered + dg.cached} diagram(s) inline as SVG${dg.failed ? `, ${dg.failed} left to the runtime` : ''}`);
  writeJson(p.courseJson, course);
  const tpl = resolveTemplate(opts.template);
  if (tpl.source === 'stub') ctx.progress('build: player template not found, using the preview stub');
  const html = injectCourse(tpl.html, course);
  writeText(p.indexHtml, html);
  const assets = resolveAssetsDir();
  if (assets) {
    mkdirSync(p.img, { recursive: true });
    for (const name of objectsUsed(course)) {
      const from = join(assets, name);
      if (existsSync(from)) copyFileSync(from, join(p.img, name));
    }
  } else ctx.progress('build: 3D objects not found (set BILIMIND_ASSETS); the page shows no object images');
  const sizeKb = Math.round(Buffer.byteLength(html) / 1024);
  if (sizeKb > 2560) ctx.progress(`build: warning: index.html is ${sizeKb} KB (target < 2.5 MB)`);
  return { index_html: 'index.html', size_kb: sizeKb, lessons: course.lessons.length, receipts: course.receipts };
};
