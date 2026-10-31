import type { Store } from '../store.ts'

/** The language a course is written in when nothing said otherwise. */
export const userLanguage = (store: Store): string => store.getMeta<{ locale?: string }>('user')?.locale || 'en'
