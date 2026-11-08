<script setup lang="ts">
import type { CourseNode, FurtherCourse, ProgressState } from '~/types/api'
import type { TreeItem } from '~/composables/useRoadmap'
import { markOf } from '~/components/companion/course/Mark.vue'

/**
 * The roadmap on a phone.
 *
 * The board's geometry does not survive 390px, but its grammar does, and the
 * grammar is all that matters: one numbered line you follow downward, with what
 * each topic covers indented under it — the badges saying which are options,
 * the groups keeping their heading, the notes staying beside their topic, and
 * the violet buttons at the end. So the phone gets the same roadmap with the
 * drawing removed: no zooming, no panning, no pinch-to-read. The look is the
 * board's: topic cards with their status marks, paper chips for what hangs off them.
 *
 * `courseTree` is shared with the desktop board, so the two can never disagree
 * about what the course is. Tapping a box opens its brief (`focus`), not the
 * lesson — the sheet has the button for that.
 */
const props = defineProps<{
  nodes: CourseNode[]
  activeNodeId: number | null
  further?: FurtherCourse[]
  /** Steps recalled in a check: the filled leaf mark. */
  checkedIds?: number[]
}>()

const emit = defineEmits<{
  focus: [nodeId: number]
  progress: [nodeId: number, state: ProgressState]
  further: [link: FurtherCourse]
}>()

const tree = computed(() => courseTree(props.nodes))
const checked = computed(() => new Set(props.checkedIds ?? []))

/** The step the learner is on: the one learning, else the first not finished. */
const hereId = computed(() => {
  const steps = tree.value.steps
  return (
    steps.find((s) => progressOf(s.node) === 'in_progress')?.node.id ??
    steps.find((s) => progressOf(s.node) === null)?.node.id ??
    null
  )
})

/** The hop below a step is solid once the step is behind the learner, dotted ahead. */
function behind(node: CourseNode): boolean {
  const state = progressOf(node)
  return state === 'completed' || checked.value.has(node.id)
}

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

function onContextMenu(node: CourseNode, event: MouseEvent): void {
  event.preventDefault()
  emit('progress', node.id, progressOf(node) === 'completed' ? 'available' : 'completed')
}
</script>

<template>
  <!-- The path on a phone, in the desktop's grammar (course.html at 390px): one column of
       topic cards, a short line between each, centred on them, solid behind you and dotted
       ahead; what a topic covers as paper chips under it; notes in butter. -->
  <div class="px-4 pt-1.5 pb-8">
    <!-- The head above already draws how far along the course is; this says it of the path. -->
    <p class="mt-2 text-[12.5px] leading-snug text-text-muted">
      {{ tree.steps.length }} {{ tree.steps.length === 1 ? 'topic' : 'topics' }}<template
        v-if="counts.total - tree.steps.length"
      >
        and {{ counts.total - tree.steps.length }} subtopics</template
      >, {{ counts.done }} done ({{ percent }}%){{ activeStep ? `, you're on step ${activeStep}` : '' }}. Tap one to see what it covers.
    </p>

    <!-- The legend: the badges, and the marks. -->
    <div class="mt-3 mb-4 grid gap-1.5 text-[12px] font-medium text-text-muted">
      <span class="flex flex-wrap gap-x-3.5 gap-y-1">
        <span
          v-for="mark in MARK_ORDER"
          :key="mark"
          class="inline-flex items-center gap-1.5"
        >
          <i
            class="size-2 shrink-0 rounded-[3px]"
            :style="{ background: MARK_META[mark].color }"
          />
          {{ MARK_META[mark].label }}
        </span>
      </span>
      <span class="flex flex-wrap gap-x-3.5 gap-y-1">
        <span class="inline-flex items-center gap-1.5"><CompanionCourseMark state="checked" />Checked</span>
        <span class="inline-flex items-center gap-1.5"><CompanionCourseMark state="done" />Read</span>
        <span class="inline-flex items-center gap-1.5"><CompanionCourseMark state="learning" />Learning</span>
        <span class="inline-flex items-center gap-1.5"><CompanionCourseMark state="todo" />Not started</span>
      </span>
    </div>

    <template
      v-for="(step, index) in tree.steps"
      :key="step.node.id"
    >
      <!-- A chapter opens: a pill on the line. -->
      <div
        v-if="step.opens"
        class="relative flex justify-center py-2"
      >
        <span
          v-if="index > 0"
          :class="['rm-hop absolute inset-y-0 left-1/2', behind(tree.steps[index - 1]!.node) && 'rm-hop--past']"
        />
        <span class="relative inline-flex h-6 max-w-full items-center truncate rounded-full bg-surface px-[11px] text-[11.5px] font-semibold text-text-muted shadow-[0_0_0_1px_var(--border-strong)]">
          {{ step.opens }}
        </span>
      </div>
      <div
        v-else-if="index > 0"
        class="relative h-3"
      >
        <span :class="['rm-hop absolute inset-y-0 left-1/2', behind(tree.steps[index - 1]!.node) && 'rm-hop--past']" />
      </div>

      <!-- The topic -->
      <button
        type="button"
        :class="[
          'rm-node relative flex min-h-[44px] w-full cursor-pointer items-center gap-2 rounded-[10px] py-2 pr-2.5 pl-3 text-left text-[14px] font-semibold tracking-[-0.01em]',
          step.node.id === hereId && 'rm-node--here',
          behind(step.node) && step.node.id !== hereId && 'rm-node--past',
          progressOf(step.node) === 'skipped' && 'rm-node--skip',
          step.node.id === activeNodeId && 'rm-node--active',
        ]"
        @click="emit('focus', step.node.id)"
        @contextmenu="onContextMenu(step.node, $event)"
      >
        <CompanionCourseMark :state="markOf(step.node, checked.has(step.node.id))" />
        <span class="min-w-0 flex-1 leading-[1.3]">
          <span
            :class="['block', progressOf(step.node) === 'skipped' && 'line-through']"
          >{{ step.node.title }}</span>
          <span class="mt-px block text-[11.5px] font-medium opacity-60">
            {{ nodeStatusStyle(step.node.status).label }} · {{ step.node.estimated_minutes }} min
          </span>
        </span>
        <span class="num shrink-0 text-[11px] font-bold opacity-45">{{ step.step }}</span>
      </button>

      <!-- The note beside it -->
      <p
        v-if="step.node.note"
        class="relative mt-1.5 flex gap-2 rounded-[11px] bg-butter-soft px-3 py-2 text-[12.5px] leading-snug text-text-soft shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--butter-ink)_18%,transparent)]"
      >
        <UiIcon
          name="sparkles"
          :size="14"
          :stroke="1.8"
          class="mt-px shrink-0 text-butter-ink"
        />
        <span>{{ step.node.note }}</span>
      </p>

      <!-- What it covers: paper chips, a group under its own heading. -->
      <div
        v-if="step.items.length"
        class="relative mt-1.5 flex flex-wrap gap-1.5"
      >
        <template
          v-for="row in rowsOf(step.items)"
          :key="row.key"
        >
          <p
            v-if="row.kind === 'heading'"
            class="mt-1 w-full text-[12px] font-semibold text-text-muted"
          >
            {{ row.text }}
          </p>
          <button
            v-else
            type="button"
            :class="[
              'flex min-h-[30px] max-w-full cursor-pointer items-center gap-[7px] rounded-[9px] px-2.5 py-1 text-left text-[12.5px] font-medium shadow-[0_0_0_1px_var(--border)] transition-colors',
              progressOf(row.item.node) === 'completed'
                ? 'bg-[color-mix(in_oklab,var(--leaf-soft)_55%,var(--surface))] text-text-soft'
                : progressOf(row.item.node) === 'skipped'
                  ? 'bg-transparent text-text-faint line-through'
                  : 'bg-bg text-text-soft',
              row.depth === 2 && 'ml-3',
              row.item.node.id === activeNodeId && 'shadow-[0_0_0_2px_var(--sky)]',
            ]"
            @click="emit('focus', row.item.node.id)"
            @contextmenu="onContextMenu(row.item.node, $event)"
          >
            <i
              v-if="lessonMark(row.item.node)"
              class="size-2 shrink-0 rounded-[3px]"
              :style="{ background: MARK_META[lessonMark(row.item.node)!].color }"
              :title="MARK_META[lessonMark(row.item.node)!].label"
            />
            <span class="min-w-0">{{ row.item.node.title }}</span>
          </button>
        </template>
      </div>

      <button
        v-for="link in linksBeside(step.node.key)"
        :key="link.title"
        type="button"
        class="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-sky-soft px-3 py-2 text-[13px] font-semibold text-sky-ink"
        @click="emit('further', link)"
      >
        {{ link.title }}
        <UiIcon
          name="arrow-up-right"
          :size="13"
          :stroke="2.2"
        />
      </button>
    </template>

    <!-- Where to go from here -->
    <div
      v-if="endLinks.length"
      class="mt-4 rounded-[14px] bg-surface p-3 shadow-[0_0_0_1px_var(--border)]"
    >
      <p class="mb-2 text-center text-[12px] font-semibold text-text-muted">
        Where to go from here
      </p>
      <button
        v-for="link in endLinks"
        :key="link.title"
        type="button"
        class="mb-1.5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-sky-soft px-3 py-2 text-[13px] font-semibold text-sky-ink last:mb-0"
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
    <template v-else-if="tree.steps.length">
      <div class="relative h-3">
        <span :class="['rm-hop absolute inset-y-0 left-1/2', behind(tree.steps.at(-1)!.node) && 'rm-hop--past']" />
      </div>
      <div class="flex justify-center">
        <span
          :class="[
            'inline-flex h-[30px] items-center gap-2 rounded-full pr-3.5 pl-1.5 text-[13px] font-semibold',
            percent === 100
              ? 'bg-leaf-soft text-leaf-ink shadow-[0_0_0_1.5px_var(--leaf)]'
              : 'bg-surface text-text-muted shadow-[0_0_0_1px_var(--border-strong)]',
          ]"
        >
          <span
            :class="[
              'grid size-5 place-items-center rounded-full',
              percent === 100 ? 'bg-leaf text-white' : 'bg-[rgb(var(--wash-rgb)/0.065)]',
            ]"
          >
            <UiIcon
              name="check"
              :size="11"
              :stroke="3"
            />
          </span>
          {{ percent === 100 ? 'Finished.' : 'The finish line' }}
        </span>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* A hop of the line: 2px, centred exactly on the column (margin, not a transform, so it never lands on a half pixel). */
.rm-hop {
  width: 2px;
  margin-left: -1px;
  background: repeating-linear-gradient(var(--text-faint) 0 2px, transparent 2px 7px);
}

.rm-hop--past {
  background: var(--text-muted);
}

/* course.html's .node.topic */
.rm-node {
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 0 0 1px var(--border-strong), var(--shadow-card);
  transition:
    background-color 200ms,
    box-shadow 250ms,
    transform 300ms var(--ease);
}

.rm-node:active {
  transform: scale(0.99);
}

.rm-node--past {
  background: color-mix(in oklab, var(--leaf-soft) 55%, var(--surface));
}

.rm-node--skip {
  color: var(--text-faint);
  box-shadow: none;
  outline: 1.5px dashed var(--border-dashed);
  outline-offset: -1.5px;
}

.rm-node--here {
  background: var(--accent);
  color: var(--on-accent);
  box-shadow:
    0 0 0 1px color-mix(in oklab, var(--hi-2) 80%, var(--accent-strong)),
    0 10px 24px -10px rgb(150 110 0 / 0.55);
}

@media (prefers-reduced-motion: no-preference) {
  .rm-node--here::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    animation: rm-pulse 1.4s ease-out 0.9s 3;
  }
}

@keyframes rm-pulse {
  from {
    box-shadow: 0 0 0 0 rgb(255 214 90 / 0.9);
  }
  to {
    box-shadow: 0 0 0 11px rgb(255 214 90 / 0);
  }
}

.rm-node--active {
  box-shadow:
    0 0 0 2px var(--sky),
    var(--shadow-raised);
}
</style>
