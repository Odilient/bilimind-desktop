import type { WatchSource } from 'vue'

/**
 * A clock that keeps counting between polls.
 *
 * The server says how long something has been running — `writing_for` on a
 * lesson, `pipeline.elapsed` on a course — counted on ITS clock at the moment
 * it answered, so a learner whose own clock is minutes out still sees the
 * right number. Polls arrive every few seconds; in between, this advances the
 * last number it was given once a second, so a stopwatch on screen ticks
 * rather than jumping.
 *
 *   const clock = useStopwatch(() => course.value?.pipeline)
 *   clock.since(course.value?.pipeline?.elapsed)   // 74, 75, 76…
 *
 * `source` is whatever changes when a fresh answer lands; each change moves
 * the anchor to that moment. Ticks only on the client, only while mounted.
 */
export function useStopwatch(source: WatchSource<unknown>) {
  const now = ref(Date.now())
  let anchor = now.value
  let timer: ReturnType<typeof setInterval> | undefined

  watch(source, () => {
    anchor = Date.now()
    now.value = anchor
  })

  onMounted(() => {
    timer = setInterval(() => {
      now.value = Date.now()
    }, 1000)
  })

  onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
  })

  /** A server-counted number of seconds, carried forward to this moment. */
  function since(seconds: number | null | undefined): number | null {
    if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return null
    return Math.max(0, Math.floor(seconds + (now.value - anchor) / 1000))
  }

  return { since, now }
}
