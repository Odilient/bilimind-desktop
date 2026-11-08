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
 * - `lessonToWrite(topic)` is the same node for the learner to write by hand.
 * - `writeLesson(topic)` has one topic's lesson written. The server mirrors the
 *   course's topics into an old course the first time (no model involved), and
 *   the lesson is then asked for through the old expand endpoint, so the cap,
 *   the charge and the queue behave as they do everywhere else.
 */
import type { Course } from '~/types/api'
import { ApiError, useApi } from '~/composables/useApi'
import type { Subject, Topic } from './types'
import { useCompanion } from './store'
import { outOfAi, toastOutOfAi } from './usage'
import { translate } from '~/utils/i18n'

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
 * when it cannot be (the server refused, said in a toast). A topic whose lesson already exists or is on its
 * way answers with its node at once and spends nothing. `instruction` is how
 * the learner wants it written; it reaches the writer's prompt. A lesson
 * already written is rewritten when there is an instruction or `rewrite`.
 */
export async function writeLesson(topic: Topic, instruction?: string | null, rewrite = false): Promise<number | null> {
  const store = useCompanion()
  const toast = useToast()

  const api = useApi()
  try {
    const bridge = await bridgeLesson(topic)

    // A class run by a centre: the course is the teacher's (read-only here), so is writing its lessons.
    if (!(bridge.course_id in store.lessonCourses)) await store.refreshLessons(bridge.course_id)
    if (store.lessonCourses[bridge.course_id]?.can_edit === false) {
      if (bridge.node_status !== 'ready') toast.push('Your teacher hasn’t written this lesson yet.')
      return bridge.node_status === 'ready' ? bridge.node_id : null
    }

    if (bridge.node_status === 'stub' || bridge.node_status === 'failed') {
      await api.post(`/courses/${bridge.course_id}/expand`, { node_ids: [bridge.node_id], instruction: instruction?.trim() || null })
    } else if (bridge.node_status === 'ready' && (rewrite || instruction?.trim())) {
      // A written lesson asked for again ("make it simpler") is rewritten, not just
      // reopened: before this the card said "on its way" and nothing was queued.
      try {
        await api.post(`/nodes/${bridge.node_id}/regenerate`, { instruction: instruction?.trim() || null })
      } catch (error) {
        // 409: it is being written already, which is what was asked.
        if (!(error instanceof ApiError && error.status === 409)) throw error
      }
    }
    void store.sync()
    return bridge.node_id
  } catch (error) {
    // Out of AI: the reason with the ways forward, the same everywhere.
    const limited = outOfAi(error)
    if (limited) toastOutOfAi(limited)
    else toast.push(error instanceof ApiError ? error.message : translate('check.lessons.cantAsk'))
    return null
  }
}

/** The topic's node, made (no model involved) if it is missing. */
async function bridgeLesson(topic: Topic): Promise<LessonBridge> {
  const store = useCompanion()
  const bridge = await useApi().post<LessonBridge>(`/companion/topics/${topic.id}/lesson`)
  // The bridge is a synced write; show it now rather than at the next pull.
  const row = store.rows.topics[topic.id]
  if (row) row.node_id = bridge.node_id
  const subject = store.rows.subjects[topic.subject_id]
  if (subject) subject.generated_course_id = bridge.course_id
  return bridge
}

/**
 * A topic's lesson for the learner to write themselves: its node, bridged and
 * never expanded, so no model runs and nothing is spent (works on Free with no
 * AI). Resolves to null when it cannot be, said in a toast.
 */
export async function lessonToWrite(topic: Topic): Promise<LessonBridge | null> {
  const store = useCompanion()
  const toast = useToast()
  try {
    const bridge = await bridgeLesson(topic)
    void store.sync()
    return bridge
  } catch (error) {
    toast.push(error instanceof ApiError ? error.message : translate('check.lessons.cantOpen'))
    return null
  }
}
