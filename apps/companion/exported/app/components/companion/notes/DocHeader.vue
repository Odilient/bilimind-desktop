<script setup lang="ts">
const { t } = useI18n()
import type { Item } from '~/companion/types'
import { noteWord } from '~/companion/notes/tree'
import { useNoteActions } from '~/companion/notes/actions'
import { useExport } from '~/companion/export/use-export'

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
      return t('notes.saving')
    case 'saved':
      return t('notes.saved')
    case 'offline':
      return t('notes.offlineKept')
    default:
      return ''
  }
})

const crumbs = ref<{ startRename: () => void } | null>(null)

function startRename(): void {
  crumbs.value?.startRename()
}

const word = computed(() => noteWord(props.item))

const exp = useExport()

/* A whiteboard's "…" also downloads it, whole, as a picture or a printable page, above Delete. */
const menu = computed(() => {
  const all = actions.menuFor(props.item, { rename: startRename })
  if (props.item.kind !== 'board') return all
  const board = props.item
  return [
    ...all.filter((a) => !a.destructive),
    { label: t('notes.downloadPng'), icon: 'image', divider: true, run: () => void exp.board('png', board) },
    { label: t('notes.downloadPdf'), icon: 'file', run: () => void exp.board('pdf', board) },
    ...all.filter((a) => a.destructive),
  ]
})
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
        :title="status === 'saved' ? t('notes.savedAsYouGo') : undefined"
      >{{ statusLabel }}</span>

      <CompanionNotesMenu
        :items="menu"
        align="end"
        :label="t('notes.moreFor', { word })"
        :title="title || t('notes.untitled')"
      >
        <template #default="{ toggle, open }">
          <button
            type="button"
            :aria-label="t('notes.moreFor', { word })"
            :title="t('notes.renamePinMove')"
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
