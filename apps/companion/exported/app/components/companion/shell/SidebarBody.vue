<script setup lang="ts">
/**
 * What the app sidebar holds, top to bottom, the way ChatGPT's and Linear's
 * do: the mark, two actions, the places, the chats, and you.
 *
 *   [◉ BiliMind]                 [⇤]
 *   [✎ New chat]            ⌥Space      lime: the one loud thing
 *   [⌕ Search]                  ⌘K      the companion palette
 *   ⌂ Today                       2     what waits for your OK
 *   ▦ Courses
 *   ▤ Notes                     [+]     a dropdown of note types
 *   ▢ Calendar
 *   Chats                               Today / This week / Earlier
 *   (K) Kamila                 (bell)
 *
 * New chat and Search go nowhere on their own, so they never light as the
 * current page. The four places do, with a lime-soft tile. "New" is a new
 * chat everywhere now: what to make, ask or plan is said in the chat, and a
 * note is made from Notes' "+".
 *
 * Drawn at the sidebar's full width (`--sidebar-w`, set by `CompanionShellSidebar`)
 * whatever the column around it is doing. The column
 * clips it, so collapsing to the 60px rail is a clip and a fade, never a
 * reflow: every icon sits on the rail's centre line (30px) in both states,
 * the rows shrink to their 38px tiles in step with the column, and the
 * names fade. The rail keeps the icons; the chats and the names wait.
 *
 * `mode` says where it is drawn: `column` in the row, `float` over a
 * workspace, `drawer` on a phone (44px rows, a close button instead of ⇤).
 */
import { useCompanion } from '~/companion/store'
import { usePalette } from '~/companion/palette'
import { onChatPage } from '~/companion/ai/routes'
import { startNewChat } from '~/companion/sidebar'

const props = withDefaults(
  defineProps<{
    /** Names showing. False is the 60px rail. */
    wide?: boolean
    mode?: 'column' | 'float' | 'drawer'
  }>(),
  { wide: true, mode: 'column' },
)

const emit = defineEmits<{ toggle: []; close: [] }>()

const c = useCompanion()
const route = useRoute()
const palette = usePalette()

const touch = computed(() => props.mode === 'drawer')
const demo = computed(() => c.status.mode === 'demo')

interface Place {
  to: string
  label: string
  icon: string
  /** The `g` shortcut, named in the tooltip. */
  keys: string
  /** Waiting for a yes: the number beside the name, a dot on the rail's icon. */
  count?: number
  active: (path: string) => boolean
}

const places = computed<Place[]>(() => [
  {
    to: '/app',
    label: 'Today',
    icon: 'home',
    keys: 'g t',
    count: c.pendingSignals.value.length,
    // A deadline, the Inbox and practice are all reached from Today.
    active: (p) => p === '/app' || p === '/app/' || /^\/app\/(inbox|d\/|practice)/.test(p),
  },
  {
    to: '/app/courses',
    label: 'Courses',
    icon: 'workspace',
    keys: 'g c',
    active: (p) => p.startsWith('/app/courses') && !p.startsWith('/app/courses/notebook'),
  },
  {
    to: '/app/notes',
    label: 'Notes',
    icon: 'notebook',
    keys: 'g n',
    active: (p) =>
      p.startsWith('/app/notes') ||
      p.startsWith('/app/p/') ||
      p.startsWith('/app/b/') ||
      p.startsWith('/app/courses/notebook'),
  },
  {
    to: '/app/calendar',
    label: 'Calendar',
    icon: 'calendar',
    keys: 'g k',
    active: (p) => p.startsWith('/app/calendar'),
  },
])

/** Mac shows ⌥ and ⌘; everything else names the keys. */
const mac = ref(false)
onMounted(() => {
  mac.value = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
})
const newKey = computed(() => (mac.value ? '⌥Space' : 'Alt Space'))
const searchKey = computed(() => (mac.value ? '⌘K' : 'Ctrl K'))

function newChat(): void {
  emit('close')
  void startNewChat()
}

function search(): void {
  emit('close')
  palette.show()
}

function you(): void {
  emit('close')
  void navigateTo('/app/settings')
}

const auth = useAuth()
const name = computed(() => (demo.value ? c.userName.value : auth.user.value?.name?.trim() || c.userName.value))
const initials = computed(() => {
  const words = name.value.split(/\s+/).filter(Boolean)
  const two = words.length >= 2 ? `${words[0]![0]}${words[1]![0]}` : (words[0] ?? '').slice(0, 2)
  return two.toUpperCase() || 'Me'
})

/* -- Keeping the focus across ⇤ ---------------------------------------------- */

const expandBtn = ref<HTMLButtonElement | null>(null)
const collapseBtn = ref<HTMLButtonElement | null>(null)

/** The toggle that was pressed is about to change; its twin takes the focus. */
function toggle(): void {
  const hadFocus = document.activeElement === expandBtn.value || document.activeElement === collapseBtn.value
  emit('toggle')
  if (hadFocus) void nextTick(() => (props.wide ? collapseBtn.value : expandBtn.value)?.focus())
}

/* -- Classes ---------------------------------------------------------------- */

// Rows fill the sidebar less its 11px margins with names and are 38px tiles on
// the rail, both from the same left edge, so the icon never moves while the width animates.
const ROW =
  'relative flex shrink-0 items-center overflow-hidden rounded-[12px] transition-[width,background-color,color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none'
const SIZE = computed(() => [
  props.wide ? (touch.value ? 'w-full' : 'w-[calc(var(--sidebar-w)-22px)]') : 'w-[38px]',
  touch.value ? 'h-11' : 'h-[38px]',
])
const ICON = 'grid h-full w-[38px] shrink-0 place-items-center'
const LABEL = computed(() => [
  'flex min-w-0 flex-1 items-center justify-between gap-2 pr-2.5 whitespace-nowrap transition-opacity duration-150',
  props.wide ? 'opacity-100' : 'pointer-events-none opacity-0',
])
const IDLE = 'text-text-soft hover:bg-surface-sunken hover:text-text'
const LIT = 'bg-accent-soft text-accent-strong'
</script>

<template>
  <div :class="['flex h-full flex-col', touch ? 'w-full' : 'w-[var(--sidebar-w)]']">
    <!-- The head: the mark, and ⇤. On the rail the mark is the way back out:
         hovered, it turns into the sidebar glyph (ChatGPT's rail). -->
    <div class="flex h-[54px] shrink-0 items-center px-[11px] pt-1">
      <button
        v-if="!wide"
        ref="expandBtn"
        type="button"
        class="group/mark relative grid size-[38px] shrink-0 cursor-pointer place-items-center rounded-[12px] text-text-soft transition-colors duration-150 hover:bg-surface-sunken hover:text-text focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        title="Expand sidebar ( [ )"
        aria-label="Expand sidebar"
        aria-expanded="false"
        @click="toggle"
      >
        <UiBrandMark class="size-[30px] transition-opacity duration-150 group-hover/mark:opacity-0 group-focus-visible/mark:opacity-0" />
        <UiIcon
          name="panel-left"
          :size="18"
          :stroke="1.9"
          class="absolute opacity-0 transition-opacity duration-150 group-hover/mark:opacity-100 group-focus-visible/mark:opacity-100"
        />
      </button>
      <template v-else>
        <NuxtLink
          to="/app"
          :class="[
            'flex min-w-0 items-center gap-2.5 rounded-[12px] pr-2 pl-1 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
            touch ? 'h-11' : 'h-[38px]',
          ]"
          aria-label="BiliMind, Today"
          @click="emit('close')"
        >
          <UiBrandMark class="size-[30px] shrink-0" />
          <span class="truncate font-display text-[17px] font-semibold tracking-[-0.02em] text-text">BiliMind</span>
        </NuxtLink>
        <span class="flex-1" />
        <button
          ref="collapseBtn"
          type="button"
          :class="[
            'grid shrink-0 cursor-pointer place-items-center rounded-[10px] text-text-faint transition-colors duration-150 hover:bg-surface-sunken hover:text-text focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
            touch ? 'size-11' : 'size-[34px]',
          ]"
          :title="touch ? 'Close' : 'Collapse sidebar ( [ )'"
          :aria-label="touch ? 'Close menu' : 'Collapse sidebar'"
          :aria-expanded="touch ? undefined : true"
          @click="touch ? emit('close') : toggle()"
        >
          <UiIcon
            :name="touch ? 'x' : 'panel-left'"
            :size="touch ? 20 : 18"
            :stroke="1.9"
          />
        </button>
      </template>
    </div>

    <!-- The two actions. -->
    <div class="flex shrink-0 flex-col gap-1 px-[11px] pt-1.5">
      <button
        type="button"
        :class="[
          ROW,
          SIZE,
          'cursor-pointer bg-accent font-semibold text-on-accent hover:bg-lime-2 active:scale-[0.98]',
        ]"
        :title="`New chat (${newKey})`"
        :aria-label="wide ? undefined : 'New chat'"
        @click="newChat"
      >
        <span :class="ICON">
          <!-- Compose: a page and a pen, the mark every chat app uses for "new". -->
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="2.1"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          ><path d="M11 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V13" /><path d="M17.6 3.9a1.9 1.9 0 0 1 2.7 2.7L12.6 14.3l-3.6.9.9-3.6Z" /></svg>
        </span>
        <span :class="[LABEL, 'text-[13.5px]']">
          New chat
          <kbd class="num rounded border border-current/25 px-1 py-px text-[10.5px] font-normal opacity-70">{{ newKey }}</kbd>
        </span>
      </button>

      <button
        type="button"
        :class="[ROW, SIZE, 'cursor-pointer', palette.open.value ? LIT : IDLE]"
        :title="`Search, or ask (${searchKey})`"
        :aria-label="wide ? undefined : 'Search, or ask'"
        aria-haspopup="dialog"
        :aria-expanded="palette.open.value"
        @click="search"
      >
        <span :class="ICON">
          <UiIcon
            name="search"
            :size="18"
            :stroke="1.9"
          />
        </span>
        <span :class="[LABEL, 'text-[13.5px] font-medium']">
          Search
          <kbd class="num rounded border border-border-field px-1 py-px text-[10.5px] font-normal text-text-faint">{{ searchKey }}</kbd>
        </span>
      </button>
    </div>

    <!-- The places. -->
    <nav
      class="flex shrink-0 flex-col gap-[3px] px-[11px] pt-3"
      aria-label="Places"
    >
      <div
        v-for="place in places"
        :key="place.to"
        class="group/place relative"
      >
        <NuxtLink
          :to="place.to"
          :title="`${place.label} (${place.keys})`"
          :aria-label="wide ? undefined : place.count ? `${place.label}, ${place.count} waiting for your OK` : place.label"
          :aria-current="place.active(route.path) ? 'page' : undefined"
          :class="[ROW, SIZE, place.active(route.path) ? LIT : IDLE]"
          @click="emit('close')"
        >
          <span :class="ICON">
            <CompanionIcon
              :name="place.icon"
              :size="18"
              :stroke="1.9"
            />
          </span>
          <span
            :class="[
              LABEL,
              'text-[13.5px]',
              place.active(route.path) ? 'font-semibold' : 'font-medium',
            ]"
          >
            {{ place.label }}
            <span
              v-if="place.count"
              class="num text-[11.5px] font-semibold text-brand"
              :title="`${place.count} waiting for your OK`"
            >{{ place.count }}</span>
          </span>
          <!-- The rail has no room for a number: the bell's dot instead. -->
          <span
            v-if="place.count"
            :class="[
              'absolute top-2 left-[27px] size-2 rounded-full bg-brand ring-2 ring-surface-rail transition-opacity duration-150',
              wide ? 'opacity-0' : 'opacity-100',
            ]"
            aria-hidden="true"
          />
        </NuxtLink>

        <!-- Notes' "+": every kind of note, filed in My notes. -->
        <Transition
          enter-active-class="transition-opacity duration-150 delay-75"
          enter-from-class="opacity-0"
          leave-active-class="transition-opacity duration-75"
          leave-to-class="opacity-0"
        >
          <div
            v-if="place.to === '/app/notes' && wide"
            :class="[
              'absolute top-1/2 grid -translate-y-1/2 place-items-center',
              touch ? 'right-1' : 'right-1.5',
            ]"
          >
            <CompanionNotesNewButton
              size="sm"
              align="start"
              @made="emit('close')"
            />
          </div>
        </Transition>
      </div>
    </nav>

    <!-- The chats: ChatGPT's list. The rail has no room for titles, so it
         keeps the space empty rather than drawing icons nobody can tell apart. -->
    <div
      :class="[
        'mt-4 flex min-h-0 flex-1 flex-col transition-opacity duration-150',
        wide ? 'opacity-100' : 'pointer-events-none opacity-0',
      ]"
      :inert="!wide"
    >
      <CompanionShellSidebarChats :touch="touch" />
    </div>

    <CompanionShellSidebarUsage
      :wide="wide"
      @open="emit('close')"
    />

    <!-- You: settings, and the old product's bell. -->
    <div
      :class="[
        'flex shrink-0 gap-1 border-t border-border-rule px-[11px] py-2.5',
        wide ? 'flex-row items-center' : 'flex-col items-start',
        touch && 'pb-[max(10px,env(safe-area-inset-bottom))]',
      ]"
    >
      <ShellActivity
        v-if="!demo && !wide"
        class="shrink-0"
      />
      <button
        type="button"
        :class="[
          ROW,
          // Beside the bell when there is one; the rail's 38px tile otherwise.
          !wide ? 'w-[38px]' : touch ? 'min-w-0 flex-1' : demo ? 'w-[calc(var(--sidebar-w)-22px)]' : 'w-[calc(var(--sidebar-w)-64px)]',
          touch ? 'h-11' : 'h-[38px]',
          'cursor-pointer',
          route.path === '/app/settings' ? 'bg-surface-sunken text-text' : IDLE,
        ]"
        :title="`Settings · ${name || 'You'}`"
        :aria-label="`Settings · ${name || 'You'}`"
        @click="you"
      >
        <span :class="ICON">
          <span class="grid size-[28px] place-items-center rounded-full bg-brand-soft font-display text-[11px] font-semibold text-brand">{{ initials }}</span>
        </span>
        <span :class="[LABEL, 'text-[13.5px] font-medium text-text']">
          <span class="truncate">{{ name || 'You' }}</span>
          <UiIcon
            name="settings"
            :size="15"
            class="shrink-0 text-text-faint"
          />
        </span>
      </button>
      <ShellActivity
        v-if="!demo && wide"
        class="shrink-0"
      />
    </div>
  </div>
</template>
