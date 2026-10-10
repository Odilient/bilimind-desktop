// Build + package for Windows (portable + nsis, x64) into apps/desktop/release/.
// Behind the venue firewall the GitHub downloads fail, so the npmmirror mirrors from the repo .npmrc are the
// default here; CI (GitHub Actions) sets CI=true and keeps electron-builder's GitHub defaults.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env };
if (!env.CI) {
  env.ELECTRON_MIRROR ??= env.npm_config_electron_mirror || 'https://npmmirror.com/mirrors/electron/';
  env.ELECTRON_BUILDER_BINARIES_MIRROR ??= env.npm_config_electron_builder_binaries_mirror || 'https://npmmirror.com/mirrors/electron-builder-binaries/';
}
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: app, env, stdio: 'inherit', shell: false });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
if (!process.argv.includes('--skip-build')) run(process.execPath, [join(app, 'scripts', 'build.mjs'), '--minify']);
const builderCli = createRequire(join(app, 'package.json')).resolve('electron-builder/cli.js');
run(process.execPath, [builderCli, '--win', 'portable', 'nsis', '--x64', '--publish', 'never', ...process.argv.slice(2).filter(a => a !== '--skip-build')]);
