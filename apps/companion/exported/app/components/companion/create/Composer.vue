<script setup lang="ts">
/**
 * The course maker's box (it was /app/new's; the chat's composer took over its
 * tools): say what you want to learn, and put in anything
 * you have. ChatGPT's composer, because everybody already knows how to use
 * it — a field that grows as you type, the things you've added sitting
 * inside the same box as chips, and a row of tools along its bottom with
 * the one button on the right.
 *
 *  - The field. Empty, it cycles through real examples ("Italian to B1 by
 *    June", "IELTS 7.0 on 14 December") so the kind of sentence that works
 *    is shown, not explained. Enter builds, Shift+Enter is a new line, as in
 *    every chat box; ⌘Enter builds from anywhere on the page.
 *  - Pasting. A link pasted into the field is offered as a link chip (it is
 *    read, not just mentioned); a wall of text is offered as a pasted-text
 *    chip, so the sentence stays a sentence; a pasted screenshot becomes a
 *    file.
 *  - The tray. Files, links, pasted text, a Moodle course, a calendar link,
 *    all at once, each one removable (AttachmentChip).
 *  - The tools. Files (several at once), Link (an inline field that takes a
 *    whole list), Paste text (a modal), Moodle and Calendar (the page opens
 *    those, because they also connect things). On a phone they fold to a
 *    row of 44px icons and the button says just "Build".
 *
 * The page owns the text and the attachments (v-models) and decides what
 * building means; this only collects.
 */
import type { Attachment, TextAttachment } from '~/companion/create'
import {
  ACCEPT,
  domainOf,
  fileAttachment,
  hasMaterial,
  linkAttachment,
  linksIn,
  normaliseUrl,
  textAttachment,
  wordsIn,
} from '~/companion/create'

const props = withDefaults(
  defineProps<{
    /** Building: everything locks and the button spins. */
    busy?: boolean
    /** Examples the empty field cycles through. */
    examples: string[]
    /** Connected Moodle sites, so a link to one is drawn as a Moodle course. */
    moodleSites?: string[]
  }>(),
  { busy: false, moodleSites: () => [] },
)

const emit = defineEmits<{
  submit: []
  moodle: []
  calendar: []
}>()

const text = defineModel<string>('text', { required: true })
const attachments = defineModel<Attachment[]>('attachments', { required: true })

const toast = useToast()
const field = ref<HTMLTextAreaElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const linkInput = ref<HTMLInputElement | null>(null)

const MAX_FILES = 20
/** Longer than this, a paste is material, not a sentence. */
const LONG_PASTE_WORDS = 120

const canBuild = computed(() => !props.busy && hasMaterial(text.value, attachments.value))

/* -- The field ------------------------------------------------------------- */

/** One line at rest, grows with the text, scrolls only past ~9 lines. */
function autosize(): void {
  const el = field.value
  if (!el) return
  el.style.height = '0px'
  const full = el.scrollHeight
  el.style.height = `${Math.min(full, 260)}px`
  el.style.overflowY = full > 260 ? 'auto' : 'hidden'
}

watch(text, () => nextTick(autosize))

const coarse = ref(false)
const mod = ref('⌘')

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.isComposing) return
  // ⌘Enter is the page's; plain Enter builds on a keyboard, and is a new
  // line on a phone, where the keyboard's return key has no Shift.
  if (event.metaKey || event.ctrlKey) return
  if (event.shiftKey || coarse.value) return
  event.preventDefault()
  if (canBuild.value) emit('submit')
}

/* -- The examples, cycling in the empty field ------------------------------ */

const shownExample = ref(0)
let cycle: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  autosize()
  coarse.value = window.matchMedia('(pointer: coarse)').matches
  if (!/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)) mod.value = 'Ctrl'
  cycle = setInterval(() => {
    if (!text.value) shownExample.value = (shownExample.value + 1) % props.examples.length
  }, 3200)
})

onBeforeUnmount(() => {
  if (cycle) clearInterval(cycle)
})

/* -- Pasting ---------------------------------------------------------------- */

type Offer = { kind: 'links'; raw: string; urls: string[] } | { kind: 'text'; raw: string }
const offer = ref<Offer | null>(null)

function onPaste(event: ClipboardEvent): void {
  const files = Array.from(event.clipboardData?.files ?? [])
  if (files.length) {
    event.preventDefault()
    addFiles(files)
    return
  }
  const raw = event.clipboardData?.getData('text/plain') ?? ''
  if (!raw.trim()) return
  const urls = linksIn(raw).map((u) => normaliseUrl(u)).filter((u): u is string => Boolean(u))
  const onlyLinks = urls.length > 0 && raw.replace(/\b(?:https?:\/\/|webcal:\/\/|www\.)\S+/gi, '').trim().length === 0
  if (onlyLinks) offer.value = { kind: 'links', raw, urls }
  else if (wordsIn(raw) >= LONG_PASTE_WORDS) offer.value = { kind: 'text', raw }
}

/* The offer goes once what it was about is no longer in the field. */
watch(text, (now) => {
  if (offer.value && !now.includes(offer.value.raw.trim())) offer.value = null
})

function takeOffer(): void {
  const o = offer.value
  if (!o) return
  text.value = text.value.replace(o.raw.trim(), '').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  if (o.kind === 'links') addUrls(o.urls)
  else add([textAttachment(o.raw)])
  offer.value = null
  field.value?.focus()
}

const offerWords = computed(() => {
  const o = offer.value
  if (!o) return ''
  if (o.kind === 'text') return `That's ${wordsIn(o.raw).toLocaleString('en')} words. Add it as pasted text, so BiliMind reads it as material?`
  return o.urls.length === 1
    ? `Add ${domainOf(o.urls[0]!)} as a link? BiliMind opens it and reads it.`
    : `Add these ${o.urls.length} links? BiliMind opens and reads each one.`
})

/* -- Adding things ---------------------------------------------------------- */

function add(list: Attachment[]): void {
  attachments.value = [...attachments.value, ...list]
}

function remove(id: string): void {
  attachments.value = attachments.value.filter((a) => a.id !== id)
}

function addFiles(files: File[]): void {
  const have = attachments.value.filter((a) => a.kind === 'file')
  const fresh = files.filter((f) => !have.some((a) => a.kind === 'file' && a.name === f.name && a.size === f.size))
  const room = Math.max(0, MAX_FILES - have.length)
  if (fresh.length > room) toast.info(`Up to ${MAX_FILES} files at a time. The first ${room} are in.`)
  add(fresh.slice(0, room).map(fileAttachment))
}

function addUrls(urls: string[]): number {
  const have = new Set(
    attachments.value.flatMap((a) => (a.kind === 'link' || a.kind === 'calendar' ? [a.url] : [])),
  )
  const fresh = [...new Set(urls)].filter((u) => !have.has(u))
  add(fresh.map((u) => linkAttachment(u, props.moodleSites)))
  return fresh.length
}

function onFiles(event: Event): void {
  const input = event.target as HTMLInputElement
  addFiles(Array.from(input.files ?? []))
  input.value = ''
}

/* -- The link field --------------------------------------------------------- */

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
  const urls = tokens.map((t) => normaliseUrl(t)).filter((u): u is string => Boolean(u))
  if (!urls.length) {
    linkProblem.value = 'That isn\'t a link. Paste a web address, or several.'
    return
  }
  addUrls(urls)
  closeLink()
  field.value?.focus()
}

/* -- Pasted text ------------------------------------------------------------ */

const pasteOpen = ref(false)
const editing = ref<TextAttachment | null>(null)

function openPaste(item: TextAttachment | null = null): void {
  editing.value = item
  pasteOpen.value = true
}

function savePaste(value: string): void {
  if (editing.value) {
    const id = editing.value.id
    attachments.value = attachments.value.map((a) => (a.id === id ? textAttachment(value, id) : a))
  } else add([textAttachment(value)])
  editing.value = null
}

/* -- The tools -------------------------------------------------------------- */

const TOOLS = [
  { key: 'files', icon: 'upload', label: 'Files', hint: 'PDFs, slides, documents, images' },
  { key: 'link', icon: 'link', label: 'Link', hint: 'One or more web addresses' },
  { key: 'paste', icon: 'paste', label: 'Paste text', hint: 'A syllabus, an announcement, notes' },
  { key: 'moodle', icon: 'cap', label: 'Moodle', hint: 'One of your Moodle courses' },
  { key: 'calendar', icon: 'calendar', label: 'Calendar', hint: 'A calendar link for this course' },
] as const

function tool(key: (typeof TOOLS)[number]['key']): void {
  if (key === 'files') fileInput.value?.click()
  else if (key === 'link' && linkOpen.value) closeLink()
  else if (key === 'link') openLink()
  else if (key === 'paste') openPaste()
  else if (key === 'moodle') emit('moodle')
  else emit('calendar')
}

defineExpose({
  focus: () => field.value?.focus(),
  addFiles,
  addUrls,
})
</script>

<template>
  <div
    class="relative rounded-[24px] border bg-surface transition-[border-color,box-shadow] duration-200"
    :class="busy
      ? 'border-border shadow-card'
      : 'border-border-strong shadow-lift focus-within:shadow-[0_0_0_5px_color-mix(in_oklab,var(--accent)_45%,transparent),var(--shadow-lift)]'"
  >
    <!-- The field, and the example under it while it's empty. -->
    <div class="relative">
      <label
        for="cp-create-field"
        class="sr-only"
      >What you want to learn</label>
      <textarea
        id="cp-create-field"
        ref="field"
        v-model="text"
        rows="1"
        enterkeyhint="send"
        class="block min-h-[64px] w-full resize-none bg-transparent px-5 pt-5 pb-2 text-[17px] leading-[1.55] text-text caret-brand outline-none disabled:opacity-60 min-[600px]:min-h-[72px] min-[600px]:px-6 min-[600px]:pt-6 min-[600px]:text-[18px]"
        :disabled="busy"
        @keydown="onKeydown"
        @paste="onPaste"
      />
      <div
        v-if="!text"
        class="pointer-events-none absolute top-5 right-5 left-5 overflow-hidden text-[17px] leading-[1.55] text-text-faint min-[600px]:top-6 min-[600px]:right-6 min-[600px]:left-6 min-[600px]:text-[18px]"
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

    <!-- A paste that is really a link, or really material. -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="offer && !busy"
        class="mx-3 mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[14px] bg-brand-soft px-3.5 py-2.5 min-[600px]:mx-4"
        role="status"
      >
        <CompanionIcon
          :name="offer.kind === 'links' ? 'link' : 'paste'"
          :size="16"
          class="shrink-0 text-brand"
        />
        <span class="min-w-0 flex-1 text-[13.5px] leading-snug text-text-body">{{ offerWords }}</span>
        <span class="flex shrink-0 items-center gap-1">
          <UiBtn
            size="sm"
            variant="primary"
            @click="takeOffer"
          >
            {{ offer.kind === 'links' ? (offer.urls.length === 1 ? 'Add as link' : 'Add as links') : 'Add as pasted text' }}
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
    </Transition>

    <!-- The tray. -->
    <TransitionGroup
      v-if="attachments.length"
      tag="div"
      class="flex flex-wrap gap-2 px-3 pb-3 min-[600px]:px-4"
      aria-label="Added to this course"
      move-class="transition-transform duration-200"
      leave-active-class="transition duration-150 ease-in absolute"
      leave-to-class="opacity-0 scale-95"
    >
      <CompanionCreateAttachmentChip
        v-for="a in attachments"
        :key="a.id"
        :attachment="a"
        :locked="busy"
        @remove="remove(a.id)"
        @open="a.kind === 'text' && openPaste(a)"
      />
    </TransitionGroup>

    <!-- The link field, inline. -->
    <form
      v-if="linkOpen && !busy"
      class="animate-rise mx-3 mb-3 grid gap-1.5 min-[600px]:mx-4"
      @submit.prevent="addLinkField"
    >
      <div class="flex items-center gap-1.5 rounded-full border border-border-field bg-surface-mute py-1 pr-1 pl-4 focus-within:border-brand focus-within:ring-3 focus-within:ring-brand-line">
        <UiIcon
          name="link"
          :size="15"
          class="shrink-0 text-text-faint"
        />
        <label
          for="cp-create-link"
          class="sr-only"
        >Links</label>
        <input
          id="cp-create-link"
          ref="linkInput"
          v-model="linkText"
          type="text"
          inputmode="url"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          placeholder="Paste a link, or several"
          class="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-text outline-none placeholder:text-text-faint"
          @keydown.esc.prevent="closeLink"
          @input="linkProblem = null"
        >
        <UiBtn
          type="submit"
          size="md"
          variant="primary"
          :disabled="!linkText.trim()"
        >
          Add
        </UiBtn>
        <UiBtn
          size="md"
          variant="ghost"
          square
          icon="x"
          label="Close"
          @click="closeLink"
        />
      </div>
      <p
        v-if="linkProblem"
        class="px-4 text-[13px] font-medium text-danger-text"
        role="alert"
      >
        {{ linkProblem }}
      </p>
    </form>

    <!-- The tools, and the one button. -->
    <div class="flex items-center gap-0.5 border-t border-border-rule px-2 py-2 min-[600px]:gap-1 min-[600px]:px-3 min-[600px]:py-2.5">
      <button
        v-for="t in TOOLS"
        :key="t.key"
        type="button"
        class="inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full text-[13.5px] font-medium text-text-soft transition-colors duration-150 outline-none hover:bg-surface-track hover:text-text focus-visible:ring-2 focus-visible:ring-brand-line disabled:pointer-events-none disabled:opacity-40 max-[599px]:w-11 min-[600px]:h-9 min-[600px]:px-3"
        :class="t.key === 'link' && linkOpen && 'bg-surface-track text-text'"
        :disabled="busy"
        :title="`${t.label}: ${t.hint}`"
        :aria-label="t.label"
        @click="tool(t.key)"
      >
        <CompanionIcon
          :name="t.icon"
          :size="17"
        />
        <span class="max-[599px]:sr-only">{{ t.label }}</span>
      </button>

      <span class="min-w-0 flex-1" />

      <UiBtn
        variant="accent"
        size="lg"
        class="shrink-0"
        :loading="busy"
        :disabled="!canBuild && !busy"
        :title="`Build my course (${mod}Enter)`"
        @click="emit('submit')"
      >
        <span class="max-[599px]:hidden">Build my course</span>
        <span class="min-[600px]:hidden">Build</span>
        <UiIcon
          name="arrow-right"
          :size="16"
        />
      </UiBtn>
    </div>

    <input
      ref="fileInput"
      type="file"
      multiple
      :accept="ACCEPT"
      class="hidden"
      @change="onFiles"
    >

    <CompanionCreatePasteModal
      v-model:open="pasteOpen"
      :initial="editing?.text"
      @save="savePaste"
    />
  </div>
</template>
