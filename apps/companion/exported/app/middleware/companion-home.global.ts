/**
 * The companion is the product now, so the old
 * signed-in pages hand over to it instead of living on beside it. Without this
 * every habit and every old link (the rail's Today, "Create a course", a
 * bookmarked draft) still lands on the course generator and the new app is
 * only reachable by typing /app.
 *
 * Making a course happens in the chat now (`/app/chat?intent=course`), so
 * every way that used to lead to the course maker leads there, with what it
 * carried: a sentence from the landing's hero (`?topic=`, `?goal=`) becomes
 * the chat's `prompt`, a "Connect your school" flow (`?connect=`, the old
 * `/app/start?via=` and `#ics`) is kept. The old Ask page is the chat too:
 * `/app/ask?thread=X` is `/app/chat/X`.
 *
 * Public pages (landing, /learn, roadmaps, a published course) are untouched.
 */
import { CHAT_PATH, chatPath } from '~/companion/ai/routes'

const MOVED: Record<string, string> = {
  '/today': '/app',
  '/library': '/app/courses',
  '/review': '/app/practice',
  '/materials': '/app/notes',
}

const CONNECTS = ['moodle', 'ics', 'email', 'photo']

function one(value: unknown): string {
  const v = Array.isArray(value) ? value[0] : value
  return typeof v === 'string' ? v.trim() : ''
}

export default defineNuxtRouteMiddleware((to) => {
  const path = to.path.replace(/\/+$/, '') || '/'
  const topic = one(to.query.topic)

  // A sentence carried in from the landing (or a bounced `/start?topic=`).
  if (path === '/app' && topic) {
    return navigateTo({ path: CHAT_PATH, query: { intent: 'course', prompt: topic } }, { replace: true })
  }

  // The course maker, old and older: a new chat in course mode.
  if (path === '/create' || path.startsWith('/create/') || path === '/app/new' || path === '/app/start') {
    const query: Record<string, string> = { intent: 'course' }
    const goal = one(to.query.goal) || topic
    if (goal) query.prompt = goal
    const connect = one(to.query.connect) || one(to.query.via) || (to.hash === '#ics' ? 'ics' : '')
    if (CONNECTS.includes(connect)) query.connect = connect
    return navigateTo({ path: CHAT_PATH, query }, { replace: true })
  }

  // The old Ask page.
  if (path === '/app/ask') {
    const thread = one(to.query.thread)
    const q = one(to.query.q)
    return navigateTo({ path: chatPath(thread || null), query: q ? { q } : {} }, { replace: true })
  }

  const moved = MOVED[path]
  if (moved) return navigateTo(moved, { replace: true })
})
