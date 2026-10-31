/**
 * "Map this course's topics": a mind map of what has been taught, every node
 * naming where it came from.
 *
 * The real version reads the slides and transcripts on the server
 * (`POST /api/companion/items/{id}/map`, not built yet). The demo builds the
 * map from the rows the course already has, so nothing on it is invented:
 *
 *   branch  a topic a lecture has covered, labelled with the lecture(s): "L6"
 *   leaf    a card written for that topic, labelled with the card's source
 *           quote: "L6 · slides 8–15", "L7 47:05"
 *   flag    the next assessment that covers the topic: "on Quiz 2"
 */
import type { BoardContext } from './context'
import { lectureLabel, pastLectures, shortSource } from './context'
import type { MapNode, MapPlan } from './ops'

const LEAVES_PER_TOPIC = 2

function clip(s: string, n = 42): string {
  const t = s.trim().replace(/\s+/g, ' ')
  return t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`
}

export function planTopicMap(ctx: BoardContext, scope: 'course' | 'deadline'): MapPlan | null {
  const lectures = pastLectures(ctx)
  const scoped = scope === 'deadline' && ctx.deadline ? new Set(ctx.deadline.topic_ids) : null

  // Topics in the order they were taught, each with the lectures that taught it.
  const order: string[] = []
  const taught = new Map<string, typeof lectures>()
  for (const s of lectures) {
    if (!s.topic_id || (scoped && !scoped.has(s.topic_id))) continue
    if (!taught.has(s.topic_id)) {
      taught.set(s.topic_id, [])
      order.push(s.topic_id)
    }
    taught.get(s.topic_id)!.push(s)
  }
  // An assessment can cover a topic whose lecture hasn't happened yet; it still belongs on its map.
  if (scoped) for (const id of scoped) if (!taught.has(id)) { taught.set(id, []); order.push(id) }
  if (!order.length) return null

  const upcoming = ctx.deadlines
    .filter((d) => d.status === 'upcoming' && d.due_at && Date.parse(d.due_at) > ctx.now.getTime())
    .sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!))

  let cardCount = 0
  const branches: MapNode[] = order.map((topicId) => {
    const topic = ctx.topics.find((t) => t.id === topicId)
    const cards = ctx.cards.filter((c) => c.topic_id === topicId && !c.suspended).slice(0, LEAVES_PER_TOPIC)
    cardCount += cards.length
    const on = upcoming.find((d) => d.topic_ids.includes(topicId))
    const leaves: MapNode[] = cards.map((c) => ({ text: clip(c.front), source: shortSource(c.source_quote) }))
    // Without cards, what was filed under the lecture is still a lead.
    if (!leaves.length) {
      for (const s of taught.get(topicId) ?? []) {
        for (const it of ctx.items.filter((i) => i.session_id === s.id && (i.kind === 'page' || i.kind === 'file')).slice(0, 2)) {
          leaves.push({ text: clip(it.title), source: lectureLabel([s]) })
        }
      }
    }
    return {
      text: topic?.title ?? 'Topic',
      source: lectureLabel(taught.get(topicId) ?? []),
      hint: on && on.id !== ctx.deadline?.id ? `on ${on.title}` : undefined,
      children: leaves,
    }
  })

  const nums = lectures.filter((s) => s.topic_id && taught.has(s.topic_id)).map((s) => s.number!).filter(Boolean)
  const span = nums.length ? (Math.min(...nums) === Math.max(...nums) ? `Lecture ${nums[0]}` : `Lectures ${Math.min(...nums)}–${Math.max(...nums)}`) : 'the course'
  const ideas = branches.reduce((n, b) => n + 1 + (b.children?.length ?? 0), 0)
  const lectureCount = new Set(nums).size
  return {
    title: `Mapped ${span}`,
    summary: `${ideas} ideas from ${lectureCount} ${lectureCount === 1 ? 'lecture' : 'lectures'}${cardCount ? ` and ${cardCount} cards` : ''}. Each one names its lecture or slide.`,
    root: {
      text: scoped && ctx.deadline ? ctx.deadline.title : ctx.subject?.title ?? 'This course',
      source: scoped && ctx.deadline?.scope_note ? ctx.deadline.scope_note : undefined,
      children: branches,
    },
  }
}

export type ServerMap = { kind: 'plan'; plan: MapPlan } | { kind: 'soon' } | { kind: 'error'; message: string }

/**
 * Ask the server to map the board's course. The endpoint is planned, not
 * built; a 404 (or 405) means "not yet", which the popover says plainly.
 * Proposed contract: `POST /items/{id}/map { scope }` → `{ data: MapPlan }`.
 */
export async function requestServerMap(itemId: string, scope: 'course' | 'deadline'): Promise<ServerMap> {
  try {
    const plan = await useApi().post<MapPlan>(`/companion/items/${itemId}/map`, { scope })
    return plan?.root ? { kind: 'plan', plan } : { kind: 'soon' }
  } catch (e) {
    const status = (e as { status?: number }).status
    if (status === 404 || status === 405 || status === 501) return { kind: 'soon' }
    return { kind: 'error', message: (e as Error).message || 'The map could not be made.' }
  }
}
