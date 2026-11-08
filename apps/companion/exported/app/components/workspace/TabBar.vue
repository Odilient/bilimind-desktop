<script setup lang="ts">
import type { CourseNode } from '~/types/api'
import type { WorkspaceTab } from '~/composables/useWorkspace'

/**
 * The editor-style tab strip.
 *
 * Tabs, rather than one-node-at-a-time navigation, because of what the content
 * actually is: a DAG. Reading "Backpropagation" while keeping "The forward
 * pass" open next to it is the normal way to work through a dependency chain,
 * and a back button cannot express it.
 */
const props = defineProps<{
  tabs: WorkspaceTab[]
  activeId: string | null
  nodesById: Map<number, CourseNode>
}>()

const emit = defineEmits<{ focus: [id: string]; close: [id: string] }>()

interface Decorated {
  id: string
  title: string
  isMap: boolean
  isSandbox: boolean
  isBoard: boolean
  node: CourseNode | null
}

const decorated = computed<Decorated[]>(() =>
  props.tabs.map((tab) => {
    if (tab.kind === 'map') {
      return { id: tab.id, title: 'Roadmap', isMap: true, isSandbox: false, isBoard: false, node: null }
    }
    if (tab.kind === 'sandbox') {
      return { id: tab.id, title: tab.title, isMap: false, isSandbox: true, isBoard: false, node: null }
    }
    if (tab.kind === 'board') {
      return { id: tab.id, title: tab.title, isMap: false, isSandbox: false, isBoard: true, node: null }
    }
    const node = props.nodesById.get(tab.nodeId) ?? null
    return { id: tab.id, title: node?.title ?? 'Lesson', isMap: false, isSandbox: false, isBoard: false, node }
  }),
)

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
</script>

<template>
  <div
    ref="strip"
    class="om-tabs flex h-[42px] shrink-0 items-end gap-0.5 overflow-x-auto overflow-y-hidden border-b border-border bg-surface-chrome px-2"
    role="tablist"
    aria-label="Open lessons"
  >
    <div
      v-for="tab in decorated"
      :key="tab.id"
      :data-tab-id="tab.id"
      role="tab"
      :aria-selected="tab.id === activeId"
      :class="[
        // Cobalt's tab: a rounded-top tile; the open one is white, ringed by
        // the hairline and underlined in the line-weight lime.
        'group relative flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-t-[10px] pr-2 pl-3 whitespace-nowrap transition-colors',
        tab.id === activeId
          ? 'bg-surface text-text shadow-[0_0_0_1px_var(--border)]'
          : 'text-text-faint hover:bg-surface-track/60 hover:text-text-soft',
      ]"
      @click="emit('focus', tab.id)"
      @auxclick.middle.prevent="emit('close', tab.id)"
    >
      <span
        v-if="tab.id === activeId"
        class="pointer-events-none absolute right-2 -bottom-px left-2 h-[2.5px] rounded-[2px] bg-hi-2"
        aria-hidden="true"
      />
      <UiIcon
        v-if="tab.isMap"
        name="map"
        :size="13"
        :stroke="1.9"
        class="text-brand"
      />
      <UiIcon
        v-else-if="tab.isSandbox"
        name="play"
        :size="12"
        :stroke="2"
        class="text-brand"
      />
      <UiIcon
        v-else-if="tab.isBoard"
        name="pencil"
        :size="12"
        :stroke="2"
        class="text-brand"
      />
      <UiStatusDot
        v-else-if="tab.node"
        :status="tab.node.status"
        :size="7"
      />

      <span
        :class="[
          'max-w-[188px] overflow-hidden text-[13px] font-semibold text-ellipsis',
        ]"
        >{{ tab.title }}</span
      >

      <button
        type="button"
        title="Close tab"
        :aria-label="`Close ${tab.title}`"
        class="grid size-[18px] shrink-0 cursor-pointer place-items-center rounded-[6px] text-[#b4b8c2] dark:text-text-faint transition-colors hover:bg-surface-track hover:text-text-soft"
        @click.stop="emit('close', tab.id)"
      >
        <UiIcon
          name="x"
          :size="10"
          :stroke="2.4"
        />
      </button>
    </div>

    <div class="flex-1" />
  </div>
</template>
