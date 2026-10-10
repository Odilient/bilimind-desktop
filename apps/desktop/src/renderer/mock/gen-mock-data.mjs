// Dev-time generator for the renderer mock (not bundled). Reads the three showcase courses and writes
// data.json next to this file: real course cards, the files each run read, the plan (kept / cut with reasons)
// and the REAL step timeline of the first unattended pass (start offset + duration from crew/log.jsonl).
//   node apps/desktop/src/renderer/mock/gen-mock-data.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../../..');
const coursesDir = path.join(root, 'showcase/courses');
const ids = ['ds-final', 'boba-day-one', 'bm-survival'];
const examples = { 'ds-final': 'exam', 'boba-day-one': 'shop', 'bm-survival': 'language' };

const out = { courses: [] };
for (const id of ids) {
  const dir = path.join(coursesDir, id);
  const c = JSON.parse(fs.readFileSync(path.join(dir, 'course.json'), 'utf8'));
  const r = c.receipts;
  const log = fs.readFileSync(path.join(dir, 'crew/log.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const plan = JSON.parse(fs.readFileSync(path.join(dir, 'crew/plan.json'), 'utf8'));
  const t0 = Date.parse(log[0].ts);

  // First unattended pass: everything up to and including the first Lead build.
  const firstBuild = log.findIndex((e) => e.agent === 'Lead' && e.cmd === 'build');
  const pass = log.slice(0, firstBuild + 1);
  // ds-final rewrote its rejected questions later (rewrite-item); bring the first one into the pass right after
  // the verdict that rejected it so the replay shows the rejected-and-rewritten moment with its real duration.
  const rewrites = log.slice(firstBuild + 1).filter((e) => e.cmd === 'rewrite-item');
  const steps = [];
  for (const e of pass) {
    const end = Date.parse(e.ts) - t0;
    const lesson = /--lesson\s+(\S+)/.exec(e.args || '')?.[1];
    steps.push({ agent: e.agent, cmd: e.cmd, lesson, ok: e.ok, ms: e.ms, costUsd: e.cost_usd || 0, result: e.result, start: Math.max(0, end - e.ms), end });
    if (e.cmd === 'verdict' && /rejected and rewritten/.test(e.result || '')) {
      const rw = rewrites.find((x) => (/--lesson\s+(\S+)/.exec(x.args || '')?.[1]) === lesson);
      if (rw) steps.push({ agent: 'Checker', cmd: 'rewrite-item', lesson, ok: true, ms: rw.ms, costUsd: rw.cost_usd || 0, result: rw.result, start: end + 50, end: end + 50 + rw.ms });
    }
  }
  steps.sort((a, b) => a.start - b.start || a.end - b.end);

  const ingest = log.find((e) => e.cmd === 'ingest');
  const srcDir = path.join(dir, 'sources');
  const files = (ingest?.data?.files || []).map((f) => {
    let bytes = 0;
    try { bytes = fs.statSync(path.join(srcDir, f.name)).size; } catch {}
    return { name: f.name, path: `C:\\Users\\you\\Documents\\${id}\\${f.name}`, ext: path.extname(f.name).slice(1).toLowerCase(), bytes, role: f.role || 'other', pages: f.pages };
  });

  const keepKeys = [...new Set(steps.filter((x) => x.agent.startsWith("Writer") && x.lesson).map((x) => x.lesson))];
  const dayIndex = new Map(plan.days.map((d, i) => [d.date, i + 1]));
  out.courses.push({
    example: examples[id],
    object: path.basename(c.object || 'obj-book.webp'),
    sentence: c.goal.sentence,
    files,
    plan: {
      keep: keepKeys.map((k, i) => { const l = plan.lessons.find((x) => x.key === k); const w = steps.find((x) => x.lesson === k && x.agent.startsWith("Writer")); return { key: k, title: l?.title || w.agent.replace(/^Writer · /, ""), day: (l && dayIndex.get(l.day)) || Math.min(i + 1, plan.days.length - 1) }; }),
      cut: plan.cut.filter((x) => !keepKeys.includes(x.key)).map((x) => ({ key: x.key, title: x.title, reason: x.reason })),
    },
    steps,
    card: {
      id: `C:\\Users\\you\\Documents\\BiliMind\\${id}`,
      title: c.title,
      sentence: c.goal.sentence,
      createdAt: c.built_at,
      status: 'ready',
      lessons: r.lessons,
      minutes: r.narration_min,
      checks: { passed: r.checks.passed, total: r.checks.run },
      rejected: r.rejected,
      codeTests: { passed: r.tests.passed, total: r.tests.run },
      costUsd: r.cost_usd,
      wallMs: r.wall_ms,
    },
  });
}
fs.writeFileSync(path.join(here, 'data.json'), JSON.stringify(out, null, 1));
console.log('wrote', path.join(here, 'data.json'), out.courses.map((c) => `${c.card.title}: ${c.steps.length} steps`).join('; '));
