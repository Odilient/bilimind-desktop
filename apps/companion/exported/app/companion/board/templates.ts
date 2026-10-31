/**
 * Board templates, filled from the board's context rather than with
 * placeholders: a revision map already has the assessment's topics on it, a
 * concept map the course's taught topics, a kanban the project's due date.
 * README §5: "neither starts empty".
 *
 * A template writes straight into a fresh Y.Doc (`buildBoard`), which is then
 * seeded to the device and the server before the board first opens.
 */
import * as Y from 'yjs'
import type { BoardContext } from './context'
import { lectureLabel, pastLectures, weekdayName } from './context'
import { addObjects, boardParts, newId, writeMeta, type BoardObject, type ConnectorObj, type ShapeObj, type StickyObj } from './model'
import { addMindChild, newMindRoot, relayout } from './ops'
import { courseHex } from './palette'
import { pageHeight, stickyHeight } from './draw'

export const TEMPLATES = ['revision', 'concept', 'kanban', 'blank'] as const
export type TemplateName = (typeof TEMPLATES)[number]

export const TEMPLATE_LABEL: Record<TemplateName, string> = {
  revision: 'Revision map',
  concept: 'Concept map',
  kanban: 'Group project',
  blank: 'Blank board',
}

function sticky(x: number, y: number, text: string, color: StickyObj['color'], by?: string, z = 1): StickyObj {
  const o: StickyObj = { id: newId(), kind: 'sticky', x, y, w: 180, h: 0, z, text, color, by }
  o.h = stickyHeight(o)
  return o
}

function frame(x: number, y: number, w: number, h: number, title: string): BoardObject {
  return { id: newId(), kind: 'frame', x, y, w, h, z: 0, title }
}

function dueLabel(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

export function templateTitle(name: TemplateName, ctx: BoardContext): string {
  if (name === 'revision') return ctx.deadline ? `${ctx.deadline.title} revision map` : 'Revision map'
  if (name === 'concept') return ctx.subject ? `${ctx.subject.title} concept map` : 'Concept map'
  if (name === 'kanban') return ctx.deadline ? `${ctx.deadline.title} board` : 'Group project board'
  return 'Untitled board'
}

/** A new board's doc, laid out around the origin. */
export function buildBoard(name: TemplateName, ctx: BoardContext): Y.Doc {
  const doc = new Y.Doc()
  const parts = boardParts(doc)
  const color = courseHex(ctx.subject?.color)
  const title = templateTitle(name, ctx)
  writeMeta(parts, { title, template: name, subject_id: ctx.subject?.id ?? null, deadline_id: ctx.deadline?.id ?? null, color })

  if (name === 'revision') {
    const d = ctx.deadline
    // Frame one: what's on it, as a map rooted at the assessment.
    const what = frame(0, 0, 760, 420, d ? `${d.title} · what's on it` : 'What\'s on it')
    addObjects(parts, [what])
    const rootId = newMindRoot(parts, { x: 380, y: 210 }, d?.title ?? 'The assessment', color, { source: d?.scope_note ?? undefined })
    const lectures = pastLectures(ctx)
    for (const topicId of d?.topic_ids ?? []) {
      const topic = ctx.topics.find((t) => t.id === topicId)
      if (!topic) continue
      addMindChild(parts, rootId, topic.title, { source: lectureLabel(lectures.filter((s) => s.topic_id === topicId)) })
    }
    relayout(parts, rootId)
    const whatNow = parts.objects.get(what.id)!.toJSON() as BoardObject
    // Frame two: the group's questions, named for the day it's due.
    const qx = whatNow.x + whatNow.w + 48
    addObjects(parts, [frame(qx, whatNow.y, 400, 300, d?.due_at ? `Questions for ${weekdayName(d.due_at)}` : 'Questions')])
    // The pages already written on these topics sit beside the map.
    const pages = ctx.items
      .filter((i) => i.kind === 'page' && (d?.topic_ids.includes(i.topic_id ?? '') || ctx.sessions.some((s) => s.id === i.session_id && d?.topic_ids.includes(s.topic_id ?? ''))))
      .slice(0, 2)
    pages.forEach((p, i) => {
      const card = { id: newId(), kind: 'page' as const, x: qx + i * 204, y: whatNow.y + 340, w: 190, h: 0, z: 2, item_id: p.id, title: p.title, preview: p.preview ?? '' }
      card.h = pageHeight(card)
      addObjects(parts, [card])
    })
  }

  if (name === 'concept') {
    const topics = pastLectures(ctx)
      .map((s) => ctx.topics.find((t) => t.id === s.topic_id))
      .filter((t, i, a): t is NonNullable<typeof t> => !!t && a.findIndex((x) => x?.id === t.id) === i)
      .slice(-6)
    const labels = topics.length ? topics.map((t) => t.title) : ['Concept', 'Concept', 'Concept', 'Concept']
    const centre: ShapeObj = { id: newId(), kind: 'shape', shape: 'ellipse', x: -110, y: -55, w: 220, h: 110, z: 1, text: ctx.subject?.title ?? 'Main idea', fill: 'blue', stroke: 'cobalt' }
    const list: BoardObject[] = [centre]
    labels.forEach((text, i) => {
      const a = (i / labels.length) * Math.PI * 2 - Math.PI / 2
      const box: ShapeObj = { id: newId(), kind: 'shape', shape: 'rect', x: Math.cos(a) * 380 - 90, y: Math.sin(a) * 250 - 36, w: 180, h: 72, z: 1, text, fill: 'white', stroke: 'ink' }
      const link: ConnectorObj = { id: newId(), kind: 'connector', x: 0, y: 0, w: 0, h: 0, z: 0, from: { id: centre.id }, to: { id: box.id } }
      list.push(box, link)
    })
    addObjects(parts, list)
  }

  if (name === 'kanban') {
    const d = ctx.deadline
    const cols = ['To do', 'Doing', 'Done']
    const list: BoardObject[] = cols.map((t, i) => frame(i * 352, 0, 320, 540, t))
    let y = 24
    const add = (text: string, color: StickyObj['color']) => {
      const s = sticky(24, y, text, color, undefined, 2)
      s.w = 272
      s.h = stickyHeight(s)
      list.push(s)
      y += s.h + 16
    }
    if (d) add(`${d.title} due ${dueLabel(d.due_at)}${d.scope_note ? ` · ${d.scope_note}` : ''}`, 'pink')
    add('Split the work: who does which part', 'yellow')
    add('Agree when drafts are due to each other', 'yellow')
    addObjects(parts, list)
  }

  return doc
}

/** A mind map written out ahead, as the starter kit's board carries it (`meta.seed_mind`). */
export interface SeedMind {
  root: string
  branches: { text: string; children?: string[] }[]
}

/**
 * The first content of a board that exists as an item but was never opened
 * (made elsewhere, or seeded): its template if it has one, else a mind map:
 * the one written out in `meta.seed_mind` (the starter kit's), or a root
 * named for the board, so it opens on what it's for, not on nothing.
 */
export function buildStarter(
  item: { title: string; meta: { template?: string; seed_mind?: SeedMind } },
  ctx: BoardContext,
): Y.Doc {
  const name = (TEMPLATES as readonly string[]).includes(item.meta.template ?? '') ? (item.meta.template as TemplateName) : null
  const doc = buildBoard(name ?? 'blank', ctx)
  const parts = boardParts(doc)
  if (!name) {
    const mind = item.meta.seed_mind
    const root = newMindRoot(parts, { x: 0, y: 0 }, mind?.root ?? item.title, courseHex(ctx.subject?.color))
    for (const branch of mind?.branches ?? []) {
      const id = addMindChild(parts, root, branch.text)
      for (const text of branch.children ?? []) if (id) addMindChild(parts, id, text)
    }
  }
  writeMeta(parts, { title: item.title })
  return doc
}
