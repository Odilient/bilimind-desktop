// Fills the {{PLACEHOLDERS}} in site/index.html from a JSON map, in place.
//
//   node site/scripts/fill-numbers.mjs numbers.json     fill what the file names; list what is left
//   node site/scripts/fill-numbers.mjs --check          only list the placeholders still in the page
//
// numbers.json is flat: { "GITHUB_URL": "https://github.com/...", "COST_CENTS": "4", ... }.
// Values are inserted as text (HTML-escaped). Keys the page does not use are reported, not an error.
// Placeholders in the page today:
//   GITHUB_URL       public repo URL (nav, install, footer)
//   NUMBERS_NOTE     one sentence under the numbers heading, e.g. "Run of 11 Oct, 02:40 MYT." (may be "")
//   COST_CENTS       US cents of text-model calls per course (whole number rolls as an odometer; "4.2" prints as is)
//   CREDITS          WorkBuddy credits per course
//   WALL_MIN         minutes from sentence to finished course
//   ITEMS_CHECKED    quiz answers the Checker ruled on
//   ITEMS_REJECTED   contradicted and rewritten
//   ITEMS_LABELLED   labelled "Beyond your slides"
//   TESTS_RUN        code tests run
//   CODE_FIXED       exercises that failed first and were fixed
//   PLANTED_CAUGHT   planted wrong answers caught (of 20)
//   FALSE_ALARMS     Checker false alarms in the planted benchmark
//   TEAM_MEMBER_4    first name of the fourth team member
//   TEAM_ROLE_4      their role
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const page = join(resolve(here, '..'), 'index.html');
const arg = process.argv[2];
let html = readFileSync(page, 'utf8');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const left = () => [...new Set([...html.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((m) => m[1]))];

if (!arg || arg === '--check') {
  const l = left();
  console.log(JSON.stringify({ ok: l.length === 0, placeholders: l }));
  process.exitCode = l.length ? 1 : 0;
} else {
  const values = JSON.parse(readFileSync(resolve(arg), 'utf8'));
  const filled = [], unused = [];
  for (const [k, v] of Object.entries(values)) {
    const token = `{{${k}}}`;
    if (!html.includes(token)) { unused.push(k); continue; }
    html = html.split(token).join(esc(v));
    filled.push(k);
  }
  writeFileSync(page, html);
  console.log(JSON.stringify({ ok: true, filled, unused, still_unfilled: left() }));
}
