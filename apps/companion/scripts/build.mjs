// Main and preload as CommonJS bundles. The SPA is a separate step (`pnpm spa`).
import { build } from 'esbuild'
import { copyFileSync, rmSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
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
await build({
  ...common, platform: 'node', target: 'node22', entryPoints: [join(src, 'main/main.ts')], outfile: join(dist, 'main/main.cjs'),
  // ESM deps read import.meta.url (unpdf, the engine's own dir): give the CJS bundle a real file URL.
  define: { ...common.define, 'import.meta.url': '__bmImportMetaUrl' },
  banner: { js: "var __bmImportMetaUrl = require('node:url').pathToFileURL(__filename).href;" },
  logOverride: { 'empty-import-meta': 'silent' },
  external: ['electron', 'bufferutil', 'utf-8-validate'],
})
await build({
  ...common, platform: 'node', target: 'node22', entryPoints: [join(src, 'worker/build.ts')], outfile: join(dist, 'worker/build.cjs'),
  define: { ...common.define, 'import.meta.url': '__bmImportMetaUrl' },
  banner: { js: "var __bmImportMetaUrl = require('node:url').pathToFileURL(__filename).href;" },
  logOverride: { 'empty-import-meta': 'silent' },
  external: ['electron', 'bufferutil', 'utf-8-validate'],
})
await build({ ...common, platform: 'browser', target: 'chrome140', entryPoints: [join(src, 'preload/local.ts')], outfile: join(dist, 'preload/preload.cjs') })
// sql.js finds its wasm next to the bundle that loads it, for the pipeline's Anki deck.
const engineRequire = createRequire(join(app, '..', '..', 'packages', 'engine', 'package.json'))
copyFileSync(join(dirname(engineRequire.resolve('sql.js')), 'sql-wasm.wasm'), join(dist, 'worker', 'sql-wasm.wasm'))
for (const f of ['main/main.cjs', 'worker/build.cjs', 'preload/preload.cjs']) console.log(`dist/${f} ${Math.round(statSync(join(dist, f)).size / 1024)} KB`)
