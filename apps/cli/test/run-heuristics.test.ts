// The unattended `run` harness reads the sentence and makes the keep/cut call itself (agents do both in WorkBuddy).
import { describe, expect, it } from 'vitest';
import { chooseLessons, parseSentence, summarize } from '@bilimind/engine';
import type { OutlineData } from '@bilimind/engine';

const NOW = new Date('2026-10-10T10:00:00+08:00');   // a Saturday in Kuala Lumpur

describe('parseSentence', () => {
  it('reads weekday, time and minutes', () => {
    const g = parseSentence('My Data Structures final is Wednesday 9am. I have 45 minutes a day.', NOW);
    expect(g.deadline).toBe('2026-10-14');
    expect(g.examTime).toBe('09:00');
    expect(g.minutesPerDay).toBe(45);
    expect(g.audience).toBe('student');
    expect(g.codeLang).toBe('js');
  });
  it('reads "14 Oct", hours a day, staff wording', () => {
    const g = parseSentence('Onboard our new barista before 14 Oct, 1.5 hours a day', NOW);
    expect(g.deadline).toBe('2026-10-14');
    expect(g.minutesPerDay).toBe(90);
    expect(g.audience).toBe('staff');
    expect(g.codeLang).toBe('none');
  });
  it('assumes when the sentence is silent, and says so', () => {
    const g = parseSentence('Teach me heaps', NOW);
    expect(g.deadline).toBe('2026-10-17');
    expect(g.minutesPerDay).toBe(45);
    expect(g.assume.join(' ')).toMatch(/7 days/);
    expect(g.assume.join(' ')).toMatch(/45 minutes/);
  });
});

describe('chooseLessons', () => {
  const t = (key: string, minutes: number, track: 'core' | 'subtopic' = 'core', parent: string | null = null) =>
    ({ key, title: key, archetype: 'conceptual', kind_label: '', formats: [], minutes, track, parent, thin: false }) as OutlineData['topics'][number];
  const topics = [t('arrays', 25), t('hashing', 35), t('heaps', 40), t('avl', 25), t('probing', 15, 'subtopic', 'hashing')];
  const weights = [
    { key: 'hashing', title: '', marks: 30, share: 0.3, questions: ['Q2'] },
    { key: 'heaps', title: '', marks: 30, share: 0.3, questions: ['Q3'] },
    { key: 'arrays', title: '', marks: 15, share: 0.15, questions: ['Q1'] },
    { key: 'avl', title: '', marks: 0, share: 0, questions: [] },
  ];
  it('keeps the heaviest core topics that fit, heaviest first, never spends spare minutes on a zero-mark topic, and says why it cut', () => {
    // Sat-Tue = 4 study days x 45 min (70% for new lessons without an outline) = 126 min: hashing 35 + heaps 40 + arrays 25 = 100.
    // avl (0 marks) would still fit, but with a past paper only the capstone may use spare minutes (G2 review).
    const r = chooseLessons(topics, weights, { exam_at: '2026-10-14T09:00:00+08:00', minutes_per_day: 45 }, NOW);
    expect(r.keep).toEqual(['hashing', 'heaps', 'arrays']);
    expect(Object.keys(r.cut).sort()).toEqual(['avl', 'probing']);
    expect(r.cut.avl).toMatch(/No marks/);
  });
  it('always keeps two lessons', () => {
    const r = chooseLessons(topics, null, { exam_at: '2026-10-11T09:00:00+08:00', minutes_per_day: 10 }, NOW);
    expect(r.keep.length).toBe(2);
  });
});

describe('summarize', () => {
  it('turns command data into the one-line log result', () => {
    expect(summarize('check', { total: 15, passed: 14, failed: [{ rule: 'Q7', block: 3, item: null, detail: '', suggestion: '' }], auto_fixed: [] }))
      .toBe('14/15 checks, failed: Q7');
    expect(summarize('draft', { blocks: ['explainer', 'quiz'], items: 5, code_blocks: 1, cites: 7 })).toBe('2 blocks, 5 questions, 1 code exercise, 7 citations');
    expect(summarize('unknown', null)).toBe('');
  });
});
