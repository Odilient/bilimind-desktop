// WP3: the Checker's tools: evidence, verdict (verbatim quotes), rewrite-item (mocked LLM), plant / plant-score.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { excludedItems, fromSaasLesson } from '@bilimind/core';
import type { Cite } from '@bilimind/core';
import type { LlmRequest } from '../src/contracts.ts';

const llm = vi.hoisted(() => ({ reply: null as unknown, calls: [] as LlmRequest[] }));
vi.mock('../src/llm.ts', () => ({
  callJson: vi.fn(async (ctx: { spend: { usd: number; calls: number } }, req: LlmRequest) => {
    llm.calls.push(req);
    ctx.spend.usd += 0.0004; ctx.spend.calls++;
    return { data: llm.reply, model: 'mock', provider: 'deepseek', usage: { prompt_tokens: 900, completion_tokens: 150 }, cost_usd: 0.0004, ms: 3, cached: false, attempts: 1 };
  }),
}));

const { evidence, findQuote, plant, plantScore, readVerdicts, rewriteItem, verdict } = await import('../src/index.ts');
const { coursePaths } = await import('../src/course.ts');
const { makeCourse, readDraft, itemOf } = await import('./wp3-fixture.ts');
type TestCourse = ReturnType<typeof makeCourse>;

let t: TestCourse | null = null;
afterEach(() => { t?.cleanup(); t = null; llm.calls = []; });

const QUOTE_P7 = 'An unsuccessful search examines only the chain in slot h(k), whose expected length is α.';

describe('findQuote', () => {
  const chunks = [
    { id: 1, material_id: 1, title: 'L4', ordinal: 1, locator: 'Page 9', page: 9, content: 'an unsuccessful search takes about ½(1 + 1/(1 − α)²) probes, which grows\nwithout   bound as α approaches 1.' },
    { id: 2, material_id: 1, title: 'L4', ordinal: 2, locator: 'Page 7', page: 7, content: `With chaining, each slot stores a linked list. ${QUOTE_P7}` },
  ];
  it('matches whitespace-, dash- and quote-normalised substrings, and elisions in order', () => {
    expect(findQuote('which grows without bound', chunks)?.id).toBe(1);
    expect(findQuote('about ½(1 + 1/(1 - α)²) probes', chunks)?.id).toBe(1);        // ASCII hyphen for U+2212
    expect(findQuote('"With chaining, each slot ... expected length is α."', chunks)?.id).toBe(2);
    expect(findQuote('expected length is α ... With chaining', chunks)).toBeNull();     // wrong order
    expect(findQuote('which grows with bound', chunks)).toBeNull();
    expect(findQuote('With Chaining, each slot', chunks)).toBeNull();                    // case is kept
  });
});

describe('evidence + verdict', () => {
  it('writes one packet per checkable item with excerpts that verdict accepts', async () => {
    t = makeCourse();
    const r = await evidence(t.ctx, { lesson: 'hash_tables' });
    expect(r).toEqual({ items: 5, packet: 'crew/evidence/hash_tables.md' });
    const md = readFileSync(coursePaths(t.dir).evidenceMd('hash_tables'), 'utf8');
    expect(md).toContain('## q2 · mcq · understand');
    expect(md).toContain('**Accepted answer:** b)');
    expect(md).toMatch(/\[chunk \d+ · Lecture 4 · Hashing \(sample notes\) · Page 7\]/);
    expect(md).not.toContain('## q1 ');                                                    // code items go to code-test
    expect(md).toContain('verdict --lesson hash_tables --file rulings.json');
  });

  it('refuses invented quotes, excludes contradicted items from the course, labels not_covered, sets the explanation', async () => {
    t = makeCourse();
    const r = await verdict(t.ctx, { lesson: 'hash_tables', rulings: [
      { item: 'q2', verdict: 'supported', quote: 'Chaining is always faster than probing in every case.', reason: 'invented' },
      { item: 'q7', verdict: 'contradicted', quote: QUOTE_P7, reason: 'Only the chain at h(k) is examined, not every key.' },
      { item: 'q3', verdict: 'not_covered', quote: '', reason: 'The excerpts do not discuss this.' },
      { item: 'q4', verdict: 'supported', quote: 'an unsuccessful search takes about ½(1 + 1/(1 − α)²) probes', reason: 'Formula on page 9.' },
      { item: 'q99', verdict: 'supported', quote: QUOTE_P7, reason: 'x' },
      { item: 'q6', verdict: 'supported', quote: 'it', reason: 'too short' },
    ] });
    expect(r.applied).toBe(3);
    expect(r.excluded).toBe(1);
    expect(r.labelled).toBe(1);
    expect(r.refused.map(x => x.item)).toEqual(['q2', 'q99', 'q6']);
    expect(r.refused[0]!.why).toMatch(/not verbatim/);

    const d = readDraft(t.dir, 'hash_tables');
    const q7 = itemOf(d, 'q7');
    expect(q7).toMatchObject({ status: 'contradicted', quote: QUOTE_P7, reason: 'Only the chain at h(k) is examined, not every key.' });
    expect(q7.cite_chunk_ids).toHaveLength(1);
    expect(itemOf(d, 'q3')).toMatchObject({ status: 'not_covered' });
    expect(itemOf(d, 'q3').labels).toContain('beyond_slides');
    // G2: a supported ruling keeps the Writer's explanation; the quote becomes the item's cite
    expect(itemOf(d, 'q4')).toMatchObject({ status: 'supported', quote: 'an unsuccessful search takes about ½(1 + 1/(1 − α)²) probes' });
    expect(itemOf(d, 'q4').explanation).not.toBe('an unsuccessful search takes about ½(1 + 1/(1 − α)²) probes');
    expect(itemOf(d, 'q2').status).toBe('not_covered');                                    // refused ruling changed nothing

    const verdicts = readVerdicts(t.dir, 'hash_tables');
    expect(verdicts.map(v => [v.item, v.verdict, v.round])).toEqual([['q7', 'contradicted', 1], ['q3', 'not_covered', 1], ['q4', 'supported', 1]]);

    // the draft -> course conversion drops the contradicted item and lists it in receipts.excluded
    const resolveCite = (id: number, quote?: string): Cite | null => {
      const c = t!.chunks.find(x => x.id === id);
      return c ? { file: 'sources/sample-lecture-04-hashing.pdf', locator: c.locator ?? 'Page 1', page: c.page, quote: quote ?? c.content.slice(0, 40), excerpt: c.content, chunk_id: id } : null;
    };
    const lesson = fromSaasLesson(d as never, { id: 'hash_tables', title: 'Hash tables', archetype: 'quantitative', resolveCite });
    const items = lesson.blocks.flatMap(b => b.assessments);
    expect(items.map(a => a.id)).not.toContain('q7');
    expect(items.find(a => a.id === 'q3')!.labels).toContain('beyond_slides');
    const q4 = items.find(a => a.id === 'q4')!;
    expect(q4.cites![0]!.quote).toMatch(/^an unsuccessful search/);
    const ex = excludedItems('hash_tables', d as never, resolveCite);
    expect(ex).toEqual([expect.objectContaining({ item: 'q7', quote: QUOTE_P7, replaced_by: null })]);
  });
});

describe('rewrite-item (mocked callJson)', () => {
  it('inserts a pending rewritten item after the contradicted one with the next free id', async () => {
    t = makeCourse();
    await verdict(t.ctx, { lesson: 'hash_tables', rulings: [{ item: 'q7', verdict: 'contradicted', quote: QUOTE_P7, reason: 'Only the chain at h(k) is examined.' }] });
    llm.reply = {
      kind: 'mcq', bloom: 'understand',
      prompt: 'With chaining, which keys does an unsuccessful search for k compare against?',
      options: [{ id: 'a', text: 'Every key in the table' }, { id: 'b', text: 'Only the keys in the chain at slot h(k)' }, { id: 'c', text: 'The keys in the two neighbouring slots' }, { id: 'd', text: 'Only the first key of every chain' }],
      answer_key: { correct_option_ids: ['b'] }, quote: QUOTE_P7,
    };
    const r = await rewriteItem(t.ctx, { lesson: 'hash_tables', item: 'q7', reason: 'Only the chain at h(k) is examined.' });
    expect(r.status).toBe('pending');
    expect(r.item).toMatchObject({ id: 'q8', kind: 'mcq', replaces: 'q7', labels: ['rewritten'], status: 'pending', grader: 'deterministic', max_score: 100 });
    expect(llm.calls).toHaveLength(1);
    expect(llm.calls[0]!.stage).toBe('rewrite_item');
    expect(llm.calls[0]!.user).toContain(QUOTE_P7);
    expect(llm.calls[0]!.user).toContain('Only the chain at h(k) is examined.');
    expect(llm.calls[0]!.validate!(llm.reply)).toEqual([]);
    expect(llm.calls[0]!.validate!({ ...(llm.reply as object), options: [{ id: 'a', text: 'x' }] }).join(' ')).toMatch(/exactly 4 options/);
    expect(t.ctx.spend.usd).toBeCloseTo(0.0004);

    const d = readDraft(t.dir, 'hash_tables');
    const ids = d.blocks.find(b => b.id === 'b11')!.assessments.map(a => a.id);
    expect(ids.indexOf('q8')).toBe(ids.indexOf('q7') + 1);
    expect(itemOf(d, 'q7').status).toBe('contradicted');

    // the Checker rules on the new id (round 2); the receipts link old -> new
    const v = await verdict(t.ctx, { lesson: 'hash_tables', rulings: [{ item: 'q8', verdict: 'supported', quote: 'examines only the chain in slot h(k)', reason: 'Page 7.' }] });
    expect(v.applied).toBe(1);
    expect(readVerdicts(t.dir, 'hash_tables').at(-1)).toMatchObject({ item: 'q8', round: 2 });
    expect(excludedItems('hash_tables', readDraft(t.dir, 'hash_tables') as never)[0]!.replaced_by).toBe('q8');
    await expect(rewriteItem(t.ctx, { lesson: 'hash_tables', item: 'q7', reason: 'again' })).rejects.toThrow(/already rewritten as q8/);
  });

  it('refuses a reply that is still invalid', async () => {
    t = makeCourse();
    llm.reply = { kind: 'cloze', bloom: 'remember', prompt: 'No blank in this prompt at all.', answer_key: { accepted: ['x'] } };
    await expect(rewriteItem(t.ctx, { lesson: 'binary_heaps', item: 'q4', reason: 'wrong formula' })).rejects.toThrow(/still invalid/);
    expect(itemOf(readDraft(t.dir, 'binary_heaps'), 'q4').status).toBe('supported');   // nothing written
  });
});

describe('plant / plant-score', () => {
  it('plant --n 10: a perfect checker scores 10/10, an "all supported" checker 0/10', async () => {
    for (const style of ['perfect', 'all_supported'] as const) {
      t = makeCourse({ copies: true });
      const p = await plant(t.ctx, { n: 10 });
      expect(p).toEqual({ planted: 10, key_file: 'crew/plant-key.json' });
      const key = JSON.parse(readFileSync(`${t.dir}/crew/plant-key.json`, 'utf8'));
      expect(new Set(key.entries.map((e: { lesson: string }) => e.lesson)).size).toBe(4);   // spread across lessons
      for (const lessonKey of Object.keys(key.verdict_offsets)) {
        const d = readDraft(t.dir, lessonKey);
        for (const e of key.entries.filter((x: { lesson: string }) => x.lesson === lessonKey))
          expect(itemOf(d, e.item).answer_key).toEqual(e.planted);
        const live = d.blocks.flatMap(b => b.assessments).filter(a => a.kind !== 'code' && a.status !== 'contradicted' && a.status !== 'excluded');
        expect(live.every(a => a.status === 'unchecked')).toBe(true);               // statuses give nothing away
        // scripted checker: quote the first sentence of the item's first chunk
        const rulings = live.map(a => {
          const block = d.blocks.find(b => b.assessments.includes(a))!;
          const cid = (a.cite_chunk_ids ?? [])[0] ?? (block.source_material_ids ?? [])[0] ?? d.blocks.flatMap(b => b.source_material_ids ?? [])[0]!;
          const quote = t!.chunks.find(c => c.id === cid)!.content.split('. ')[0]!;
          const planted = key.entries.some((e: { lesson: string; item: string }) => e.lesson === lessonKey && e.item === a.id);
          return { item: a.id, verdict: (style === 'perfect' && planted ? 'contradicted' : 'supported') as 'contradicted' | 'supported', quote, reason: 'scripted' };
        });
        const v = await verdict(t.ctx, { lesson: lessonKey, rulings });
        // G2: a supported quote must share a key term with the answer; the scripted first-sentence quote often does not
        expect(v.refused.filter(r => !/does not mention the answer/.test(r.why))).toEqual([]);
      }
      const s = await plantScore(t.ctx);
      expect(s).toEqual(style === 'perfect' ? { planted: 10, caught: 10, missed: 0, false_alarms: 0 } : { planted: 10, caught: 0, missed: 10, false_alarms: 0 });
      await expect(plant(t.ctx, { n: 3 })).rejects.toThrow(/already has planted errors/);
      t.cleanup(); t = null;
    }
  });
});
