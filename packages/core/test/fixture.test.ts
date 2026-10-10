import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ASSESSMENT_KINDS, ENABLED_TYPES, TIER_A, fromSaasLesson, lessonSentences, validateCourse,
} from '../src/index.ts';
import type { Cite, Course } from '../src/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, '..', 'fixtures', 'course-ds-mini.json'), 'utf8')) as Course;
const samplesDir = join(here, '..', '..', '..', 'hackathon', 'research', 'engine-port-samples');

describe('fixtures/course-ds-mini.json', () => {
  it('validates against the course schema', () => {
    const v = validateCourse(fixture);
    expect(v.errors).toEqual([]);
    expect(v.ok).toBe(true);
  });
  it('contains every enabled block type (all Tier A + Tier B)', () => {
    const types = new Set(fixture.lessons.flatMap(l => l.blocks.map(b => b.type)));
    for (const t of TIER_A) expect(types, t).toContain(t);
    for (const t of ENABLED_TYPES) expect(types, t).toContain(t);
  });
  it('contains every assessment kind', () => {
    const kinds = new Set(fixture.lessons.flatMap(l => l.blocks.flatMap(b => b.assessments.map(a => a.kind))));
    for (const k of ASSESSMENT_KINDS) expect(kinds, k).toContain(k);
  });
  it('narration cue ids are exactly the sentence ids of core/sentences.ts', () => {
    for (const l of fixture.lessons) {
      expect(l.narration!.sentences.map(s => s.id)).toEqual(lessonSentences(l).map(s => s.id));
    }
    expect(fixture.narration!.sentences[0]!.id).toBe('plan.0');
  });
  it('has a beyond_slides label, a rejected item in receipts and quoted cites', () => {
    const items = fixture.lessons.flatMap(l => l.blocks.flatMap(b => b.assessments));
    expect(items.some(a => a.labels?.includes('beyond_slides'))).toBe(true);
    expect(fixture.receipts.excluded.length).toBeGreaterThan(0);
    const cites = fixture.lessons.flatMap(l => l.blocks.flatMap(b => b.cites));
    expect(cites.length).toBeGreaterThan(5);
    for (const c of cites) expect(c.excerpt).toContain(c.quote);
  });
  it('rejects a broken course with readable errors', () => {
    const bad = structuredClone(fixture) as unknown as { lessons: { blocks: { payload: Record<string, unknown> }[] }[] };
    bad.lessons[0]!.blocks[0]!.payload = {};
    const v = validateCourse(bad);
    expect(v.ok).toBe(false);
    expect(v.errors.join('\n')).toMatch(/markdown/);
  });
});

describe('fromSaasLesson() on the recorded SaaS lessons', () => {
  const resolveCite = (id: number): Cite => ({ file: 'sources/week-7-trees.pdf', locator: `Slide ${id}`, page: id, quote: 'BST invariant', excerpt: 'The BST invariant ...' });
  for (const name of ['lesson-bst-noreason.json', 'lesson-bst-pinned.json', 'lesson-bst-reasoning.json']) {
    it(`${name} validates as a course lesson`, () => {
      const saas = JSON.parse(readFileSync(join(samplesDir, name), 'utf8'));
      const lesson = fromSaasLesson(saas, { id: 'bst', title: 'Binary search trees', archetype: 'conceptual', resolveCite });
      const course = { ...structuredClone(fixture), lessons: [lesson], path: [], plan: { ...fixture.plan, days: [] }, review: { ...fixture.review, cards: [] } };
      const v = validateCourse(course);
      expect(v.errors).toEqual([]);
      expect(lesson.blocks.filter(b => b.type === 'diagram').length).toBeLessThanOrEqual(1);   // singleton rule
      expect(lesson.blocks.flatMap(b => b.assessments).every(a => /^q\d+$/.test(a.id))).toBe(true);
    });
  }
});
