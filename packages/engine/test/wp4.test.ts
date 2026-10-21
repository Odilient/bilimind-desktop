// WP4: review, exports, receipts, REPORT, build on the fixture crew (offline), TTS script/cue logic (offline),
// and a live Edge TTS run when BILIMIND_LIVE_TTS=1 (works with the PC clock 8 h off: the skew fix).
import { describe, expect, it, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cardId, lessonSentences, textSentences, validateCourse } from '@bilimind/core';
import type { Course, LogEvent, ReviewState } from '@bilimind/core';
import { ankiCsv, assembleCourse, build, exportAll, initReview, narrate, readNarration, readReviewState } from '../src/index.ts';
import type { Ctx } from '../src/index.ts';
import { loadCrew, makeCiteResolver, plannedLessons, readCrewLog, toCourseLesson, excerptAround } from '../src/export/crew.ts';
import { parseIcs, foldLine } from '../src/export/ics.ts';
import { tallyChecks, tallyCode, tallyVerdicts } from '../src/export/receipts.ts';
import { csvField } from '../src/export/anki-csv.ts';
import { parseAnswers } from '../src/review.ts';
import { isoInZone, zonedToDate } from '../src/export/time.ts';
import { peaksFromWords, ttsAlignSentences, ttsParagraphs, voiceText } from '../src/tts.ts';
import { edgeClockSkew, edgeSynthesize, ttsPool, ttsVoiceFor } from '../src/tts-edge.ts';
import { loadFixture, makeFixtureCrew } from './helpers/fixture-crew.ts';

const fixture = loadFixture();
const makeCtx = (course: string, now = new Date('2026-10-10T14:00:00Z')): Ctx => ({
  course, agent: 'Lead', noCache: false, spend: { usd: 0, calls: 0 }, now: () => now, progress: () => {},
});
const embedded = (html: string): unknown => {
  const m = html.match(/<script id="bm-course" type="application\/json">([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]!) : null;
};

describe('time helpers', () => {
  it('Kuala Lumpur wall time <-> instant', () => {
    const d = zonedToDate('2026-10-12', '08:00', 'Asia/Kuala_Lumpur');
    expect(d.toISOString()).toBe('2026-10-12T00:00:00.000Z');
    expect(isoInZone(d, 'Asia/Kuala_Lumpur')).toBe('2026-10-12T08:00:00+08:00');
  });
});

describe('WP4 on the fixture crew', () => {
  let course: string;
  let ctx: Ctx;
  let built: Course;
  beforeAll(async () => {
    course = makeFixtureCrew(join(mkdtempSync(join(tmpdir(), 'bm-wp4-')), 'ds-final-fixture'));
    ctx = makeCtx(course);
    await exportAll(ctx);
    await build(ctx);
    built = JSON.parse(readFileSync(join(course, 'course.json'), 'utf8')) as Course;
  }, 60_000);   // export + build of the whole fixture course: ~3 s locally, over 10 s on a busy Windows CI runner

  it('assembles a course.json that validates, with the same lessons, ids and rejected item as the fixture', () => {
    const v = validateCourse(built);
    expect(v.errors).toEqual([]);
    expect(built.lessons.map(l => l.id)).toEqual(fixture.lessons.map(l => l.id));
    for (const [i, l] of built.lessons.entries()) {
      const f = fixture.lessons[i]!;
      expect(l.blocks.map(b => `${b.id}:${b.type}`)).toEqual(f.blocks.map(b => `${b.id}:${b.type}`));
      expect(l.blocks.flatMap(b => b.assessments.map(a => a.id))).toEqual(f.blocks.flatMap(b => b.assessments.map(a => a.id)));
      expect(lessonSentences(l).map(s => s.id)).toEqual(lessonSentences(f).map(s => s.id));
    }
    expect(built.receipts.excluded.map(x => `${x.lesson}/${x.item}->${x.replaced_by}`)).toEqual(['hash_tables/q5->q7']);
    expect(built.path.map(t => `${t.id}:${t.cut}`)).toEqual(fixture.path.map(t => `${t.id}:${t.cut}`));
    expect(built.sources.map(s => s.file)).toEqual(fixture.sources.map(s => s.file));
    expect(built.sources.filter(s => s.role === 'lecture').every(s => s.cited > 0)).toBe(true);
  });

  it('resolves chunk ids to cites with file, locator, page, quote and an excerpt that contains the quote', () => {
    const cites = built.lessons.flatMap(l => l.blocks.flatMap(b => [...b.cites, ...b.assessments.flatMap(a => a.cites ?? [])]));
    expect(cites.length).toBeGreaterThan(10);
    for (const c of cites) {
      expect(c.file).toMatch(/^sources\//);
      expect(c.locator.length).toBeGreaterThan(0);
      expect(c.excerpt.length).toBeLessThanOrEqual(700);
      expect(c.excerpt.replace(/\s+/g, ' ')).toContain(c.quote.replace(/…$/, ''));
    }
    const q4 = built.lessons[0]!.blocks.flatMap(b => b.assessments).find(a => a.id === 'q4')!;
    expect(q4.cites?.[0]?.quote).toBe('about ½(1 + 1/(1 − α)²) probes');
    expect(q4.cites?.[0]?.page).toBe(9);
  });

  it('excerptAround keeps the quote inside 700 chars', () => {
    const long = 'word '.repeat(300) + 'THE QUOTE IS HERE. ' + 'tail '.repeat(300);
    const x = excerptAround(long, 'THE QUOTE IS HERE.');
    expect(x.length).toBeLessThanOrEqual(700);
    expect(x).toContain('THE QUOTE IS HERE.');
    const resolve = makeCiteResolver(loadCrew(course).ingest);
    expect(resolve(9999)).toBeNull();
  });

  it('review/state.json: one card per quiz item (not project/essay/code) and per flashcard, first due from the plan', () => {
    const state = readReviewState(course)!;
    const crew = loadCrew(course);
    const lessons = plannedLessons(crew).map(e => toCourseLesson(e));
    const want: string[] = [];
    for (const l of lessons) for (const b of l.blocks) {
      if (b.type === 'flashcards') b.payload.cards.forEach((_, i) => want.push(cardId(l.id, b.id, i)));
      for (const a of b.assessments) if (!['project', 'essay', 'code'].includes(a.kind)) want.push(cardId(l.id, a.id));
    }
    expect(state.cards.map(c => c.id).sort()).toEqual(want.sort());
    for (const c of state.cards) {
      const first = crew.plan!.review_dates[c.lesson]![0]!;
      expect(isoInZone(new Date(c.fsrs.due), 'Asia/Kuala_Lumpur')).toBe(`${first}T08:00:00+08:00`);
      expect(Date.parse(c.fsrs.due)).toBeLessThan(Date.parse(crew.goal.exam_at!));
    }
    expect(built.review.cards.length).toBe(state.cards.length);
    // G2: a day's reviews are the lessons plan.review_dates reviews that day (one source with plan.md and reviews.ics)
    expect(built.plan.days.reduce((s, d) => s + d.reviews, 0)).toBe(Object.values(crew.plan!.review_dates).flat().length);
  });

  it('initReview is idempotent: existing cards keep their FSRS state, removed items lose their card', async () => {
    const path = join(course, 'review', 'state.json');
    const state = JSON.parse(readFileSync(path, 'utf8')) as ReviewState;
    state.cards[0]!.fsrs = { ...state.cards[0]!.fsrs, reps: 3, stability: 9.5 };
    state.cards.push({ ...state.cards[0]!, id: 'hash_tables/q99', item: 'q99' });
    writeFileSync(path, JSON.stringify(state));
    await initReview(ctx);
    const again = readReviewState(course)!;
    expect(again.cards[0]!.fsrs.reps).toBe(3);
    expect(again.cards.find(c => c.id === 'hash_tables/q99')).toBeUndefined();
    expect(again.cards.length).toBe(state.cards.length - 1);
  });

  it('reviews.ics parses back: study blocks + reviews, TZ Asia/Kuala_Lumpur, every event ends before the exam', () => {
    const text = readFileSync(join(course, 'reviews.ics'), 'utf8');
    expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(text).toContain('TZID:Asia/Kuala_Lumpur');
    expect(text.split('\r\n').every(l => new TextEncoder().encode(l).length <= 75)).toBe(true);
    const events = parseIcs(text);
    const study = events.filter(e => e.SUMMARY!.startsWith('Study:'));
    const reviews = events.filter(e => e.SUMMARY!.startsWith('Review:'));
    expect(study.length).toBe(2);
    expect(reviews.length).toBeGreaterThan(0);
    const exam = Date.parse(fixture.goal.exam_at!);
    for (const e of events) {
      const key = Object.keys(e).find(k => k.startsWith('DTEND;TZID='))!;
      expect(key).toBe('DTEND;TZID=Asia/Kuala_Lumpur');
      const v = e[key]!;
      const end = zonedToDate(`${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`, `${v.slice(9, 11)}:${v.slice(11, 13)}`);
      expect(end.getTime()).toBeLessThanOrEqual(exam);
      expect(e.UID).toMatch(/@bilimind$/);
    }
    // G2: one review event per plan review day, naming the lessons
    expect(reviews.length).toBe(new Set(Object.values(loadCrew(course).plan!.review_dates).flat()).size);
    expect(foldLine('x'.repeat(200)).split('\r\n').every(l => l.length <= 75)).toBe(true);
  });

  it('deck.csv has every flashcard and cloze item', () => {
    const csv = readFileSync(join(course, 'deck.csv'), 'utf8');
    const rows = csv.split('\r\n').filter(l => l && !l.startsWith('#'));
    expect(rows.length).toBe(built.receipts.cards);
    expect(rows[0]).toContain('bilimind');
    expect(csvField('a "b", c')).toBe('"a ""b"", c"');
    expect(ankiCsv(built)).toBe(csv);
  });

  it('lessons/NN-<key>.md are Obsidian notes with citation callouts and collapsed answers', () => {
    const md = readFileSync(join(course, 'lessons', '01-hash_tables.md'), 'utf8');
    expect(md.startsWith('---\ntitle: "Hash tables and the load factor"')).toBe(true);
    expect(md).toContain('> [!quote]- Source: L4 · Page 3');
    expect(md).toContain('(<../sources/sample-lecture-04-hashing.pdf#page=3>)');
    expect(md).toContain('> [!success]- Answer');
    expect(md).toContain('```mermaid');
    expect(md).toContain('Beyond your slides');
    expect(md).not.toContain('With chaining, an unsuccessful search for key k must compare k against every key');
    expect(existsSync(join(course, 'lessons', '02-binary_heaps.md'))).toBe(true);
  });

  it('receipts and REPORT.md counts equal counts recomputed from log.jsonl', () => {
    const log: LogEvent[] = readCrewLog(course);
    const checks = tallyChecks(log);
    const code = tallyCode(log);
    const v = tallyVerdicts(log);
    const r = built.receipts;
    expect(r.checks).toEqual({ run: 34, passed: 34, repaired: 3, flagged: 0 });
    expect(r.checks.run).toBe(checks.run);
    expect(r.tests).toEqual({ run: code.run, passed: code.passed });
    expect(r.tests).toEqual({ run: 8, passed: 8 });
    expect(r.code_fixed).toBe(1);
    // G2: items that carry a ruling now (re-rulings of one item count once), out of quiz_items
    expect(r.quiz_checked).toBeLessThanOrEqual(v.applied);
    expect(r.quiz_checked).toBeGreaterThan(0);
    expect(r.quiz_items!).toBeGreaterThanOrEqual(r.quiz_checked);
    expect(r.rejected).toBe(1);
    expect(r.rewritten).toBe(1);
    expect(r.labels.beyond_slides).toBe(1);
    expect(r.agents).toBe(new Set(log.map(e => e.agent)).size);
    expect(r.cost_usd).toBeCloseTo(log.reduce((s, e) => s + e.cost_usd, 0), 6);
    expect(r.log.length).toBe(log.length);
    expect(r.log[0]).toEqual({ t: '21:31:01', agent: 'Lead', action: 'goal', result: 'Exam Wed 14 Oct 09:00, 45 min/day, 3 assumptions' });
    const report = readFileSync(join(course, 'REPORT.md'), 'utf8');
    expect(report).toContain(`| Checks | ${checks.passed}/${checks.run} passed, ${checks.repaired} repaired, ${checks.flagged} still flagged |`);
    expect(report).toContain(`| Code tests (reference solutions) | ${code.passed}/${code.run} passed, ${code.fixed} exercise fixed by the Coder |`);
    expect(report).toContain(`| Rejected (contradicted by your files) | ${r.rejected} |`);
    expect(report).toContain(`| Rewritten | ${v.rewrites} |`);
    expect(report).toContain('Cut AVL rotations: 0 marks last year.');
  });

  it('build writes index.html under 2.5 MB with the course embedded (escaped) and copies the 3D objects', () => {
    const html = readFileSync(join(course, 'index.html'), 'utf8');
    expect(Buffer.byteLength(html)).toBeLessThan(2.5 * 1024 * 1024);
    expect(html).not.toContain('__BM_COURSE__');
    const data = embedded(html);
    expect(validateCourse(data).ok).toBe(true);
    expect((data as Course).id).toBe('ds-final-fixture');
    expect(existsSync(join(course, 'img', 'obj-book.webp'))).toBe(true);
    expect(existsSync(join(course, 'img', 'obj-calendar.webp'))).toBe(true);
    expect(built.exports.map(x => x.file)).toEqual(['reviews.ics', 'deck.csv', 'lessons/README.md', 'plan.md', 'REPORT.md']);
  });

  it('a lesson draft whose narration no longer matches gets narration null instead of wrong cues', async () => {
    const idx = { version: 1, voice: 'v', lessons: { hash_tables: { src: 'audio/x.mp3', duration_ms: 1000, sentences: [{ id: 'title.0', start_ms: 0, end_ms: 10 }] } }, plan: null, clips: [], failed: [], updated_at: '' };
    writeFileSync(join(course, 'crew', 'narration.json'), JSON.stringify(idx));
    const c = await assembleCourse(ctx);
    expect(c.lessons[0]!.narration).toBeNull();
    writeFileSync(join(course, 'crew', 'narration.json'), JSON.stringify({ ...idx, lessons: {} }));
  });

  it('parseAnswers reads "1 b, 2 chaining, 3 O(n)"', () => {
    const m = parseAnswers('1 b, 2 chaining, 3 O(n)');
    expect([...m.entries()]).toEqual([[1, 'b'], [2, 'chaining'], [3, 'O(n)']]);
  });
});

describe('TTS script logic (offline)', () => {
  const lesson = fixture.lessons[1]!;
  it('paragraphs keep every sentence exactly once, in order, never across blocks', () => {
    const s = lessonSentences(lesson);
    const paras = ttsParagraphs(s);
    expect(paras.flatMap(p => p.sentences.map(x => x.id))).toEqual(s.map(x => x.id));
    for (const p of paras) expect(new Set(p.sentences.map(x => x.block)).size).toBe(1);
    expect(paras[0]!.sentences.map(x => x.id)).toEqual(['title.0']);
    expect(Math.max(...paras.map(p => p.text.length))).toBeLessThanOrEqual(600);
  });
  it('voiceText rewrites symbols for the ear without touching sentence boundaries', () => {
    expect(voiceText('Insert costs O(log n) time.')).toBe('Insert costs O of log n time.');
    expect(voiceText('At α = 0.8 you need ½(1 + 25) probes.')).toBe('At alpha = 0.8 you need one half(1 + 25) probes.');
  });
  it('aligns word timings to sentence cues, monotone and inside the clip', () => {
    const p = ttsParagraphs([{ id: 'b1.0', block: 'b1', text: 'A heap is a tree.' }, { id: 'b1.1', block: 'b1', text: 'Parents are small.' }])[0]!;
    const words = ['A', 'heap', 'is', 'a', 'tree', 'Parents', 'are', 'small'].map((t, i) => ({ text: t, offset_ms: 100 + i * 300, duration_ms: 250 }));
    expect(ttsAlignSentences(p, words, 2800)).toEqual([[100, 1550], [1600, 2450]]);
    const fallback = ttsAlignSentences(p, [], 2000);            // no word timings: split by text length
    expect(fallback[0]![0]).toBe(0);
    expect(fallback[0]![1]).toBe(fallback[1]![0]);
    expect(fallback[1]![1]).toBe(2000);
  });
  it('peaks are 0..1 at 5 Hz', () => {
    const pk = peaksFromWords([{ text: 'hash', offset_ms: 0, duration_ms: 400 }], 1000);
    expect(pk.hz).toBe(5);
    expect(pk.values.length).toBe(5);
    expect(pk.values.every(v => v >= 0 && v <= 1)).toBe(true);
    expect(pk.values[0]!).toBeGreaterThan(pk.values[4]!);
  });
  it('voices: Ava by default, Yasmin for Malay, Nilar for Burmese', () => {
    expect(ttsVoiceFor('en')).toBe('en-US-AvaMultilingualNeural');
    expect(ttsVoiceFor('ms-MY')).toBe('ms-MY-YasminNeural');
    expect(ttsVoiceFor('Bahasa Melayu')).toBe('ms-MY-YasminNeural');
    expect(ttsVoiceFor('my')).toBe('my-MM-NilarNeural');
    expect(ttsVoiceFor('fr')).toBe('en-US-AvaMultilingualNeural');
  });
  it('plan cue ids are plan.N', () => {
    expect(textSentences('plan', 'One. Two.').map(s => s.id)).toEqual(['plan.0', 'plan.1']);
  });
});

const LIVE = process.env.BILIMIND_LIVE_TTS === '1';
describe.skipIf(!LIVE)('live Edge TTS (BILIMIND_LIVE_TTS=1)', () => {
  it('works with a skewed clock and runs 12 parallel clips in under 20 s', async () => {
    const skew = await edgeClockSkew();
    console.log('clock skew ms', skew);
    const t0 = Date.now();
    const res = await ttsPool(Array.from({ length: 12 }, (_, i) => () => edgeSynthesize(`Clip ${i + 1}. A hash table maps a key to a slot in constant time on average.`, { voice: 'en-US-AvaMultilingualNeural' })), 12);
    const ms = Date.now() - t0;
    console.log('12 clips', ms, 'ms');
    expect(res.every(r => !(r instanceof Error))).toBe(true);
    expect(ms).toBeLessThan(20_000);
  }, 60_000);

  it('narrate on the fixture: mp3 duration > 0 by ffprobe, one cue per player sentence', async () => {
    const course = makeFixtureCrew(join(mkdtempSync(join(tmpdir(), 'bm-wp4-live-')), 'ds-final-fixture'));
    const ctx = { ...makeCtx(course, new Date()), noCache: true };
    const r = await narrate(ctx, {});
    expect(r.failed).toEqual([]);
    const idx = readNarration(course)!;
    for (const e of plannedLessons(loadCrew(course))) {
      const n = idx.lessons[e.key]!;
      expect(n.sentences.map(s => s.id)).toEqual(lessonSentences(toCourseLesson(e)).map(s => s.id));
      const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(course, n.src)]).toString().trim());
      expect(dur).toBeGreaterThan(0);
      expect(Math.abs(dur * 1000 - n.duration_ms)).toBeLessThan(50);
    }
    expect(idx.plan?.sentences[0]?.id).toBe('plan.0');
    const b = await build(ctx);
    expect(b.receipts.narration_min).toBeGreaterThan(1);
    const draft = JSON.parse(readFileSync(join(course, 'crew', 'lessons', 'binary_heaps.json'), 'utf8'));
    const speaking = draft.blocks.find((x: { type: string }) => x.type === 'speaking');
    expect(speaking.payload.items.every((i: { audio?: string }) => i.audio && existsSync(join(course, i.audio)))).toBe(true);
  }, 300_000);
});
