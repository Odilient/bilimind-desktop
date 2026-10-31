<script setup lang="ts">
import type { Item } from '~/companion/types'
import { noteWord } from '~/companion/notes/tree'
import { useNoteActions } from '~/companion/notes/actions'

/**
 * The 48px bar over a whiteboard, a file, a photo, a link or a recording
 * open in Notes: where it is (the path, with the course picker and its
 * "Add to …?" suggestion; its name renaming in place), whether it's saved,
 * "…", and the companion at the right end. A page draws the same bar itself
 * (`PageWorkspace`'s top bar), as it has actions that need its editor; the
 * parts are the same components. On a phone it is the back arrow, the
 * course picker, "…" and Ask.
 */
const props = defineProps<{
  item: Item
  title: string
  status?: 'loading' | 'saving' | 'saved' | 'offline' | null
}>()

const emit = defineEmits<{ rename: [value: string] }>()

const actions = useNoteActions()

const statusLabel = computed(() => {
  switch (props.status) {
    case 'saving':
      return 'Saving…'
    case 'saved':
      return 'Saved'
    case 'offline':
      return 'Offline, kept on this device'
    default:
      return ''
  }
})

const crumbs = ref<{ startRename: () => void } | null>(null)

function startRename(): void {
  crumbs.value?.startRename()
}

const word = computed(() => noteWord(props.item))

const menu = computed(() =>
  actions.menuFor(props.item, { rename: startRename }),
)
</script>

<template>
  <header class="cp-safe-top relative z-10 shrink-0 border-b border-border bg-surface">
    <div class="flex h-[52px] items-center gap-1.5 pr-2 pl-1 lg:h-12 lg:gap-2 lg:pr-2.5 lg:pl-3">
      <CompanionNotesCrumbs
        class="lg:hidden"
        :item="item"
        :title="title"
        phone
      />
      <CompanionNotesCrumbs
        ref="crumbs"
        class="max-lg:hidden"
        :item="item"
        :title="title"
        renameable
        @rename="emit('rename', $event)"
      />

      <span
        v-if="statusLabel"
        role="status"
        :class="[
          'shrink-0 text-[13px] whitespace-nowrap',
          status === 'offline' ? 'text-warn-text' : 'text-text-muted max-lg:hidden',
        ]"
        :title="status === 'saved' ? 'Every change is saved as you go' : undefined"
      >{{ statusLabel }}</span>

      <CompanionNotesMenu
        :items="menu"
        align="end"
        :label="`More for this ${word}`"
        :title="title || 'Untitled'"
      >
        <template #default="{ toggle, open }">
          <button
            type="button"
            :aria-label="`More for this ${word}`"
            title="Rename, pin, move, delete"
            aria-haspopup="menu"
            :aria-expanded="open"
            :class="[
              'grid size-11 cursor-pointer place-items-center rounded-full transition-colors lg:size-8',
              open ? 'bg-surface-track text-text' : 'text-text-faint hover:bg-surface-track hover:text-text-soft',
            ]"
            @click="toggle"
          >
            <UiIcon
              name="dots"
              :size="18"
            />
          </button>
        </template>
      </CompanionNotesMenu>

      <CompanionAiToggle class="max-lg:hidden" />
      <CompanionAiToggle
        compact
        class="lg:hidden"
      />
    </div>
  </header>
</template>
