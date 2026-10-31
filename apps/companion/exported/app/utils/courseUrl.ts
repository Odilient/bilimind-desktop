import type { Course, CourseNode, CourseSummary } from '~/types/api'

/**
 * Where a course lives.
 *
 * Every link to a course goes through here rather than interpolating a path at
 * the call site, because there are two shapes in play: the canonical
 * `/{username}/{course-slug}`, and the old `/courses/{id}` that still has to
 * work for a row created before slugs existed. One helper means one place
 * decides, and one place to delete the fallback from once the fallback is dead.
 *
 * A lesson is a query on the course, not a path of its own — the workspace
 * shows lessons as tabs, so a lesson is a thing the course page is *focused on*
 * rather than a separate page. `?node=` carries the node's key, the stable slug
 * the outline gave it, which survives a regeneration that renumbers ids.
 */

type CourseLike = Pick<CourseSummary, 'id' | 'path'> & Partial<Pick<CourseSummary, 'slug'>>

export function courseUrl(course: CourseLike | null | undefined): string {
  if (!course) return '/library'

  return course.path ?? `/courses/${course.id}`
}

/**
 * The course URL focused on one lesson. Accepts the node itself, or its key —
 * callers holding only an id (an old link, a schedule row) should resolve it
 * against the course's node list first, which is what `nodeKeyById` is for.
 */
export function nodeUrl(
  course: CourseLike | null | undefined,
  node: Pick<CourseNode, 'key'> | string | null | undefined,
): string {
  const base = courseUrl(course)
  const key = typeof node === 'string' ? node : node?.key

  return key ? `${base}?node=${encodeURIComponent(key)}` : base
}

/**
 * Node key for a numeric id, for the call sites that still only have one:
 * `schedule_items.node_id`, review items, and the today screen.
 */
export function nodeKeyById(
  nodes: Pick<CourseNode, 'id' | 'key'>[] | undefined,
  nodeId: number | null | undefined,
): string | null {
  if (!nodeId) return null

  return nodes?.find((node) => node.id === nodeId)?.key ?? null
}

/**
 * Reverse of the above: what `?node=` resolves to inside the workspace.
 *
 * Accepts a numeric id as well as a key, so links minted before this change —
 * `?node=214`, still sitting in notifications and bookmarks — keep landing on
 * the right lesson instead of being silently ignored.
 */
export function findNode<T extends Pick<CourseNode, 'id' | 'key'>>(
  nodes: T[] | undefined,
  requested: string | null | undefined,
): T | null {
  if (!requested || !nodes?.length) return null

  const byKey = nodes.find((node) => node.key === requested)
  if (byKey) return byKey

  const id = Number(requested)

  return Number.isFinite(id) && id > 0 ? (nodes.find((node) => node.id === id) ?? null) : null
}

/** Reads `?node=` off a route query, which may be a string or an array. */
export function requestedNodeKey(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value

  return typeof raw === 'string' && raw !== '' ? raw : null
}

/** Convenience for `Course` payloads, which always carry their node list. */
export function courseNodeUrl(course: Course | null | undefined, nodeId: number): string {
  return nodeUrl(course, nodeKeyById(course?.nodes, nodeId))
}
