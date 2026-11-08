/**
 * The one way a screen gets at companion data: `useCompanionRepo()`, over HTTP to the API in the main process.
 */
import type { CompanionRepo } from './repo'
import { createHttpRepo } from './repo.http'

let instance: CompanionRepo | null = null

export function useCompanionRepo(): CompanionRepo {
  instance ??= createHttpRepo()
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
