// The interface language. vue-i18n through a plugin rather than @nuxtjs/i18n: URLs never carry
// the language here, the pick order below is our own, and area files are found by a glob (see
// app/utils/i18n.ts), so the module's routing, detection and per-file config would all be turned
// off or worked around.
//
// Which language, first match wins: the account's saved `locale`, the `bm_locale` cookie (a
// pick made signed out, and a mirror of the account's, so the server renders the right one),
// the institution's `settings.locale` for its members, the browser's languages, English.

import { createI18n } from 'vue-i18n'
import type { OrgMe } from '~/institution/types'

export default defineNuxtPlugin({
  name: 'i18n',
  async setup() {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      fallbackLocale: 'en',
      messages: {},
      pluralRules: PLURAL_RULES,
      missingWarn: import.meta.dev,
      fallbackWarn: false,
    })
    useNuxtApp().vueApp.use(i18n)
    const composer = i18n.global
    bindI18n(composer)

    // Read once here: the watcher below runs outside the Nuxt context.
    const user = useAuth().user
    const cookie = useCookie<string | null>(LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS)
    const me = useState<OrgMe | null | undefined>('inst:me')
    const browser = import.meta.server
      ? useRequestHeaders(['accept-language'])['accept-language']
      : navigator.languages

    const pick = (): Locale =>
      matchLocale(user.value?.locale)
      ?? matchLocale(cookie.value)
      ?? matchLocale(me.value?.org.settings.locale)
      ?? firstLocale(browser)
      ?? 'en'

    // The server's pick travels in the payload, so hydration renders the same words.
    const first = useState<Locale | null>('i18n:locale', () => null)
    first.value ??= pick()
    await Promise.all([ensureMessages(composer, 'en'), ensureMessages(composer, first.value)])
    composer.locale.value = first.value

    useHead({ htmlAttrs: { lang: computed(() => composer.locale.value) } })

    if (import.meta.client) {
      watch(
        () => [user.value?.locale, me.value?.org.settings.locale],
        async () => {
          const saved = matchLocale(user.value?.locale)
          if (saved && cookie.value !== saved) cookie.value = saved
          const next = pick()
          if (next === composer.locale.value) return
          await ensureMessages(composer, next)
          composer.locale.value = next
        },
      )
    }

    return { provide: { i18n: composer } }
  },
})
