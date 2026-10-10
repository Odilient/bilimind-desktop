// Assembles the deployable site from the other lanes' outputs, then scans it for secrets.
//
//   node site/scripts/assemble.mjs [--courses <dir>] [--dry]
//
// 1. Courses: for each slug (ds-final, boba-day-one, bm-survival, ds-workbuddy) whose built course exists at
//    <courses>/<slug>/index.html (default showcase/courses), copies that folder into
//    site/courses/<slug>/, replacing the placeholder page. The crew's cache (crew/cache/) is skipped.
// 2. Skill: copies skills/dist/bilimind-skill.zip (made by skills/bilimind/scripts/zip-skill.mjs)
//    to site/downloads/bilimind-skill.zip.
// 3. Secret scan over everything under site/: API-key shapes and key variable names. Exit 1 on a hit.
//
// It never reads .env files or the user's config, and it never deletes anything outside site/courses/<slug>/.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, '..');
const repo = resolve(site, '..');
const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const cAt = argv.indexOf('--courses');
const coursesSrc = cAt >= 0 ? resolve(argv[cAt + 1]) : join(repo, 'showcase', 'courses');
const SLUGS = ['ds-final', 'boba-day-one', 'bm-survival', 'ds-workbuddy'];
const out = { courses: {}, downloads: [], secrets: [] };

// 1 · Courses
for (const slug of SLUGS) {
  const src = join(coursesSrc, slug);
  if (!existsSync(join(src, 'index.html'))) { out.courses[slug] = 'placeholder kept (no built course yet)'; continue; }
  const dst = join(site, 'courses', slug);
  if (!dry) {
    rmSync(dst, { recursive: true, force: true });
    mkdirSync(dst, { recursive: true });
    cpSync(src, dst, {
      recursive: true,
      filter: (p) => {
        const rel = relative(src, p).replace(/\\/g, '/');
        if (!rel) return true;
        if (rel === 'crew/cache' || rel.startsWith('crew/cache/')) return false;
        if (/(^|\/)\.env/.test(rel)) return false;
        return true;
      },
    });
  }
  out.courses[slug] = 'copied from ' + relative(repo, src).replace(/\\/g, '/');
}

// 2 · Skill downloads
for (const name of ['bilimind-skill.zip']) {
  const src = join(repo, 'skills', 'dist', name);
  if (!existsSync(src)) continue;
  if (!dry) { mkdirSync(join(site, 'downloads'), { recursive: true }); cpSync(src, join(site, 'downloads', name)); }
  out.downloads.push(name);
}
if (!out.downloads.includes('bilimind-skill.zip')) out.downloads.push('MISSING bilimind-skill.zip: run node skills/bilimind/scripts/zip-skill.mjs');

// 3 · Secret scan (text files only; zips are checked by name only, their source is scanned by WP17)
const PATTERNS = [
  /sk-[A-Za-z0-9]{20,}/, /sk-or-v1-[A-Za-z0-9]{20,}/, /\bDEEPSEEK_API_KEY\s*=\s*\S+/, /\bOPENROUTER_API_KEY\s*=\s*\S+/,
  /"(deepseek|openrouter)"\s*:\s*"sk-[^"]{8,}"/, /AKIA[0-9A-Z]{16}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];
const TEXT = /\.(html?|css|js|mjs|json|md|txt|csv|ics|svg|xml|ya?ml)$/i;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) { if (name !== 'node_modules' && name !== 'shots') walk(p); continue; }
    if (/^\.env/.test(name)) { out.secrets.push(relative(site, p) + ': .env file in the site'); continue; }
    if (!TEXT.test(name) || s.size > 20 * 1024 * 1024) continue;
    const text = readFileSync(p, 'utf8');
    for (const re of PATTERNS) if (re.test(text)) out.secrets.push(relative(site, p).replace(/\\/g, '/') + ': matches ' + re.source);
  }
}
walk(site);
out.ok = out.secrets.length === 0;
console.log(JSON.stringify(out, null, 2));
process.exitCode = out.ok ? 0 : 1;
