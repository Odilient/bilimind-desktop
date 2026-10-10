import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  blockSentences, daysBetween, dueCards, fieldSentences, isDue, lessonSentences, newCard, rateCard,
  reviewDatesBackwardsFromExam, sentenceRanges, splitSentences, spokenText,
} from '../src/index.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('splitSentences', () => {
  it('splits on terminal punctuation followed by a capital', () => {
    expect(splitSentences('One idea. Two ideas! Three? Yes.')).toEqual(['One idea.', 'Two ideas!', 'Three?', 'Yes.']);
  });
  it('keeps abbreviations, initials and decimals together', () => {
    expect(splitSentences('J. W. J. Williams wrote it, e.g. in 1964. Then 3.14 is pi.')).toEqual([
      'J. W. J. Williams wrote it, e.g. in 1964.', 'Then 3.14 is pi.']);
    expect(splitSentences('See Fig. 3 for the tree. It is short.')).toEqual(['See Fig. 3 for the tree.', 'It is short.']);
  });
  it('does not split before a lowercase word', () => {
    expect(splitSentences('It costs O(n). then it stops.')).toEqual(['It costs O(n). then it stops.']);
  });
  it('treats newlines as hard boundaries', () => {
    expect(splitSentences('Heading\nBody text. More')).toEqual(['Heading', 'Body text.', 'More']);
  });
});

describe('spokenText', () => {
  it('drops code fences and tables, keeps link and code text, adds periods', () => {
    const md = '# Why heaps\n\nA heap is **fast**, see [the notes](http://x).\n\n```js\nconst a = 1;\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- first item\n- second `push()` item\n\nA wrapped\nparagraph line.';
    expect(spokenText(md)).toBe('Why heaps.\nA heap is fast, see the notes.\nfirst item.\nsecond push() item.\nA wrapped paragraph line.');
  });
  it('keeps snake_case identifiers', () => {
    expect(spokenText('Call load_factor_of(t) now')).toBe('Call load_factor_of(t) now.');
  });
});

describe('sentence ids', () => {
  const block = { id: 'b2', type: 'walkthrough', payload: { intro: 'Do it. Then check.', steps: [{ n: 1, title: 'Append', detail_markdown: 'Push it. Done.' }] } };
  it('are <blockId>.<index> across fields, in order', () => {
    expect(blockSentences(block).map(s => [s.id, s.field])).toEqual([
      ['b2.0', 'intro'], ['b2.1', 'intro'], ['b2.2', 'steps.0.title'], ['b2.3', 'steps.0.detail_markdown'], ['b2.4', 'steps.0.detail_markdown']]);
    expect(fieldSentences(block, 'steps.0.detail_markdown').map(s => s.id)).toEqual(['b2.3', 'b2.4']);
  });
  it('silent blocks have none; the lesson starts with title.0', () => {
    const quiz = { id: 'b3', type: 'quiz', payload: { intro: 'Three questions.' } };
    expect(blockSentences(quiz)).toEqual([]);
    expect(lessonSentences({ title: 'Heaps', blocks: [block, quiz] })[0]!.id).toBe('title.0');
  });
  it('sentenceRanges finds sentences in rendered text', () => {
    const text = 'Why heaps\nA heap is   fast, see the notes. first item';
    const r = sentenceRanges(text, ['Why heaps.', 'A heap is fast, see the notes.', 'first item.', 'missing.']);
    expect(text.slice(...r[0]!)).toBe('Why heaps');
    expect(text.slice(...r[1]!)).toBe('A heap is   fast, see the notes.');
    expect(text.slice(...r[2]!)).toBe('first item');
    expect(r[3]).toBeNull();
  });
  it('gives the same ids in a browser bundle (esbuild IIFE in a bare vm context)', async () => {
    const req = createRequire(join(here, '..', '..', '..', 'apps', 'cli', 'package.json'));
    // esbuild is a devDependency of apps/cli, not of core: resolve it from there
    const esbuild = req('esbuild') as { build(o: Record<string, unknown>): Promise<{ outputFiles: { text: string }[] }> };
    const out = await esbuild.build({
      entryPoints: [join(here, '..', 'src', 'sentences.ts')], bundle: true, write: false, format: 'iife',
      globalName: 'S', platform: 'browser', target: 'es2020',
    });
    const ctx = vm.createContext({});
    vm.runInContext(out.outputFiles[0]!.text, ctx);
    const lesson = { title: 'Binary heaps by hand', blocks: [block, { id: 'b5', type: 'explainer', payload: { markdown: 'J. W. J. Williams, 1964. A heap is **fast**.\n\n- one\n- two' } }] };
    const browser = vm.runInContext(`S.lessonSentences(${JSON.stringify(lesson)})`, ctx) as { id: string; text: string }[];
    expect(JSON.parse(JSON.stringify(browser))).toEqual(JSON.parse(JSON.stringify(lessonSentences(lesson))));
  });
});

describe('fsrs', () => {
  it('new card is due at the planned date; rating moves it forward', () => {
    const c = newCard('2026-10-12T08:00:00+08:00', '2026-10-11T10:00:00+08:00');
    expect(isDue(c, '2026-10-12T09:00:00+08:00')).toBe(true);
    expect(isDue(c, '2026-10-11T23:00:00+08:00')).toBe(false);
    const good = rateCard(c, 'good', '2026-10-12T09:00:00+08:00');
    expect(new Date(good.due).getTime()).toBeGreaterThan(new Date('2026-10-12T09:00:00+08:00').getTime());
    expect(good.reps).toBe(1);
    const again = rateCard(c, 'again', '2026-10-12T09:00:00+08:00');
    expect(new Date(again.due).getTime()).toBeLessThanOrEqual(new Date(good.due).getTime());
  });
  it('caps the next due before the exam', () => {
    let c = newCard('2026-10-12T08:00:00+08:00');
    for (let i = 0; i < 4; i++) c = rateCard(c, 'easy', '2026-10-12T09:00:00+08:00', { notAfter: '2026-10-14T09:00:00+08:00' });
    expect(new Date(c.due).getTime()).toBeLessThanOrEqual(new Date('2026-10-14T09:00:00+08:00').getTime());
  });
  it('dueCards sorts most overdue first', () => {
    const cards = [{ id: 'x', fsrs: newCard('2026-10-12T00:00:00Z') }, { id: 'y', fsrs: newCard('2026-10-11T00:00:00Z') }, { id: 'z', fsrs: newCard('2026-10-20T00:00:00Z') }];
    expect(dueCards(cards, '2026-10-13T00:00:00Z').map(c => c.id)).toEqual(['y', 'x']);
  });
  it('review dates are counted backwards from the exam and fall before it', () => {
    expect(reviewDatesBackwardsFromExam('2026-10-11', '2026-10-14T09:00:00+08:00')).toEqual(['2026-10-12', '2026-10-13']);
    expect(reviewDatesBackwardsFromExam('2026-10-12', '2026-10-14')).toEqual(['2026-10-13']);
    const long = reviewDatesBackwardsFromExam('2026-09-01', '2026-10-14');
    expect(long).toEqual(['2026-09-30', '2026-10-07', '2026-10-11', '2026-10-13']);
    expect(reviewDatesBackwardsFromExam('2026-10-13', '2026-10-14')).toEqual([]);
    expect(reviewDatesBackwardsFromExam('2026-10-11', null)).toEqual(['2026-10-12', '2026-10-14', '2026-10-18']);
    expect(daysBetween('2026-10-11', '2026-10-14')).toEqual(['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14']);
  });
});
