import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type { CourseNode, FurtherCourse, LessonMark, LessonTrack, ProgressState } from '~/types/api'

/**
 * The roadmap — roadmap.sh's grammar, applied to a generated course.
 *
 * roadmap.sh draws a subject as ONE solid line with the TOPICS on it, and beside
 * each topic, tied to it with dotted lines, everything that topic covers. Every
 * kind of box on that page has a meaning the reader learns in a minute. We keep
 * the grammar and draw it in the workspace's own ink (see `RoadmapBoard.vue`):
 *
 *  - a TOPIC: a dark milestone on the line, numbered by its place on it;
 *  - a SUBTOPIC: a light card tied to its topic by a dotted curve, with a small
 *    coloured badge in its corner when it is an option (violet: our pick;
 *    green: pick this or the violet one; grey: learn anytime);
 *  - a GROUP: a sunken panel with a heading that gathers the subtopics that
 *    are one family — "API styles", "Authentication";
 *  - a FAMILY: a subtopic that owns subtopics of its own — "Hashing
 *    algorithms" → MD5, SHA, bcrypt — drawn as the subtopic on top of a panel
 *    holding its members. One level, never more;
 *  - a NOTE: a sentence of advice beside a topic — "learn one language and
 *    build things before moving on";
 *  - a LINK: a soft violet button pointing at another roadmap. Ours point at a
 *    new course to create;
 *  - a LABEL: a chapter heading sitting on the line itself;
 *  - the title with its dotted lead-in, and the dotted tail. The legend lives
 *    in the board's own header bar, not on the canvas.
 *
 * This file lays all of that out: `courseTree()` reads the shape out of a flat
 * node list, and `useRoadmap()` turns the shape into boxes, ties and a spine
 * with pixel coordinates. `RoadmapBoard.vue` only draws what it is handed.
 *
 * Deliberately pure and synchronous so the roadmap renders identically during
 * SSR and on the client; nothing here touches the DOM. Box heights are
 * therefore predicted from a character-count wrap rather than measured — which
 * is why anything rendering these labels must clamp to the same line count.
 */

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                 */
/* -------------------------------------------------------------------------- */

export interface MarkMeta {
  label: string
  /** The legend line on the map: a few words, one line. */
  short: string
  /** What the badge asks of the learner, in a sentence, for tooltips and sheets. */
  blurb: string
  /**
   * The badge colour, as a CSS value. Cobalt's legend: recommended is the lime
   * the rest of the app uses for "do this now", alternative is the brand's
   * cobalt, anytime a quiet blue-grey.
   */
  color: string
  /** The check drawn on the badge: ink on the amber, white on the other two. */
  ink: string
}

/**
 * One vocabulary for the three badges, shared by the board, the list, the legend.
 * Never blue or lime: on the board those say "done" and "here", and a blue check
 * on a lesson nobody has opened reads as finished.
 */
export const MARK_META: Record<LessonMark, MarkMeta> = {
  recommended: {
    label: 'Recommended',
    short: 'our pick',
    blurb: 'Our pick — do this one.',
    // Daylight 2's badges (course/data.js BADGE): leaf, apricot, sky.
    color: 'var(--leaf)',
    ink: '#fff',
  },
  alternative: {
    label: 'Alternative',
    short: 'pick this or our pick',
    blurb: 'Pick this or the recommended one, not both.',
    color: 'var(--apricot)',
    ink: '#fff',
  },
  anytime: {
    label: 'Learn anytime',
    short: 'order not strict',
    blurb: 'Order not strict. Come back to it whenever.',
    color: 'var(--sky)',
    ink: '#fff',
  },
}

/** The order the legend lists the badges in — roadmap.sh's. */
export const MARK_ORDER: LessonMark[] = ['recommended', 'alternative', 'anytime']

/** What each track means, for the places that say it in words. */
export const TRACK_META = {
  core: { label: 'On the path', blurb: 'Follow these in order — each one is assumed by the next.' },
  subtopic: { label: 'Under this step', blurb: 'What a step covers. Tied to it with a dotted line.' },
} as const

/** The two fields that place a lesson; a node brief carries them as well as a full node. */
export interface Placed {
  track?: LessonTrack | null
  mark?: LessonMark | null
}

/**
 * Nodes written before the roadmap had this grammar still arrive on the two
 * retired tracks; both meant "hangs off a step".
 */
export function lessonTrack(node: Placed): 'core' | 'subtopic' {
  const track = node.track ?? 'core'
  return track === 'core' ? 'core' : 'subtopic'
}

/** The badge, reading the retired tracks as the badge they implied. */
export function lessonMark(node: Placed): LessonMark | null {
  if (node.mark) return node.mark
  if (node.track === 'recommended') return 'recommended'
  if (node.track === 'optional') return 'anytime'
  return null
}

/** roadmap.sh's four progress states, from ours. `null` is pending. */
export function progressOf(node: CourseNode): Exclude<ProgressState, 'available'> | null {
  const state = node.progress?.state
  return state === 'completed' || state === 'in_progress' || state === 'skipped' ? state : null
}

/**
 * Reading order for a course: step, then what hangs off that step. Legacy
 * courses — every node `core`, several sharing a `layer` — fall out of this as
 * one long line, which is exactly what they are.
 */
export function orderedLessons(nodes: CourseNode[]): CourseNode[] {
  return [...nodes].sort((a, b) => a.layer - b.layer || a.position - b.position || a.id - b.id)
}

/* -------------------------------------------------------------------------- */
/* The tree                                                                   */
/* -------------------------------------------------------------------------- */

/** A subtopic, with the subtopics it owns (one level; a child's `children` is always empty). */
export interface TreeItem {
  node: CourseNode
  depth: 1 | 2
  children: TreeItem[]
}

/** A topic on the spine, numbered, with everything hanging off it. */
export interface TreeStep {
  node: CourseNode
  /** 1-based place on the line. */
  step: number
  items: TreeItem[]
  /** The chapter this topic opens, or null when it continues the one above. */
  opens: string | null
}

export interface CourseTree {
  steps: TreeStep[]
  byId: Map<number, CourseNode>
  /** Every subtopic's parent id — a topic's, or another subtopic's. */
  parentOf: Map<number, number>
  /** Every lesson's step, 1-based. */
  stepOf: Map<number, number>
  /** Everything, in reading order: topic, then its cluster depth first. */
  flat: Array<{ node: CourseNode; step: number; depth: 0 | 1 | 2 }>
}

/**
 * Read the roadmap's shape out of a flat node list.
 *
 * Nothing is ever dropped: a subtopic whose parent is missing attaches to the
 * last topic above it, a subtopic three deep is lifted to two, and a course
 * with no topics at all is read as a plain sequence. The board, the sidebar
 * and the phone list all go through here, so they can never disagree about
 * what the course is.
 */
export function courseTree(nodes: CourseNode[]): CourseTree {
  const ordered = orderedLessons(nodes)
  const byId = new Map(ordered.map((node) => [node.id, node]))
  const topics = ordered.filter((node) => lessonTrack(node) === 'core')

  // Every lesson a subtopic: there is no line to hang them off, so the order is it.
  const spine = topics.length > 0 ? topics : ordered
  const spineIds = new Set(spine.map((node) => node.id))

  const steps: TreeStep[] = spine.map((node, index) => {
    const previous = spine[index - 1]
    const section = String(node.section ?? '').trim()
    const before = previous ? String(previous.section ?? '').trim() : ''
    return {
      node,
      step: index + 1,
      items: [],
      opens: section !== '' && section !== before ? section : null,
    }
  })

  const stepById = new Map(steps.map((step) => [step.node.id, step]))
  const itemById = new Map<number, TreeItem>()
  const parentOf = new Map<number, number>()
  const stepOf = new Map<number, number>()

  for (const step of steps) stepOf.set(step.node.id, step.step)

  /* Resolve each subtopic's parent. A named parent that exists wins; otherwise
     the nearest topic above it. Then hang it: off a topic directly, off a
     subtopic when that subtopic hangs off a topic, and lifted to the topic when
     the chain runs deeper than that. Two passes, because a parent subtopic may
     be listed after its child. */
  const pending: CourseNode[] = []
  let lastTopic: CourseNode | null = null
  const namedParent = new Map<number, number>()

  for (const node of ordered) {
    if (spineIds.has(node.id)) {
      lastTopic = node
      continue
    }
    const named = node.branch_of_node_id
    const fallback = lastTopic ?? spine[0]
    const parent = named != null && byId.has(named) && named !== node.id ? named : fallback?.id
    if (parent != null) namedParent.set(node.id, parent)
    pending.push(node)
  }

  const topicOf = (id: number, hops = 0): number | null => {
    if (spineIds.has(id)) return id
    const up = namedParent.get(id)
    if (up == null || hops > 8) return null
    return topicOf(up, hops + 1)
  }

  for (const node of pending) {
    const parent = namedParent.get(node.id)
    if (parent == null) continue

    const owner = topicOf(parent)
    const ownerStep = owner != null ? stepById.get(owner) : undefined
    if (!ownerStep) continue

    const parentIsTopic = spineIds.has(parent)
    const parentIsFirstLevel = !parentIsTopic && namedParent.get(parent) != null && spineIds.has(namedParent.get(parent)!)

    if (parentIsTopic || !parentIsFirstLevel) {
      const item: TreeItem = { node, depth: 1, children: [] }
      itemById.set(node.id, item)
      ownerStep.items.push(item)
      parentOf.set(node.id, ownerStep.node.id)
    } else {
      const item: TreeItem = { node, depth: 2, children: [] }
      itemById.set(node.id, item)
      parentOf.set(node.id, parent)
    }
    stepOf.set(node.id, ownerStep.step)
  }

  // Second-level items join their parent now that every first-level item exists.
  for (const node of pending) {
    const item = itemById.get(node.id)
    if (!item || item.depth !== 2) continue
    const parent = itemById.get(parentOf.get(node.id)!)
    if (parent && parent.depth === 1) {
      parent.children.push(item)
    } else {
      // The parent turned out not to be first-level after all: lift it.
      item.depth = 1
      const owner = stepById.get(topicOf(node.id) ?? -1) ?? steps[0]
      if (owner) {
        owner.items.push(item)
        parentOf.set(node.id, owner.node.id)
      }
    }
  }

  // Reading order within a cluster is `position`, depth first.
  const byPosition = (a: TreeItem, b: TreeItem): number =>
    a.node.position - b.node.position || a.node.id - b.node.id
  for (const step of steps) {
    step.items.sort(byPosition)
    for (const item of step.items) item.children.sort(byPosition)
  }

  const flat: CourseTree['flat'] = []
  for (const step of steps) {
    flat.push({ node: step.node, step: step.step, depth: 0 })
    for (const item of step.items) {
      flat.push({ node: item.node, step: step.step, depth: 1 })
      for (const child of item.children) flat.push({ node: child.node, step: step.step, depth: 2 })
    }
  }

  return { steps, byId, parentOf, stepOf, flat }
}

/* -------------------------------------------------------------------------- */
/* Text                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Greedy word wrap with an ellipsis on overflow. Character-count based on
 * purpose: it is deterministic, so the server and the browser agree, and text
 * measurement is not available during SSR anyway.
 */
export function wrapLabel(text: string, charsPerLine: number, maxLines: number): string[] {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim()
  if (clean === '') return ['Untitled']

  const lines: string[] = []
  let current = ''

  for (const word of clean.split(' ')) {
    const candidate = current === '' ? word : `${current} ${word}`

    if (candidate.length <= charsPerLine) {
      current = candidate
      continue
    }

    if (current !== '') lines.push(current)

    if (lines.length === maxLines) {
      current = ''
      break
    }

    if (word.length > charsPerLine) {
      let rest = word
      while (rest.length > charsPerLine && lines.length < maxLines) {
        lines.push(`${rest.slice(0, charsPerLine - 1)}-`)
        rest = rest.slice(charsPerLine - 1)
      }
      current = rest
    } else {
      current = word
    }
  }

  if (current !== '' && lines.length < maxLines) lines.push(current)

  if (lines.length === maxLines && clean.length > lines.join(' ').length) {
    const last = lines[maxLines - 1]!
    lines[maxLines - 1] = `${last.slice(0, Math.max(1, charsPerLine - 1)).trimEnd()}…`
  }

  return lines.length === 0 ? [clean.slice(0, charsPerLine)] : lines
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

/* -------------------------------------------------------------------------- */
/* The drawing                                                                */
/* -------------------------------------------------------------------------- */

export interface Box {
  x: number
  y: number
  width: number
  height: number
  cx: number
  cy: number
}

export interface TopicBox extends Box {
  id: number
  node: CourseNode
  step: number
  lines: string[]
}

export interface LabelBox extends Box {
  id: string
  text: string
  /** 1-based first step of the chapter, for the caption. */
  fromStep: number
  steps: number
}

export interface ItemBox extends Box {
  id: number
  node: CourseNode
  depth: 1 | 2
  /** The topic this sits beside. */
  topicId: number
  /** What it hangs off — the topic, or a family item. */
  parentId: number
  mark: LessonMark | null
  lines: string[]
  side: 'left' | 'right'
}

export interface GroupBox extends Box {
  id: string
  /** `group`: a headed box of siblings. `family`: an item on top of its own members. */
  kind: 'group' | 'family'
  /** The heading text for a group; the family's own item is drawn instead for a family. */
  title: string | null
  topicId: number
  /** For a family, the item id whose box this is. */
  itemId: number | null
  side: 'left' | 'right'
}

export interface NoteBox extends Box {
  id: string
  topicId: number
  text: string
  lines: string[]
  side: 'left' | 'right'
}

export interface LinkBox extends Box {
  id: string
  link: FurtherCourse
  /** The topic this sits beside, or null at the end of the course. */
  topicId: number | null
  side: 'left' | 'right' | 'center'
  lines: string[]
}

/** A dotted tie from a topic to something in its cluster. Never means "next". */
export interface Tie {
  id: string
  topicId: number
  /** The box it reaches: an item, a group, a note or a link id. */
  targetId: number | string
  path: string
}

/** One hop of the solid line — the only thing in the drawing that means "next". */
export interface SpineSegment {
  id: string
  fromId: number | string
  toId: number | string
  path: string
  /** True once the topic above it is finished, so the line fills in as you go. */
  done: boolean
}

export interface RoadmapCounts {
  topics: number
  subtopics: number
  total: number
  done: number
  learning: number
  skipped: number
  minutes: number
}

export interface RoadmapLayout {
  width: number
  height: number
  spineX: number
  title: (Box & { text: string; lines: string[] }) | null
  topics: TopicBox[]
  labels: LabelBox[]
  items: ItemBox[]
  groups: GroupBox[]
  notes: NoteBox[]
  links: LinkBox[]
  ties: Tie[]
  spine: SpineSegment[]
  /** The dotted line above the title. */
  lead: string
  /** The dotted line after the end. */
  tail: string
  /** The "where to go from here" box at the end, when there are end links. */
  finish: (Box & { title: string }) | null
  /** The "course finished" marker when there is nothing further. */
  finishPill: Box | null
  topicById: Map<number, TopicBox>
  itemById: Map<number, ItemBox>
  counts: RoadmapCounts
}

export interface RoadmapOptions {
  /** The course title drawn at the head of the line. */
  title?: string | null
  /** Where to go next. */
  further?: FurtherCourse[]
}

/* Metrics, in CSS pixels. Kept here so the board never guesses. Every number is
   a claim about `RoadmapBoard.vue`'s CSS, and the two must move together. */
export const METRICS = {
  pad: 28,
  /** A flank: the band beside the spine a cluster is laid into. */
  flank: 300,
  /** Gap between a topic's edge and the flank's inner edge. */
  gap: 44,
  topic: { width: 236, padY: 12, line: 18, chars: 24, maxLines: 3, font: 14 },
  item: { padY: 8, line: 17, chars: 38, shortChars: 18, maxLines: 2, font: 13 },
  /** Average glyph width at 13px in the UI face, measured generous: a wrap predicted short overflows its box. */
  charPx: 7.0,
  /** Two short items share a row; the cell is half the flank less the gutter. */
  gutter: 8,
  group: { pad: 10, head: 22, chars: 34 },
  note: { padY: 10, line: 16, chars: 38, maxLines: 4 },
  link: { height: 34, chars: 26 },
  label: { height: 24, gapAbove: 30, gapBelow: 22 },
  stack: 10,
  step: 34,
  title: { line: 26, chars: 30, maxLines: 2, lead: 48, gapBelow: 34 },
  finish: { pad: 12, head: 22, width: 560, tail: 44 },
  finishPill: { width: 176, height: 30 },
} as const

function topicHeight(lines: number): number {
  return METRICS.topic.padY * 2 + Math.max(1, lines) * METRICS.topic.line
}

function itemHeight(lines: number): number {
  return METRICS.item.padY * 2 + Math.max(1, lines) * METRICS.item.line
}

function noteHeight(lines: number): number {
  return METRICS.note.padY * 2 + Math.max(1, lines) * METRICS.note.line
}

/** A dotted, curved tie from (sx, sy) to (tx, ty), bulging horizontally. */
function tie(sx: number, sy: number, tx: number, ty: number): string {
  const bend = Math.max(18, Math.abs(tx - sx) * 0.5)
  const dir = tx >= sx ? 1 : -1
  return (
    `M ${round(sx)} ${round(sy)} ` +
    `C ${round(sx + dir * bend)} ${round(sy)}, ${round(tx - dir * bend)} ${round(ty)}, ${round(tx)} ${round(ty)}`
  )
}

/** One row of a cluster: what gets stacked in the flank. */
type Row =
  | { kind: 'pair'; items: TreeItem[]; height: number; lines: string[][] }
  | { kind: 'item'; item: TreeItem; height: number; lines: string[] }
  | { kind: 'group'; title: string; members: TreeItem[]; height: number; inner: InnerRow[] }
  | { kind: 'family'; item: TreeItem; height: number; lines: string[]; inner: InnerRow[] }
  | { kind: 'link'; link: FurtherCourse; height: number; lines: string[] }

/** A row inside a group or family box. Narrower, so measured on its own. */
type InnerRow = { items: TreeItem[]; height: number; lines: string[][] }

function isShort(item: TreeItem): boolean {
  return item.node.title.trim().length <= METRICS.item.shortChars
}

/**
 * Pack a run of loose items: two short titles share a row, a long one takes
 * the row alone. This is what makes eight languages read as a 2×4 grid and six
 * questions as a column, the way roadmap.sh hand-draws them.
 */
function packInner(items: TreeItem[], width: number): InnerRow[] {
  const cell = (width - METRICS.gutter) / 2
  const cellChars = Math.max(8, Math.floor((cell - 20) / METRICS.charPx))
  const fullChars = Math.max(10, Math.floor((width - 20) / METRICS.charPx))
  const rows: InnerRow[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!
    const next = items[i + 1]
    if (next && isShort(item) && isShort(next)) {
      const a = wrapLabel(item.node.title, cellChars, METRICS.item.maxLines)
      const b = wrapLabel(next.node.title, cellChars, METRICS.item.maxLines)
      rows.push({
        items: [item, next],
        lines: [a, b],
        height: itemHeight(Math.max(a.length, b.length)),
      })
      i++
    } else {
      const a = wrapLabel(item.node.title, fullChars, METRICS.item.maxLines)
      rows.push({ items: [item], lines: [a], height: itemHeight(a.length) })
    }
  }

  return rows
}

function innerHeight(rows: InnerRow[]): number {
  return rows.reduce((sum, row) => sum + row.height, 0) + Math.max(0, rows.length - 1) * METRICS.stack
}

/**
 * Lay the course out as a roadmap.
 *
 *   const roadmap = useRoadmap(() => nodes.value, { title, further })
 */
export function useRoadmap(
  nodesSource: MaybeRefOrGetter<CourseNode[] | null | undefined>,
  options: MaybeRefOrGetter<RoadmapOptions> = {},
): ComputedRef<RoadmapLayout> {
  return computed<RoadmapLayout>(() => {
    const raw = toValue(nodesSource) ?? []
    const opts = toValue(options)
    const tree = courseTree(raw)
    const further = opts.further ?? []

    const { pad, flank, gap } = METRICS
    const topicW = METRICS.topic.width
    const spineX = round(pad + flank + gap + topicW / 2)
    const width = round(spineX * 2)

    const topics: TopicBox[] = []
    const labels: LabelBox[] = []
    const items: ItemBox[] = []
    const groups: GroupBox[] = []
    const notes: NoteBox[] = []
    const links: LinkBox[] = []
    const ties: Tie[] = []
    const spine: SpineSegment[] = []
    const topicById = new Map<number, TopicBox>()
    const itemById = new Map<number, ItemBox>()

    /* -- The head: the title on the spine, under a dotted lead-in ----------- */

    const titleText = String(opts.title ?? '').trim()
    const titleLines = titleText ? wrapLabel(titleText, METRICS.title.chars, METRICS.title.maxLines) : []
    const titleH = titleLines.length * METRICS.title.line
    const titleTop = pad + METRICS.title.lead
    const title = titleText
      ? {
          text: titleText,
          lines: titleLines,
          x: round(spineX - 190),
          y: titleTop,
          width: 380,
          height: titleH,
          cx: spineX,
          cy: round(titleTop + titleH / 2),
        }
      : null

    const lead = `M ${spineX} ${pad} L ${spineX} ${titleTop - 8}`

    let cursorY = titleTop + titleH + METRICS.title.gapBelow
    let leadRight = true
    let previousAnchor: { id: number | string; cx: number; bottom: number; done: boolean } | null = title
      ? { id: 'title', cx: spineX, bottom: titleTop + titleH + 6, done: false }
      : null

    const linksAfter = new Map<string, FurtherCourse[]>()
    const endLinks: FurtherCourse[] = []
    const topicKeys = new Set(tree.steps.map((step) => step.node.key))
    for (const link of further) {
      if (link.after_key && topicKeys.has(link.after_key)) {
        const bucket = linksAfter.get(link.after_key)
        if (bucket) bucket.push(link)
        else linksAfter.set(link.after_key, [link])
      } else {
        endLinks.push(link)
      }
    }

    /* -- Each topic, with its cluster ---------------------------------------- */

    for (const step of tree.steps) {
      const node = step.node

      if (step.opens) {
        const runs = tree.steps
          .slice(step.step)
          .findIndex((later) => later.opens !== null)
        const y = cursorY + METRICS.label.gapAbove
        labels.push({
          id: `label-${node.id}`,
          text: step.opens,
          fromStep: step.step,
          steps: runs === -1 ? tree.steps.length - step.step + 1 : runs + 1,
          x: round(spineX - 150),
          y,
          width: 300,
          height: METRICS.label.height,
          cx: spineX,
          cy: round(y + METRICS.label.height / 2),
        })
        cursorY = y + METRICS.label.height + METRICS.label.gapBelow
      }

      const topicLines = wrapLabel(node.title, METRICS.topic.chars, METRICS.topic.maxLines)
      const topicH = topicHeight(topicLines.length)

      /* Build the cluster rows in reading order. A group forms where its first
         member is; a family is the item and its own members; loose items pack
         in pairs when short. */
      const rows: Row[] = []
      const groupRows = new Map<string, Extract<Row, { kind: 'group' }>>()
      let loose: TreeItem[] = []

      const flushLoose = (): void => {
        if (loose.length === 0) return
        for (const inner of packInner(loose, flank)) {
          if (inner.items.length === 2) {
            rows.push({ kind: 'pair', items: inner.items, height: inner.height, lines: inner.lines })
          } else {
            rows.push({ kind: 'item', item: inner.items[0]!, height: inner.height, lines: inner.lines[0]! })
          }
        }
        loose = []
      }

      for (const item of step.items) {
        const group = String(item.node.group ?? '').trim()

        if (item.children.length > 0) {
          flushLoose()
          const inner = packInner(item.children, flank - METRICS.group.pad * 2)
          const lines = wrapLabel(item.node.title, METRICS.group.chars, METRICS.item.maxLines)
          rows.push({
            kind: 'family',
            item,
            lines,
            inner,
            height: METRICS.group.pad * 2 + itemHeight(lines.length) + METRICS.stack + innerHeight(inner),
          })
          continue
        }

        if (group !== '') {
          const existing = groupRows.get(group)
          if (existing) {
            existing.members.push(item)
            continue
          }
          flushLoose()
          const row: Extract<Row, { kind: 'group' }> = { kind: 'group', title: group, members: [item], height: 0, inner: [] }
          groupRows.set(group, row)
          rows.push(row)
          continue
        }

        loose.push(item)
      }
      flushLoose()

      // A group's members are all known now; measure it. A group of one is
      // not a group — it is a loose item with a caption nobody asked for.
      for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i]!
        if (row.kind !== 'group') continue
        if (row.members.length < 2) {
          const [only] = row.members
          const lines = wrapLabel(only!.node.title, METRICS.item.chars, METRICS.item.maxLines)
          rows[i] = { kind: 'item', item: only!, height: itemHeight(lines.length), lines }
          continue
        }
        row.inner = packInner(row.members, flank - METRICS.group.pad * 2)
        row.height = METRICS.group.pad * 2 + METRICS.group.head + innerHeight(row.inner)
      }

      for (const link of linksAfter.get(node.key) ?? []) {
        const lines = wrapLabel(link.title, METRICS.link.chars, 1)
        rows.push({ kind: 'link', link, lines, height: METRICS.link.height })
      }

      const noteText = String(node.note ?? '').trim()
      const noteLines = noteText ? wrapLabel(noteText, METRICS.note.chars, METRICS.note.maxLines) : []
      const noteH = noteText ? noteHeight(noteLines.length) : 0

      const clusterH =
        rows.reduce((sum, row) => sum + row.height, 0) + Math.max(0, rows.length - 1) * METRICS.stack

      /* The cluster takes one flank and the note, when there is one, the other,
         so a topic with both reads as roadmap.sh draws it — subtopics on one
         side, the mentor's aside on the other. Flanks alternate per topic that
         has anything at all, so three bare topics in a row do not silently burn
         the alternation. */
      const hasCluster = rows.length > 0
      const clusterSide: 'left' | 'right' = leadRight ? 'right' : 'left'
      const noteSide: 'left' | 'right' = hasCluster ? (leadRight ? 'left' : 'right') : clusterSide
      if (hasCluster || noteText) leadRight = !leadRight

      const rowH = Math.max(topicH, clusterH, noteH)
      const centerY = cursorY + rowH / 2

      const topic: TopicBox = {
        id: node.id,
        node,
        step: step.step,
        lines: topicLines,
        x: round(spineX - topicW / 2),
        y: round(centerY - topicH / 2),
        width: topicW,
        height: topicH,
        cx: spineX,
        cy: round(centerY),
      }
      topics.push(topic)
      topicById.set(topic.id, topic)

      if (previousAnchor) {
        const y1 = round(previousAnchor.bottom)
        const y2 = topic.y
        spine.push({
          id: `spine-${previousAnchor.id}-${topic.id}`,
          fromId: previousAnchor.id,
          toId: topic.id,
          path: `M ${spineX} ${y1} L ${spineX} ${y2}`,
          done: previousAnchor.done,
        })
      }
      previousAnchor = {
        id: topic.id,
        cx: spineX,
        bottom: topic.y + topic.height,
        done: progressOf(node) === 'completed',
      }

      const edgeX = (side: 'left' | 'right'): number =>
        side === 'right' ? topic.x + topic.width : topic.x
      const flankX = (side: 'left' | 'right'): number =>
        side === 'right' ? topic.x + topic.width + gap : topic.x - gap - flank

      /* Stack the rows down the flank, centred on the topic. Every row gets one
         dotted tie from the topic's edge to its near edge — one per ROW, not
         per box, so a pair shares a tie and a group gets exactly one. */
      if (hasCluster) {
        const side = clusterSide
        const x0 = flankX(side)
        let y = centerY - clusterH / 2
        const sx = edgeX(side)
        const sy = topic.cy

        const placeInner = (
          inner: InnerRow[],
          ix: number,
          iy: number,
          innerW: number,
          parentId: number,
          depth: 1 | 2,
        ): void => {
          let yy = iy
          for (const irow of inner) {
            if (irow.items.length === 2) {
              const cell = (innerW - METRICS.gutter) / 2
              irow.items.forEach((it, k) => {
                const x = ix + k * (cell + METRICS.gutter)
                const box: ItemBox = {
                  id: it.node.id,
                  node: it.node,
                  depth,
                  topicId: node.id,
                  parentId,
                  mark: lessonMark(it.node),
                  lines: irow.lines[k]!,
                  side,
                  x: round(x),
                  y: round(yy),
                  width: round(cell),
                  height: irow.height,
                  cx: round(x + cell / 2),
                  cy: round(yy + irow.height / 2),
                }
                items.push(box)
                itemById.set(box.id, box)
              })
            } else {
              const it = irow.items[0]!
              const box: ItemBox = {
                id: it.node.id,
                node: it.node,
                depth,
                topicId: node.id,
                parentId,
                mark: lessonMark(it.node),
                lines: irow.lines[0]!,
                side,
                x: round(ix),
                y: round(yy),
                width: round(innerW),
                height: irow.height,
                cx: round(ix + innerW / 2),
                cy: round(yy + irow.height / 2),
              }
              items.push(box)
              itemById.set(box.id, box)
            }
            yy += irow.height + METRICS.stack
          }
        }

        for (const row of rows) {
          const cy = round(y + row.height / 2)
          const tx = side === 'right' ? x0 : x0 + flank
          let targetId: number | string

          if (row.kind === 'pair') {
            placeInner([{ items: row.items, height: row.height, lines: row.lines }], x0, y, flank, node.id, 1)
            targetId = `row-${node.id}-${row.items[0]!.node.id}`
          } else if (row.kind === 'item') {
            placeInner([{ items: [row.item], height: row.height, lines: [row.lines] }], x0, y, flank, node.id, 1)
            targetId = row.item.node.id
          } else if (row.kind === 'group') {
            const id = `group-${node.id}-${row.title}`
            groups.push({
              id,
              kind: 'group',
              title: row.title,
              topicId: node.id,
              itemId: null,
              side,
              x: round(x0),
              y: round(y),
              width: flank,
              height: row.height,
              cx: round(x0 + flank / 2),
              cy,
            })
            placeInner(
              row.inner,
              x0 + METRICS.group.pad,
              y + METRICS.group.pad + METRICS.group.head,
              flank - METRICS.group.pad * 2,
              node.id,
              1,
            )
            targetId = id
          } else if (row.kind === 'family') {
            const id = `family-${row.item.node.id}`
            const innerW = flank - METRICS.group.pad * 2
            const headH = itemHeight(row.lines.length)
            groups.push({
              id,
              kind: 'family',
              title: null,
              topicId: node.id,
              itemId: row.item.node.id,
              side,
              x: round(x0),
              y: round(y),
              width: flank,
              height: row.height,
              cx: round(x0 + flank / 2),
              cy,
            })
            const hx = x0 + METRICS.group.pad
            const hy = y + METRICS.group.pad
            const head: ItemBox = {
              id: row.item.node.id,
              node: row.item.node,
              depth: 1,
              topicId: node.id,
              parentId: node.id,
              mark: lessonMark(row.item.node),
              lines: row.lines,
              side,
              x: round(hx),
              y: round(hy),
              width: round(innerW),
              height: headH,
              cx: round(hx + innerW / 2),
              cy: round(hy + headH / 2),
            }
            items.push(head)
            itemById.set(head.id, head)
            placeInner(row.inner, hx, hy + headH + METRICS.stack, innerW, row.item.node.id, 2)
            targetId = id
          } else {
            const id = `link-${node.id}-${row.link.title}`
            links.push({
              id,
              link: row.link,
              topicId: node.id,
              side,
              lines: row.lines,
              x: round(x0),
              y: round(y),
              width: flank,
              height: row.height,
              cx: round(x0 + flank / 2),
              cy,
            })
            targetId = id
          }

          ties.push({ id: `tie-${node.id}-${String(targetId)}`, topicId: node.id, targetId, path: tie(sx, sy, tx, cy) })
          y += row.height + METRICS.stack
        }
      }

      if (noteText) {
        const side = noteSide
        const x0 = flankX(side)
        const y = centerY - noteH / 2
        const id = `note-${node.id}`
        notes.push({
          id,
          topicId: node.id,
          text: noteText,
          lines: noteLines,
          side,
          x: round(x0),
          y: round(y),
          width: flank,
          height: noteH,
          cx: round(x0 + flank / 2),
          cy: round(y + noteH / 2),
        })
        ties.push({
          id: `tie-${id}`,
          topicId: node.id,
          targetId: id,
          path: tie(edgeX(side), topic.cy, side === 'right' ? x0 : x0 + flank, round(y + noteH / 2)),
        })
      }

      cursorY = centerY + rowH / 2 + METRICS.step
    }

    /* -- The end ------------------------------------------------------------- */

    let finish: RoadmapLayout['finish'] = null
    let finishPill: Box | null = null
    let bottom = cursorY

    if (endLinks.length > 0) {
      const fw = METRICS.finish.width
      const cols = Math.min(3, endLinks.length)
      const cellW = (fw - METRICS.finish.pad * 2 - METRICS.gutter * (cols - 1)) / cols
      const rowsN = Math.ceil(endLinks.length / cols)
      const fh = METRICS.finish.pad * 2 + METRICS.finish.head + rowsN * METRICS.link.height + (rowsN - 1) * METRICS.gutter
      const fx = spineX - fw / 2
      const fy = cursorY + 6
      finish = {
        title: 'Where to go from here',
        x: round(fx),
        y: round(fy),
        width: fw,
        height: round(fh),
        cx: spineX,
        cy: round(fy + fh / 2),
      }
      endLinks.forEach((link, index) => {
        const col = index % cols
        const rowI = Math.floor(index / cols)
        const x = fx + METRICS.finish.pad + col * (cellW + METRICS.gutter)
        const y = fy + METRICS.finish.pad + METRICS.finish.head + rowI * (METRICS.link.height + METRICS.gutter)
        links.push({
          id: `link-end-${index}`,
          link,
          topicId: null,
          side: 'center',
          lines: wrapLabel(link.title, Math.max(10, Math.floor((cellW - 24) / METRICS.charPx)), 1),
          x: round(x),
          y: round(y),
          width: round(cellW),
          height: METRICS.link.height,
          cx: round(x + cellW / 2),
          cy: round(y + METRICS.link.height / 2),
        })
      })
      if (previousAnchor) {
        spine.push({
          id: `spine-${previousAnchor.id}-finish`,
          fromId: previousAnchor.id,
          toId: 'finish',
          path: `M ${spineX} ${round(previousAnchor.bottom)} L ${spineX} ${finish.y}`,
          done: previousAnchor.done,
        })
      }
      bottom = finish.y + finish.height
    } else if (topics.length > 0) {
      const { width: pw, height: ph } = METRICS.finishPill
      const py = cursorY - 4
      finishPill = { x: round(spineX - pw / 2), y: round(py), width: pw, height: ph, cx: spineX, cy: round(py + ph / 2) }
      if (previousAnchor) {
        spine.push({
          id: `spine-${previousAnchor.id}-finish`,
          fromId: previousAnchor.id,
          toId: 'finish',
          path: `M ${spineX} ${round(previousAnchor.bottom)} L ${spineX} ${py}`,
          done: previousAnchor.done,
        })
      }
      bottom = py + ph
    }

    const tail = `M ${spineX} ${round(bottom + 6)} L ${spineX} ${round(bottom + METRICS.finish.tail)}`
    const height = round(bottom + METRICS.finish.tail + pad)

    /* -- Counts -------------------------------------------------------------- */

    const counts: RoadmapCounts = { topics: 0, subtopics: 0, total: 0, done: 0, learning: 0, skipped: 0, minutes: 0 }
    for (const entry of tree.flat) {
      counts.total++
      if (entry.depth === 0) counts.topics++
      else counts.subtopics++
      counts.minutes += entry.node.estimated_minutes
      const state = progressOf(entry.node)
      if (state === 'completed') counts.done++
      else if (state === 'in_progress') counts.learning++
      else if (state === 'skipped') counts.skipped++
    }

    return {
      width: Math.max(width, 720),
      height: Math.max(height, 320),
      spineX,
      title,
      topics,
      labels,
      items,
      groups,
      notes,
      links,
      ties,
      spine,
      lead,
      tail,
      finish,
      finishPill,
      topicById,
      itemById,
      counts,
    }
  })
}
