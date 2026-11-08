<script setup lang="ts">
/**
 * The docked companion: a column at the right of a workspace, 360px until
 * dragged (a course, a lesson, a note, a board, Notes), beside the content rather than
 * over it, so the lesson narrows instead of hiding. A workspace mounts it
 * as the last child of its content row:
 *
 *   <CompanionAiPanel />
 *
 * It takes no props: what it can see comes from `useAiContext()` (the tab
 * in front registers it), and the conversation is the one shared thread, so
 * opening a lesson beside an answer about it keeps the answer.
 *
 * It opens and closes with ⌘J or the header's Ask, sliding its width in so
 * the content moves once, smoothly, instead of jumping. It never draws below
 * the shell's `lg` (a phone gets the Host's sheet) and stays away entirely
 * with Quiet AI on. Whether it is open is remembered per device
 * (`state.ts`), and read only after mounting, so the server's first paint
 * and the client's agree.
 */
import { useAi, useAiDock } from '~/companion/ai/state'
import { useAiThread } from '~/companion/ai/thread'
import { useQuietAi } from '~/companion/quiet-ai'
import { usePanelWidth } from '~/companion/panel-width'

useAiDock()
const size = usePanelWidth('assistant')
const ai = useAi()
const t = useAiThread()
const { quiet } = useQuietAi()

const mounted = ref(false)
/** The first open after a reload is no news: it appears without sliding. */
const animate = ref(false)
onMounted(() => {
  mounted.value = true
  requestAnimationFrame(() => {
    animate.value = true
  })
})

// `docked`: open, mounted, and the window ≥1280px (below it the Host's drawer).
const shown = computed(() => mounted.value && ai.docked.value && !quiet.value)

// Opened on purpose (⌘J, Ask): the caret goes to the box. A panel that was
// simply still open on the next screen leaves the focus where it was.
watch(shown, (now, before) => {
  if (now && !before && animate.value) nextTick(() => t.focus())
})
</script>

<template>
  <Transition
    name="ai-dock"
    :css="animate"
  >
    <aside
      v-if="shown"
      class="ai-dock relative flex shrink-0 overflow-hidden border-l border-border bg-surface max-xl:hidden"
      aria-label="Bili, your study assistant"
      :style="{ '--ai-width': size.css.value }"
    >
      <CompanionShellResizeHandle
        panel="assistant"
        edge="left"
        label="Resize the assistant"
        class="left-0"
      />
      <!-- Fixed width inside, so nothing re-wraps while the column opens. -->
      <div class="ai-dock-inner flex h-full shrink-0 flex-col">
        <CompanionAiHead mode="dock" />
        <CompanionAiThread variant="panel" />
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.ai-dock,
.ai-dock-inner {
  width: var(--ai-width);
}

.ai-dock-enter-active,
.ai-dock-leave-active {
  transition:
    width 320ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 220ms ease;
}

.ai-dock-enter-from,
.ai-dock-leave-to {
  width: 0;
  opacity: 0;
}
</style>
