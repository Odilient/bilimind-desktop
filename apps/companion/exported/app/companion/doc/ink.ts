import * as Y from 'yjs'
import type { BoardLabel, Stroke, StrokePoint } from '~/types/api'

/**
 * A note's drawing: the strokes and the text labels the lesson's pen tray
 * puts on a note, kept inside the note's own Y.Doc, beside its text. So ink
 * syncs, works offline and goes to the demo exactly as the words do, with no
 * second store and no second save.
 *
 *   ink    a Y.Array of strokes, oldest first (the eraser removes by index)
 *   labels a Y.Map of labels by id
 *
 * The lesson's `InkLayer` and `TextLayer` draw them. Those take points as
 * 0..1 of the box they cover, which suits a picture; a note's box grows with
 * every line typed, and a circle stored against its height would stretch as
 * the note got longer. So here x is 0..1 of the note's width, y is measured
 * in widths from the top (y px / width px), and `toBox`/`fromBox` convert at
 * the layer's edge. A mark stays where it was put while the note grows, and
 * scales with the column when the window does, the same approximation a
 * lesson's ink makes over a paragraph.
 *
 * Undo and redo are the tray's, and cover only what the tray did: Yjs's undo
 * manager scoped to these two types and to this device's own changes, so
 * undoing a stroke never takes back typing, or someone else's ink.
 */

export type NoteLabel = BoardLabel & { ref?: number }

const ORIGIN = Symbol('note-ink')

export function useNoteInk(ydoc: Y.Doc) {
  const ink = ydoc.getArray<Stroke>('ink')
  const labelMap = ydoc.getMap<NoteLabel>('labels')
  const undo = new Y.UndoManager([ink, labelMap], { trackedOrigins: new Set([ORIGIN]) })

  const strokes = shallowRef<Stroke[]>(ink.toArray())
  const labels = shallowRef<NoteLabel[]>([...labelMap.values()])
  const canUndo = ref(false)
  const canRedo = ref(false)

  const readInk = () => (strokes.value = ink.toArray())
  const readLabels = () => (labels.value = [...labelMap.values()])
  const readStack = () => {
    canUndo.value = undo.canUndo()
    canRedo.value = undo.canRedo()
  }

  ink.observe(readInk)
  labelMap.observe(readLabels)
  undo.on('stack-item-added', readStack)
  undo.on('stack-item-popped', readStack)
  undo.on('stack-cleared', readStack)

  if (getCurrentScope()) {
    onScopeDispose(() => {
      ink.unobserve(readInk)
      labelMap.unobserve(readLabels)
      undo.destroy()
    })
  }

  const change = (fn: () => void) => ydoc.transact(fn, ORIGIN)

  return {
    strokes,
    labels,
    canUndo,
    canRedo,
    add(stroke: Stroke) {
      change(() => ink.push([stroke]))
    },
    erase(index: number) {
      if (index >= 0 && index < ink.length) change(() => ink.delete(index, 1))
    },
    setLabel(label: NoteLabel) {
      change(() => labelMap.set(label.id, label))
    },
    removeLabel(id: string) {
      if (labelMap.has(id)) change(() => labelMap.delete(id))
    },
    undo: () => undo.undo(),
    redo: () => undo.redo(),
  }
}

export type NoteInk = ReturnType<typeof useNoteInk>

/** A box `width` × `height` px, as the layers see it: y as 0..1 of the height. */
function yToBox(y: number, width: number, height: number): number {
  return height > 0 ? (y * width) / height : 0
}

function yFromBox(y: number, width: number, height: number): number {
  return width > 0 ? (y * height) / width : 0
}

export function strokeToBox(stroke: Stroke, width: number, height: number): Stroke {
  return {
    ...stroke,
    points: stroke.points.map((p) =>
      (p.length === 3 ? [p[0], yToBox(p[1], width, height), p[2]] : [p[0], yToBox(p[1], width, height)]) as StrokePoint,
    ),
  }
}

export function strokeFromBox(stroke: Stroke, width: number, height: number): Stroke {
  const round = (n: number) => Math.round(n * 10_000) / 10_000
  return {
    ...stroke,
    points: stroke.points.map((p) =>
      (p.length === 3
        ? [p[0], round(yFromBox(p[1], width, height)), p[2]]
        : [p[0], round(yFromBox(p[1], width, height))]) as StrokePoint,
    ),
  }
}

export function labelToBox<T extends { y: number }>(label: T, width: number, height: number): T {
  return { ...label, y: yToBox(label.y, width, height) }
}

export function labelFromBox<T extends { y: number }>(label: T, width: number, height: number): T {
  return { ...label, y: Math.round(yFromBox(label.y, width, height) * 10_000) / 10_000 }
}
