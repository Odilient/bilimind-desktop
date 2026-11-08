/**
 * Switch the interface language. Signed in, the choice is saved on the account so every
 * device follows it; the cookie is written either way, so a signed-out visitor keeps it and the
 * server renders the next page in it. `<html lang>` follows the active language (the i18n plugin).
 */
export function useLocale() {
  const { $i18n } = useNuxtApp()
  const auth = useAuth()
  const cookie = useCookie<string | null>(LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS)

  const locale = computed<Locale>(() => (isLocale($i18n.locale.value) ? $i18n.locale.value : 'en'))

  async function setLocale(code: Locale): Promise<void> {
    await ensureMessages($i18n, code)
    $i18n.locale.value = code
    cookie.value = code
    if (auth.user.value && auth.user.value.locale !== code) await auth.updateProfile({ locale: code })
  }

  return { locale, setLocale, locales: LOCALES, names: LOCALE_NAMES }
}
