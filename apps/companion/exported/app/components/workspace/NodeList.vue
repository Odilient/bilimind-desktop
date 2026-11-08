<script setup lang="ts">
import type { CourseNode, ProgressState } from '~/types/api'
import type { TreeItem, TreeStep } from '~/composables/useRoadmap'
import { markOf } from '~/components/companion/course/Mark.vue'

/**
 * The course structure as a list: the roadmap's table of contents.
 *
 * The order is the course, so the topics are numbered and flat, with a chapter
 * heading where one opens. What hangs off a topic is folded under it — open the
 * topic and its subtopics appear, indented, each with the same coloured badge it
 * wears on the map. Nothing here says "optional" in words: the map has a legend
 * for the badges, and the list uses the badges.
 *
 * There used to be a "Rec" / "Opt" chip on every side lesson here, and it read
 * like two kinds of the same thing because it was. The topic containing the
 * open lesson is unfolded for you; the rest stay folded so seventy lessons read
 * as fourteen steps.
 *
 * Progress is painted the way the map paints it: done is struck through,
 * learning is underlined, skipped is struck through and dimmed. And it is set
 * the same way — right-click a row to mark it done.
 *
 * The companion's course sidebar asks for four more things, all optional and
 * all off by default, so the old workspace's list is exactly what it was:
 *
 *  - `filter`: only the steps whose title (or a subtopic's) contains it, with
 *    their chapter headings, every match unfolded;
 *  - `foldChapters`: a chapter heading folds its steps away. Open are the
 *    chapters named in `openChapters` (this week, the unit being worked on)
 *    and the one holding the open lesson; the rest fold until clicked;
 *  - `currentChapter`: that heading wears a small "Now";
 *  - `writable`: a lesson not written yet offers "Write" on hover, which emits
 *    `write` instead of opening its brief first.
 */
const props = defineProps<{
  nodes: CourseNode[]
  /** Node currently in the foreground tab. */
  activeNodeId: number | null
  /** Every node that has a tab open, foreground or not. */
  openNodeIds: number[]
  filter?: string
  foldChapters?: boolean
  openChapters?: string[]
  currentChapter?: string | null
  writable?: boolean
  /** Steps recalled in a check: their mark is the filled leaf. */
  checkedIds?: number[]
}>()

const emit = defineEmits<{
  open: [nodeId: number]
  progress: [nodeId: number, state: ProgressState]
  write: [nodeId: number]
}>()

const openSet = computed(() => new Set(props.openNodeIds))
const checked = computed(() => new Set(props.checkedIds ?? []))

const tree = computed(() => courseTree(props.nodes))

/* -- Chapters and the filter (both optional) ------------------------------- */

const needle = computed(() => (props.filter ?? '').trim().toLowerCase())

/** Each step's chapter: the last heading at or above it. */
const chapterOf = computed(() => {
  const out = new Map<number, string | null>()
  let chapter: string | null = null
  for (const step of tree.value.steps) {
    if (step.opens) chapter = step.opens
    out.set(step.node.id, chapter)
  }
  return out
})

function matches(step: TreeStep): boolean {
  if (!needle.value) return true
  return [step.node, ...clusterOf(step).map((item) => item.node)].some((node) =>
    node.title.toLowerCase().includes(needle.value),
  )
}

const chapterFolded = ref(new Set<string>())
const chapterUnfolded = ref(new Set<string>())

const activeChapter = computed(() => {
  const step = tree.value.steps.find((s) => s.step === activeStep.value)
  return step ? (chapterOf.value.get(step.node.id) ?? null) : null
})

function chapterOpen(chapter: string | null): boolean {
  if (!props.foldChapters || !chapter || needle.value) return true
  if (chapterFolded.value.has(chapter)) return false
  return (
    chapterUnfolded.value.has(chapter) ||
    chapter === activeChapter.value ||
    (props.openChapters ?? []).includes(chapter)
  )
}

function toggleChapter(chapter: string): void {
  const open = chapterOpen(chapter)
  const folded = new Set(chapterFolded.value)
  const unfolded = new Set(chapterUnfolded.value)
  if (open) {
    folded.add(chapter)
    unfolded.delete(chapter)
  } else {
    folded.delete(chapter)
    unfolded.add(chapter)
  }
  chapterFolded.value = folded
  chapterUnfolded.value = unfolded
}

/** The steps to draw, each with the heading to draw above it (when it opens a chapter here). */
const visible = computed(() => {
  const out: { step: TreeStep; heading: string | null; shown: boolean }[] = []
  let last: string | null | undefined
  for (const step of tree.value.steps) {
    if (!matches(step)) continue
    const chapter = chapterOf.value.get(step.node.id) ?? null
    const heading = chapter !== last ? chapter : null
    last = chapter
    out.push({ step, heading: needle.value || props.foldChapters ? heading : step.opens, shown: chapterOpen(chapter) })
  }
  return out
})

/** How many steps a folded chapter holds, and how many are done. */
function chapterCount(chapter: string): string {
  const steps = tree.value.steps.filter((s) => chapterOf.value.get(s.node.id) === chapter)
  const done = steps.filter((s) => progressOf(s.node) === 'completed').length
  return done ? `${done}/${steps.length}` : String(steps.length)
}

/** Topics the learner has folded or unfolded by hand; the active topic is unfolded unless folded by hand. */
const folded = ref(new Set<number>())
const unfolded = ref(new Set<number>())

const activeStep = computed(() =>
  props.activeNodeId === null ? null : (tree.value.stepOf.get(props.activeNodeId) ?? null),
)

function isOpen(step: TreeStep): boolean {
  if (needle.value && step.items.length) return true
  if (folded.value.has(step.node.id)) return false
  return unfolded.value.has(step.node.id) || step.step === activeStep.value
}

function toggle(step: TreeStep): void {
  const open = isOpen(step)
  const nextFolded = new Set(folded.value)
  const nextUnfolded = new Set(unfolded.value)
  if (open) {
    nextFolded.add(step.node.id)
    nextUnfolded.delete(step.node.id)
  } else {
    nextFolded.delete(step.node.id)
    nextUnfolded.add(step.node.id)
  }
  folded.value = nextFolded
  unfolded.value = nextUnfolded
}

/** A topic's whole cluster, depth first, for the count. */
function clusterOf(step: TreeStep): TreeItem[] {
  return step.items.flatMap((item) => [item, ...item.children])
}

function doneIn(step: TreeStep): number {
  return clusterOf(step).filter((item) => progressOf(item.node) === 'completed').length
}

function stateClass(node: CourseNode): string {
  const state = progressOf(node)
  // The mark says done and learning; only a skipped step is struck through.
  if (state === 'skipped') return 'line-through text-text-faint'
  return ''
}

function onContextMenu(node: CourseNode, event: MouseEvent): void {
  event.preventDefault()
  emit('progress', node.id, progressOf(node) === 'completed' ? 'available' : 'completed')
}
</script>

<template>
  <div class="pt-1.5">
    <template
      v-for="{ step, heading, shown } in visible"
      :key="step.node.id"
    >
      <!-- A chapter heading that folds its steps (the companion's sidebar). -->
      <button
        v-if="heading && foldChapters"
        type="button"
        class="group/chapter mt-1.5 flex min-h-[30px] w-full cursor-pointer items-center gap-1.5 rounded-[10px] pr-2 pl-0.5 text-left transition-colors first:mt-0 hover:bg-surface-mute focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
        :aria-expanded="chapterOpen(heading)"
        :title="heading"
        @click="toggleChapter(heading)"
      >
        <span class="grid size-5 shrink-0 place-items-center text-text-faint transition-colors group-hover/chapter:text-text-soft">
          <UiIcon
            name="chevron-down"
            :size="12"
            :stroke="2.2"
            :class="['transition-transform duration-150', !chapterOpen(heading) && '-rotate-90']"
          />
        </span>
        <span class="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-text-soft">{{ heading }}</span>
        <span
          v-if="heading === currentChapter"
          class="shrink-0 rounded-full bg-accent-soft px-1.5 py-px text-[10.5px] font-semibold text-accent-strong"
        >Now</span>
        <span
          v-else-if="!chapterOpen(heading)"
          class="num shrink-0 text-[11.5px] text-text-faint"
        >{{ chapterCount(heading) }}</span>
      </button>

      <!-- A chapter heading, where one opens. -->
      <p
        v-else-if="heading"
        class="mt-2 truncate px-1.5 pt-2.5 pb-1.5 text-[12px] font-semibold text-text-muted first:mt-0"
        :title="heading"
      >
        {{ heading }}
      </p>

      <div
        v-if="shown"
        :class="[
          'group/step flex min-h-[30px] w-full items-center gap-1 rounded-[8px] py-0.5 pr-2 pl-0.5 transition-colors',
          step.node.id === activeNodeId ? 'bg-accent-soft' : 'hover:bg-surface-mute',
        ]"
      >
        <!-- The fold. Only topics with a cluster have one; the rest keep the space. -->
        <button
          v-if="step.items.length"
          type="button"
          class="grid size-5 shrink-0 cursor-pointer place-items-center rounded-[6px] text-text-faint transition-colors hover:bg-surface-track hover:text-text-soft"
          :aria-label="isOpen(step) ? 'Fold this step' : 'Unfold this step'"
          :aria-expanded="isOpen(step)"
          @click.stop="toggle(step)"
        >
          <UiIcon
            name="chevron-down"
            :size="12"
            :stroke="2.2"
            :class="['transition-transform', !isOpen(step) && '-rotate-90']"
          />
        </button>
        <span
          v-else
          class="size-5 shrink-0"
        />

        <button
          type="button"
          class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
          :aria-current="step.node.id === activeNodeId ? 'true' : undefined"
          :title="step.node.title"
          @click="emit('open', step.node.id)"
          @contextmenu="onContextMenu(step.node, $event)"
        >
          <!-- Daylight's topic row: its place on the line, then its status mark. -->
          <span class="num w-4 shrink-0 text-right text-[11px] font-semibold text-text-faint">{{ step.step }}</span>
          <CompanionCourseMark :state="markOf(step.node, checked.has(step.node.id))" />

          <span
            :class="[
              'min-w-0 flex-1 truncate text-[13.5px] leading-[1.3]',
              step.node.id === activeNodeId
                ? 'font-semibold text-text'
                : step.node.status === 'stub'
                  ? 'text-text-muted'
                  : 'text-text-body',
              stateClass(step.node),
            ]"
            >{{ step.node.title }}</span
          >

          <UiStatusDot
            :status="step.node.status"
            :size="7"
            still
          />

          <!-- Folded, the count says what is inside; unfolded, the rows do. -->
          <span
            v-if="step.items.length && !isOpen(step)"
            class="num w-[22px] shrink-0 text-right text-[11.5px] text-text-faint"
            :title="`${clusterOf(step).length} under this step`"
            >{{ doneIn(step) ? `${doneIn(step)}/` : '' }}{{ clusterOf(step).length }}</span
          >
          <span
            v-else
            :class="[
              'num w-[22px] shrink-0 text-right text-[11.5px] text-text-faint',
              writable && step.node.status === 'stub' && 'group-hover/step:hidden',
            ]"
            >{{ step.node.estimated_minutes }}m</span
          >
        </button>

        <!-- Not written yet: the quiet way to have it written, on hover. -->
        <button
          v-if="writable && step.node.status === 'stub'"
          type="button"
          class="hidden h-6 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-surface px-2 text-[11.5px] font-semibold text-text-soft shadow-[inset_0_0_0_1px_var(--border)] transition-colors group-hover/step:flex hover:text-text focus-visible:flex"
          :title="`Write the lesson on ${step.node.title}`"
          @click.stop="emit('write', step.node.id)"
        >
          <UiIcon
            name="wand"
            :size="11"
            :stroke="2"
          />
          Write
        </button>
      </div>

      <template v-if="shown && isOpen(step)">
        <template
          v-for="item in step.items"
          :key="item.node.id"
        >
          <WorkspaceNodeListRow
            :item="item"
            :active-node-id="activeNodeId"
            :open="openSet.has(item.node.id)"
            @open="emit('open', $event)"
            @progress="(id, state) => emit('progress', id, state)"
          />
          <WorkspaceNodeListRow
            v-for="child in item.children"
            :key="child.node.id"
            :item="child"
            :active-node-id="activeNodeId"
            :open="openSet.has(child.node.id)"
            @open="emit('open', $event)"
            @progress="(id, state) => emit('progress', id, state)"
          />
        </template>
      </template>
    </template>
  </div>
</template>
