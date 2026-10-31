<script setup lang="ts">
import type { Item } from '~/companion/types'
import { useNoteActions } from '~/companion/notes/actions'
import { noteIcon, noteWord } from '~/companion/notes/tree'
import { fetchFileUrl, knownFileUrl } from '~/companion/files'
import { newChatLink } from '~/companion/ai/routes'
import { useAiContext } from '~/companion/ai/state'
import { useQuietAi } from '~/companion/quiet-ai'
import { durationLabel, untilLabel } from '~/companion/time'
import { useCompanion } from '~/companion/store'

/**
 * An upload, a photo, a link or a recording, open in Notes: the same 48px
 * bar as a page or a board (the path, the course picker, "Add to …?", "…"),
 * and under it the thing itself, as large as it will go.
 *
 *  - a photo fills the width, up to most of the screen's height;
 *  - a PDF opens in the browser's own reader, inline; any other file is a
 *    card with its name, type and size, Open and Download;
 *  - a link is its address, the site it's on, and Open (a new tab);
 *  - a recording is a player, with its length.
 *
 * The bytes come from the item's signed link when the device has one, else
 * from the API (`fetchFileUrl`), which signs a fresh one; the demo's seeded
 * photos and recordings have none, and say so instead of drawing a broken
 * image. Nothing here plays by itself.
 */
const props = defineProps<{ itemId: string }>()

const store = useCompanion()
const actions = useNoteActions()
const { quiet } = useQuietAi()

const item = computed<Item | null>(() => store.get('items', props.itemId))
const missing = computed(() => store.status.ready && (!item.value || Boolean(item.value.deleted_at)))

useHead(() => ({ title: item.value ? `${item.value.title || 'Untitled'} · BiliMind` : 'Notes · BiliMind' }))

// What the companion sees: this note, by name.
useAiContext(() =>
  item.value
    ? { kind: 'notes', label: item.value.title || 'Untitled', itemId: item.value.id, subjectId: item.value.subject_id }
    : null,
)

/* -- The bytes ---------------------------------------------------------------- */

const url = ref<string | null>(null)
const asking = ref(false)

watch(
  () => item.value?.id,
  async (id) => {
    const row = item.value
    url.value = null
    if (!id || !row) return
    if (row.kind === 'link') {
      url.value = row.meta.url ?? null
      return
    }
    const known = knownFileUrl(row)
    if (known) {
      url.value = known
      return
    }
    if (store.status.mode === 'demo') return
    asking.value = true
    url.value = await fetchFileUrl(row)
    if (item.value?.id === id) asking.value = false
  },
  { immediate: true },
)

const mime = computed(() => item.value?.meta.mime ?? '')
const isPdf = computed(() => mime.value === 'application/pdf' || /\.pdf$/i.test(item.value?.title ?? ''))
const isImage = computed(() => item.value?.kind === 'photo' || mime.value.startsWith('image/'))
const isAudio = computed(() => item.value?.kind === 'recording' || mime.value.startsWith('audio/'))

/* -- Words -------------------------------------------------------------------- */

function sizeLabel(bytes: number | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

function typeLabel(row: Item): string {
  if (row.kind === 'link') return 'Link'
  if (row.kind === 'recording') return 'Recording'
  if (row.kind === 'photo') return 'Photo'
  const m = row.meta.mime ?? ''
  if (m === 'application/pdf') return 'PDF'
  if (m.startsWith('image/')) return 'Image'
  if (m.includes('presentation') || m.includes('powerpoint')) return 'Slides'
  if (m.includes('word') || m.includes('document')) return 'Document'
  if (m.includes('sheet') || m.includes('excel') || m === 'text/csv') return 'Spreadsheet'
  const ext = /\.([a-z0-9]{1,5})$/i.exec(row.title)?.[1]
  return ext ? `${ext.toUpperCase()} file` : 'File'
}

const facts = computed(() => {
  const row = item.value
  if (!row) return []
  const added = row.created_at && Date.parse(row.created_at) <= Date.now() ? `added ${untilLabel(row.created_at)}` : ''
  return [
    typeLabel(row),
    row.kind === 'recording' && row.meta.duration_s ? durationLabel(row.meta.duration_s) : sizeLabel(row.meta.size),
    added,
  ].filter(Boolean)
})

const host = computed(() => {
  try {
    return url.value ? new URL(url.value).hostname.replace(/^www\./, '') : ''
  } catch {
    return ''
  }
})

/** Why there's nothing to show: the demo's samples have no bytes behind them. */
const empty = computed(() => {
  const row = item.value
  if (!row || url.value || asking.value) return ''
  if (store.status.mode === 'demo') {
    return row.kind === 'recording'
      ? 'A sample recording in the demo: there is no sound behind it.'
      : `A sample ${noteWord(row)} in the demo: there is nothing behind it to show.`
  }
  return 'It can’t be opened right now. Try again when you’re online.'
})

function rename(value: string): void {
  if (item.value) void actions.rename(item.value, value)
}

function ask(): void {
  if (item.value) void navigateTo(newChatLink({ attach: [item.value.id] }))
}
</script>

<template>
  <div class="relative flex min-h-0 flex-1 flex-col">
    <CompanionNotesDocHeader
      v-if="item && !missing"
      :item="item"
      :title="item.title"
      @rename="rename"
    />

    <div
      v-if="missing"
      class="mx-auto grid max-w-[420px] content-center gap-3 px-6 py-24 text-center"
    >
      <h1 class="t-head text-[28px]">
        This note isn't here
      </h1>
      <p class="text-[15px] text-text-muted">
        It may have been deleted, or it's on a device that hasn't synced yet.
      </p>
      <div>
        <UiBtn
          variant="secondary"
          to="/app/notes"
        >
          Back to Notes
        </UiBtn>
      </div>
    </div>

    <div
      v-else-if="!item"
      class="mx-auto grid w-full max-w-[880px] gap-4 px-6 pt-12"
      aria-busy="true"
    >
      <div class="cp-skel h-5 w-40" />
      <div class="cp-skel h-9 w-2/3" />
      <div class="cp-skel h-[320px] rounded-[18px]" />
    </div>

    <div
      v-else
      class="om-scroll min-h-0 flex-1 overflow-y-auto"
    >
      <article class="animate-rise mx-auto grid w-full max-w-[920px] content-start gap-6 px-5 pt-8 pb-24 lg:px-10 lg:pt-12">
        <header class="grid gap-2">
          <p class="flex items-center gap-2 text-[13px] text-text-muted">
            <CompanionNotesGlyph
              :name="noteIcon(item)"
              :size="15"
              class="shrink-0 text-text-faint"
            />
            <span>{{ facts.join(' · ') }}</span>
          </p>
          <h1 class="t-head text-[28px] break-words lg:text-[34px]">
            {{ item.title || 'Untitled' }}
          </h1>
        </header>

        <!-- A photo, as large as it goes. -->
        <figure
          v-if="isImage && url"
          class="m-0 grid place-items-center overflow-hidden rounded-[18px] bg-surface-sunken"
        >
          <img
            :src="url"
            :alt="item.title"
            class="max-h-[72vh] w-auto max-w-full object-contain"
          >
        </figure>

        <!-- A PDF, in the browser's own reader. -->
        <iframe
          v-else-if="isPdf && url"
          :src="url"
          :title="item.title"
          class="h-[76vh] w-full rounded-[18px] border border-border bg-surface-sunken"
        />

        <!-- A recording: a player, never started by itself. -->
        <div
          v-else-if="isAudio && url"
          class="grid gap-3 rounded-[18px] bg-surface-sunken p-5"
        >
          <audio
            :src="url"
            controls
            preload="none"
            class="w-full"
          />
        </div>

        <!-- A link: where it goes. -->
        <div
          v-else-if="item.kind === 'link'"
          class="grid gap-4 rounded-[18px] p-5 shadow-[inset_0_0_0_1px_var(--border)]"
        >
          <div class="flex min-w-0 items-center gap-3">
            <span class="grid size-11 shrink-0 place-items-center rounded-full bg-cobalt-soft text-cobalt">
              <UiIcon
                name="link"
                :size="19"
              />
            </span>
            <span class="grid min-w-0">
              <span class="truncate text-[15px] font-semibold text-text">{{ host || 'A link' }}</span>
              <span class="text-[13px] break-all text-text-muted">{{ url }}</span>
            </span>
          </div>
          <div class="flex flex-wrap gap-2">
            <UiBtn
              v-if="url"
              variant="primary"
              :href="url"
              trailing-icon="arrow-up-right"
            >
              Open link
            </UiBtn>
          </div>
        </div>

        <!-- Any other file: what it is, and the ways to open it. -->
        <div
          v-else-if="url"
          class="flex flex-wrap items-center gap-4 rounded-[18px] p-5 shadow-[inset_0_0_0_1px_var(--border)]"
        >
          <span class="grid size-14 shrink-0 place-items-center rounded-[14px] bg-surface-sunken text-text-soft">
            <CompanionNotesGlyph
              :name="noteIcon(item)"
              :size="24"
            />
          </span>
          <span class="grid min-w-0 flex-1">
            <span class="truncate text-[15px] font-semibold text-text">{{ item.title }}</span>
            <span class="text-[13px] text-text-muted">{{ facts.slice(0, 2).join(' · ') }}</span>
          </span>
          <span class="flex gap-2">
            <UiBtn
              variant="primary"
              :href="url"
            >
              Open
            </UiBtn>
            <a
              :href="url"
              :download="item.title"
              class="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold text-text shadow-[inset_0_0_0_1px_var(--border-strong)] transition-colors hover:bg-surface-mute focus-visible:outline-2 focus-visible:outline-cobalt"
            >
              <UiIcon
                name="download"
                :size="15"
              />
              Download
            </a>
          </span>
        </div>

        <!-- Still asking for the link. -->
        <div
          v-else-if="asking"
          class="cp-skel h-[220px] rounded-[18px]"
          aria-busy="true"
        />

        <!-- Nothing to show, said plainly. -->
        <div
          v-else
          class="grid min-h-[220px] place-items-center gap-3 rounded-[18px] bg-surface-sunken px-6 py-10 text-center"
        >
          <span class="grid size-14 place-items-center rounded-full bg-surface text-text-faint">
            <CompanionNotesGlyph
              :name="noteIcon(item)"
              :size="24"
            />
          </span>
          <p class="max-w-[44ch] text-[14.5px] text-text-muted">
            {{ empty }}
          </p>
        </div>

        <div
          v-if="!quiet"
          class="flex flex-wrap gap-2"
        >
          <UiBtn
            variant="secondary"
            size="sm"
            :title="`Start a chat with “${item.title || 'this'}” attached`"
            @click="ask"
          >
            <UiIcon
              name="spark"
              :size="14"
              class="text-cobalt"
            />
            Ask about it
          </UiBtn>
        </div>
      </article>
    </div>
  </div>
</template>
