import type { CompanionRepo } from '../repo'
import { useCompanionRepo } from '../use-repo'

/** The repo pages read and write through: the app's own, http or PowerSync. */
export function usePagesRepo(): CompanionRepo {
  return useCompanionRepo()
}
