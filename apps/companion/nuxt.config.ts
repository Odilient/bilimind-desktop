import tailwindcss from '@tailwindcss/vite'

// The companion as a client-side SPA for the Electron shell. Its /api lives in the main process, on the same origin.
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  ssr: false,
  srcDir: 'merged/app',
  dir: { public: 'merged/public', shared: 'merged/shared' },
  css: ['~/assets/css/fonts.css', '~/assets/css/main.css', '~/assets/css/companion.css'],
  // `useI18n` is auto-imported like Nuxt's own composables (the plugin is app/plugins/05.i18n.ts).
  imports: {
    presets: [{ from: 'vue-i18n', imports: ['useI18n'] }],
  },
  vite: {
    plugins: [tailwindcss()],
    worker: { format: 'es' },
    // vue-i18n's bundler build: the Composition API only, messages compiled in the app, no devtools hook.
    define: {
      __VUE_I18N_FULL_INSTALL__: 'true',
      __VUE_I18N_LEGACY_API__: 'false',
      __INTLIFY_PROD_DEVTOOLS__: 'false',
      __INTLIFY_JIT_COMPILATION__: 'true',
      __INTLIFY_DROP_MESSAGE_COMPILER__: 'false',
    },
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
        { name: 'theme-color', content: '#f3efe6' },
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
