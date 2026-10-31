<script setup lang="ts">
/**
 * The box you ask in, and the one box everything goes in. One component for
 * the docked panel, the drawer, the phone's sheet, the chat page and Today's
 * big "Ask BiliMind…" field, so the keys and the feel are the same
 * everywhere:
 *
 *   <CompanionAiComposer
 *     v-model="draft"
 *     :quote="passage"           // a selection being asked about, drawn as a chip
 *     :busy="answering"          // the send arrow becomes Stop
 *     size="lg"                  // 'md' in a panel, 'lg' on a page of its own
 *     @send="ask"
 *     @stop="stop"
 *     @clear-quote="passage = null"
 *   />
 *
 * It takes a sentence and anything else at once, the way ChatGPT's does:
 *
 *  - The "+" (AttachMenu): upload files, attach notes, add a link, paste
 *    text, a Moodle course, a calendar link, and "Connect your school…".
 *    Its first row is the mode "Make a course": on, it sits in the box as a
 *    lime pill and the next message drafts a course whatever it says.
 *  - The other mode, "Checking your attempt" (its tile, or the button under
 *    an answer that asked for the learner's attempt first), is the same
 *    pill: the box asks for their working ("Paste your working, or add a
 *    photo of it"), and the answer is feedback on it, never a rewrite.
 *  - Pasting: a file or a screenshot becomes a file chip; a wall of text
 *    (over ~1,500 characters) becomes a pasted-text chip, so the question
 *    stays a question; a pasted link is offered as a link chip, which is
 *    read, not just mentioned.
 *  - Dropping files on the box (`dropzone`; the chat page and the dock take
 *    drops anywhere on themselves and hand them to the same tray).
 *
 * The chips are the shared tray (`useAiAttachments`): files upload the
 * moment they're attached, with their progress on the chip, and the send
 * button waits for them. Pressed while something is still going up, it
 * holds (a ring where the arrow was) and sends by itself when the last one
 * is in.
 *
 * Two shapes. In a panel (`md`) it is one line: +, the field, send. On a
 * page (`lg`, the chat page's empty state and its thread) it is Claude
 * Design's: the field first, the chips under it, then one row of square
 * 44px controls, the +, "Answers from ▾ / All your courses" (`sources`,
 * the chat's course picker), the picked tile as a chip, and the lime send
 * at the right end, faded until there is something to send.
 *
 * Enter sends, Shift+Enter is a new line, and an IME still composing a word
 * keeps its Enter. ↑ in an empty box asks for the last question back
 * (`edit-last`). The box grows with what's typed up to a few lines, then
 * scrolls. `focusKey` takes the caret whenever it changes, which is how a
 * request from elsewhere ("Ask about this") lands the learner here.
 */
import type { ConnectKind, TextAttachment } from '~/companion/create'
import { ACCEPT, domainOf, linksIn, normaliseUrl } from '~/companion/create'
import { draggingFiles, LONG_PASTE, useAiAttachments } from '~/companion/ai/attach'
import { useAiThread } from '~/companion/ai/thread'
import { ATTEMPT_TILE, COURSE_TILE } from '~/companion/ai/make'
import type { Subject } from '~/companion/types'
import { pickFolder } from '~/companion/folder'
import { useCompanion } from '~/companion/store'
import type { AttachChoice } from './AttachMenu.vue'
import { resetsIn, useUsage } from '~/companion/usage'

const props = withDefaults(
  defineProps<{
    quote?: string | null
    busy?: boolean
    size?: 'md' | 'lg'
    placeholder?: string
    autofocus?: boolean
    focusKey?: number
    disabled?: boolean
    /** The "Enter to send" line under the box. */
    hint?: boolean
    /** The "+" and the tray. Off for a box that only asks. */
    tools?: boolean
    /** Files dropped on the box itself are attached (a surface with its own drop zone leaves this off). */
    dropzone?: boolean
    /** Sentences the empty box cycles through in place of the placeholder. */
    examples?: string[]
    /** Where the + menu opens: above the box (at the bottom of a thread) or below it (a box in the middle). */
    menuPlacement?: 'up' | 'down'
    /** The tall field of a new chat's home. */
    hero?: boolean
    /** The "Answers from" chip in the row (`lg` only): the chat page's course picker. */
    sources?: boolean
  }>(),
  {
    size: 'md',
    placeholder: 'Ask anything, or tell it what to make…',
    focusKey: 0,
    tools: true,
    dropzone: false,
    examples: () => [],
    menuPlacement: 'up',
  },
)

const emit = defineEmits<{
  send: [text: string]
  stop: []
  'clear-quote': []
  'edit-last': []
}>()

const text = defineModel<string>({ default: '' })
const field = ref<HTMLTextAreaElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const linkInput = ref<HTMLInputElement | null>(null)

const c = useCompanion()
const t = useAiThread()
const tray = useAiAttachments()
const toast = useToast()

const course = computed(() => t.intent.value === 'course')
const attempt = computed(() => t.intent.value === 'attempt')
/** The mode (the + menu's "Make a course", `?intent=course`, "Check my attempt"), drawn as a chip. */
const mode = computed(() =>
  course.value
    ? { label: 'Make a course', icon: 'path' }
    : attempt.value
      ? { label: 'Checking your attempt', icon: 'pencil' }
      : null,
)
const chips = computed(() => (props.tools ? tray.tray.value : []))
/** Words, or something in the tray that is (or soon will be) sendable. */
const hasMaterial = computed(
  () =>
    text.value.trim().length > 0 ||
    (props.tools && tray.tray.value.some((a) => a.kind !== 'file' || (!a.refused && a.state !== 'error'))),
)
const canSend = computed(() => !props.disabled && !props.busy && hasMaterial.value && !queued.value)
const max = computed(() => (props.size === 'lg' ? 240 : 168))
const lg = computed(() => props.size === 'lg')

const moodleSites = computed(() =>
  c.connections.value.filter((x) => x.kind === 'moodle').map((x) => x.site_url ?? '').filter(Boolean),
)

/* -- The field ----------------------------------------------------------------- */

function autosize(): void {
  const el = field.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, max.value)}px`
  el.style.overflowY = el.scrollHeight > max.value ? 'auto' : 'hidden'
}

function focus(): void {
  const el = field.value
  if (!el) return
  el.focus({ preventScroll: true })
  const end = el.value.length
  el.setSelectionRange(end, end)
}

/* -- Sending, and waiting for uploads ------------------------------------------- */

/** Send was pressed while files were still going up: it goes once they're in. */
const queued = ref(false)

function send(): void {
  if (props.disabled || props.busy || !hasMaterial.value) return
  if (props.tools && tray.uploading.value) {
    queued.value = true
    return
  }
  emit('send', text.value.trim())
}

watch(
  () => tray.uploading.value,
  (now) => {
    if (now || !queued.value) return
    queued.value = false
    const failed = tray.tray.value.find((a) => a.kind === 'file' && a.state === 'error' && !a.refused)
    if (failed && failed.kind === 'file') {
      toast.push({
        title: `${failed.name} didn't upload`,
        body: 'Tap its chip to try again, or take it out and send the rest.',
        tone: 'warn',
      })
      return
    }
    if (hasMaterial.value && !props.busy) emit('send', text.value.trim())
  },
)

function onKeydown(event: KeyboardEvent): void {
  if (event.isComposing || event.keyCode === 229) return
  if (event.key === 'Enter' && !event.shiftKey && !event.altKey) {
    event.preventDefault()
    send()
    return
  }
  if (event.key === 'ArrowUp' && !text.value) {
    emit('edit-last')
    nextTick(focus)
    return
  }
  // Backspace in an empty box takes the mode off first, the way a tag in a
  // search field goes.
  if (event.key === 'Backspace' && !text.value && mode.value && field.value?.selectionStart === 0) {
    t.pick(null)
  }
}

/* -- Pasting --------------------------------------------------------------------- */

const offer = ref<{ raw: string; urls: string[] } | null>(null)

function onPaste(event: ClipboardEvent): void {
  if (!props.tools) return
  const files = Array.from(event.clipboardData?.files ?? [])
  if (files.length) {
    event.preventDefault()
    tray.addFiles(files)
    return
  }
  const raw = event.clipboardData?.getData('text/plain') ?? ''
  if (!raw.trim()) return
  if (raw.length > LONG_PASTE) {
    event.preventDefault()
    tray.addText(raw)
    return
  }
  const urls = linksIn(raw).map((u) => normaliseUrl(u)).filter((u): u is string => Boolean(u))
  const onlyLinks = urls.length > 0 && raw.replace(/\b(?:https?:\/\/|webcal:\/\/|www\.)\S+/gi, '').trim().length === 0
  if (onlyLinks) offer.value = { raw, urls }
}

/* The offer goes once what it was about is no longer in the field. */
watch(text, (now) => {
  nextTick(autosize)
  if (offer.value && !now.includes(offer.value.raw.trim())) offer.value = null
})

function takeOffer(): void {
  const o = offer.value
  if (!o) return
  text.value = text.value.replace(o.raw.trim(), '').replace(/[ \t]{2,}/g, ' ').trim()
  tray.addUrls(o.urls, moodleSites.value)
  offer.value = null
  focus()
}

const offerWords = computed(() => {
  const o = offer.value
  if (!o) return ''
  return o.urls.length === 1
    ? `Add ${domainOf(o.urls[0]!)} as a link? It's opened and read.`
    : `Add these ${o.urls.length} links? Each one is opened and read.`
})

/* -- The link field ---------------------------------------------------------------- */

const linkOpen = ref(false)
const linkText = ref('')
const linkProblem = ref<string | null>(null)

function openLink(): void {
  linkOpen.value = true
  linkProblem.value = null
  void nextTick(() => linkInput.value?.focus())
}

function closeLink(): void {
  linkOpen.value = false
  linkText.value = ''
  linkProblem.value = null
}

function addLinkField(): void {
  const found = linksIn(linkText.value)
  const tokens = found.length ? found : linkText.value.split(/[\s,]+/)
  const urls = tokens.map((x) => normaliseUrl(x)).filter((u): u is string => Boolean(u))
  if (!urls.length) {
    linkProblem.value = 'That isn\'t a link. Paste a web address, or several.'
    return
  }
  tray.addUrls(urls, moodleSites.value)
  closeLink()
  focus()
}

/* -- The + menu and its modals --------------------------------------------------------- */

const menuOpen = ref(false)
const notesOpen = ref(false)
const pasteOpen = ref(false)
const editing = ref<TextAttachment | null>(null)
const moodlePick = ref(false)
const calendarOpen = ref(false)
const connectKind = ref<ConnectKind | null>(null)

const pickedNotes = computed(() => tray.tray.value.flatMap((a) => (a.kind === 'note' ? [a.itemId] : [])))
const pickedMoodle = computed(() => tray.tray.value.flatMap((a) => (a.kind === 'moodle' ? [a.subjectId] : [])))

function openConnect(kind: ConnectKind): void {
  moodlePick.value = false
  calendarOpen.value = false
  connectKind.value = kind
}

function choose(choice: AttachChoice): void {
  if (choice === 'course') {
    t.pick(course.value ? null : COURSE_TILE)
    void nextTick(focus)
  } else if (choice === 'files') fileInput.value?.click()
  else if (choice === 'notes') notesOpen.value = true
  else if (choice === 'link') openLink()
  else if (choice === 'paste') openPaste()
  else if (choice === 'moodle') {
    void pickFolder().then((folder) => {
      if (folder) tray.addMoodle(folder as never)
    })
  } else if (choice === 'calendar') calendarOpen.value = true
  else openConnect(choice.slice('connect:'.length) as ConnectKind)
}

function openPaste(item: TextAttachment | null = null): void {
  editing.value = item
  pasteOpen.value = true
}

function savePaste(value: string): void {
  tray.addText(value, editing.value?.id)
  editing.value = null
  void nextTick(focus)
}

function onFiles(event: Event): void {
  const input = event.target as HTMLInputElement
  tray.addFiles(Array.from(input.files ?? []))
  input.value = ''
  focus()
}

function pickMoodle(subject: Subject): void {
  tray.addMoodle(subject)
}

/* -- Files dropped on the box ------------------------------------------------------------ */

const over = ref(false)

function onDragOver(event: DragEvent): void {
  if (!props.dropzone || !props.tools || !draggingFiles(event)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  over.value = true
}

function onDrop(event: DragEvent): void {
  over.value = false
  if (!props.dropzone || !props.tools || !draggingFiles(event)) return
  // Taken here, so the window's own drop (file it in Notes) leaves it alone.
  event.preventDefault()
  tray.addFiles(Array.from(event.dataTransfer?.files ?? []))
  focus()
}

/* -- The examples, cycling in the empty box ------------------------------------------------ */

const shownExample = ref(0)
let cycle: ReturnType<typeof setInterval> | undefined

watch(
  () => props.examples,
  () => {
    shownExample.value = 0
  },
)

watch(
  () => props.focusKey,
  () => nextTick(focus),
)

onMounted(() => {
  autosize()
  if (props.autofocus) nextTick(focus)
  cycle = setInterval(() => {
    if (!text.value && props.examples.length > 1) shownExample.value = (shownExample.value + 1) % props.examples.length
  }, 3200)
})

onBeforeUnmount(() => {
  if (cycle) clearInterval(cycle)
})

const placeholderNow = computed(() => {
  if (props.examples.length) return ''
  if (attempt.value) return ATTEMPT_TILE.placeholder!
  return course.value ? COURSE_TILE.placeholder! : props.placeholder
})

defineExpose({ focus, openConnect, openMenu: () => (menuOpen.value = true) })

const toolBtn =
  'grid shrink-0 cursor-pointer place-items-center rounded-full text-text-soft transition-[background-color,color] duration-150 outline-none hover:bg-surface-sunken hover:text-text focus-visible:bg-surface-sunken focus-visible:text-text'
/** A page's row of controls: square, bordered, 44px, so the row reads as tools and not as chips. */
const squareBtn =
  'grid size-11 shrink-0 cursor-pointer place-items-center rounded-[12px] text-text-soft shadow-[inset_0_0_0_1px_var(--border)] transition-[background-color,color,box-shadow] duration-150 outline-none hover:bg-surface-sunken hover:text-text hover:shadow-[inset_0_0_0_1px_var(--border-field)] focus-visible:shadow-[inset_0_0_0_1.5px_var(--brand-line)]'

const { tightest, ensure: ensureUsage } = useUsage()
onMounted(ensureUsage)
</script>

<template>
  <div class="ai-composer">
    <slot name="above" />

    <div
      :class="[
        'group/box relative flex cursor-text flex-col bg-surface transition-[box-shadow] duration-150',
        lg
          ? 'rounded-[22px] shadow-[inset_0_0_0_1px_var(--border-field),var(--shadow-raised)] hover:shadow-[inset_0_0_0_1px_var(--border-dashed),var(--shadow-raised)]'
          : 'rounded-[18px] p-1.5 shadow-[inset_0_0_0_1px_var(--border-field)] hover:shadow-[inset_0_0_0_1px_var(--border-dashed)]',
        'focus-within:shadow-[inset_0_0_0_1.5px_var(--lime-2),0_0_0_4px_var(--accent-soft)] focus-within:hover:shadow-[inset_0_0_0_1.5px_var(--lime-2),0_0_0_4px_var(--accent-soft)]',
        over && 'shadow-[inset_0_0_0_1.5px_var(--cobalt),0_0_0_4px_var(--brand-soft)]',
        disabled && 'pointer-events-none opacity-60',
      ]"
      @click="focus"
      @dragover="onDragOver"
      @dragleave="over = false"
      @drop="onDrop"
    >
      <!-- Nearly out: said here, where the next question would run into it. -->
      <NuxtLink
        v-if="tightest"
        to="/app/settings?section=usage"
        :class="['flex items-center justify-between gap-3 text-[12.5px] text-text-muted transition-colors hover:text-text', lg ? 'mx-4 mt-3' : 'mx-2 mt-1']"
        @click.stop
      >
        <span>{{ tightest.percent }}% of {{ tightest.name }}'s AI used · resets in {{ resetsIn(tightest.resets_at) }}</span>
        <span class="shrink-0 font-semibold underline underline-offset-4">Usage</span>
      </NuxtLink>

      <!-- The passage being asked about. -->
      <div
        v-if="quote"
        :class="['animate-fade mb-1 flex items-start gap-2 rounded-[12px] bg-surface-sunken py-2 pr-1.5 pl-2.5', lg ? 'mx-3 mt-3' : 'mx-1 mt-1']"
      >
        <UiIcon
          name="chat"
          :size="13"
          class="mt-[3px] shrink-0 text-text-faint"
        />
        <p class="line-clamp-3 min-w-0 flex-1 text-[12.5px] leading-[1.5] text-text-soft italic">
          {{ quote }}
        </p>
        <button
          type="button"
          class="grid size-6 shrink-0 cursor-pointer place-items-center rounded-full text-text-faint transition-colors hover:bg-surface-track hover:text-text focus-visible:bg-surface-track"
          aria-label="Stop asking about this passage"
          title="Remove"
          @click.stop="emit('clear-quote')"
        >
          <UiIcon
            name="x"
            :size="12"
            :stroke="2"
          />
        </button>
      </div>

      <!-- In a panel the chips and the mode sit above the line, so the line keeps its width. -->
      <template v-if="!lg">
        <TransitionGroup
          v-if="chips.length"
          tag="div"
          class="flex flex-wrap gap-1.5 px-1 pt-1 pb-0.5"
          aria-label="Added to this message"
          move-class="transition-transform duration-200"
          leave-active-class="transition duration-150 ease-in absolute"
          leave-to-class="opacity-0 scale-95"
          @click.stop
        >
          <CompanionCreateAttachmentChip
            v-for="a in chips"
            :key="a.id"
            :attachment="a"
            @remove="tray.remove(a.id)"
            @retry="tray.retry(a.id)"
            @open="a.kind === 'text' && openPaste(a)"
          />
        </TransitionGroup>
        <div
          v-if="mode && tools"
          class="px-1 pt-1"
        >
          <span class="animate-fade inline-flex h-8 max-w-full items-center gap-1 rounded-full bg-accent-soft pr-1 pl-2.5 text-[12.5px] font-semibold text-accent-strong">
            <UiIcon
              :name="mode.icon"
              :size="13"
              class="shrink-0"
            />
            <span class="truncate">{{ mode.label }}</span>
            <button
              type="button"
              class="grid size-6 shrink-0 cursor-pointer place-items-center rounded-full transition-colors hover:bg-accent-line focus-visible:bg-accent-line max-lg:size-8"
              :aria-label="`Stop: ${mode.label}`"
              title="Just ask instead"
              @click.stop="t.pick(null)"
            >
              <UiIcon
                name="x"
                :size="11"
                :stroke="2.2"
              />
            </button>
          </span>
        </div>
      </template>

      <div :class="lg ? 'contents' : 'flex items-end gap-1'">
        <CompanionAiAttachMenu
          v-if="!lg && tools"
          v-model:open="menuOpen"
          :course="course"
          :placement="menuPlacement"
          @choose="choose"
        >
          <button
            type="button"
            :class="[toolBtn, 'size-[38px] max-lg:size-11', menuOpen && 'bg-surface-sunken text-text']"
            aria-label="Add files, notes, links and more"
            title="Add files, notes, links and more"
            aria-haspopup="menu"
            :aria-expanded="menuOpen"
            @click.stop="menuOpen = !menuOpen"
          >
            <UiIcon
              name="plus"
              :size="17"
              :stroke="2"
              :class="['transition-transform duration-150', menuOpen && 'rotate-45']"
            />
          </button>
        </CompanionAiAttachMenu>

        <div class="relative min-w-0 flex-1">
          <textarea
            ref="field"
            v-model="text"
            rows="1"
            :placeholder="placeholderNow"
            :disabled="disabled"
            :aria-label="course ? 'What do you want to learn?' : attempt ? 'Your attempt' : 'Ask BiliMind'"
            enterkeyhint="send"
            :class="[
              'block w-full resize-none bg-transparent text-text outline-none placeholder:text-text-faint',
              lg
                ? ['px-[18px] pt-4 pb-2 text-[16px] leading-[1.5]', hero ? 'min-h-[92px] min-[900px]:text-[17px]' : 'min-h-[52px]']
                : 'min-h-[38px] px-2 py-[9px] text-[14px] leading-[1.45] max-lg:text-[16px]',
            ]"
            @keydown="onKeydown"
            @paste="onPaste"
          />
          <!-- Real sentences that work, cycling, while the box is empty. -->
          <div
            v-if="!text && examples.length"
            :class="[
              'pointer-events-none absolute inset-x-0 top-0 overflow-hidden text-text-faint',
              lg ? ['px-[18px] pt-4 text-[16px] leading-[1.5]', hero && 'min-[900px]:text-[17px]'] : 'px-2 pt-[9px] text-[14px] leading-[1.45] max-lg:text-[16px]',
            ]"
            aria-hidden="true"
          >
            <Transition
              enter-active-class="transition duration-300 ease-out motion-reduce:transition-none"
              enter-from-class="translate-y-2 opacity-0"
              leave-active-class="transition duration-200 ease-in motion-reduce:transition-none"
              leave-to-class="-translate-y-2 opacity-0"
              mode="out-in"
            >
              <span
                :key="shownExample"
                class="block truncate"
              >{{ examples[shownExample] }}</span>
            </Transition>
          </div>
        </div>

        <!-- A paste that is really a link. -->
        <div
          v-if="offer"
          :class="['animate-fade mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-[12px] bg-cobalt-soft px-3 py-2', lg ? 'mx-3' : 'hidden']"
          role="status"
          @click.stop
        >
          <UiIcon
            name="link"
            :size="14"
            class="shrink-0 text-cobalt"
          />
          <span class="min-w-0 flex-1 text-[12.5px] leading-snug text-text-body">{{ offerWords }}</span>
          <span class="flex shrink-0 items-center gap-1">
            <UiBtn
              size="sm"
              variant="primary"
              @click="takeOffer"
            >
              Add as {{ offer.urls.length === 1 ? 'link' : 'links' }}
            </UiBtn>
            <UiBtn
              size="sm"
              variant="ghost"
              @click="offer = null"
            >
              Keep as text
            </UiBtn>
          </span>
        </div>

        <!-- On a page the chips sit between the field and the row of controls. -->
        <TransitionGroup
          v-if="lg && chips.length"
          tag="div"
          class="flex flex-wrap gap-2 px-3 pt-1 pb-2"
          aria-label="Added to this message"
          move-class="transition-transform duration-200"
          leave-active-class="transition duration-150 ease-in absolute"
          leave-to-class="opacity-0 scale-95"
          @click.stop
        >
          <CompanionCreateAttachmentChip
            v-for="a in chips"
            :key="a.id"
            :attachment="a"
            @remove="tray.remove(a.id)"
            @retry="tray.retry(a.id)"
            @open="a.kind === 'text' && openPaste(a)"
          />
        </TransitionGroup>

        <!-- The row: +, Answers from, the mode, and send. -->
        <div
          v-if="lg"
          class="flex items-center gap-2 px-3 pt-1 pb-3"
          @click.stop
        >
          <CompanionAiAttachMenu
            v-if="tools"
            v-model:open="menuOpen"
            :course="course"
            :placement="menuPlacement"
            @choose="choose"
          >
            <button
              type="button"
              :class="[squareBtn, menuOpen && 'bg-surface-sunken text-text']"
              aria-label="Add files, notes, links and more"
              title="Add files, notes, links and more"
              aria-haspopup="menu"
              :aria-expanded="menuOpen"
              @click="menuOpen = !menuOpen"
            >
              <UiIcon
                name="plus"
                :size="19"
                :stroke="2"
                :class="['transition-transform duration-150', menuOpen && 'rotate-45']"
              />
            </button>
          </CompanionAiAttachMenu>

          <CompanionAiSourcePick
            v-if="sources"
            v-model="t.answersFrom.value"
            :placement="menuPlacement"
          />

          <span
            v-if="mode && tools"
            class="animate-fade inline-flex h-11 min-w-0 items-center gap-1.5 rounded-[12px] bg-accent-soft pr-1 pl-3 text-[13px] font-semibold text-accent-strong shadow-[inset_0_0_0_1px_var(--accent-line)]"
          >
            <UiIcon
              :name="mode.icon"
              :size="14"
              class="shrink-0"
            />
            <span class="truncate max-sm:max-w-[96px]">{{ mode.label }}</span>
            <button
              type="button"
              class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-[9px] transition-colors hover:bg-accent-line focus-visible:bg-accent-line"
              :aria-label="`Stop: ${mode.label}`"
              title="Just ask instead"
              @click="t.pick(null)"
            >
              <UiIcon
                name="x"
                :size="12"
                :stroke="2.2"
              />
            </button>
          </span>

          <span class="min-w-0 flex-1" />

          <button
            v-if="busy"
            type="button"
            class="grid size-11 shrink-0 cursor-pointer place-items-center rounded-[12px] bg-ink text-paper transition-[background-color,transform] duration-150 hover:bg-ink-2 active:scale-95"
            aria-label="Stop answering"
            title="Stop"
            @click="emit('stop')"
          >
            <span class="block size-3 rounded-[3px] bg-current" />
          </button>
          <button
            v-else-if="queued"
            type="button"
            class="grid size-11 shrink-0 cursor-pointer place-items-center rounded-[12px] bg-accent text-on-accent transition-transform duration-150 active:scale-95"
            aria-label="Sending once the files are up. Press to cancel."
            title="Sends when the files are up · press to wait instead"
            @click="queued = false"
          >
            <UiIcon
              name="loader"
              :size="17"
              class="animate-spin-slow"
            />
          </button>
          <button
            v-else
            type="button"
            :disabled="!canSend"
            :class="[
              'grid size-11 shrink-0 place-items-center rounded-[12px] bg-accent text-on-accent transition-[opacity,transform,filter] duration-150',
              canSend ? 'cursor-pointer hover:brightness-95 active:scale-95' : 'cursor-default opacity-40',
            ]"
            :aria-label="course ? 'Draft the course' : 'Send'"
            :title="tray.uploading.value ? 'Send (Enter) · waits for the files' : course ? 'Draft the course (Enter)' : 'Send (Enter)'"
            @click="send"
          >
            <UiIcon
              name="arrow-right"
              :size="18"
              :stroke="2.2"
              class="-rotate-90"
            />
          </button>
        </div>

        <!-- In a panel: Stop, the waiting ring, or send, at the end of the line. -->
        <template v-if="!lg">
          <button
            v-if="busy"
            type="button"
            class="grid size-[38px] shrink-0 cursor-pointer place-items-center rounded-full bg-ink text-paper transition-[background-color,transform] duration-150 hover:bg-ink-2 active:scale-95 max-lg:size-11"
            aria-label="Stop answering"
            title="Stop"
            @click.stop="emit('stop')"
          >
            <span class="block size-3 rounded-[3px] bg-current" />
          </button>
          <button
            v-else-if="queued"
            type="button"
            class="grid size-[38px] shrink-0 cursor-pointer place-items-center rounded-full bg-ink text-lime transition-transform duration-150 active:scale-95 max-lg:size-11"
            aria-label="Sending once the files are up. Press to cancel."
            title="Sends when the files are up · press to wait instead"
            @click.stop="queued = false"
          >
            <UiIcon
              name="loader"
              :size="15"
              class="animate-spin-slow"
            />
          </button>
          <button
            v-else
            type="button"
            :disabled="!canSend"
            :class="[
              'grid size-[38px] shrink-0 place-items-center rounded-full transition-[background-color,color,transform] duration-150 max-lg:size-11',
              canSend
                ? 'cursor-pointer bg-ink text-lime hover:bg-ink-2 active:scale-95'
                : 'cursor-default bg-surface-track text-text-ghost',
            ]"
            :aria-label="course ? 'Draft the course' : 'Send'"
            :title="tray.uploading.value ? 'Send (Enter) · waits for the files' : course ? 'Draft the course (Enter)' : 'Send (Enter)'"
            @click.stop="send"
          >
            <UiIcon
              name="arrow-right"
              :size="15"
              :stroke="2.2"
              class="-rotate-90"
            />
          </button>
        </template>
      </div>

      <!-- A link pasted in a panel, and the link field anywhere. -->
      <div
        v-if="offer && !lg"
        class="animate-fade mx-1 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-[12px] bg-cobalt-soft px-3 py-2"
        role="status"
        @click.stop
      >
        <UiIcon
          name="link"
          :size="14"
          class="shrink-0 text-cobalt"
        />
        <span class="min-w-0 flex-1 text-[12.5px] leading-snug text-text-body">{{ offerWords }}</span>
        <span class="flex shrink-0 items-center gap-1">
          <UiBtn
            size="sm"
            variant="primary"
            @click="takeOffer"
          >
            Add as {{ offer.urls.length === 1 ? 'link' : 'links' }}
          </UiBtn>
          <UiBtn
            size="sm"
            variant="ghost"
            @click="offer = null"
          >
            Keep as text
          </UiBtn>
        </span>
      </div>
      <form
        v-if="linkOpen"
        :class="['animate-fade grid gap-1', lg ? 'mx-3 mb-3 -mt-1' : 'mx-1 mt-1']"
        @submit.prevent="addLinkField"
        @click.stop
      >
        <div class="flex items-center gap-1 rounded-full bg-surface-sunken py-0.5 pr-0.5 pl-3 focus-within:shadow-[inset_0_0_0_1.5px_var(--brand-line)]">
          <UiIcon
            name="link"
            :size="14"
            class="shrink-0 text-text-faint"
          />
          <input
            ref="linkInput"
            v-model="linkText"
            type="text"
            inputmode="url"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            aria-label="Links"
            placeholder="Paste a link, or several"
            class="h-9 min-w-0 flex-1 bg-transparent text-[14px] text-text outline-none placeholder:text-text-faint max-lg:h-11 max-lg:text-[16px]"
            @keydown.esc.prevent.stop="closeLink"
            @input="linkProblem = null"
          >
          <UiBtn
            type="submit"
            size="sm"
            variant="primary"
            :disabled="!linkText.trim()"
          >
            Add
          </UiBtn>
          <button
            type="button"
            :class="[toolBtn, 'size-8 max-lg:size-11']"
            aria-label="Close"
            title="Close (Esc)"
            @click="closeLink"
          >
            <UiIcon
              name="x"
              :size="13"
              :stroke="2"
            />
          </button>
        </div>
        <p
          v-if="linkProblem"
          class="px-3 text-[12.5px] font-medium text-danger-text"
          role="alert"
        >
          {{ linkProblem }}
        </p>
      </form>
    </div>

    <p
      v-if="hint"
      class="mt-2 px-2 text-center text-[11.5px] text-text-faint max-lg:hidden"
    >
      Enter to send · Shift+Enter for a new line · Drop files anywhere · It only makes things when you press their button
    </p>

    <template v-if="tools">
      <input
        ref="fileInput"
        type="file"
        multiple
        :accept="ACCEPT"
        class="hidden"
        @change="onFiles"
      >
      <CompanionNotesPicker
        v-model:open="notesOpen"
        title="Attach notes"
        confirm="Attach"
        :exclude="pickedNotes"
        @pick="tray.addNotes"
      />
      <CompanionCreatePasteModal
        v-model:open="pasteOpen"
        :initial="editing?.text"
        @save="savePaste"
      />
      <CompanionCreateMoodlePick
        v-model:open="moodlePick"
        :picked="pickedMoodle"
        @pick="pickMoodle"
        @connect="openConnect('moodle')"
      />
      <CompanionCreateCalendarAttach
        v-model:open="calendarOpen"
        @add="tray.addCalendar"
        @connect="openConnect('ics')"
      />
      <CompanionCreateConnectModal
        :kind="connectKind"
        @close="connectKind = null"
      />
    </template>
  </div>
</template>
