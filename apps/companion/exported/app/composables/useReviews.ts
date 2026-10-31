/**
 * The review queue — the second half of the product thesis.
 *
 * A course walks a learner forward through new material; this brings finished
 * lessons back on an expanding cadence so they actually stick. The backend
 * (BILLING §2) runs the SM-2 schedule; this composable is the thin client over
 * its three endpoints:
 *
 *   GET  /reviews/today  — the lessons due now (today or slipped), each with its
 *                          node + course so a card renders without a second call
 *   GET  /reviews/stats  — how big the queue is and whether the habit is alive
 *   POST /reviews        — record how well a lesson was remembered and reschedule
 *
 * The learner never sees "SRS", "due items", "quality" or "ease factor". They
 * see lessons to review and four honest buttons about how it went. Everything
 * clinical stays in here.
 */

import { ApiError } from '~/composables/useApi'

/* -------------------------------------------------------------------------- */
/* Wire shapes (App\Http\Resources\ReviewItemResource + ReviewController)      */
/* -------------------------------------------------------------------------- */

/** Compact node payload carried by a review item. */
export interface ReviewNode {
  id: number
  course_id: number
  key: string
  title: string
  summary: string | null
  layer: number
  position: number
  estimated_minutes: number
  status: string
  status_label: string
}

/** The course a review item belongs to. */
export interface ReviewCourse {
  id: number
  title: string
  language: string
  status: string
  status_label: string
}

/** One lesson waiting to be reviewed. */
export interface ReviewItem {
  id: number
  user_id: number
  course_id: number
  node_id: number
  state: string
  ease_factor: number
  interval_days: number
  repetitions: number
  lapses: number
  due_on: string | null
  is_due: boolean
  is_overdue: boolean
  days_late: number
  days_until: number
  last_reviewed_at: string | null
  node?: ReviewNode | null
  course?: ReviewCourse | null
  created_at?: string
  updated_at?: string
}

/** `meta` on `GET /reviews/today`. */
export interface ReviewTodayMeta {
  date: string
  due: number
  minutes: number
}

/** The review habit's pulse. */
export interface ReviewStreak {
  current: number
  active_today: boolean
  last_reviewed_on: string | null
}

/** `data` on `GET /reviews/stats`. */
export interface ReviewStats {
  date: string
  total: number
  due: number
  due_today: number
  overdue: number
  upcoming: number
  learning: number
  mastering: number
  streak: ReviewStreak
}

/** `meta` on `POST /reviews`. */
export interface ReviewSubmitMeta {
  quality: number
  next_due_on: string | null
  interval_days: number
  remaining_due: number
}

/* -------------------------------------------------------------------------- */
/* Recall grades — the learner's vocabulary, mapped to SM-2 quality            */
/* -------------------------------------------------------------------------- */

/** How well did you remember this? Four honest answers, no jargon. */
export type Recall = 'again' | 'hard' | 'good' | 'easy'

/** Recall → SM-2 quality (0-5). Again is a lapse; Easy is a confident pass. */
export const RECALL_QUALITY: Record<Recall, number> = {
  again: 1,
  hard: 3,
  good: 4,
  easy: 5,
}

/** The button copy, in order, for the recall row. */
export const RECALL_OPTIONS: ReadonlyArray<{ value: Recall; label: string; hint: string }> = [
  { value: 'again', label: 'Again', hint: 'Blanked on it' },
  { value: 'hard', label: 'Hard', hint: 'Came back slowly' },
  { value: 'good', label: 'Good', hint: 'Remembered it' },
  { value: 'easy', label: 'Easy', hint: 'Knew it cold' },
]

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export function useReviews() {
  const api = useApi()

  const due = ref<ReviewItem[]>([])
  const meta = ref<ReviewTodayMeta | null>(null)
  const stats = ref<ReviewStats | null>(null)

  const loading = ref(false)
  const submitting = ref(false)
  const loadError = ref<string | null>(null)

  const dueCount = computed(() => meta.value?.due ?? due.value.length)
  const minutes = computed(() => meta.value?.minutes ?? 0)
  const streak = computed(() => stats.value?.streak.current ?? 0)

  /** Fetch the lessons due now. `unwrap:false` keeps `meta` alongside `data`. */
  async function loadToday(): Promise<void> {
    loading.value = true
    try {
      const payload = await api.get<{ data: ReviewItem[]; meta: ReviewTodayMeta }>(
        '/reviews/today',
        { unwrap: false },
      )
      due.value = payload.data ?? []
      meta.value = payload.meta ?? null
      loadError.value = null
    } catch (error) {
      loadError.value =
        error instanceof ApiError ? error.message : 'Could not load your reviews right now.'
    } finally {
      loading.value = false
    }
  }

  /** Fetch counts + streak. Decorative next to the queue, so a failure is quiet. */
  async function loadStats(): Promise<void> {
    try {
      stats.value = await api.get<ReviewStats>('/reviews/stats')
    } catch {
      // The queue itself still works without its stats; leave `stats` as-is.
    }
  }

  /**
   * Record how well a lesson was remembered and let the backend reschedule it.
   * Returns the post-review meta (next due date, remaining count) so the caller
   * can advance, or throws an `ApiError` the page can surface.
   */
  async function submit(nodeId: number, recall: Recall): Promise<ReviewSubmitMeta | null> {
    submitting.value = true
    try {
      const payload = await api.post<{ data: ReviewItem; meta: ReviewSubmitMeta }>(
        '/reviews',
        { node_id: nodeId, quality: RECALL_QUALITY[recall] },
        { unwrap: false },
      )
      return payload.meta ?? null
    } finally {
      submitting.value = false
    }
  }

  return {
    due,
    meta,
    stats,
    loading,
    submitting,
    loadError,
    dueCount,
    minutes,
    streak,
    loadToday,
    loadStats,
    submit,
  }
}
