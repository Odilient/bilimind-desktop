/**
 * "Map this course's topics": a mind map of what has been taught, every node
 * naming where it came from.
 *
 * It reads the slides and transcripts on the server
 * (`POST /api/companion/items/{id}/map`, not built yet).
 */
import type { MapPlan } from './ops'

export type ServerMap = { kind: 'plan'; plan: MapPlan } | { kind: 'soon' } | { kind: 'error'; message: string }

/**
 * Ask the server to map the board's course. The endpoint is planned, not
 * built; a 404 (or 405) means "not yet", which the popover says plainly.
 * Proposed contract: `POST /items/{id}/map { scope }` → `{ data: MapPlan }`.
 */
export async function requestServerMap(itemId: string, scope: 'course' | 'deadline'): Promise<ServerMap> {
  try {
    const plan = await useApi().post<MapPlan>(`/companion/items/${itemId}/map`, { scope })
    return plan?.root ? { kind: 'plan', plan } : { kind: 'soon' }
  } catch (e) {
    const status = (e as { status?: number }).status
    if (status === 404 || status === 405 || status === 501) return { kind: 'soon' }
    return { kind: 'error', message: (e as Error).message || 'The map could not be made.' }
  }
}
