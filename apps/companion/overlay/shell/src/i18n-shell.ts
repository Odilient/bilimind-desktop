// The main process speaks English. The shared companion/time.ts names its day words through the app's
// i18n helpers, which need Vite and Nuxt; scripts/build.mjs points that import here instead, and this reads
// the same English strings straight from the locale file.
import calendar from '../../i18n/locales/en/calendar.json' with { type: 'json' }

const messages: Record<string, unknown> = { calendar }

function lookup(key: string): unknown {
  return key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), messages)
}

export const currentLocale = (): 'en' => 'en'

export function intlTag(locale: string): string {
  if (locale === 'en') return 'en-GB'
  if (locale === 'pt') return 'pt-BR'
  return locale
}

/** vue-i18n's message format, as far as these strings use it: `{name}` slots and `a | b` plural forms. */
export function translate(key: string, named?: Record<string, unknown> | number, plural?: number): string {
  const raw = lookup(key)
  if (typeof raw !== 'string') return key
  const count = typeof named === 'number' ? named : plural
  let text = raw
  if (count != null && raw.includes(' | ')) {
    const forms = raw.split(' | ')
    text = (forms.length === 3 ? forms[count === 0 ? 0 : count === 1 ? 1 : 2] : forms[count === 1 ? 0 : 1]) ?? raw
  }
  const slots: Record<string, unknown> = typeof named === 'object' && named ? named : { n: count, count }
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(slots[k] ?? ''))
}
