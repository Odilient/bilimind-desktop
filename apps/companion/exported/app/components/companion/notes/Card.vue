<script setup lang="ts">
import type { Note } from '~/companion/notes/tree'
import { highlight, noteIcon } from '~/companion/notes/tree'
import { noteTo } from '~/companion/notes/actions'
import { knownFileUrl } from '~/companion/files'
import { courseColor } from '~/companion/colors'
import { durationLabel, untilLabel } from '~/companion/time'
import { useCompanion } from '~/companion/store'

/**
 * A note on Notes' home, as a card: enough of it to know it without opening
 * it. A page shows its first lines; a whiteboard, a corner of canvas with
 * its first few notes stuck on it (the words its row keeps, so nothing has
 * to open the board to draw this); a photo, itself when the device has it; a
 * link, the site it goes to; a recording, its length. Under all of them,
 * where it's filed and when it was last touched.
 */
const props = withDefaults(defineProps<{ note: Note; query?: string }>(), { query: '' })

const store = useCompanion()
const subject = computed(() => store.get('subjects', props.note.subject_id))
const color = computed(() => (subject.value ? courseColor(subject.value.color) : 'var(--cobalt)'))
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

const title = computed(() => highlight(props.note.title || 'Untitled', props.query))

const photo = computed(() => (props.note.kind === 'photo' ? knownFileUrl(props.note) : null))

/** The one line under a capture's name: the site, the length, the file's type. */
const line = computed(() => {
  const n = props.note
  if (n.kind === 'link') {
    try {
      return new URL(n.meta.url ?? '').hostname.replace(/^www\./, '')
    } catch {
      return n.meta.url ?? 'A link'
    }
  }
  if (n.kind === 'recording') return n.meta.duration_s ? `Recording, ${durationLabel(n.meta.duration_s)}` : 'Recording'
  if (n.kind === 'photo') return 'Photo'
  if (n.kind === 'file') return n.meta.mime === 'application/pdf' ? 'PDF' : 'File'
  return ''
})
</script>

<template>
  <NuxtLink
    :to="noteTo(note.id)"
    class="group/card grid min-w-0 content-start overflow-hidden rounded-[16px] bg-surface shadow-[inset_0_0_0_1px_var(--border)] transition duration-150 outline-none hover:-translate-y-px hover:shadow-[inset_0_0_0_1px_var(--border-strong),0_12px_28px_-16px_rgb(13_22_96/0.35)] focus-visible:shadow-[inset_0_0_0_2px_var(--cobalt)] motion-reduce:hover:translate-y-0"
  >
    <!-- A corner of the board. -->
    <span
      v-if="note.kind === 'board'"
      class="relative block h-[86px] overflow-hidden bg-surface-canvas bg-[radial-gradient(rgb(11_13_16/0.1)_1.1px,transparent_1.2px)] bg-[length:14px_14px]"
      aria-hidden="true"
    >
      <span
        v-for="(text, i) in stickies"
        :key="i"
        class="absolute max-w-[46%] truncate rounded-[6px] px-2 py-1.5 text-[11px] leading-tight font-medium text-text-body shadow-[0_2px_6px_-3px_rgb(11_13_16/0.3)]"
        :style="{
          left: `${10 + i * 30}%`,
          top: `${14 + (i % 2) * 34}px`,
          transform: `rotate(${[-2, 1.5, -1][i]}deg)`,
          background: i === 1 ? 'var(--warn-soft)' : `color-mix(in srgb, ${color} 18%, var(--surface))`,
        }"
      >{{ text }}</span>
      <span
        v-if="!stickies.length"
        class="absolute inset-0 grid place-items-center text-[12px] text-text-faint"
      >Nothing on it yet</span>
    </span>

    <!-- A photo, as itself. -->
    <span
      v-else-if="photo"
      class="block h-[86px] overflow-hidden bg-surface-sunken"
      aria-hidden="true"
    >
      <img
        :src="photo"
        alt=""
        loading="lazy"
        class="size-full object-cover"
      >
    </span>

    <span class="grid gap-1.5 p-3.5 pb-3">
      <span class="flex min-w-0 items-center gap-2">
        <CompanionIcon
          :name="noteIcon(note)"
          :size="15"
          class="shrink-0 text-text-faint"
        />
        <span
          :class="['min-w-0 flex-1 truncate text-[14.5px] font-semibold', note.title ? 'text-text' : 'text-text-faint']"
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
          class="shrink-0 text-text-faint"
        />
      </span>
      <span
        v-if="note.kind === 'page'"
        :class="['line-clamp-3 min-h-[3.9em] text-[13px] leading-[1.3] text-text-muted', !note.preview && 'text-text-faint']"
      >{{ note.preview || 'Empty page' }}</span>
      <span
        v-else-if="line"
        class="truncate text-[13px] text-text-muted"
      >{{ line }}</span>
      <span class="flex min-w-0 items-center gap-1.5 text-[12px] text-text-faint">
        <span
          v-if="subject"
          class="size-1.5 shrink-0 rounded-full"
          :style="{ background: color }"
        />
        <span class="truncate">{{ subject?.title ?? 'My notes' }}</span>
        <template v-if="when">
          <span aria-hidden="true">·</span>
          <span class="shrink-0">{{ when }}</span>
        </template>
      </span>
    </span>
  </NuxtLink>
</template>
