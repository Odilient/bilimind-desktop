/**
 * A course made by hand, with no AI ("Start from scratch" on Courses): a name,
 * its picture and colour, and the topics typed one per line. It becomes the
 * same `CourseProposal` the chat drafts, so `createLocally` makes the rows the
 * one way it always does, and the course is a path like any other.
 */
import type { CourseProposal } from './create'

/**
 * The topics, one per line. A line that starts with "#" or ends with ":"
 * opens a unit and the lines under it are its topics; lines before the first
 * unit belong to none (a unit with no title, which `createLocally` puts on the
 * path on its own). List marks people paste with ("-", "•", "1.") are dropped.
 */
export function parseTopics(text: string): CourseProposal['units'] {
  const units: CourseProposal['units'] = []
  for (const raw of text.split('\n')) {
    const line = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()
    if (!line) continue
    const unit = (/^#+\s*(.+)$/.exec(line)?.[1] ?? /^(.+?)\s*:$/.exec(line)?.[1])?.replace(/\s*:$/, '')
    if (unit) {
      units.push({ title: unit.trim(), topics: [] })
      continue
    }
    if (!units.length) units.push({ title: '', topics: [] })
    units.at(-1)!.topics.push({ title: line })
  }
  return units
}

export interface ScratchDraft {
  title: string
  topics: string
  color: string
  icon: string | null
  /** `YYYY-MM-DD`, or empty for no finish line. */
  finish: string
}

export function scratchProposal(draft: ScratchDraft): CourseProposal {
  return {
    title: draft.title.replace(/\s+/g, ' ').trim() || 'New course',
    kind: 'self',
    summary: '',
    finish: draft.finish
      ? { kind: 'date', label: '', date: draft.finish }
      : { kind: 'none', label: '', date: null },
    minutes_per_week: null,
    color: draft.color,
    icon: draft.icon,
    units: parseTopics(draft.topics),
    deadlines: [],
    sources: [],
  }
}
