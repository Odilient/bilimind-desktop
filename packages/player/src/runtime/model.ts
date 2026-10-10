// Derived views of the course for the shell: lesson order along the path, steps, the current lesson,
// cite labels, the "Due today" list. Pure functions of (course, progress), unit-tested.
import { BLOCK_META, LEARNER_TAG } from '@bilimind/core';
import type { Cite, Course, CourseBlock, CourseLesson, CourseSource, FsrsState, PathTopic } from '@bilimind/core';

/** Is the goal an exam? A past paper says yes; staff onboarding (an SOP) and a goal with no exam in its sentence say
 *  no, so the shell says "Ready by" instead of "Exam" for them. */
export function isExamGoal(c: Course): boolean {
  if (c.sources.some(s => s.role === 'past_paper')) return true;
  if (c.goal.audience === 'staff' || c.sources.some(s => s.role === 'sop')) return false;
  if (c.goal.assumptions.some(a => /no exam in the sentence/i.test(a))) return false;
  return /(exams?|finals?|mid-?terms?|tests?|quiz|paper)/i.test(c.goal.sentence);
}

export const lessonById = (c: Course, id: string | null | undefined): CourseLesson | undefined =>
  id ? c.lessons.find(l => l.id === id) : undefined;

/** Lessons in path order: each kept topic's lesson, then its subtopic lessons; leftovers at the end. */
export function lessonOrder(c: Course): CourseLesson[] {
  const seen = new Set<string>();
  const out: CourseLesson[] = [];
  const push = (id: string | null | undefined) => {
    const l = lessonById(c, id);
    if (l && !seen.has(l.id)) { seen.add(l.id); out.push(l); }
  };
  for (const t of c.path) {
    if (t.cut) continue;
    push(t.lesson);
    for (const it of t.items) if (!it.cut) push(it.lesson);
  }
  for (const l of [...c.lessons].sort((a, b) => a.n - b.n)) push(l.id);
  return out;
}

/** The path topic a lesson belongs to (its own milestone, or the topic it hangs off). */
export function topicOf(c: Course, lessonId: string): PathTopic | undefined {
  return c.path.find(t => t.lesson === lessonId) ?? c.path.find(t => t.items.some(i => i.lesson === lessonId));
}

/** Kept steps (milestones with a lesson), 1-based numbering along the line. */
export function keptTopics(c: Course): PathTopic[] { return c.path.filter(t => !t.cut); }

/** A topic's step number counted along the kept line only; cut topics have none (G2: "Step 7 of 8" counted cut topics). */
export function keptStep(c: Course, t: PathTopic | undefined | null): number | null {
  if (!t || t.cut) return null;
  const i = keptTopics(c).findIndex(k => k.id === t.id);
  return i >= 0 ? i + 1 : null;
}

export function stepLabel(c: Course, lessonId: string): { step: number; of: number } {
  const kept = keptTopics(c).length;
  const s = keptStep(c, topicOf(c, lessonId));
  if (s != null) return { step: s, of: kept };
  const order = lessonOrder(c);
  const i = order.findIndex(l => l.id === lessonId);
  return { step: i >= 0 ? i + 1 : (lessonById(c, lessonId)?.n ?? 1), of: kept || order.length || 1 };
}

/** First lesson in path order that is not done (null when all are). */
export function currentLesson(c: Course, done: (id: string) => boolean): CourseLesson | null {
  return lessonOrder(c).find(l => !done(l.id)) ?? null;
}
export function nextLesson(c: Course, afterId: string, done: (id: string) => boolean): CourseLesson | null {
  const order = lessonOrder(c);
  const i = order.findIndex(l => l.id === afterId);
  return order.slice(i + 1).find(l => !done(l.id)) ?? order.find(l => !done(l.id) && l.id !== afterId) ?? null;
}
export function percentDone(c: Course, done: (id: string) => boolean): number {
  const order = lessonOrder(c);
  return order.length ? order.filter(l => done(l.id)).length / order.length : 0;
}

export const totalMinutes = (c: Course): number => c.lessons.reduce((s, l) => s + l.minutes, 0);
export const questionCount = (c: Course): number =>
  c.lessons.reduce((s, l) => s + l.blocks.reduce((t, b) => t + b.assessments.length, 0), 0);
export const taskBlocks = (l: CourseLesson): CourseBlock[] => l.blocks.filter(b => BLOCK_META[b.type]?.task);

/** Learner noun for a block in the table of blocks: its title, else the type's eyebrow. */
export function partName(b: CourseBlock): string {
  const t = (b.title ?? '').trim();
  if (t) return t;
  if (b.type === 'explainer') return 'Explanation';
  return BLOCK_META[b.type]?.eyebrow || 'Part';
}
/** Nav label: two parts with the same name are numbered ("Explanation 2"). */
export function partLabel(l: CourseLesson, b: CourseBlock): string {
  const name = partName(b);
  const same = l.blocks.filter(x => partName(x) === name);
  return same.length < 2 ? name : `${name} ${same.indexOf(b) + 1}`;
}
export const partIcon = (b: CourseBlock): string => BLOCK_META[b.type]?.icon || 'i-book';
export const archetypeTag = (a: CourseLesson['archetype']) => LEARNER_TAG[a] ?? { tag: 'A lesson', icon: 'i-book', object: 'obj-book' };

// ---------- sources and cites ----------
export const sourceFor = (c: Course, file: string): CourseSource | undefined =>
  c.sources.find(s => s.file === file) ?? c.sources.find(s => file.endsWith('/' + s.file.split('/').pop()));

/** "L4" from a source: its short, else initials of the title, else the file stem. */
export function shortName(s: CourseSource | undefined, file: string): string {
  if (s?.short) return s.short;
  const title = s?.title ?? file.split('/').pop()?.replace(/\.[a-z0-9]+$/i, '') ?? 'Source';
  const lec = title.match(/\b(lecture|lec|week|chapter|ch|unit|slides?)\s*(\d+)/i);
  if (lec) return `${lec[1]![0]!.toUpperCase()}${lec[2]}`;
  return title.length > 14 ? title.slice(0, 12).trim() + '…' : title;
}

/** Chip text: "L4 · p.12", "L2 · Slide 9", "SOP · 2.1 Opening". */
export function citeLabel(c: Course, cite: Cite): string {
  const short = shortName(sourceFor(c, cite.file), cite.file);
  // G2: a landscape deck is cited by slide ("Slide 7"), as the prose says, not "p.7"
  const slide = cite.locator?.match(/^slide\s+(\d+)/i);
  if (slide) return `${short} · Slide ${slide[1]}`;
  if (cite.page) return `${short} · p.${cite.page}`;
  const loc = cite.locator?.replace(/^Page\s+/i, 'p.') ?? '';
  return loc ? `${short} · ${loc.length > 18 ? loc.slice(0, 17) + '…' : loc}` : short;
}
export function citeHref(cite: Cite): string {
  return cite.page ? `${cite.file}#page=${cite.page}` : cite.file;
}
export const fileKind = (s: { kind?: string; file: string }): string => {
  const k = (s.kind || s.file.split('.').pop() || '').toLowerCase();
  if (k.includes('pdf')) return 'PDF';
  if (k.includes('ppt')) return 'PPT';
  if (k.includes('doc')) return 'DOC';
  if (k.includes('md') || k.includes('markdown')) return 'MD';
  if (k.includes('txt') || k.includes('text')) return 'TXT';
  return k.slice(0, 3).toUpperCase() || 'FILE';
};

/** Lead-in for a verbatim quote: "Your slide says" for a deck cited by slide, else "Your file says". */
export function quoteLead(c: Course | null | undefined, cite: Cite): string {
  const s = c ? sourceFor(c, cite.file) : undefined;
  const slide = /^slide\s+\d+/i.test(cite.locator ?? '') || s?.kind === 'pptx' || /\.pptx?$/i.test(cite.file);
  return slide ? 'Your slide says' : 'Your file says';
}

/** True when an explanation is just the cited quote again (a Checker ruling copies the quote in). */
export function sameText(a: string, b: string): boolean {
  const n = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const x = n(a), y = n(b);
  if (!x || !y) return false;
  return x === y || (x.length > 24 && y.includes(x)) || (y.length > 24 && x.includes(y));
}

/** Split an excerpt around the quote so the popover can mark it: [before, quote, after] or null. */
export function markQuote(excerpt: string, quote: string): [string, string, string] | null {
  if (!excerpt || !quote) return null;
  const i = excerpt.indexOf(quote);
  if (i >= 0) return [excerpt.slice(0, i), quote, excerpt.slice(i + quote.length)];
  const lower = excerpt.toLowerCase();
  const j = lower.indexOf(quote.toLowerCase());
  return j >= 0 ? [excerpt.slice(0, j), excerpt.slice(j, j + quote.length), excerpt.slice(j + quote.length)] : null;
}

// ---------- review ("Due today") ----------
export interface DueRow { id: string; lesson: CourseLesson; block: string; kind: 'item' | 'flashcard'; prompt: string; due: string; overdue: boolean }

/** Prompt text of a review card: the quiz item's prompt or the flashcard's front. */
export function cardPrompt(l: CourseLesson, card: { kind: string; item?: string; block?: string; card?: number }): { prompt: string; block: string } {
  if (card.kind === 'flashcard' && card.block) {
    const b = l.blocks.find(x => x.id === card.block);
    const p = b?.payload as { cards?: { front?: string }[] } | undefined;
    return { prompt: p?.cards?.[card.card ?? 0]?.front ?? 'Practice card', block: card.block };
  }
  for (const b of l.blocks) {
    const a = b.assessments.find(x => x.id === card.item);
    if (a) return { prompt: a.prompt, block: b.id };
  }
  return { prompt: 'Review question', block: card.block ?? '' };
}

/**
 * Cards due by the end of `todayYmd` (course time zone), most overdue first. Local FSRS state
 * (bm:<id>:fsrs, keyed by card id) overrides the due date the engine planned.
 */
export function dueRows(c: Course, todayYmd: string, ymdOf: (iso: string) => string, local: Record<string, Partial<FsrsState>> | null): DueRow[] {
  const rows: DueRow[] = [];
  for (const card of c.review?.cards ?? []) {
    const l = lessonById(c, card.lesson);
    if (!l) continue;
    const due = (local?.[card.id]?.due as string | undefined) ?? card.due;
    const dueYmd = ymdOf(due);
    if (dueYmd > todayYmd) continue;
    const { prompt, block } = cardPrompt(l, card);
    rows.push({ id: card.id, lesson: l, block, kind: card.kind, prompt, due, overdue: dueYmd < todayYmd });
  }
  return rows.sort((a, b) => a.due.localeCompare(b.due));
}

/** The next day with cards due after today: { ymd, count } or null. */
export function nextReview(c: Course, todayYmd: string, ymdOf: (iso: string) => string, local: Record<string, Partial<FsrsState>> | null): { ymd: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const card of c.review?.cards ?? []) {
    const d = ymdOf((local?.[card.id]?.due as string | undefined) ?? card.due);
    if (d > todayYmd) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const first = [...counts.keys()].sort()[0];
  return first ? { ymd: first, count: counts.get(first)! } : null;
}
