<script setup lang="ts">
import type { CourseNode, FurtherCourse, ProgressState } from '~/types/api'
import type { TreeItem } from '~/composables/useRoadmap'

/**
 * The roadmap on a phone.
 *
 * The board's geometry does not survive 390px, but its grammar does, and the
 * grammar is all that matters: one numbered line you follow downward, with what
 * each topic covers indented under it — the badges saying which are options,
 * the groups keeping their heading, the notes staying beside their topic, and
 * the violet buttons at the end. So the phone gets the same roadmap with the
 * drawing removed: no zooming, no panning, no pinch-to-read. The ink is the
 * board's: dark milestones for topics, light cards for what hangs off them.
 *
 * `courseTree` is shared with the desktop board, so the two can never disagree
 * about what the course is. Tapping a box opens its brief (`focus`), not the
 * lesson — the sheet has the button for that.
 */
const props = defineProps<{
  nodes: CourseNode[]
  activeNodeId: number | null
  further?: FurtherCourse[]
}>()

const emit = defineEmits<{
  focus: [nodeId: number]
  progress: [nodeId: number, state: ProgressState]
  further: [link: FurtherCourse]
}>()

const tree = computed(() => courseTree(props.nodes))

const counts = computed(() => {
  let done = 0
  for (const entry of tree.value.flat) if (progressOf(entry.node) === 'completed') done++
  return { done, total: tree.value.flat.length }
})

const percent = computed(() =>
  counts.value.total === 0 ? 0 : Math.round((counts.value.done / counts.value.total) * 100),
)

/** How far down the line the learner has actually got. */
const activeStep = computed(() =>
  props.activeNodeId === null ? null : (tree.value.stepOf.get(props.activeNodeId) ?? null),
)

/**
 * A topic's cluster as the rows the phone draws: a group heading followed by
 * its members, a family as the item then its children one indent further,
 * loose items on their own. Reading order is the map's.
 */
type Row =
  | { kind: 'heading'; key: string; text: string }
  | { kind: 'item'; key: string; item: TreeItem; depth: 1 | 2; inGroup: boolean }

function rowsOf(items: TreeItem[]): Row[] {
  const rows: Row[] = []
  const seenGroups = new Set<string>()

  for (const item of items) {
    const group = String(item.node.group ?? '').trim()
    if (group !== '' && !seenGroups.has(group)) {
      const members = items.filter((other) => String(other.node.group ?? '').trim() === group)
      if (members.length > 1) {
        seenGroups.add(group)
        rows.push({ kind: 'heading', key: `g-${item.node.id}`, text: group })
        for (const member of members) {
          rows.push({ kind: 'item', key: String(member.node.id), item: member, depth: 1, inGroup: true })
          for (const child of member.children) {
            rows.push({ kind: 'item', key: String(child.node.id), item: child, depth: 2, inGroup: true })
          }
        }
        continue
      }
    }
    if (group !== '' && seenGroups.has(group)) continue

    rows.push({ kind: 'item', key: String(item.node.id), item, depth: 1, inGroup: false })
    for (const child of item.children) {
      rows.push({ kind: 'item', key: String(child.node.id), item: child, depth: 2, inGroup: false })
    }
  }

  return rows
}

const endLinks = computed(() => {
  const keys = new Set(tree.value.steps.map((step) => step.node.key))
  return (props.further ?? []).filter((link) => !link.after_key || !keys.has(link.after_key))
})

function linksBeside(key: string): FurtherCourse[] {
  return (props.further ?? []).filter((link) => link.after_key === key)
}

/** The topic card: white ahead, pale blue once done, an outline while being learned. */
function topicClass(node: CourseNode): string {
  const state = progressOf(node)
  if (state === 'completed') return 'border-brand-line bg-brand-soft text-text-muted'
  if (state === 'in_progress') return 'border-brand bg-surface text-brand'
  if (state === 'skipped') return 'border-dashed border-border-dashed bg-surface text-text-ghost'
  return 'border-[rgb(var(--wash-rgb)/0.2)] bg-surface text-text shadow-[0_6px_14px_-10px_rgb(11_13_16/0.35)]'
}

function itemClass(node: CourseNode): string {
  const state = progressOf(node)
  if (state === 'completed') return 'border-brand-line bg-brand-soft text-text-muted line-through'
  if (state === 'in_progress') return 'border-brand bg-surface text-brand'
  if (state === 'skipped') return 'border-dashed border-border-dashed bg-transparent text-text-ghost line-through'
  return 'border-[rgb(var(--wash-rgb)/0.12)] bg-surface text-text-body'
}

function onContextMenu(node: CourseNode, event: MouseEvent): void {
  event.preventDefault()
  emit('progress', node.id, progressOf(node) === 'completed' ? 'available' : 'completed')
}
</script>

<template>
  <div class="px-5 pt-1.5 pb-8">
    <h1 class="mt-2 text-[26px] tracking-[-0.03em] t-head">Your roadmap</h1>
    <p class="mt-1.5 text-[13.5px] leading-snug text-text-soft">
      {{ tree.steps.length }} {{ tree.steps.length === 1 ? 'topic' : 'topics' }}<template
        v-if="counts.total - tree.steps.length"
      >
        and {{ counts.total - tree.steps.length }} subtopics</template
      >. Work down the line — you are
      {{ activeStep ? `on step ${activeStep}` : 'at the start' }}.
    </p>

    <div class="mt-3.5 flex items-center gap-2.5">
      <span class="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-track">
        <span
          class="block h-full rounded-full bg-cobalt transition-[width] duration-400"
          :style="{ width: `${percent}%` }"
        />
      </span>
      <span class="num text-[12px] font-semibold text-text-body">{{ percent }}% · {{ counts.done }}/{{ counts.total }}</span>
    </div>

    <!-- The legend. Colour alone teaches nobody. -->
    <div class="mt-3.5 mb-5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[12px] text-text-soft">
      <span
        v-for="mark in MARK_ORDER"
        :key="mark"
        class="inline-flex items-center gap-1.5"
      >
        <i
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
            aria-hidden="true"
          >
            <path d="m20 6.5-11 11L4 12.5" />
          </svg>
        </i>
        {{ MARK_META[mark].label }}
      </span>
      <span class="text-text-faint">Tap a box to see what it covers.</span>
    </div>

    <div
      v-for="step in tree.steps"
      :key="step.node.id"
      class="flex gap-3"
    >
      <!-- The line. Its only job is to say "this comes after that". -->
      <div class="relative w-6.5 shrink-0">
        <span
          class="absolute top-0 left-1/2 h-[13px] w-[3px] -translate-x-1/2 rounded-[2px]"
          :class="step.step === 1 ? 'bg-transparent' : 'bg-[#cdd0d8] dark:bg-text-ghost'"
        />
        <span
          v-if="step.step < tree.steps.length || endLinks.length"
          class="absolute top-[13px] bottom-0 left-1/2 w-[3px] -translate-x-1/2 rounded-[2px]"
          :class="
            progressOf(step.node) === 'completed'
              ? 'w-[5px]! bg-cobalt'
              : 'bg-[#cdd0d8] dark:bg-text-ghost'
          "
        />
        <span
          :class="[
            'num absolute top-[1px] left-1/2 z-1 grid size-6 -translate-x-1/2 place-items-center rounded-full font-display text-[11px] font-semibold',
            progressOf(step.node) === 'completed'
              ? 'bg-cobalt text-white dark:bg-brand-strong'
              : step.node.id === activeNodeId || progressOf(step.node) === 'in_progress'
                ? 'bg-lime text-ink ring-4 ring-brand-line'
                : progressOf(step.node) === 'skipped'
                  ? 'border-[1.5px] border-dashed border-border-dashed bg-surface text-text-ghost'
                  : 'bg-surface-sunken text-text-dim',
          ]"
        >
          <UiIcon
            v-if="progressOf(step.node) === 'completed'"
            name="check"
            :size="13"
            :stroke="2.6"
          />
          <template v-else>{{ step.step }}</template>
        </span>
      </div>

      <div class="min-w-0 flex-1 pb-3">
        <p
          v-if="step.opens"
          class="mb-2 inline-flex h-6 items-center rounded-full bg-surface px-3 text-[10.5px] font-semibold tracking-[0.08em] text-text-soft uppercase shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.14)]"
        >
          {{ step.opens }}
        </p>

        <!-- The topic -->
        <button
          type="button"
          :class="[
            'flex w-full cursor-pointer items-center gap-3 rounded-[12px] border-[1.5px] px-3.5 py-3 text-left transition-colors',
            topicClass(step.node),
            step.node.id === activeNodeId && 'ring-4 ring-[rgb(198_242_78/0.75)]',
          ]"
          @click="emit('focus', step.node.id)"
          @contextmenu="onContextMenu(step.node, $event)"
        >
          <span class="min-w-0 flex-1">
            <span
              :class="[
                'block text-[14.5px] leading-[1.3] font-semibold',
                progressOf(step.node) === 'completed' && 'line-through',
                progressOf(step.node) === 'skipped' && 'line-through',
              ]"
              >{{ step.node.title }}</span
            >
            <span class="mt-0.5 block text-[10.5px] opacity-60">
              {{ nodeStatusStyle(step.node.status).label }} · {{ step.node.estimated_minutes }} min
            </span>
          </span>
          <UiIcon
            name="chevron-right"
            :size="15"
            class="shrink-0 opacity-50"
          />
        </button>

        <!-- The note beside it -->
        <p
          v-if="step.node.note"
          class="mt-2 flex gap-2 rounded-[10px] bg-warn-soft px-3 py-2 text-[12.5px] leading-snug text-warn-text shadow-[inset_0_0_0_1px_var(--warn-line)]"
        >
          <UiIcon
            name="sparkles"
            :size="14"
            :stroke="1.8"
            class="mt-px shrink-0 text-warn-bright"
          />
          <span>{{ step.node.note }}</span>
        </p>

        <!-- Its cluster, one indent in -->
        <template
          v-for="row in rowsOf(step.items)"
          :key="row.key"
        >
          <p
            v-if="row.kind === 'heading'"
            class="mt-3 mb-1.5 pl-5 text-[10.5px] font-semibold tracking-[0.08em] text-text-faint uppercase"
          >
            {{ row.text }}
          </p>
          <div
            v-else
            class="relative mt-1.5"
            :class="row.depth === 2 ? 'pl-9' : 'pl-5'"
          >
            <span
              class="absolute top-1/2 left-0 h-0 -translate-y-1/2 border-t-[1.5px] border-dashed border-[#9da2ae] dark:border-text-ghost"
              :class="row.depth === 2 ? 'w-8' : 'w-3.5'"
            />
            <button
              type="button"
              :class="[
                'flex w-full cursor-pointer items-center gap-2.5 rounded-[9px] border px-3 py-2 text-left transition-colors',
                itemClass(row.item.node),
                row.item.node.id === activeNodeId && 'ring-4 ring-[rgb(198_242_78/0.75)]',
              ]"
              @click="emit('focus', row.item.node.id)"
              @contextmenu="onContextMenu(row.item.node, $event)"
            >
              <i
                v-if="lessonMark(row.item.node)"
                class="grid size-[13px] shrink-0 place-items-center rounded-full"
                :style="{ background: MARK_META[lessonMark(row.item.node)!].color }"
                :title="MARK_META[lessonMark(row.item.node)!].label"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="8"
                  height="8"
                  fill="none"
                  :stroke="MARK_META[lessonMark(row.item.node)!].ink"
                  stroke-width="3.2"
                  stroke-linecap="round"
                  aria-hidden="true"
                >
                  <path d="m20 6.5-11 11L4 12.5" />
                </svg>
              </i>
              <span class="min-w-0 flex-1 text-[13px] leading-[1.3]">{{ row.item.node.title }}</span>
              <span class="num shrink-0 text-[10.5px] opacity-60">{{ row.item.node.estimated_minutes }}m</span>
            </button>
          </div>
        </template>

        <button
          v-for="link in linksBeside(step.node.key)"
          :key="link.title"
          type="button"
          class="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-brand-soft px-3 py-2 text-[13px] font-semibold text-brand"
          @click="emit('further', link)"
        >
          {{ link.title }}
          <UiIcon
            name="arrow-up-right"
            :size="13"
            :stroke="2.2"
          />
        </button>
      </div>
    </div>

    <!-- Where to go from here -->
    <div
      v-if="endLinks.length"
      class="mt-1 ml-[31px] rounded-[14px] bg-surface p-3 shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.12)]"
    >
      <p class="mb-2 text-center text-[11px] font-semibold tracking-[0.08em] text-text-faint uppercase">
        Where to go from here
      </p>
      <button
        v-for="link in endLinks"
        :key="link.title"
        type="button"
        class="mb-1.5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-brand-soft px-3 py-2 text-[13px] font-semibold text-brand last:mb-0"
        @click="emit('further', link)"
      >
        {{ link.title }}
        <UiIcon
          name="arrow-up-right"
          :size="13"
          :stroke="2.2"
        />
      </button>
    </div>
    <div
      v-else-if="tree.steps.length"
      :class="[
        'mt-1 ml-[31px] inline-flex h-10 items-center gap-2 rounded-full pr-4 pl-2 font-display text-[14px] font-semibold',
        percent === 100
          ? 'bg-lime text-ink shadow-[0_0_0_6px_rgb(198_242_78/0.35)]'
          : 'bg-surface text-text-faint shadow-[inset_0_0_0_1.5px_#d9dce4]',
      ]"
    >
      <span
        :class="[
          'grid size-[26px] place-items-center rounded-full',
          percent === 100 ? 'bg-chip text-lime' : 'bg-surface-track',
        ]"
      >
        <UiIcon
          name="check"
          :size="12"
          :stroke="3"
        />
      </span>
      {{ percent === 100 ? 'Finished.' : 'The finish line' }}
    </div>
  </div>
</template>
