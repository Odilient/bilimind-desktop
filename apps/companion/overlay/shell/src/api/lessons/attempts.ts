// Attempts and progress. A lesson with questions completes itself when all of them are passed; one without is marked by hand.
import type { Rec, Store } from '../store.ts'
import { attemptWire, assessmentWire, isLive, nodeSummary } from './wire.ts'

const stats = (store: Store, nodeId: number) => {
  const live = store.recs('assessment', nodeId).filter(isLive)
  const passed = live.filter((a) => store.recs('attempt', a.id).some((t) => t.passed === true)).length
  return { total: live.length, passed }
}

const empty = () => ({ state: 'available', time_spent_seconds: 0, completed_at: null as string | null, last_seen_at: null as string | null })

export function syncProgress(store: Store, nodeId: number): Rec {
  const node = store.rec('node', nodeId)!
  const progress = { ...empty(), ...node.progress }
  if (progress.state === 'available') progress.state = 'in_progress'
  progress.last_seen_at = new Date().toISOString()
  const { total, passed } = stats(store, nodeId)
  if (total > 0 && passed >= total && progress.state !== 'completed') {
    progress.state = 'completed'
    progress.completed_at ??= progress.last_seen_at
  }
  return store.save('node', { ...node, progress })
}

export function setProgress(store: Store, node: Rec, input: { state?: string; time_spent_seconds?: number }) {
  const progress = { ...empty(), ...node.progress }
  if (input.time_spent_seconds !== undefined) {
    progress.time_spent_seconds += input.time_spent_seconds
    if (progress.state === 'available') progress.state = 'in_progress'
  }
  if (input.state !== undefined) progress.state = input.state
  const now = new Date().toISOString()
  progress.completed_at = progress.state === 'completed' ? progress.completed_at ?? now : null
  progress.last_seen_at = now
  store.save('node', { ...node, progress })
  return { node_id: node.id, ...progress }
}

export function attemptEnvelope(store: Store, attempt: Rec, assessment: Rec) {
  const { total, passed } = stats(store, assessment.node_id)
  return {
    data: { ...attemptWire(attempt, assessment), assessment: assessmentWire(store, assessment) },
    meta: {
      node: nodeSummary(store.rec('node', assessment.node_id)!),
      assessments_total: total,
      assessments_passed: passed,
      node_completed: total > 0 && passed >= total,
    },
  }
}

export function attemptsList(store: Store, assessment: Rec) {
  const attempts = store.recs('attempt', assessment.id).reverse().slice(0, 100)
  const scores = attempts.map((a) => a.score).filter((s) => s !== null && s !== undefined)
  return {
    data: attempts.map((a) => attemptWire(a, assessment)),
    meta: {
      assessment: assessmentWire(store, assessment),
      count: attempts.length,
      best_score: scores.length ? Math.max(...scores) : null,
      passed: attempts.some((a) => a.passed === true),
      last_attempt_at: attempts[0]?.created_at ?? null,
    },
  }
}

/** Every completed lesson, for readiness: a lesson you finished counts as having studied its topic. */
export const lessonsDone = (store: Store): Set<number> =>
  new Set(store.recs('node').filter((n) => n.progress?.state === 'completed').map((n) => n.id))
