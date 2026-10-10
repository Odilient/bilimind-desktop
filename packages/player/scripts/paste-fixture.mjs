// Dev helper: paste a course JSON (default: the core fixture) into dist/player.html -> dist/demo.html.
// Usage: node scripts/paste-fixture.mjs [course.json] [out.html]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { injectCourse, validateCourse } from '@bilimind/core';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, '..');
const coursePath = process.argv[2] ? resolve(process.argv[2]) : join(pkg, '..', 'core', 'fixtures', 'course-ds-mini.json');
const outPath = process.argv[3] ? resolve(process.argv[3]) : join(pkg, 'dist', 'demo.html');

const course = JSON.parse(readFileSync(coursePath, 'utf8'));
const v = validateCourse(course);
if (!v.ok) console.warn(`warning: ${coursePath} has ${v.errors.length} schema problem(s):\n${v.errors.slice(0, 10).join('\n')}`);
const template = readFileSync(join(pkg, 'dist', 'player.html'), 'utf8');
const html = injectCourse(template, course);
writeFileSync(outPath, html);
console.log(`wrote ${outPath} (${Math.round(html.length / 1024)} KB)`);
