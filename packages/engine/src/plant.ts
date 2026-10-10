// Checker benchmark: plant N wrong answer keys, then score the Checker's verdicts.
// Owner: WP3. Keep the export names and types (src/contracts.ts); replace the stubs in place.
// Run on a COPY of a course. `plant` corrupts N answer keys (mcq: the correct id moves to a distractor; multi_select:
// one correct id swapped for a wrong one; numeric: the value moves well outside its tolerance; ordering: two adjacent
// steps swapped; cloze: the accepted answer replaced by another cloze's answer), picked with a seeded shuffle spread
// across lessons. Every checkable item of the touched lessons is reset to 'unchecked' (so status gives nothing away).
// The answer sheet goes to crew/plant-key.json. `plant-score` reads the rulings made AFTER planting: caught = a planted
// item ruled contradicted, missed = planted and not contradicted, false_alarms = an honest item ruled contradicted.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AnswerKey, Assessment, LessonContent } from '@bilimind/core';
import { BilimindError } from './contracts.ts';
import type { Ctx, PlantFn, PlantScoreFn } from './contracts.ts';
import { coursePaths, readJsonOrNull, writeJson } from './course.ts';
import { loadDraft, saveDraft } from './validate/check.ts';
import { liveItems } from './validate/lesson.ts';
import { readVerdicts } from './verdict.ts';

export const PLANT_KEY_FILE = 'crew/plant-key.json';
interface PlantEntry { lesson: string; item: string; kind: string; how: string; original: AnswerKey; planted: AnswerKey }
interface PlantKey { version: 1; created_at: string; requested: number; entries: PlantEntry[]; honest: { lesson: string; item: string }[]; verdict_offsets: Record<string, number> }

const keyPath = (ctx: Ctx) => join(coursePaths(ctx.course).crew, 'plant-key.json');

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

/** Corrupts the item's answer key in place; returns a description, or null when this item cannot be planted. */
function corrupt(a: Assessment, rnd: () => number, clozePool: string[]): string | null {
  const k = a.answer_key;
  if (!k) return null;
  const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]!;
  switch (a.kind) {
    case 'mcq': {
      const right = k.correct_option_ids?.[0];
      const others = (a.options ?? []).map(o => o.id).filter(id => id !== right);
      if (!right || !others.length) return null;
      const wrong = pick(others);
      k.correct_option_ids = [wrong];
      return `correct option moved from ${right} to ${wrong}`;
    }
    case 'multi_select': {
      const right = k.correct_option_ids ?? [];
      const others = (a.options ?? []).map(o => o.id).filter(id => !right.includes(id));
      if (!right.length || !others.length) return null;
      const out = pick(right), inn = pick(others);
      k.correct_option_ids = [...right.filter(id => id !== out), inn].sort();
      return `correct set: ${out} swapped for ${inn}`;
    }
    case 'numeric': {
      if (typeof k.value !== 'number' || !Number.isFinite(k.value)) return null;
      const v = k.value, tol = Math.abs(k.tolerance ?? 0);
      const delta = Math.max(Number.isInteger(v) ? Math.max(1, Math.round(Math.abs(v) * 0.5)) : Math.abs(v) * 0.5, tol * 4 + 1e-6, 1);
      k.value = Number.isInteger(v) ? v + Math.round(delta) : Math.round((v + delta) * 1e4) / 1e4;
      return `value changed from ${v} to ${k.value}`;
    }
    case 'ordering': {
      const o = [...(k.correct_order ?? [])];
      if (o.length < 2) return null;
      const i = Math.floor(rnd() * (o.length - 1));
      [o[i], o[i + 1]] = [o[i + 1]!, o[i]!];
      k.correct_order = o;
      return `steps ${i + 1} and ${i + 2} swapped`;
    }
    case 'cloze': {
      const acc = k.accepted ?? [];
      const norm = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();
      const others = clozePool.filter(t => !acc.some(x => norm(x) === norm(t)));
      if (!acc.length || !others.length) return null;
      const wrong = pick(others);
      k.accepted = [wrong];
      return `accepted answer changed from "${acc[0]}" to "${wrong}"`;
    }
    default:
      return null;
  }
}

function lessonKeys(ctx: Ctx, only?: string): string[] {
  if (only) return [only];
  const dir = join(coursePaths(ctx.course).crew, 'lessons');
  return existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort() : [];
}

const resetItem = (a: Assessment) => {
  if (a.explanation && a.explanation === a.quote) delete a.explanation;
  delete a.quote; delete a.reason;
  a.status = 'unchecked';
  if (a.labels) { a.labels = a.labels.filter(l => l !== 'beyond_slides'); if (!a.labels.length) delete a.labels; }
};

export const plant: PlantFn = async (ctx, opts) => {
  const n = Math.max(1, Math.floor(Number(opts.n) || 10));
  if (existsSync(keyPath(ctx))) throw new BilimindError('This course already has planted errors (crew/plant-key.json)', 'Run `plant-score` after the Checker, or plant into a fresh copy of the course.');
  const keys = lessonKeys(ctx, opts.lesson);
  if (!keys.length) throw new BilimindError('No drafted lessons to plant into', 'Run `draft` first (plant works on a copy of a built course).');
  const lessons = new Map<string, LessonContent>(keys.map(k => [k, loadDraft(ctx.course, k)]));
  const rnd = mulberry32(hash(`${keys.join(',')}|${n}`));
  const clozePool = [...lessons.values()].flatMap(l => liveItems(l)).filter(r => r.item.kind === 'cloze').map(r => r.item.answer_key?.accepted?.[0]).filter((t): t is string => !!t);

  // per lesson, a shuffled queue of plantable items; then round-robin so errors spread across lessons
  const queues = keys.map(k => {
    const items = liveItems(lessons.get(k)!).filter(r => ['mcq', 'multi_select', 'numeric', 'ordering', 'cloze'].includes(r.item.kind));
    for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [items[i], items[j]] = [items[j]!, items[i]!]; }
    return { key: k, items };
  });
  const entries: PlantEntry[] = [];
  while (entries.length < n && queues.some(q => q.items.length)) {
    for (const q of queues) {
      if (entries.length >= n) break;
      const next = q.items.shift();
      if (!next) continue;
      const original = JSON.parse(JSON.stringify(next.item.answer_key ?? {})) as AnswerKey;
      const how = corrupt(next.item, rnd, clozePool);
      if (!how) { next.item.answer_key = original; continue; }
      entries.push({ lesson: q.key, item: next.item.id, kind: next.item.kind, how, original, planted: JSON.parse(JSON.stringify(next.item.answer_key)) as AnswerKey });
    }
  }
  if (!entries.length) throw new BilimindError('No item has an answer key that can be planted', 'Plant needs mcq, multi_select, numeric, ordering or cloze items.');

  const touched = [...new Set(entries.map(e => e.lesson))];
  const honest: { lesson: string; item: string }[] = [];
  for (const k of touched) {
    const l = lessons.get(k)!;
    for (const r of liveItems(l).filter(x => x.item.kind !== 'code')) {
      resetItem(r.item);
      if (!entries.some(e => e.lesson === k && e.item === r.item.id)) honest.push({ lesson: k, item: r.item.id });
    }
    saveDraft(ctx.course, l);
  }
  const key: PlantKey = {
    version: 1, created_at: ctx.now().toISOString(), requested: n, entries, honest,
    verdict_offsets: Object.fromEntries(touched.map(k => [k, readVerdicts(ctx.course, k).length])),
  };
  writeJson(keyPath(ctx), key);
  ctx.progress(`plant: ${entries.length} wrong answer key${entries.length === 1 ? '' : 's'} in ${touched.join(', ')}${entries.length < n ? ` (only ${entries.length} plantable items)` : ''}`);
  return { planted: entries.length, key_file: PLANT_KEY_FILE };
};

export const plantScore: PlantScoreFn = async ctx => {
  const key = readJsonOrNull<PlantKey>(keyPath(ctx));
  if (!key) throw new BilimindError('No crew/plant-key.json in this course', 'Run `plant --n 10` on a copy of the course, let the Checker rule, then `plant-score`.');
  const latest = new Map<string, string>();   // "<lesson>/<item>" -> latest verdict after planting
  for (const [lesson, offset] of Object.entries(key.verdict_offsets)) {
    for (const v of readVerdicts(ctx.course, lesson).slice(offset)) latest.set(`${lesson}/${v.item}`, v.verdict);
  }
  const caught = key.entries.filter(e => latest.get(`${e.lesson}/${e.item}`) === 'contradicted').length;
  const false_alarms = key.honest.filter(h => latest.get(`${h.lesson}/${h.item}`) === 'contradicted').length;
  const planted = key.entries.length;
  ctx.progress(`plant-score: caught ${caught}/${planted}, false alarms ${false_alarms}/${key.honest.length}`);
  return { planted, caught, missed: planted - caught, false_alarms };
};
