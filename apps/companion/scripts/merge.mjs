// exported/ is copied from the hosted app by a one-way export and overlay/ is written for this app. merged/ is the
// two together, overlay winning, and it is what Nuxt, esbuild and the tests read. Generated, never committed.
import { cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const app = join(dirname(fileURLToPath(import.meta.url)), '..')
const merged = join(app, 'merged')
rmSync(merged, { recursive: true, force: true })
for (const from of ['exported', 'overlay']) {
  if (existsSync(join(app, from))) cpSync(join(app, from), merged, { recursive: true })
}
