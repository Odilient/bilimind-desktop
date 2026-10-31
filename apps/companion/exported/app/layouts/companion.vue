<script setup lang="ts">
/**
 * The companion sits in the product's own shell: the grey desk with the white
 * window floating on it (ShellFrame), the rail on the left (ShellRail) and,
 * on a phone, the bottom bar (ShellBottomNav). It used to draw a menu and a
 * tab bar of its own, which made one product look like two. Both know when
 * they are under `/app`. There the rail hands over to the companion's
 * sidebar (`CompanionShellSidebar`): New chat, Search, Today, Courses, Notes
 * with its "+", the Calendar, the chats, and you; 260px or the 60px rail,
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
 * In the sample account a one-line strip at the top of the window says so,
 * with the way back to your own.
 *
 * The store loads here once for every screen under `/app`, and what any
 * screen may summon is mounted here: capture (recording, a pasted message,
 * a share from another app), the ⌘K palette (search everything, run a
 * command, or ask BiliMind) and the assistant's drawer, sheet and floating
 * button (⌘J, owned by `CompanionAiHost`).
 *
 * Keyboard: ⌘K or Ctrl-K the palette (and `/` when nothing is being typed),
 * ⌥Space New chat, `[` the sidebar, g t Today, g c Courses, g n Notes,
 * g k Calendar, g a the chat, g i Waiting for your OK. The old product's own
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
import { companionDemoKind } from '~/utils/companionDemo'

const c = useCompanion()
const capture = useCapture()
const palette = usePalette()
const sidebar = useSidebar()
const route = useRoute()

// The device, wired in (app/companion/platform/hooks.ts): the desktop tray's
// countdown, its capture hotkey, and files dropped anywhere on the window.
usePlatformHooks()

useHead({
  title: 'BiliMind',
  meta: [{ name: 'robots', content: 'noindex' }],
})

const GO: Record<string, string> = {
  t: '/app',
  c: '/app/courses',
  i: '/app/inbox',
  k: '/app/calendar',
  n: '/app/notes',
  a: CHAT_PATH,
}

const demo = computed(() => c.status.mode === 'demo')
/** Whose sample account: Kamila's semester, or the brand-new one of `?demo=new`. */
const demoWho = computed(() =>
  demo.value && companionDemoKind() === 'new'
    ? 'a new learner on their first day'
    : 'Kamila, a student in week 8',
)

const workspace = computed(() => isWorkspace(route))
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
 * came from. Several go to the Inbox; nothing usable says so and stops.
 */
const toast = useToast()
let offShare = () => {}

async function onShared(share: Parameters<Parameters<typeof onShare>[0]>[0]): Promise<void> {
  await c.load()
  try {
    const signals = await ingestShare({ ingestText: c.ingestText, ingestFile: c.ingestFile }, share)
    // Chat that names no course and changes nothing ("anyone at the library?")
    // isn't worth a yes: it is set aside rather than left in the Inbox.
    const idle = signals.filter((s) => s.status === 'pending' && !s.subject_id && s.facts.every((f) => f.type === 'note'))
    for (const s of idle) void c.dismissSignal(s.id)
    const pending = signals.filter((s) => s.status === 'pending' && !idle.includes(s))
    if (pending.length === 1) capture.showSignal(pending[0]!)
    else if (pending.length > 1) {
      await navigateTo('/app/inbox')
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
  <ShellFrame>
    <!-- Under `/app` the rail is the companion's sidebar (it carries the bell). -->
    <ShellRail />

    <div class="flex min-w-0 flex-1 flex-col">
      <!-- The phone's bar, drawn as the old pages draw theirs (ShellPageHead):
           where you are, and you. -->
      <header
        v-if="!workspace && pageHeads === 0"
        :class="['cp-safe-top shrink-0 border-b border-border bg-surface/92 backdrop-blur-[14px] lg:hidden', phoneFull && 'max-[899px]:hidden']"
      >
        <div class="flex h-[52px] items-center gap-1 px-2">
          <!-- The sidebar, as a drawer: New chat, the places, the chats. -->
          <button
            type="button"
            class="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-text-soft transition-colors active:bg-surface-sunken"
            aria-label="Menu"
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
            aria-label="BiliMind, Today"
          >
            <UiBrandMark class="size-[26px] shrink-0" />
            <span class="truncate font-display text-[18px] font-semibold tracking-[-0.025em]">BiliMind</span>
          </NuxtLink>
          <button
            type="button"
            class="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-text-soft transition-colors active:bg-surface-sunken"
            aria-label="Search, or ask"
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

      <div
        v-if="demo"
        class="flex shrink-0 items-center justify-center gap-3 border-b border-brand-line bg-brand-soft px-4 py-2 text-[13.5px] text-text-body"
      >
        <span class="max-lg:hidden">Sample account: {{ demoWho }}. Nothing here is saved.</span>
        <span class="lg:hidden">Sample account. Nothing is saved.</span>
        <NuxtLink
          to="/app?demo=0"
          class="font-semibold text-brand underline underline-offset-4 hover:no-underline"
        >
          <span class="max-lg:hidden">Use my own account</span>
          <span class="lg:hidden">Use mine</span>
        </NuxtLink>
      </div>

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
            Your courses didn't load
          </h1>
          <p class="text-[14.5px] text-text-muted">
            {{ c.status.error }} Nothing is lost: everything on this device is still here
            once the connection is back.
          </p>
          <div>
            <UiBtn
              variant="primary"
              @click="c.load(true)"
            >
              Try again
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
    <CompanionAiPanel v-if="!workspace && !onChat && !onToday && !onCheck" />

    <CompanionCaptureSheet />
    <CompanionPalette />
    <CompanionAiHost />
  </ShellFrame>
</template>
