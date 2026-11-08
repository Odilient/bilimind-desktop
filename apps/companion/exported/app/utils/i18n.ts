// The interface languages, how one is picked, and how dates, numbers and money read in it.
//
// Strings live in `i18n/locales/{code}/{area}.json`. Every file of a language is merged under
// its area name (`pay.json` -> `t('pay.…')`), found by the glob below, so a new area is a new
// file and nothing else. A language is fetched the first time it is needed; English is always
// loaded too, because it is the fallback for any key a translation has not caught up with.
//
// Components call `const { t } = useI18n()`. Plain .ts helpers that run outside a component's
// setup (label maps, toasts from an event handler) call `translate()` here instead, because
// `useI18n()` throws once there is no component instance.

import type { Composer } from 'vue-i18n'

export const LOCALES = ['en', 'ru', 'uz', 'es', 'pt', 'fr', 'tr'] as const
export type Locale = (typeof LOCALES)[number]

/** Each language in its own words, the way a picker must show it. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  ru: 'Русский',
  uz: 'Oʻzbekcha',
  es: 'Español',
  pt: 'Português',
  fr: 'Français',
  tr: 'Türkçe',
}

export const LOCALE_COOKIE = 'bm_locale'
export const LOCALE_COOKIE_OPTIONS = {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax' as const,
  path: '/',
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/** `ru-RU` -> `ru`, `pt-BR` -> `pt`, `uz-Latn-UZ` -> `uz`; anything else -> null. */
export function matchLocale(value: string | null | undefined): Locale | null {
  if (!value) return null
  const base = value.trim().toLowerCase().split(/[-_]/)[0]
  return isLocale(base) ? base : null
}

/** The first language of an Accept-Language header (or `navigator.languages`) we speak. */
export function firstLocale(list: string | readonly string[] | null | undefined): Locale | null {
  if (!list) return null
  const items = typeof list === 'string' ? list.split(',').map((p) => p.split(';')[0]!) : list
  for (const item of items) {
    const hit = matchLocale(item)
    if (hit) return hit
  }
  return null
}

/**
 * The tag handed to `Intl`. English stays `en-GB` because the app has always written dates
 * as "Mon 9 Nov"; Portuguese is Brazil's.
 */
export function intlTag(locale: string): string {
  if (locale === 'en') return 'en-GB'
  if (locale === 'pt') return 'pt-BR'
  return locale
}

/** Numbers and money: English stays `en` so a dollar is "$1,240", not "US$1,240" (en-GB's). */
function numberTag(locale: string): string {
  return locale === 'en' ? 'en' : intlTag(locale)
}

/* -- Plurals --------------------------------------------------------------------------------- */

/*
 * One rule for every language, from the CLDR categories `Intl` already knows. Messages list
 * their forms in CLDR order: Russian "one | few | many" ("{n} урок | {n} урока | {n} уроков"),
 * the rest "one | other". A message with one extra form leads with a zero form
 * ("no lessons | {n} lesson | {n} lessons"). Turkish and Uzbek put a noun in the singular after
 * a number, so their messages usually have one form and no pipe at all.
 */
const ORDER: Partial<Record<Locale, string[]>> = { ru: ['one', 'few', 'many'] }

function pluralRule(locale: Locale) {
  const rules = new Intl.PluralRules(intlTag(locale))
  const order = ORDER[locale] ?? ['one', 'other']
  return (choice: number, choicesLength: number): number => {
    const n = Math.abs(choice)
    const zeroForm = choicesLength === order.length + 1
    if (zeroForm && n === 0) return 0
    let index = order.indexOf(rules.select(n))
    // Russian fractions ("1,5 урока") take the "few" form; anything unlisted takes the last.
    if (index < 0) index = locale === 'ru' ? 1 : order.length - 1
    return Math.min(index + (zeroForm ? 1 : 0), choicesLength - 1)
  }
}

export const PLURAL_RULES = Object.fromEntries(LOCALES.map((l) => [l, pluralRule(l)]))

/* -- Messages -------------------------------------------------------------------------------- */

type Messages = Record<string, unknown>

// Lazy: each file is its own chunk, fetched only when its language is.
const FILES = import.meta.glob<Messages>('../../i18n/locales/*/*.json', { import: 'default' })

/** Fetch a language's files (once per i18n instance) and register them under their areas. */
export async function ensureMessages(i18n: Composer, locale: Locale): Promise<void> {
  if (Object.keys(i18n.getLocaleMessage(locale) as Messages).length) return
  const mine = Object.entries(FILES).filter(([path]) => path.includes(`/locales/${locale}/`))
  const areas = await Promise.all(
    mine.map(async ([path, load]) => [path.split('/').pop()!.replace(/\.json$/, ''), await load()] as const),
  )
  i18n.setLocaleMessage(locale, Object.fromEntries(areas) as never)
}

/* -- Outside components ---------------------------------------------------------------------- */

// The browser has one app, so the composer can sit here. The server renders many requests at
// once, so there it is always read off the request's own Nuxt app.
let clientI18n: Composer | null = null

export function bindI18n(i18n: Composer): void {
  if (import.meta.client) clientI18n = i18n
}

function composer(): Composer | null {
  if (import.meta.client) return clientI18n
  return (tryUseNuxtApp()?.$i18n as Composer | undefined) ?? null
}

/** The active language. Reactive: a computed that calls it re-runs when the language changes. */
export function currentLocale(): Locale {
  const value = composer()?.locale.value
  return isLocale(value) ? value : 'en'
}

/** `t()` for plain .ts code that runs outside a component's setup. */
export function translate(key: string, named?: Record<string, unknown> | number, plural?: number): string {
  const i18n = composer()
  if (!i18n) return key
  if (typeof named === 'number') return i18n.t(key, named)
  if (plural != null) return i18n.t(key, named ?? {}, plural)
  return i18n.t(key, named ?? {})
}

/* -- Dates, numbers, money in the active language -------------------------------------------- */

const DASH = '—'

export function fmtNumber(n: number | null | undefined, options?: Intl.NumberFormatOptions): string {
  if (n == null || !Number.isFinite(n)) return DASH
  return new Intl.NumberFormat(numberTag(currentLocale()), options).format(n)
}

/** Integer minor units to "$1,240" / "1 240 $" (cents only when there are some). */
export function fmtMoney(cents: number | null | undefined, currency = 'USD', compact = false): string {
  if (cents == null) return DASH
  const value = cents / 100
  try {
    return new Intl.NumberFormat(numberTag(currentLocale()), {
      style: 'currency',
      currency,
      notation: compact && Math.abs(value) >= 10_000 ? 'compact' : 'standard',
      minimumFractionDigits: compact || Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: compact ? 1 : 2,
    }).format(value)
  } catch {
    // An unknown ISO code from a hand-edited setting: say the number and the code.
    return `${value.toFixed(2)} ${currency}`
  }
}

export function fmtDate(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  if (value == null || value === '') return DASH
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return DASH
  try {
    return new Intl.DateTimeFormat(intlTag(currentLocale()), options).format(date)
  } catch {
    // A bad timeZone in the options: say it in the device's zone rather than not at all.
    const { timeZone: _, ...rest } = options
    return new Intl.DateTimeFormat(intlTag(currentLocale()), rest).format(date)
  }
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

/** "3 hours ago", "in 2 days", "yesterday", in the active language. Under a minute: "now". */
export function fmtRelative(value: string | number | Date | null | undefined): string {
  if (value == null || value === '') return ''
  const then = value instanceof Date ? value.getTime() : new Date(value).getTime()
  if (!Number.isFinite(then)) return ''
  const seconds = Math.round((then - Date.now()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(intlTag(currentLocale()), { numeric: 'auto' })
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.trunc(seconds / size), unit)
  }
  return rtf.format(0, 'second')
}
