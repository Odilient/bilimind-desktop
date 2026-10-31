/**
 * The device, wired into the app: one call from the companion layout's
 * setup, `usePlatformHooks()`, and the rest follows.
 *
 *  - The tray counts down to the next deadline. It is pushed whenever the
 *    deadlines change, and once a minute, so one that just passed makes way
 *    for the next.
 *  - The capture hotkey and the tray's Capture and Record open the capture
 *    sheet, as ⌥Space in the page does.
 *  - Files dropped on the window are filed where Capture would file them
 *    (the class in progress, the course on screen, or the Notebook) and say
 *    so, as the sheet's own file button does.
 *
 * On the web only the drop does anything; the rest are no-ops there.
 */
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useToast } from '~/composables/useToast'
import { uploadMany, useCapture } from '../capture'
import { useCompanion } from '../store'
import type { Deadline } from '../types'
import type { NextDeadline } from './types'
import { usePlatform } from './use-platform'

/** The soonest deadline still open that hasn't passed; tentative ones count (the tray is a heads-up, not a promise). */
export function nextDeadline(deadlines: Deadline[], now = Date.now()): NextDeadline | null {
  const next = deadlines.find((d) => d.status === 'upcoming' && !!d.due_at && Date.parse(d.due_at) > now)
  return next ? { title: next.title, due_at: next.due_at } : null
}

export function usePlatformHooks(): void {
  const platform = usePlatform()
  const c = useCompanion()
  const capture = useCapture()
  const route = useRoute()

  let sent = ''
  function pushDeadline(): void {
    const next = nextDeadline(c.deadlines.value)
    const key = JSON.stringify(next)
    if (key === sent) return
    sent = key
    platform.setNextDeadline(next)
  }

  // Files dropped on the app go to My notes; the course on screen is only
  // their "Add to …?" suggestion (`capture.ts`), never where they're filed.
  async function fileDropped(files: File[]): Promise<void> {
    const course = route.path.match(/^\/app\/courses\/([^/]+)/)?.[1] ?? null
    await uploadMany(c, files, null, { onScreen: course })
  }

  const stops: Array<() => void> = []
  let minute: ReturnType<typeof setInterval> | undefined

  onMounted(() => {
    stops.push(watch(c.deadlines, pushDeadline, { immediate: true }))
    minute = setInterval(pushDeadline, 60_000)
    stops.push(platform.onCapture((request) => capture.show(request.mode === 'record' ? 'record' : 'menu')))
    stops.push(platform.onFilesDropped((files) => void fileDropped(files)))
  })

  onBeforeUnmount(() => {
    if (minute) clearInterval(minute)
    for (const stop of stops.splice(0)) stop()
    // leaving the app (signing out) leaves no stale countdown in the tray
    platform.setNextDeadline(null)
    sent = ''
  })
}
