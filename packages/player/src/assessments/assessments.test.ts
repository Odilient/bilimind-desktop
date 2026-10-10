// WP5c unit tests: the JS runner harness, scenario paths, safe markdown, the highlighter, learner storage,
// and that the response shapes the item components send grade correctly with core grade.ts.
import { beforeEach, describe, expect, it } from 'vitest';
import { cardId, expectedBlanks, expectedOptionIds, expectedOrder, gradeCode, gradeItem, validateCourse } from '@bilimind/core';
import type { Course, CourseAssessment, ItemResponse } from '@bilimind/core';
import fixture from '@bilimind/core/fixtures/course-ds-mini.json';
import { __run } from './runner.ts';
import { allPaths, nextStepId } from './scenario.ts';
import { escapeHtml, renderInline, renderMd } from './md.ts';
import { highlight } from './highlight.ts';
import { formatInterval, isPassedStored, loadUi, markPassed, previewIntervals, rate, ratingFor, readFsrs, saveUi } from './store.ts';

const course = fixture as unknown as Course;

describe('runner harness (same semantics as the engine node:vm harness)', () => {
  const code = course.lessons[0]!.blocks.find(b => b.type === 'code')!;
  const tests = (code.payload as { tests: { name: string; call: string; expect: unknown }[] }).tests;
  const ref = (code.assessments[0]!.answer_key as { reference_solution: string }).reference_solution;
  const starter = (code.payload as { starter_code: string }).starter_code;

  it('the reference solution passes every fixture test', () => {
    const r = __run(ref, tests, 50);
    expect(r.results.every(t => t.passed)).toBe(true);
    const g = gradeCode(code.assessments[0]!, r.results.filter(t => t.passed).map(t => t.name), tests.map(t => t.name));
    expect(g.correct).toBe(true);
  });
  it('the starter fails at least one test and reports expected/actual', () => {
    const r = __run(starter, tests, 50);
    const failed = r.results.filter(t => !t.passed);
    expect(failed.length).toBeGreaterThan(0);
    expect(failed[0]!.expected).not.toBe('');
    expect(failed[0]!.actual).not.toBe('');
  });
  it('both fixture exercises: reference green, starter red', () => {
    for (const l of course.lessons) for (const b of l.blocks) {
      if (b.type !== 'code') continue;
      const ts = (b.payload as { tests: { name: string; call: string; expect: unknown }[] }).tests;
      const rs = (b.assessments[0]!.answer_key as { reference_solution: string }).reference_solution;
      expect(__run(rs, ts, 50).results.every(t => t.passed)).toBe(true);
      expect(__run((b.payload as { starter_code: string }).starter_code, ts, 50).results.some(t => !t.passed)).toBe(true);
    }
  });
  it('calls see let/const/class declarations; deepEqual handles arrays, objects and NaN', () => {
    const src = 'const k = 2; let f = x => x * k; class P { constructor(a) { this.a = a; } }\nfunction o() { return { a: [1, { b: NaN }] }; }';
    const r = __run(src, [
      { name: 'arrow', call: 'f(3)', expect: 6 },
      { name: 'class', call: 'new P(1).a', expect: 1 },
      { name: 'deep', call: 'o()', expect: { a: [1, { b: NaN }] } },
      { name: 'wrong', call: 'f(1)', expect: 3 },
      { name: 'null expect', call: 'null', expect: null },
    ], 50);
    expect(r.results.map(t => t.passed)).toEqual([true, true, true, false, true]);
  });
  it('captures console output and reports syntax and runtime errors without throwing', () => {
    expect(__run('console.log("hi", [1,2]);', [], 50).logs).toEqual([{ k: 'log', t: 'hi [1,2]' }]);
    const syn = __run('function (', [{ name: 't', call: '1', expect: 1 }], 50);
    expect(syn.syntaxError).toBeTruthy();
    expect(syn.results[0]!.passed).toBe(false);
    const rt = __run('throw new Error("boom")', [{ name: 't', call: '1', expect: 1 }], 50);
    expect(rt.runtimeError).toContain('boom');
    const perTest = __run('function f() { throw new TypeError("bad"); }', [{ name: 't', call: 'f()', expect: 1 }], 50);
    expect(perTest.results[0]!.error).toContain('TypeError: bad');
  });
  it('caps console lines', () => {
    expect(__run('for (let i = 0; i < 500; i++) console.log(i);', [], 200).logs.length).toBe(200);
  });
});

describe('scenario paths', () => {
  it('every path of every fixture scenario reaches the debrief', () => {
    for (const l of course.lessons) for (const b of l.blocks) {
      if (b.type !== 'scenario') continue;
      const paths = allPaths(b.payload.steps);
      expect(paths.length).toBeGreaterThan(1);
      expect(paths.every(p => p.ends)).toBe(true);
    }
  });
  it('omitted, null and unknown next_id end the scenario; loops are cut off', () => {
    const steps = [
      { id: 's1', options: [{ id: 'a', correct: true, next_id: 's2' }, { id: 'b', correct: false }] },
      { id: 's2', options: [{ id: 'a', correct: true, next_id: 'nope' }, { id: 'b', correct: false, next_id: 's1' }] },
    ];
    expect(nextStepId(steps, steps[0]!.options[1]!, 1)).toBeNull();
    expect(nextStepId(steps, steps[1]!.options[0]!, 2)).toBeNull();
    expect(nextStepId(steps, steps[1]!.options[1]!, 2)).toBe('s1');
    expect(allPaths(steps).every(p => p.ends)).toBe(true);
  });
});

describe('markdown and highlighting are safe', () => {
  it('escapes raw HTML and drops javascript: links', () => {
    const html = renderMd('Hi <script>alert(1)</script> **b** [x](javascript:alert(1)) [ok](https://example.com)');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<strong>b</strong>');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('href="https://example.com"');
    expect(renderInline('`a<b`')).toBe('<code>a&lt;b</code>');
    expect(escapeHtml('<"&\'>')).toBe('&lt;&quot;&amp;&#39;&gt;');
  });
  it('highlights keywords, strings, numbers, comments and calls, escaping the rest', () => {
    const h = highlight('const s = "<b>"; // note\nreturn f(1);');
    expect(h).toContain('<span class="tk-k">const</span>');
    expect(h).toContain('<span class="tk-s">&quot;&lt;b&gt;&quot;</span>');
    expect(h).toContain('<span class="tk-c">// note</span>');
    expect(h).toContain('<span class="tk-f">f</span>(');
    expect(h).toContain('<span class="tk-n">1</span>');
    expect(h.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')).toBe('const s = "<b>"; // note\nreturn f(1);');
  });
});

describe('learner storage (bm:<courseId>:*)', () => {
  beforeEach(() => {
    const m = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, String(v)); },
      removeItem: (k: string) => { m.delete(k); }, clear: () => m.clear(), key: () => null, length: 0,
    };
  });
  it('markPassed is idempotent and keeps the shell shape', () => {
    markPassed(course.id, 'hash_tables', 'b10');
    markPassed(course.id, 'hash_tables', 'b10');
    expect(isPassedStored(course.id, 'hash_tables', 'b10')).toBe(true);
    const raw = JSON.parse(localStorage.getItem(`bm:${course.id}:progress`)!);
    expect(raw.v).toBe(1);
    expect(raw.lessons.hash_tables.passed).toEqual(['b10']);
  });
  it('rates FSRS cards keyed by core cardId, never due after the exam', () => {
    const id = cardId('hash_tables', 'b9', 0);
    const now = new Date('2026-10-12T10:00:00+08:00');
    const s = rate(course, id, 'easy', now);
    expect(readFsrs(course.id)[id]).toEqual(s);
    expect(new Date(s.due).getTime()).toBeLessThanOrEqual(new Date(course.goal.exam_at!).getTime() - 12 * 3600_000);
    const iv = previewIntervals(course, cardId('hash_tables', 'q2'), now);
    expect(Object.values(iv).every(Boolean)).toBe(true);
  });
  it('ui state round-trips and clears', () => {
    saveUi(course.id, 'x/b1', [1, 2]);
    expect(loadUi(course.id, 'x/b1', [])).toEqual([1, 2]);
    saveUi(course.id, 'x/b1', null);
    expect(loadUi(course.id, 'x/b1', 'none')).toBe('none');
  });
  it('maps answers and confidence to ratings and formats intervals', () => {
    expect(ratingFor(true, 1, 'sure')).toBe('easy');
    expect(ratingFor(true, 1, 'guess')).toBe('hard');
    expect(ratingFor(true, 1, null)).toBe('good');
    expect(ratingFor(false, 0, 'sure')).toBe('again');
    expect(formatInterval(30_000)).toBe('<1 min');
    expect(formatInterval(10 * 60_000)).toBe('10 min');
    expect(formatInterval(3 * 86_400_000)).toBe('3 days');
  });
});

describe('the responses the item components send grade with core grade.ts', () => {
  it('the fixture validates', () => { expect(validateCourse(fixture).ok).toBe(true); });
  const items: CourseAssessment[] = course.lessons.flatMap(l => l.blocks.flatMap(b => b.assessments));
  const correct = (it: CourseAssessment): ItemResponse | null => {
    switch (it.kind) {
      case 'mcq': return { kind: 'mcq', option_id: expectedOptionIds(it)[0]! };
      case 'multi_select': return { kind: 'multi_select', option_ids: expectedOptionIds(it) };
      case 'ordering': return { kind: 'ordering', order: expectedOrder(it) };
      case 'numeric': return { kind: 'numeric', value: String((it.answer_key as { value: number }).value) };
      case 'cloze': return { kind: 'cloze', text: expectedBlanks(it).map(b => b[0]!) };
      default: return null;
    }
  };
  it.each(items.filter(i => correct(i)).map(i => [i.id + ' ' + i.kind, i] as const))('%s grades correct', (_n, it) => {
    expect(gradeItem(it, correct(it)!).correct).toBe(true);
  });
  it('self-marked kinds and wrong answers are not marked correct', () => {
    const mcq = items.find(i => i.kind === 'mcq')!;
    const wrong = (mcq as { options: { id: string }[] }).options.find(o => !expectedOptionIds(mcq).includes(o.id))!.id;
    expect(gradeItem(mcq, { kind: 'mcq', option_id: wrong }).correct).toBe(false);
    const sa = items.find(i => i.kind === 'short_answer')!;
    expect(gradeItem(sa, { kind: 'short_answer', self_ratio: null }).status).toBe('self');
  });
});
