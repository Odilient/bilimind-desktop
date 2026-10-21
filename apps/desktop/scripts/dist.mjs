// Build + package for the platform you are on into apps/desktop/release/ (targets in electron-builder.yml):
//   Windows: portable .exe + NSIS installer (x64)   macOS: .dmg + .zip (arm64, x64)   Linux: AppImage + .deb (x64)
// Extra arguments go to electron-builder, e.g. `node scripts/dist.mjs --linux AppImage` or `--dir` for an unpacked app.
// Behind a firewall that blocks GitHub downloads, set ELECTRON_MIRROR and ELECTRON_BUILDER_BINARIES_MIRROR first.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: process.env.CSC_IDENTITY_AUTO_DISCOVERY ?? 'false' };
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: app, env, stdio: 'inherit', shell: false });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
const args = process.argv.slice(2).filter(a => a !== '--skip-build');
if (!process.argv.includes('--skip-build')) run(process.execPath, [join(app, 'scripts', 'build.mjs'), '--minify']);
const platform = { win32: '--win', darwin: '--mac', linux: '--linux' }[process.platform];
if (!platform) { console.error(`no packaging target for ${process.platform}`); process.exit(1); }
const builderCli = createRequire(join(app, 'package.json')).resolve('electron-builder/cli.js');
run(process.execPath, [builderCli, ...(args.some(a => /^--(win|mac|linux)$/.test(a)) ? [] : [platform]), '--publish', 'never', ...args]);
