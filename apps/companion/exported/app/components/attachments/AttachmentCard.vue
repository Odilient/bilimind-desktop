<script setup lang="ts">
import type { Attachment } from '~/types/api'
import type { MenuAction } from '~/components/ui/Menu.vue'
import { materialBytes } from '~/composables/useMaterialQuota'

/**
 * ATTACH — one file beside a lesson, shown the way its kind deserves.
 *
 * A photo is a picture, so it is a thumbnail that opens; a voice memo is a
 * player; a PDF is a card that names itself and opens in a new tab. The
 * server already decided which of those a file is (`kind`, from the bytes),
 * so nothing here guesses from a filename.
 *
 * The caption is the only thing an owner edits in place, and it edits where
 * it is read: click the words, type, press Enter. A form for a sentence under
 * a picture would be an admin panel's answer. Everything else — moving,
 * removing — sits behind one menu, so a lesson with six files does not end in
 * eighteen buttons.
 *
 * A reader who cannot edit gets none of the controls, and no "Add a caption"
 * ghost text either: an invitation to a person who cannot accept it is noise.
 */
const props = withDefaults(
  defineProps<{
    attachment: Attachment
    editable?: boolean
    /** Position among siblings, to grey out "Move up" at the top and "Move down" at the bottom. */
    first?: boolean
    last?: boolean
  }>(),
  { editable: false, first: false, last: false },
)

const emit = defineEmits<{
  /** An image was clicked: open it large. */
  open: []
  /** The caption was committed. Null means cleared. */
  caption: [caption: string | null]
  move: [direction: -1 | 1]
  remove: []
}>()

const kind = computed(() => props.attachment.kind)
const size = computed(() => materialBytes(props.attachment.bytes))
const meta = computed(() => `${props.attachment.kind_label} · ${size.value}`)

/** Only inline kinds open; everything else is a download, and the button should say so. */
const opensInline = computed(() => kind.value === 'pdf')

/**
 * Hold the picture's space before it arrives, so the lesson does not jump when
 * a thumbnail decodes. The server measures images and nothing else; a video
 * without a known size gets the shape nearly every phone records in.
 */
const ratio = computed(() => {
  const { width, height } = props.attachment
  if (width && height) return `${width} / ${height}`
  return kind.value === 'video' ? '16 / 9' : '4 / 3'
})

const failed = ref(false)

watch(
  () => props.attachment.url,
  () => {
    failed.value = false
  },
)

/* -- Caption --------------------------------------------------------------- */

const editing = ref(false)
const draft = ref('')
const field = useTemplateRef<HTMLInputElement>('field')

async function startEditing(): Promise<void> {
  if (!props.editable) return
  draft.value = props.attachment.caption ?? ''
  editing.value = true
  await nextTick()
  field.value?.focus()
  field.value?.select()
}

/**
 * Escape sets `editing` false BEFORE the input leaves the DOM, so the blur
 * that some browsers fire on removal finds nothing left to commit. That
 * ordering is the whole difference between "cancel" and "save anyway".
 */
function cancel(): void {
  editing.value = false
}

function commit(): void {
  if (!editing.value) return
  editing.value = false

  const next = draft.value.trim() || null
  if (next !== (props.attachment.caption ?? null)) emit('caption', next)
}

/* -- The menu -------------------------------------------------------------- */

const actions = computed<MenuAction[]>(() => [
  { label: 'Move up', icon: 'chevron-up', disabled: props.first, run: () => emit('move', -1) },
  { label: 'Move down', icon: 'chevron-down', disabled: props.last, run: () => emit('move', 1) },
  {
    label: props.attachment.caption ? 'Edit caption' : 'Add a caption',
    icon: 'pencil',
    run: () => void startEditing(),
  },
  { label: 'Remove', icon: 'trash', destructive: true, run: () => emit('remove') },
])

/** Whether the row under the media has anything to say. */
const showCaptionRow = computed(
  () => props.editable || Boolean(props.attachment.caption),
)
</script>

<template>
  <figure class="m-0 flex min-w-0 flex-col">
    <!-- A picture: the thumbnail is the button. -->
    <button
      v-if="kind === 'image' && !failed"
      type="button"
      class="group block w-full cursor-zoom-in overflow-hidden rounded-[14px] bg-surface-sunken shadow-[inset_0_0_0_1px_var(--border)]"
      :style="{ aspectRatio: ratio }"
      :aria-label="`Open ${attachment.caption || attachment.name} larger`"
      @click="emit('open')"
    >
      <img
        :src="attachment.url"
        :alt="attachment.caption || attachment.name"
        loading="lazy"
        decoding="async"
        class="block size-full object-cover transition duration-300 group-hover:scale-[1.015]"
        @error="failed = true"
      />
    </button>

    <!-- A clip: the browser's own player, sized so the frame does not jump. -->
    <video
      v-else-if="kind === 'video' && !failed"
      :src="attachment.url"
      controls
      playsinline
      preload="metadata"
      class="block w-full rounded-[14px] bg-black"
      :style="{ aspectRatio: ratio }"
      @error="failed = true"
    />

    <!-- A recording: the name first, because a bare player says nothing about what it is. -->
    <div
      v-else-if="kind === 'audio' && !failed"
      class="rounded-[14px] bg-surface px-3.5 py-3 shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.1)]"
    >
      <div class="flex items-center gap-2.5">
        <span
          class="grid size-8 shrink-0 place-items-center rounded-[10px] bg-brand-soft text-brand"
        >
          <UiIcon
            name="mic"
            :size="16"
          />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-[13.5px] font-medium text-text-dim">{{ attachment.name }}</span>
          <span class="num block text-[11.5px] text-text-faint">{{ meta }}</span>
        </span>
      </div>
      <audio
        :src="attachment.url"
        controls
        preload="none"
        class="mt-2.5 block h-10 w-full"
        @error="failed = true"
      />
    </div>

    <!-- Everything else, and anything above whose file would not load: a card that opens. -->
    <div
      v-else
      class="flex items-center gap-3 rounded-[14px] bg-surface px-3.5 py-3 shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.1)]"
    >
      <span
        class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-soft text-brand"
      >
        <UiIcon
          :name="failed ? 'alert' : 'file'"
          :size="18"
        />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block truncate text-[13.5px] font-medium text-text-dim">{{ attachment.name }}</span>
        <span class="num block text-[11.5px] text-text-faint">
          {{ failed ? 'This file could not be shown here' : meta }}
        </span>
      </span>
      <a
        :href="attachment.url"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-surface px-3.5 text-[12.5px] font-semibold text-text shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.14)] transition-colors hover:bg-surface-mute"
      >
        {{ opensInline || failed ? 'Open' : 'Download' }}
        <UiIcon
          name="external"
          :size="13"
        />
      </a>
    </div>

    <!-- The caption, read or written in the same place. -->
    <figcaption
      v-if="showCaptionRow"
      class="mt-2 flex items-start gap-1"
    >
      <div class="min-w-0 flex-1 pt-0.5">
        <input
          v-if="editing"
          ref="field"
          v-model="draft"
          type="text"
          maxlength="500"
          placeholder="A line about this file"
          aria-label="Caption"
          class="w-full rounded-[10px] border border-border-field bg-surface px-2.5 py-1.5 text-[13px] leading-snug text-text-body outline-none transition-colors placeholder:text-text-faint focus:border-lime-2"
          @keydown.enter.prevent="commit"
          @keydown.escape.prevent="cancel"
          @blur="commit"
        >
        <button
          v-else-if="editable"
          type="button"
          class="block w-full cursor-text rounded-md px-1 py-0.5 text-left text-[13px] leading-snug transition-colors hover:bg-surface-sunken"
          :class="attachment.caption ? 'text-text-muted' : 'text-text-faint italic'"
          @click="startEditing"
        >
          {{ attachment.caption || 'Add a caption' }}
        </button>
        <p
          v-else
          class="px-1 py-0.5 text-[13px] leading-snug text-text-muted"
        >
          {{ attachment.caption }}
        </p>
      </div>

      <UiMenu
        v-if="editable"
        :actions="actions"
        :label="`More for ${attachment.name}`"
        :title="attachment.name"
        class="-mt-1"
      />
    </figcaption>
  </figure>
</template>
