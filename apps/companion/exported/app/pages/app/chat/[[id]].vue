<script setup lang="ts">
/**
 * The chat: one place to ask, to make things and to make a course, the way
 * ChatGPT is one place. `/app/chat` is a new chat, `/app/chat/<id>` is a
 * chat, reloadable and bookmarkable; the app sidebar lists them.
 *
 *   ┌──────────────── the conversation (760) ────────────────┬ sources (280) ┐
 *   │ title · Answers from · ⋯                               │ Answers from  │
 *   │ …                                                      │ Added to chat │
 *   │ [ + Ask anything, or tell it what to make…          ↑ ] │ Read in chat  │
 *
 * One file for both addresses (`[[id]]`), with one page key, so the moment
 * a new chat gets its id and the address follows, nothing re-mounts: the
 * answer keeps streaming where it is and the box keeps the caret.
 *
 * It is the same thread as the dock beside a lesson, the drawer on Today
 * and the phone's sheet (`useAiThread`), so "Open full screen" there lands
 * here mid-conversation, and the assistant's button steps aside on this
 * page because the page is the assistant.
 *
 * Empty, it is the usual home in BiliMind's ink: one big question,
 * the box (field, chips, then a row of square controls: +, "Answers from",
 * send), "Choose what to make" tucked under it like a drawer (tiles, the
 * first ones read off the learner's week; make.ts), and "Recent" below:
 * chats, courses and notes to go back to. Making a course is a mode of the
 * same box (the Course tile, `intent`): the question becomes "What do you
 * want to learn?" and the box cycles sentences that work, the first
 * predicted from their next exam. What comes back is a draft in the chat,
 * not a course: the learner checks it, asks for changes in words, and
 * presses Create.
 *
 * A new chat reads its address once, then drops what it read (routes.ts):
 * `q` asks straight away, `prompt` fills the box, `intent=course` starts in
 * course mode, `attach=<ids>` puts notes in the box, `connect=…` opens a
 * "Connect your school" flow. Files dropped anywhere on the page land in
 * the box.
 */
import type { ConnectKind } from '~/companion/create'
import type { MenuAction } from '~/components/ui/Menu.vue'
import { useAi, useAiContext } from '~/companion/ai/state'
import { useAiThread } from '~/companion/ai/thread'
import { COURSE_EXAMPLES, predictedCourse } from '~/companion/ai/suggest'
import { COURSE_TILE } from '~/companion/ai/make'
import { draggingFiles, useAiAttachments } from '~/companion/ai/attach'
import { chatPath, firstAsk } from '~/companion/ai/routes'
import { useCompanion } from '~/companion/store'
import { courseColor } from '~/companion/colors'
import { greeting } from '~/companion/time'

definePageMeta({ layout: 'companion', key: 'app-chat' })

const route = useRoute()
const router = useRouter()
const store = useCompanion()
const ai = useAi()
const t = useAiThread()
const tray = useAiAttachments()

const composer = ref<{ focus: () => void; openConnect: (kind: ConnectKind) => void } | null>(null)

/* -- What it answers from ---------------------------------------------------------- */

/** One course, or all of them: the composer's "Answers from" chip and the sources column both set it. */
const source = computed({
  get: () => t.answersFrom.value,
  set: (value: string | null) => {
    t.answersFrom.value = value
  },
})
const sourceSubject = computed(() => (source.value ? store.get('subjects', source.value) : null))

useAiContext(() =>
  sourceSubject.value
    ? { kind: 'course', label: sourceSubject.value.title, subjectId: sourceSubject.value.id }
    : { kind: 'everything', label: 'All your courses' },
)

const sourcesOpen = ref(true)
const sourcesSheet = ref(false)

function toggleSources(): void {
  if (window.matchMedia('(min-width: 1280px)').matches) sourcesOpen.value = !sourcesOpen.value
  else sourcesSheet.value = true
}

/* -- The chat and the address ---------------------------------------------------------- */

const empty = computed(() => !t.messages.value.length && !t.opening.value)
const course = computed(() => t.intent.value === 'course')
const routeId = computed(() => {
  const id = route.params.id
  const one = Array.isArray(id) ? id[0] : id
  return typeof one === 'string' && one ? one : null
})

function queryOf(name: string): string | null {
  const value = route.query[name]
  const one = Array.isArray(value) ? value[0] : value
  return typeof one === 'string' && one ? one : null
}

async function open(id: string): Promise<void> {
  await t.load(id)
  if (t.threadId.value !== id) {
    // Gone (deleted elsewhere, or a sample chat from before a reload): a new chat instead.
    void router.replace(chatPath())
    return
  }
  // A chat about one course reads that course again when it's picked back up.
  const thread = t.threads.value.find((x) => x.id === id)
  if (thread?.subject_id && store.get('subjects', thread.subject_id)) source.value = thread.subject_id
}

const CONNECTS: ConnectKind[] = ['moodle', 'ics', 'email', 'photo']

/** The caret to the box, on a keyboard; a phone's keyboard stays down until they tap. */
function focusBox(): void {
  if (window.matchMedia('(min-width: 1024px)').matches) t.focus()
}

const READ_ONCE = ['q', 'prompt', 'intent', 'attach', 'connect']

/** The address's query without what a new chat reads once, so nothing is read twice. */
function settledQuery(): Record<string, string | null | (string | null)[]> {
  const rest = { ...route.query }
  for (const k of READ_ONCE) delete rest[k]
  return rest
}

/**
 * Arriving: at a chat (open it), at `/app/chat` (a fresh one), and with
 * whatever the address carried. Runs on mount and on every navigation
 * between chats, since the page stays mounted across them.
 */
let arrived = ''

/**
 * A chat begun a moment ago belongs to this arrival: leaving a workspace
 * mounts this page twice in one navigation, and the second mount must not
 * clear the question the first one just asked from `?q=`.
 */
function justBegun(): boolean {
  const first = t.messages.value[0]
  return Boolean(first && Date.now() - Date.parse(first.created_at) < 4000)
}

function arrive(): void {
  // The same address twice (a replace that raced another) is one arrival.
  if (route.fullPath === arrived) return
  arrived = route.fullPath
  // An address that carries something to do is done once, by whichever
  // mount of this page reads it first (`firstAsk`, kept outside the page).
  const carries = READ_ONCE.some((k) => k in route.query)
  if (carries && !firstAsk(route.fullPath)) {
    focusBox()
    return
  }

  const id = routeId.value
  if (id) {
    if (id !== t.threadId.value || !t.messages.value.length) void open(id)
  } else if ((t.threadId.value || t.messages.value.length) && !justBegun()) {
    // A first answer still on its way here (from the dock's "Open full
    // screen") is this chat, not an old one: it gets its address shortly.
    // Anything else is the chat before: it is left to finish on its own.
    if (!(t.busy.value && !t.threadId.value)) t.reset('q' in route.query)
  }

  const q = queryOf('q')
  const prompt = queryOf('prompt')
  const intent = queryOf('intent')
  const attach = queryOf('attach')
  const connect = queryOf('connect') as ConnectKind | null
  if (!carries) {
    focusBox()
    return
  }

  if (intent === 'course') t.pick(COURSE_TILE)
  if (attach) tray.addNotes(attach.split(',').map((x) => x.trim()).filter(Boolean))
  if (prompt) t.draft.value = prompt
  if (q) t.send(q, { force: true })
  if (connect && CONNECTS.includes(connect)) void nextTick(() => composer.value?.openConnect(connect))
  else focusBox()

  void router.replace({ path: route.path, query: settledQuery() })
}

onMounted(() => {
  t.pageOpen.value += 1
  // Arriving here is arriving at the companion: no drawer over it.
  ai.overlay.value = false
  if (!t.threadsState.loaded) void t.refreshThreads()
  arrive()
})

onBeforeUnmount(() => {
  t.pageOpen.value = Math.max(0, t.pageOpen.value - 1)
})

// A link to another chat, the sidebar's New chat, a starter from the palette.
watch(
  () => route.fullPath,
  (now, before) => {
    if (now !== before && route.path.startsWith('/app/chat')) arrive()
  },
)

// The address follows the chat in front: a new chat's id, a deleted one's absence.
watch(
  () => t.threadId.value,
  (id) => {
    if ((id ?? null) === routeId.value) return
    if (!id && t.opening.value) return
    // Never the read-once part: a new chat's `?q=` must not come back and ask twice.
    void router.replace({ path: chatPath(id), query: settledQuery() })
  },
)

/** A new chat (the address follows); one still answering finishes into its own thread. */
function newChat(): void {
  t.reset()
}

/* -- Title, rename, delete ------------------------------------------------------------ */

const title = computed(() => t.title.value || (course.value ? 'New course' : 'New chat'))
useHead(() => ({ title: `${empty.value ? (course.value ? 'New course' : 'New chat') : title.value} · BiliMind` }))

const renaming = ref(false)
const name = ref('')
const nameField = ref<HTMLInputElement | null>(null)

function startRename(): void {
  if (!t.threadId.value) return
  name.value = t.title.value
  renaming.value = true
  void nextTick(() => {
    nameField.value?.focus()
    nameField.value?.select()
  })
}

function saveRename(): void {
  if (!renaming.value) return
  renaming.value = false
  const id = t.threadId.value
  if (id && name.value.trim()) void t.renameThread(id, name.value)
}

const menu = computed<MenuAction[]>(() => [
  { label: 'Rename', icon: 'pencil', disabled: !t.threadId.value, run: startRename },
  {
    label: 'Delete chat',
    icon: 'trash',
    destructive: true,
    disabled: !t.threadId.value,
    run: () => t.threadId.value && t.removeThread(t.threadId.value),
  },
])

/* -- The empty state ------------------------------------------------------------------ */

const name0 = computed(() => store.userName.value)

/** The one question, and the greeting over it. */
const heading = computed(() => (course.value ? 'What do you want to learn?' : 'What should we learn?'))
const hello = computed(() => `${greeting()}${name0.value ? `, ${name0.value}` : ''}`)

const predicted = computed(() => (store.status.ready ? predictedCourse(store) : null))
const examples = computed(() => (predicted.value ? [predicted.value, ...COURSE_EXAMPLES] : COURSE_EXAMPLES))

const DOORS: { kind: ConnectKind; label: string }[] = [
  { kind: 'moodle', label: 'Moodle' },
  { kind: 'ics', label: 'timetable link' },
  // shortcut: hidden until the inbound worker is live (docs/inbound-worker.md); restore this row then.
  { kind: 'photo', label: 'a photo' },
]

/* -- Files dropped anywhere on the page ------------------------------------------------ */

const dropping = ref(false)
let depth = 0

function onDragEnter(event: DragEvent): void {
  if (!draggingFiles(event)) return
  depth += 1
  dropping.value = true
}

function onDragLeave(event: DragEvent): void {
  if (!draggingFiles(event)) return
  depth = Math.max(0, depth - 1)
  if (!depth) dropping.value = false
}

function onDragOver(event: DragEvent): void {
  if (!draggingFiles(event)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

function onDrop(event: DragEvent): void {
  depth = 0
  dropping.value = false
  if (!draggingFiles(event)) return
  // Taken here, so the window's own drop (file it in Notes) leaves it alone.
  event.preventDefault()
  tray.addFiles(Array.from(event.dataTransfer?.files ?? []))
  t.focus()
}
</script>

<template>
  <div
    class="relative flex min-h-0 flex-1 flex-col bg-surface"
    @dragenter="onDragEnter"
    @dragleave="onDragLeave"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <ShellPageHead
      :title="empty ? (course ? 'New course' : 'New chat') : title"
      bar-only
    >
      <template #bar-actions>
        <button
          type="button"
          class="grid size-11 shrink-0 place-items-center rounded-full text-text-soft active:bg-surface-sunken"
          aria-label="Sources"
          @click="sourcesSheet = true"
        >
          <UiIcon
            name="layers"
            :size="19"
          />
        </button>
        <button
          type="button"
          class="grid size-11 shrink-0 place-items-center rounded-full text-text-soft active:bg-surface-sunken disabled:opacity-40"
          :disabled="empty"
          aria-label="New chat"
          @click="newChat"
        >
          <UiIcon
            name="pencil"
            :size="19"
          />
        </button>
      </template>
    </ShellPageHead>

    <div class="flex min-h-0 flex-1">
      <!-- The conversation -->
      <section class="relative flex min-w-0 flex-1 flex-col">
        <header
          v-if="!empty"
          class="flex h-[52px] shrink-0 items-center gap-2 border-b border-border pr-3 pl-5 max-lg:hidden"
        >
          <form
            v-if="renaming"
            class="min-w-0 flex-1"
            @submit.prevent="saveRename"
          >
            <input
              ref="nameField"
              v-model="name"
              type="text"
              maxlength="120"
              aria-label="Chat name"
              class="h-9 w-full max-w-[480px] rounded-[10px] bg-surface-sunken px-2.5 text-[14.5px] font-semibold text-text outline-none focus:shadow-[inset_0_0_0_1.5px_var(--brand-line)]"
              @keydown.esc.prevent="renaming = false"
              @blur="saveRename"
            >
          </form>
          <button
            v-else-if="t.threadId.value"
            type="button"
            class="-ml-2 h-9 min-w-0 cursor-text truncate rounded-[10px] px-2 text-left text-[14.5px] font-semibold text-text transition-colors hover:bg-surface-sunken focus-visible:bg-surface-sunken"
            title="Rename"
            @click="startRename"
          >
            {{ title }}
          </button>
          <h1
            v-else
            class="min-w-0 truncate text-[14.5px] font-semibold text-text"
          >
            {{ title }}
          </h1>
          <span class="flex-1" />

          <button
            type="button"
            :class="[
              'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors',
              sourcesOpen ? 'bg-surface-sunken text-text' : 'text-text-soft hover:bg-surface-sunken hover:text-text focus-visible:bg-surface-sunken',
            ]"
            :aria-pressed="sourcesOpen"
            title="What this chat reads and has cited"
            @click="toggleSources"
          >
            <i
              v-if="sourceSubject"
              class="size-2 shrink-0 rounded-full"
              :style="{ background: courseColor(sourceSubject.color) }"
            />
            <UiIcon
              v-else
              name="layers"
              :size="13"
              class="shrink-0 text-text-faint"
            />
            Sources
          </button>
          <UiMenu
            v-if="t.threadId.value"
            :actions="menu"
            label="Chat options"
            :title="title"
          />
        </header>

        <!-- Empty: the question, the box with what to make under it, and the way back in. -->
        <div
          v-if="empty"
          class="om-scroll min-h-0 flex-1 overflow-y-auto"
        >
          <div class="mx-auto grid w-full max-w-[840px] content-start gap-12 px-4 pt-[7vh] pb-16 min-[900px]:px-6 min-[900px]:pt-[11vh]">
            <div class="grid gap-7">
              <div
                :key="course ? 'course' : 'ask'"
                class="animate-rise grid justify-items-center gap-2 text-center"
              >
                <p
                  v-if="!course"
                  class="text-[14.5px] text-text-muted"
                >
                  {{ hello }}
                </p>
                <h2 class="t-head text-[30px] leading-[1.08] min-[900px]:text-[44px]">
                  {{ heading }}
                </h2>
              </div>

              <div>
                <div class="relative z-10">
                  <CompanionAiComposer
                    ref="composer"
                    v-model="t.draft.value"
                    :quote="t.quote.value"
                    :busy="t.busy.value"
                    size="lg"
                    hero
                    sources
                    :autofocus="ai.wide.value"
                    :focus-key="t.focusTick.value"
                    :examples="course ? examples : []"
                    menu-placement="down"
                    placeholder="Ask anything, attach your files, or say what you want to learn"
                    @send="(text) => t.send(text)"
                    @stop="t.stop()"
                    @clear-quote="t.quote.value = null"
                    @edit-last="t.editLast()"
                  />
                </div>
                <CompanionAiMakeTray class="-mt-6" />
              </div>

              <!-- Course mode: the school's own way in, one tap each. -->
              <p
                v-if="course"
                class="text-center text-[13.5px] leading-[1.6] text-text-muted"
              >
                At a school? Connect
                <template
                  v-for="(door, i) in DOORS"
                  :key="door.kind"
                >
                  <button
                    type="button"
                    class="cursor-pointer rounded-[4px] font-semibold text-cobalt underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                    @click="composer?.openConnect(door.kind)"
                  >
                    {{ door.label }}</button>{{ i < DOORS.length - 2 ? ', ' : i === DOORS.length - 2 ? ' or ' : '' }}
                </template>
                and your courses and deadlines come in by themselves.
              </p>
            </div>

            <CompanionAiRecent />
          </div>
        </div>

        <CompanionAiThread
          v-else
          variant="page"
          :autofocus="ai.wide.value"
        />
      </section>

      <!-- Sources -->
      <aside
        v-if="sourcesOpen && !empty"
        class="om-scroll w-[280px] shrink-0 overflow-y-auto border-l border-border bg-surface-chrome px-2 py-4 max-xl:hidden"
        aria-label="Sources"
      >
        <CompanionAiSources v-model="source" />
        <p class="mt-6 px-2.5 text-[12px] leading-[1.5] text-text-faint">
          Every answer says where each line came from. It never makes anything until you press its button.
        </p>
      </aside>
    </div>

    <UiSheet
      v-model:open="sourcesSheet"
      title="Sources"
    >
      <div class="mt-3">
        <CompanionAiSources
          v-model="source"
          @navigate="sourcesSheet = false"
        />
      </div>
    </UiSheet>

    <!-- Files over the page: drop anywhere. -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="dropping"
        class="pointer-events-none absolute inset-0 z-40 bg-surface/80 p-4 backdrop-blur-[6px] min-[900px]:p-6"
        aria-hidden="true"
      >
        <div class="grid size-full place-items-center rounded-[28px] border-2 border-dashed border-cobalt bg-cobalt-soft/70">
          <div class="grid justify-items-center gap-3 px-6 text-center">
            <span class="grid size-14 place-items-center rounded-full bg-cobalt text-on-brand">
              <UiIcon
                name="upload"
                :size="24"
              />
            </span>
            <p class="t-head text-[24px] min-[900px]:text-[30px]">
              Drop to add to your message
            </p>
            <p class="text-[15px] text-text-soft">
              PDFs, slides, documents and images, as many as you like
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
