import tailwindcss from '@tailwindcss/vite'

// The companion as a client-side SPA for the Electron shell. Its /api lives in the main process, on the same origin.
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  ssr: false,
  srcDir: 'merged/app',
  dir: { public: 'merged/public', shared: 'merged/shared' },
  css: ['~/assets/css/fonts.css', '~/assets/css/main.css', '~/assets/css/companion.css'],
  vite: {
    plugins: [tailwindcss()],
    worker: { format: 'es' },
  },
  nitro: {
    // No server behind the build: every deep path falls back to 200.html.
    prerender: { crawlLinks: false, routes: ['/'] },
  },
  runtimeConfig: {
    public: {
      apiBase: 'app://bilimind/api',
      companionDemo: '',
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'BiliMind',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'color-scheme', content: 'light' },
        { name: 'theme-color', content: '#ECEEF2' },
      ],
      style: [{
        // Layer order, before any stylesheet can name a layer (the same reason as in the hosted app).
        innerHTML: '@layer theme, base, components, utilities;',
        tagPriority: 'critical',
      }],
      script: [{ innerHTML: "document.documentElement.classList.add('has-js')", tagPosition: 'head' }],
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      ],
    },
  },
  typescript: { strict: true, typeCheck: false },
})
