// Test helper: writes a quiet placeholder mp3 for every narration src in a course (the fixture's audio
// files do not exist), so the e2e test can play the dock and watch the sentence marker move.
// Usage: node scripts/fake-audio.mjs [course.json] [outDir=dist]   (needs ffmpeg on PATH)
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, '..');
const coursePath = process.argv[2] ? resolve(process.argv[2]) : join(pkg, '..', 'core', 'fixtures', 'course-ds-mini.json');
const outDir = process.argv[3] ? resolve(process.argv[3]) : join(pkg, 'dist');
const course = JSON.parse(readFileSync(coursePath, 'utf8'));
const items = [course.narration, ...course.lessons.map(l => l.narration)].filter(Boolean);
for (const n of items) {
  const out = join(outDir, n.src);
  if (existsSync(out)) continue;
  mkdirSync(dirname(out), { recursive: true });
  const secs = Math.max(1, Math.ceil(n.duration_ms / 1000));
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `sine=frequency=196:duration=${secs}`, '-af', 'volume=0.03', '-ac', '1', '-ar', '22050', '-b:a', '32k', out]);
  console.log(`wrote ${out} (${secs}s)`);
}
