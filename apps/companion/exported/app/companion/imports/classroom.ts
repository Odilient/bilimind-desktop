/**
 * Google Classroom (Daylight 2, gaps; landing 10 Connections: "Assignments and
 * due dates from every class you're in"). Each class becomes a course and each
 * piece of work with a due date an official deadline, read again every hour
 * (backend Imports\ClassroomImport). Read-only: nothing is sent to Classroom.
 *
 *   classroomStatus()   → { available, connected, courses, last_synced_at, error }
 *   connectClassroom()  off to Google's consent screen; back on Settings → Integrations, ?classroom=connected|failed
 *   syncClassroom()     "Sync now"
 *
 * `available` is false until the server has a Google client with the two
 * Classroom scopes verified (see docs/design/daylight2/GAPS.md); hide the
 * door then. Hidden in the desktop and phone apps like Drive (Google refuses
 * sign-in in embedded webviews); the web app's connect works for all three
 * because the tokens live on the server.
 */
import { useApi } from '~/composables/useApi'
import type { CompanionStore } from '../store'

export interface ClassroomStatus {
  available: boolean
  connected: boolean
  courses: number
  last_synced_at: string | null
  error: string | null
}

export async function classroomStatus(): Promise<ClassroomStatus> {
  return useApi().get<ClassroomStatus>('/companion/imports/classroom')
}

export async function connectClassroom(): Promise<void> {
  const { url } = await useApi().post<{ url: string }>('/companion/imports/classroom/connect')
  window.location.assign(url)
}

export async function syncClassroom(store: CompanionStore): Promise<{ courses: number; deadlines: number; moved: number }> {
  const counts = await useApi().post<{ courses: number; deadlines: number; moved: number }>(
    '/companion/imports/classroom/sync',
    undefined,
    { timeout: 60_000 },
  )
  await store.sync()
  return counts
}

/** "3 classes, 12 dates in", "Already up to date". */
export function classroomWords(counts: { courses: number; deadlines: number; moved: number }): string {
  if (!counts.deadlines && !counts.moved) return `Already up to date: ${counts.courses} ${counts.courses === 1 ? 'class' : 'classes'} checked`
  const parts = [`${counts.courses} ${counts.courses === 1 ? 'class' : 'classes'}`]
  if (counts.deadlines) parts.push(`${counts.deadlines} new ${counts.deadlines === 1 ? 'date' : 'dates'}`)
  if (counts.moved) parts.push(`${counts.moved} moved`)
  return parts.join(', ')
}
