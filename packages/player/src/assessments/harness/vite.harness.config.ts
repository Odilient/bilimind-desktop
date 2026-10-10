// Builds the WP5c harness (index.html here) to one file:// safe page: harness/dist/index.html.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteSingleFile } from 'vite-plugin-singlefile';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  root: here('./'),
  plugins: [vue(), viteSingleFile()],
  base: './',
  logLevel: 'warn',
  resolve: {
    alias: [{ find: /^@fonts\//, replacement: here('../../../node_modules/@fontsource/') }],
  },
  build: {
    target: 'es2020',
    outDir: here('./dist'),
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    reportCompressedSize: false,
    rollupOptions: { input: here('./index.html'), output: { format: 'iife' } },
  },
});
