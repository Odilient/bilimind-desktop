/**
 * Planning the week, in the Calendar: moving a
 * study block to another day, and "Plan my week".
 *
 * A move is an edit of the task's `date`, nothing more. The server pins a
 * task of the plan's that changes day (`moved_from`, CollectionWriter), and
 * from then on Planner::reconcile leaves it
 * where the learner put it and doesn't plan it again on the day it left. So
 * Today's "Do it tomorrow" pins too, through the very same write, and a
 * client can't get pinning wrong because it never writes it.
 *
 * "Plan my week" asks the planner for each day left in the week, one after
 * the other (`POST /plan/rebuild?date=`, the server takes one at a time per
 * learner anyway). Ticked, pinned and own tasks survive it, as they survive
 * every rebuild; the rest is planned fresh. A day planned ahead is planned
 * again when it comes (Planner::ensure), because by then the cards reviewed
 * and lessons done have changed what it should hold.
 */
import type { PlanTask } from './types'
import type { CompanionStore } from './store'
import { dayKey } from './time'

/** What a task is for, as PlanTask::planKey() says it on the server. */
function keyOf(t: PlanTask): string {
  return [t.kind, t.deadline_id ?? '', t.topic_id ?? '', t.subject_id ?? ''].join('|')
}

/**
 * To `date`, at the end of that day's list. The day it lands on may already
 * hold its twin (the same work, planned there by the plan, not yet started):
 * the one moved replaces it rather than doubling it, as the next rebuild of
 * that day would anyway. With `time` it also gets that hour (the Calendar's
 * grid), or loses it (null); without, a timed task keeps its hour.
 */
export async function moveTask(store: CompanionStore, t: PlanTask, date: string, time?: string | null): Promise<void> {
  const retime = time !== undefined && (t.starts_at ?? null) !== time ? { starts_at: time } : {}
  if (t.date === date) {
    if ('starts_at' in retime) await store.upsert<PlanTask>('plan-tasks', { id: t.id, ...retime })
    return
  }
  const there = store.planTasks.value.filter((x) => x.date === date && x.id !== t.id)
  const twin = t.kind === 'own'
    ? null
    : there.find((x) => x.kind !== 'own' && !x.done_at && !x.moved_from && keyOf(x) === keyOf(t))
  const last = there.reduce((max, x) => Math.max(max, x.position), -1)
  await store.upsert<PlanTask>('plan-tasks', { id: t.id, date, position: last + 1, ...retime })
  if (twin) await store.remove('plan-tasks', twin.id).catch(() => undefined)
}

/** Every day of `days` from today on, planned again; then the store catches up. */
export async function planDays(store: CompanionStore, days: string[]): Promise<void> {
  const today = dayKey()
  for (const day of days.filter((d) => d >= today)) await store.repo().rebuildPlan(day)
  await store.sync()
  void store.loadToday()
}
