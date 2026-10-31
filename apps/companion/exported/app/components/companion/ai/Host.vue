<script setup lang="ts">
/**
 * The companion wherever there is no dock beside the content, mounted once
 * in `layouts/companion.vue`: the drawer, the phone's sheet, and the button
 * that brings it back.
 *
 * At 1024–1279px (a laptop with a course outline open has no room for a
 * third column) it opens as a drawer floating over the right edge, the same
 * thread and header as the dock, with a faint scrim that closes it on a
 * click outside. On a phone it is a full-height sheet, because a phone has
 * no room to put anything beside anything. At 1280px and up every screen
 * docks it instead (`CompanionAiPanel`, from the workspace or the layout),
 * so this draws nothing there but the button. Either way it is the one
 * shared thread, so a question asked on Today is there when the learner
 * opens a course.
 *
 * The button: when the companion is closed, an ink disc with the lime spark
 * rests in the window's bottom-right corner, on every screen, the way
 * Notion's AI does, a perfect circle that names itself and its key in its
 * tooltip (it used to unfold into a pill on hover, which read as broken). It
 * stands down where a header already carries the "Ask" pill (a workspace;
 * `CompanionAiToggle` counts itself), so a screen never offers two. A phone
 * has the bottom bar's middle button instead.
 *
 * It owns ⌘J (Ctrl+J elsewhere) for the whole of `/app`: it toggles the
 * dock where there is one, this drawer where there isn't, and on the chat
 * page (`/app/chat*`, which is all companion) it puts the caret in the box
 * instead; there the drawer, the sheet and the button all step aside. Esc
 * closes the drawer or the sheet. Quiet AI turns all of it off.
 */
import { useAi } from '~/companion/ai/state'
import { useAiThread } from '~/companion/ai/thread'
import { onChatPage } from '~/companion/ai/routes'
import { onCheckPage } from '~/companion/checks'
import { useQuietAi } from '~/companion/quiet-ai'

const ai = useAi()
const t = useAiThread()
const route = useRoute()
const { quiet } = useQuietAi()
const headerToggles = useState('ai:header-toggles', () => 0)

const mounted = ref(false)
const keys = ref('Ctrl+J')
onMounted(() => {
  mounted.value = true
  if (/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)) keys.value = '⌘J'
})

const onAsk = computed(() => onChatPage(route.path) || onCheckPage(route.path) || t.pageOpen.value > 0)
const drawer = computed(() => mounted.value && !quiet.value && ai.wide.value && !ai.hasDock.value && ai.overlay.value && !onAsk.value)
const sheet = computed(() => mounted.value && !quiet.value && !ai.wide.value && ai.overlay.value && !onAsk.value)
/** The way back to a closed companion, where the screen has no "Ask" of its own. */
const fab = computed(
  () =>
    mounted.value &&
    !quiet.value &&
    ai.wide.value &&
    !onAsk.value &&
    !ai.visible.value &&
    headerToggles.value === 0 &&
    route.path.startsWith('/app'),
)

function onKeydown(event: KeyboardEvent): void {
  const mod = event.metaKey || event.ctrlKey
  if (mod && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'j') {
    if (quiet.value || !route.path.startsWith('/app')) return
    event.preventDefault()
    if (onAsk.value) t.focus()
    else ai.toggle()
    return
  }
  if (event.key === 'Escape' && (drawer.value || sheet.value) && !event.defaultPrevented) {
    ai.hide()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

// Opened on purpose: the caret goes to the box (on a phone too, so the
// keyboard comes up with the sheet, the way a chat app's compose does).
watch([drawer, sheet], ([d, s], [d0, s0]) => {
  if ((d && !d0) || (s && !s0)) nextTick(() => t.focus())
})

// On the chat page there is nothing to open over; the request lands in its box.
watch(
  () => ai.overlay.value,
  (open) => {
    if (open && onAsk.value) {
      ai.overlay.value = false
      t.focus()
    }
  },
)
// Arriving on the chat page with the drawer open: the page takes over.
watch(onAsk, (now) => {
  if (now) ai.overlay.value = false
})

// A phone's sheet covers the page a citation or "Open" just went to.
watch(
  () => route.fullPath,
  () => {
    if (!ai.wide.value && ai.overlay.value) ai.hide()
  },
)

// The sheet holds the page still beneath it.
watch(sheet, (open) => {
  if (import.meta.client) document.body.style.overflow = open ? 'hidden' : ''
})
onBeforeUnmount(() => {
  if (import.meta.client) document.body.style.overflow = ''
})
</script>

<template>
  <Teleport
    v-if="mounted"
    to="body"
  >
    <!-- The way back: bottom-right, inside the window's corner. -->
    <Transition
      enter-active-class="transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,0.84,0.44,1)]"
      enter-from-class="translate-y-2 scale-90 opacity-0"
      leave-active-class="transition-[opacity,transform] duration-120 ease-in"
      leave-to-class="scale-90 opacity-0"
    >
      <!-- A plain disc, the header toggle's ink and lime: the shortcut is in its tooltip. -->
      <button
        v-if="fab"
        type="button"
        class="fixed right-[30px] bottom-[30px] z-[70] grid size-12 cursor-pointer place-items-center rounded-full bg-ink text-lime shadow-lift transition-[background-color,transform] duration-150 hover:bg-ink-2 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none active:scale-[0.95]"
        :title="`Ask BiliMind (${keys})`"
        aria-label="Ask BiliMind"
        @click="ai.show()"
      >
        <UiIcon
          name="spark"
          :size="20"
        />
      </button>
    </Transition>

    <!-- 1024–1279px: a drawer over the right edge. -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="drawer"
        class="fixed inset-0 z-[85] bg-ink/10"
        aria-hidden="true"
        @click="ai.hide()"
      />
    </Transition>
    <Transition
      enter-active-class="transition-[transform,opacity] duration-[240ms] ease-[cubic-bezier(0.16,0.84,0.44,1)]"
      enter-from-class="translate-x-6 opacity-0"
      leave-active-class="transition-[transform,opacity] duration-150 ease-in"
      leave-to-class="translate-x-6 opacity-0"
    >
      <aside
        v-if="drawer"
        class="fixed inset-y-2 right-2 z-[86] flex w-[400px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-[22px] bg-surface shadow-pop ring-1 ring-border"
        role="dialog"
        aria-label="Ask BiliMind"
      >
        <CompanionAiHead mode="drawer" />
        <CompanionAiThread variant="panel" />
      </aside>
    </Transition>

    <!-- Phone: a full-height sheet. -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="sheet"
        class="fixed inset-0 z-[100]"
        role="dialog"
        aria-modal="true"
        aria-label="Ask BiliMind"
      >
        <div
          class="absolute inset-0 bg-ink/45 backdrop-blur-[4px]"
          @click="ai.hide()"
        />
        <div
          class="animate-sheet absolute inset-x-0 top-[max(env(safe-area-inset-top),10px)] bottom-0 flex flex-col overflow-hidden rounded-t-[24px] bg-surface shadow-sheet"
        >
          <div
            class="mx-auto mt-2 h-[5px] w-10 shrink-0 rounded-full bg-surface-track"
            aria-hidden="true"
          />
          <CompanionAiHead mode="sheet" />
          <CompanionAiThread variant="panel" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
