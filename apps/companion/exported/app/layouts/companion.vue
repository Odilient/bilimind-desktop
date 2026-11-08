<script setup lang="ts">
/**
 * The companion's frame is Daylight 2's (docs/design/daylight2/course.html):
 * the rail and the sidebar on the warm paper, the page a card on it with a
 * 46px head, and on a phone the bottom bar (ShellBottomNav). Under `/app` the
 * rail is the companion's sidebar (`CompanionShellSidebar`): New chat,
 * Search, Today, Tasks, Courses, Notes with its "+", the Calendar, the
 * chats, and you; 252px or the 58px rail,
 * floating over a workspace. The phone's bar is Today, Courses, the
 * assistant in the middle, Notes and the Calendar, and its top bar has the
 * menu button that opens the same sidebar as a drawer.
 *
 * The assistant is on every screen but the chat page (which IS the
 * assistant). A workspace docks its own `CompanionAiPanel`; every other
 * screen gets the one mounted here, at the end of the row, so there is
 * always exactly one. Below 1280px it is the Host's drawer or sheet instead
 * (`app/companion/ai/state.ts`).
 *
 * Two kinds of page sit in the window:
 *
 *  - Most scroll in `#companion-main` (Start scrolls it back to the top by
 *    that id). It is a flex column, so a note or a board can fill it with
 *    `flex-1 min-h-0` and scroll inside itself.
 *  - A workspace (`definePageMeta({ layout: 'companion', workspace: true })`,
 *    the course) gets the box exactly and scrolls its own panels, the way
 *    `layouts/workspace.vue` gives it to the old course workspace. On a phone
 *    it brings its own bars, so the shell's stay out of its way. One route can
 *    be both kinds (the course's route also draws Notes), so `workspace` may
 *    be a function of the route instead.
 *
 * On a phone the window opens with the old pages' phone bar: the mark, and
 * your avatar, which opens the settings sheet (a phone has no rail to keep
 * it in). A page that heads itself with `ShellPageHead`, as the old pages
 * do, gets that bar instead: a mounted head is counted and this one stands
 * down, so a phone never shows two. A note on the phone is full screen, its toolbar resting
 * on the keyboard: it asks for that with `fullscreen: 'phone'`.
 *
 * The store loads here once for every screen under `/app`, and what any
 * screen may summon is mounted here: capture (recording, a pasted message,
 * a share from another app), the ⌘K palette (search everything, run a
 * command, or ask BiliMind) and the assistant's drawer, sheet and floating
 * button (⌘J, owned by `CompanionAiHost`).
 *
 * Keyboard: ⌘K or Ctrl-K the palette (and `/` when nothing is being typed),
 * ⌥Space New chat, `[` the sidebar, g t Today, g c Courses, g n Notes,
 * g k Calendar, g a the chat, g d Tasks. The old product's own
 * ⌘K stands aside here (`useSearchHotkey`), so the two palettes never open
 * together.
 */
import { useCompanion } from '~/companion/store'
import { useCapture } from '~/companion/capture'
import { usePalette } from '~/companion/palette'
import { ingestShare, onShare } from '~/companion/native/share'
import { usePlatformHooks } from '~/companion/platform'
import { CHAT_PATH, onChatPage } from '~/companion/ai/routes'
import { onCheckPage } from '~/companion/checks'
import { isWorkspace, startNewChat, useSidebar } from '~/companion/sidebar'
import { useAi } from '~/companion/ai/state'
import { setMode } from '~/institution/place'

const c = useCompanion()
const capture = useCapture()
const palette = usePalette()
const sidebar = useSidebar()
const route = useRoute()

// The device, wired in (app/companion/platform/hooks.ts): the desktop tray's
// countdown, its capture hotkey, and files dropped anywhere on the window.
usePlatformHooks()

// ShellFrame used to do this; the frame is drawn here now (see the template).
useAppTheme()

useHead({
  title: 'BiliMind',
  meta: [{ name: 'robots', content: 'noindex' }],
})

const GO: Record<string, string> = {
  t: '/app',
  c: '/app/courses',
  k: '/app/calendar',
  n: '/app/notes',
  a: CHAT_PATH,
  // Tasks and grades: "g d", things to do.
  d: '/app/tasks',
}

const workspace = computed(() => isWorkspace(route))

/*
 * The card's 46px head on a computer (Daylight 2's `.ui-h`, the same head
 * every app screen has on the landing): the sidebar's toggle, where you are
 * (a course's cover first when the screen belongs to one), and the
 * assistant's toggle. A phone has its own bar (below), so this one is
 * desktop only.
 */
const { t } = useI18n()
const ai = useAi()
const PLACES = computed<[RegExp, string, string][]>(() => [
  [/^\/app\/?$/, t('shell.today'), 'home'],
  [/^\/app\/tasks/, t('shell.tasks'), 'check-circle'],
  [/^\/app\/courses/, t('shell.courses'), 'workspace'],
  [/^\/app\/calendar/, t('shell.calendar'), 'calendar'],
  [/^\/app\/settings/, t('shell.settings'), 'settings'],
  [/^\/app\/connect-assistant/, t('shell.placeConnect'), 'plug'],
  [/^\/app\/openrouter/, 'OpenRouter', 'key'],
  [/^\/app\/notion/, t('shell.placeNotion'), 'page'],
  [/^\/app\/chat/, t('shell.placeChat'), 'chat'],
  [/^\/app\/practice/, t('shell.placePractice'), 'cards'],
  [/^\/app\/check/, t('shell.placeCheck'), 'check'],
  [/^\/app\/d\//, t('shell.placeDeadline'), 'flag'],
  [/^\/app\/(notes|p|b)\b/, t('shell.notes'), 'notebook'],
  // A student's side of an institution (docs/institutions); staff and parents have their own layout (layouts/org.vue).
  [/^\/app\/class/, t('shell.placeClass'), 'cap'],
  [/^\/app\/messages/, t('shell.placeMessages'), 'chat'],
])
const here = computed(() => {
  const hit = PLACES.value.find(([re]) => re.test(route.path))
  const deadline = route.path.startsWith('/app/d/') ? c.get('deadlines', String(route.params.id ?? '')) : null
  return {
    label: deadline?.title ?? hit?.[1] ?? 'BiliMind',
    icon: hit?.[2] ?? 'home',
    course: deadline ? c.subjectOf(deadline) : null,
  }
})
/** The chat page is the assistant; nothing of it is docked beside itself. */
const onChat = computed(() => onChatPage(route.path))
/** A check is answered without help, so nothing of the assistant is beside it. */
const onCheck = computed(() => onCheckPage(route.path))
/** Today's question box is the assistant there: two boxes on one screen read as a mistake. */
const onToday = computed(() => route.path === '/app' || route.path === '/app/')
/** Below 900px a note is the whole screen; above it the shell stays. */
const phoneFull = computed(() => route.meta.fullscreen === 'phone')
const failed = computed(() => Boolean(c.status.error) && !c.status.ready)
/** How many `ShellPageHead`s are on screen; any at all brings its own phone bar. */
const pageHeads = useState('shell:page-heads', () => 0)

let pendingG = 0

function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

function onKey(event: KeyboardEvent): void {
  if (event.isComposing) return
  if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
    // Chrome and Firefox both give Ctrl-K to the address bar otherwise.
    event.preventDefault()
    palette.toggle()
    return
  }
  if (event.altKey && event.code === 'Space') {
    event.preventDefault()
    palette.hide()
    void startNewChat()
    return
  }
  if (event.metaKey || event.ctrlKey || event.altKey || typing(event.target) || palette.open.value) return
  if (event.key === '/') {
    event.preventDefault()
    palette.show()
    return
  }
  // Linear's key for the sidebar. A phone has a drawer instead, opened by hand.
  if (event.key === '[' && window.matchMedia('(min-width: 1024px)').matches) {
    event.preventDefault()
    sidebar.toggle(workspace.value)
    return
  }
  const key = event.key.toLowerCase()
  if (key === 'g') {
    pendingG = Date.now()
    return
  }
  if (pendingG && Date.now() - pendingG < 1200 && GO[key]) {
    event.preventDefault()
    pendingG = 0
    void navigateTo(GO[key]!)
    return
  }
  pendingG = 0
}

/*
 * Shared from another app (Android's share sheet; a no-op everywhere else).
 * One fact opens as the share card over whatever is on screen — the
 * mockup's "Move the deadline?" — so the yes is one tap from the chat it
 * came from. Several wait on Today; nothing usable says so and stops.
 */
const toast = useToast()
let offShare = () => {}

async function onShared(share: Parameters<Parameters<typeof onShare>[0]>[0]): Promise<void> {
  await c.load()
  try {
    const signals = await ingestShare({ ingestText: c.ingestText, ingestFile: c.ingestFile }, share)
    // Chat that names no course and changes nothing ("anyone at the library?")
    // isn't worth a yes: it is set aside rather than left waiting on Today.
    const idle = signals.filter((s) => s.status === 'pending' && !s.subject_id && s.facts.every((f) => f.type === 'note'))
    for (const s of idle) void c.dismissSignal(s.id)
    const pending = signals.filter((s) => s.status === 'pending' && !idle.includes(s))
    if (pending.length === 1) capture.showSignal(pending[0]!)
    else if (pending.length > 1) {
      await navigateTo('/app')
      toast.info({ title: `${pending.length} things to check`, body: 'From what you just shared.' })
    } else if (signals.length && !idle.length) {
      toast.success('Already in: nothing needs your yes.')
    } else {
      toast.info('Nothing in that to file: no date, no course. It wasn\'t kept.')
    }
  } catch {
    toast.error('That share didn\'t go through. Try sharing it again.')
  }
  if (share.skipped) toast.info(`${share.skipped} file${share.skipped === 1 ? '' : 's'} couldn't be read.`)
}

onMounted(() => {
  // Staff and parents who come back to their own study open here next time (institution/place.ts).
  setMode('study')
  window.addEventListener('keydown', onKey)
  offShare = onShare(onShared)
  // Dev builds only: `__bmShare('text')` in the console runs a share through
  // the same path, so the share card can be checked without an Android phone.
  if (import.meta.dev) {
    ;(window as unknown as { __bmShare: (text: string) => Promise<void> }).__bmShare = (text) =>
      onShared({ id: 'dev', text, subject: null, files: [], skipped: 0, receivedAt: new Date().toISOString() })
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  offShare()
})
</script>

<template>
  <!-- Daylight 2's frame (docs/design/daylight2/course.html): the rail and the
       sidebar sit on the warm paper, and the page is a card on it, 8px in
       from the edges. A workspace draws its own card (its left column stays
       on the paper beside it); a phone has no paper, the page is the screen. -->
  <div class="flex h-dvh overflow-hidden bg-bg text-text">
    <!-- Under `/app` the rail is the companion's sidebar (it carries the bell). -->
    <ShellRail />

    <div
      :class="[
        'flex min-w-0 flex-1 flex-col',
        !workspace &&
          'bg-surface lg:my-2 lg:mr-2 lg:overflow-hidden lg:rounded-[14px] lg:shadow-[0_0_0_1px_var(--border),var(--shadow-raised)]',
      ]"
    >
      <!-- The phone's bar, drawn as the old pages draw theirs (ShellPageHead):
           where you are, and you. -->
      <header
        v-if="!workspace && pageHeads === 0"
        :class="['cp-safe-top shrink-0 border-b border-border bg-surface/94 backdrop-blur-[14px] lg:hidden', phoneFull && 'max-[899px]:hidden']"
      >
        <div class="flex h-[52px] items-center gap-1 px-2">
          <!-- The sidebar, as a drawer: New chat, the places, the chats. -->
          <button
            type="button"
            class="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-text-soft transition-colors active:bg-surface-sunken"
            :aria-label="t('shell.menu')"
            aria-haspopup="dialog"
            :aria-expanded="sidebar.drawer.value"
            @click="sidebar.drawer.value = true"
          >
            <UiIcon
              name="menu"
              :size="21"
              :stroke="1.9"
            />
          </button>
          <NuxtLink
            to="/app"
            class="flex min-h-11 min-w-0 flex-1 items-center gap-2"
            :aria-label="t('shell.todayAria')"
          >
            <CompanionAiBilim
              :size="24"
              still
              class="shrink-0"
            />
            <span class="truncate font-display text-[18px] font-semibold tracking-[-0.025em]">BiliMind</span>
          </NuxtLink>
          <button
            type="button"
            class="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-text-soft transition-colors active:bg-surface-sunken"
            :aria-label="t('shell.searchAsk')"
            @click="palette.show()"
          >
            <UiIcon
              name="search"
              :size="20"
              :stroke="1.9"
            />
          </button>
          <ShellAccountMenu size="md" />
        </div>
      </header>

      <header
        v-if="!workspace"
        class="hidden h-[46px] shrink-0 items-center gap-1.5 border-b border-border px-2 text-[13px] whitespace-nowrap lg:flex"
      >
        <button
          type="button"
          class="grid size-[30px] shrink-0 cursor-pointer place-items-center rounded-[8px] text-text-faint transition-colors hover:bg-[rgb(var(--wash-rgb)/0.065)] hover:text-text focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
          :title="`${sidebar.pinned.value ? t('shell.hideSidebar') : t('shell.showSidebar')} ( [ )`"
          :aria-label="sidebar.pinned.value ? t('shell.hideSidebar') : t('shell.showSidebar')"
          :aria-expanded="sidebar.pinned.value"
          @click="sidebar.toggle(false)"
        >
          <UiIcon
            name="panel-left"
            :size="16"
            :stroke="1.9"
          />
        </button>
        <template v-if="here.course">
          <NuxtLink
            :to="`/app/courses/${here.course.id}`"
            class="ml-1 flex min-w-0 items-center gap-1.5 text-text-faint transition-colors hover:text-text"
          >
            <CompanionCourseCover
              :subject="here.course"
              size="sm"
              :px="18"
            />
            <span class="truncate">{{ here.course.title }}</span>
          </NuxtLink>
          <UiIcon
            name="chevron-right"
            :size="13"
            class="shrink-0 text-text-ghost"
          />
        </template>
        <span
          v-else
          class="ml-1 grid size-[22px] shrink-0 place-items-center rounded-[6px] bg-[rgb(var(--wash-rgb)/0.065)] text-text-soft"
        >
          <CompanionIcon
            :name="here.icon"
            :size="13"
            :stroke="1.9"
          />
        </span>
        <span class="min-w-0 truncate font-bold tracking-[-0.01em] text-text">{{ here.label }}</span>
        <span class="flex-1" />
        <!-- Daylight 2's assistant toggle: the chat and a check have none. -->
        <button
          v-if="!onChat && !onCheck"
          type="button"
          :class="[
            'grid size-[30px] shrink-0 cursor-pointer place-items-center rounded-[8px] transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
            ai.visible.value ? 'bg-accent-soft text-accent-strong' : 'text-text-faint hover:bg-[rgb(var(--wash-rgb)/0.065)] hover:text-text',
          ]"
          :title="`${t('shell.askBilim')} (⌘J)`"
          :aria-label="t('shell.askBilim')"
          :aria-expanded="ai.visible.value"
          @click="ai.toggle()"
        >
          <UiIcon
            name="spark"
            :size="16"
            :stroke="1.9"
          />
        </button>
      </header>

      <CompanionRecordingPill />
      <CompanionFocusPill />

      <!-- A workspace fills the box and scrolls its own panels; it only lands
           in the scroller when there is nothing to show but the error. -->
      <div
        v-if="workspace && !failed"
        class="flex min-h-0 flex-1 flex-col"
      >
        <slot />
      </div>
      <main
        v-else
        id="companion-main"
        class="om-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain"
      >
        <div
          v-if="failed"
          class="mx-auto grid max-w-[420px] content-center gap-3 px-6 py-24 text-center"
          role="alert"
        >
          <h1 class="t-head text-[22px]">
            {{ t('shell.loadFailed') }}
          </h1>
          <p class="text-[14.5px] text-text-muted">
            {{ c.status.error }} {{ t('shell.loadFailedBody') }}
          </p>
          <div>
            <UiBtn
              variant="primary"
              @click="c.load(true)"
            >
              {{ t('common.retry') }}
            </UiBtn>
          </div>
        </div>
        <slot v-else />
      </main>

      <ShellBottomNav
        v-if="!workspace"
        :class="phoneFull && 'max-[899px]:hidden'"
      />
    </div>

    <!-- The assistant docked beside every screen that has no dock of its own:
         a workspace mounts its own, and the chat page and Today's box are
         the assistant (there the corner button opens it as a drawer). -->
    <!-- Its own card beside the page, as in the workspace mock; empty (the
         dock closed) it takes no room at all. -->
    <div
      v-if="!workspace && !onChat && !onToday && !onCheck"
      class="shrink-0 empty:hidden max-xl:hidden xl:my-2 xl:mr-2 xl:overflow-hidden xl:rounded-[14px] xl:shadow-[0_0_0_1px_var(--border),var(--shadow-raised)] [&>aside]:h-full [&>aside]:border-l-0"
    >
      <CompanionAiPanel />
    </div>

    <CompanionCaptureSheet />
    <CompanionPalette />
    <CompanionAiHost />
  </div>
</template>
