<script setup lang="ts">
/**
 * The sidebar's chats: ChatGPT's list, in the order a person looks for one
 * ("the thing I asked yesterday"), grouped Today, This week, Earlier. The
 * heading folds the list away and its ⋯ sorts it (newest, oldest, A to Z);
 * both are remembered per device.
 *
 * A row is a chat's title and nothing else until something is worth
 * saying: a pulsing dot while it is answering (you can leave and watch it
 * finish from anywhere), a small course glyph on a chat that drafted a
 * course (the one place to find "that course plan from Tuesday"). The open
 * chat is lit the way a place is.
 *
 * Hover (or focus, or always on a touch screen) shows ⋯ at the row's end,
 * with Rename and Delete. Rename edits the title in place: Enter keeps it,
 * Esc puts it back. Delete asks nothing and offers Undo instead (the
 * thread's `removeThread`), because a dialog for a chat is a toll on every
 * tidy-up while a wrong click is rare and Undo fixes it. Deleting the chat
 * that is open on the chat page leaves for a new one.
 *
 * The menu is drawn at the body with fixed coordinates, so the sidebar's
 * scroller can't clip it, and it is a real menu for the keyboard: ↑↓ move,
 * Enter picks, Esc closes and gives the focus back to ⋯.
 */
import type { MenuAction } from '~/components/ui/Menu.vue'
import type { AiThread } from '~/companion/ai/types'
import { CHAT_PATH, chatPath, onChatPage } from '~/companion/ai/routes'
import { groupThreads, useAiThread, type ThreadGroup } from '~/companion/ai/thread'

const props = withDefaults(defineProps<{ touch?: boolean }>(), { touch: false })

const t = useAiThread()
const route = useRoute()

onMounted(() => {
  if (!t.threadsState.loaded && !t.threadsState.loading) void t.refreshThreads()
})

type ChatSort = 'recent' | 'oldest' | 'name'
const SORT_KEY = 'bm:chats-sort'
const FOLDED_KEY = 'bm:chats-folded'

// Shared: the desktop sidebar and the phone's drawer are two instances of this.
const sort = useState<ChatSort>('chats:sort', () => 'recent')
const folded = useState('chats:folded', () => false)

// After mount, so the server's list and the first client render agree.
onMounted(() => {
  try {
    const stored = localStorage.getItem(SORT_KEY)
    if (stored === 'recent' || stored === 'oldest' || stored === 'name') sort.value = stored
    folded.value = localStorage.getItem(FOLDED_KEY) === '1'
  } catch {
    // Private mode: the defaults stand.
  }
})

function remember(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private mode: it lasts as long as the page does.
  }
}

function toggleFolded(): void {
  folded.value = !folded.value
  remember(FOLDED_KEY, folded.value ? '1' : '0')
}

const SORTS: { value: ChatSort; label: string }[] = [
  { value: 'recent', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name, A to Z' },
]

const sortActions = computed<MenuAction[]>(() =>
  SORTS.map((option) => ({
    // In the label, not `icon`: an icon on one row only would knock the others out of line.
    label: sort.value === option.value ? `${option.label} ✓` : option.label,
    run: () => {
      sort.value = option.value
      remember(SORT_KEY, option.value)
    },
  })),
)

function at(thread: AiThread): number {
  return Date.parse(thread.updated_at)
}

const groups = computed<ThreadGroup[]>(() => {
  const list = t.threads.value
  if (sort.value === 'name') {
    // A to Z has no use for dates: one list, no headings.
    const threads = [...list].sort((a, b) => titleOf(a).localeCompare(titleOf(b)))
    return threads.length ? [{ label: '', threads }] : []
  }
  if (sort.value === 'oldest') {
    return groupThreads([...list].sort((a, b) => at(a) - at(b))).reverse()
  }
  return groupThreads([...list].sort((a, b) => at(b) - at(a)))
})

/** The chat open on the chat page, by its address. */
const openId = computed(() =>
  onChatPage(route.path) ? (/^\/app\/chat\/([^/?#]+)/.exec(route.path)?.[1] ?? null) : null,
)

/** Every chat with an answer on its way, the ones left behind by New chat included. */
function answering(thread: AiThread): boolean {
  return t.answering.value.includes(thread.id)
}

function titleOf(thread: AiThread): string {
  return thread.title?.trim() || 'New chat'
}

/* -- The ⋯ menu ----------------------------------------------------------------- */

const menuFor = ref<AiThread | null>(null)
const menuAt = ref({ top: 0, left: 0 })
const menuEl = ref<HTMLElement | null>(null)
let trigger: HTMLElement | null = null

function openMenu(thread: AiThread, event: MouseEvent): void {
  if (menuFor.value?.id === thread.id) {
    closeMenu()
    return
  }
  trigger = event.currentTarget as HTMLElement
  const r = trigger.getBoundingClientRect()
  // Under the button, its left edge on the button's left, kept on screen.
  const width = 188
  menuAt.value = {
    top: Math.min(r.bottom + 6, window.innerHeight - 112),
    left: Math.max(8, Math.min(r.left - 8, window.innerWidth - width - 8)),
  }
  menuFor.value = thread
  // Opened from the keyboard or the pointer alike, the first item takes the focus.
  void nextTick(() => menuEl.value?.querySelector<HTMLElement>('[role="menuitem"]')?.focus())
}

function closeMenu(refocus = false): void {
  menuFor.value = null
  if (refocus) trigger?.focus()
  trigger = null
}

function onMenuKey(event: KeyboardEvent): void {
  const items = [...(menuEl.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
  const at = items.indexOf(document.activeElement as HTMLElement)
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const step = event.key === 'ArrowDown' ? 1 : -1
    items[(at + step + items.length) % items.length]?.focus()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    closeMenu(true)
  } else if (event.key === 'Tab') {
    closeMenu()
  }
}

function onPointerDown(event: PointerEvent): void {
  const target = event.target as Node
  if (menuFor.value && !menuEl.value?.contains(target) && !trigger?.contains(target)) closeMenu()
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown, true))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown, true))
// The list scrolls or the page changes under an open menu: it has lost its row.
watch(() => route.fullPath, () => closeMenu())

/* -- Rename, in place ------------------------------------------------------------ */

const renaming = ref<string | null>(null)
const draft = ref('')
const field = ref<HTMLInputElement[] | HTMLInputElement | null>(null)

function startRename(thread: AiThread): void {
  closeMenu()
  renaming.value = thread.id
  draft.value = titleOf(thread)
  void nextTick(() => {
    const el = Array.isArray(field.value) ? field.value[0] : field.value
    el?.focus()
    el?.select()
  })
}

async function commitRename(thread: AiThread): Promise<void> {
  if (renaming.value !== thread.id) return
  renaming.value = null
  const title = draft.value.replace(/\s+/g, ' ').trim()
  if (!title || title === titleOf(thread)) return
  await t.renameThread(thread.id, title)
}

function onRenameKey(event: KeyboardEvent, thread: AiThread): void {
  if (event.key === 'Enter') {
    event.preventDefault()
    void commitRename(thread)
  } else if (event.key === 'Escape') {
    // The field closes; a drawer or floating sidebar around it stays.
    event.preventDefault()
    event.stopPropagation()
    renaming.value = null
  }
}

function remove(thread: AiThread): void {
  closeMenu()
  const open = openId.value === thread.id
  t.removeThread(thread.id)
  if (open) void navigateTo(CHAT_PATH)
}

const ROW =
  'relative flex w-full items-center gap-2 rounded-[10px] pl-2.5 text-left text-[13.5px] transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none'
</script>

<template>
  <div class="mx-[11px] mb-1.5 flex items-center border-t border-border-rule pt-2 pl-1">
    <button
      type="button"
      class="inline-flex h-7 cursor-pointer items-center gap-1 rounded-[8px] pr-2 pl-1.5 text-[12px] font-semibold text-text-faint transition-colors hover:text-text-soft focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      :aria-expanded="!folded"
      @click="toggleFolded"
    >
      <UiIcon
        name="chevron-down"
        :size="12"
        :stroke="2.4"
        :class="['transition-transform duration-150', folded && '-rotate-90']"
      />
      Chats
    </button>
    <span class="flex-1" />
    <UiMenu
      v-if="t.threads.value.length && !folded"
      :actions="sortActions"
      label="Sort chats"
      title="Sort chats"
      float
    />
  </div>

  <!-- `minmax(0, 1fr)`: a plain grid track grows to its longest title, and then
       nothing is ever too long to truncate. -->
  <div
    v-show="!folded"
    class="om-scroll grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] content-start gap-3 overflow-y-auto overscroll-contain px-[11px] pb-3"
  >
    <!-- Loading: the shape of a list, no spinner. -->
    <div
      v-if="t.threadsState.loading && !t.threadsState.loaded"
      class="grid gap-2.5 px-2.5 pt-1"
      aria-busy="true"
      aria-label="Loading your chats"
    >
      <span
        v-for="i in 4"
        :key="i"
        class="cp-skel h-3.5"
        :style="{ width: `${92 - i * 11}%` }"
      />
    </div>

    <p
      v-else-if="t.threadsState.error && !t.threads.value.length"
      class="px-2.5 text-[12.5px] leading-[1.5] text-text-muted"
    >
      Your chats didn't load.
      <button
        type="button"
        class="cursor-pointer rounded font-semibold text-cobalt underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        @click="t.refreshThreads()"
      >
        Try again
      </button>
    </p>

    <p
      v-else-if="!groups.length"
      class="px-2.5 text-[12.5px] leading-[1.5] text-text-faint"
    >
      Every chat is kept here: questions, quizzes, the course plans you drafted.
    </p>

    <template v-else>
      <section
        v-for="group in groups"
        :key="group.label"
        :aria-label="group.label"
      >
        <h3
          v-if="group.label"
          class="px-2.5 pb-1 text-[11.5px] font-medium text-text-faint"
        >
          {{ group.label }}
        </h3>
        <ul class="grid grid-cols-[minmax(0,1fr)] gap-px">
          <li
            v-for="thread in group.threads"
            :key="thread.id"
            class="group/chat relative"
          >
            <input
              v-if="renaming === thread.id"
              ref="field"
              v-model="draft"
              type="text"
              maxlength="120"
              :class="[
                'w-full rounded-[10px] bg-surface px-2.5 text-[13.5px] text-text shadow-[inset_0_0_0_1.5px_var(--brand-line)] outline-none',
                props.touch ? 'h-11' : 'h-[34px]',
              ]"
              aria-label="Chat name"
              @keydown="onRenameKey($event, thread)"
              @blur="commitRename(thread)"
            >
            <template v-else>
              <NuxtLink
                :to="chatPath(thread.id)"
                :title="titleOf(thread)"
                :aria-current="openId === thread.id ? 'page' : undefined"
                :class="[
                  ROW,
                  props.touch ? 'min-h-11 pr-[72px]' : 'h-[34px] pr-9',
                  openId === thread.id
                    ? 'bg-accent-soft font-semibold text-text'
                    : 'font-medium text-text-dim hover:bg-surface-sunken hover:text-text',
                ]"
              >
                <span class="min-w-0 flex-1 truncate">{{ titleOf(thread) }}</span>
              </NuxtLink>

              <!-- What the row has to say, where ⋯ goes on hover. -->
              <span
                :class="[
                  'pointer-events-none absolute top-1/2 grid size-4 -translate-y-1/2 place-items-center transition-opacity duration-150',
                  props.touch ? 'right-12' : 'right-2.5 group-hover/chat:opacity-0 group-focus-within/chat:opacity-0',
                  menuFor?.id === thread.id && !props.touch && 'opacity-0',
                ]"
              >
                <span
                  v-if="answering(thread)"
                  class="sb-pulse size-2 rounded-full bg-brand"
                  role="status"
                  aria-label="Answering"
                />
                <CompanionIcon
                  v-else-if="thread.has_proposal"
                  name="workspace"
                  :size="13"
                  :stroke="1.9"
                  class="text-text-faint"
                />
              </span>

              <button
                type="button"
                :class="[
                  'absolute top-1/2 right-1 grid -translate-y-1/2 cursor-pointer place-items-center rounded-[8px] text-text-faint transition-[opacity,background-color,color] duration-150 hover:bg-surface-track hover:text-text focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
                  props.touch ? 'size-10' : 'size-7',
                  props.touch || menuFor?.id === thread.id
                    ? 'opacity-100'
                    : 'opacity-0 group-hover/chat:opacity-100 group-focus-within/chat:opacity-100',
                  menuFor?.id === thread.id && 'bg-surface-track text-text',
                ]"
                :aria-label="`More for “${titleOf(thread)}”`"
                title="Rename or delete"
                aria-haspopup="menu"
                :aria-expanded="menuFor?.id === thread.id"
                @click.stop.prevent="openMenu(thread, $event)"
              >
                <UiIcon
                  name="dots"
                  :size="16"
                />
              </button>
            </template>
          </li>
        </ul>
      </section>
    </template>

    <Teleport to="body">
      <Transition
        enter-active-class="transition-[opacity,transform] duration-120 ease-out"
        enter-from-class="opacity-0 scale-95"
        leave-active-class="transition-opacity duration-100 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-if="menuFor"
          ref="menuEl"
          role="menu"
          :aria-label="`${titleOf(menuFor)}`"
          class="fixed z-[97] w-[188px] origin-top-left rounded-[14px] bg-surface p-1.5 shadow-pop ring-1 ring-border"
          :style="{ top: `${menuAt.top}px`, left: `${menuAt.left}px` }"
          @keydown="onMenuKey"
        >
          <button
            type="button"
            role="menuitem"
            class="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 text-left text-[13.5px] font-medium text-text-dim transition-colors hover:bg-surface-sunken hover:text-text focus-visible:bg-surface-sunken focus-visible:text-text focus-visible:outline-none max-lg:h-11"
            @click="startRename(menuFor)"
          >
            <UiIcon
              name="pencil"
              :size="15"
              class="shrink-0 text-text-faint"
            />
            Rename
          </button>
          <div class="my-1 border-t border-border-rule" />
          <button
            type="button"
            role="menuitem"
            class="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 text-left text-[13.5px] font-medium text-danger transition-colors hover:bg-danger-soft focus-visible:bg-danger-soft focus-visible:outline-none max-lg:h-11"
            @click="remove(menuFor)"
          >
            <UiIcon
              name="trash"
              :size="15"
              class="shrink-0"
            />
            Delete
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* The answering dot breathes, slowly, the way a "typing" mark does. */
.sb-pulse {
  animation: sb-pulse 1.4s ease-in-out infinite;
}

@keyframes sb-pulse {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sb-pulse {
    animation: none;
  }
}
</style>
