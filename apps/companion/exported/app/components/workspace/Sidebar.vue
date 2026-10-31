<script setup lang="ts">
import type { Block, CourseNode, Material, ProgressState } from '~/types/api'
import type { SidebarView } from '~/composables/useWorkspace'

/**
 * The left panel: three views of the same course.
 *
 * Nodes is the default because it is the only one that works before anything
 * else exists — a freshly outlined course has no schedule and often no
 * materials, and §8 is explicit that "structure exists, nothing expanded" is
 * what most courses look like most of the time.
 */
defineProps<{
  courseId: number
  nodes: CourseNode[]
  materials: Material[]
  blocksByNode: Record<number, Block[]>
  minutesPerWeek?: number | null
  activeNodeId: number | null
  openNodeIds: number[]
  mapOpen: boolean
}>()

const emit = defineEmits<{
  open: [nodeId: number]
  openMap: []
  addMaterial: []
  progress: [nodeId: number, state: ProgressState]
}>()

const view = defineModel<SidebarView>('view', { required: true })

const options = [
  { value: 'nodes', label: 'Lessons' },
  { value: 'plan', label: 'Plan' },
  { value: 'files', label: 'Files' },
]

const viewProxy = computed({
  get: () => view.value as string,
  set: (value: string) => {
    view.value = value as SidebarView
  },
})
</script>

<template>
  <aside
    class="flex w-[268px] shrink-0 flex-col border-r border-border bg-surface-chrome"
    aria-label="Course structure"
  >
    <div class="flex items-center gap-2 pt-4 pr-3.5 pb-3 pl-[18px]">
      <span class="font-display text-[15px] font-semibold tracking-[-0.01em]">Course</span>
      <span class="flex-1" />
      <button
        type="button"
        title="Open the roadmap"
        :class="[
          'flex h-[30px] cursor-pointer items-center gap-1.5 rounded-[10px] px-3 text-[12.5px] font-semibold transition-colors',
          mapOpen
            ? 'bg-accent-soft text-accent-strong shadow-[inset_0_0_0_1px_rgb(141_181_30/0.45)]'
            : 'bg-surface text-text shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.1)] hover:bg-surface-mute',
        ]"
        @click="emit('openMap')"
      >
        <UiIcon
          name="map"
          :size="13"
          :stroke="1.9"
        />
        Map
      </button>
    </div>

    <div class="px-3.5 pb-3">
      <UiSegmented
        v-model="viewProxy"
        :options="options"
        size="sm"
        block
        label="Course view"
      />
    </div>

    <div class="om-scroll min-h-0 flex-1 overflow-y-auto px-2.5 pb-4">
      <WorkspaceNodeList
        v-if="view === 'nodes'"
        :nodes="nodes"
        :active-node-id="activeNodeId"
        :open-node-ids="openNodeIds"
        @open="emit('open', $event)"
        @progress="(id, state) => emit('progress', id, state)"
      />

      <WorkspacePlanPanel
        v-else-if="view === 'plan'"
        :course-id="courseId"
        :minutes-per-week="minutesPerWeek"
        :node-count="nodes.length"
        :active-node-id="activeNodeId"
        @open="emit('open', $event)"
      />

      <WorkspaceFilesPanel
        v-else
        :materials="materials"
        :nodes="nodes"
        :blocks-by-node="blocksByNode"
        @add="emit('addMaterial')"
        @open="emit('open', $event)"
      />
    </div>
  </aside>
</template>
