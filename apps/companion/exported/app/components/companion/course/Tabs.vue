<script setup lang="ts">
import type { NodeStatus } from '~/types/api'

/**
 * The course's document strip: the old workspace's (`WorkspaceTabBar`), with
 * its classes copied, because that one only knows lessons, sandboxes and
 * lesson boards, and a course here also opens notes and whiteboards.
 *
 * The first tab is the course's home, pinned: a house and the course's name,
 * never closed. The roadmap, the weeks and the deadlines live inside it
 * (`CompanionCourseHome`), not here: they are the course, and a strip that
 * mixed them with open lessons asked the learner to tell views from
 * documents. Everything after it is a document, opened from the home, the
 * sidebar or a link, and closes like an editor tab: the ×, a middle click,
 * or ⌘W for the one in front. A document tab can be dragged into another
 * place in the strip.
 *
 * The open tab is a real tab: white like the page under it, edged on three
 * sides and open at the foot, so it and its page read as one sheet. The strip
 * sits a shade darker and draws its rule as an inset shadow, which the open
 * tab's own white paints over; a border would stay on top of it. No accent
 * underline: on white it was the only thing saying which tab was open, and
 * the lime barely showed.
 */
export interface StripTab {
  id: string
  title: string
  /** A glyph from `CompanionIcon`; a lesson shows its status dot instead. */
  icon?: string
  status?: NodeStatus | null
}

/** The home's id in the strip; the course page uses the same word. */
const HOME_TAB = 'home'

const props = defineProps<{
  homeTitle: string
  homeColor: string
  tabs: StripTab[]
  activeId: string
}>()

const emit = defineEmits<{
  focus: [id: string]
  close: [id: string]
  move: [id: string, before: string | null]
}>()

const strip = ref<HTMLElement | null>(null)

/** Keep the foreground tab visible when it is opened from the sidebar. */
watch(
  () => props.activeId,
  async (id) => {
    if (!id || !import.meta.client) return
    await nextTick()
    strip.value
      ?.querySelector(`[data-tab-id="${CSS.escape(id)}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  },
)

/* -- Dragging a tab into another place ------------------------------------ */

const dragging = ref<string | null>(null)
const over = ref<string | null>(null)

function onDragStart(id: string, event: DragEvent): void {
  dragging.value = id
  event.dataTransfer?.setData('text/plain', id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDragOver(id: string, event: DragEvent): void {
  if (!dragging.value || dragging.value === id) return
  event.preventDefault()
  over.value = id
}

function onDrop(id: string): void {
  if (dragging.value && dragging.value !== id) emit('move', dragging.value, id)
  dragging.value = null
  over.value = null
}

function onDragEnd(): void {
  dragging.value = null
  over.value = null
}

const tab =
  'group relative flex h-[34px] shrink-0 cursor-pointer items-center gap-2 rounded-t-[10px] pl-3 whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cobalt'
const on =
  'bg-surface text-text shadow-[inset_1px_0_0_var(--border-strong),inset_-1px_0_0_var(--border-strong),inset_0_1px_0_var(--border-strong)]'
const off = 'text-text-muted hover:bg-surface-track hover:text-text'
</script>

<template>
  <div
    ref="strip"
    class="om-tabs flex h-10 shrink-0 items-end gap-0.5 overflow-x-auto overflow-y-hidden bg-surface-rail px-2 shadow-[inset_0_-1px_0_var(--border-strong)]"
    role="tablist"
    aria-label="Open in this course"
  >
    <!-- The course's home: pinned, first, never closed. -->
    <div
      :data-tab-id="HOME_TAB"
      role="tab"
      tabindex="0"
      :aria-selected="activeId === HOME_TAB"
      :title="`${homeTitle}: roadmap, weeks, deadlines, notes and files`"
      :class="[tab, 'pr-3', activeId === HOME_TAB ? on : off]"
      @click="emit('focus', HOME_TAB)"
      @keydown.enter.prevent="emit('focus', HOME_TAB)"
      @keydown.space.prevent="emit('focus', HOME_TAB)"
    >
      <UiIcon
        name="home"
        :size="14"
        :stroke="2"
        :style="{ color: homeColor }"
      />
      <span class="max-w-[168px] overflow-hidden text-[13px] font-semibold text-ellipsis">{{ homeTitle }}</span>
    </div>

    <TransitionGroup
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 translate-y-1"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0"
      move-class="transition-transform duration-150"
    >
      <div
        v-for="t in tabs"
        :key="t.id"
        :data-tab-id="t.id"
        role="tab"
        tabindex="0"
        draggable="true"
        :aria-selected="t.id === activeId"
        :title="t.title"
        :class="[
          tab,
          'pr-1.5',
          t.id === activeId ? on : off,
          dragging === t.id && 'opacity-50',
          over === t.id && 'shadow-[inset_2px_0_0_var(--color-cobalt)]',
        ]"
        @click="emit('focus', t.id)"
        @keydown.enter.prevent="emit('focus', t.id)"
        @keydown.space.prevent="emit('focus', t.id)"
        @keydown.delete.prevent="emit('close', t.id)"
        @auxclick.middle.prevent="emit('close', t.id)"
        @dragstart="onDragStart(t.id, $event)"
        @dragover="onDragOver(t.id, $event)"
        @dragleave="over === t.id && (over = null)"
        @drop.prevent="onDrop(t.id)"
        @dragend="onDragEnd"
      >
        <UiStatusDot
          v-if="t.status"
          :status="t.status"
          :size="7"
        />
        <CompanionIcon
          v-else-if="t.icon"
          :name="t.icon"
          :size="13"
          :stroke="1.9"
          class="text-brand"
        />

        <span class="max-w-[188px] overflow-hidden text-[13px] font-semibold text-ellipsis">{{ t.title }}</span>

        <button
          type="button"
          title="Close (⌘W)"
          :aria-label="`Close ${t.title}`"
          :class="[
            'grid size-[18px] shrink-0 cursor-pointer place-items-center rounded-[6px] text-text-faint transition-[opacity,background-color,color] hover:bg-surface-track hover:text-text-soft',
            t.id === activeId ? 'opacity-100' : 'opacity-60 group-hover:opacity-100',
          ]"
          @click.stop="emit('close', t.id)"
        >
          <UiIcon
            name="x"
            :size="10"
            :stroke="2.4"
          />
        </button>
      </div>
    </TransitionGroup>

    <!-- Nothing open yet: say what the strip is for, once, quietly. -->
    <p
      v-if="!tabs.length"
      class="self-center pl-3 text-[12.5px] text-text-faint max-xl:hidden"
    >
      Lessons, notes and whiteboards you open sit here, side by side.
    </p>

    <div class="flex-1" />
  </div>
</template>
