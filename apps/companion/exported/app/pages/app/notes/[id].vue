<script setup lang="ts">
import { useCompanion } from '~/companion/store'
import { noteTo } from '~/companion/notes/actions'

/**
 * A note, open in Notes, filling the middle. A page or a whiteboard opens in
 * `NoteTab` / `BoardTab` (finding the row, loading its document, the empty
 * and missing states, and the 48px bar with its path), so it reads the same
 * here and as a tab in its course; an upload, a photo, a link or a recording
 * opens in `CaptureView`, the same bar over the thing itself. This route only
 * says which, from the row when the device already has it; an id it doesn't
 * know yet goes to `NoteTab`, which shows a board as the board it is.
 *
 * On a phone a doc is the whole screen: its own bar (back, the course, Ask)
 * on top, and a page's toolbar resting on the keyboard.
 *
 * Deleted while open, from wherever (its own "…", a row in Notes, a course's
 * list, another device), the view closes: to the page it sat under when
 * that is still here, else to Notes. A delete's Undo is in its toast.
 */
definePageMeta({ layout: 'companion', workspace: true, fullscreen: 'phone' })

const route = useRoute()
const store = useCompanion()

const id = computed(() => String(route.params.id ?? ''))
const kind = computed(() => store.get('items', id.value)?.kind ?? null)

store.onGone('items', () => id.value, (gone) => {
  const parent = store.get('items', gone.parent_id)
  void navigateTo(parent ? noteTo(parent.id) : '/app/notes', { replace: true })
})
</script>

<template>
  <CompanionNotesCaptureView
    v-if="kind && kind !== 'board' && kind !== 'page'"
    :key="`capture:${id}`"
    :item-id="id"
  />
  <CompanionCourseBoardTab
    v-else-if="kind === 'board'"
    :key="`board:${id}`"
    :item-id="id"
    :embedded="false"
  />
  <CompanionCourseNoteTab
    v-else
    :key="`page:${id}`"
    :item-id="id"
    :embedded="false"
  />
</template>
