/**
 * Light, dark, or whatever the OS says — the app's colour theme.
 *
 * The switch is `data-theme` on <html>, and the palettes behind it are two
 * blocks of tokens in `main.css`, so no component carries a theme of its own.
 * `system` is not resolved here at all: the dark block sits behind a
 * `prefers-color-scheme` media query for it, so the OS can change its mind
 * mid-session and the page follows without a line of script.
 *
 * Stored in a cookie for the reason `useRail` gives: the server renders
 * <html>, and only a cookie reaches it, so the first paint is already in the
 * chosen theme. A `localStorage` value would mean a light flash on every load
 * for anyone who picked dark. It is per device rather than on the account,
 * on purpose: a dark laptop and a light phone is an ordinary combination.
 */

export type ThemePreference = 'system' | 'light' | 'dark'

export const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; icon: string }> = [
  { value: 'system', label: 'System', icon: 'monitor' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
]

const COOKIE = 'bilimind_theme'

/** The browser chrome around the page on phones: each theme's `--bg`. */
const THEME_COLOR = { light: '#ECEEF2', dark: '#08090C' }

function normalise(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system'
}

export function useTheme() {
  const cookie = useCookie<ThemePreference>(COOKIE, {
    // A year, like the rail: a preference about the frame, not the session.
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
  })

  // Shared state for the same reason as the rail's: a cookie ref is per call,
  // and the menu and the settings page must agree the moment either changes.
  const preference = useState<ThemePreference>('shell:theme', () => normalise(cookie.value))

  function set(next: ThemePreference): void {
    if (next === preference.value) return

    // Every control with `transition-colors` would otherwise fade on its own
    // clock, and the page re-colours in a ripple instead of at once. The
    // attribute is written here as well as by `useHead`, which patches the DOM
    // a tick later, so the paint with transitions off is already the new one.
    if (import.meta.client) {
      const root = document.documentElement
      root.classList.add('theme-switching')
      root.dataset.theme = next
      void getComputedStyle(root).backgroundColor
      window.requestAnimationFrame(() => root.classList.remove('theme-switching'))
    }

    preference.value = next
    cookie.value = next
  }

  return { preference: readonly(preference), set }
}

/**
 * Paint the current page in the person's theme. Called by the app's own
 * surfaces — `ShellFrame`, and the few app pages that render without it.
 * Everything else keeps the `light` that `app.vue` sets, and gets it back the
 * moment the surface that called this unmounts.
 */
export function useAppTheme(): void {
  const { preference } = useTheme()

  useHead(() => ({
    htmlAttrs: { 'data-theme': preference.value },
    meta: [
      {
        name: 'color-scheme',
        content: { system: 'light dark', light: 'light', dark: 'dark' }[preference.value],
      },
      ...(preference.value === 'system'
        ? [
            {
              name: 'theme-color',
              content: THEME_COLOR.light,
              media: '(prefers-color-scheme: light)',
            },
            {
              // No key: unhead keeps several `theme-color`s from one entry side
              // by side. A key would, and did, render this one twice on hydration.
              name: 'theme-color',
              content: THEME_COLOR.dark,
              media: '(prefers-color-scheme: dark)',
            },
          ]
        : [{ name: 'theme-color', content: THEME_COLOR[preference.value] }]),
    ],
  }))
}
