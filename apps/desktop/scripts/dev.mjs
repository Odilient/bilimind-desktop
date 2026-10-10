// Dev loop: vite dev server for the renderer (hot reload) + esbuild of main/preload/worker, then Electron pointed at
// the dev server (BILIMIND_RENDERER_URL). BILIMIND_EXAMPLES defaults to showcase/courses.
// Usage: node scripts/dev.mjs   (opens a window: for people, not for agents; agents use BILIMIND_E2E=1)
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(app, '..', '..');
const b = spawnSync(process.execPath, [join(app, 'scripts', 'build.mjs'), '--no-renderer'], { cwd: app, stdio: 'inherit' });
if (b.status !== 0) process.exit(b.status ?? 1);
const server = await createServer({ configFile: join(app, 'vite.config.ts') });
await server.listen();
const url = server.resolvedUrls?.local?.[0] ?? 'http://localhost:5181/';
console.log(`renderer: ${url}`);
const electron = createRequire(import.meta.url)('electron');
const env = { ...process.env, BILIMIND_RENDERER_URL: url, BILIMIND_EXAMPLES: process.env.BILIMIND_EXAMPLES ?? join(repo, 'showcase', 'courses') };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, [app], { cwd: app, env, stdio: 'inherit' });
child.on('exit', async code => { await server.close(); process.exit(code ?? 0); });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill());
