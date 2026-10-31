// Main and preload as CommonJS bundles. The SPA is a separate step (`pnpm spa`).
import { build } from 'esbuild'
import { rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const app = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(app, 'dist')
const src = join(app, 'merged', 'shell', 'src')
const minify = process.argv.includes('--minify')
rmSync(dist, { recursive: true, force: true })

const common = {
  bundle: true, format: 'cjs', sourcemap: false, legalComments: 'none', logLevel: 'warning',
  minifyWhitespace: minify, minifySyntax: minify, external: ['electron'],
  define: { 'process.env.NODE_ENV': '"production"' },
}
await build({ ...common, platform: 'node', target: 'node22', entryPoints: [join(src, 'main/main.ts')], outfile: join(dist, 'main/main.cjs') })
await build({ ...common, platform: 'browser', target: 'chrome140', entryPoints: [join(src, 'preload/local.ts')], outfile: join(dist, 'preload/preload.cjs') })
for (const f of ['main/main.cjs', 'preload/preload.cjs']) console.log(`dist/${f} ${Math.round(statSync(join(dist, f)).size / 1024)} KB`)
