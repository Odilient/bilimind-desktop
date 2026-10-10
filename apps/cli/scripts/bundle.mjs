// SKELETON (WP0, owner WP6): esbuild the CLI + engine + core into ONE file that runs with no node_modules:
// skills/bilimind/scripts/bilimind.mjs, and copy the player template next to it.
import { build } from 'esbuild';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const skill = join(repo, 'skills', 'bilimind');
mkdirSync(join(skill, 'scripts'), { recursive: true });
mkdirSync(join(skill, 'templates'), { recursive: true });

await build({
  entryPoints: [join(here, '..', 'src', 'main.ts')],
  outfile: join(skill, 'scripts', 'bilimind.mjs'),
  bundle: true, platform: 'node', format: 'esm', target: 'node22',
  // ESM bundles of CJS deps need require(): give them one
  banner: { js: "import { createRequire as __bmCreateRequire } from 'node:module'; const require = __bmCreateRequire(import.meta.url);" },
  legalComments: 'none',
  logLevel: 'info',
});

const tpl = join(repo, 'packages', 'player', 'dist', 'player.html');
if (existsSync(tpl)) copyFileSync(tpl, join(skill, 'templates', 'player.html'));
else console.warn('packages/player/dist/player.html missing: run `pnpm -F @bilimind/player build` first');
