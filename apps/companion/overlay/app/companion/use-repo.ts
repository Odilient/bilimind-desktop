/**
 * The one way a screen gets at companion data: `useCompanionRepo()`. Over HTTP to the API in the main process, or
 * the seeded in-memory semester with `?demo=1`. The instance is shared, so the demo's world is one world for every
 * screen, and switching modes mid-tab swaps the instance rather than mixing two.
 */
import type { CompanionRepo } from './repo'
import { createDemoRepo } from './repo.demo'
import { createHttpRepo } from './repo.http'

let instance: CompanionRepo | null = null

export function useCompanionRepo(): CompanionRepo {
  let demoFlag: unknown
  try {
    demoFlag = useRouter().currentRoute.value.query.demo
  } catch {
    demoFlag = undefined
  }
  const mode = isCompanionDemo(demoFlag) ? 'demo' : 'http'
  if (!instance || instance.mode !== mode) instance = mode === 'demo' ? createDemoRepo() : createHttpRepo()
  return instance
}

/** The repo already in use, without making one. */
export function peekCompanionRepo(): CompanionRepo | null {
  return instance
}

/** Drop the instance. */
export function resetCompanionRepo(): void {
  instance = null
}
