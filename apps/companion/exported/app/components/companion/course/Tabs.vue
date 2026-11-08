<script setup lang="ts">
import type { NodeStatus } from '~/types/api'
import type { Subject } from '~/companion/types'
const { t: tr } = useI18n()

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
 * Since Daylight 2 the strip lives inside the course's top bar
 * (`CompanionCourseHeader`'s slot) as course.html's tabs: pills, the open one
 * on the paper with a hairline. The home is pinned at the left and, once
 * documents are open, shrinks to the course's dot so the strip has room.
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
  /** The course itself: the home tab wears its cover, as the rail and the sidebar do. */
  subject?: Subject | null
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

// course.html's tabs: pills in the page's own top bar, the open one on the paper with a hairline.
const tab =
  'group relative flex h-[30px] shrink-0 cursor-pointer items-center gap-[7px] rounded-[8px] pl-[9px] whitespace-nowrap transition-[background-color,color,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand'
const on = 'bg-bg text-text shadow-[inset_0_0_0_1px_var(--border)]'
const off = 'text-text-muted hover:bg-[rgb(var(--wash-rgb)/0.035)] hover:text-text-soft'
</script>

<template>
  <div
    ref="strip"
    class="om-tabs flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none]"
    role="tablist"
    :aria-label="tr('course.tabs.open')"
  >
    <!-- The course's home: pinned, first, never closed. -->
    <div
      :data-tab-id="HOME_TAB"
      role="tab"
      tabindex="0"
      :aria-selected="activeId === HOME_TAB"
      :title="tr('course.tabs.home', { title: homeTitle })"
      :class="[
        tab,
        // course.html's pinned tab: once documents are open it is the course's dot alone, and it
        // stays put while the strip scrolls under it.
        'sticky left-0 z-[2]',
        tabs.length ? 'pr-[7px] pl-[7px]!' : 'pr-2.5',
        activeId === HOME_TAB ? on : [off, 'bg-surface'],
      ]"
      @click="emit('focus', HOME_TAB)"
      @keydown.enter.prevent="emit('focus', HOME_TAB)"
      @keydown.space.prevent="emit('focus', HOME_TAB)"
    >
      <CompanionCourseCover
        v-if="subject"
        :subject="subject"
        size="sm"
        :px="18"
      />
      <span
        v-else
        class="size-2 shrink-0 rounded-full"
        :style="{ background: homeColor }"
      />
      <span
        v-if="!tabs.length"
        class="max-w-[168px] overflow-hidden text-[13px] font-semibold text-ellipsis"
      >{{ homeTitle }}</span>
      <span
        v-else
        class="sr-only"
      >{{ homeTitle }}</span>
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
          over === t.id && 'shadow-[inset_0_0_0_1.5px_var(--color-brand)]',
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

        <span class="max-w-[180px] overflow-hidden text-[13px] font-semibold text-ellipsis">{{ t.title }}</span>

        <button
          type="button"
          :title="tr('course.tabs.close')"
          :aria-label="tr('course.tabs.closeTab', { title: t.title })"
          :class="[
            'grid size-[18px] shrink-0 cursor-pointer place-items-center rounded-[5px] text-text-muted transition-[opacity,background-color,color] hover:bg-[rgb(var(--wash-rgb)/0.065)] hover:text-text hover:opacity-100',
            t.id === activeId ? 'opacity-60' : 'opacity-0 group-hover:opacity-60 focus-visible:opacity-100',
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

    <div class="flex-1" />
  </div>
</template>
