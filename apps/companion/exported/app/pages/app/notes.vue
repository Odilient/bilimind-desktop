<script setup lang="ts">
import { useAiContext } from '~/companion/ai/state'
import { useNotesSidebar } from '~/companion/notes/actions'
import { usePanelWidth } from '~/companion/panel-width'

/**
 * Notes, the place: every page and whiteboard, in one workspace that stays
 * put while you move around in it.
 *
 *   ┌ sidebar (272) ─┬──────────── main ────────────┬─ Ask (360) ─┐
 *   │ Notes   [New]  │ Notes / ● Databases / Page   │             │
 *   │ Find a page    │ ──────────────────────────── │             │
 *   │ Recent         │  the page, or the board      │             │
 *   │ My notes  ▸    │  (or Notes' home)            │             │
 *   │ ● Databases ▾  │                              │             │
 *   └────────────────┴──────────────────────────────┴─────────────┘
 *
 * This route is the frame; its children are what's in the middle: the home
 * (`notes/index.vue`) and a page or board by id (`notes/[id].vue`). The frame
 * stays mounted between them, so the sidebar keeps its scroll and folds and
 * the companion its thread while you go from page to page. There are no
 * tabs: a page links to a page, and the browser's Back and Forward walk the
 * way you came, as in Notion.
 *
 * The sidebar folds away with Ctrl/⌘ + \ (remembered per device). On a phone
 * there is no sidebar: the home is the tree, and a doc is the whole screen
 * with a back arrow.
 *
 * "Move to…" lives here because any row or doc may ask for it.
 */
definePageMeta({ layout: 'companion', workspace: true })

const sidebar = useNotesSidebar()
const size = usePanelWidth('column')
// One tree at a time: on a phone the home draws its own, full width.
const isPhone = useIsPhone()

// What the companion sees when nothing narrower is open: all your notes.
useAiContext(() => ({ kind: 'notes', label: 'Your notes' }))

function onKey(event: KeyboardEvent): void {
  if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key === '\\') {
    event.preventDefault()
    sidebar.toggle()
  }
}

onMounted(() => {
  sidebar.restore()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div
    class="flex min-h-0 flex-1 bg-surface"
    :style="{ '--column-w': size.css.value }"
  >
    <Transition
      enter-active-class="transition-[margin,opacity] duration-200 ease-out motion-reduce:transition-none"
      enter-from-class="-ml-[var(--column-w)] opacity-0"
      leave-active-class="transition-[margin,opacity] duration-150 ease-in motion-reduce:transition-none"
      leave-to-class="-ml-[var(--column-w)] opacity-0"
    >
      <CompanionNotesSidebar
        v-if="sidebar.open.value && !isPhone"
        class="max-lg:hidden"
      />
    </Transition>

    <div class="flex min-w-0 flex-1 flex-col">
      <NuxtPage />
    </div>

    <CompanionAiPanel />

    <CompanionNotesMoveDialog />
  </div>
</template>
