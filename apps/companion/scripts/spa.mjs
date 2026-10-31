// Copies what `nuxt generate` wrote into spa/, which is what app://bilimind serves.
import { cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const app = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(app, '.output', 'public')
if (!existsSync(join(out, '200.html'))) { console.error(`no SPA at ${out}`); process.exit(1) }
rmSync(join(app, 'spa'), { recursive: true, force: true })
cpSync(out, join(app, 'spa'), { recursive: true })
