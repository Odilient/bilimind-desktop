// One file:// safe HTML template: dist/player.html. Everything (JS, CSS, fonts, sprite) is inlined by
// vite-plugin-singlefile; the JS is one IIFE (no import(), no module workers). `bilimind build` replaces the
// __BM_COURSE__ placeholder inside <script id="bm-course" type="application/json"> with the course JSON.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [vue(), viteSingleFile()],
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    reportCompressedSize: false,
    rollupOptions: {
      input: fileURLToPath(new URL('./player.html', import.meta.url)),
      output: { format: 'iife' },
    },
  },
});
