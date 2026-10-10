// Unit tests for the shell's pure runtime: time labels, cue lookup, sentence wrap plans against the
// engine's splitter, course model (order, current lesson, cites, due list), progress normalising, routes.
import { describe, expect, it } from 'vitest';
import { blockSentences, lessonSentences, validateCourse } from '@bilimind/core';
import type { Course } from '@bilimind/core';
import fixture from '@bilimind/core/fixtures/course-ds-mini.json';
import { builtWhen, countdownChip, countdownText, daysFromTo, examInfo, fmtClock, fmtMinutes, ymdIn } from '../src/runtime/time.ts';
import { ampAt, cueAt, planWraps, waveBars } from '../src/runtime/cues.ts';
import { citeHref, citeLabel, currentLesson, dueRows, lessonOrder, markQuote, nextLesson, nextReview, percentDone, shortName, stepLabel } from '../src/runtime/model.ts';
import { normaliseProgress, storageKey } from '../src/runtime/progress.ts';
import { parseHash } from '../src/router.ts';

const course = fixture as unknown as Course;
const tz = course.goal.timezone;

describe('fixture', () => {
  it('validates', () => { expect(validateCourse(fixture).ok).toBe(true); });
});

describe('time', () => {
  it('formats the exam in the course zone', () => {
    const e = examInfo('2026-10-14T09:00:00+08:00', 'Asia/Kuala_Lumpur')!;
    expect(e).toMatchObject({ ymd: '2026-10-14', weekday: 'Wed', weekdayLong: 'Wednesday', day: '14 Oct', time: '9:00' });
  });
  it('uses the course zone for today, not the browser', () => {
    expect(ymdIn(new Date('2026-10-10T17:30:00Z'), 'Asia/Kuala_Lumpur')).toBe('2026-10-11');
  });
  it('countdown chips', () => {
    expect(countdownChip('2026-10-14', '2026-10-14')).toBe('Today');
    expect(countdownChip('2026-10-14', '2026-10-13')).toBe('Tomorrow');
    expect(countdownChip('2026-10-14', '2026-10-10')).toBe('4 days');
    expect(countdownChip('2026-10-14', '2026-10-15')).toBeNull();
    expect(countdownText('2026-10-14T09:00:00+08:00', new Date('2026-10-11T08:00:00+08:00'))).toBe('3d 1h 00m');
    expect(countdownText('2026-10-14T09:00:00+08:00', new Date('2026-10-15T08:00:00+08:00'))).toBeNull();
  });
  it('durations and clocks', () => {
    expect(fmtMinutes(35)).toBe('35 min');
    expect(fmtMinutes(75)).toBe('1h 15m');
    expect(fmtMinutes(120)).toBe('2h');
    expect(fmtClock(193_380)).toBe('3:13');
    expect(daysFromTo('2026-10-11', '2026-10-14')).toBe(3);
  });
  it('built-when wording', () => {
    expect(builtWhen('2026-10-10T21:40:00+08:00', new Date('2026-10-11T09:00:00+08:00'), tz)).toBe('last night');
    expect(builtWhen('2026-10-10T21:40:00+08:00', new Date('2026-10-10T22:00:00+08:00'), tz)).toBe('tonight');
    expect(builtWhen('2026-10-01T10:00:00+08:00', new Date('2026-10-11T09:00:00+08:00'), tz)).toBe('on 1 Oct');
  });
});

describe('cues', () => {
  const cues = [{ id: 'title.0', start_ms: 400, end_ms: 2000 }, { id: 'b1.0', start_ms: 2300, end_ms: 5000 }, { id: 'b1.1', start_ms: 5300, end_ms: 9000 }];
  it('finds the cue being read, holding through pauses', () => {
    expect(cueAt(cues, 0)).toBe(-1);
    expect(cueAt(cues, 400)).toBe(0);
    expect(cueAt(cues, 2100)).toBe(0);
    expect(cueAt(cues, 2300)).toBe(1);
    expect(cueAt(cues, 99_000)).toBe(2);
  });
  it('waveform bars and amplitude', () => {
    expect(waveBars([0.1, 0.9, 0.5, 0.2], 2)).toEqual([0.9, 0.5]);
    expect(waveBars(undefined, 5)).toHaveLength(5);
    expect(ampAt({ hz: 10, values: [0, 0.5, 1] }, 150)).toBe(0.5);
  });
  it('plans wraps for every narrated sentence of the fixture explainer, across inline elements', () => {
    const b1 = course.lessons[0]!.blocks[0]!;
    const sentences = blockSentences(b1);
    // simulate rendered markdown: bold splits text nodes
    const md = (b1.payload as { markdown: string }).markdown;
    const texts = md.replace(/\*\*/g, '\u0000').split('\u0000');
    const segs = planWraps(texts, sentences);
    expect(new Set(segs.map(s => s.id)).size).toBe(sentences.length);
    for (const s of segs) expect(s.end).toBeGreaterThan(s.start);
  });
  it('fixture cue ids are exactly the lesson sentence ids (what the wrapper marks)', () => {
    for (const l of course.lessons) {
      if (!l.narration) continue;
      expect(l.narration.sentences.map(s => s.id)).toEqual(lessonSentences(l).map(s => s.id));
    }
  });
});

describe('model', () => {
  const none = () => false;
  it('orders lessons along the path and finds the current one', () => {
    expect(lessonOrder(course).map(l => l.id)).toEqual(['hash_tables', 'binary_heaps']);
    expect(currentLesson(course, none)?.id).toBe('hash_tables');
    expect(currentLesson(course, id => id === 'hash_tables')?.id).toBe('binary_heaps');
    expect(currentLesson(course, () => true)).toBeNull();
    expect(nextLesson(course, 'hash_tables', none)?.id).toBe('binary_heaps');
    expect(percentDone(course, id => id === 'hash_tables')).toBe(0.5);
    expect(stepLabel(course, 'binary_heaps')).toEqual({ step: 3, of: 4 });
  });
  it('cite labels and links', () => {
    const cite = course.lessons[0]!.blocks[0]!.cites[0]!;
    expect(citeLabel(course, cite)).toBe('L4 · p.3');
    expect(citeHref(cite)).toBe('sources/sample-lecture-04-hashing.pdf#page=3');
    expect(citeLabel(course, { ...cite, file: 'sources/unknown.pdf', page: null, locator: 'Slide 9' })).toBe('unknown · Slide 9');
    expect(shortName({ id: 's', title: 'Lecture 12 · Graphs', file: 'x.pdf', kind: 'pdf', role: 'lecture', pages: 1, cited: 0 }, 'x.pdf')).toBe('L12');
  });
  it('marks the quote inside the excerpt', () => {
    expect(markQuote('Alpha beta gamma.', 'beta')).toEqual(['Alpha ', 'beta', ' gamma.']);
    expect(markQuote('Alpha Beta gamma.', 'beta')).toEqual(['Alpha ', 'Beta', ' gamma.']);
    expect(markQuote('Alpha', 'zeta')).toBeNull();
  });
  it('due today: engine plan, overridden by local FSRS state', () => {
    const ymdOf = (iso: string) => ymdIn(new Date(iso), tz);
    const first = course.review.cards.map(c => ymdOf(c.due)).sort()[0]!;
    const rows = dueRows(course, first, ymdOf, null);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(r => r.prompt.length > 0 && r.block.startsWith('b'))).toBe(true);
    const id = rows[0]!.id;
    const later = dueRows(course, first, ymdOf, { [id]: { due: '2026-10-13T08:00:00+08:00' } });
    expect(later.find(r => r.id === id)).toBeUndefined();
    expect(dueRows(course, '2026-10-01', ymdOf, null)).toHaveLength(0);
    expect(nextReview(course, '2026-10-01', ymdOf, null)?.ymd).toBe(first);
  });
});

describe('progress + routes', () => {
  it('keys are namespaced per course', () => { expect(storageKey('ds', 'progress')).toBe('bm:ds:progress'); });
  it('normalises whatever was stored', () => {
    expect(normaliseProgress(null)).toEqual({ v: 1, lessons: {} });
    expect(normaliseProgress({ lessons: { a: { seen: ['b1', 3], done: true, at: 5 }, b: 'x' }, last: 'a' }))
      .toEqual({ v: 1, last: 'a', lessons: { a: { seen: ['b1'], passed: [], done: true, at: 5 } } });
  });
  it('parses hash routes', () => {
    expect(parseHash('#/')).toMatchObject({ name: 'home', lesson: '' });
    expect(parseHash('#/?from=hash_tables&now=2026-10-11')).toMatchObject({ name: 'home', from: 'hash_tables' });
    expect(parseHash('#/l/binary_heaps?b=b3')).toMatchObject({ name: 'lesson', lesson: 'binary_heaps', block: 'b3' });
    expect(parseHash('')).toMatchObject({ name: 'home' });
  });
});
