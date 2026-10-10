// Build BiliMind Desktop into apps/desktop/dist:
//   dist/renderer/   vite build of src/renderer (vite.config.ts)
//   dist/main/main.cjs, dist/preload/preload.cjs   esbuild, CJS, electron external
//   dist/worker/run.cjs (+ sql-wasm.wasm)          esbuild, CJS, engine + core bundled (like apps/cli/scripts/bundle.mjs)
//   resources/templates/player.html                from packages/player/dist (built first if missing)
//   resources/assets/obj-*.webp                    the 3D objects build.ts copies into each course's img/
// Usage: node scripts/build.mjs [--no-renderer] [--minify]
import { build as esbuild } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..');
const repo = join(app, '..', '..');
const dist = join(app, 'dist');
const argv = process.argv.slice(2);
const minify = argv.includes('--minify');
const kb = f => Math.round(statSync(f).size / 1024);
const t0 = Date.now();

// ---------- resources: player template + 3D objects ----------
const tplSrc = join(repo, 'packages', 'player', 'dist', 'player.html');
if (!existsSync(tplSrc)) {
  console.log('player template missing: building @bilimind/player');
  const r = spawnSync('pnpm', ['--filter', '@bilimind/player', 'build'], { cwd: repo, stdio: 'inherit', shell: true });
  if (r.status !== 0 || !existsSync(tplSrc)) { console.error('player build failed'); process.exit(1); }
}
mkdirSync(join(app, 'resources', 'templates'), { recursive: true });
copyFileSync(tplSrc, join(app, 'resources', 'templates', 'player.html'));
console.log(`template: resources/templates/player.html ${kb(tplSrc)} KB`);

const objDirs = [join(repo, 'packages', 'player', 'public', 'img'), join(repo, 'plan', 'reference', 'design', 'hero-v7', 'img', '11')];
const objDir = objDirs.find(d => existsSync(d) && readdirSync(d).some(f => /^obj-.*\.webp$/.test(f)));
if (objDir) {
  mkdirSync(join(app, 'resources', 'assets'), { recursive: true });
  const objs = readdirSync(objDir).filter(f => /^obj-.*\.webp$/.test(f));
  for (const f of objs) copyFileSync(join(objDir, f), join(app, 'resources', 'assets', f));
  console.log(`assets: ${objs.length} objects -> resources/assets`);
} else console.warn('no obj-*.webp found: courses will show no object images');

// ---------- renderer (vite) ----------
function placeholder(why) {
  // the renderer is written in parallel; a placeholder keeps main testable until it lands (src/ is not touched)
  mkdirSync(join(dist, 'renderer'), { recursive: true });
  writeFileSync(join(dist, 'renderer', 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><title>BiliMind Desktop</title></head>'
    + '<body style="background:#F6F7FA;font-family:system-ui;color:#0B0D10"><p style="margin:80px">BiliMind Desktop</p></body></html>\n');
  console.warn(`renderer: ${why}, wrote a placeholder dist/renderer/index.html`);
}
if (argv.includes('--no-renderer')) {
  if (!existsSync(join(dist, 'renderer', 'index.html'))) placeholder('--no-renderer and no earlier build');
} else if (existsSync(join(app, 'src', 'renderer', 'index.html'))) {
  const { build: viteBuild } = await import('vite');
  await viteBuild({ configFile: join(app, 'vite.config.ts'), logLevel: 'warn' });
  console.log(`renderer: dist/renderer (${Date.now() - t0} ms)`);
} else placeholder('src/renderer/index.html missing');

// ---------- main, preload, worker (esbuild, CJS) ----------
for (const d of ['main', 'preload', 'worker']) rmSync(join(dist, d), { recursive: true, force: true });
const common = {
  bundle: true, platform: 'node', format: 'cjs', target: 'node22', sourcemap: false, legalComments: 'none',
  minifyWhitespace: minify, minifySyntax: minify, logLevel: 'warning',
  define: { 'process.env.NODE_ENV': '"production"' },
};
await esbuild({ ...common, entryPoints: [join(app, 'src', 'main', 'main.ts')], outfile: join(dist, 'main', 'main.cjs'), external: ['electron'] });
await esbuild({ ...common, entryPoints: [join(app, 'src', 'preload', 'preload.ts')], outfile: join(dist, 'preload', 'preload.cjs'), external: ['electron'], platform: 'browser', target: 'chrome140' });
await esbuild({
  ...common, entryPoints: [join(app, 'src', 'worker', 'run.ts')], outfile: join(dist, 'worker', 'run.cjs'),
  // ws's optional native addons are required inside try/catch; electron is never imported by the engine
  external: ['electron', 'bufferutil', 'utf-8-validate'],
  // ESM deps read import.meta.url (unpdf/pdfjs: createRequire(import.meta.url); engine build.ts/config.ts: own dir):
  // give the CJS bundle a real file URL
  define: { ...common.define, 'import.meta.url': '__bmImportMetaUrl' },
  banner: { js: "var __bmImportMetaUrl = require('node:url').pathToFileURL(__filename).href;" },
  logOverride: { 'empty-import-meta': 'silent' },
});
for (const f of ['main/main.cjs', 'preload/preload.cjs', 'worker/run.cjs']) console.log(`esbuild: dist/${f} ${kb(join(dist, f))} KB`);

// sql.js finds its wasm via __dirname: copy it next to the worker bundle
const engineRequire = createRequire(join(repo, 'packages', 'engine', 'package.json'));
try {
  const wasm = join(dirname(engineRequire.resolve('sql.js')), 'sql-wasm.wasm');
  if (existsSync(wasm)) { copyFileSync(wasm, join(dist, 'worker', 'sql-wasm.wasm')); console.log(`wasm: dist/worker/sql-wasm.wasm ${kb(wasm)} KB`); }
} catch { console.warn('sql.js not resolvable from packages/engine: no wasm copied'); }

console.log(`build: ${relative(repo, dist)} in ${Date.now() - t0} ms`);
