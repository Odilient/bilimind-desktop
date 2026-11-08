/**
 * The Tasks writes that answer with a toast, shared by the board and a
 * card's own page so both say the same thing and offer the same Undo
 * (`companion/tasks.ts` does the writes and draws nothing).
 *
 *  - The tick: a card moves to Done at once and the toast can take it back.
 *  - A move to another column; into Done is the tick.
 *  - A delete waits under its toast's Undo for a few seconds before it's
 *    sent, the way a note's does: off every list at once (the store's
 *    `leave`), sent when the toast goes. A closed tab before then keeps the
 *    task, which is the safe way round.
 */
import type { Deadline, PlanTask } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { columnOf, isDone, setColumn, tickedStatus, titleOf, toggleEntry, type TaskColumn, type TaskEntry } from '~/companion/tasks'

export function useTaskActions() {
  const c = useCompanion()
  const toast = useToast()

  async function toggle(entry: TaskEntry): Promise<void> {
    const ticking = !isDone(entry)
    try {
      await toggleEntry(c, entry)
    } catch {
      return
    }
    if (!ticking) return
    // Undo puts back exactly what the tick replaced: no done time, or upcoming.
    const undo = (): Promise<unknown> =>
      entry.kind === 'task'
        ? c.upsert<PlanTask>('plan-tasks', { id: entry.id, done_at: null })
        : c.upsert<Deadline>('deadlines', { id: entry.id, status: 'upcoming' })
    toast.success({
      title: `${entry.kind === 'deadline' && tickedStatus(entry.deadline) === 'submitted' ? 'Handed in' : 'Done'}: ${titleOf(entry)}`,
      action: { label: 'Undo', handler: () => void undo().catch(() => undefined) },
    })
  }

  async function toColumn(entry: TaskEntry, col: TaskColumn): Promise<void> {
    if (columnOf(entry) === col) return
    if (col === 'done') return toggle(entry)
    await setColumn(c, entry, col).catch(() => undefined)
  }

  function remove(task: PlanTask): void {
    c.leave([task.id], true)
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      void c.remove('plan-tasks', task.id)
        .catch(() => toast.error({ title: "Couldn't delete it", body: 'It is back where it was.' }))
        .finally(() => c.leave([task.id], false))
    }, 6000)
    toast.push({
      title: `Deleted “${task.title}”`,
      duration: 6000,
      action: {
        label: 'Undo',
        handler: () => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          c.leave([task.id], false)
        },
      },
    })
  }

  return { toggle, toColumn, remove }
}
