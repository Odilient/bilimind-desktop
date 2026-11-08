// The shell's typecheck walks into app/utils/i18n.ts through companion/time.ts. At run time the bundle uses
// i18n-shell.ts instead (scripts/build.mjs); these are only the Vite and Nuxt names that file mentions.
interface ImportMeta {
  readonly client: boolean
  glob<T>(pattern: string, options?: { import?: string }): Record<string, () => Promise<T>>
}
declare function tryUseNuxtApp(): { $i18n?: unknown } | null
