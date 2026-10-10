// WP5b unit tests: safe markdown, key terms, Greek-safe labels, the playground engine and chart, the
// offline Mermaid flow, and the narration contract (every cue sentence is findable in the rendered text).
// The browser-level checks (Blob worker, 1.5 s kill, Mermaid, spans, screenshots) are in harness/shoot.mjs.
import { describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { blockSentences, sentenceRanges } from '@bilimind/core';
import fixture from '@bilimind/core/fixtures/course-ds-mini.json';
import { escapeHtml, findDefinition, keepCase, lessonGlossary, markKeyTerms, renderInline, renderMarkdown } from './markdown.ts';
import {
  SWEEP_POINTS, buildCalls, chartGeometry, crossed, evaluateBatch, fmtInput, fmtOutput, niceTicks, sweepXs, workerSource,
} from './playground.ts';
import { flowFromMermaid } from './mermaid.ts';

const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

describe('markdown is safe', () => {
  it('escapes raw HTML instead of rendering it', () => {
    const html = renderMarkdown('Hello <script>alert(1)</script> <img src=x onerror=alert(1)>\n\n<b>bold</b>');
    expect(html).not.toMatch(/<script|<img|<b>/);
    expect(html).toContain('&lt;script&gt;');
  });
  it('never links javascript: and never loads images', () => {
    const html = renderInline('[x](javascript:alert(1)) ![pic](https://e.com/a.png) [ok](https://example.com)');
    expect(html).not.toMatch(/href="javascript/);
    expect(html).not.toMatch(/<img/);
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });
  it('renders emphasis, code, lists, tables and a lead paragraph', () => {
    const html = renderMarkdown('First **bold** and `a*b*c`.\n\nSecond *it*.\n\n3. three\n4. four\n\n| a | b |\n|---|--:|\n| 1 | 2 |', { lead: true });
    expect(html).toContain('<p class="lead">First <strong>bold</strong> and <code>a*b*c</code>.</p>');
    expect(html).toContain('<em>it</em>');
    expect(html).toContain('<ol style="counter-reset: n 2">');
    expect(html).toContain('<td style="text-align:right">2</td>');
  });
  it('does not italicise arithmetic', () => {
    expect(renderInline('2 * 3 * 4')).not.toContain('<em>');
  });
  it('drops a heading that was promoted to the block title', () => {
    expect(renderMarkdown('# Title\n\nBody', { dropHeading: 'Title' })).toBe('<p>Body</p>');
  });
});

describe('key terms', () => {
  const lesson = fixture.lessons[0]!;
  const glossary = lessonGlossary(lesson as never);
  it('builds the glossary from the lesson cards', () => {
    expect(glossary.length).toBeGreaterThan(3);
    expect(findDefinition('load factor', glossary)).toMatch(/n \/ m/);
    expect(findDefinition('collision', glossary)).toMatch(/same slot/);
    expect(findDefinition('xyz', glossary)).toBeNull();
  });
  it('marks defined bold terms and lists every bold term once', () => {
    const md = (lesson.blocks[0]!.payload as { markdown: string }).markdown;
    const { html, terms } = markKeyTerms(renderMarkdown(md), glossary);
    expect(terms.map(t => t.term)).toEqual(['hash function', 'collision', 'chaining', 'open addressing', 'load factor']);
    expect(html).toContain('<strong class="kt" tabindex="0" data-kt="1">collision</strong>');
    expect(html).toContain('<strong>hash function</strong>');
  });
  it('keeps Greek letters out of text-transform', () => {
    expect(keepCase('Cost as α grows <b>')).toBe('Cost as <span class="nt">α</span> grows &lt;b&gt;');
    expect(escapeHtml('"x"')).toBe('&quot;x&quot;');
  });
});

describe('playground engine', () => {
  const formula = 'function compute(i) { return 0.5 * (1 + 1 / ((1 - i.alpha) * (1 - i.alpha))); }';
  it('evaluates a batch, with non-finite results as null', () => {
    const r = evaluateBatch(formula, [{ alpha: 0.5 }, { alpha: 0.75 }, { alpha: 0.9 }, { alpha: 1 }]);
    expect(r.error).toBeUndefined();
    expect(r.values.slice(0, 3).map(v => Number(v!.toFixed(2)))).toEqual([2.5, 8.5, 50.5]);
    expect(r.values[3]).toBeNull();
  });
  it('reports a broken formula instead of throwing', () => {
    expect(evaluateBatch('function compute(i) { return (', [{}]).error).toMatch(/parse/);
    expect(evaluateBatch('const x = 1;', [{}]).error).toMatch(/compute/);
    expect(evaluateBatch('function compute(i) { throw new Error("x"); }', [{}]).values).toEqual([null]);
  });
  it('freezes the input so the formula cannot mutate it', () => {
    expect(evaluateBatch('function compute(i) { i.a = 9; return i.a; }', [{ a: 1 }]).values).toEqual([null]);
  });
  it('the worker source is self-contained and answers postMessage', () => {
    let reply: unknown = null;
    const self: Record<string, unknown> = { postMessage: (m: unknown) => { reply = m; } };
    runInNewContext(workerSource(), { self });
    (self.onmessage as (e: unknown) => void)({ data: { id: 7, formula, calls: [{ alpha: 0.5 }] } });
    expect(reply).toEqual({ id: 7, values: [2.5], error: undefined });
  });
  it('sweeps the first input across 28 points and keeps the others fixed', () => {
    const inputs = [{ key: 'alpha', label: 'a', min: 0.05, max: 0.95, step: 0.05, default: 0.5 }, { key: 'm', label: 'm', min: 1, max: 10, step: 1, default: 4 }];
    const xs = sweepXs(inputs[0]);
    expect(xs).toHaveLength(SWEEP_POINTS);
    expect(xs[0]).toBeCloseTo(0.05);
    expect(xs[27]).toBeCloseTo(0.95);
    const calls = buildCalls(inputs, { alpha: 0.6, m: 7 });
    expect(calls).toHaveLength(29);
    expect(calls[0]).toEqual({ alpha: 0.6, m: 7 });
    expect(calls.slice(1).every(c => c.m === 7)).toBe(true);
  });
  it('formats inputs by step and outputs by size', () => {
    expect(fmtInput(0.5, 0.05)).toBe('0.50');
    expect(fmtInput(3, 1)).toBe('3');
    expect(fmtOutput(2.5)).toBe('2.5');
    expect(fmtOutput(1.7777)).toBe('1.78');
    expect(fmtOutput(200.5)).toBe('200.5');
    expect(fmtOutput(12345.6)).toBe('12,346');
    expect(fmtOutput(null)).toBe('—');
  });
  it('picks round ticks', () => {
    expect(niceTicks(0, 200, 4)).toEqual([0, 50, 100, 150, 200]);
    expect(niceTicks(0.05, 0.95, 4)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
  it('detects the discovery crossing', () => {
    const d = { input: 'alpha', op: '>=' as const, value: 0.8, say: 'knee' };
    expect(crossed(d, { alpha: 0.75 })).toBe(false);
    expect(crossed(d, { alpha: 0.8 })).toBe(true);
    expect(crossed({ ...d, op: '<' }, { alpha: 0.2 })).toBe(true);
    expect(crossed(undefined, { alpha: 1 })).toBe(false);
  });
  it('draws a 28-point path, a marker and the discovery zone', () => {
    const xs = sweepXs({ min: 0.05, max: 0.95 });
    const ys = evaluateBatch(formula, xs.map(alpha => ({ alpha }))).values;
    const g = chartGeometry({ w: 600, h: 240, xs, ys, current: 0.5, currentY: 2.5, step: 0.05, discover: { input: 'alpha', op: '>=', value: 0.8, say: '' }, sweptKey: 'alpha' });
    expect(g.path.match(/[ML]/g)).toHaveLength(28);
    expect(g.markerX).toBeGreaterThan(g.pad.l);
    expect(g.zone!.x + g.zone!.w).toBeCloseTo(600 - g.pad.r, 0);
    expect(g.yTicks[0]!.label).toBe('0');
  });
});

describe('offline diagram flow', () => {
  it('reads the fixture flowchart as a linear chain of labelled steps', () => {
    const src = (fixture.lessons[0]!.blocks[1]!.payload as { source: string }).source;
    const f = flowFromMermaid(src)!;
    expect(f.linear).toBe(true);
    expect(f.steps.map(s => s.label)).toEqual(['key: heap', 'hash of key = 17', '17 mod 5 = 2', 'slot 2', 'tree', 'heap']);
  });
  it('handles shapes, edge labels and branches', () => {
    const f = flowFromMermaid('graph TD\n  A((Start)) -->|yes| B{Full?}\n  B --> C[Resize]\n  B --> D(Insert)\n  class C hot')!;
    expect(f.linear).toBe(false);
    expect(f.steps.map(s => s.label)).toEqual(['Start', 'Full?', 'Resize', 'Insert']);
    expect(flowFromMermaid('sequenceDiagram\n A->>B: hi')).toBeNull();
  });
});

describe('narration contract: every cue sentence is in the rendered text', () => {
  const inline = new Set(['belief', 'caption', 'prompt']);
  const isInline = (field: string) => inline.has(field) || /^points\.\d+$|^events\.\d+\.(title|detail)$|^items\.\d+\.best_for$/.test(field);
  const types = ['explainer', 'analogy', 'example', 'diagram', 'comparison', 'timeline', 'worked_example', 'playground', 'key_points', 'misconception', 'audio', 'reflection'];
  for (const lesson of fixture.lessons) {
    for (const block of lesson.blocks.filter(b => types.includes(b.type))) {
      it(`${lesson.id}/${block.id} (${block.type})`, () => {
        const sentences = blockSentences(block as never);
        const byField = new Map<string, string[]>();
        for (const s of sentences) byField.set(s.field, [...(byField.get(s.field) ?? []), s.text]);
        for (const [field, texts] of byField) {
          const raw = field.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], block.payload) as string;
          const html = isInline(field) ? renderInline(raw) : renderMarkdown(raw);
          const found = sentenceRanges(text(html), texts);
          expect(found.every(Boolean), `${field}: ${texts.filter((_, i) => !found[i]).join(' | ')}`).toBe(true);
        }
      });
    }
  }
});
