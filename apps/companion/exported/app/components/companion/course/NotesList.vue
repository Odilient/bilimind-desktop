<script setup lang="ts">
import type { Item, Subject } from '~/companion/types'
import type { Note } from '~/companion/notes/tree'
import { NOTES_LIST, type DropZone } from '~/companion/notes/ui'
import { setExpanded, useNoteActions, useNotesTree } from '~/companion/notes/actions'
import { makePage } from '~/companion/notes/make'
import { useCompanion } from '~/companion/store'

/**
 * A course's pages and whiteboards, in its workspace: the same tree as this
 * course's folder in Notes, the same rows (`CompanionNotesRow`), so a page
 * made under another shows under it here too, and the order dragged into
 * place in one is the order in the other. Pages and boards sit together in
 * the order you put them. A new one is made from the "+" on the section's
 * heading (`CompanionCourseSidebar`), so the list is only the notes.
 *
 * Inside the workspace a row opens as a tab beside (`openItem`), never
 * leaving the course. On a desk rows drag: onto a page to go inside it,
 * between rows to reorder.
 *
 * In the sidebar the rows are the lesson list's subtopic rows. On a phone the
 * same list is the course's Notes screen, so `roomy` makes every row 44px
 * for the thumb, with its "…" always showing.
 */
const props = defineProps<{
  subject: Subject
  activeItemId: string | null
  openItemIds: string[]
  roomy?: boolean
}>()

const emit = defineEmits<{ openItem: [item: Item] }>()

const store = useCompanion()
const actions = useNoteActions()
const { tree } = useNotesTree(store)

const roots = computed(() => tree.value.roots.get(props.subject.id) ?? [])

const drag = reactive<{ id: string | null; over: string | null; zone: DropZone | null }>({
  id: null,
  over: null,
  zone: null,
})

provide(NOTES_LIST, {
  activeId: computed(() => props.activeItemId),
  openIds: computed(() => new Set(props.openItemIds)),
  roomy: Boolean(props.roomy),
  inCourse: true,
  open: (note: Note) => emit('openItem', note),
  addInside: (note: Note) => {
    setExpanded(note.id, true)
    void makePage({ parentId: note.id }).then((id) => {
      const made = store.get('items', id)
      if (made) emit('openItem', made)
    })
  },
  drag: props.roomy ? null : drag,
  drop: props.roomy
    ? undefined
    : (note: Note, target: Note, zone: DropZone) => {
        if (zone === 'inside') void actions.nestUnder(note, target)
        else void actions.place(note, target, zone)
      },
})
</script>

<template>
  <div :class="roomy ? 'grid gap-1' : ''">
    <div
      role="tree"
      :aria-label="`${subject.title}: pages and whiteboards`"
    >
      <CompanionNotesRow
        v-for="note in roots"
        :key="note.id"
        :note="note"
      />
    </div>
    <p
      v-if="!roots.length"
      :class="['px-1.5 pb-1 leading-relaxed text-text-muted', roomy ? 'text-[14px]' : 'text-[12.5px]']"
    >
      No pages for this course yet. The + makes one.
    </p>

    <CompanionNotesMoveDialog />
  </div>
</template>
