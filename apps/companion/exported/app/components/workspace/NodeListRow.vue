<script setup lang="ts">
import type { ProgressState } from '~/types/api'
import type { TreeItem } from '~/composables/useRoadmap'

/**
 * One subtopic row in the sidebar list: indented by depth, badged by mark,
 * tinted by progress — the same three facts the map draws, in a row.
 */
const props = defineProps<{
  item: TreeItem
  activeNodeId: number | null
  /** Open in a background tab. */
  open: boolean
}>()

const emit = defineEmits<{
  open: [nodeId: number]
  progress: [nodeId: number, state: ProgressState]
}>()

const node = computed(() => props.item.node)
const mark = computed(() => lessonMark(node.value))
const active = computed(() => node.value.id === props.activeNodeId)
const state = computed(() => progressOf(node.value))

const title = computed(() =>
  [node.value.title, mark.value ? MARK_META[mark.value].label : null, node.value.group ? `in ${node.value.group}` : null]
    .filter(Boolean)
    .join(' — '),
)

function onContextMenu(event: MouseEvent): void {
  event.preventDefault()
  emit('progress', node.value.id, state.value === 'completed' ? 'available' : 'completed')
}
</script>

<template>
  <button
    type="button"
    :class="[
      'flex min-h-[28px] w-full cursor-pointer items-center gap-2 rounded-[10px] py-1 pr-2 text-left transition-colors',
      item.depth === 2 ? 'pl-[54px]' : 'pl-[40px]',
      active ? 'bg-accent-soft' : 'hover:bg-surface-mute',
    ]"
    :title="title"
    :aria-current="active ? 'true' : undefined"
    @click="emit('open', node.id)"
    @contextmenu="onContextMenu"
  >
    <!-- The badge, or a plain dot where there is none, so titles line up. -->
    <span
      v-if="mark"
      class="grid size-[13px] shrink-0 place-items-center rounded-full"
      :style="{ background: MARK_META[mark].color }"
    >
      <svg
        viewBox="0 0 24 24"
        width="8"
        height="8"
        fill="none"
        :stroke="MARK_META[mark].ink"
        stroke-width="3.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m20 6.5-11 11L4 12.5" />
      </svg>
    </span>
    <span
      v-else
      class="mx-[4.5px] size-[4px] shrink-0 rounded-full bg-[#c3c6cf] dark:bg-text-ghost"
    />

    <span
      :class="[
        'min-w-0 flex-1 truncate text-[12.5px] leading-[1.3]',
        active ? 'font-semibold text-text' : 'text-text-soft',
        state === 'completed' && 'line-through text-text-faint',
        state === 'skipped' && 'line-through text-text-ghost',
        state === 'in_progress' && 'underline decoration-lime-2 decoration-2 underline-offset-[3px]',
      ]"
      >{{ node.title }}</span
    >

    <span
      v-if="open && !active"
      class="size-[5px] shrink-0 rounded-full bg-border-dashed"
      title="Open in a background tab"
    />

    <UiStatusDot
      :status="node.status"
      :size="7"
      still
    />
  </button>
</template>
