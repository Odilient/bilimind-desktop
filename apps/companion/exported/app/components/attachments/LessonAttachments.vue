<script setup lang="ts">
import type { Attachment } from '~/types/api'
import { ATTACHMENT_ACCEPT, useAttachments } from '~/composables/useAttachments'
import AttachmentCard from './AttachmentCard.vue'
import AttachmentLightbox from './AttachmentLightbox.vue'

/**
 * ATTACH — the files pinned to the end of a lesson.
 *
 * They are the owner's own context — the photo of THEIR fuse box, the syllabus
 * their college handed out, a voice memo from the lecture — and they sit after
 * the lesson under one quiet heading precisely because they are not the
 * lesson. Nothing here is a part; nothing here is graded; the lesson's text
 * never refers to them. That is what keeps them cheap to add and safe to
 * remove.
 *
 * Which is also why the section is so plain. One primary action, "Add a
 * file", and the whole section takes a drop; per-file work lives behind each
 * card's menu; the only dialog is the one that asks before a file is gone.
 * A reader who cannot edit sees the files and no controls, and when there are
 * no files sees nothing at all — an empty section is an owner's prompt, not a
 * reader's information.
 *
 * The list is owned by `useAttachments` and handed back up through `changed`,
 * so the parent's copy of the lesson payload stays true and a tab switched
 * away and back does not resurrect a file that was removed.
 */
const props = withDefaults(
  defineProps<{
    nodeId: number
    /** From the lesson payload; the section keeps its own copy in step with it. */
    attachments: Attachment[]
    /** The owner's workspace says yes; a shared or public view never does. */
    editable?: boolean
    /**
     * No files, no section, not even for the owner: the lesson's own Attach
     * button calls `pick()`. A dropzone at the end of every lesson read as one
     * more thing to do there (11-09). The editor keeps the dropzone.
     */
    quiet?: boolean
  }>(),
  { editable: false, quiet: false },
)

const emit = defineEmits<{
  /** The list changed — a file added, captioned, moved or removed. */
  changed: [attachments: Attachment[]]
}>()

const {
  attachments,
  uploading,
  upload,
  dismiss,
  setCaption,
  remove,
  reorder,
  refresh,
} = useAttachments(
  () => props.nodeId,
  toRef(props, 'attachments'),
  { onChange: (list) => emit('changed', list) },
)

const ACCEPTS = 'A picture, a PDF, an audio or video clip, an Office document, plain text, CSV or a ZIP.'

/* -- Choosing files -------------------------------------------------------- */

const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

function pick(): void {
  if (props.editable) fileInput.value?.click()
}

const section = ref<HTMLElement | null>(null)

function onFilePicked(event: Event): void {
  const input = event.target as HTMLInputElement
  void upload(Array.from(input.files ?? []))
  input.value = ''
  // Picked from the strip's paperclip, the upload shows at the lesson's end: go and see it.
  void nextTick(() => section.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
}

/* -- Dropping them --------------------------------------------------------- */

const dragging = ref(false)

/*
 * `dragleave` fires every time the pointer crosses into a child, so a plain
 * boolean flickers over every thumbnail. Counting enters against leaves is
 * the standard cure; the count is reset on drop because a drop ends the
 * gesture without a matching leave.
 */
let depth = 0

/** A text selection dragged across the lesson is not a file, and should not light the target. */
function carriesFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

/**
 * Same guard as `materials/DropBar.vue`: a page that makes its whole surface a
 * drop target forwards the event down here, so one drop can arrive twice.
 * Claiming it by identity is the cheapest correct answer.
 */
let claimed: Event | null = null

function claim(event: Event): boolean {
  if (event === claimed) return false
  claimed = event
  return true
}

function onDragEnter(event: DragEvent): void {
  if (!props.editable || !carriesFiles(event)) return
  event.preventDefault()
  depth += 1
  dragging.value = true
}

function onDragOver(event: DragEvent): void {
  if (!props.editable || !carriesFiles(event)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

function onDragLeave(): void {
  if (!props.editable) return
  depth = Math.max(0, depth - 1)
  if (depth === 0) dragging.value = false
}

function handleDrop(event: DragEvent): void {
  if (!props.editable) return
  event.preventDefault()
  depth = 0
  dragging.value = false
  if (!claim(event)) return

  void upload(Array.from(event.dataTransfer?.files ?? []))
}

/* -- Per-file actions ------------------------------------------------------ */

const pendingRemove = ref<Attachment | null>(null)
const removing = ref(false)

async function confirmRemove(): Promise<void> {
  const target = pendingRemove.value
  if (!target || removing.value) return

  removing.value = true
  try {
    await remove(target.uuid)
  } finally {
    removing.value = false
    pendingRemove.value = null
  }
}

function move(row: Attachment, direction: -1 | 1): void {
  const from = attachments.value.findIndex((other) => other.uuid === row.uuid)
  if (from === -1) return
  void reorder(row.uuid, from + direction)
}

/* -- Looking at a picture -------------------------------------------------- */

const images = computed(() => attachments.value.filter((row) => row.kind === 'image'))
const lightboxOpen = ref(false)
const lightboxIndex = ref(0)

function openImage(row: Attachment): void {
  const at = images.value.findIndex((other) => other.uuid === row.uuid)
  if (at === -1) return
  lightboxIndex.value = at
  lightboxOpen.value = true
}

/* -- Shape ----------------------------------------------------------------- */

/** A clip wants the whole measure; a thumbnail or a card shares a row. */
function spanClass(row: Attachment): string {
  return row.kind === 'video' || row.kind === 'audio' ? 'col-span-full' : ''
}

const hasAnything = computed(() => attachments.value.length > 0 || uploading.value.length > 0)

/** Nothing to show and nobody who could add something: the section is not there. */
const visible = computed(() => props.editable || hasAnything.value)

defineExpose({
  /** Open the file picker, for a menu elsewhere in the lesson that says "Attach a file". */
  pick,
  refresh,
})
</script>

<template>
  <!-- Quiet and empty: kept, but not drawn, so `pick()` still has its file input. -->
  <section
    v-if="visible"
    v-show="!quiet || hasAnything"
    ref="section"
    :class="[
      'relative rounded-[18px] transition-[box-shadow,background-color] duration-150',
      dragging && '-m-3 bg-brand-soft p-3 ring-[1.5px] ring-brand',
    ]"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="handleDrop"
  >
    <header class="mb-3 flex items-center gap-2">
      <span class="size-[5px] shrink-0 rounded-full bg-border-dashed" />
      <span class="text-[11px] font-semibold tracking-[0.08em] text-text-faint uppercase"
        >Attached to this lesson</span
      >
      <span class="flex-1" />
      <UiBtn
        v-if="editable && hasAnything"
        variant="secondary"
        size="sm"
        icon="plus"
        @click="pick"
      >
        Add a file
      </UiBtn>
    </header>

    <input
      v-if="editable"
      ref="fileInput"
      type="file"
      multiple
      hidden
      :accept="ATTACHMENT_ACCEPT"
      @change="onFilePicked"
    >

    <!--
      The owner's empty state IS the primary action: a target to drop on that
      is also the button. It is replaced by the header button the moment there
      is a file, so the invitation never sits under a list it no longer fits.
    -->
    <button
      v-if="editable && !hasAnything"
      type="button"
      :class="[
        'flex w-full cursor-pointer flex-col items-center gap-2 rounded-[16px] border-[1.5px] border-dashed px-6 py-7 text-center transition-colors',
        dragging
          ? 'border-brand bg-brand-soft'
          : 'border-border-dashed bg-surface-mute hover:border-brand hover:bg-brand-soft',
      ]"
      @click="pick"
    >
      <UiIcon
        name="upload"
        :size="18"
        :class="dragging ? 'text-brand' : 'text-text-faint'"
      />
      <span class="text-[13.5px] font-medium">Add a file</span>
      <span class="max-w-md text-[11.5px] leading-relaxed text-text-faint">
        Drop it here or click to choose. {{ ACCEPTS }} Shown at the end of this lesson to
        everyone who can read it.
      </span>
    </button>

    <div
      v-if="attachments.length"
      class="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]"
    >
      <AttachmentCard
        v-for="(row, index) in attachments"
        :key="row.uuid"
        :attachment="row"
        :editable="editable"
        :first="index === 0"
        :last="index === attachments.length - 1"
        :class="spanClass(row)"
        @open="openImage(row)"
        @caption="(caption) => setCaption(row.uuid, caption)"
        @move="(direction) => move(row, direction)"
        @remove="pendingRemove = row"
      />
    </div>

    <!--
      Files on their way up. They live here rather than in the grid because
      they have no uuid yet — until the POST answers there is only a file and
      a bar. A failed one stays until it is dismissed.
    -->
    <ul
      v-if="uploading.length"
      class="mt-3 flex flex-col gap-1.5"
    >
      <li
        v-for="row in uploading"
        :key="row.id"
        class="rounded-[12px] bg-surface-mute px-3 py-2 text-[12.5px] shadow-[inset_0_0_0_1px_var(--border)]"
      >
        <div class="flex items-start gap-2.5">
          <UiIcon
            :name="row.error ? 'alert' : 'upload'"
            :size="13"
            :class="['mt-0.5 shrink-0', row.error ? 'text-danger' : 'text-brand']"
          />
          <span class="min-w-0 flex-1">
            <span class="flex items-baseline gap-2">
              <span class="min-w-0 flex-1 truncate">{{ row.name }}</span>
              <span
                v-if="!row.error"
                class="num shrink-0 text-[11px] text-text-faint"
                >{{ row.percent }}%</span
              >
            </span>
            <span
              v-if="row.error"
              class="mt-0.5 block leading-relaxed text-danger"
              >{{ row.error }}</span
            >
          </span>
          <button
            v-if="row.error"
            type="button"
            class="mt-0.5 shrink-0 cursor-pointer text-text-faint hover:text-text"
            aria-label="Dismiss"
            @click="dismiss(row.id)"
          >
            <UiIcon
              name="x"
              :size="13"
            />
          </button>
        </div>
        <div
          v-if="!row.error"
          class="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-track"
          role="progressbar"
          :aria-valuenow="row.percent"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="`Uploading ${row.name}`"
        >
          <div
            class="h-full rounded-full bg-brand transition-[width] duration-200"
            :style="{ width: `${row.percent}%` }"
          />
        </div>
      </li>
    </ul>

    <AttachmentLightbox
      v-model:open="lightboxOpen"
      v-model:index="lightboxIndex"
      :images="images"
    />

    <UiModal
      :open="pendingRemove !== null"
      title="Remove this file?"
      size="sm"
      @update:open="(value) => !value && (pendingRemove = null)"
    >
      <p class="text-[13.5px] leading-relaxed text-text-muted">
        <span class="text-text">{{ pendingRemove?.name }}</span> will be taken off this lesson
        and deleted. The lesson itself is not touched.
      </p>

      <template #footer>
        <UiBtn
          variant="ghost"
          size="sm"
          @click="pendingRemove = null"
          >Cancel</UiBtn
        >
        <UiBtn
          variant="danger"
          size="sm"
          icon="trash"
          :loading="removing"
          @click="confirmRemove"
        >
          Remove
        </UiBtn>
      </template>
    </UiModal>
  </section>
</template>
