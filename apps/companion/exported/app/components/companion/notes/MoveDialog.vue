<script setup lang="ts">
import type { Note } from '~/companion/notes/tree'
import { movingId, movingIds, suggestionOf, useNoteActions, useSingleton } from '~/companion/notes/actions'
import { courseColor } from '~/companion/colors'
import { useCompanion } from '~/companion/store'

/**
 * "Move to…": where notes can be filed, as one list (My notes, then every
 * course) with the place they're in now marked, and the course a note in My
 * notes was made for marked "Suggested". A choice moves them there at once,
 * with whatever is inside them, and closes; the toast has Undo. A long list
 * of courses gets a filter that has the focus, so typing two letters and
 * Enter is enough.
 *
 * One note (a row's "…", a doc's "…": `movingId`) or several (the sidebar's
 * selection bar: `movingIds`). Mounted by Notes and by a course's Notes
 * list, drawn by the first of them (`useSingleton`).
 */
const store = useCompanion()
const actions = useNoteActions()
const mine = useSingleton('notes-move')

const notes = computed<Note[]>(() => {
  if (!mine.value) return []
  const t = actions.tree.value
  const ids = movingIds.value?.length ? movingIds.value : movingId.value ? [movingId.value] : []
  return ids.map((id) => t.byId.get(id)).filter((n): n is Note => Boolean(n))
})
const note = computed(() => (notes.value.length === 1 ? notes.value[0]! : null))

const open = computed({
  get: () => notes.value.length > 0,
  set: (value: boolean) => {
    if (!value) {
      movingId.value = null
      movingIds.value = null
    }
  },
})

const heading = computed(() =>
  note.value ? `Move “${note.value.title || 'Untitled'}” to…` : `Move ${notes.value.length} notes to…`,
)

const query = ref('')
watch(open, (isOpen) => {
  if (isOpen) query.value = ''
})

const suggested = computed(() => (note.value ? (suggestionOf(store, note.value)?.subject.id ?? null) : null))

const places = computed(() => {
  const all = [
    { id: null as string | null, title: 'My notes', color: null as string | null },
    ...store.subjects.value.map((s) => ({ id: s.id as string | null, title: s.title, color: courseColor(s.color) })),
  ]
  const q = query.value.trim().toLowerCase()
  return q ? all.filter((p) => p.title.toLowerCase().includes(q)) : all
})

/** Where they all are now, when that's one place. */
const here = computed(() => {
  const at = new Set(notes.value.map((n) => n.subject_id ?? null))
  return at.size === 1 ? [...at][0]! : undefined
})
const nested = computed(() => notes.value.some((n) => Boolean(actions.tree.value.parent.get(n.id))))

function choose(subjectId: string | null): void {
  const list = notes.value
  movingId.value = null
  movingIds.value = null
  if (list.length) void actions.moveMany(list, subjectId)
}

function onEnter(): void {
  const first = places.value.find((p) => p.id !== here.value || nested.value)
  if (first) choose(first.id)
}
</script>

<template>
  <UiModal
    v-model:open="open"
    size="compact"
    :title="heading"
    :description="notes.length > 1 ? 'They go to the top of that list, with anything inside them.' : 'It goes to the top of that list, with anything inside it.'"
  >
    <label
      v-if="store.subjects.value.length > 6"
      class="mb-3 flex h-10 items-center gap-2 rounded-[12px] bg-surface-sunken px-3 text-text-faint focus-within:shadow-[inset_0_0_0_2px_var(--cobalt)]"
    >
      <UiIcon
        name="search"
        :size="15"
        :stroke="2"
      />
      <input
        v-model="query"
        type="text"
        placeholder="Find a course"
        aria-label="Find a course"
        class="min-w-0 flex-1 bg-transparent text-[14px] text-text outline-none placeholder:text-text-faint"
        autofocus
        @keydown.enter.prevent="onEnter"
      >
    </label>
    <ul class="-mx-2 grid max-h-[50vh] gap-0.5 overflow-y-auto">
      <li
        v-for="place in places"
        :key="place.id ?? 'mine'"
      >
        <button
          type="button"
          :disabled="place.id === here && !nested"
          class="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[12px] px-2.5 text-left text-[14.5px] font-medium text-text transition-colors outline-none hover:bg-surface-mute focus-visible:bg-surface-mute focus-visible:shadow-[inset_0_0_0_2px_var(--cobalt)] disabled:cursor-default disabled:hover:bg-transparent"
          @click="choose(place.id)"
        >
          <span
            v-if="place.color"
            class="ml-1 size-2.5 shrink-0 rounded-full"
            :style="{ background: place.color }"
          />
          <CompanionIcon
            v-else
            name="notebook"
            :size="17"
            class="shrink-0 text-text-faint"
          />
          <span class="min-w-0 flex-1 truncate">{{ place.title }}</span>
          <span
            v-if="place.id === here"
            class="shrink-0 text-[12.5px] font-normal text-text-faint"
          >{{ nested ? 'Here, inside a page' : 'Here now' }}</span>
          <span
            v-else-if="place.id && place.id === suggested"
            class="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-[12px] font-medium text-text-soft"
          >Suggested</span>
        </button>
      </li>
      <li
        v-if="!places.length"
        class="px-2.5 py-3 text-[14px] text-text-muted"
      >
        No course by that name.
      </li>
    </ul>
  </UiModal>
</template>
