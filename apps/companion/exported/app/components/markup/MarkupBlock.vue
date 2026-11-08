<script setup lang="ts">
import type {
  Annotation,
  HighlightAnchor,
  HighlightAnnotation,
  InkAnnotation,
  LabelAnnotation,
  MarkupTool,
  NoteAnnotation,
  Stroke,
} from '~/types/api'
import {
  HIGHLIGHT_OPACITY,
  MAX_ANNOTATION_BYTES,
  MAX_STROKES,
  NOTE_COLOR,
  NOTE_OPACITY,
  annotationBytes,
  newUuid,
  tint,
  type MarkupSize,
} from '~/utils/markup'
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom'
import InkLayer from '~/components/markup/InkLayer.vue'
import TextLayer, { type LabelItem } from '~/components/markup/TextLayer.vue'
import { useAi } from '~/companion/ai/state'
import { useQuietAi } from '~/companion/quiet-ai'

/**
 * MARKUP — the layer between a rendered part of a lesson and the reader's pen.
 *
 * Wrap it around one rendered block and it does two things to whatever the
 * block draws, without the block knowing:
 *
 *   1. Every `<img>` inside gets a drawing surface laid exactly over its
 *      painted pixels — found after mount, followed through loads, resizes
 *      and re-renders. Pictures get their own ink layer because a picture's
 *      box does not reflow; the part as a whole gets one too (see "The whole
 *      part" below), scaled with its box, so the pen works in every lesson:
 *      a stroke over a paragraph is on the wrong word by the next window
 *      width, and on the wrong paragraph by the next edit.
 *
 *   2. Prose is marked up with highlights. A selection becomes an anchor —
 *      character offsets into the block's text plus the quoted text and a
 *      little context either side — and the anchor is painted back by finding
 *      the QUOTE, not by trusting the offsets: a lesson that has been edited
 *      under a highlight moves the offsets and keeps the words. A quote that
 *      is gone is counted and never painted somewhere else.
 *
 * The painting is real `<mark>` elements around split text nodes, which is
 * the one honest way to colour a run of text that crosses inline elements:
 * never `surroundContents`, never a wrapper around an element. The cost of
 * doing that under Vue is that Vue still holds the text nodes it made and
 * will write to them; so every split is recorded with its origin, and if the
 * origin turns out rewritten or gone at the next repaint, the pieces that
 * came from it are discarded instead of being merged back into a sentence
 * that no longer exists. The lesson's own DOM is left exactly as it found it.
 *
 * A note is a highlight with words, and it has to be seen without being
 * clicked. An open note puts a number on the words, footnote-style, and its
 * text in a card under the part with the same number; a folded one keeps only
 * a small note mark on the words. Which of the two is the reader's choice per
 * note, and the last choice becomes the default for the next one. A note used
 * to be a 6px dot that only opened on a click, and readers could not tell
 * their notes were there.
 *
 * Nothing here says "annotation". On screen it is a highlight, a note, or a
 * drawing.
 */
/** The reader's last "keep open" choice, which new notes start from. */
const NOTE_OPEN_KEY = 'bilimind:notes-open'

function noteOpenByDefault(): boolean {
  try {
    return localStorage.getItem(NOTE_OPEN_KEY) !== 'folded'
  } catch {
    return true
  }
}

function rememberNoteOpen(open: boolean): void {
  try {
    localStorage.setItem(NOTE_OPEN_KEY, open ? 'open' : 'folded')
  } catch {
    /* storage may be unavailable */
  }
}

const props = withDefaults(
  defineProps<{
    blockId: number
    /** The lesson's id, stamped onto new marks. The composable re-stamps it on save. */
    nodeId?: number
    /** This block's marks only — `useAnnotations().byBlock(blockId)`. */
    annotations: Annotation[]
    tool: MarkupTool | null
    color: string
    size: MarkupSize
    armed: boolean
    /** A signed-in reader. Without it the marks are painted and nothing else happens. */
    editable?: boolean
  }>(),
  { nodeId: 0, editable: false },
)

const emit = defineEmits<{
  upsert: [annotation: Annotation]
  remove: [uuid: string]
  /** How many of this block's marks could not be put back on the page. */
  orphans: [count: number]
}>()

const toast = useToast()
const palette = useInkPalette()

/** The inks a menu here offers: the four, and the first few the reader saved. */
const menuInks = computed(() => palette.inks.value.slice(0, 8))

const root = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)

const NONE: Stroke[] = []

const textToolPlacing = computed(() => props.armed && props.tool === 'text')

const drawingArmed = computed(
  () =>
    props.armed &&
    (props.tool === 'pen' ||
      props.tool === 'marker' ||
      props.tool === 'arrow' ||
      props.tool === 'eraser'),
)
const textToolArmed = computed(
  () => props.armed && (props.tool === 'highlight' || props.tool === 'note'),
)

const textMarks = computed(() =>
  props.annotations.filter(
    (a): a is HighlightAnnotation | NoteAnnotation => a.kind === 'highlight' || a.kind === 'note',
  ),
)

const inkByIndex = computed(() => {
  const map = new Map<number, InkAnnotation>()
  for (const annotation of props.annotations) {
    if (annotation.kind === 'ink' && annotation.anchor.target !== 'block' && typeof annotation.anchor.media_index === 'number') {
      map.set(annotation.anchor.media_index, annotation)
    }
  }
  return map
})

function find(uuid: string): Annotation | undefined {
  return props.annotations.find((a) => a.uuid === uuid)
}

/* -------------------------------------------------------------------------- */
/* The whole part                                                             */
/* -------------------------------------------------------------------------- */

/*
 * A drawing surface over the part as a whole, under the picture surfaces.
 * Pictures keep their own layer because a picture's box does not reflow; the
 * rest of a part does, so strokes here are normalised to the part's box when
 * drawn and scaled with it afterwards — a circle round a word stays round the
 * word at the width it was drawn at, and follows it approximately when the
 * pane is narrower. That approximation is the price of a pen that works
 * everywhere, and a lesson with no pictures is most lessons.
 */
const blockInk = computed<InkAnnotation | null>(
  () =>
    props.annotations.find(
      (a): a is InkAnnotation => a.kind === 'ink' && a.anchor.target === 'block',
    ) ?? null,
)

const blockBox = shallowRef<Box | null>(null)

function onBlockAdd(stroke: Stroke): void {
  const box = blockBox.value
  if (!box) return

  const existing = blockInk.value

  if (existing && existing.data.strokes.length >= MAX_STROKES) {
    toast.warn({
      title: 'This drawing is full',
      body: `A part holds up to ${MAX_STROKES} strokes. Erase some, or open a whiteboard.`,
    })
    return
  }

  const next: InkAnnotation = existing
    ? { ...existing, data: { strokes: [...existing.data.strokes, stroke] } }
    : {
        uuid: newUuid(),
        node_id: props.nodeId,
        block_id: props.blockId,
        kind: 'ink',
        anchor: {
          block_id: props.blockId,
          target: 'block',
          natural_width: Math.round(box.width),
          natural_height: Math.round(box.height),
        },
        data: { strokes: [stroke] },
        updated_at: null,
      }

  if (tooBig(next)) return

  emit('upsert', next)
}

function onBlockErase(index: number): void {
  const existing = blockInk.value
  if (!existing) return

  const strokes = existing.data.strokes.filter((_, i) => i !== index)

  if (strokes.length === 0) emit('remove', existing.uuid)
  else emit('upsert', { ...existing, data: { strokes } })
}

/**
 * The eraser passed over no stroke: if there is a highlight or a note under
 * it, that goes instead. The words sit under the ink layer, so they are found
 * by asking the page what is at the point rather than by an event of their own.
 * Undo puts it back, like any other removal.
 */
function onEraseMiss(x: number, y: number): void {
  const contentEl = content.value
  if (!props.editable || !contentEl) return

  for (const el of document.elementsFromPoint(x, y)) {
    if (!contentEl.contains(el)) continue
    const host = el.closest<HTMLElement>('mark[data-markup], [data-markup-note]')
    const uuid = host?.dataset.markup ?? host?.dataset.markupNote
    if (uuid && find(uuid)) {
      emit('remove', uuid)
      return
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Text labels                                                                */
/* -------------------------------------------------------------------------- */

/*
 * A label is its own record (kind `label`) on the part or on one of its
 * pictures. It is not saved until it says something: the backend refuses an
 * empty label, and the save is on a timer, so a label that has just been
 * placed lives here as a draft until the first word — then it is upserted and
 * the draft is dropped, because the same uuid now arrives through `annotations`.
 */
interface LabelDraft extends LabelItem {
  target: 'block' | 'media'
  index: number | null
  width: number
  height: number
}

const labelDraft = ref<LabelDraft | null>(null)

function toItem(annotation: LabelAnnotation): LabelItem {
  return {
    id: annotation.uuid,
    x: annotation.anchor.x,
    y: annotation.anchor.y,
    text: annotation.data.text,
    color: annotation.data.color,
    size: annotation.data.size,
    weight: annotation.data.weight,
    background: annotation.data.background,
    ref: annotation.anchor.natural_width,
  }
}

const labelAnnotations = computed<LabelAnnotation[]>(() =>
  props.annotations.filter((a): a is LabelAnnotation => a.kind === 'label'),
)

const blockLabels = computed<LabelItem[]>(() => {
  const saved = labelAnnotations.value.filter((a) => a.anchor.target === 'block').map(toItem)
  const draft = labelDraft.value
  return draft && draft.target === 'block' ? [...saved, draft] : saved
})

function labelsFor(placed: Placed): LabelItem[] {
  const saved = labelAnnotations.value
    .filter((a) => a.anchor.target === 'media' && a.anchor.media_index === placed.index)
    .map(toItem)
  const draft = labelDraft.value
  return draft && draft.target === 'media' && draft.index === placed.index ? [...saved, draft] : saved
}

function placeLabel(target: 'block' | 'media', placed: Placed | null, x: number, y: number): void {
  const box = target === 'media' && placed ? placed : blockBox.value
  if (!box) return

  labelDraft.value = {
    id: newUuid(),
    target,
    index: placed?.index ?? null,
    width: Math.round(box.width),
    height: Math.round(box.height),
    x,
    y,
    text: '',
    color: props.color,
    size: 'md',
    ref: Math.round(box.width),
  }
}

function labelAnnotationFrom(item: LabelItem, draft: LabelDraft | null, existing: LabelAnnotation | undefined): LabelAnnotation | null {
  if (existing) {
    return {
      ...existing,
      anchor: { ...existing.anchor, x: item.x, y: item.y },
      data: {
        text: item.text,
        color: item.color,
        size: item.size,
        weight: item.weight,
        background: item.background,
      },
    }
  }

  if (!draft) return null

  return {
    uuid: draft.id,
    node_id: props.nodeId,
    block_id: props.blockId,
    kind: 'label',
    anchor: {
      block_id: props.blockId,
      target: draft.target,
      ...(draft.target === 'media' && draft.index !== null ? { media_index: draft.index } : {}),
      x: item.x,
      y: item.y,
      natural_width: draft.width,
      natural_height: draft.height,
    },
    data: {
      text: item.text,
      color: item.color,
      size: item.size,
      weight: item.weight,
      background: item.background,
    },
    updated_at: null,
  }
}

function updateLabel(item: LabelItem): void {
  const existing = labelAnnotations.value.find((a) => a.uuid === item.id)
  const draft = labelDraft.value && labelDraft.value.id === item.id ? labelDraft.value : null

  if (!existing && draft && item.text.trim() === '') {
    labelDraft.value = { ...draft, ...item }
    return
  }

  const next = labelAnnotationFrom(item, draft, existing)
  if (!next) return

  if (tooBig(next)) return

  if (draft) labelDraft.value = null
  emit('upsert', next)
}

function removeLabel(id: string): void {
  if (labelDraft.value?.id === id) {
    labelDraft.value = null
    return
  }
  if (labelAnnotations.value.some((a) => a.uuid === id)) emit('remove', id)
}

/* -------------------------------------------------------------------------- */
/* Pictures                                                                   */
/* -------------------------------------------------------------------------- */

interface Placed {
  /** Position among the block's `<img>`s in document order; the anchor's `media_index`. */
  index: number
  el: HTMLImageElement
  left: number
  top: number
  width: number
  height: number
  natural: { width: number; height: number }
}

const images = shallowRef<Placed[]>([])
/** Every `<img>` in the block, loaded or not, so a lazy picture is not an orphan. */
const imageCount = ref(0)

/**
 * `object-fit: contain` paints the picture smaller than its element and
 * centres it. Strokes are normalised to the PAINTED box, or a drawing made
 * before the frame learned its aspect ratio would slide once it did.
 */
interface Box {
  left: number
  top: number
  width: number
  height: number
}

function paintedBox(el: HTMLImageElement): Box {
  const rect = el.getBoundingClientRect()
  const fit = getComputedStyle(el).objectFit
  const nw = el.naturalWidth
  const nh = el.naturalHeight
  const fitted = fit === 'contain' || fit === 'scale-down'

  if (fitted && nw > 0 && nh > 0 && rect.width > 0 && rect.height > 0) {
    const scale = Math.min(rect.width / nw, rect.height / nh)
    const width = nw * scale
    const height = nh * scale
    return {
      left: rect.left + (rect.width - width) / 2,
      top: rect.top + (rect.height - height) / 2,
      width,
      height,
    }
  }

  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

const watchedImages = new Set<HTMLImageElement>()
let resizeObserver: ResizeObserver | null = null

function onImageLoad(): void {
  schedule('measure')
}

function measure(): void {
  const rootEl = root.value
  const contentEl = content.value
  if (!rootEl || !contentEl) return

  const rootRect = rootEl.getBoundingClientRect()
  const contentRect = contentEl.getBoundingClientRect()

  // READING zoom scales the lesson column with CSS `zoom`. Rects come back in
  // screen pixels; the overlays are positioned in the zoomed subtree's own
  // pixels, so everything measured here is divided back by the zoom.
  const zoom = Number.parseFloat(getComputedStyle(rootEl).getPropertyValue('--reading-zoom')) || 1

  blockBox.value =
    contentRect.width > 0 && contentRect.height > 0
      ? {
          left: (contentRect.left - rootRect.left) / zoom,
          top: (contentRect.top - rootRect.top) / zoom,
          width: contentRect.width / zoom,
          height: contentRect.height / zoom,
        }
      : null

  const found: Placed[] = []
  const candidates = Array.from(contentEl.querySelectorAll('img')).filter(
    (el) => !el.closest('[data-markup-ignore]'),
  )

  imageCount.value = candidates.length

  candidates.forEach((el, index) => {
    if (!watchedImages.has(el)) {
      watchedImages.add(el)
      el.addEventListener('load', onImageLoad)
      resizeObserver?.observe(el)
    }

    if (!(el.complete && el.naturalWidth > 0)) return

    const box = paintedBox(el)
    if (box.width < 48 || box.height < 48) return

    found.push({
      index,
      el,
      left: (box.left - rootRect.left) / zoom,
      top: (box.top - rootRect.top) / zoom,
      width: box.width / zoom,
      height: box.height / zoom,
      natural: { width: el.naturalWidth, height: el.naturalHeight },
    })
  })

  // Pictures that left the block take their listeners with them.
  for (const el of watchedImages) {
    if (!candidates.includes(el)) {
      el.removeEventListener('load', onImageLoad)
      resizeObserver?.unobserve(el)
      watchedImages.delete(el)
    }
  }

  images.value = found
}

function strokesFor(placed: Placed): Stroke[] {
  return inkByIndex.value.get(placed.index)?.data.strokes ?? NONE
}

/** A picture gets an overlay only when there is something to show or someone to draw. */
function wantsLayer(placed: Placed): boolean {
  return props.editable || inkByIndex.value.has(placed.index) || labelsFor(placed).length > 0
}

function tooBig(candidate: Annotation): boolean {
  if (annotationBytes(candidate) <= MAX_ANNOTATION_BYTES) return false
  toast.warn({
    title: 'This drawing is as large as it can be',
    body: 'Erase a few strokes, or open a whiteboard for the rest.',
  })
  return true
}

function onAdd(placed: Placed, stroke: Stroke): void {
  const existing = inkByIndex.value.get(placed.index)

  if (existing && existing.data.strokes.length >= MAX_STROKES) {
    toast.warn({
      title: 'This drawing is full',
      body: `A picture holds up to ${MAX_STROKES} strokes. Erase some, or open a whiteboard.`,
    })
    return
  }

  const next: InkAnnotation = existing
    ? { ...existing, data: { strokes: [...existing.data.strokes, stroke] } }
    : {
        uuid: newUuid(),
        node_id: props.nodeId,
        block_id: props.blockId,
        kind: 'ink',
        anchor: {
          block_id: props.blockId,
          target: 'media',
          media_index: placed.index,
          natural_width: placed.natural.width,
          natural_height: placed.natural.height,
        },
        data: { strokes: [stroke] },
        updated_at: null,
      }

  if (tooBig(next)) return

  emit('upsert', next)
}

function onErase(placed: Placed, index: number): void {
  const existing = inkByIndex.value.get(placed.index)
  if (!existing) return

  const strokes = existing.data.strokes.filter((_, i) => i !== index)

  // A drawing with nothing in it is not a drawing.
  if (strokes.length === 0) emit('remove', existing.uuid)
  else emit('upsert', { ...existing, data: { strokes } })
}

/* -------------------------------------------------------------------------- */
/* Text: walking, anchoring, painting                                         */
/* -------------------------------------------------------------------------- */

/** Text that is not prose: never anchored to, never wrapped. */
const SKIP = [
  'textarea',
  'script',
  'style',
  'select',
  'option',
  'svg',
  '[contenteditable]:not([contenteditable="false"])',
  '.cm-editor',
  '[data-markup-ignore]',
  '[data-markup-note]',
].join(', ')

interface TextRun {
  node: Text
  start: number
}

interface FlatText {
  text: string
  runs: TextRun[]
}

function flatText(contentEl: HTMLElement): FlatText {
  const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      (node.parentElement?.closest(SKIP) ?? null) === null
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT,
  })

  const runs: TextRun[] = []
  let text = ''

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const run = node as Text
    runs.push({ node: run, start: text.length })
    text += run.data
  }

  return { text, runs }
}

const CONTEXT = 32
const MAX_QUOTE = 2000

/**
 * A selection boundary can sit in a text node or between two elements; both
 * become an offset into the flat text.
 */
function offsetOf(flat: FlatText, container: Node, offset: number): number | null {
  if (container.nodeType === Node.TEXT_NODE) {
    const run = flat.runs.find((r) => r.node === container)
    return run ? run.start + offset : null
  }

  const child = container.childNodes[offset] ?? null

  if (child) {
    for (const run of flat.runs) {
      if (
        child === run.node ||
        child.contains(run.node) ||
        (child.compareDocumentPosition(run.node) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      ) {
        return run.start
      }
    }
    return flat.text.length
  }

  for (let i = flat.runs.length - 1; i >= 0; i -= 1) {
    const run = flat.runs[i] as TextRun
    if (container.contains(run.node)) return run.start + run.node.data.length
  }

  for (const run of flat.runs) {
    if ((container.compareDocumentPosition(run.node) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0) {
      return run.start
    }
  }

  return flat.text.length
}

function anchorFromRange(range: Range): HighlightAnchor | null {
  const contentEl = content.value
  if (!contentEl) return null

  const flat = flatText(contentEl)
  let start = offsetOf(flat, range.startContainer, range.startOffset)
  let end = offsetOf(flat, range.endContainer, range.endOffset)
  if (start === null || end === null) return null
  if (end < start) [start, end] = [end, start]

  while (start < end && /\s/.test(flat.text[start] ?? '')) start += 1
  while (end > start && /\s/.test(flat.text[end - 1] ?? '')) end -= 1
  if (end <= start) return null

  // The server keeps 2,000 characters of quote. A longer selection is a page,
  // and a page is not a highlight; the first 2,000 characters of it are.
  if (end - start > MAX_QUOTE) end = start + MAX_QUOTE

  return {
    block_id: props.blockId,
    field: 'rendered',
    start,
    end,
    quote: flat.text.slice(start, end),
    prefix: flat.text.slice(Math.max(0, start - CONTEXT), start),
    suffix: flat.text.slice(end, end + CONTEXT),
  }
}

function overlap(a: string, b: string, fromEnd: boolean): number {
  let count = 0
  const length = Math.min(a.length, b.length)
  for (let i = 0; i < length; i += 1) {
    const ca = fromEnd ? a[a.length - 1 - i] : a[i]
    const cb = fromEnd ? b[b.length - 1 - i] : b[i]
    if (ca !== cb) break
    count += 1
  }
  return count
}

/**
 * Where the anchor is NOW. The quote decides; when the same words occur more
 * than once, the context either side breaks the tie, and the stored offset
 * breaks whatever is left. No quote, no mark.
 */
function locate(anchor: HighlightAnchor, text: string): [number, number] | null {
  const { quote } = anchor
  if (!quote) return null

  const candidates: number[] = []
  let from = 0
  while (candidates.length < 64) {
    const at = text.indexOf(quote, from)
    if (at < 0) break
    candidates.push(at)
    from = at + 1
  }

  const first = candidates[0]
  if (first === undefined) return null
  if (candidates.length === 1) return [first, first + quote.length]

  let best = first
  let bestScore = Number.NEGATIVE_INFINITY

  for (const at of candidates) {
    let score = 0
    if (anchor.prefix) {
      score += overlap(text.slice(Math.max(0, at - anchor.prefix.length), at), anchor.prefix, true)
    }
    if (anchor.suffix) {
      const after = at + quote.length
      score += overlap(text.slice(after, after + anchor.suffix.length), anchor.suffix, false)
    }
    score -= Math.abs(at - anchor.start) / 1_000_000
    if (score > bestScore) {
      best = at
      bestScore = score
    }
  }

  return [best, best + quote.length]
}

/* -- Splitting, and putting it back ---------------------------------------- */

interface Origin {
  /** What the origin's data should still be at the next repaint. */
  data: string
  pieces: Text[]
}

const origins = new Map<Text, Origin>()
const originOf = new Map<Text, Text>()

function split(node: Text, offset: number): Text {
  const tail = node.splitText(offset)
  const origin = originOf.get(node) ?? node

  let entry = origins.get(origin)
  if (!entry) {
    entry = { data: '', pieces: [] }
    origins.set(origin, entry)
  }
  entry.data = origin.data
  entry.pieces.push(tail)
  originOf.set(tail, origin)

  return tail
}

function unwrap(contentEl: HTMLElement): void {
  for (const tag of Array.from(contentEl.querySelectorAll('[data-markup-note]'))) tag.remove()

  for (const mark of Array.from(contentEl.querySelectorAll('mark[data-markup]'))) {
    mark.replaceWith(...Array.from(mark.childNodes))
  }

  for (const [origin, entry] of origins) {
    const stale = !contentEl.contains(origin) || origin.data !== entry.data

    if (stale) {
      // Vue rewrote or removed the node we split. What it wrote is whole;
      // what we split off it is a leftover of the old sentence.
      for (const piece of entry.pieces) piece.remove()
      continue
    }

    let next = origin.nextSibling
    while (next && next.nodeType === Node.TEXT_NODE && originOf.get(next as Text) === origin) {
      origin.data += (next as Text).data
      const after = next.nextSibling
      next.remove()
      next = after
    }
  }

  origins.clear()
  originOf.clear()
}

/** The folded note's mark: the tray's note glyph, small. */
const NOTE_GLYPH =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 4.5h13A1.5 1.5 0 0 1 20 6v9a1.5 1.5 0 0 1-1.5 1.5h-7L7 20.5v-4H5.5A1.5 1.5 0 0 1 4 15V6a1.5 1.5 0 0 1 1.5-1.5Z"/><path d="M8.5 9h7M8.5 12.5h4"/></svg>'

function wrap(
  flat: FlatText,
  start: number,
  end: number,
  mark: HighlightAnnotation | NoteAnnotation,
  number: number | null,
): void {
  let last: HTMLElement | null = null

  for (const run of flat.runs) {
    const runEnd = run.start + run.node.data.length
    if (runEnd <= start || run.start >= end) continue

    const from = Math.max(start, run.start) - run.start
    const to = Math.min(end, runEnd) - run.start
    if (to <= from) continue

    let target = run.node
    if (from > 0) target = split(target, from)
    if (to - from < target.data.length) split(target, to - from)

    const el = document.createElement('mark')
    el.dataset.markup = mark.uuid
    el.dataset.markupKind = mark.kind
    el.style.setProperty('--mark', mark.data.color)
    el.style.backgroundColor = tint(
      mark.data.color,
      mark.kind === 'note' ? NOTE_OPACITY : HIGHLIGHT_OPACITY,
    )
    if (mark.kind === 'note') el.style.textDecorationColor = mark.data.color

    target.parentNode?.insertBefore(el, target)
    el.appendChild(target)
    last = el
  }

  if (mark.kind === 'note' && last) {
    const tag = document.createElement('span')
    tag.dataset.markupNote = mark.uuid
    tag.style.setProperty('--mark', mark.data.color)
    tag.setAttribute('role', 'button')
    tag.tabIndex = 0
    tag.setAttribute('aria-label', number ? `Note ${number}` : 'Note — open it')
    tag.title = mark.data.text.slice(0, 160)
    if (number) tag.textContent = String(number)
    else {
      tag.classList.add('is-folded')
      tag.innerHTML = NOTE_GLYPH
    }
    last.after(tag)
  }
}

let mutationObserver: MutationObserver | null = null
const lostMarks = ref(0)

/** An open note as its card under the part shows it. */
interface NoteCard {
  uuid: string
  number: number
  text: string
  color: string
  quote: string
}

const noteCards = shallowRef<NoteCard[]>([])

function isOpenNote(mark: HighlightAnnotation | NoteAnnotation): mark is NoteAnnotation {
  return mark.kind === 'note' && mark.data.text.trim() !== '' && mark.data.open !== false
}

function paint(): void {
  const contentEl = content.value
  if (!contentEl) return

  unwrap(contentEl)

  // Where every mark is now, found before any of them is wrapped: open notes
  // are numbered in reading order, not in the order they were written.
  const before = flatText(contentEl).text
  const placed: Array<{ mark: HighlightAnnotation | NoteAnnotation; at: [number, number] }> = []
  let lost = 0

  for (const mark of textMarks.value) {
    const at = locate(mark.anchor, before)
    if (at) placed.push({ mark, at })
    else lost += 1
  }

  const numbered = placed
    .filter((item) => isOpenNote(item.mark))
    .sort((a, b) => a.at[0] - b.at[0])
  const numbers = new Map(numbered.map((item, index) => [item.mark.uuid, index + 1]))

  for (const { mark } of placed) {
    // Wrapping splits text nodes, so the runs are walked again each time; the
    // text itself, and so the offsets, do not change.
    const flat = flatText(contentEl)
    const at = locate(mark.anchor, flat.text)
    if (at) wrap(flat, at[0], at[1], mark, numbers.get(mark.uuid) ?? null)
  }

  noteCards.value = numbered.map(({ mark }) => {
    const note = mark as NoteAnnotation
    const quote = note.anchor.quote ?? ''
    return {
      uuid: note.uuid,
      number: numbers.get(note.uuid) ?? 0,
      text: note.data.text,
      color: note.data.color,
      quote: quote.length > 64 ? `${quote.slice(0, 63).trimEnd()}…` : quote,
    }
  })

  lostMarks.value = lost

  // Our own mutations are queued on the observer by now; drain them so they
  // are not mistaken for the lesson changing under us.
  mutationObserver?.takeRecords()
}

/* -------------------------------------------------------------------------- */
/* Keeping up with the page                                                   */
/* -------------------------------------------------------------------------- */

let frame = 0
let needMeasure = false
let needPaint = false

/**
 * Two jobs, one frame. A resize moves the pictures and leaves the words where
 * they are; a change to the DOM or to the marks means the words need
 * re-finding. Keeping them apart is what stops a window being dragged from
 * unwrapping and rewrapping every highlight sixty times a second.
 */
function sync(): void {
  frame = 0
  const measureNow = needMeasure
  const paintNow = needPaint
  needMeasure = false
  needPaint = false
  if (measureNow) measure()
  if (paintNow) paint()
}

function schedule(what: 'measure' | 'paint' | 'both' = 'both'): void {
  if (!import.meta.client) return
  if (what !== 'paint') needMeasure = true
  if (what !== 'measure') needPaint = true
  if (frame) return
  frame = requestAnimationFrame(sync)
}

function onWindowResize(): void {
  schedule('measure')
}

let observing = false

/**
 * Observers cost something on a page with twenty blocks, so a block on a
 * public page with nothing to paint and nobody to draw does without them.
 */
function observe(): void {
  if (observing || !import.meta.client) return
  const rootEl = root.value
  const contentEl = content.value
  if (!rootEl || !contentEl) return

  observing = true

  // An attribute flip (a class on hover, a src swap) moves pictures; only a
  // change to the nodes themselves can move the words.
  mutationObserver = new MutationObserver((records) => {
    schedule(records.every((record) => record.type === 'attributes') ? 'measure' : 'both')
  })
  mutationObserver.observe(contentEl, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['src', 'class', 'style', 'hidden'],
  })

  resizeObserver = new ResizeObserver(() => schedule('measure'))
  if (content.value) resizeObserver.observe(content.value)
  resizeObserver.observe(rootEl)

  window.addEventListener('resize', onWindowResize)
  schedule('both')
}

function unobserve(): void {
  if (!observing) return
  observing = false
  mutationObserver?.disconnect()
  mutationObserver = null
  resizeObserver?.disconnect()
  resizeObserver = null
  for (const el of watchedImages) el.removeEventListener('load', onImageLoad)
  watchedImages.clear()
  window.removeEventListener('resize', onWindowResize)
  if (frame) cancelAnimationFrame(frame)
  frame = 0
}

const wanted = computed(() => props.editable || props.annotations.length > 0)

onMounted(() => {
  if (wanted.value) observe()
})

watch(wanted, (on) => {
  if (on) observe()
})

watch(textMarks, () => schedule('paint'))

onBeforeUnmount(() => {
  unobserve()
  const contentEl = content.value
  if (contentEl) unwrap(contentEl)
  closePopover()
})

/* Orphans: highlights whose words are gone, drawings whose picture is gone. */
const lostInks = computed(() => {
  let lost = 0
  for (const index of inkByIndex.value.keys()) {
    if (index >= imageCount.value) lost += 1
  }
  return lost
})

watch(
  () => lostMarks.value + lostInks.value,
  (count) => emit('orphans', count),
)

/* -------------------------------------------------------------------------- */
/* Making a highlight                                                         */
/* -------------------------------------------------------------------------- */

interface Popover {
  kind: 'select' | 'mark' | 'note'
  uuid: string | null
  x: number
  /** Top and bottom of what the popover points at, relative to the root. */
  above: number
  below: number
}

const popover = ref<Popover | null>(null)
const popoverEl = ref<HTMLElement | null>(null)
const popoverStyle = ref<Record<string, string>>({})
/** The lesson's Warm or Dim reader, carried to the popover, which draws at the body. */
const readingTheme = ref('')
let stopFollowing: (() => void) | null = null
const noteField = ref<HTMLTextAreaElement | null>(null)
const pendingAnchor = ref<HighlightAnchor | null>(null)
const noteDraft = ref('')
/** The open note's "keep open" box, saved with the note when it is. */
const noteOpen = ref(true)

let lastPointerType = 'mouse'
let selectionTimer: ReturnType<typeof setTimeout> | null = null

function rectOf(range: Range): DOMRect {
  const rects = range.getClientRects()
  const first = rects[0]
  const last = rects[rects.length - 1]
  const bounds = range.getBoundingClientRect()
  if (!first || !last) return bounds
  // Point at the first line, not the middle of a five-line selection.
  return new DOMRect(bounds.left, first.top, bounds.width, last.bottom - first.top)
}

function place(kind: Popover['kind'], uuid: string | null, rect: DOMRect | null): void {
  const rootEl = root.value
  if (!rootEl) return
  const rootRect = rootEl.getBoundingClientRect()

  popover.value = {
    kind,
    uuid,
    x: rect ? rect.left + rect.width / 2 - rootRect.left : rootRect.width / 2,
    above: rect ? rect.top - rootRect.top : 0,
    below: rect ? rect.bottom - rootRect.top : 0,
  }
  readingTheme.value = [...(rootEl.closest('[class*="reading-theme-"]')?.classList ?? [])]
    .find((name) => name.startsWith('reading-theme-')) ?? ''
}

/** What the popover points at, in the window: read off the root each time, so it follows a scroll. */
function popoverAnchor(): DOMRect | null {
  const current = popover.value
  const rootRect = root.value?.getBoundingClientRect()
  if (!current || !rootRect) return null
  const { x, above, below } = current
  return new DOMRect(rootRect.left + x, rootRect.top + above, 0, below - above)
}

function popoverReference() {
  return {
    contextElement: root.value ?? undefined,
    getBoundingClientRect: () => popoverAnchor() ?? new DOMRect(),
  }
}

/*
 * Fixed at the body and placed by floating-ui, as the page's own menus are
 * (`PageFloating`): drawn inside the part, a narrow part squeezed it onto two
 * lines and the lesson column's overflow cut its end off. Above the words,
 * below them when the window has no room, never past the window's sides.
 */
function follow(): void {
  const el = popoverEl.value
  if (!el) return
  void computePosition(popoverReference(), el, {
    placement: 'top',
    strategy: 'fixed',
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
  }).then(({ x, y }) => {
    popoverStyle.value = { left: `${x}px`, top: `${y}px` }
  })
}

watch(
  popover,
  (open) => {
    const el = popoverEl.value
    if (!open || !el) return
    if (stopFollowing) follow()
    else stopFollowing = autoUpdate(popoverReference(), el, follow)
  },
  { flush: 'post' },
)

function onDocumentPointerDown(event: PointerEvent): void {
  if (popoverEl.value?.contains(event.target as Node)) return
  if (popover.value?.kind === 'note') saveNote()
  closePopover()
}

function onPopoverKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  event.stopPropagation()
  if (popover.value?.kind === 'note') saveNote()
  closePopover()
}

watch(
  () => popover.value !== null,
  (open) => {
    if (!import.meta.client) return
    if (open) document.addEventListener('pointerdown', onDocumentPointerDown, true)
    else document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  },
)

function closePopover(): void {
  stopFollowing?.()
  stopFollowing = null
  popover.value = null
  pendingAnchor.value = null
  if (import.meta.client) document.removeEventListener('pointerdown', onDocumentPointerDown, true)
}

function clearSelection(): void {
  window.getSelection()?.removeAllRanges()
}

/*
 * "Ask" on a selection, only inside the companion (`/app`), where the AI
 * panel lives; the old course workspace keeps its popover exactly as it was.
 * The passage goes to the companion as a quote chip, and nothing is saved.
 */
const askRoute = useRoute()
const { quiet: quietAi } = useQuietAi()
const canAsk = computed(() => askRoute.path.startsWith('/app') && !quietAi.value)

function askAboutSelection(): void {
  const quote = pendingAnchor.value?.quote?.trim()
  clearSelection()
  closePopover()
  if (quote) useAi().show({ quote })
}

function selectionInside(): Range | null {
  const contentEl = content.value
  const selection = window.getSelection()
  if (!contentEl || !selection || selection.rangeCount === 0 || selection.isCollapsed) return null

  const range = selection.getRangeAt(0)
  if (!contentEl.contains(range.commonAncestorContainer)) return null
  if (popoverEl.value?.contains(range.commonAncestorContainer)) return null

  return range
}

/**
 * A finished selection. With the highlighter armed and a mouse or a stylus,
 * it is a highlight at once; with a finger it waits for the popover, because
 * the handles are still being dragged after the pointer has lifted, and a
 * highlight made while the reader is still choosing is the wrong highlight.
 */
function considerSelection(source: 'pointer' | 'selection'): void {
  if (!props.editable || drawingArmed.value) return

  const range = selectionInside()
  if (!range) {
    if (popover.value?.kind === 'select') closePopover()
    return
  }

  const anchor = anchorFromRange(range)
  if (!anchor) return

  if (textToolArmed.value && source === 'pointer') {
    commit(anchor, props.tool === 'note', props.color, rectOf(range))
    return
  }

  pendingAnchor.value = anchor
  place('select', null, rectOf(range))
}

function onPointerDown(event: PointerEvent): void {
  lastPointerType = event.pointerType
}

function onPointerUp(event: PointerEvent): void {
  if (event.pointerType === 'touch') return
  setTimeout(() => considerSelection('pointer'), 0)
}

function onSelectionChange(): void {
  if (lastPointerType !== 'touch') {
    // A mouse selection that collapsed takes its popover with it.
    if (popover.value?.kind === 'select' && !selectionInside()) closePopover()
    return
  }
  if (selectionTimer) clearTimeout(selectionTimer)
  selectionTimer = setTimeout(() => considerSelection('selection'), 180)
}

onMounted(() => {
  if (props.editable) document.addEventListener('selectionchange', onSelectionChange)
})

watch(
  () => props.editable,
  (on) => {
    if (!import.meta.client) return
    if (on) document.addEventListener('selectionchange', onSelectionChange)
    else document.removeEventListener('selectionchange', onSelectionChange)
  },
)

onBeforeUnmount(() => {
  if (import.meta.client) document.removeEventListener('selectionchange', onSelectionChange)
  if (selectionTimer) clearTimeout(selectionTimer)
})

function commit(
  anchor: HighlightAnchor,
  asNote: boolean,
  color: string,
  rect: DOMRect | null,
): void {
  const uuid = newUuid()
  const base = {
    uuid,
    node_id: props.nodeId,
    block_id: props.blockId,
    anchor,
    updated_at: null,
  }

  clearSelection()

  if (asNote) {
    // Whatever the pen holds, a new note is a note's colour (see NOTE_COLOR).
    const note: NoteAnnotation = {
      ...base,
      kind: 'note',
      data: { color: NOTE_COLOR, text: '', open: noteOpenByDefault() },
    }
    emit('upsert', note)
    openNote(uuid, rect)
    return
  }

  const highlight: HighlightAnnotation = { ...base, kind: 'highlight', data: { color } }
  emit('upsert', highlight)
  closePopover()
}

function commitPending(asNote: boolean, color = props.color): void {
  const anchor = pendingAnchor.value
  if (!anchor || !popover.value) return

  commit(anchor, asNote, color, popoverAnchor())
}

/* -- An existing mark ------------------------------------------------------ */

function rectOfMark(uuid: string): DOMRect | null {
  const contentEl = content.value
  if (!contentEl) return null
  const marks = contentEl.querySelectorAll<HTMLElement>(`mark[data-markup="${uuid}"]`)
  const first = marks[0]
  const last = marks[marks.length - 1]
  if (!first || !last) return null
  const a = first.getBoundingClientRect()
  const b = last.getBoundingClientRect()
  const left = Math.min(a.left, b.left)
  const right = Math.max(a.right, b.right)
  return new DOMRect(left, a.top, right - left, b.bottom - a.top)
}

function onClick(event: MouseEvent): void {
  if (!props.editable || drawingArmed.value) return
  const target = event.target
  if (!(target instanceof Element)) return

  const tag = target.closest<HTMLElement>('[data-markup-note]')
  if (tag?.dataset.markupNote) {
    event.preventDefault()
    openNote(tag.dataset.markupNote, rectOfMark(tag.dataset.markupNote))
    return
  }

  const mark = target.closest<HTMLElement>('mark[data-markup]')
  if (!mark?.dataset.markup) return

  // A click that ended a drag is a selection, not a tap on the mark.
  if (selectionInside()) return

  event.preventDefault()
  place('mark', mark.dataset.markup, rectOfMark(mark.dataset.markup))
}

const current = computed(() => {
  const uuid = popover.value?.uuid
  if (!uuid) return null
  const found = find(uuid)
  return found && (found.kind === 'highlight' || found.kind === 'note') ? found : null
})

function recolour(color: string): void {
  const mark = current.value
  if (!mark) return
  emit(
    'upsert',
    mark.kind === 'note'
      ? { ...mark, data: { color, text: mark.data.text } }
      : { ...mark, data: { color } },
  )
}

function removeCurrent(): void {
  const uuid = popover.value?.uuid
  if (uuid) emit('remove', uuid)
  closePopover()
}

function openNote(uuid: string, rect: DOMRect | null): void {
  const found = find(uuid)
  noteDraft.value = found?.kind === 'note' ? found.data.text : ''
  noteOpen.value = found?.kind === 'note' ? found.data.open !== false : noteOpenByDefault()
  place('note', uuid, rect)
  void nextTick(() => {
    noteField.value?.focus()
    noteField.value?.setSelectionRange(noteDraft.value.length, noteDraft.value.length)
  })
}

/**
 * A note with no words is a highlight — the reader's selection is kept, and
 * nothing asks them to type before they may leave.
 */
function saveNote(): void {
  const uuid = popover.value?.uuid
  if (!uuid) return
  const found = find(uuid)
  if (!found || (found.kind !== 'note' && found.kind !== 'highlight')) return

  const text = noteDraft.value.trim().slice(0, 4000)

  if (text === '') {
    if (found.kind === 'note') {
      const highlight: HighlightAnnotation = {
        ...found,
        kind: 'highlight',
        data: { color: found.data.color },
      }
      emit('upsert', highlight)
    }
    return
  }

  const open = noteOpen.value
  if (found.kind === 'note' && found.data.text === text && (found.data.open !== false) === open) return

  const note: NoteAnnotation = {
    ...found,
    kind: 'note',
    data: { color: found.data.color, text, open },
  }
  emit('upsert', note)
}

/** The box was ticked or cleared: this note, and every new one after it. */
function setNoteOpen(open: boolean): void {
  noteOpen.value = open
  rememberNoteOpen(open)
}

/* -- The notes under the part ---------------------------------------------- */

/** A card was pressed: bring its words into view and open the note on them. */
function openFromCard(uuid: string): void {
  const first = content.value?.querySelector<HTMLElement>(`mark[data-markup="${uuid}"]`)
  first?.scrollIntoView({ block: 'nearest' })
  openNote(uuid, rectOfMark(uuid))
}

/** Pointing at a card lights the words it is about, so a number is never a puzzle. */
function lightMark(uuid: string, on: boolean): void {
  const contentEl = content.value
  if (!contentEl) return
  for (const el of contentEl.querySelectorAll(`mark[data-markup="${uuid}"]`)) {
    el.classList.toggle('is-lit', on)
  }
}

/* A note chip is a button in the text: Enter and Space open it like a click. */
function onContentKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  const tag = (event.target as Element | null)?.closest?.<HTMLElement>('[data-markup-note]')
  const uuid = tag?.dataset.markupNote
  if (!uuid) return
  event.preventDefault()
  openNote(uuid, rectOfMark(uuid))
}

function finishNote(): void {
  saveNote()
  closePopover()
}
</script>

<template>
  <div
    ref="root"
    class="relative"
  >
    <div
      ref="content"
      :class="['markup-content', editable && 'is-editable', textToolArmed && 'is-marking']"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
      @click="onClick"
      @keydown="onContentKeydown"
    >
      <slot />
    </div>

    <!-- Open notes, numbered as the words they are on. Outside the content
         box on purpose: the part's ink is measured against that box, and a
         note card appearing must not stretch a drawing. -->
    <ol
      v-if="noteCards.length"
      class="mt-3 grid gap-1.5"
      aria-label="Your notes on this part"
    >
      <li
        v-for="card in noteCards"
        :key="card.uuid"
      >
        <button
          type="button"
          class="note-card flex w-full cursor-pointer items-start gap-2.5 rounded-[12px] py-2.5 pr-3 pl-2.5 text-left transition-colors"
          :style="{ '--mark': card.color }"
          :title="editable ? 'Open this note' : undefined"
          @click="editable && openFromCard(card.uuid)"
          @pointerenter="lightMark(card.uuid, true)"
          @pointerleave="lightMark(card.uuid, false)"
          @focus="lightMark(card.uuid, true)"
          @blur="lightMark(card.uuid, false)"
        >
          <span class="note-number mt-px shrink-0">{{ card.number }}</span>
          <span class="min-w-0 flex-1">
            <span class="block text-[13.5px] leading-relaxed whitespace-pre-wrap text-text-body">{{
              card.text
            }}</span>
            <span class="mt-0.5 block truncate text-[12px] text-text-faint">on “{{ card.quote }}”</span>
          </span>
        </button>
      </li>
    </ol>

    <!-- The drawing surface over the whole part. Below the picture surfaces:
         a stroke over a picture lands on the picture's own layer (which never
         drifts), everything else lands here. -->
    <div
      v-if="blockBox && (blockInk || blockLabels.length || (editable && (drawingArmed || textToolPlacing)))"
      class="pointer-events-none absolute z-20"
      :style="{
        left: `${blockBox.left}px`,
        top: `${blockBox.top}px`,
        width: `${blockBox.width}px`,
        height: `${blockBox.height}px`,
      }"
    >
      <!-- Reach: half the 40px between parts, so a stroke can start in the gap, and run
           on into the parts above and below it (an arrow from a table to its paragraph). -->
      <InkLayer
        :strokes="blockInk?.data.strokes ?? NONE"
        :tool="tool"
        :color="color"
        :size="size"
        :armed="armed && editable"
        :box="{ width: blockBox.width, height: blockBox.height }"
        :reach="20"
        @add="onBlockAdd"
        @erase="onBlockErase"
        @miss="onEraseMiss"
      />
      <TextLayer
        :items="blockLabels"
        :tool="tool"
        :armed="armed"
        :color="color"
        :box="{ width: blockBox.width, height: blockBox.height }"
        :reference-width="blockBox.width"
        :editable="editable"
        @place="(x, y) => placeLabel('block', null, x, y)"
        @update="updateLabel"
        @remove="removeLabel"
      />
    </div>

    <!-- One drawing surface per picture, laid over its painted pixels. -->
    <template
      v-for="placed in images"
      :key="placed.index"
    >
      <div
        v-if="wantsLayer(placed)"
        class="pointer-events-none absolute z-30"
        :style="{
          left: `${placed.left}px`,
          top: `${placed.top}px`,
          width: `${placed.width}px`,
          height: `${placed.height}px`,
        }"
      >
        <InkLayer
          :strokes="strokesFor(placed)"
          :tool="tool"
          :color="color"
          :size="size"
          :armed="armed && editable"
          :box="{ width: placed.width, height: placed.height }"
          @add="onAdd(placed, $event)"
          @erase="onErase(placed, $event)"
          @miss="onEraseMiss"
        />
        <TextLayer
          :items="labelsFor(placed)"
          :tool="tool"
          :armed="armed"
          :color="color"
          :box="{ width: placed.width, height: placed.height }"
          :reference-width="placed.width"
          :editable="editable"
          @place="(x, y) => placeLabel('media', placed, x, y)"
          @update="updateLabel"
          @remove="removeLabel"
        />
      </div>
    </template>

    <!-- The one popover: what to do with a selection, a highlight, or a note.
         At the body, so no part's width or column's overflow cuts it off. -->
    <Teleport to="body">
      <div
        v-if="popover"
        ref="popoverEl"
        class="pop-in fixed z-[98] max-w-[calc(100vw-16px)] rounded-[16px] bg-surface shadow-pop ring-1 ring-border"
        :class="[popover.kind === 'note' ? 'w-[264px] p-2' : 'w-max p-1', readingTheme]"
        :style="popoverStyle"
        @keydown="onPopoverKeydown"
      >
        <!-- A fresh selection -->
        <div
          v-if="popover.kind === 'select'"
          class="flex items-center gap-0.5"
        >
          <button
            v-for="ink in menuInks"
            :key="ink.value"
            type="button"
            :title="`Highlight in ${ink.name.toLowerCase()}`"
            :aria-label="`Highlight in ${ink.name.toLowerCase()}`"
            class="grid size-7 cursor-pointer place-items-center rounded-full hover:bg-surface-sunken"
            @click="commitPending(false, ink.value)"
          >
            <span
              class="block size-3.5 rounded-full"
              :style="{ backgroundColor: ink.value }"
            />
          </button>
          <span class="mx-0.5 h-4 w-px bg-border-strong" />
          <button
            type="button"
            class="h-7 cursor-pointer rounded-full px-2.5 text-[12.5px] font-semibold text-text-dim hover:bg-surface-mute"
            @click="commitPending(true)"
          >
            Note
          </button>
          <button
            v-if="canAsk"
            type="button"
            class="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full pr-2.5 pl-2 text-[12.5px] font-semibold text-text-dim hover:bg-surface-mute"
            title="Ask Bili about this"
            @click="askAboutSelection"
          >
            <UiIcon
              name="spark"
              :size="12"
              class="text-accent-strong"
            />
            Ask
          </button>
        </div>

        <!-- An existing highlight -->
        <div
          v-else-if="popover.kind === 'mark' && current"
          class="flex items-center gap-0.5"
        >
          <button
            v-for="ink in menuInks"
            :key="ink.value"
            type="button"
            :title="ink.name"
            :aria-label="ink.name"
            :aria-pressed="current.data.color === ink.value"
            class="grid size-7 cursor-pointer place-items-center rounded-full hover:bg-surface-sunken"
            @click="recolour(ink.value)"
          >
            <span
              class="block rounded-full"
              :class="
                current.data.color === ink.value
                  ? 'size-4 ring-2 ring-offset-1 ring-offset-surface'
                  : 'size-3.5'
              "
              :style="{ backgroundColor: ink.value, color: ink.value }"
            />
          </button>
          <span class="mx-0.5 h-4 w-px bg-border-strong" />
          <button
            type="button"
            class="h-7 cursor-pointer rounded-full px-2.5 text-[12.5px] font-semibold whitespace-nowrap text-text-dim hover:bg-surface-mute"
            @click="openNote(current.uuid, rectOfMark(current.uuid))"
          >
            {{ current.kind === 'note' ? 'Edit note' : 'Add note' }}
          </button>
          <button
            type="button"
            title="Remove highlight"
            aria-label="Remove highlight"
            class="grid size-7 cursor-pointer place-items-center rounded-full text-danger hover:bg-danger-soft"
            @click="removeCurrent"
          >
            <UiIcon
              name="trash"
              :size="14"
            />
          </button>
        </div>

        <!-- The note itself -->
        <div v-else-if="popover.kind === 'note'">
          <textarea
            ref="noteField"
            v-model="noteDraft"
            rows="3"
            maxlength="4000"
            placeholder="A note to yourself…"
            aria-label="Note"
            class="block w-full resize-none rounded-[10px] border border-border-field bg-surface px-2.5 py-2 text-[13px] leading-relaxed text-text-body placeholder:text-text-faint focus:border-hi-2 focus:outline-none"
            @keydown.enter.meta.prevent="finishNote"
            @keydown.enter.ctrl.prevent="finishNote"
          />
          <div class="mt-1.5 flex items-center gap-1">
            <button
              type="button"
              class="cursor-pointer rounded-md px-1.5 py-1 text-[12px] text-text-faint hover:text-danger"
              @click="removeCurrent"
            >
              Remove
            </button>
            <span class="flex-1" />
            <!-- Open: a numbered card under the part. Folded: a note mark on
                 the words only. The choice carries over to the next note. -->
            <label
              class="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] text-text-soft hover:text-text"
              title="Show this note in a card under the part. Unticked, it folds to a mark on the words."
            >
              <input
                type="checkbox"
                :checked="noteOpen"
                class="size-3.5 cursor-pointer accent-brand"
                @change="setNoteOpen(($event.target as HTMLInputElement).checked)"
              />
              Keep open
            </label>
            <UiBtn
              variant="primary"
              size="xs"
              @click="finishNote"
            >
              Done
            </UiBtn>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Painted marks are inserted after render, so they carry no scope attribute;
   :deep reaches them through the scoped wrapper. */
.markup-content :deep(mark[data-markup]) {
  color: inherit;
  border-radius: 2px;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}

.markup-content.is-editable :deep(mark[data-markup]) {
  cursor: pointer;
}

/* A note is pointed at, not shouted: a faint wash, a solid underline. */
.markup-content :deep(mark[data-markup-kind='note']) {
  text-decoration: underline solid;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}

/* Its words, lit while the card about them is pointed at. */
.markup-content :deep(mark[data-markup].is-lit) {
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--mark) 55%, transparent);
}

/* The note's tag on the words: its number, footnote-style, or a small note
   glyph when it is folded. Raised like a superscript without changing the
   line's height. */
.markup-content :deep([data-markup-note]),
.note-number {
  display: inline-grid;
  place-items: center;
  min-width: 1.45em;
  height: 1.45em;
  padding: 0 0.3em;
  border-radius: 9999px;
  background: color-mix(in oklab, var(--mark) 24%, transparent);
  color: color-mix(in oklab, var(--mark) 62%, var(--text));
  font-size: 0.68em;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.markup-content :deep([data-markup-note]) {
  position: relative;
  top: -0.5em;
  margin-left: 2px;
  vertical-align: baseline;
  cursor: pointer;
  user-select: none;
}

.markup-content :deep([data-markup-note]:hover),
.markup-content :deep([data-markup-note]:focus-visible) {
  background: color-mix(in oklab, var(--mark) 40%, transparent);
  outline: none;
}

.markup-content :deep([data-markup-note].is-folded svg) {
  width: 1.05em;
  height: 1.05em;
}

.note-number {
  font-size: 11px;
}

.note-card {
  /* Its ink as a wash and a hairline, never a stripe down the side. */
  background: color-mix(in oklab, var(--mark) 9%, var(--surface));
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--mark) 30%, transparent);
}

.note-card:hover {
  background: color-mix(in oklab, var(--mark) 12%, var(--surface));
}

.markup-content.is-marking {
  cursor: text;
}
</style>
