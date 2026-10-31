/**
 * The bridge from a companion course to the old product's written lessons.
 *
 * A companion course (a `Subject`) and its topics are the learner's own map;
 * the lessons themselves are the old generator's `courses` and `nodes`, with
 * every interactive block and the markup tools that come with them. Two
 * columns join the two worlds: `subjects.generated_course_id` and
 * `topics.node_id`. This file is the only place a screen crosses that bridge.
 *
 * - `useLessonCourse(subject)` is the old `Course` (with its nodes) behind a
 *   companion course, or null when nothing has been written for it yet. It
 *   speaks the old `GET /courses/{id}`, so the roadmap and NodeView get exactly
 *   the shapes they were built for. The copy is the store's
 *   (`store.lessonCourses`), shared by every screen: `refresh()` after a
 *   lesson changes is seen everywhere, its progress included.
 * - `writeLesson(topic)` has one topic's lesson written. The server mirrors the
 *   course's topics into an old course the first time (no model involved), and
 *   the lesson is then asked for through the old expand endpoint, so the cap,
 *   the charge and the queue behave as they do everywhere else.
 *
 * In demo mode the same calls answer from `demo-lessons.ts`: `useApi` hands any
 * request for a demo id to it, so NodeView reads them like any other lesson.
 */
import type { Course } from '~/types/api'
import { ApiError, useApi } from '~/composables/useApi'
import type { Subject, Topic } from './types'
import { useCompanion } from './store'

const DEMO_UNWRITTEN =
  'The sample account has only a few lessons written. With your own, this one is written for you.'

/** What `POST /companion/topics/{id}/lesson` answers. */
export interface LessonBridge {
  course_id: number
  node_id: number
  node_status: string
}

/** The written course behind a companion course, reloaded when the bridge changes. */
export function useLessonCourse(subject: MaybeRefOrGetter<Subject | null>) {
  const store = useCompanion()
  const courseId = computed(() => toValue(subject)?.generated_course_id ?? null)
  const course = computed<Course | null>(() => (courseId.value ? (store.lessonCourses[courseId.value] ?? null) : null))

  async function refresh(): Promise<void> {
    if (courseId.value) await store.refreshLessons(courseId.value)
  }

  if (import.meta.client) watch(courseId, () => void refresh(), { immediate: true })

  return { course, refresh }
}

/**
 * Have one topic's lesson written; resolves to the node id to open, or null
 * when it cannot be (a lesson the demo does not have, or the server refused,
 * either said in a toast). A topic whose lesson already exists or is on its
 * way answers with its node at once and spends nothing. `instruction` is how
 * the learner wants it written; it reaches the writer's prompt.
 */
export async function writeLesson(topic: Topic, instruction?: string | null): Promise<number | null> {
  const store = useCompanion()
  const toast = useToast()

  // The demo writes nothing: a lesson it has is opened, any other is explained.
  if (store.status.mode === 'demo') {
    const { demoLessonWritten } = await import('./demo-lessons')
    if (topic.node_id && demoLessonWritten(topic.node_id)) return topic.node_id
    toast.push(DEMO_UNWRITTEN)
    return null
  }

  const api = useApi()
  try {
    const bridge = await api.post<LessonBridge>(`/companion/topics/${topic.id}/lesson`)
    // The bridge is a synced write; show it now rather than at the next pull.
    const row = store.rows.topics[topic.id]
    if (row) row.node_id = bridge.node_id
    const subject = store.rows.subjects[topic.subject_id]
    if (subject) subject.generated_course_id = bridge.course_id

    if (bridge.node_status === 'stub' || bridge.node_status === 'failed') {
      await api.post(`/courses/${bridge.course_id}/expand`, { node_ids: [bridge.node_id], instruction: instruction?.trim() || null })
    }
    void store.sync()
    return bridge.node_id
  } catch (error) {
    toast.push(error instanceof ApiError ? error.message : 'The lesson could not be asked for.')
    return null
  }
}
