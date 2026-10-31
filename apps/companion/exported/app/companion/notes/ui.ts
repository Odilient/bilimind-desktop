/**
 * What a list of notes hands down to its rows (`CompanionNotesRow`), which
 * are recursive and would otherwise thread a dozen props through every level.
 *
 * Two lists provide it: Notes' sidebar (rows are links, drag and drop is on,
 * several can be picked at once, the open note is the active row) and a
 * course's Notes list in its workspace (rows open a tab beside, via `open`).
 * Rows only read it.
 */
import type { InjectionKey, Ref } from 'vue'
import type { Note } from './tree'

export type DropZone = 'before' | 'after' | 'inside'

export interface NotesListContext {
  /** The note open in front, highlighted and revealed. */
  activeId: Readonly<Ref<string | null>>
  /** Open in a background tab (the course workspace): a small dot on the row. */
  openIds?: Readonly<Ref<ReadonlySet<string>>>
  /** 44px rows and always-visible "…", for a thumb. */
  roomy: boolean
  /** The list is inside its course's workspace: no "Open in its course". */
  inCourse?: boolean
  /** Rows are links to here; without it they call `open`. */
  linkTo?: (note: Note) => string
  open?: (note: Note) => void
  /** A new page under this one, made and opened. */
  addInside: (note: Note) => void
  /**
   * Desktop drag and drop. `ids`: every note being dragged when a selected
   * row took the whole selection with it.
   */
  drag: { id: string | null; ids?: string[] | null; over: string | null; zone: DropZone | null } | null
  /** A row dropped on a row; `many` when it carried a selection. */
  drop?: (note: Note, target: Note, zone: DropZone, many?: Note[]) => void
  /** ⌘/Ctrl-click and Shift-click pick several (Notes' sidebar on a desk). */
  select?: boolean
}

export const NOTES_LIST: InjectionKey<NotesListContext> = Symbol('notes-list')
