<script setup lang="ts">
import type { Material } from '~/types/api'
import { ApiError } from '~/composables/useApi'

/**
 * The one control that takes material, however it arrives.
 *
 * It replaces a three-tab mode switch (Upload / Paste / Link) that would have
 * become five as soon as images and videos landed. Nobody thinks "I am in link
 * mode"; they think "here, have this". So: drop it, click for the file picker,
 * or put it in the one field — a URL becomes a link, prose becomes a note, and
 * a pasted screenshot becomes an upload, without anyone choosing a mode first.
 *
 * It also holds the quota, because a file refused BEFORE it is sent is the only
 * refusal that does not waste the upload. The sentences here shadow
 * MaterialQuota's own; the server stays the authority, and when one gets past
 * us its 402 is shown verbatim.
 */

const props = withDefaults(
  defineProps<{
    /** Attaches new material to a course as it is created. */
    courseId?: number | null
    disabled?: boolean
    /** Tighter padding, for the picker inside the create flow. */
    compact?: boolean
  }>(),
  { courseId: null, disabled: false, compact: false },
)

const emit = defineEmits<{ created: [material: Material] }>()

const api = useApi()

const { load: loadQuota, refuse, atCeiling, showMeter, percent, summary } = useMaterialQuota()

/**
 * Mirrors StoreMaterialRequest::ALLOWED_EXTENSIONS. A file the server would
 * reject should never reach the file dialog in the first place.
 */
const ACCEPT =
  '.pdf,.docx,.pptx,.ppsx,.epub,.txt,.text,.md,.markdown,.mdown,'
  + '.csv,.tsv,.json,.html,.htm,.srt,.vtt,.png,.jpg,.jpeg,.webp,.gif'

const READS = 'PDF, Word, PowerPoint, EPUB, subtitles, text, Markdown, CSV, JSON and HTML'

interface QueueEntry {
  id: number
  name: string
  state: 'uploading' | 'failed'
  message?: string
}

const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const queue = ref<QueueEntry[]>([])
let queueId = 0

const entry = ref('')
const expanded = ref(false)
const submitting = ref(false)
const formError = ref<string | null>(null)
const dragging = ref(false)

onMounted(() => void loadQuota())

/* -- What a pasted string is ----------------------------------------------- */

/**
 * Extensions that would otherwise read as a top-level domain. Without this,
 * typing the name of a file you meant to drag ("lecture-4.md") is filed as a
 * web page — and then fetched, and then failed, for no reason anyone can see.
 */
const FILE_TAILS = new Set([
  'pdf', 'docx', 'pptx', 'ppsx', 'epub', 'txt', 'text', 'md', 'markdown', 'mdown',
  'csv', 'tsv', 'json', 'html', 'htm', 'srt', 'vtt', 'png', 'jpg', 'jpeg', 'webp', 'gif',
])

function looksLikeUrl(value: string): boolean {
  const trimmed = value.trim()

  if (/\s/.test(trimmed)) return false
  if (/^https?:\/\/\S+\.\S+/i.test(trimmed)) return true

  // Schemeless, the way people actually paste: `example.com/guide`. A path
  // settles it; without one, the last label has to look like a domain rather
  // than a file extension.
  const match = /^([a-z0-9-]+(?:\.[a-z0-9-]+)+)(\/\S*)?$/i.exec(trimmed)
  if (!match) return false
  if (match[2]) return true

  const tail = match[1]?.split('.').pop()?.toLowerCase() ?? ''

  return tail.length >= 2 && /^[a-z]+$/.test(tail) && !FILE_TAILS.has(tail)
}

const entryIsUrl = computed(() => looksLikeUrl(entry.value))

const canSubmitEntry = computed(() => {
  const value = entry.value.trim()
  if (value === '') return false
  return entryIsUrl.value || value.length >= 20
})

/** The glyph follows the meaning: a chain for a link, a pencil for a note. */
const entryIcon = computed(() => {
  if (expanded.value) return undefined
  return entryIsUrl.value ? 'link' : 'pencil'
})

const entryHint = computed(() => {
  const value = entry.value.trim()
  if (value === '') return ''
  if (entryIsUrl.value) return 'We fetch the page once and keep the text, not the page.'
  if (value.length < 20) return 'A link, or at least a sentence or two to learn from.'
  return `Saved as a note · ${value.length.toLocaleString('en-US')} characters`
})

/* -- Sending --------------------------------------------------------------- */

function messageFor(cause: unknown, fallback: string): string {
  if (cause instanceof ApiError) return cause.allMessages[0] ?? cause.message
  return cause instanceof Error ? cause.message : fallback
}

async function send(body: FormData | Record<string, unknown>): Promise<Material> {
  const created = await api.post<Material>('/materials', body)
  emit('created', created)
  // The library just grew; the meter has to move with it, or the next refusal
  // arrives out of nowhere.
  void loadQuota()
  return created
}

async function uploadFiles(files: File[]): Promise<void> {
  if (props.disabled || files.length === 0) return

  formError.value = null

  for (const file of files) {
    const id = (queueId += 1)
    const refusal = refuse(file)

    if (refusal !== null) {
      queue.value = [...queue.value, { id, name: file.name, state: 'failed', message: refusal }]
      continue
    }

    queue.value = [...queue.value, { id, name: file.name, state: 'uploading' }]

    try {
      const form = new FormData()
      form.append('file', file)
      if (props.courseId) form.append('course_id', String(props.courseId))
      await send(form)
      queue.value = queue.value.filter((row) => row.id !== id)
    } catch (cause) {
      const message = messageFor(cause, 'That upload did not go through.')
      queue.value = queue.value.map((row) =>
        row.id === id ? { id, name: file.name, state: 'failed', message } : row,
      )
      if (cause instanceof ApiError && cause.status === 402) void loadQuota()
    }
  }
}

async function submitEntry(): Promise<void> {
  if (props.disabled || submitting.value || !canSubmitEntry.value) return

  const value = entry.value.trim()
  const asUrl = entryIsUrl.value

  submitting.value = true
  formError.value = null

  try {
    await send({
      ...(asUrl ? { url: value } : { text: value }),
      ...(props.courseId ? { course_id: props.courseId } : {}),
    })
    entry.value = ''
    expanded.value = false
  } catch (cause) {
    formError.value = messageFor(
      cause,
      asUrl ? 'That link could not be added.' : 'That note could not be saved.',
    )
  } finally {
    submitting.value = false
  }
}

/* -- Arrival --------------------------------------------------------------- */

function onFilePicked(event: Event): void {
  const input = event.target as HTMLInputElement
  void uploadFiles(Array.from(input.files ?? []))
  input.value = ''
}

/**
 * A page that hosts this control makes its whole surface a drop target and a
 * paste target, then hands the event straight back here — so an event that
 * lands ON the drop bar reaches this component twice, once on its own listener
 * and once via the page's. Claiming the event by identity is the cheapest
 * correct answer; without it a dropped file is uploaded twice.
 */
let claimed: Event | null = null

function claim(event: Event): boolean {
  if (event === claimed) return false
  claimed = event

  return true
}

function handleDrop(event: DragEvent): void {
  event.preventDefault()
  dragging.value = false
  if (!claim(event)) return

  void uploadFiles(Array.from(event.dataTransfer?.files ?? []))
}

/** Enter sends a link; inside a note it has to stay a newline. */
function onEntryKeydown(event: KeyboardEvent): void {
  if (expanded.value) return
  event.preventDefault()
  void submitEntry()
}

/**
 * A paste is three different intentions wearing one keystroke. Files win — a
 * screenshot on the clipboard is unambiguous. A URL goes straight in, because
 * making someone press Add after pasting a link they obviously meant to add is
 * the ceremony this control exists to delete. Prose is put in the box and left
 * there: it is long, it may be the wrong clipboard, and nobody wants a
 * 4000-word accident filed under their own name.
 */
function handlePaste(event: ClipboardEvent): void {
  if (props.disabled || !claim(event)) return

  const files = Array.from(event.clipboardData?.files ?? [])

  if (files.length > 0) {
    event.preventDefault()
    void uploadFiles(files)
    return
  }

  // Already typing in the field: the browser's own paste is the right answer.
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return
  }

  const text = event.clipboardData?.getData('text/plain') ?? ''
  if (text.trim() === '') return

  event.preventDefault()
  entry.value = text.trim()

  if (looksLikeUrl(text)) {
    void submitEntry()
    return
  }

  expanded.value = true
}

defineExpose({ handlePaste, handleDrop })
</script>

<template>
  <div
    @paste="handlePaste"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop="handleDrop"
  >
    <!--
      At the ceiling the dropzone is REPLACED, not decorated. Leaving a
      live-looking target that refuses every file is a small cruelty; the two
      things that actually help take its place.
    -->
    <div
      v-if="atCeiling"
      class="rounded-[18px] bg-warn-soft px-4 py-4 shadow-[inset_0_0_0_1px_var(--warn-line)]"
    >
      <p class="flex items-start gap-2 text-[13px] leading-relaxed text-warn-text">
        <UiIcon
          name="alert"
          :size="14"
          class="mt-0.5 shrink-0"
        />
        <span>
          {{ summary }} Delete something you have finished with, or move to a plan with more room —
          nothing you already added is touched either way.
        </span>
      </p>
      <UiBtn
        variant="secondary"
        size="sm"
        icon="card"
        class="mt-3"
        to="/account?section=plan"
      >
        See plans
      </UiBtn>
    </div>

    <template v-else>
      <button
        type="button"
        :disabled="disabled"
        :class="[
          'flex w-full cursor-pointer flex-col items-center gap-2 rounded-[18px] border-[1.5px] border-dashed text-center transition-colors',
          compact ? 'px-4 py-6' : 'px-6 py-9',
          dragging
            ? 'border-lime-2 bg-accent-soft'
            : 'border-brand-line bg-brand-soft/60 hover:border-brand hover:bg-brand-soft',
        ]"
        @click="fileInput?.click()"
      >
        <!-- Cobalt's materials card: a round cobalt well with the arrow,
             turning lime the moment something is held over it. -->
        <span
          :class="[
            'grid place-items-center rounded-full transition-colors',
            compact ? 'size-9' : 'size-11',
            dragging ? 'bg-lime text-ink' : 'bg-brand text-white',
          ]"
        >
          <UiIcon
            name="upload"
            :size="compact ? 16 : 18"
            :stroke="2"
          />
        </span>
        <span class="t-head mt-1 text-[15.5px]">Drop it here, or click to browse</span>
        <span class="max-w-md text-[12px] leading-relaxed text-text-soft">
          {{ READS }}. Pictures and videos are kept and can be linked from a lesson, but nothing
          reads them for you.
        </span>
      </button>

      <input
        ref="fileInput"
        type="file"
        multiple
        class="hidden"
        :accept="ACCEPT"
        @change="onFilePicked"
      >

      <!-- One field, two meanings, settled by what is in it. -->
      <div class="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-start">
        <UiTextField
          v-model="entry"
          class="flex-1"
          size="sm"
          :multiline="expanded"
          :rows="6"
          :icon="entryIcon"
          :disabled="disabled"
          :maxlength="expanded ? 2000000 : 2048"
          placeholder="…or paste a link, or type a note"
          aria-label="Paste a link, or type a note"
          @keydown.enter="onEntryKeydown"
        />
        <UiBtn
          variant="secondary"
          size="sm"
          icon="plus"
          class="shrink-0"
          :loading="submitting"
          :disabled="disabled || !canSubmitEntry"
          @click="submitEntry"
        >
          {{ entryIsUrl ? 'Add link' : 'Add note' }}
        </UiBtn>
      </div>

      <div class="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p
          v-if="entryHint"
          class="text-[11.5px] text-text-faint"
        >
          {{ entryHint }}
        </p>
        <button
          v-if="!expanded"
          type="button"
          class="cursor-pointer text-[12px] font-medium text-brand underline decoration-brand-line underline-offset-2"
          @click="expanded = true"
        >
          Write a longer note
        </button>
      </div>
    </template>

    <p
      v-if="formError"
      class="mt-2 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-danger"
    >
      <UiIcon
        name="alert"
        :size="13"
        class="mt-0.5 shrink-0"
      />
      {{ formError }}
    </p>

    <!--
      In-flight uploads live here rather than in the list, because they have no
      id yet — until the POST answers there is no material, only a file and a
      hope. A failed one stays until it is dismissed: a file that vanished on
      its way up is the one thing nobody should have to notice for themselves.
    -->
    <ul
      v-if="queue.length"
      class="mt-2.5 flex flex-col gap-1.5"
    >
      <li
        v-for="row in queue"
        :key="row.id"
        class="flex items-start gap-2.5 rounded-[12px] bg-surface-mute px-3 py-2.5 text-[12.5px] shadow-[inset_0_0_0_1px_var(--border)]"
      >
        <UiIcon
          :name="row.state === 'failed' ? 'alert' : 'loader'"
          :size="13"
          :class="[
            'mt-0.5 shrink-0',
            row.state === 'failed' ? 'text-danger' : 'animate-spin-slow text-brand',
          ]"
        />
        <span class="min-w-0 flex-1">
          <span class="block truncate">{{ row.name }}</span>
          <span
            v-if="row.message"
            class="mt-0.5 block leading-relaxed text-danger"
            >{{ row.message }}</span
          >
        </span>
        <button
          v-if="row.state === 'failed'"
          type="button"
          class="mt-0.5 shrink-0 cursor-pointer text-text-faint hover:text-text"
          aria-label="Dismiss"
          @click="queue = queue.filter((other) => other.id !== row.id)"
        >
          <UiIcon
            name="x"
            :size="13"
          />
        </button>
      </li>
    </ul>

    <!--
      The meter is drawn only once it means something. A bar at 3% is an
      accounting device on a page about learning; at 60% it is the warning that
      arrives before the upload that fails, rather than after it.
    -->
    <div
      v-if="showMeter && !atCeiling"
      class="mt-2.5"
    >
      <div class="h-1 overflow-hidden rounded-full bg-surface-track">
        <div
          class="h-full rounded-full bg-brand transition-[width] duration-300"
          :style="{ width: `${percent}%` }"
        />
      </div>
      <p class="num mt-1 text-[11px] text-text-faint">{{ summary }}</p>
    </div>
  </div>
</template>
