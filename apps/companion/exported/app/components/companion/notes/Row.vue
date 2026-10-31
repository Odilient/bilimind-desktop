<script setup lang="ts">
import type { Note } from '~/companion/notes/tree'
import { highlight, isDoc, noteIcon } from '~/companion/notes/tree'
import { courseColor } from '~/companion/colors'
import { NOTES_LIST, type DropZone } from '~/companion/notes/ui'
import {
  clearSelection,
  isExpanded,
  renamingId,
  selectRange,
  selection,
  setExpanded,
  toggleSelected,
  useNoteActions,
} from '~/companion/notes/actions'
import { useCompanion } from '~/companion/store'

/**
 * One note in a list of notes (a page, a whiteboard, an upload, a link, a
 * recording, a photo, each with its glyph) and, unless `flat`, the notes
 * under it, folded. The old workspace sidebar's row, grown the things a
 * tree needs: a chevron that folds, an indent per level, the two hover
 * actions (a page inside, and "…"), drag and drop, and picking several.
 *
 * The chevron sits before the icon and is there only when something is
 * under the row, so a list of leaves reads as a plain list. Folding animates
 * the children's height (a 0fr → 1fr grid row), so nothing jumps.
 *
 * Drag a row onto another: its top quarter puts it before, its bottom quarter
 * after, the middle inside (the row it lands on gets the tint; between rows a
 * cobalt line says where). An open row with pages under it takes "after" as
 * "inside", where the line would be drawn anyway. Only a page or a board
 * takes notes inside it; a file or a link has a before and an after.
 *
 * Where the list allows it (`select`, Notes' sidebar on a desk), ⌘/Ctrl-click
 * adds a row to the selection and Shift-click everything between; picked
 * rows wear the cobalt tint and drag together.
 *
 * Keys, on a focused row: → unfolds (or steps into the first page under it),
 * ← folds (or steps out to the row above it), F2 renames. ↑/↓ are the list's.
 */
const props = withDefaults(
  defineProps<{
    note: Note
    depth?: number
    /** A row in Recent, Pinned or the results: no children, the course's dot on the right. */
    flat?: boolean
    /** Words to mark in the title (search results). */
    query?: string
  }>(),
  { depth: 0, flat: false, query: '' },
)

const list = inject(NOTES_LIST)!
const NuxtLink = resolveComponent('NuxtLink')
const actions = useNoteActions()
const store = useCompanion()

const kids = computed(() => (props.flat ? [] : (actions.tree.value.children.get(props.note.id) ?? [])))
const open = computed(() => kids.value.length > 0 && isExpanded(props.note.id))
const active = computed(() => list.activeId.value === props.note.id)
// The same note can be listed twice (Recent and its folder): the row asked is the one that renames.
const self = `${props.note.id}:${useId()}`
const renaming = computed(() => renamingId.value === self)
const subject = computed(() => (props.flat ? store.get('subjects', props.note.subject_id) : null))
const menuOpen = ref(false)

const pieces = computed(() => highlight(props.note.title || 'Untitled', props.query))
const picked = computed(() => Boolean(list.select) && selection.value.has(props.note.id))

/* -- Clicks: open, or pick ---------------------------------------------------- */

/** Every row's id on screen, top to bottom, for Shift-click's range. */
function order(): string[] {
  const tree = row.value?.closest('[role="tree"]')
  const ids = [...(tree?.querySelectorAll<HTMLElement>('[data-sel-id]') ?? [])]
    .filter((el) => !el.closest('[inert]'))
    .map((el) => el.dataset.selId!)
  return [...new Set(ids)]
}

function onClick(event: MouseEvent): void {
  if (list.select && !list.roomy) {
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault()
      toggleSelected(props.note.id)
      return
    }
    if (event.shiftKey) {
      event.preventDefault()
      selectRange(props.note.id, order())
      return
    }
    clearSelection()
  }
  if (!list.linkTo) list.open?.(props.note)
}

function toggle(): void {
  setExpanded(props.note.id, !open.value)
}

/* -- Rename in place --------------------------------------------------------- */

const draft = ref('')
const field = ref<HTMLInputElement | null>(null)

watch(
  renaming,
  (on) => {
    if (!on) return
    draft.value = props.note.title
    nextTick(() => {
      field.value?.focus()
      field.value?.select()
    })
  },
  { immediate: true },
)

function finishRename(save: boolean): void {
  if (!renaming.value) return
  renamingId.value = null
  if (save) void actions.rename(props.note, draft.value)
  nextTick(() => link.value?.focus())
}

/* -- Keys -------------------------------------------------------------------- */

const row = ref<HTMLElement | null>(null)
const link = computed<HTMLElement | null>(() => row.value?.querySelector<HTMLElement>('[data-note-link]') ?? null)

function onKey(event: KeyboardEvent): void {
  if (event.key === 'F2') {
    event.preventDefault()
    renamingId.value = self
  } else if (event.key === 'ArrowRight' && kids.value.length) {
    event.preventDefault()
    if (!open.value) setExpanded(props.note.id, true)
    else row.value?.parentElement?.querySelector<HTMLElement>('[data-kids] [data-note-link]')?.focus()
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    if (open.value) setExpanded(props.note.id, false)
    else row.value?.parentElement?.parentElement?.closest('[data-note-item]')?.querySelector<HTMLElement>('[data-note-link]')?.focus()
  }
}

/* -- Drag and drop ----------------------------------------------------------- */

const canDrag = computed(() => Boolean(list.drag && list.drop) && !renaming.value && !list.roomy)
const dropZone = computed<DropZone | null>(() =>
  list.drag?.over === props.note.id && list.drag.id !== props.note.id ? list.drag.zone : null,
)

/**
 * A selected row takes the whole selection, drawn as one small pill ("3
 * notes") under the pointer instead of the browser's picture of one row.
 */
function onDragStart(event: DragEvent): void {
  if (!canDrag.value || !list.drag) return
  const many = picked.value && selection.value.size > 1
  if (!picked.value) clearSelection()
  list.drag.id = props.note.id
  list.drag.ids = many ? order().filter((id) => selection.value.has(id)) : null
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', props.note.title || 'Untitled')
    if (many) {
      const ghost = document.createElement('div')
      ghost.textContent = `${selection.value.size} notes`
      ghost.style.cssText =
        'position:fixed;top:-100px;left:-100px;padding:6px 12px;border-radius:999px;font:600 13px Inter,sans-serif;background:var(--ink);color:var(--surface)'
      document.body.appendChild(ghost)
      event.dataTransfer.setDragImage(ghost, 14, 14)
      setTimeout(() => ghost.remove(), 0)
    }
  }
}

function onDragEnd(): void {
  if (!list.drag) return
  list.drag.id = null
  list.drag.ids = null
  list.drag.over = null
  list.drag.zone = null
}

function zoneAt(event: DragEvent): DropZone {
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const y = (event.clientY - box.top) / box.height
  if (props.flat || !isDoc(props.note)) return y < 0.5 ? 'before' : 'after'
  if (y < 0.28) return 'before'
  if (y > 0.72 && !open.value) return 'after'
  return 'inside'
}

function onDragOver(event: DragEvent): void {
  const drag = list.drag
  if (!drag?.id || drag.id === props.note.id || props.flat) return
  // Not into its own subtree.
  const dragged = actions.tree.value.byId.get(drag.id)
  if (!dragged) return
  let at = actions.tree.value.parent.get(props.note.id)
  while (at) {
    if (at.id === drag.id) return
    at = actions.tree.value.parent.get(at.id)
  }
  if (drag.ids?.includes(props.note.id)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  drag.over = props.note.id
  drag.zone = zoneAt(event)
}

function onDragLeave(event: DragEvent): void {
  const drag = list.drag
  if (!drag || drag.over !== props.note.id) return
  if ((event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) return
  drag.over = null
  drag.zone = null
}

function onDrop(event: DragEvent): void {
  const drag = list.drag
  if (!drag?.id || !drag.zone || !list.drop) return
  event.preventDefault()
  const t = actions.tree.value
  const dragged = t.byId.get(drag.id)
  const many = drag.ids?.map((id) => t.byId.get(id)).filter((n): n is Note => Boolean(n))
  const zone = drag.zone
  onDragEnd()
  if (dragged) list.drop(dragged, props.note, zone, many && many.length > 1 ? many : undefined)
  if (many && many.length > 1) clearSelection()
}

/* -- The row's "…" ----------------------------------------------------------- */

const menu = computed(() =>
  actions.menuFor(props.note, {
    rename: () => (renamingId.value = self),
    addInside: props.note.kind === 'page' ? () => list.addInside(props.note) : undefined,
    inCourse: list.inCourse,
  }),
)

const indent = computed(() => (props.flat ? 6 : 6 + props.depth * 14))
</script>

<template>
  <div
    data-note-item
    role="treeitem"
    :aria-level="depth + 1"
    :aria-expanded="kids.length ? open : undefined"
    :aria-selected="active || picked"
  >
    <div
      ref="row"
      :draggable="canDrag"
      :class="[
        'group/row relative flex items-center gap-0.5 rounded-[8px] pr-1 transition-colors duration-150',
        list.roomy ? 'min-h-11' : 'min-h-[30px]',
        dropZone === 'inside'
          ? 'bg-brand-soft shadow-[inset_0_0_0_1px_var(--brand-line)]'
          : picked
            ? 'bg-cobalt-soft'
            : active
              ? 'bg-accent-soft'
              : 'hover:bg-surface-mute focus-within:bg-surface-mute',
        (list.drag?.id === note.id || list.drag?.ids?.includes(note.id)) && 'opacity-45',
      ]"
      :data-sel-id="flat ? undefined : note.id"
      :style="{ paddingLeft: `${indent}px` }"
      @dragstart="onDragStart"
      @dragend="onDragEnd"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
      @keydown="onKey"
    >
      <!-- Where a dragged row would land, between this row and its neighbour. -->
      <span
        v-if="dropZone === 'before' || dropZone === 'after'"
        :class="[
          'pointer-events-none absolute right-1 z-[1] h-[2px] rounded-full bg-cobalt',
          dropZone === 'before' ? '-top-px' : '-bottom-px',
        ]"
        :style="{ left: `${indent + 18}px` }"
      />

      <button
        v-if="kids.length"
        type="button"
        tabindex="-1"
        :aria-label="open ? `Fold ${note.title || 'Untitled'}` : `Unfold ${note.title || 'Untitled'}`"
        :class="[
          'grid shrink-0 cursor-pointer place-items-center rounded-[6px] text-text-faint transition-colors hover:bg-surface-track hover:text-text-soft',
          list.roomy ? 'size-8' : 'size-[20px]',
        ]"
        @click.stop.prevent="toggle"
      >
        <UiIcon
          name="chevron-right"
          :size="list.roomy ? 16 : 13"
          :stroke="2.2"
          :class="['transition-transform duration-150', open && 'rotate-90']"
        />
      </button>
      <span
        v-else-if="!flat"
        :class="['shrink-0', list.roomy ? 'w-8' : 'w-[20px]']"
        aria-hidden="true"
      />

      <!-- The name field, while renaming. -->
      <div
        v-if="renaming"
        class="flex min-w-0 flex-1 items-center gap-2 py-0.5 pl-1"
      >
        <CompanionIcon
          :name="noteIcon(note)"
          :size="list.roomy ? 17 : 15"
          class="shrink-0 text-text-faint"
        />
        <input
          ref="field"
          v-model="draft"
          type="text"
          maxlength="160"
          :aria-label="`Rename ${note.title || 'Untitled'}`"
          :class="[
            'h-[26px] min-w-0 flex-1 rounded-[6px] bg-surface px-1.5 text-text outline-2 outline-cobalt',
            list.roomy ? 'text-[15px]' : 'text-[13px]',
          ]"
          @keydown.enter.prevent="finishRename(true)"
          @keydown.esc.prevent.stop="finishRename(false)"
          @blur="finishRename(true)"
        >
      </div>

      <component
        :is="list.linkTo ? NuxtLink : 'button'"
        v-else
        v-bind="list.linkTo ? { to: list.linkTo(note) } : { type: 'button' }"
        data-note-link
        :draggable="false"
        :aria-current="active ? 'page' : undefined"
        :title="list.select && !list.roomy ? `${note.title || 'Untitled'} · Ctrl/⌘-click to pick more` : note.title || 'Untitled'"
        :class="[
          'flex min-w-0 flex-1 cursor-pointer items-center gap-2 self-stretch rounded-[7px] pl-1 text-left outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--cobalt)]',
        ]"
        @click="onClick"
      >
        <CompanionIcon
          :name="noteIcon(note)"
          :size="list.roomy ? 17 : 15"
          :class="['shrink-0', active ? 'text-text-soft' : 'text-text-faint']"
        />
        <span
          :class="[
            'min-w-0 flex-1 truncate leading-[1.3]',
            list.roomy ? 'text-[15px]' : 'text-[13px]',
            !note.title ? 'text-text-faint' : active ? 'font-semibold text-text' : 'text-text-body',
          ]"
        ><template
          v-for="(piece, index) in pieces"
          :key="index"
        ><mark
          v-if="piece.hit"
          class="rounded-[3px] bg-accent-soft px-px text-text shadow-[inset_0_-2px_0_var(--accent)]"
        >{{ piece.text }}</mark><template v-else>{{ piece.text }}</template></template></span>
        <span
          v-if="list.openIds?.value.has(note.id) && !active"
          class="size-[5px] shrink-0 rounded-full bg-border-dashed"
          title="Open in a background tab"
        />
        <span
          v-if="subject"
          class="size-[7px] shrink-0 rounded-full"
          :style="{ background: courseColor(subject.color) }"
          :title="subject.title"
        />
      </component>

      <!-- Hover actions: a page inside this one, and the rest. -->
      <div
        v-if="!renaming"
        :class="[
          'flex shrink-0 items-center gap-px transition-opacity duration-150',
          list.roomy || menuOpen
            ? 'opacity-100'
            : 'opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100',
        ]"
      >
        <button
          v-if="note.kind === 'page' && !flat && !list.roomy"
          type="button"
          tabindex="-1"
          :aria-label="`Add a page inside ${note.title || 'Untitled'}`"
          title="Add a page inside"
          class="grid size-[22px] cursor-pointer place-items-center rounded-[6px] text-text-faint transition-colors hover:bg-surface-track hover:text-text-soft"
          @click.stop.prevent="list.addInside(note)"
        >
          <UiIcon
            name="plus"
            :size="14"
            :stroke="2"
          />
        </button>
        <CompanionNotesMenu
          v-model:open="menuOpen"
          :items="menu"
          :label="`More for ${note.title || 'Untitled'}`"
          :title="note.title || 'Untitled'"
        >
          <template #default="{ toggle: toggleMenu }">
            <button
              type="button"
              :tabindex="list.roomy ? 0 : -1"
              :aria-label="`More for ${note.title || 'Untitled'}`"
              title="Rename, pin, move, delete"
              aria-haspopup="menu"
              :aria-expanded="menuOpen"
              :class="[
                'grid cursor-pointer place-items-center rounded-[6px] transition-colors',
                list.roomy ? 'size-10' : 'size-[22px]',
                menuOpen ? 'bg-surface-track text-text' : 'text-text-faint hover:bg-surface-track hover:text-text-soft',
              ]"
              @click.stop.prevent="toggleMenu"
            >
              <UiIcon
                name="dots"
                :size="list.roomy ? 18 : 15"
              />
            </button>
          </template>
        </CompanionNotesMenu>
      </div>
    </div>

    <!-- What's under it, folded by height so nothing jumps. -->
    <div
      v-if="kids.length"
      data-kids
      role="group"
      class="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
      :style="{ gridTemplateRows: open ? '1fr' : '0fr' }"
      :inert="!open"
    >
      <div class="min-h-0 overflow-hidden">
        <CompanionNotesRow
          v-for="child in kids"
          :key="child.id"
          :note="child"
          :depth="depth + 1"
        />
      </div>
    </div>
  </div>
</template>
