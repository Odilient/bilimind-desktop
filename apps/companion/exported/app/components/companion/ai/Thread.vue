<script setup lang="ts">
/**
 * The conversation and the box under it, as the docked panel, the drawer,
 * the phone's sheet and the chat page all draw it (`variant` sets the
 * measure and the type size; the state is the one shared thread,
 * `useAiThread`).
 *
 * Empty, it is a greeting, one line on what it can see, and three or four
 * questions predicted for exactly what is on screen (suggest.ts), each one
 * tap from an answer, and over the box a strip of "Choose what to make"
 * tiles (a course, flashcards, a quiz, a mind map…), the dock's compact
 * version of the chat page's tray. A page that draws its own empty state
 * (the chat page's home) passes `#empty`.
 *
 * Files dragged over the panel (dock, drawer, sheet) land in the box: the
 * whole column lights up as one drop target, so the learner doesn't have to
 * aim at the composer. The chat page takes drops on the whole page itself,
 * so the `page` variant leaves them to it.
 *
 * It follows the answer down as it streams, unless the reader has scrolled
 * up to re-read something: then it stays put and offers a "Jump to the
 * latest" button instead. Following is measured from the content's own
 * size (a ResizeObserver), so a card or a chip that appears late still
 * keeps the bottom in view. Status and completion are announced politely
 * for screen readers; the streaming text itself is not, word by word.
 */
import { useAi } from '~/companion/ai/state'
import { messageKey, useAiThread } from '~/companion/ai/thread'
import { draggingFiles, useAiAttachments } from '~/companion/ai/attach'
import { useAiSuggestions } from '~/companion/ai/suggest'
import { useCompanion } from '~/companion/store'
import { greeting } from '~/companion/time'

const props = withDefaults(
  defineProps<{
    variant?: 'panel' | 'page'
    autofocus?: boolean
  }>(),
  { variant: 'panel' },
)

const ai = useAi()
const t = useAiThread()
const store = useCompanion()
const suggestions = useAiSuggestions()

const ctx = computed(() => ai.context.value)
const subject = computed(() => (ctx.value.subjectId ? store.get('subjects', ctx.value.subjectId) : null))
const empty = computed(() => !t.messages.value.length && !t.opening.value)

const KIND_WORD: Record<string, string> = {
  lesson: 'this lesson',
  page: 'this page',
  board: 'this whiteboard',
  deadline: 'this deadline',
}

const heading = computed(() => {
  const c = ctx.value
  if (c.kind === 'lesson' || c.kind === 'page' || c.kind === 'course') return `Ask about ${c.label}`
  if (c.kind === 'board') return 'Ask about this whiteboard'
  if (c.kind === 'deadline') return `Get ready for ${c.label}`
  if (c.kind === 'notes') return 'Ask about your notes'
  const name = store.userName.value
  return name ? `${greeting()}, ${name}` : 'What should we look at?'
})

const seeLine = computed(() => {
  const c = ctx.value
  const course = subject.value?.title
  if (t.scope.value === 'here') {
    const what = KIND_WORD[c.kind] ?? 'what\'s on screen'
    return `I can read ${what} as you see it${course ? `, and all of ${course} if you widen the scope` : ''}.`
  }
  if (t.scope.value === 'course' && course) return `I'll answer from all of ${course}: classes, slides, recordings, your notes and cards.`
  return 'I\'ll answer from all your courses, notes and deadlines, and I can make notes, cards, maps and plans for you.'
})

/* -- Following the answer ----------------------------------------------------- */

const scroller = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)
const stick = ref(true)

function atBottom(): boolean {
  const el = scroller.value
  return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 72
}

function onScroll(): void {
  stick.value = atBottom()
}

function toBottom(smooth = false): void {
  const el = scroller.value
  if (!el) return
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
}

let observer: ResizeObserver | null = null
onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !content.value) return
  observer = new ResizeObserver(() => {
    if (stick.value) toBottom()
  })
  observer.observe(content.value)
  nextTick(() => toBottom())
})
onBeforeUnmount(() => observer?.disconnect())

// Asking is a promise to look at the answer: follow it from the start.
watch(
  () => t.messages.value.length,
  (n, before) => {
    if (n > (before ?? 0)) {
      stick.value = true
      nextTick(() => toBottom(true))
    }
  },
)
// A thread opened from history starts at its end.
watch(
  () => t.threadId.value,
  () => {
    stick.value = true
    nextTick(() => toBottom())
  },
)

/* -- Sending -------------------------------------------------------------------- */

function send(text: string): void {
  t.send(text)
}

function ask(prompt: string): void {
  t.send(prompt)
}

/** The answer carrying the newest draft: every earlier draft was replaced by it. */
const lastDraft = computed(() => {
  for (let i = t.messages.value.length - 1; i >= 0; i--) {
    if (t.messages.value[i]!.proposal) return t.messages.value[i]!.id
  }
  return null
})

/* -- Files dropped on the panel ---------------------------------------------------- */

const tray = useAiAttachments()
const dropping = ref(false)
let depth = 0

function onDragEnter(event: DragEvent): void {
  if (page.value || !draggingFiles(event)) return
  depth += 1
  dropping.value = true
}

function onDragLeave(event: DragEvent): void {
  if (page.value || !draggingFiles(event)) return
  depth = Math.max(0, depth - 1)
  if (!depth) dropping.value = false
}

function onDragOver(event: DragEvent): void {
  if (page.value || !draggingFiles(event)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

function onDrop(event: DragEvent): void {
  depth = 0
  dropping.value = false
  if (page.value || !draggingFiles(event)) return
  // Taken here, so the window's own drop (file it in Notes) leaves it alone.
  event.preventDefault()
  tray.addFiles(Array.from(event.dataTransfer?.files ?? []))
  t.focus()
}

const lastAssistant = computed(() => {
  for (let i = t.messages.value.length - 1; i >= 0; i--) {
    if (t.messages.value[i]!.role === 'assistant') return t.messages.value[i]!.id
  }
  return null
})

/** What a screen reader hears: what it's reading, then that the answer is in. */
const announce = computed(() => {
  const pending = t.messages.value.find((m) => m.pending)
  if (pending) return pending.text ? 'Answering…' : pending.status || 'Thinking…'
  const last = t.messages.value[t.messages.value.length - 1]
  if (last?.role === 'assistant') return last.error ? `Couldn't answer: ${last.error}` : 'Answer ready.'
  return ''
})

const page = computed(() => props.variant === 'page')
</script>

<template>
  <div
    class="relative flex min-h-0 flex-1 flex-col"
    @dragenter="onDragEnter"
    @dragleave="onDragLeave"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <!-- Files over the panel: all of it is the target. -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="dropping"
        class="pointer-events-none absolute inset-2 z-20 grid place-items-center rounded-[14px] border-2 border-dashed border-brand-line bg-surface/85 backdrop-blur-[4px]"
        aria-hidden="true"
      >
        <div class="grid justify-items-center gap-2 px-6 text-center">
          <span class="grid size-11 place-items-center rounded-full bg-sky-soft text-sky-ink">
            <UiIcon
              name="upload"
              :size="20"
            />
          </span>
          <p class="font-display text-[17px] font-semibold text-text">
            Drop to add to your message
          </p>
          <p class="text-[12.5px] text-text-soft">
            PDFs, slides, documents and images
          </p>
        </div>
      </div>
    </Transition>

    <div
      ref="scroller"
      class="om-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"
      @scroll.passive="onScroll"
    >
      <div
        ref="content"
        :class="[
          'flex flex-col',
          page ? 'mx-auto w-full max-w-[760px] gap-7 px-4 pt-6 pb-10 min-[900px]:px-6' : 'gap-5 px-4 pt-3 pb-6',
        ]"
      >
        <!-- A chat being opened from history. -->
        <div
          v-if="t.opening.value"
          class="grid gap-4 pt-2"
          aria-busy="true"
          aria-label="Opening the chat"
        >
          <span class="cp-skel ml-auto h-9 w-[58%] rounded-[18px]" />
          <span class="cp-skel h-4 w-[86%]" />
          <span class="cp-skel h-4 w-[72%]" />
          <span class="cp-skel h-4 w-[64%]" />
        </div>

        <template v-else-if="empty">
          <slot name="empty">
            <div class="animate-rise grid justify-items-center gap-1.5 px-1 pt-8 pb-2 text-center">
              <CompanionAiBilim
                class="mb-2"
                :size="54"
                mood="happy"
                follow
              />
              <h2 class="font-display text-[21px] leading-[1.2] font-semibold tracking-[-0.025em] text-balance text-text">
                {{ heading }}
              </h2>
              <p class="max-w-[32ch] text-[13px] leading-[1.5] text-text-muted">
                {{ seeLine }}
              </p>

              <!-- Questions for what's on screen: the landing's follow-up pills. -->
              <ul
                v-if="suggestions.length"
                class="mt-3 flex flex-wrap justify-center gap-1.5"
                aria-label="Suggested questions"
              >
                <li
                  v-for="s in suggestions"
                  :key="s.prompt"
                  class="max-w-full"
                >
                  <button
                    type="button"
                    class="inline-flex min-h-8 max-w-full cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-left text-[12.5px] font-semibold text-text-dim shadow-[inset_0_0_0_1px_var(--border-strong)] transition-[background-color,box-shadow,color] duration-200 hover:bg-accent-soft hover:text-accent-strong hover:shadow-[inset_0_0_0_1px_var(--accent-line)] focus-visible:bg-accent-soft max-lg:min-h-10"
                    :title="s.prompt"
                    @click="ask(s.prompt)"
                  >
                    <CompanionIcon
                      :name="s.icon"
                      :size="13"
                      class="shrink-0 opacity-70"
                    />
                    <span class="min-w-0 truncate">{{ s.label }}</span>
                  </button>
                </li>
              </ul>
            </div>
          </slot>
        </template>

        <template v-else>
          <CompanionAiMessage
            v-for="m in t.messages.value"
            :key="messageKey(m)"
            :message="m"
            :last="m.id === lastAssistant"
            :variant="variant"
            :subject-id="ctx.subjectId ?? null"
            :topic-id="ctx.topicId ?? null"
            :replaced="Boolean(m.proposal) && m.id !== lastDraft"
            @retry="t.retry()"
          />
        </template>
      </div>
    </div>

    <div
      :class="[
        'relative shrink-0',
        page ? 'mx-auto w-full max-w-[760px] px-4 pb-4 min-[900px]:px-6' : 'px-3 pb-3 max-lg:pb-[max(12px,env(safe-area-inset-bottom))]',
      ]"
    >
      <!-- The reader scrolled up while it answered: offer the way back, don't drag them. -->
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="translate-y-1 opacity-0"
        leave-active-class="transition duration-100 ease-in"
        leave-to-class="opacity-0"
      >
        <button
          v-if="!stick && !empty"
          type="button"
          class="absolute bottom-full left-1/2 z-10 mb-3 inline-flex h-8 -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-full bg-surface px-3 text-[12.5px] font-semibold text-text shadow-raised ring-1 ring-border transition-colors hover:bg-surface-sunken focus-visible:bg-surface-sunken"
          @click="toBottom(true)"
        >
          <UiIcon
            name="arrow-right"
            :size="13"
            :stroke="2"
            class="rotate-90"
          />
          Jump to the latest
        </button>
      </Transition>

      <!-- The dock's compact "Choose what to make": a strip of tiles over the box. -->
      <CompanionAiMakeTray
        v-if="!page && empty"
        variant="row"
      />

      <CompanionAiComposer
        v-model="t.draft.value"
        :quote="t.quote.value"
        :busy="t.busy.value"
        :size="page ? 'lg' : 'md'"
        :sources="page"
        :hint="page"
        :autofocus="autofocus"
        :focus-key="t.focusTick.value"
        @send="send"
        @stop="t.stop()"
        @clear-quote="t.quote.value = null"
        @edit-last="t.editLast()"
      />
    </div>

    <p
      class="sr-only"
      aria-live="polite"
      role="status"
    >
      {{ announce }}
    </p>
  </div>
</template>
