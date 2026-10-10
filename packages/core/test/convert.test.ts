import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  blockNumber, excludedItems, fromSaasLesson, lessonSentences, narrationMatches, payloadIssues, validateCourse,
} from '../src/index.ts';
import type { Cite, Course, Narration, SaasLesson } from '../src/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, '..', 'fixtures', 'course-ds-mini.json'), 'utf8')) as Course;

const chunkText: Record<number, string> = {
  11: 'With chaining, each slot stores a linked list. An unsuccessful search examines only the chain in slot h(k).',
  12: 'Linear probing stores every key in the array itself.',
};
const resolveCite = (id: number, quote?: string): Cite | null => chunkText[id]
  ? { file: 'sources/l4.pdf', locator: `Page ${id}`, page: id, quote: quote ?? chunkText[id]!.split('. ')[0]!, excerpt: chunkText[id]!, chunk_id: id }
  : null;

// A Writer deleted b3; the Checker ruled q2 contradicted, the rewrite is q4 (replaces q2), q3 not covered.
const draft: SaasLesson = {
  key: 'hashing',
  blocks: [
    { id: 'b1', type: 'explainer', payload: { markdown: '# Why hashing\n\nA lookup can skip the search. It goes straight to a slot.' }, source_material_ids: [11, 99] },
    { id: 'b2', type: 'diagram', payload: { format: 'mermaid', source: 'flowchart LR\n A --> B', caption: 'Key to slot.', alt_text: 'A key goes to a slot.' }, source_material_ids: [12] },
    { id: 'b4', type: 'quiz', payload: {}, source_material_ids: [], assessments: [
      { id: 'q1', kind: 'mcq', prompt: 'Which slot?', bloom: 'apply', grader: 'deterministic', max_score: 100,
        options: [{ id: 'a', text: 'x' }, { id: 'b', text: 'y' }], answer_key: { correct_option_ids: ['a'] },
        status: 'supported', quote: 'An unsuccessful search examines only the chain in slot h(k)', explanation: 'An unsuccessful search examines only the chain in slot h(k)', cite_chunk_ids: [11] },
      { id: 'q2', kind: 'mcq', prompt: 'Every key is compared. True?', bloom: 'understand', grader: 'deterministic', max_score: 100,
        options: [{ id: 'a', text: 'True' }, { id: 'b', text: 'False' }], answer_key: { correct_option_ids: ['a'] },
        status: 'contradicted', quote: 'An unsuccessful search examines only the chain in slot h(k)', reason: 'Only one chain is searched.', cite_chunk_ids: [11] },
      { id: 'q4', kind: 'mcq', prompt: 'Which keys are compared?', bloom: 'understand', grader: 'deterministic', max_score: 100,
        options: [{ id: 'a', text: 'All' }, { id: 'b', text: 'One chain' }], answer_key: { correct_option_ids: ['b'] },
        status: 'pending', labels: ['rewritten'], replaces: 'q2' },
      { id: 'q3', kind: 'cloze', prompt: 'Python dicts use ____ addressing.', bloom: 'remember', grader: 'deterministic', max_score: 100,
        answer_key: { accepted: ['open'] }, status: 'not_covered' },
    ] },
  ],
};

describe('fromSaasLesson() draft -> course rules', () => {
  const warnings: string[] = [];
  const lesson = fromSaasLesson(draft, { id: 'hashing', title: 'Hashing', archetype: 'conceptual', resolveCite, warn: w => warnings.push(w) });
  const items = lesson.blocks.flatMap(b => b.assessments);

  it('keeps block and item ids (never renumbers by position)', () => {
    expect(lesson.blocks.map(b => b.id)).toEqual(['b1', 'b2', 'b4']);
    expect(items.map(a => a.id)).toEqual(['q1', 'q4', 'q3']);
    expect(blockNumber('b4')).toBe(4);
  });
  it('drops contradicted items and maps Checker status to verdict, labels and cites', () => {
    expect(items.find(a => a.id === 'q2')).toBeUndefined();
    const q1 = items.find(a => a.id === 'q1')!;
    expect(q1.verdict).toBe('supported');
    expect(q1.cites?.[0]?.quote).toBe('An unsuccessful search examines only the chain in slot h(k)');
    expect(items.find(a => a.id === 'q3')!.labels).toEqual(['beyond_slides']);
    expect(items.find(a => a.id === 'q4')!).toMatchObject({ verdict: 'pending', labels: ['rewritten'] });
    expect(Object.keys(q1)).not.toContain('status');
  });
  it('resolves block cites, dropping unresolvable chunk ids, and promotes the heading', () => {
    expect(lesson.blocks[0]!.cites.map(c => c.chunk_id)).toEqual([11]);
    expect(lesson.blocks[0]!.title).toBe('Why hashing');
  });
  it('lists the excluded item for receipts with its replacement', () => {
    const ex = excludedItems('hashing', draft, resolveCite);
    expect(ex).toHaveLength(1);
    expect(ex[0]).toMatchObject({ item: 'q2', replaced_by: 'q4', reason: 'Only one chain is searched.' });
    expect(ex[0]!.cite?.chunk_id).toBe(11);
  });
  it('validates as a course lesson', () => {
    const course = { ...structuredClone(fixture), lessons: [lesson], path: [], plan: { ...fixture.plan, days: [] }, review: { ...fixture.review, cards: [] } };
    expect(validateCourse(course).errors).toEqual([]);
  });
  it('keeps narration only when its cue ids match the converted lesson', () => {
    const ok: Narration = { src: 'audio/x.mp3', duration_ms: 1000, sentences: lessonSentences(lesson).map((s, i) => ({ id: s.id, start_ms: i, end_ms: i + 1 })) };
    expect(fromSaasLesson(draft, { id: 'hashing', title: 'Hashing', archetype: 'conceptual', narration: ok }).narration).toEqual(ok);
    // narration made from the RAW draft markdown (heading still inside) has one cue too many -> dropped with a warning
    const stale: Narration = { ...ok, sentences: [...ok.sentences, { id: 'b4.0', start_ms: 9, end_ms: 10 }] };
    const w: string[] = [];
    expect(fromSaasLesson(draft, { id: 'hashing', title: 'Hashing', archetype: 'conceptual', narration: stale, warn: m => w.push(m) }).narration).toBeNull();
    expect(w.join()).toMatch(/narration/);
  });
});

describe('contract checks added at review', () => {
  it('fixture narration matches its lessons', () => {
    for (const l of fixture.lessons) expect(narrationMatches(l, l.narration)).toBe(true);
  });
  it('code payload: function tests need expect, test names are unique', () => {
    const base = { mode: 'function', language: 'javascript', starter_code: '', instructions_markdown: 'Do it.' };
    expect(payloadIssues('code', { ...base, tests: [{ name: 't', call: 'f()' }] }).join()).toMatch(/expect/);
    expect(payloadIssues('code', { ...base, tests: [{ name: 't', call: 'f()', expect: null }] })).toEqual([]);
    expect(payloadIssues('code', { ...base, tests: [{ name: 't', call: 'f()', expect: 1 }, { name: 't', call: 'g()', expect: 2 }] }).join()).toMatch(/unique/);
  });
  it('review cards must name real items', () => {
    const bad = structuredClone(fixture);
    bad.review.cards[0]!.item = 'q99';
    expect(validateCourse(bad).errors.join()).toMatch(/q99|names no item/);
  });
});

describe('injectCourse() / readEmbeddedCourse()', () => {
  it('round-trips hostile text and never closes the script tag early', async () => {
    const { injectCourse, readEmbeddedCourse, COURSE_PLACEHOLDER } = await import('../src/index.ts');
    const tag = ['<script id="bm-course" type="application/json">', COURSE_PLACEHOLDER, '</', 'script>'].join('');
    const template = `<!doctype html><body><div id="app"></div>${tag}<script>/*app*/</script></body>`;
    const data = { title: 'x </script><script>alert(1)</script> <!-- y $& $1', s: 'a b c' };
    const html = injectCourse(template, data);
    const inner = html.slice(html.indexOf('application/json">') + 'application/json">'.length, html.indexOf('</script>'));
    expect(inner).not.toMatch(/<\/script|<!--/i);
    expect(JSON.parse(inner)).toEqual(data);
    expect(readEmbeddedCourse({ getElementById: () => ({ textContent: inner }) })).toEqual(data);
    expect(readEmbeddedCourse({ getElementById: () => ({ textContent: COURSE_PLACEHOLDER }) })).toBeNull();
    expect(() => injectCourse('<html></html>', data)).toThrow(/placeholder/);
  });
});

describe('gradeCode on a disabled exercise', () => {
  it("grader 'self' means the learner marks it, whatever the declared names", async () => {
    const { gradeCode } = await import('../src/index.ts');
    const r = gradeCode({ kind: 'code', grader: 'self', answer_key: { tests: ['a', 'b'] }, max_score: 100 }, [], ['a', 'b']);
    expect(r.status).toBe('self');
  });
});
