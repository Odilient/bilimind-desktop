// WP1: ingest (pdf/pptx/docx/md), chunker, digest, roles, retrieval. Real files from showcase/sources when present.
import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractFile, chunkSections, chunkText, buildDigest, detectRole, ingest, readIngest, ingestFolder, sourceText,
  titleFromName, titleFromMeta, isIgnoredSource, stripRepeatedLines, CHUNK_SIZE,
} from '../src/ingest/index.ts';
import { buildIndex, searchTerms, retrieveForLesson, lectureChunks, renderChunks } from '../src/retrieve.ts';
import { makePdf, makePptx, tempDir, fakeCtx } from './wp1-helpers.ts';
import type { SourceFile, Chunk } from '@bilimind/core';

const here = dirname(fileURLToPath(import.meta.url));
const SHOWCASE = join(here, '..', '..', '..', 'showcase', 'sources');
const DS = join(SHOWCASE, 'ds-final');

describe('extractors', () => {
  it('portrait PDF -> "Page N" sections; a text-less page is reported as scanned', async () => {
    const dir = tempDir();
    const f = join(dir, 'notes.pdf');
    writeFileSync(f, makePdf([
      { lines: ['Hash tables map keys to buckets.', 'Collisions are resolved by chaining.'] },
      { lines: null },
      { lines: ['Load factor alpha = n / m.'] },
    ]));
    const ex = await extractFile(f);
    expect(ex.kind).toBe('pdf');
    expect(ex.pages).toBe(3);
    expect(ex.landscape).toBe(false);
    expect(ex.scanned_pages).toEqual([2]);
    expect(ex.sections.map(s => s.locator)).toEqual(['Page 1', 'Page 3']);
    expect(ex.sections[0]!.page).toBe(1);
    expect(ex.sections[0]!.text).toContain('Collisions are resolved by chaining.');
  });

  it('landscape PDF pages are slides -> "Slide N"', async () => {
    const dir = tempDir();
    const f = join(dir, 'deck.pdf');
    writeFileSync(f, makePdf([{ lines: ['Binary heaps'], w: 960, h: 540 }, { lines: ['Sift up after insert'], w: 960, h: 540 }]));
    const ex = await extractFile(f);
    expect(ex.landscape).toBe(true);
    expect(ex.sections.map(s => s.locator)).toEqual(['Slide 1', 'Slide 2']);
  });

  it('pptx -> "Slide N" in presentation order with speaker notes; a picture-only slide has no text', async () => {
    const dir = tempDir();
    const f = join(dir, 'deck.pptx');
    writeFileSync(f, makePptx());
    const ex = await extractFile(f);
    expect(ex.kind).toBe('pptx');
    expect(ex.pages).toBe(3);
    expect(ex.sections.map(s => s.locator)).toEqual(['Slide 1', 'Slide 2']);
    expect(ex.sections[0]!.text).toBe('Hash functions\nA hash function maps a key to a bucket index\n\nSpeaker notes: Tell them the modulo trick is the simplest hash.');
    expect(ex.sections[1]!.text).toContain('Each bucket holds a list & collisions append');
    expect(ex.scanned_pages).toEqual([3]);
  });

  it('markdown splits on headings', async () => {
    const dir = tempDir();
    const f = join(dir, 'n.md');
    writeFileSync(f, '# Phrasebook\nIntro line\n\n## Greetings\nSelamat pagi = good morning\n```\n# not a heading\n```\n## Numbers\nsatu, dua, tiga\n');
    const ex = await extractFile(f);
    expect(ex.sections.map(s => s.locator)).toEqual(['Phrasebook', 'Greetings', 'Numbers']);
    expect(ex.sections[1]!.text).toContain('# not a heading');
  });

  it.skipIf(!existsSync(join(SHOWCASE, 'boba-day-one', 'mutiara-tea-bar-SOP.docx')))('docx splits on Title/Heading styles; tables become rows', async () => {
    const ex = await extractFile(join(SHOWCASE, 'boba-day-one', 'mutiara-tea-bar-SOP.docx'));
    expect(ex.kind).toBe('docx');
    const locs = ex.sections.map(s => s.locator);
    expect(locs).toContain('3. Shifts and roles');
    expect(locs).toContain('8. Menu and codes');
    const menu = ex.sections.find(s => s.locator === '8. Menu and codes')!;
    expect(menu.text).toMatch(/BS01 \| Brown Sugar Milk Tea with Pearls \| RM 10\.90/);
    expect(detectRole('mutiara-tea-bar-SOP.docx', ex.sections.map(s => s.text).join('\n'))).toBe('sop');
  });

  it('strips running footers but never empties a page', () => {
    const pages = ['Intro\nCSC2103 | Lecture 2 1', 'Hashing\nCSC2103 | Lecture 2 2', 'Probing\nCSC2103 | Lecture 2 3', 'CSC2103 | Lecture 2 4'];
    expect(stripRepeatedLines(pages)).toEqual(['Intro', 'Hashing', 'Probing', 'CSC2103 | Lecture 2 4']);
  });
});

describe('chunker', () => {
  const file = { material_id: 3, title: 'Lecture 3' };
  it('keeps each section (slide) as its own chunk with its locator; ids are global, ordinals per file', () => {
    const chunks = chunkSections(file, [
      { locator: 'Slide 1', page: 1, text: 'Binary search trees keep keys in order.' },
      { locator: 'Slide 2', page: 2, text: 'Thanks!' },
      { locator: 'Slide 3', page: 3, text: 'In-order traversal visits keys in sorted order.' },
    ], 40);
    expect(chunks.map(c => [c.id, c.ordinal, c.locator, c.page])).toEqual([[40, 1, 'Slide 1', 1], [41, 2, 'Slide 3', 3]]);
    expect(chunks[0]!.material_id).toBe(3);
    expect(chunks[0]!.title).toBe('Lecture 3');
  });

  it('a long section splits at <= 1200 chars with ~150 overlap, never mid-word, all pieces keep the locator', () => {
    const words = Array.from({ length: 600 }, (_, i) => `word${i}`);
    const paragraphs = [words.slice(0, 200).join(' '), words.slice(200, 400).join(' '), words.slice(400).join(' ')].join('\n\n');
    const pieces = chunkText(paragraphs);
    expect(pieces.length).toBeGreaterThan(3);
    for (const p of pieces) expect([...p].length).toBeLessThanOrEqual(CHUNK_SIZE);
    for (let i = 1; i < pieces.length; i++) expect(pieces[i]!).toMatch(/^word\d+/);
    const chunks = chunkSections(file, [{ locator: 'Page 4', page: 4, text: paragraphs }], 1);
    expect(new Set(chunks.map(c => c.locator))).toEqual(new Set(['Page 4']));
    // sourceText removes the overlaps: every word exactly once
    const rebuilt = sourceText({ chunks }, 3, { markers: false });
    for (const w of ['word0', 'word199', 'word200', 'word599']) expect(rebuilt.split(/\s+/).filter(x => x === w)).toHaveLength(1);
    expect(rebuilt.split(/\s+/).length).toBe(600);
  });
});

describe('roles, titles, ignored files', () => {
  it('detectRole heuristics', () => {
    expect(detectRole('exam.pdf', 'Answer ALL questions. Time allowed: 2 hours\nQuestion 1 (15 marks)\n(a) Define ... [5 marks]\nQuestion 2\n[10 marks]')).toBe('past_paper');
    expect(detectRole('L02-hashing.pdf', 'Learning outcomes\nExplain hashing\nLinear probing\nLoad factor')).toBe('lecture');
    expect(detectRole('course-outline.pdf', 'Course learning outcomes CLO1 CLO2 CLO3. Credit hours: 4. Assessment breakdown.')).toBe('syllabus');
    expect(detectRole('crew-manual.docx', 'Standard operating procedure for every shift. SOP 4: closing checklist. Procedure for the opening shift.')).toBe('sop');
    expect(detectRole('notes.md', 'Some notes about trees')).toBe('lecture');
  });
  it('titles', () => {
    expect(titleFromName('CSC2103-L02-hash-tables.pdf')).toBe('Lecture 2 · Hash tables');
    expect(titleFromName('week-7_trees.pdf')).toBe('Week 7 · Trees');
    expect(titleFromName('past-paper.pdf')).toBe('Past paper');
    expect(titleFromMeta('CSC2103 Data Structures - Lecture 2: Hash Tables')).toBe('Lecture 2 · Hash Tables');
    expect(titleFromMeta('CSC2103 Data Structures - Sample Final Examination')).toBe('Sample Final Examination');
    expect(titleFromMeta('AI SLIDES ')).toBeNull();
    expect(titleFromMeta('Microsoft PowerPoint - deck.pptx')).toBeNull();
  });
  it('LICENSE*.md and STATUS.md are never course material', () => {
    for (const n of ['LICENSE.md', 'LICENSE-CC-BY.md', 'licence.txt', 'STATUS.md', '.DS_Store', '~$deck.pptx']) expect(isIgnoredSource(n), n).toBe(true);
    for (const n of ['lecture.md', 'license-plate-recognition.pdf', 'past-paper.pdf']) expect(isIgnoredSource(n), n).toBe(false);
  });
});

describe('digest', () => {
  const f = (id: number, role: SourceFile['role'], title: string): SourceFile =>
    ({ material_id: id, name: `${id}.pdf`, path: `sources/${id}.pdf`, title, kind: 'pdf', role, pages: 20, words: 1000, scanned_pages: [], landscape: true });
  const chunksFor = (id: number, n: number): Chunk[] => Array.from({ length: n }, (_, i) =>
    ({ id: id * 100 + i, material_id: id, title: `T${id}`, ordinal: i + 1, locator: `Slide ${i + 1}`, page: i + 1, content: `Slide ${i + 1} of deck ${id}: ` + 'lorem ipsum dolor '.repeat(30) }));
  it('<= 6000 chars, past papers excluded, evenly spread from first to last slide', () => {
    const files = [f(1, 'lecture', 'Lecture 1'), f(2, 'lecture', 'Lecture 2'), f(3, 'past_paper', 'Exam')];
    const d = buildDigest(files, [...chunksFor(1, 20), ...chunksFor(2, 20), ...chunksFor(3, 5)]);
    expect([...d].length).toBeLessThanOrEqual(6000);
    expect(d).toContain('### Material #1 — "Lecture 1" (slide deck)');
    expect(d).toContain('[Slide 1] Slide 1 of deck 1');
    expect(d).toContain('[Slide 20] Slide 20 of deck 2');
    expect(d).not.toContain('deck 3');
    expect(buildDigest(files, chunksFor(1, 20), 1000).length).toBeLessThanOrEqual(1000);
  });
});

describe('retrieval', () => {
  const chunks: Chunk[] = [
    { id: 1, material_id: 1, title: 'L2', ordinal: 1, locator: 'Slide 3', page: 3, content: 'Linear probing searches the next slot when a collision happens.' },
    { id: 2, material_id: 1, title: 'L2', ordinal: 2, locator: 'Slide 4', page: 4, content: 'The load factor alpha is n divided by m; resize when alpha exceeds 0.75.' },
    { id: 3, material_id: 2, title: 'L4', ordinal: 1, locator: 'Slide 7', page: 7, content: 'Insert into a binary heap: append at the end, then sift up.' },
    { id: 4, material_id: 2, title: 'L4', ordinal: 2, locator: 'Slide 9', page: 9, content: 'Extract-min swaps the root with the last element, then sifts down.' },
    { id: 5, material_id: 3, title: 'L3', ordinal: 1, locator: 'Slide 2', page: 2, content: 'Hashtables in Java: HashMap uses chaining.' },
  ];
  it('searchTerms: lowercase, >= 3 chars, stopwords out, unique, max 24', () => {
    expect(searchTerms('An Introduction to the Load Factor: how and why it matters, load!')).toEqual(['load', 'factor', 'matters']);
    expect(searchTerms(Array.from({ length: 40 }, (_, i) => `term${i}`).join(' '))).toHaveLength(24);
  });
  it('top chunks by relevance, prefix match on terms >= 4 chars', () => {
    const idx = buildIndex(chunks);
    const hits = idx.search('probing collisions', 6);
    expect(hits[0]!.chunk.id).toBe(1);
    expect(hits[0]!.terms).toEqual(expect.arrayContaining(['probing']));
    const got = retrieveForLesson(idx, chunks, { title: 'Binary heap insert', summary: 'sift up after an insert' });
    expect(got[0]!.id).toBe(3);
  });
  it('substring fallback reaches terms inside compounds; at least `minimum` chunks on weak overlap', () => {
    const idx = buildIndex(chunks);
    const got = retrieveForLesson(idx, chunks, { title: 'tables' }, { limit: 6, minimum: 1 });
    expect(got.map(c => c.id)).toContain(5);   // "hashtables"
    const weak = retrieveForLesson(idx, chunks, { title: 'Resizing strategies', concept_key: 'resize_policy' }, { minimum: 2 });
    expect(weak.length).toBeGreaterThanOrEqual(1);
    expect(weak[0]!.id).toBe(2);
  });
  it('renderChunks prints chunk ids as material_id with the locator', () => {
    expect(renderChunks(chunks.slice(0, 1))).toBe('[material_id=1 · L2 · Slide 3]\nLinear probing searches the next slot when a collision happens.');
  });
});

describe.skipIf(!existsSync(DS))('showcase ds-final (WP8 sources)', () => {
  it('every file ingests; past paper detected; decks give Slide N; LICENSE skipped', async () => {
    const r = await ingestFolder(DS);
    expect(r.files.map(f => f.name)).not.toContain('LICENSE.md');
    expect(r.files).toHaveLength(5);
    const pp = r.files.find(f => f.name === 'past-paper.pdf')!;
    expect(pp.role).toBe('past_paper');
    expect(pp.landscape).toBe(false);
    for (const f of r.files.filter(x => x.name.startsWith('CSC2103-L0'))) {
      expect(f.role).toBe('lecture');
      expect(f.landscape).toBe(true);
      expect(f.scanned_pages).toEqual([]);
    }
    expect(r.files.find(f => f.name.includes('L02'))!.title).toBe('Lecture 2 · Hash Tables');
    const l02 = r.chunks.filter(c => c.material_id === r.files.find(f => f.name.includes('L02'))!.material_id);
    expect(l02.some(c => c.locator === 'Slide 12' && /probes/i.test(c.content))).toBe(true);
    expect(r.chunks.every(c => [...c.content].length <= 1200)).toBe(true);
    expect([...r.digest].length).toBeLessThanOrEqual(6000);
    expect(r.digest).not.toContain('Answer ALL');
    expect(r.thin_files).toEqual([]);
    const paper = sourceText(r, pp.material_id);
    expect(paper).toContain('Question 1 (15 marks)');
    expect(paper).toContain('Question 5');
    expect((paper.match(/Time allowed/g) ?? []).length).toBe(1);
    const idx = buildIndex(lectureChunks(r));
    const heap = retrieveForLesson(idx, lectureChunks(r), { title: 'Binary heap insert and sift up' });
    expect(heap).toHaveLength(6);
    expect(heap[0]!.title).toMatch(/Heaps/);
    expect(lectureChunks(r).some(c => c.material_id === pp.material_id)).toBe(false);
  }, 60_000);

  it('the ingest command writes crew/ingest.json and honours --role overrides', async () => {
    const course = tempDir('bm-course-');
    mkdirSync(join(course, 'sources'), { recursive: true });
    const { copyFileSync, readdirSync } = await import('node:fs');
    for (const n of readdirSync(DS)) copyFileSync(join(DS, n), join(course, 'sources', n));
    const lines: string[] = [];
    const data = await ingest(fakeCtx(course, { progress: l => lines.push(l) }), { roles: { 'CSC2103-L01-analysis-arrays-linked-lists.pdf': 'syllabus' } });
    expect(data.files).toHaveLength(5);
    expect(data.files.find(f => f.name.includes('L01'))!.role).toBe('syllabus');
    expect(data.chunks).toBeGreaterThan(40);
    expect(readIngest(course).chunks.length).toBe(data.chunks);
    expect(lines.join('\n')).toMatch(/skipped LICENSE\.md/);
  }, 60_000);
});
