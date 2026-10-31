/**
 * Types out text that arrives in chunks, so a poll's worth of words reads as
 * writing and not as a paragraph landing every second. Each new chunk is spread
 * over about the time until the next one (`frames`, at 60 a second).
 *
 * `source` must only ever grow; anything else starts again from nothing.
 */
export function useTypedText(source: () => string, frames = 70) {
  const shown = ref('')
  let step = 1
  let frame = 0

  function pump(): void {
    frame = 0
    const full = source()
    if (shown.value.length >= full.length) return
    shown.value = full.slice(0, shown.value.length + step)
    frame = requestAnimationFrame(pump)
  }

  watch(
    source,
    (full) => {
      if (!import.meta.client || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        shown.value = full
        return
      }
      if (!full.startsWith(shown.value)) shown.value = ''
      step = Math.max(1, Math.ceil((full.length - shown.value.length) / frames))
      if (!frame) frame = requestAnimationFrame(pump)
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    if (frame) cancelAnimationFrame(frame)
  })

  return shown
}
