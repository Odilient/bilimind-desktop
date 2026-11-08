import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// The tests run the main process's API, so they get its English-only i18n too (see scripts/build.mjs).
export default defineConfig({
  resolve: {
    alias: [{ find: /^.*[\\/]utils[\\/]i18n(\.ts)?$/, replacement: fileURLToPath(new URL('./merged/shell/src/i18n-shell.ts', import.meta.url)) }],
  },
})
