// SPA + shell + installers: node scripts/dist.mjs [--no-spa] [--linux|--win|--mac]
// Defaults to the current OS. Unsigned builds (electron-builder.yml).
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const app = join(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: app, stdio: 'inherit', env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' } })
  if (r.status !== 0) process.exit(r.status ?? 1)
}
if (!argv.includes('--no-spa')) run("pnpm", ["run", "spa"])
// The offline player ships beside the app, for exporting a course.
run('pnpm', ['--filter', '@bilimind/player', 'build'])
run('node', ['scripts/build.mjs', '--minify'])
const target = argv.find((a) => ['--linux', '--win', '--mac'].includes(a))
  ?? { linux: '--linux', win32: '--win', darwin: '--mac' }[process.platform]
run('pnpm', ['exec', 'electron-builder', target, '--publish', 'never'])
