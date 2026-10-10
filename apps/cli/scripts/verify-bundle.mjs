// WP6 acceptance: the bundle runs `doctor` (and `status`) from a temp folder with NO node_modules, under the system
// Node and under WorkBuddy's bundled Node 22 when it is installed. Exit 1 on any broken JSON line.
// Usage: node apps/cli/scripts/verify-bundle.mjs [path/to/bilimind.mjs]
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const bundle = resolve(process.argv[2] ?? join(here, '..', '..', '..', 'skills', 'bilimind', 'scripts', 'bilimind.mjs'));
if (!existsSync(bundle)) { console.error(`missing ${bundle}: run node apps/cli/scripts/bundle.mjs`); process.exit(1); }

const tmp = mkdtempSync(join(tmpdir(), 'bm-bundle-'));
for (const f of readdirSync(dirname(bundle))) if (/\.(mjs|wasm)$/.test(f)) copyFileSync(join(dirname(bundle), f), join(tmp, f));

const nodes = [['system', process.execPath]];
const wbRoot = join(homedir(), '.workbuddy-ai', 'binaries', 'node', 'versions');
if (existsSync(wbRoot)) for (const v of readdirSync(wbRoot)) {
  const exe = join(wbRoot, v, process.platform === 'win32' ? 'node.exe' : join('bin', 'node'));
  if (existsSync(exe)) nodes.push([`workbuddy ${v}`, exe]);
}

let bad = 0;
for (const [label, exe] of nodes) {
  for (const args of [['doctor'], ['status']]) {
    const r = spawnSync(exe, [join(tmp, 'bilimind.mjs'), ...args], { cwd: tmp, encoding: 'utf8', timeout: 60_000 });
    const lines = (r.stdout ?? '').split(/\r?\n/).filter(Boolean);
    let line = null;
    try { line = lines.length === 1 ? JSON.parse(lines[0]) : null; } catch { /* broken */ }
    const okShape = line && typeof line.ok === 'boolean' && line.cmd === args[0] && (line.ok ? r.status === 0 : r.status === 1);
    if (!okShape) bad++;
    console.log(`${okShape ? 'PASS' : 'FAIL'} ${label.padEnd(22)} ${args[0].padEnd(7)} exit=${r.status} ${lines[0]?.slice(0, 160) ?? '(no stdout)'}`);
    if (!okShape && r.stderr) console.log(r.stderr.slice(-1500));
  }
}
rmSync(tmp, { recursive: true, force: true });
process.exit(bad ? 1 : 0);
