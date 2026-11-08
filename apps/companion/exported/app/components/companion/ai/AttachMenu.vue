<script setup lang="ts">
/**
 * The composer's "+": everything the chat can be given, and the one mode it
 * can be put in, in one short list. ChatGPT's + menu, in BiliMind's words:
 *
 *   Make a course            the next message drafts a course, whatever it says
 *   ─────
 *   Upload files             PDFs, slides, documents, images
 *   Attach notes             pages, whiteboards and files from Notes
 *   Add a link · Paste text · A Moodle course · A calendar link
 *   ─────
 *   Connect your school…  ›  Moodle, timetable, email, photo (a second page)
 *
 * The composer owns what each choice does (`choose`); this is only the
 * list. A popover above the + on a desktop, and a bottom sheet on a phone,
 * because a popover in a sheet over a keyboard has nowhere to go. "Connect
 * your school" slides to its own page of four doors rather than opening a
 * second menu, so the way back is one tap and the list never doubles.
 */
import type { ConnectKind } from '~/companion/create'
import { useCompanion } from '~/companion/store'
// Google
import { googleAvailable, preloadGoogle } from '~/companion/google/drive'

export type AttachChoice =
  | 'course'
  | 'files'
  | 'notes'
  | 'link'
  | 'paste'
  | 'moodle'
  | 'calendar'
  // Google
  | 'drive'
  | `connect:${ConnectKind}`

withDefaults(
  defineProps<{
    /** "Make a course" is on. */
    course?: boolean
    placement?: 'up' | 'down'
  }>(),
  { placement: 'up' },
)

const emit = defineEmits<{ choose: [choice: AttachChoice] }>()

const open = defineModel<boolean>('open', { default: false })

const c = useCompanion()
const isPhone = useIsPhone()
const root = ref<HTMLElement | null>(null)
const page = ref<'main' | 'school'>('main')

interface Row {
  key: AttachChoice
  icon: string
  title: string
  hint: string
  tone?: string
}

const ADD: Row[] = [
  { key: 'files', icon: 'upload', title: 'Upload files', hint: 'PDFs, slides, documents, images' },
  { key: 'notes', icon: 'notebook', title: 'Attach notes', hint: 'Pages, whiteboards and files from Notes' },
  { key: 'link', icon: 'link', title: 'Add a link', hint: 'A web page or a YouTube video, read when you send' },
  { key: 'paste', icon: 'paste', title: 'Paste text', hint: 'A syllabus, an announcement, an email' },
  { key: 'moodle', icon: 'folder', title: 'Build from a folder', hint: 'Every answer checked against your files' },
]

// Google: Drive under Upload files, only where Google is set up and its
// sign-in can open (a browser, not the desktop or phone app). Its scripts start
// loading when the menu opens, so Google's window opens close to the tap.
if (googleAvailable()) {
  ADD.splice(1, 0, { key: 'drive', icon: 'download', title: 'From Google Drive', hint: 'Files or a folder you pick' })
  watch(open, (now) => {
    if (now) preloadGoogle()
  })
}

/** A way already connected says so, so the learner sees what is already flowing in. */
function connected(kind: ConnectKind): { word: string; tone: string } | null {
  if (kind !== 'moodle' && kind !== 'ics') return null
  const conn = c.connections.value.find((x) => x.kind === kind)
  if (!conn) return null
  return conn.status === 'error'
    ? { word: 'Stopped working', tone: 'text-danger-text' }
    : { word: 'Connected', tone: 'text-success-text' }
}

const SCHOOL: { kind: ConnectKind; icon: string; title: string; hint: string }[] = [
  // shortcut: hidden until the inbound worker is live (docs/inbound-worker.md); restore this row then.
  { kind: 'photo', icon: 'camera', title: 'Exam timetable PDF', hint: 'The rows about your courses; you check them first' },
]

function choose(key: AttachChoice): void {
  open.value = false
  emit('choose', key)
}

watch(open, (now) => {
  if (!now) page.value = 'main'
})

/* -- Closing on a click outside, Esc, and the arrow keys ------------------------ */

function onPointerDown(event: PointerEvent): void {
  if (open.value && !isPhone.value && !root.value?.contains(event.target as Node)) open.value = false
}

function onKeydown(event: KeyboardEvent): void {
  if (!open.value) return
  if (event.key === 'Escape') {
    // The menu closes; the drawer or sheet around the composer stays.
    event.stopPropagation()
    event.preventDefault()
    if (page.value === 'school') page.value = 'main'
    else open.value = false
    return
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  const items = Array.from(root.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
  if (!items.length) return
  event.preventDefault()
  const at = items.indexOf(document.activeElement as HTMLElement)
  const next = event.key === 'ArrowDown' ? (at + 1) % items.length : (at - 1 + items.length) % items.length
  items[next]?.focus()
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown, true))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown, true))

// Opened from the keyboard: the first row takes the focus, so ↓ and Enter work at once.
watch([open, page], ([now]) => {
  if (now && !isPhone.value) {
    void nextTick(() => root.value?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true }))
  }
})

const sheetOpen = computed({
  get: () => open.value && isPhone.value,
  set: (value) => {
    open.value = value
  },
})

const item =
  'flex w-full cursor-pointer items-center gap-2.5 rounded-[11px] px-2 py-1.5 text-left transition-colors duration-120 outline-none hover:bg-surface-sunken focus-visible:bg-surface-sunken max-lg:min-h-12 max-lg:py-2'
const tile = 'grid size-8 shrink-0 place-items-center rounded-[9px] bg-surface-sunken text-text-soft'
</script>

<template>
  <div
    ref="root"
    class="relative"
    @keydown="onKeydown"
  >
    <slot />

    <Transition
      enter-active-class="transition duration-150 ease-out"
      :enter-from-class="placement === 'up' ? 'opacity-0 translate-y-1 scale-[0.98]' : 'opacity-0 -translate-y-1 scale-[0.98]'"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open && !isPhone"
        :class="[
          'absolute left-0 z-40 w-[300px] max-w-[calc(100vw-32px)] rounded-[15px] bg-surface p-1.5 shadow-pop',
          placement === 'up' ? 'bottom-full mb-2 origin-bottom-left' : 'top-full mt-2 origin-top-left',
        ]"
        role="menu"
        aria-label="Add to the message"
      >
        <template v-if="page === 'main'">
          <button
            type="button"
            role="menuitem"
            :class="item"
            :aria-checked="course"
            @click="choose('course')"
          >
            <span :class="[tile, course && 'bg-accent-soft text-accent-strong']">
              <UiIcon
                name="path"
                :size="16"
              />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[13.5px] font-semibold text-text">Make a course</span>
              <span class="block truncate text-[12px] text-text-muted">{{ course ? 'On: your next message drafts a course' : 'From what you say and add' }}</span>
            </span>
            <UiIcon
              v-if="course"
              name="check"
              :size="15"
              :stroke="2"
              class="shrink-0 text-accent-strong"
            />
          </button>

          <div class="mx-2 my-1 border-t border-border-rule" />

          <button
            v-for="row in ADD"
            :key="row.key"
            type="button"
            role="menuitem"
            :class="item"
            @click="choose(row.key)"
          >
            <span :class="tile">
              <CompanionIcon
                :name="row.icon"
                :size="16"
              />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[13.5px] font-medium text-text">{{ row.title }}</span>
              <span class="block truncate text-[12px] text-text-muted">{{ row.hint }}</span>
            </span>
          </button>

          <div class="mx-2 my-1 border-t border-border-rule" />

          <button
            type="button"
            role="menuitem"
            :class="item"
            aria-haspopup="menu"
            @click="page = 'school'"
          >
            <span :class="tile">
              <CompanionIcon
                name="plug"
                :size="16"
              />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[13.5px] font-medium text-text">Connect your school…</span>
              <span class="block truncate text-[12px] text-text-muted">Courses and deadlines that keep coming in</span>
            </span>
            <UiIcon
              name="chevron-right"
              :size="14"
              :stroke="2"
              class="shrink-0 text-text-faint"
            />
          </button>
        </template>

        <template v-else>
          <button
            type="button"
            role="menuitem"
            class="mb-1 flex h-9 w-full cursor-pointer items-center gap-1.5 rounded-[10px] px-2 text-[13px] font-semibold text-text transition-colors hover:bg-surface-sunken focus-visible:bg-surface-sunken"
            @click="page = 'main'"
          >
            <UiIcon
              name="chevron-left"
              :size="15"
              :stroke="2"
              class="text-text-faint"
            />
            Connect your school
          </button>
          <button
            v-for="door in SCHOOL"
            :key="door.kind"
            type="button"
            role="menuitem"
            :class="item"
            @click="choose(`connect:${door.kind}`)"
          >
            <span :class="tile">
              <CompanionIcon
                :name="door.icon"
                :size="16"
              />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[13.5px] font-medium text-text">{{ door.title }}</span>
              <span
                class="block truncate text-[12px]"
                :class="connected(door.kind)?.tone ?? 'text-text-muted'"
              >{{ connected(door.kind)?.word ?? door.hint }}</span>
            </span>
          </button>
        </template>
      </div>
    </Transition>

    <!-- Phone: the same list as a sheet. -->
    <UiSheet
      v-model:open="sheetOpen"
      :title="page === 'main' ? 'Add to your message' : 'Connect your school'"
    >
      <div class="mt-3 grid gap-0.5">
        <template v-if="page === 'main'">
          <button
            type="button"
            role="menuitem"
            :class="item"
            @click="choose('course')"
          >
            <span :class="[tile, 'size-10', course && 'bg-accent-soft text-accent-strong']">
              <UiIcon
                name="path"
                :size="18"
              />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[15px] font-semibold text-text">Make a course</span>
              <span class="block truncate text-[13px] text-text-muted">{{ course ? 'On: your next message drafts a course' : 'From what you say and add' }}</span>
            </span>
            <UiIcon
              v-if="course"
              name="check"
              :size="17"
              :stroke="2"
              class="shrink-0 text-accent-strong"
            />
          </button>
          <button
            v-for="row in ADD"
            :key="row.key"
            type="button"
            role="menuitem"
            :class="item"
            @click="choose(row.key)"
          >
            <span :class="[tile, 'size-10']">
              <CompanionIcon
                :name="row.icon"
                :size="18"
              />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[15px] font-medium text-text">{{ row.title }}</span>
              <span class="block truncate text-[13px] text-text-muted">{{ row.hint }}</span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            :class="item"
            @click="page = 'school'"
          >
            <span :class="[tile, 'size-10']">
              <CompanionIcon
                name="plug"
                :size="18"
              />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[15px] font-medium text-text">Connect your school…</span>
              <span class="block truncate text-[13px] text-text-muted">Moodle, timetable, email, a photo</span>
            </span>
            <UiIcon
              name="chevron-right"
              :size="16"
              :stroke="2"
              class="shrink-0 text-text-faint"
            />
          </button>
        </template>
        <template v-else>
          <button
            v-for="door in SCHOOL"
            :key="door.kind"
            type="button"
            role="menuitem"
            :class="item"
            @click="choose(`connect:${door.kind}`)"
          >
            <span :class="[tile, 'size-10']">
              <CompanionIcon
                :name="door.icon"
                :size="18"
              />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[15px] font-medium text-text">{{ door.title }}</span>
              <span
                class="block truncate text-[13px]"
                :class="connected(door.kind)?.tone ?? 'text-text-muted'"
              >{{ connected(door.kind)?.word ?? door.hint }}</span>
            </span>
          </button>
          <button
            type="button"
            class="mt-1 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-2 text-[14px] font-semibold text-brand"
            @click="page = 'main'"
          >
            <UiIcon
              name="chevron-left"
              :size="15"
              :stroke="2"
            />
            Back
          </button>
        </template>
      </div>
    </UiSheet>
  </div>
</template>
