<script setup lang="ts">
import type { Block, CourseNode, Material, MaterialStatus } from '~/types/api'
import { formatIcon } from '~/components/materials/presentation'

/**
 * The Materials panel: what the learner put in, and where it ended up.
 *
 * "Which nodes drew on this file" is the part worth building. Retrieval is
 * lexical (§7), so a chunk about "wintering" will not surface for a node about
 * "cold-weather survival" — and when a file appears to have been ignored, the
 * learner deserves to see that plainly rather than assume the upload failed.
 */
const props = defineProps<{
  materials: Material[]
  nodes: CourseNode[]
  /** Blocks already loaded for open nodes, used to attribute materials. */
  blocksByNode: Record<number, Block[]>
}>()

const emit = defineEmits<{ add: []; open: [nodeId: number] }>()

const STATUS: Record<MaterialStatus, { dot: string; label: string }> = {
  ready: { dot: 'bg-lime-2', label: 'Ready' },
  processing: { dot: 'bg-brand animate-pulse-dot', label: 'Extracting' },
  pending: { dot: 'bg-border-dashed', label: 'Queued' },
  failed: { dot: 'bg-danger', label: 'Failed' },
  // Not the danger colour: nothing went wrong, the file just cannot be read
  // without the owner's help.
  needs_input: { dot: 'bg-warn', label: 'Needs you' },
}

/**
 * Nodes that cite each material. Only counts nodes whose blocks we have
 * actually loaded — claiming "used by 0 nodes" for a node nobody has opened
 * would be a lie dressed up as data.
 */
const usage = computed(() => {
  const byMaterial = new Map<number, Set<number>>()

  for (const [nodeId, blocks] of Object.entries(props.blocksByNode)) {
    for (const block of blocks) {
      for (const materialId of block.source_material_ids ?? []) {
        const set = byMaterial.get(materialId) ?? new Set<number>()
        set.add(Number(nodeId))
        byMaterial.set(materialId, set)
      }
    }
  }

  return byMaterial
})

const inspected = computed(() => Object.keys(props.blocksByNode).length)

function usedBy(materialId: number): CourseNode[] {
  const ids = usage.value.get(materialId)
  if (!ids) return []
  return props.nodes.filter((node) => ids.has(node.id))
}

/** Terminal and unusable. The panel is too narrow to fix it; it says where to. */
function stuck(material: Material): boolean {
  return material.status === 'needs_input' || material.status === 'failed'
}

function summary(material: Material): string {
  if (stuck(material)) {
    return material.failure_reason ?? "BiliMind couldn't read this one."
  }
  if (material.status !== 'ready') return 'Still being read…'

  const nodes = usedBy(material.id)
  if (nodes.length > 0) {
    return `${material.format_label} · used by ${lessons(nodes.length)} you have open`
  }
  if (inspected.value === 0) {
    return `${material.format_label} · open a lesson to see where it was used`
  }
  return `${material.format_label} · not used by any lesson you have open yet`
}
</script>

<template>
  <div class="px-1.5 py-2.5">
    <p
      v-if="materials.length === 0"
      class="rounded-[14px] bg-surface px-3.5 py-4 text-[12.5px] leading-relaxed text-text-soft shadow-[inset_0_0_0_1px_var(--border)]"
    >
      No files on this course yet. Add your own slides or notes and BiliMind will teach from them,
      quoting them back to you instead of inventing an example.
    </p>

    <div
      v-for="material in materials"
      :key="material.id"
      class="mb-2 rounded-[14px] bg-surface px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--border)]"
    >
      <div class="flex items-center gap-2">
        <span
          class="grid size-[22px] shrink-0 place-items-center rounded-[7px] bg-brand-soft text-brand"
          :title="material.format_label"
        >
          <UiIcon
            :name="formatIcon(material.format)"
            :size="12"
          />
        </span>
        <span
          class="min-w-0 flex-1 truncate text-[12.5px]"
          :title="material.title"
          >{{ material.title }}</span
        >
        <span
          :class="['size-[7px] shrink-0 rounded-full', STATUS[material.status].dot]"
          :title="STATUS[material.status].label"
        />
      </div>

      <p
        :class="[
          'mt-1.5 text-[11px] leading-snug',
          material.status === 'failed'
            ? 'text-danger'
            : material.status === 'needs_input'
              ? 'text-warn-text'
              : 'text-text-faint',
        ]"
      >
        {{ summary(material) }}
      </p>

      <!--
        A stuck file gets the place it is fixable. This panel is 274px wide and
        the ask is a paragraph of typing, so the honest move is to name the door
        rather than to cram the form in here.
      -->
      <NuxtLink
        v-if="stuck(material)"
        :to="`/materials?material=${material.id}`"
        class="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand hover:underline"
      >
        {{ material.wants === 'transcript' ? 'Paste the transcript' : 'Sort it out' }}
        <UiIcon
          name="arrow-right"
          :size="11"
        />
      </NuxtLink>

      <div
        v-if="usedBy(material.id).length"
        class="mt-2 flex flex-wrap gap-1"
      >
        <button
          v-for="node in usedBy(material.id)"
          :key="node.id"
          type="button"
          class="max-w-full cursor-pointer truncate rounded-full bg-brand-soft px-2 py-[3px] text-[11px] font-medium text-brand transition-colors hover:bg-[#e1e7fd] dark:hover:bg-brand-line"
          @click="emit('open', node.id)"
        >
          {{ node.title }}
        </button>
      </div>
    </div>

    <button
      type="button"
      class="mt-1 w-full cursor-pointer rounded-[14px] border-[1.5px] border-dashed border-border-dashed py-2.5 text-[12.5px] font-semibold text-text-soft transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand"
      @click="emit('add')"
    >
      + Add material
    </button>
  </div>
</template>
