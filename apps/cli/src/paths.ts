// Where the player template and the 3D objects live, in both layouts:
//   bundle: <skill>/scripts/bilimind.mjs -> <skill>/templates/player.html, <skill>/assets/obj-*.webp
//   source: apps/cli/src/*.ts            -> skills/bilimind/{templates,assets} or packages/player/{dist,public/img}
// The CLI exports both as BILIMIND_TEMPLATE / BILIMIND_ASSETS (unless already set) so engine build can find them.
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');

export function templateCandidates(): string[] {
  return [
    process.env.BILIMIND_TEMPLATE ?? '',
    join(here, '..', 'templates', 'player.html'),
    join(repo, 'skills', 'bilimind', 'templates', 'player.html'),
    join(repo, 'packages', 'player', 'dist', 'player.html'),
  ].filter(Boolean);
}

export function findTemplate(explicit?: string): string | undefined {
  if (explicit) return existsSync(resolve(explicit)) ? resolve(explicit) : undefined;
  return templateCandidates().find(p => existsSync(p));
}

const hasObjects = (d: string) => { try { return readdirSync(d).some(f => /^obj-.*\.webp$/.test(f)); } catch { return false; } };

export function findAssets(): string | undefined {
  return [
    process.env.BILIMIND_ASSETS ?? '',
    join(here, '..', 'assets'),
    join(repo, 'skills', 'bilimind', 'assets'),
    join(repo, 'packages', 'player', 'public', 'img'),
  ].filter(Boolean).find(hasObjects);
}

export function exportLocations(): void {
  const t = findTemplate();
  const a = findAssets();
  if (t && !process.env.BILIMIND_TEMPLATE) process.env.BILIMIND_TEMPLATE = t;
  if (a && !process.env.BILIMIND_ASSETS) process.env.BILIMIND_ASSETS = a;
}
