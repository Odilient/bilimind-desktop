// Renderer build (Vue 3). Output: apps/desktop/dist/renderer/index.html, loaded by main with loadFile().
// base './' keeps every asset URL relative so the page works from file://.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  root: fileURLToPath(new URL('./src/renderer', import.meta.url)),
  base: './',
  plugins: [
    vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === 'webview' } } }),
  ],
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    target: 'chrome140',
    assetsInlineLimit: 0,
    reportCompressedSize: false,
  },
  server: { port: 5181, strictPort: false },
});
