<script setup lang="ts">
const { t } = useI18n()
import type { Note } from '~/companion/notes/tree'
import { highlight, noteIcon } from '~/companion/notes/tree'
import { noteTo } from '~/companion/notes/actions'
import { knownFileUrl } from '~/companion/files'
import { courseColor } from '~/companion/colors'
import { durationLabel, untilLabel } from '~/companion/time'
import { useCompanion } from '~/companion/store'

/**
 * A note on Notes' home, as a card: enough of it to know it without opening
 * it. Every kind has the same anatomy, so a row of cards can be compared at a
 * glance: a preview of one fixed height, then the kind's glyph and the title
 * (two lines at most), then where it's filed and when it was last touched.
 *
 * The preview is what each kind looks like: a page, its first lines on a
 * sheet; a whiteboard, a corner of canvas with its first few notes stuck on it
 * (the words its row keeps, so nothing has to open the board to draw this); a
 * photo or a link with a picture, the picture; anything else, its glyph and
 * one line (the site, the length, the file's type).
 */
const props = withDefaults(defineProps<{ note: Note; query?: string }>(), { query: '' })

const store = useCompanion()
const subject = computed(() => store.get('subjects', props.note.subject_id))
const color = computed(() => (subject.value ? courseColor(subject.value.color) : 'var(--brand)'))
const when = computed(() => {
  const at = props.note.updated_at ?? props.note.created_at
  return at && Date.parse(at) <= Date.now() ? untilLabel(at) : ''
})

/** A board's words, as the few stickies the card has room for. */
const stickies = computed(() =>
  (props.note.preview ?? '')
    .split(/\s·\s|:\s|,\s/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((text) => (text.length > 28 ? `${text.slice(0, 27).trimEnd()}…` : text)),
)

const title = computed(() => highlight(props.note.title || t('notes.untitled'), props.query))

// Imports: a link shows the picture its preview found, as a photo shows itself.
const photo = computed(() =>
  props.note.kind === 'photo' ? knownFileUrl(props.note) : props.note.kind === 'link' ? (props.note.meta.link?.thumbnail ?? null) : null,
)

/** The one line under a capture's name: the site, the length, the file's type. */
const line = computed(() => {
  const n = props.note
  if (n.kind === 'link') {
    if (n.meta.link?.provider) return n.meta.link.provider
    try {
      return new URL(n.meta.url ?? '').hostname.replace(/^www\./, '')
    } catch {
      return n.meta.url ?? t('notes.aLink')
    }
  }
  if (n.kind === 'recording') return n.meta.duration_s ? t('notes.recordingDur', { dur: durationLabel(n.meta.duration_s) }) : t('notes.recording')
  if (n.kind === 'photo') return t('notes.photo')
  if (n.kind === 'file') return n.meta.mime === 'application/pdf' ? 'PDF' : t('notes.file')
  return ''
})
</script>

<template>
  <NuxtLink
    :to="noteTo(note.id)"
    class="group/card flex min-w-0 flex-col overflow-hidden rounded-[12px] bg-surface shadow-[0_0_0_1px_var(--border),var(--shadow-card)] transition duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none hover:-translate-y-px hover:shadow-[0_0_0_1px_var(--border-strong),var(--shadow-lift)] focus-visible:shadow-[0_0_0_2px_var(--brand)] motion-reduce:hover:translate-y-0"
  >
    <!-- The preview: one height for every kind. -->
    <span
      class="relative block h-[96px] shrink-0 overflow-hidden border-b border-border bg-surface-sunken"
      aria-hidden="true"
    >
      <!-- A corner of the board. -->
      <span
        v-if="note.kind === 'board'"
        class="absolute inset-0 bg-surface-canvas bg-[radial-gradient(rgb(var(--wash-rgb)/0.14)_1.1px,transparent_1.2px)] bg-[length:14px_14px]"
      >
        <span
          v-for="(text, i) in stickies"
          :key="i"
          class="absolute max-w-[46%] truncate rounded-[6px] px-2 py-1.5 text-[11px] leading-tight font-medium text-text-body shadow-[0_2px_6px_-3px_rgb(0_0_0/0.3)]"
          :style="{
            left: `${10 + i * 30}%`,
            top: `${16 + (i % 2) * 34}px`,
            transform: `rotate(${[-2, 1.5, -1][i]}deg)`,
            background: i === 1 ? 'var(--warn-soft)' : `color-mix(in srgb, ${color} 18%, var(--surface))`,
          }"
        >{{ text }}</span>
        <span
          v-if="!stickies.length"
          class="absolute inset-0 grid place-items-center text-[12px] text-text-faint"
        >{{ t('notes.nothingYet') }}</span>
      </span>

      <!-- A photo, or a link's picture, as itself. -->
      <img
        v-else-if="photo"
        :src="photo"
        alt=""
        loading="lazy"
        class="size-full object-cover"
      >

      <!-- A page: its first lines, on a sheet. -->
      <span
        v-else-if="note.kind === 'page'"
        class="absolute inset-x-3.5 top-3 bottom-0 rounded-t-[6px] bg-surface px-3 pt-2.5 shadow-[0_0_0_1px_var(--border)]"
      >
        <span
          :class="['line-clamp-4 text-[11.5px] leading-[1.45]', note.preview ? 'text-text-muted' : 'text-text-faint']"
        >{{ note.preview || t('notes.emptyPage') }}</span>
      </span>

      <!-- Anything else: its glyph and one line. -->
      <span
        v-else
        class="absolute inset-0 grid place-content-center justify-items-center gap-1.5 px-3"
      >
        <span class="grid size-9 place-items-center rounded-full bg-surface text-text-soft shadow-[0_0_0_1px_var(--border)]">
          <CompanionIcon
            :name="noteIcon(note)"
            :size="17"
          />
        </span>
        <span
          v-if="line"
          class="max-w-full truncate text-[12px] text-text-muted"
        >{{ line }}</span>
      </span>
    </span>

    <span class="flex flex-1 flex-col gap-2 p-3.5 pb-3">
      <span class="flex min-w-0 items-start gap-2">
        <CompanionIcon
          :name="noteIcon(note)"
          :size="15"
          class="mt-[2px] shrink-0 text-text-faint"
        />
        <span
          :class="['line-clamp-2 min-h-[2.6em] min-w-0 flex-1 text-[14.5px] leading-[1.3] font-semibold', note.title ? 'text-text' : 'text-text-faint']"
        ><template
          v-for="(piece, i) in title"
          :key="i"
        ><mark
          v-if="piece.hit"
          class="rounded-[3px] bg-accent-soft px-px text-text shadow-[inset_0_-2px_0_var(--accent)]"
        >{{ piece.text }}</mark><template v-else>{{ piece.text }}</template></template></span>
        <CompanionNotesGlyph
          v-if="note.pinned"
          name="pin"
          :size="13"
          class="mt-[3px] shrink-0 text-text-faint"
        />
      </span>
      <span class="mt-auto flex min-w-0 items-center gap-1.5 text-[12.5px] text-text-muted">
        <span
          class="size-2 shrink-0 rounded-full"
          :style="{ background: subject ? color : 'var(--border-strong)' }"
        />
        <span class="truncate">{{ subject?.title ?? 'My notes' }}</span>
        <template v-if="when">
          <span
            class="text-text-faint"
            aria-hidden="true"
          >·</span>
          <span class="shrink-0 text-text-faint">{{ when }}</span>
        </template>
      </span>
    </span>
  </NuxtLink>
</template>
