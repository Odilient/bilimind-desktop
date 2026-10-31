/**
 * Whether the companion runs in memory instead of on the API, and which world
 * it runs: `?demo=1` is Kamila's seeded semester; `?demo=new` is a brand-new
 * account holding only the starter kit (`companion/starter-demo.ts`), so the
 * first run can be seen without signing up. On when the build says so
 * (NUXT_PUBLIC_COMPANION_DEMO=1, the semester), or when a URL carried either
 * flag once in this tab — remembered in sessionStorage so links inside the
 * app don't each have to carry it. `?demo=0` turns it off.
 */
const KEY = 'bm:companion-demo'

export type CompanionDemoKind = 'semester' | 'new'

function kindOf(flag: unknown): CompanionDemoKind | null {
  return flag === '1' ? 'semester' : flag === 'new' ? 'new' : null
}

export function companionDemoKind(queryFlag?: unknown): CompanionDemoKind | null {
  const config = useRuntimeConfig()
  if (String(config.public.companionDemo ?? '') === '1') return 'semester'

  const flag = Array.isArray(queryFlag) ? queryFlag[0] : queryFlag
  if (import.meta.client) {
    try {
      if (kindOf(flag)) sessionStorage.setItem(KEY, String(flag))
      if (flag === '0') sessionStorage.removeItem(KEY)
      return kindOf(sessionStorage.getItem(KEY))
    } catch {
      return kindOf(flag)
    }
  }
  return kindOf(flag)
}

export function isCompanionDemo(queryFlag?: unknown): boolean {
  return companionDemoKind(queryFlag) !== null
}
