// review/state.json (core fsrs.ts): init from the plan; P2 due/grade.
// Owner: WP4. Keep the export names and types (src/contracts.ts); replace the stubs in place.
//
// One FSRS card per course item (not project/essay/code) and per flashcard. First due = the lesson's first
// review date from plan.json (dated backwards from the exam) at 08:00 in the goal's zone. Idempotent.
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { cardId, dueCards, gradeFromText, newCard, normaliseAnswer, rateCard, reviewDatesBackwardsFromExam } from '@bilimind/core';
import type { CourseAssessment, CourseLesson, FsrsState, ReviewCard, ReviewState } from '@bilimind/core';
import { BilimindError } from './contracts.ts';
import type { Ctx, DueFn, GradeFn, InitReview, ReadReviewState } from './contracts.ts';
import { coursePaths, readJsonOrNull, writeJson, writeText } from './course.ts';
import { loadCrew, makeCiteResolver, plannedLessons, toCourseLesson } from './export/crew.ts';
import type { Crew } from './export/crew.ts';
import { addDays, isoInZone, zoned, zonedToDate } from './export/time.ts';

export const REVIEW_HOUR = '08:00';
const NO_CARD_KINDS = new Set(['project', 'essay', 'code']);

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'course';

/** The cards a course lesson should have (without FSRS state). */
export function cardsForLesson(l: CourseLesson): Omit<ReviewCard, 'fsrs'>[] {
  const out: Omit<ReviewCard, 'fsrs'>[] = [];
  for (const b of l.blocks) {
    if (b.type === 'flashcards') {
      (b.payload.cards ?? []).forEach((c, i) => out.push({ id: cardId(l.id, b.id, i), lesson: l.id, kind: 'flashcard', block: b.id, card: i, prompt: c.front }));
    }
    for (const a of b.assessments) {
      if (NO_CARD_KINDS.has(a.kind)) continue;
      out.push({ id: cardId(l.id, a.id), lesson: l.id, kind: 'item', item: a.id, prompt: a.prompt });
    }
  }
  return out;
}

/** First review date of a lesson: plan.review_dates[key][0], else computed back from the exam, else the day after. */
export function firstReviewDay(crew: Crew, l: CourseLesson, today: string): string {
  const fromPlan = crew.plan?.review_dates?.[l.id]?.[0];
  if (fromPlan && /^\d{4}-\d{2}-\d{2}$/.test(fromPlan)) return fromPlan;
  const learned = l.day ?? today;
  return reviewDatesBackwardsFromExam(learned, crew.goal.exam_at ?? crew.goal.deadline, 4)[0] ?? addDays(learned, 1);
}

/** Course lessons (no cites/narration needed) for review purposes. */
function reviewLessons(crew: Crew, ctx?: Ctx): CourseLesson[] {
  return plannedLessons(crew, m => ctx?.progress(`review: ${m}`)).map(e => toCourseLesson(e));
}

export const initReview: InitReview = async ctx => {
  const crew = loadCrew(ctx.course);
  const now = ctx.now();
  const tz = crew.timezone;
  const today = zoned(now, tz).date;
  const lessons = reviewLessons(crew, ctx);
  const old = new Map((crew.state?.cards ?? []).map(c => [c.id, c]));
  const cards: ReviewCard[] = [];
  for (const l of lessons) {
    const due = zonedToDate(firstReviewDay(crew, l, today), REVIEW_HOUR, tz);
    for (const c of cardsForLesson(l)) {
      const prev = old.get(c.id);
      // a card never rated follows the CURRENT plan's first review day (G2 review: re-planning used to leave the
      // old due dates, so the page and the .ics disagreed with plan.md); a rated card keeps its FSRS state
      const fresh = !prev || (prev.fsrs.reps === 0 && !prev.fsrs.last_review);
      cards.push({ ...c, fsrs: fresh ? newCard(due, now) : prev!.fsrs });
    }
  }
  const state: ReviewState = {
    version: 1,
    course_id: slug(basename(crew.course)),
    exam_at: crew.goal.exam_at,
    updated_at: now.toISOString(),
    cards,
  };
  writeJson(crew.paths.reviewState, state);
  return { cards: cards.length };
};

export const readReviewState: ReadReviewState = course => readJsonOrNull<ReviewState>(coursePaths(course).reviewState);

// ---------- P2: due + grade (a WorkBuddy Automation "Today's review"; no external messaging) ----------
interface OutboxQuestion { n: number; id: string; lesson: string; kind: 'item' | 'flashcard'; item?: string; block?: string; card?: number; prompt: string; options?: string[] }
interface Outbox { at: string; questions: OutboxQuestion[] }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function findItem(lessons: CourseLesson[], lesson: string, item: string): CourseAssessment | null {
  const l = lessons.find(x => x.id === lesson);
  for (const b of l?.blocks ?? []) for (const a of b.assessments) if (a.id === item) return a;
  return null;
}
function findCard(lessons: CourseLesson[], lesson: string, block: string, i: number): { front: string; back: string } | null {
  const b = lessons.find(x => x.id === lesson)?.blocks.find(x => x.id === block);
  return b?.type === 'flashcards' ? b.payload.cards?.[i] ?? null : null;
}

function todayPage(title: string, qs: OutboxQuestion[], when: string): string {
  const items = qs.map(q => `<li><p>${esc(q.prompt)}</p>${q.options?.length ? `<ol type="a">${q.options.map(o => `<li>${esc(o)}</li>`).join('')}</ol>` : ''}</li>`).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Today's review</title><style>:root{--cobalt:#2340e6;--ink:#0b1020;--paper:#f6f7fb;--lime:#c6f24e}
body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.55 system-ui,sans-serif}main{max-width:720px;margin:0 auto;padding:32px 16px}
h1{font-size:30px;margin:0 0 4px;color:var(--cobalt)}.eb{text-transform:uppercase;letter-spacing:.08em;font-size:12px;color:#555}
ol.q>li{background:#fff;border-radius:16px;padding:14px 18px;margin:12px 0;box-shadow:0 1px 0 rgb(0 0 0/.06)}p.h{background:var(--ink);color:#fff;border-radius:14px;padding:12px 16px}</style></head>
<body><main><div class="eb">${esc(title)} · ${esc(when)}</div><h1>Today's review</h1>
<ol class="q">
${items}
</ol><p class="h">Answer in one line, for example: <b>1 b, 2 chaining, 3 13</b>. Your schedule moves each card by how you did.</p></main></body></html>
`;
}

export const due: DueFn = async (ctx, opts) => {
  const crew = loadCrew(ctx.course);
  if (!crew.state) await initReview(ctx);
  const state = readReviewState(ctx.course)!;
  const now = ctx.now();
  const n = Math.max(1, Math.min(20, Math.round(opts.n || 3)));
  let picked = dueCards(state.cards, now, n);
  if (!picked.length) picked = [...state.cards].sort((a, b) => Date.parse(a.fsrs.due) - Date.parse(b.fsrs.due)).slice(0, n);
  const lessons = reviewLessons(crew, ctx);
  const questions: OutboxQuestion[] = picked.map((c, i) => {
    const item = c.kind === 'item' && c.item ? findItem(lessons, c.lesson, c.item) : null;
    const options = item && 'options' in item && Array.isArray(item.options) && item.kind !== 'ordering' ? item.options.map(o => `${o.id}) ${o.text}`) : undefined;
    return { n: i + 1, id: c.id, lesson: c.lesson, kind: c.kind, ...(c.item ? { item: c.item } : {}), ...(c.block ? { block: c.block, card: c.card } : {}),
      prompt: item?.kind === 'ordering' ? `${c.prompt} (order: ${(item.options ?? []).map(o => `${o.id}) ${o.text}`).join('; ')})` : c.prompt,
      ...(options ? { options } : {}) };
  });
  const outbox: Outbox = { at: now.toISOString(), questions };
  const p = coursePaths(ctx.course);
  writeJson(p.reviewOutbox, outbox);
  writeText(`${p.review}/today.html`, todayPage(crew.outline.title || 'BiliMind', questions, zoned(now, crew.timezone).date));
  return { questions: questions.map(q => ({ n: q.n, id: q.id, prompt: q.prompt, ...(q.options ? { options: q.options } : {}) })), page: 'review/today.html' };
};

/** "1 b, 2 chaining, 3 O(n)" -> {1: 'b', 2: 'chaining', 3: 'O(n)'} */
export function parseAnswers(text: string): Map<number, string> {
  const out = new Map<number, string>();
  const re = /(?:^|[,;\n]|\s)\s*(\d{1,2})\s*[).:=-]?\s+([^,;\n]+?)(?=\s*(?:[,;\n]|\s\d{1,2}\s*[).:=-]?\s+|$))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) if (!out.has(Number(m[1]))) out.set(Number(m[1]), m[2]!.trim());
  return out;
}

export const grade: GradeFn = async (ctx, opts) => {
  const p = coursePaths(ctx.course);
  const outbox = readJsonOrNull<Outbox>(p.reviewOutbox);
  if (!outbox?.questions?.length) throw new BilimindError('No questions were sent yet.', 'Run `due --n 3` first, then `grade --answers "1 b, 2 ..."`.');
  const state = readReviewState(ctx.course);
  if (!state) throw new BilimindError('No review schedule (review/state.json).', 'Run `export` first.');
  const crew = loadCrew(ctx.course);
  const lessons = plannedLessons(crew).map(e => toCourseLesson(e, { resolveCite: makeCiteResolver(crew.ingest) }));
  const replies = parseAnswers(opts.answers);
  const now = ctx.now();
  const results: { n: number; correct: boolean; expected?: string; cite?: string; quote?: string; next_due: string }[] = [];
  for (const q of outbox.questions) {
    const card = state.cards.find(c => c.id === q.id);
    if (!card) continue;
    const reply = replies.get(q.n) ?? '';
    let correct = false;
    let expected: string | undefined;
    let cite: string | undefined;
    let quote: string | undefined;
    if (q.kind === 'flashcard') {
      const fc = findCard(lessons, q.lesson, q.block ?? '', q.card ?? 0);
      expected = fc?.back;
      correct = !!fc && !!reply && (normaliseAnswer(fc.back).includes(normaliseAnswer(reply)) || normaliseAnswer(reply).includes(normaliseAnswer(fc.back)));
    } else {
      const item = findItem(lessons, q.lesson, q.item ?? '');
      if (item) {
        const r = gradeFromText(item, reply);
        correct = r.status === 'graded' ? r.correct : !!reply;
        const key = item.answer_key as Record<string, unknown> | undefined;
        const ids = (key?.correct_option_ids ?? key?.correct_order) as string[] | undefined;
        expected = ids?.join(', ') ?? (Array.isArray(key?.accepted) ? String((key!.accepted as string[])[0]) : key?.value !== undefined ? String(key.value) : undefined);
        const c = item.cites?.[0];
        if (c) { cite = `${c.file.replace(/^sources\//, '')} · ${c.locator}`; quote = c.quote; }
      }
    }
    const fsrs: FsrsState = rateCard(card.fsrs, correct ? 'good' : 'again', now, { notAfter: state.exam_at });
    card.fsrs = fsrs;
    results.push({ n: q.n, correct, ...(correct ? {} : expected ? { expected } : {}), ...(cite ? { cite } : {}), ...(quote ? { quote } : {}), next_due: isoInZone(new Date(fsrs.due), crew.timezone) });
    mkdirSync(dirname(p.reviewHistory), { recursive: true });
    appendFileSync(p.reviewHistory, JSON.stringify({ ts: now.toISOString(), id: q.id, reply, correct }) + '\n');
  }
  state.updated_at = now.toISOString();
  writeJson(p.reviewState, state);
  let icsUpdated = false;
  try {
    const { ics } = await import('./export/ics.ts');
    const { assembleCourse } = await import('./build.ts');
    if (crew.plan && existsSync(p.reviewsIcs)) {
      writeText(p.reviewsIcs, ics({ course: await assembleCourse(ctx), plan: crew.plan, state }));
      icsUpdated = true;
    }
  } catch (e) { ctx.progress(`grade: reviews.ics not updated (${(e as Error).message})`); }
  return { results, ics_updated: icsUpdated };
};
