import type { ScheduleItemState } from '~/types/api'

/**
 * The course's calendar.
 *
 * The one thing this has to communicate correctly is recovery. `ScheduleBuilder`
 * recompacts forward when a session is missed, so a slipped week shifts the plan
 * rather than breaking it — and a UI that renders that as a wall of red is
 * lying about what happened. `slippage` below exists to say so in words.
 */

/** Wire shapes for the schedule endpoints (App\Http\Resources\Schedule*Resource). */
export interface ApiScheduleNode {
  id: number
  title: string
  summary?: string | null
  estimated_minutes: number
  status: string
  layer?: number
  progress?: { state?: string } | null
}

export interface ApiScheduleItem {
  id: number
  schedule_id: number
  node_id: number
  scheduled_for: string
  estimated_minutes: number
  state: ScheduleItemState
  state_label?: string
  is_open?: boolean
  is_today?: boolean
  is_overdue?: boolean
  days_late?: number
  node?: ApiScheduleNode | null
}

export interface ApiScheduleStats {
  total: number
  pending: number
  moved: number
  done: number
  skipped: number
  open: number
  minutes_total: number
  minutes_done: number
  minutes_remaining: number
  percent: number
  next_scheduled_for: string | null
  last_scheduled_for: string | null
}

export interface ApiSchedule {
  id: number
  course_id: number
  starts_on: string
  minutes_per_week: number
  minutes_per_session: number
  days_of_week: number[]
  days_of_week_labels?: string[]
  sessions_per_week?: number
  status: string
  stats: ApiScheduleStats
  next_scheduled_for: string | null
  items?: ApiScheduleItem[]
}

export interface SchedulePlanPayload {
  starts_on: string
  minutes_per_week: number
  days_of_week: number[]
}

export function useSchedule(courseId: MaybeRefOrGetter<number>) {
  const api = useApi()
  const toast = useToast()

  const schedule = ref<ApiSchedule | null>(null)
  const loading = ref(true)
  const loadError = ref<string | null>(null)
  const saving = ref(false)
  const busyItem = ref<number | null>(null)

  const items = computed(() => schedule.value?.items ?? [])
  const stats = computed(() => schedule.value?.stats ?? null)

  async function load(): Promise<void> {
    const id = toValue(courseId)
    if (!Number.isFinite(id)) return

    loading.value = true
    try {
      schedule.value = await api.get<ApiSchedule>(`/courses/${id}/schedule`)
      loadError.value = null
    } catch (error) {
      const status = (error as { status?: number })?.status
      if (status === 404) {
        // No schedule yet is a state, not a failure.
        schedule.value = null
        loadError.value = null
      } else {
        loadError.value = error instanceof Error ? error.message : 'Could not load the schedule.'
      }
    } finally {
      loading.value = false
    }
  }

  async function savePlan(payload: SchedulePlanPayload): Promise<boolean> {
    const id = toValue(courseId)
    if (saving.value || !Number.isFinite(id)) return false

    saving.value = true
    try {
      schedule.value = await api.post<ApiSchedule>(`/courses/${id}/schedule`, payload)
      toast.success({
        title: 'Schedule built',
        body: `${schedule.value?.stats.total ?? 0} sessions on the calendar.`,
      })
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The schedule could not be built.')
      return false
    } finally {
      saving.value = false
    }
  }

  /**
   * Patching an item can move every item after it, so the endpoint returns the
   * whole recompacted schedule in `meta`. Taking that rather than refetching is
   * what makes ticking a session off feel instant.
   */
  async function patchItem(
    item: ApiScheduleItem,
    body: { state?: ScheduleItemState; scheduled_for?: string },
  ): Promise<void> {
    if (busyItem.value !== null) return
    busyItem.value = item.id

    try {
      const payload = await api.patch<{
        data: ApiScheduleItem
        meta?: { schedule?: ApiSchedule & { data?: ApiSchedule } }
      }>(`/schedule-items/${item.id}`, body, { unwrap: false })

      const nested = payload.meta?.schedule
      const refreshed = nested?.data ?? nested
      if (refreshed) schedule.value = refreshed
      else await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'That change did not stick.')
      await load()
    } finally {
      busyItem.value = null
    }
  }

  function setState(item: ApiScheduleItem, state: ScheduleItemState): void {
    void patchItem(item, { state: item.state === state ? 'pending' : state })
  }

  function moveTo(item: ApiScheduleItem, date: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date === item.scheduled_for) return
    void patchItem(item, { scheduled_for: date })
  }

  /** Pending items whose day has already gone by. */
  const overdue = computed(() => {
    const today = isoToday()
    return items.value.filter(
      (item) => item.state === 'pending' && dayDiff(item.scheduled_for, today) > 0,
    )
  })

  /**
   * The reassurance line. Only speaks up when something actually slipped, and
   * says what the plan did about it rather than how far behind you are.
   */
  const slippage = computed(() => {
    const missed = overdue.value
    if (missed.length === 0) return null

    const today = isoToday()
    const worst = missed.reduce(
      (max, item) => Math.max(max, dayDiff(item.scheduled_for, today)),
      0,
    )

    return {
      count: missed.length,
      days: worst,
      title:
        missed.length === 1
          ? 'One session slipped — no problem.'
          : `${missed.length} sessions slipped — no problem.`,
      body: `Your plan shifted ${worst} ${worst === 1 ? 'day' : 'days'} so you keep ${hoursLabel(
        schedule.value?.minutes_per_week ?? 0,
      )} hrs a week. Nothing was dropped.`,
    }
  })

  /** Minutes completed against the weekly budget, for the "this week" stat. */
  const thisWeek = computed(() => {
    const today = isoToday()
    const start = addDays(today, -(isoWeekday(today) - 1))
    const end = addDays(start, 6)

    const inWeek = items.value.filter(
      (item) =>
        dayDiff(start, item.scheduled_for) >= 0 && dayDiff(item.scheduled_for, end) >= 0,
    )

    return {
      doneMinutes: inWeek
        .filter((item) => item.state === 'done')
        .reduce((sum, item) => sum + item.estimated_minutes, 0),
      budgetMinutes: schedule.value?.minutes_per_week ?? 0,
    }
  })

  return {
    schedule,
    items,
    stats,
    loading,
    loadError,
    saving,
    busyItem,
    overdue,
    slippage,
    thisWeek,
    load,
    savePlan,
    patchItem,
    setState,
    moveTo,
  }
}
