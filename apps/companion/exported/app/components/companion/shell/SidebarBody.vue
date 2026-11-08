<script setup lang="ts">
/**
 * What the app sidebar holds, top to bottom, the way ChatGPT's and Linear's
 * do: the mark, two actions, the places, the chats, and you.
 *
 *   [◉ BiliMind]                 [⇤]      the mark is Bili
 *   [✎ New chat]            ⌥Space      the highlighter: the one loud thing
 *   [⌕ Search]                  ⌘K      the companion palette
 *   ⌂ Today
 *   ✓ Tasks                             every to-do and deadline
 *   ▦ Courses
 *   ▤ Notes                     [+]     a dropdown of note types
 *   ▢ Calendar
 *   Chats                               Today / This week / Earlier
 *   (K) Kamila             (☾) (bell)   the account menu (modes, settings); the theme
 *
 * New chat and Search go nowhere on their own, so they never light as the
 * current page. The places do, as a white card on the paper. "New" is a new
 * chat everywhere now: what to make, ask or plan is said in the chat, and a
 * note is made from Notes' "+".
 *
 * Drawn at the sidebar's full width (`--sidebar-w`, set by `CompanionShellSidebar`)
 * whatever the column around it is doing. The column
 * clips it, so collapsing to the 58px rail is a clip and a fade, never a
 * reflow: every icon sits on the rail's centre line (29px) in both states,
 * the rows become 36px tiles in step with the column, and the names fade.
 * The rail keeps the icons; the chats and the names wait. Courses are
 * one place, not a second list here: their covers made the sidebar busy.
 *
 * `mode` says where it is drawn: `column` in the row, `float` over a
 * workspace, `drawer` on a phone (44px rows, a close button instead of ⇤).
 */
import { useCompanion } from '~/companion/store'
import { usePalette } from '~/companion/palette'
import { startNewChat } from '~/companion/sidebar'
import { useInstitutionPlace } from '~/institution/place'

const props = withDefaults(
  defineProps<{
    /** Names showing. False is the 58px rail. */
    wide?: boolean
    mode?: 'column' | 'float' | 'drawer'
  }>(),
  { wide: true, mode: 'column' },
)

const emit = defineEmits<{ toggle: []; close: [] }>()

const { t } = useI18n()
const c = useCompanion()
const route = useRoute()
const palette = usePalette()

const touch = computed(() => props.mode === 'drawer')

interface Place {
  to: string
  label: string
  icon: string
  /** The `g` shortcut, named in the tooltip. */
  keys: string
  active: (path: string) => boolean
}

const institution = useInstitutionPlace()
const places = computed<Place[]>(() => [
  {
    to: '/app',
    label: t('shell.today'),
    icon: 'home',
    keys: 'g t',
    // A deadline and practice are reached from Today, and so is what waits
    // for a yes ("Waiting for your OK"): the Inbox page is gone.
    active: (p) => p === '/app' || p === '/app/' || /^\/app\/(d\/|practice)/.test(p),
  },
  // Tasks and grades: every to-do and deadline in one list.
  {
    to: '/app/tasks',
    label: t('shell.tasks'),
    icon: 'check-circle',
    keys: 'g d',
    active: (p) => p.startsWith('/app/tasks'),
  },
  {
    to: '/app/courses',
    label: t('shell.courses'),
    icon: 'workspace',
    keys: 'g c',
    active: (p) => p.startsWith('/app/courses') && !p.startsWith('/app/courses/notebook'),
  },
  {
    to: '/app/notes',
    label: t('shell.notes'),
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
    label: t('shell.calendar'),
    icon: 'calendar',
    keys: 'g k',
    active: (p) => p.startsWith('/app/calendar'),
  },
  // A centre, a class or a family page, only for people who belong to an institution.
  ...(institution.value ? [institution.value] : []),
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

const auth = useAuth()
const name = computed(() => auth.user.value?.name?.trim() || c.userName.value)
const initials = computed(() => {
  const words = name.value.split(/\s+/).filter(Boolean)
  const two = words.length >= 2 ? `${words[0]![0]}${words[1]![0]}` : (words[0] ?? '').slice(0, 2)
  return two.toUpperCase() || t('shell.you').slice(0, 2)
})

/* -- The theme, beside you ------------------------------------------------- */

/* One press flips what is on screen. Under 'system' that is whatever the OS
   paints, so it is read here; until mount it is light, as the server drew it. */
const theme = useTheme()
const osDark = ref(false)
let media: MediaQueryList | null = null
function readOs(): void {
  osDark.value = !!media?.matches
}
onMounted(() => {
  media = window.matchMedia('(prefers-color-scheme: dark)')
  readOs()
  media.addEventListener('change', readOs)
})
onBeforeUnmount(() => media?.removeEventListener('change', readOs))
const dark = computed(() => theme.preference.value === 'dark' || (theme.preference.value === 'system' && osDark.value))
function flipTheme(): void {
  theme.set(dark.value ? 'light' : 'dark')
}

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

// Rows fill the sidebar less its 11px margins with names and are 36px tiles on
// the 58px rail, both from the same left edge, so the icon never moves while
// the width animates. Daylight 2's `.sb-item`: hairline-free on the paper, a
// card with a ring for the page you are on.
const ROW =
  'relative flex shrink-0 items-center overflow-hidden rounded-[9px] transition-[width,height,background-color,color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none'
const SIZE = computed(() => [
  props.wide ? (touch.value ? 'w-full' : 'w-[calc(var(--sidebar-w)-22px)]') : 'w-9',
  touch.value ? 'h-11' : props.wide ? 'h-8' : 'h-9',
])
const ICON = 'grid h-full w-9 shrink-0 place-items-center'
const LABEL = computed(() => [
  'flex min-w-0 flex-1 items-center justify-between gap-2 pr-2 whitespace-nowrap transition-opacity duration-150',
  props.wide ? 'opacity-100' : 'pointer-events-none opacity-0',
])
const IDLE = 'text-text-soft hover:bg-[rgb(var(--wash-rgb)/0.05)] hover:text-text [&_svg]:text-text-faint hover:[&_svg]:text-text-soft'
const LIT = 'bg-surface text-text shadow-[0_0_0_1px_var(--border),var(--shadow-card)] [&_svg]:text-text'
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
        class="group/mark relative grid size-9 shrink-0 cursor-pointer place-items-center rounded-[10px] text-text-soft transition-colors duration-150 hover:bg-[rgb(var(--wash-rgb)/0.065)] hover:text-text focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        :title="`${t('shell.expandSidebar')} ( [ )`"
        :aria-label="t('shell.expandSidebar')"
        aria-expanded="false"
        @click="toggle"
      >
        <!-- The mark is Bili, as on the landing and in the mock's rail. -->
        <CompanionAiBilim
          :size="26"
          still
          class="transition-opacity duration-150 group-hover/mark:opacity-0 group-focus-visible/mark:opacity-0"
        />
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
            'flex min-w-0 items-center gap-2.5 rounded-[10px] pr-2 pl-1 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
            touch ? 'h-11' : 'h-9',
          ]"
          :aria-label="t('shell.todayAria')"
          @click="emit('close')"
        >
          <CompanionAiBilim
            :size="26"
            still
            class="shrink-0"
          />
          <span class="truncate font-display text-[17px] font-semibold tracking-[-0.03em] text-text">BiliMind</span>
        </NuxtLink>
        <span class="flex-1" />
        <button
          ref="collapseBtn"
          type="button"
          :class="[
            'grid shrink-0 cursor-pointer place-items-center rounded-[9px] text-text-faint transition-colors duration-150 hover:bg-[rgb(var(--wash-rgb)/0.065)] hover:text-text focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
            touch ? 'size-11' : 'size-8',
          ]"
          :title="touch ? t('common.close') : `${t('shell.collapseSidebar')} ( [ )`"
          :aria-label="touch ? t('shell.closeMenu') : t('shell.collapseSidebar')"
          :aria-expanded="touch ? undefined : true"
          @click="touch ? emit('close') : toggle()"
        >
          <UiIcon
            :name="touch ? 'x' : 'panel-left'"
            :size="touch ? 20 : 17"
            :stroke="1.9"
          />
        </button>
      </template>
    </div>

    <!-- The two actions. New chat is the sidebar's one highlighter-yellow thing. -->
    <div class="flex shrink-0 flex-col gap-0.5 px-[11px] pt-1">
      <button
        type="button"
        :class="[
          ROW,
          SIZE,
          'cursor-pointer bg-accent font-semibold text-on-accent shadow-[inset_0_0_0_1px_var(--accent-line)] hover:bg-hi-2 active:scale-[0.98]',
        ]"
        :title="`${t('shell.newChat')} (${newKey})`"
        :aria-label="wide ? undefined : t('shell.newChat')"
        @click="newChat"
      >
        <span :class="ICON">
          <!-- Compose: a page and a pen, the mark every chat app uses for "new". -->
          <svg
            viewBox="0 0 24 24"
            width="17"
            height="17"
            fill="none"
            stroke="currentColor"
            stroke-width="2.1"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          ><path d="M11 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V13" /><path d="M17.6 3.9a1.9 1.9 0 0 1 2.7 2.7L12.6 14.3l-3.6.9.9-3.6Z" /></svg>
        </span>
        <span :class="[LABEL, 'text-[13.5px]']">
          {{ t('shell.newChat') }}
          <kbd class="num rounded-[5px] px-1 py-px text-[10.5px] font-semibold opacity-60">{{ newKey }}</kbd>
        </span>
      </button>

      <button
        type="button"
        :class="[ROW, SIZE, 'cursor-pointer', palette.open.value ? LIT : IDLE]"
        :title="`${t('shell.searchAsk')} (${searchKey})`"
        :aria-label="wide ? undefined : t('shell.searchAsk')"
        aria-haspopup="dialog"
        :aria-expanded="palette.open.value"
        @click="search"
      >
        <span :class="ICON">
          <UiIcon
            name="search"
            :size="16"
            :stroke="1.9"
          />
        </span>
        <span :class="[LABEL, 'text-[13.5px] font-medium']">
          {{ t('shell.search') }}
          <kbd class="num grid h-[18px] min-w-[18px] place-items-center rounded-[5px] bg-surface px-1 text-[10.5px] font-semibold text-text-faint shadow-[0_0_0_1px_var(--border-strong),0_1px_0_var(--border-strong)]">{{ searchKey }}</kbd>
        </span>
      </button>
    </div>

    <!-- The places. -->
    <nav
      class="flex shrink-0 flex-col gap-px px-[11px] pt-2.5"
      :aria-label="t('shell.places')"
    >
      <div
        v-for="place in places"
        :key="place.to"
        class="group/place relative"
      >
        <NuxtLink
          :to="place.to"
          :title="`${place.label} (${place.keys})`"
          :aria-label="wide ? undefined : place.label"
          :aria-current="place.active(route.path) ? 'page' : undefined"
          :class="[ROW, SIZE, place.active(route.path) ? LIT : IDLE]"
          @click="emit('close')"
        >
          <span :class="ICON">
            <CompanionIcon
              :name="place.icon"
              :size="16"
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
          </span>
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
              touch ? 'right-1' : 'right-0.5',
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
        'mt-3 flex min-h-0 flex-1 flex-col transition-opacity duration-150',
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

    <!-- You: the row opens the account menu; beside it the theme and the old
         product's bell, each its own button. On the rail they stack above you. -->
    <div
      :class="[
        'flex shrink-0 gap-1 border-t border-border px-[11px] py-2.5',
        wide ? 'flex-row items-center' : 'flex-col items-start',
        touch && 'pb-[max(10px,env(safe-area-inset-bottom))]',
      ]"
    >
      <button
        type="button"
        :class="[
          'grid shrink-0 cursor-pointer place-items-center rounded-[10px] text-text-faint transition-colors duration-150 hover:bg-[rgb(var(--wash-rgb)/0.065)] hover:text-text focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
          touch ? 'size-11' : 'size-9',
          wide && 'order-2',
        ]"
        :title="dark ? t('shell.lightTheme') : t('shell.darkTheme')"
        :aria-label="dark ? t('shell.switchLight') : t('shell.switchDark')"
        @click="flipTheme"
      >
        <UiIcon
          :name="dark ? 'sun' : 'moon'"
          :size="16"
          :stroke="1.9"
        />
      </button>
      <ShellActivity
        compact
        :class="['shrink-0', wide && 'order-3']"
      />
      <!-- You: the account menu, where the modes are (study, your institutions), settings and sign-out. -->
      <ShellAccountMenu
        :class="[
          // Beside the theme and the bell; the rail's 36px tile otherwise.
          !wide ? 'w-9' : touch ? 'min-w-0 flex-1' : 'w-[calc(var(--sidebar-w)-102px)]',
          wide && 'order-1',
        ]"
      >
        <template #trigger="{ press, open }">
          <button
            type="button"
            :class="[
              ROW,
              'w-full cursor-pointer',
              touch ? 'h-11' : 'h-9',
              open || route.path === '/app/settings' ? LIT : IDLE,
            ]"
            :title="name || t('shell.you')"
            :aria-label="name ? t('shell.account', { name }) : t('shell.yourAccount')"
            :aria-expanded="open"
            aria-haspopup="menu"
            @click="press()"
          >
            <span :class="ICON">
              <span class="grid size-[28px] place-items-center rounded-full bg-apricot-soft font-display text-[11px] font-semibold text-apricot-ink shadow-[0_0_0_1.5px_var(--surface)]">{{ initials }}</span>
            </span>
            <span :class="[LABEL, 'text-[13.5px] font-medium text-text']">
              <span class="truncate">{{ name || t('shell.you') }}</span>
            </span>
          </button>
        </template>
      </ShellAccountMenu>
    </div>
  </div>
</template>
