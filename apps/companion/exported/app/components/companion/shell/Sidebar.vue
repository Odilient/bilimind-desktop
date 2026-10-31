<script setup lang="ts">
/**
 * The companion's sidebar under `/app`, in the place the old product's rail
 * stands everywhere else (`ShellRail` hands over to it there). What it holds
 * is `SidebarBody`; this is where it sits and how it moves.
 *
 * On a computer it is two boxes. The outer one is the column in the row: it
 * takes 260px or 60px of the frame and the page beside it slides over as
 * its width animates. The inner one is the panel, absolutely placed and
 * clipping the 260px body: the same width as the column, except over a
 * workspace (a course, Notes), where the column stays the 60px rail and the
 * panel alone grows to 260px, floating over the content with a shadow. Two
 * 260px columns of names side by side would leave the lesson a strip.
 * Floating, it closes when the learner goes anywhere, clicks the page beside
 * it, or presses Esc (`app/companion/sidebar.ts` has the why of each state).
 *
 * On a phone there is no rail. The bar's menu button opens the same body as
 * a drawer from the left, 44px rows for a thumb, and it closes the same way.
 *
 * Width is the one thing that animates, 200ms on the shell's curve, and
 * only the panel's width at that: the body inside never re-wraps.
 *
 * The 260px is the default: the panel's edge drags it (`panel-width.ts`).
 */
import { isWorkspace, useSidebar } from '~/companion/sidebar'
import { usePanelWidth } from '~/companion/panel-width'

const route = useRoute()
const s = useSidebar()
const size = usePanelWidth('sidebar')

const workspace = computed(() => isWorkspace(route))
/** The names are showing. */
const wide = computed(() => (workspace.value ? s.floating.value : s.pinned.value))
/** Over a workspace and expanded: floating above the content. */
const floats = computed(() => workspace.value && s.floating.value)
const column = computed(() => (!workspace.value && s.pinned.value ? size.css.value : '60px'))
const panel = computed(() => (wide.value ? size.css.value : '60px'))

function toggle(): void {
  s.toggle(workspace.value)
}

// Anywhere the learner goes, what floats is put away.
watch(
  () => route.fullPath,
  () => s.close(),
)

function onKey(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || event.defaultPrevented) return
  if (s.floating.value || s.drawer.value) s.close()
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

/* -- The phone's drawer: the focus goes in, and comes back out ------------- */

const drawerEl = ref<HTMLElement | null>(null)
let opener: HTMLElement | null = null

watch(
  () => s.drawer.value,
  (open) => {
    if (open) {
      opener = document.activeElement as HTMLElement | null
      void nextTick(() => drawerEl.value?.focus())
    } else {
      opener?.focus?.()
      opener = null
    }
  },
)

// Grown past a phone with the drawer open: the rail is there now.
onMounted(() => {
  const query = window.matchMedia('(min-width: 1024px)')
  const onChange = (event: MediaQueryListEvent) => {
    if (event.matches) s.drawer.value = false
  }
  query.addEventListener('change', onChange)
  onBeforeUnmount(() => query.removeEventListener('change', onChange))
})
</script>

<template>
  <div
    class="relative z-[60] hidden shrink-0 transition-[width] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none lg:block"
    :style="{ width: column }"
  >
    <nav
      :class="[
        'absolute inset-y-0 left-0 flex overflow-hidden border-r border-border bg-surface-rail transition-[width,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none',
        floats && 'shadow-[18px_0_48px_-18px_rgb(11_13_16/0.28)]',
      ]"
      :style="{ width: panel, '--sidebar-w': size.css.value }"
      aria-label="Main"
    >
      <CompanionShellSidebarBody
        :wide="wide"
        :mode="floats ? 'float' : 'column'"
        @toggle="toggle"
        @close="s.close()"
      />
    </nav>
    <!-- Outside the nav, which clips; floating, the panel outgrows the column. -->
    <CompanionShellResizeHandle
      v-if="wide"
      panel="sidebar"
      edge="right"
      label="Resize the sidebar"
      class="-translate-x-1/2"
      :style="{ left: panel }"
    />
  </div>

  <!-- Floating over a workspace: the page beside it is the way out. -->
  <Transition
    enter-active-class="transition-opacity duration-200 ease-out"
    enter-from-class="opacity-0"
    leave-active-class="transition-opacity duration-150 ease-in"
    leave-to-class="opacity-0"
  >
    <div
      v-if="floats"
      class="fixed inset-0 z-[59] bg-ink/[0.06] max-lg:hidden"
      aria-hidden="true"
      @click="s.close()"
    />
  </Transition>

  <!-- Phone: the same sidebar as a drawer from the left. -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="s.drawer.value"
        class="fixed inset-0 z-[88] bg-ink/45 backdrop-blur-[3px] lg:hidden"
        aria-hidden="true"
        @click="s.close()"
      />
    </Transition>
    <Transition
      enter-active-class="transition-transform duration-[260ms] ease-[cubic-bezier(0.16,0.84,0.44,1)] motion-reduce:transition-none"
      enter-from-class="-translate-x-full"
      leave-active-class="transition-transform duration-200 ease-in motion-reduce:transition-none"
      leave-to-class="-translate-x-full"
    >
      <aside
        v-if="s.drawer.value"
        ref="drawerEl"
        class="cp-safe-top fixed inset-y-0 left-0 z-[89] flex w-[300px] max-w-[86vw] flex-col bg-surface-rail shadow-sheet outline-none lg:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        tabindex="-1"
      >
        <CompanionShellSidebarBody
          mode="drawer"
          wide
          @close="s.close()"
        />
      </aside>
    </Transition>
  </Teleport>
</template>
