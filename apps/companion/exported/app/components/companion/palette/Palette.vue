<script setup lang="ts">
/**
 * The ⌘K palette (app/companion/palette.ts has the list and the why). Mounted
 * once by the companion's layout; ⌘K, `/`, the rail's Search and a phone
 * bar's search open it.
 *
 * Drawn as the old product's search palette was (`ShellSearchPalette`), for
 * that one's reasons: pinned near the top rather than centred, so arriving
 * rows never push the field under the pointer; the whole screen on a phone,
 * where the keyboard takes the bottom half. And the combobox pattern: the
 * caret never leaves the field, ↑↓ move a highlight, Enter takes it, the
 * pointer only moves the highlight when it actually moves.
 *
 * Every row is one thing: an icon, what it is, one quiet line of where it
 * lives, and on the row in front what Enter will do ("Open ↵", "Ask ↵").
 * The chat's rows (New chat, empty; "Ask Bili: …", typing) wear the
 * AI's mark, the ink disc with the yellow spark, so the rows that leave the
 * search for the chat are never mistaken for a result. Both go to the chat
 * page: a blank new chat, or one with the question already asked.
 */
import type { Item } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { useCapture } from '~/companion/capture'
import { useAi } from '~/companion/ai/state'
import { useAiThread } from '~/companion/ai/thread'
import { newChatLink } from '~/companion/ai/routes'
import { startNewChat } from '~/companion/sidebar'
import { useQuietAi } from '~/companion/quiet-ai'
import { useFocus } from '~/companion/focus'
import { courseColor } from '~/companion/colors'
import { fetchFileUrl, knownFileUrl } from '~/companion/files'
import { itemHref, useNow } from '~/companion/today-layout'
import { makePage } from '~/companion/notes/make'
import { useNewNote } from '~/companion/notes/new'
import {
  defaultIndex,
  paletteSections,
  usePalette,
  type PaletteAction,
  type PaletteRow,
} from '~/companion/palette'

const { t: tr } = useI18n()
const palette = usePalette()
const c = useCompanion()
const capture = useCapture()
const ai = useAi()
const t = useAiThread()
const toast = useToast()
const route = useRoute()
const focus = useFocus()
const now = useNow()
const { quiet, toggle: toggleQuiet } = useQuietAi()
/** Notes' "+", run from here: the same kinds, made the same way, in My notes. */
const note = useNewNote()

const input = ref<HTMLInputElement | null>(null)
const list = ref<HTMLElement | null>(null)
const uid = useId()
const optionId = (index: number) => `${uid}-row-${index}`

/** The course on screen, offered by name ("New page in Databases"), never assumed. */
const subjectId = computed(() =>
  route.path.startsWith('/app/courses/') && route.params.id ? String(route.params.id) : null,
)

// Nothing is worked out while the palette is closed: the store changes all day.
const sections = computed(() =>
  !palette.open.value
    ? []
    : paletteSections(
        c,
        palette.query.value,
        { now: now.value, quiet: quiet.value, subjectId: subjectId.value, threads: t.threads.value },
        palette.recent.value,
      ),
)

/** The sections with each row's place in the keyboard order, so the template adds nothing up. */
const view = computed(() => {
  let index = 0
  return sections.value.map((s) => ({ ...s, rows: s.rows.map((row) => ({ row, index: index++ })) }))
})
const flat = computed(() => sections.value.flatMap((s) => s.rows))
const searching = computed(() => palette.query.value.trim().length > 0)
/** Typed, and nothing but Ask and "New page" answered. */
const nothing = computed(
  () => searching.value && sections.value.every((s) => s.group === 'ask' || s.group === 'create'),
)

const active = ref(0)
watch(
  () => [palette.query.value, palette.open.value] as const,
  () => {
    active.value = defaultIndex(sections.value, palette.query.value)
  },
)
watch(flat, (rows) => {
  if (active.value >= rows.length) active.value = Math.max(0, rows.length - 1)
})

watch(active, (i) => {
  void nextTick(() => document.getElementById(optionId(i))?.scrollIntoView({ block: 'nearest' }))
})

watch(
  () => palette.open.value,
  (open) => {
    if (!open) return
    // The chats are searched too; the sidebar has usually loaded them already.
    if (!t.threadsState.loaded && !t.threadsState.loading) void t.refreshThreads()
    void nextTick(() => {
      input.value?.focus()
      input.value?.select()
    })
  },
)

/* -- Keys ---------------------------------------------------------------- */

function move(by: number): void {
  const n = flat.value.length
  if (!n) return
  active.value = (active.value + by + n) % n
}

function onKeydown(event: KeyboardEvent): void {
  if (event.isComposing) return
  const ctrl = event.ctrlKey && !event.metaKey
  if (event.key === 'ArrowDown' || (ctrl && event.key === 'n')) {
    event.preventDefault()
    move(1)
  } else if (event.key === 'ArrowUp' || (ctrl && event.key === 'p')) {
    event.preventDefault()
    move(-1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const row = flat.value[active.value]
    if (event.metaKey || event.ctrlKey) void run(row ?? null, true)
    else if (row) void run(row)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    if (palette.query.value) palette.query.value = ''
    else palette.hide()
  } else if (event.key === 'Tab') {
    // The list is the only other thing here, and it is reached with arrows.
    event.preventDefault()
    move(event.shiftKey ? -1 : 1)
  }
}

/* -- Doing what a row says ---------------------------------------------------- */

async function run(row: PaletteRow | null, forceAsk = false): Promise<void> {
  const q = palette.query.value.trim()
  if (forceAsk) {
    if (!q || quiet.value) return
    palette.remember(q)
    palette.hide()
    await navigateTo(newChatLink({ q }))
    return
  }
  if (!row) return
  const action = row.action
  if (action.type === 'query') {
    palette.query.value = action.text
    input.value?.focus()
    return
  }
  if (q) palette.remember(q)
  palette.hide()
  // Synchronously into `perform`: a file picker opens only inside the press.
  await perform(action)
}

async function perform(action: PaletteAction): Promise<void> {
  switch (action.type) {
    case 'go':
      await navigateTo(action.to)
      return
    case 'ask':
      await navigateTo(newChatLink({ q: action.prompt }))
      return
    case 'new-chat':
      await startNewChat()
      return
    case 'page':
      await make(action)
      return
    case 'note':
      if (action.kind === 'page') await note.page(action.template ?? null)
      else if (action.kind === 'board') await note.board(action.template ?? null)
      else if (action.kind === 'upload' || action.kind === 'photo') await note.files(action.kind)
      else if (action.kind === 'link' && action.url) await note.link(action.url)
      else if (action.kind === 'record') note.record()
      // recording
      else if (action.kind === 'screen') note.screen()
      // imports
      else if (action.kind === 'notion') note.notion()
      else if (action.kind === 'draft') note.draft()
      return
    case 'capture':
      capture.show(action.mode, action.subjectId ?? null, action.sessionId ?? null)
      return
    case 'file': {
      const item = c.get('items', action.itemId)
      if (item) await openFile(item)
      return
    }
    case 'command':
      if (action.id === 'toggle-ai') ai.toggle()
      else if (action.id === 'settings') await navigateTo('/app/settings')
      else if (action.id === 'focus') {
        if (focus.state.value) focus.stop()
        else focus.start({ to: route.fullPath })
      }
      else if (action.id === 'quiet-ai') {
        toggleQuiet()
        toast.info(quiet.value ? tr('palette.quietOn') : tr('palette.quietOff'))
      }
      return
    case 'query':
      return
  }
}

/**
 * A page this row names (`notes/make.ts`), opened straight away: one with
 * the typed title, in My notes, or one the row filed by name (the class on
 * now, "New page in Databases"). The course on screen only feeds the note's
 * "Add to …?" chip; nothing is filed by guessing.
 */
async function make(action: Extract<PaletteAction, { type: 'page' }>): Promise<void> {
  try {
    const id = await makePage({
      subjectId: action.subjectId,
      sessionId: action.sessionId,
      template: action.template,
      title: action.title ?? null,
      onScreen: subjectId.value,
    })
    await navigateTo(itemHref({ id }))
  } catch {
    toast.error({ title: tr('palette.pageFailed'), body: tr('palette.checkConnection') })
  }
}

/** A file opens where its bytes are: a signed link, Moodle's own, or a note that it can't yet. */
async function openFile(item: Item): Promise<void> {
  const known = item.kind === 'link' ? (item.meta.url ?? null) : knownFileUrl(item)
  if (known) {
    window.open(known, '_blank', 'noopener')
    return
  }
  const tab = window.open('', '_blank')
  const url = await fetchFileUrl(item)
  if (url && tab) tab.location.href = url
  else {
    tab?.close()
    toast.error({ title: item.title, body: tr('palette.fileOffline') })
  }
}

/* -- Drawing ------------------------------------------------------------------ */

/** The title cut where the query matched, so the matched letters can be bold. */
function pieces(row: PaletteRow): { text: string; hit: boolean }[] {
  if (!row.marks?.length) return [{ text: row.title, hit: false }]
  const out: { text: string; hit: boolean }[] = []
  let at = 0
  for (const [a, b] of row.marks) {
    if (a > at) out.push({ text: row.title.slice(at, a), hit: false })
    out.push({ text: row.title.slice(a, b), hit: true })
    at = b
  }
  if (at < row.title.length) out.push({ text: row.title.slice(at), hit: false })
  return out
}

/** Mac shows ⌘; everything else Ctrl. */
const mod = ref('Ctrl')
onMounted(() => {
  if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) mod.value = '⌘'
})
function kbd(text: string): string {
  return text.replace('⌘', mod.value === '⌘' ? '⌘' : 'Ctrl ')
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="duration-150 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="palette.open.value"
        class="fixed inset-0 z-[100] flex items-start justify-center sm:px-6 sm:pt-[11vh]"
        role="presentation"
      >
        <div
          class="absolute inset-0 bg-[rgb(30_24_14/0.26)] backdrop-blur-[3px] max-sm:hidden"
          @click="palette.hide()"
        />

        <div
          class="pop-in relative flex h-full w-full flex-col overflow-hidden bg-surface sm:h-auto sm:max-h-[min(640px,78vh)] sm:max-w-[640px] sm:rounded-[18px] sm:shadow-[0_0_0_1px_var(--border-strong),0_40px_90px_-20px_rgb(30_20_5/0.5)]"
          role="dialog"
          aria-modal="true"
          :aria-label="tr('palette.dialog')"
        >
          <!-- The field -->
          <div class="cp-safe-top shrink-0 border-b border-border">
            <div class="flex h-14 items-center gap-3 px-4">
              <UiIcon
                name="search"
                :size="18"
                :stroke="1.9"
                class="shrink-0 text-text-faint"
              />
              <input
                ref="input"
                v-model="palette.query.value"
                type="text"
                class="h-full min-w-0 flex-1 bg-transparent text-[16px] text-text outline-none placeholder:text-text-faint"
                :placeholder="quiet ? tr('palette.phQuiet') : tr('palette.ph')"
                autocomplete="off"
                autocorrect="off"
                spellcheck="false"
                enterkeyhint="go"
                role="combobox"
                aria-expanded="true"
                aria-autocomplete="list"
                :aria-controls="`${uid}-list`"
                :aria-activedescendant="flat.length ? optionId(active) : undefined"
                :aria-label="tr('palette.inputAria')"
                @keydown="onKeydown"
              >
              <button
                v-if="palette.query.value"
                type="button"
                class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-text-faint transition-colors hover:bg-surface-sunken hover:text-text-soft focus-visible:ring-2 focus-visible:ring-brand-line"
                :aria-label="tr('palette.clear')"
                @click="palette.query.value = ''; input?.focus()"
              >
                <UiIcon
                  name="x"
                  :size="15"
                  :stroke="2"
                />
              </button>
              <kbd class="hidden shrink-0 rounded-[6px] border border-border-field px-1.5 py-0.5 text-[11px] text-text-faint sm:block">esc</kbd>
              <button
                type="button"
                class="-mr-1 inline-flex h-11 shrink-0 cursor-pointer items-center px-2 text-[15px] font-semibold text-brand sm:hidden"
                @click="palette.hide()"
              >
                {{ tr('common.cancel') }}
              </button>
            </div>
          </div>

          <!-- The list -->
          <div
            :id="`${uid}-list`"
            ref="list"
            role="listbox"
            :aria-label="tr('palette.results')"
            class="om-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2"
            @mousedown.prevent
          >
            <p
              v-if="nothing"
              class="px-5 pt-4 text-[13.5px] text-text-muted"
            >
              {{ tr('palette.nothing', { q: palette.query.value.trim() }) }}
              <template v-if="!quiet">
                {{ tr('palette.nothingAsk') }}
              </template>
            </p>

            <div
              v-for="section in view"
              :key="section.group"
              role="group"
              :aria-label="section.label"
            >
              <p
                v-if="section.group !== 'ask'"
                class="sticky top-0 z-[1] bg-surface px-5 pt-3 pb-1 text-[12px] font-semibold text-text-faint"
              >
                {{ section.label }}
              </p>
              <div
                v-for="{ row, index } in section.rows"
                :id="optionId(index)"
                :key="row.key"
                role="option"
                :aria-selected="index === active"
                :class="[
                  'mx-2 flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[10px] px-2.5 py-1.5 transition-colors duration-100',
                  section.group === 'ask' && 'mt-2',
                  index === active ? 'bg-[rgb(var(--wash-rgb)/0.065)]' : '',
                ]"
                @mousemove="active = index"
                @click="run(row)"
              >
                <!-- The AI's mark on the Ask row: the ink disc, the highlighter spark. -->
                <span
                  v-if="row.group === 'ask'"
                  class="grid size-9 shrink-0 place-items-center rounded-full bg-chip"
                  aria-hidden="true"
                >
                  <span class="grid size-6 place-items-center rounded-full bg-accent text-on-accent">
                    <UiIcon
                      name="spark"
                      :size="13"
                    />
                  </span>
                </span>
                <!-- A course is shown by its cover, as everywhere else. -->
                <CompanionCourseCover
                  v-else-if="row.group === 'courses'"
                  :subject="row.key.slice('course:'.length)"
                  size="sm"
                  :px="36"
                />
                <span
                  v-else
                  :class="[
                    'grid size-9 shrink-0 place-items-center rounded-[10px] transition-colors duration-100',
                    index === active ? 'bg-surface text-text shadow-[inset_0_0_0_1px_var(--border)]' : 'bg-surface-sunken text-text-soft',
                  ]"
                  aria-hidden="true"
                >
                  <CompanionIcon
                    :name="row.icon"
                    :size="17"
                    :stroke="1.8"
                  />
                </span>

                <span class="grid min-w-0 flex-1 gap-0.5">
                  <span class="truncate text-[14.5px] text-text">
                    <template
                      v-for="(p, i) in pieces(row)"
                      :key="i"
                    ><b
                      v-if="p.hit"
                      class="font-semibold text-text"
                    >{{ p.text }}</b><span
                      v-else
                      :class="searching && row.marks?.length ? 'text-text-body' : 'font-medium'"
                    >{{ p.text }}</span></template>
                  </span>
                  <span
                    v-if="row.meta"
                    class="flex min-w-0 items-center gap-1.5 text-[12.5px] text-text-faint"
                  >
                    <span
                      v-if="row.color"
                      class="size-2 shrink-0 rounded-full"
                      :style="{ background: courseColor(row.color) }"
                    />
                    <span class="truncate">{{ row.meta }}</span>
                  </span>
                </span>

                <span
                  v-if="index === active"
                  class="hidden shrink-0 items-center gap-1.5 text-[12.5px] font-medium text-text-soft sm:inline-flex"
                >
                  {{ row.verb }}
                  <kbd class="rounded-[6px] bg-surface px-1.5 py-0.5 text-[11px] text-text-muted shadow-[inset_0_0_0_1px_var(--border-field)]">↵</kbd>
                </span>
                <kbd
                  v-else-if="row.kbd"
                  class="hidden shrink-0 rounded-[6px] border border-border-field px-1.5 py-0.5 text-[11px] text-text-faint sm:block"
                >{{ kbd(row.kbd) }}</kbd>
              </div>
            </div>
          </div>

          <!-- What the keys do, where there is a keyboard. -->
          <div class="hidden shrink-0 items-center gap-4 border-t border-border-rule bg-surface-chrome px-5 py-2.5 text-[12px] text-text-faint sm:flex">
            <span class="inline-flex items-center gap-1.5">
              <kbd class="rounded-[5px] border border-border-field px-1 text-[11px]">↑</kbd><kbd class="rounded-[5px] border border-border-field px-1 text-[11px]">↓</kbd>
              {{ tr('palette.toMove') }}
            </span>
            <span class="inline-flex items-center gap-1.5">
              <kbd class="rounded-[5px] border border-border-field px-1 text-[11px]">↵</kbd>
              {{ tr('palette.toOpen') }}
            </span>
            <span
              v-if="!quiet"
              class="inline-flex items-center gap-1.5"
            >
              <kbd class="rounded-[5px] border border-border-field px-1 text-[11px]">{{ mod === '⌘' ? '⌘↵' : 'Ctrl ↵' }}</kbd>
              {{ tr('palette.toAsk') }}
            </span>
            <span
              v-if="palette.recent.value.length && !searching"
              class="ml-auto"
            >
              <button
                type="button"
                class="cursor-pointer rounded-[6px] px-1 text-text-faint transition-colors hover:text-text-soft focus-visible:ring-2 focus-visible:ring-brand-line"
                @click="palette.forget()"
              >
                {{ tr('palette.clearRecent') }}
              </button>
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
