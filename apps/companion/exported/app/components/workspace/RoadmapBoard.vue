<script setup lang="ts">
import type { CourseNode, FurtherCourse, ProgressState } from '~/types/api'
import type { ItemBox, TopicBox } from '~/composables/useRoadmap'
import { markOf } from '~/components/companion/course/Mark.vue'

/**
 * The course as a roadmap, in roadmap.sh's grammar and the workspace's ink.
 *
 * `useRoadmap` decides where everything goes; this file's only job is to make
 * each kind of box look like what it is, using the same tokens as the rest of
 * the app, because the drawing is worthless if a subtopic can be mistaken for
 * the next topic:
 *
 *  - a TOPIC is a card on the line (Daylight's `.cp-node`): its status mark,
 *    its title and its number; the step the learner is on is the yellow one;
 *  - a SUBTOPIC is a paper chip tied back with a dotted curve, a small
 *    coloured square saying which badge it wears;
 *  - a GROUP is a sunken panel with an eyebrow heading around the subtopics
 *    that are one family; a FAMILY is a subtopic on top of a panel of its own
 *    members;
 *  - a NOTE is a warm paper card — advice, not a lesson;
 *  - a LINK is a soft violet button that starts a new course.
 *
 * Progress is painted onto the box with the same status marks the sidebar
 * uses (`CompanionCourseMark`): a read or checked topic takes a leaf tint so
 * the path visibly clears behind you, skipped goes hollow and dashed. The
 * line is solid behind the learner and dotted ahead.
 *
 * Clicking a box does NOT open the lesson. It opens a small brief — what the
 * lesson is for, what it covers, what comes next — and the brief has the one
 * button that opens it. roadmap.sh's marking gestures still work as shortcuts:
 * right-click marks done, shift-click marks learning, alt-click skips.
 *
 * The canvas is laid out at a fixed width, cropped to what is drawn on it and
 * scaled to fit the pane it is in, so the whole map is readable without a
 * horizontal scrollbar on a laptop and never wider than it needs to be.
 */
const props = defineProps<{
  nodes: CourseNode[]
  activeNodeId: number | null
  /** The course title, drawn at the head of the line. */
  title?: string | null
  /** Where to go next — the violet buttons. */
  further?: FurtherCourse[]
  /** Node ids currently selected for expansion, if a selection is in progress. */
  selectedIds?: number[]
  /** A read-only rendering: nothing opens and nothing can be marked. */
  readonly?: boolean
  /** Steps recalled in a check: the filled leaf mark (the companion's courses). */
  checkedIds?: number[]
  /** The brief offers "Write it yourself" (the page handles `compose`). */
  canCompose?: boolean
  /**
   * The lesson the host's own Continue opens (the companion's course head). Given,
   * "You are here" marks it and the bar draws no Continue of its own: two buttons
   * naming two different lessons was the bug. `null`: the host has nothing next.
   */
  hereNodeId?: number | null
}>()

const emit = defineEmits<{
  open: [nodeId: number]
  /** A lesson that is not written yet: the learner asked for it to be. */
  expand: [nodeId: number, instruction?: string]
  /** A lesson that is not written yet: the learner will write it themselves. */
  compose: [nodeId: number]
  /** The learner marked a box. `state` is the state it should now be in. */
  progress: [nodeId: number, state: ProgressState]
  /** A violet button: start a new course on this topic. */
  further: [link: FurtherCourse]
}>()

const roadmap = useRoadmap(
  () => props.nodes,
  () => ({ title: props.title, further: props.further }),
)

const nodesById = computed(() => new Map(props.nodes.map((node) => [node.id, node])))
const checked = computed(() => new Set(props.checkedIds ?? []))

/* -- Hover ---------------------------------------------------------------- */

/** The node id under the cursor. Every drawn lesson box is a lesson, so this is never synthetic. */
const hovered = ref<number | null>(null)

/** The topic whose cluster the hovered box belongs to: the only "related" thing worth lighting. */
const litTopic = computed(() => {
  const id = hovered.value
  if (id === null) return null
  return roadmap.value.itemById.get(id)?.topicId ?? (roadmap.value.topicById.has(id) ? id : null)
})

/** Which tie lights: the one reaching the hovered box, or all of a hovered topic's. */
function tieLit(tie: { topicId: number; targetId: number | string }): boolean {
  const id = hovered.value
  if (id === null) return false
  if (id === tie.topicId) return true
  const item = roadmap.value.itemById.get(id)
  if (!item) return false
  // A tie reaches a row, a group or a family; the hovered item may sit inside any of them.
  const target = String(tie.targetId)
  return (
    tie.targetId === id ||
    target === `family-${item.parentId}` ||
    target === `family-${item.id}` ||
    (target.startsWith(`group-${item.topicId}-${String(item.node.group ?? '')}`) && !!item.node.group) ||
    (target.startsWith(`row-${item.topicId}-`) && rowOf(item) === target)
  )
}

/** The row id a paired item belongs to — the pair is keyed by its first item. */
function rowOf(item: ItemBox): string | null {
  const twin = roadmap.value.items.find(
    (other) =>
      other.topicId === item.topicId &&
      other.y === item.y &&
      other.depth === item.depth &&
      other.parentId === item.parentId &&
      other.id !== item.id,
  )
  const first = twin && twin.x < item.x ? twin : item
  return `row-${item.topicId}-${first.id}`
}

const selected = computed(() => new Set(props.selectedIds ?? []))

/* -- Progress ------------------------------------------------------------- */

type Tint = 'done' | 'learning' | 'skipped' | null

function tintOf(node: CourseNode): Tint {
  const state = progressOf(node)
  if (state === 'completed') return 'done'
  if (state === 'in_progress') return 'learning'
  if (state === 'skipped') return 'skipped'
  return null
}

/* -- The brief ------------------------------------------------------------ */

/**
 * The lesson whose brief is showing. `peekId` outlives `peekOpen` on purpose:
 * the dialog fades out over a few frames, and clearing the id at once would
 * empty the card while it is still visible.
 */
const peekId = ref<number | null>(null)
const peekOpen = ref(false)

const peekNode = computed(() => (peekId.value === null ? null : (nodesById.value.get(peekId.value) ?? null)))

function peek(nodeId: number): void {
  peekId.value = nodeId
  peekOpen.value = true
}

function openFromBrief(nodeId: number): void {
  peekOpen.value = false
  emit('open', nodeId)
}

function writeFromBrief(nodeId: number, instruction?: string): void {
  peekOpen.value = false
  emit('expand', nodeId, instruction)
}

function composeFromBrief(nodeId: number): void {
  peekOpen.value = false
  emit('compose', nodeId)
}

/**
 * roadmap.sh's gestures, verbatim, as shortcuts. Each one toggles: marking a
 * done box done again returns it to pending, which is how an accidental
 * right-click is undone without a menu. A plain click opens the brief.
 */
function onClick(node: CourseNode, event: MouseEvent): void {
  if (!props.readonly && event.shiftKey) {
    emit('progress', node.id, progressOf(node) === 'in_progress' ? 'available' : 'in_progress')
    return
  }
  if (!props.readonly && event.altKey) {
    emit('progress', node.id, progressOf(node) === 'skipped' ? 'available' : 'skipped')
    return
  }
  peek(node.id)
}

function onContextMenu(node: CourseNode, event: MouseEvent): void {
  if (props.readonly) return
  event.preventDefault()
  emit('progress', node.id, progressOf(node) === 'completed' ? 'available' : 'completed')
}

function onKey(node: CourseNode, event: KeyboardEvent): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    peek(node.id)
  } else if (!props.readonly && event.key.toLowerCase() === 'd') {
    emit('progress', node.id, progressOf(node) === 'completed' ? 'available' : 'completed')
  }
}

function boxTitle(node: CourseNode, topic?: TopicBox): string {
  const bits = [node.title]
  const mark = lessonMark(node)
  if (mark) bits.push(MARK_META[mark].label)
  bits.push(`${nodeStatusStyle(node.status).label}, ${node.estimated_minutes} min`)
  if (topic) bits.push(`Step ${topic.step}`)
  const state = progressOf(node)
  if (state) bits.push(state === 'completed' ? 'Done' : state === 'in_progress' ? 'Learning' : 'Skipped')
  return bits.join(' — ')
}

/* -- Fit to the pane -------------------------------------------------------- */

const frame = ref<HTMLElement | null>(null)
const scale = ref(1)

/** Below this the labels stop being readable; past it the pane scrolls instead. */
const MIN_SCALE = 0.62

/**
 * The part of the canvas anything is drawn in, side to side. The layout keeps
 * both flanks whether or not a step has subtopics there; a course with none is
 * one line down the middle and is shown at full size, not scaled down for
 * empty margins.
 */
const extent = computed(() => {
  const r = roadmap.value
  const boxes: { x: number; width: number }[] = [
    ...r.topics, ...r.items, ...r.groups, ...r.notes, ...r.links, ...r.labels,
    ...(r.title ? [r.title] : []), ...(r.finish ? [r.finish] : []), ...(r.finishPill ? [r.finishPill] : []),
  ]
  if (!boxes.length) return { left: 0, width: r.width }
  const pad = 24
  const left = Math.max(0, Math.min(...boxes.map((b) => b.x)) - pad)
  const right = Math.min(r.width, Math.max(...boxes.map((b) => b.x + b.width)) + pad)
  return { left, width: right - left }
})

function fit(): void {
  if (!frame.value) return
  const available = frame.value.clientWidth - 16
  if (available <= 0) return
  scale.value = Math.max(MIN_SCALE, Math.min(1, available / extent.value.width))
}

let observer: ResizeObserver | null = null

onMounted(() => {
  fit()
  if (typeof ResizeObserver !== 'undefined' && frame.value) {
    observer = new ResizeObserver(() => fit())
    observer.observe(frame.value)
  }
})

onBeforeUnmount(() => observer?.disconnect())

watch(() => extent.value.width, () => fit())

const percent = computed(() =>
  roadmap.value.counts.total === 0
    ? 0
    : Math.round((roadmap.value.counts.done / roadmap.value.counts.total) * 100),
)

const START_Y = METRICS.pad

const LEGEND = [
  { state: 'checked', label: 'Checked from memory' },
  { state: 'done', label: 'Read' },
  { state: 'learning', label: 'Learning' },
  { state: 'todo', label: 'Not started' },
] as const

/**
 * Where the learner is on the line, the way the course player marks it: the
 * topic being learned, else the first one not yet finished. Nothing finished
 * and nothing started reads "Start here" rather than claiming progress.
 */
const here = computed<{ topic: TopicBox; started: boolean } | null>(() => {
  if (props.readonly) return null
  const topics = roadmap.value.topics
  const id = props.hereNodeId
  if (id != null) {
    // A subtopic's lesson is marked on the topic it hangs from.
    const hostTopic = roadmap.value.topicById.get(roadmap.value.itemById.get(id)?.topicId ?? id)
    if (hostTopic) return { topic: hostTopic, started: roadmap.value.counts.done > 0 || tintOf(hostTopic.node) !== null }
  }
  const learning = topics.find((topic) => tintOf(topic.node) === 'learning')
  const topic = learning ?? topics.find((item) => tintOf(item.node) === null)
  if (!topic) return null
  return { topic, started: !!learning || roadmap.value.counts.done > 0 }
})
</script>

<template>
  <div class="rm">
    <!-- The bar over the path (course.html .legend): what it is, the badges and the status
         marks in words, how far along, and the way back in. -->
    <div class="sticky top-0 z-5 grid gap-2 border-b border-border bg-surface/94 px-[30px] py-2.5 backdrop-blur-[8px]">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span class="num text-[12.5px] text-text-muted">
          {{ roadmap.counts.topics }} {{ roadmap.counts.topics === 1 ? 'topic' : 'topics' }}<template
            v-if="roadmap.counts.subtopics"
          >
            · {{ roadmap.counts.subtopics }} subtopics</template
          >
          · {{ minutesLabel(roadmap.counts.minutes) }}
        </span>

        <div
          v-if="!readonly && roadmap.counts.total"
          class="flex items-center gap-2 text-[12px]"
          :title="`${roadmap.counts.done} of ${roadmap.counts.total} done${roadmap.counts.learning ? `, ${roadmap.counts.learning} learning` : ''}`"
        >
          <span class="h-1.5 w-[90px] overflow-hidden rounded-full bg-[rgb(var(--wash-rgb)/0.065)]">
            <span
              class="block h-full rounded-full bg-leaf transition-[width] duration-500"
              :style="{ width: `${percent}%` }"
            />
          </span>
          <span class="num font-semibold text-text-soft">{{ percent }}% done</span>
        </div>

        <span class="flex-1" />

        <!-- The way back in, naming the step, unless the host has its own Continue. -->
        <button
          v-if="here && hereNodeId === undefined"
          type="button"
          class="group inline-flex h-[30px] max-w-[min(100%,340px)] cursor-pointer items-center gap-1.5 rounded-[8px] bg-inverse px-3 text-[13px] font-semibold text-on-inverse transition-[background-color,transform] duration-200 hover:bg-inverse-hover active:scale-[0.97]"
          :title="here.topic.node.title"
          @click="emit('open', here.topic.id)"
        >
          <span class="min-w-0 truncate">{{ here.started ? 'Continue' : 'Start' }} · {{ here.topic.node.title }}</span>
          <UiIcon
            name="arrow-right"
            :size="14"
            :stroke="2.2"
            class="shrink-0 transition-transform group-hover:translate-x-0.5"
          />
        </button>
      </div>

      <div class="flex flex-wrap justify-between gap-x-4 gap-y-1.5 text-[12px] font-medium text-text-muted">
        <span
          class="flex flex-wrap gap-x-3.5 gap-y-1"
          aria-label="Badges"
        >
          <span
            v-for="mark in MARK_ORDER"
            :key="mark"
            class="inline-flex items-center gap-1.5"
            :title="MARK_META[mark].blurb"
          >
            <i
              class="size-2 shrink-0 rounded-[3px]"
              :style="{ background: MARK_META[mark].color }"
            />
            {{ MARK_META[mark].label }}
          </span>
        </span>
        <span
          v-if="!readonly"
          class="flex flex-wrap gap-x-3.5 gap-y-1"
          aria-label="Status"
        >
          <span
            v-for="m in LEGEND"
            :key="m.state"
            class="inline-flex items-center gap-1.5"
          >
            <CompanionCourseMark :state="m.state" />
            {{ m.label }}
          </span>
        </span>
      </div>
    </div>

    <div
      v-if="nodes.length === 0"
      class="py-16 text-center text-[13.5px] text-text-muted"
    >
      The plan has not been drawn yet.
    </div>

    <!-- The canvas, scaled to the pane. The outer box takes the scaled height
         so the pane's scrollbar is honest about how long the map is. -->
    <div
      v-else
      ref="frame"
      class="rm-desk flex justify-center overflow-x-auto px-2 py-2"
    >
      <div
        class="overflow-hidden"
        :style="{ width: `${extent.width * scale}px`, height: `${roadmap.height * scale}px` }"
      >
        <div
          class="rm-canvas fade-in relative origin-top-left select-none"
          :style="{
            width: `${roadmap.width}px`,
            height: `${roadmap.height}px`,
            transform: `scale(${scale}) translateX(${-extent.left}px)`,
          }"
        >
          <svg
            :width="roadmap.width"
            :height="roadmap.height"
            class="absolute inset-0 overflow-visible"
            aria-hidden="true"
          >
            <!-- The dotted lead-in above the title, and the tail after the end. -->
            <path
              :d="roadmap.lead"
              class="rm-lead"
            />
            <path
              :d="roadmap.tail"
              class="rm-lead"
            />

            <!-- Where it starts. -->
            <circle
              :cx="roadmap.spineX"
              :cy="START_Y"
              r="5"
              class="rm-start"
            />

            <!-- Ties first, so the line always draws over them. -->
            <path
              v-for="t in roadmap.ties"
              :key="t.id"
              :d="t.path"
              :class="['rm-tie', tieLit(t) && 'rm-tie--lit']"
            />

            <!-- The line. One hop per pair of topics, drawn in on arrival and
                 filled green once the topic above it is finished. -->
            <path
              v-for="(segment, index) in roadmap.spine"
              :key="segment.id"
              :d="segment.path"
              :pathLength="segment.done ? 1 : undefined"
              :class="['rm-rail', segment.done && 'rm-rail--done']"
              :style="{ '--i': index }"
            />
          </svg>

          <!-- The title, at the head of the line. -->
          <h2
            v-if="roadmap.title"
            class="rm-title absolute text-center text-[22px] leading-[26px] tracking-[-0.02em] t-head text-text"
            :style="{
              left: `${roadmap.title.x}px`,
              top: `${roadmap.title.y}px`,
              width: `${roadmap.title.width}px`,
            }"
          >
            <span
              v-for="(line, index) in roadmap.title.lines"
              :key="index"
              class="block"
              ><span class="rm-title__line">{{ line }}</span></span
            >
          </h2>

          <!-- Chapter headings sit ON the line as pills, so a chapter reads as
               a milestone on the walk rather than as a caption floating near one. -->
          <div
            v-for="label in roadmap.labels"
            :key="label.id"
            class="pointer-events-none absolute flex items-center justify-center"
            :style="{
              left: `${label.x}px`,
              top: `${label.y}px`,
              width: `${label.width}px`,
              height: `${label.height}px`,
            }"
          >
            <span
              class="inline-flex h-6 max-w-full items-center truncate rounded-full bg-surface px-[11px] text-[11.5px] font-semibold text-text-muted shadow-[0_0_0_1px_var(--border-strong)]"
              :title="`Steps ${label.fromStep}–${label.fromStep + label.steps - 1}`"
              >{{ label.text }}</span
            >
          </div>

          <!-- Groups and families: the sunken panels. Behind the items. -->
          <div
            v-for="group in roadmap.groups"
            :key="group.id"
            :class="['rm-group absolute', litTopic === group.topicId && 'rm-group--lit']"
            :style="{
              left: `${group.x}px`,
              top: `${group.y}px`,
              width: `${group.width}px`,
              height: `${group.height}px`,
            }"
          >
            <p
              v-if="group.kind === 'group'"
              class="truncate px-3 pt-[9px] text-[11.5px] font-semibold text-text-muted"
              :title="group.title ?? undefined"
            >
              {{ group.title }}
            </p>
          </div>

          <!-- Notes: the mentor's aside. Text, not a lesson. -->
          <div
            v-for="note in roadmap.notes"
            :key="note.id"
            class="rm-note absolute"
            :style="{
              left: `${note.x}px`,
              top: `${note.y}px`,
              width: `${note.width}px`,
              height: `${note.height}px`,
            }"
            :title="note.text"
          >
            <UiIcon
              name="sparkles"
              :size="14"
              :stroke="1.8"
              class="rm-note__icon"
            />
            <span
              class="block overflow-hidden"
              :style="{ display: '-webkit-box', '-webkit-box-orient': 'vertical', '-webkit-line-clamp': note.lines.length }"
              >{{ note.text }}</span
            >
          </div>

          <!-- Subtopics. Every one is a real lesson: click shows its brief. -->
          <button
            v-for="item in roadmap.items"
            :key="item.id"
            type="button"
            :class="[
              'rm-item absolute text-[13px] leading-[17px]',
              tintOf(item.node) && `rm-item--${tintOf(item.node)}`,
              item.id === activeNodeId && 'rm-box--active',
              selected.has(item.id) && 'rm-box--selected',
              hovered === item.topicId && 'rm-item--kin',
              peekOpen && item.id === peekId && 'rm-box--peek',
            ]"
            :style="{
              left: `${item.x}px`,
              top: `${item.y}px`,
              width: `${item.width}px`,
              height: `${item.height}px`,
            }"
            :title="boxTitle(item.node, roadmap.topicById.get(item.topicId))"
            :aria-current="item.id === activeNodeId ? 'true' : undefined"
            @mouseenter="hovered = item.id"
            @mouseleave="hovered = null"
            @focus="hovered = item.id"
            @blur="hovered = null"
            @click="onClick(item.node, $event)"
            @contextmenu="onContextMenu(item.node, $event)"
            @keydown="onKey(item.node, $event)"
          >
            <i
              v-if="item.mark"
              class="rm-bd"
              :style="{ background: MARK_META[item.mark].color }"
              :title="`${MARK_META[item.mark].label} — ${MARK_META[item.mark].blurb}`"
            />
            <span
              class="rm-label"
              :style="{ '-webkit-line-clamp': item.lines.length }"
              >{{ item.node.title }}</span
            >

            <!-- Being written (a beating dot) or waiting its turn (a ring). -->
            <span
              v-if="isWorking(item.node.status)"
              :class="['rm-writing', item.node.status === 'queued' && 'rm-writing--queued']"
              aria-hidden="true"
            />
          </button>

          <!-- Topics. Numbered, because their place on the line is the answer to "where am I". -->
          <button
            v-for="(topic, index) in roadmap.topics"
            :key="topic.id"
            type="button"
            :class="[
              'rm-topic rise absolute text-[14px] leading-[18px] font-semibold',
              readonly && 'rm-topic--ink',
              tintOf(topic.node) && `rm-topic--${tintOf(topic.node)}`,
              here?.topic.id === topic.id && 'rm-topic--here',
              checked.has(topic.id) && 'rm-topic--checked',
              topic.id === activeNodeId && 'rm-box--active',
              selected.has(topic.id) && 'rm-box--selected',
              peekOpen && topic.id === peekId && 'rm-box--peek',
            ]"
            :style="{
              left: `${topic.x}px`,
              top: `${topic.y}px`,
              width: `${topic.width}px`,
              height: `${topic.height}px`,
              '--d': `${Math.min(index, 14) * 40}ms`,
            }"
            :title="boxTitle(topic.node, topic)"
            :aria-current="topic.id === activeNodeId ? 'true' : undefined"
            @mouseenter="hovered = topic.id"
            @mouseleave="hovered = null"
            @focus="hovered = topic.id"
            @blur="hovered = null"
            @click="onClick(topic.node, $event)"
            @contextmenu="onContextMenu(topic.node, $event)"
            @keydown="onKey(topic.node, $event)"
          >
            <!-- course.html's node: its status mark, the title, its number on the line. -->
            <CompanionCourseMark
              v-if="!readonly"
              :state="markOf(topic.node, checked.has(topic.id))"
            />
            <span
              class="rm-label"
              :style="{ '-webkit-line-clamp': topic.lines.length }"
              >{{ topic.node.title }}</span
            >
            <span class="rm-nn num">{{ topic.step }}</span>

            <span
              v-if="isWorking(topic.node.status)"
              :class="['rm-writing', topic.node.status === 'queued' && 'rm-writing--queued']"
              aria-hidden="true"
            />
          </button>

          <!-- "You are here": the course player's tag, straddling the top edge
               of the step the learner is on. -->
          <span
            v-if="here"
            class="rm-here pointer-events-none absolute"
            :style="{ left: `${here.topic.x + 10}px`, top: `${here.topic.y - 11}px` }"
          >
            {{ here.started ? 'You are here' : 'Start here' }}
          </span>

          <!-- Where to go from here: the box at the end. -->
          <div
            v-if="roadmap.finish"
            class="absolute rounded-[12px] bg-surface shadow-[0_0_0_1px_var(--border)]"
            :style="{
              left: `${roadmap.finish.x}px`,
              top: `${roadmap.finish.y}px`,
              width: `${roadmap.finish.width}px`,
              height: `${roadmap.finish.height}px`,
            }"
          >
            <p class="pt-[9px] text-center text-[12px] font-semibold text-text-muted">
              {{ roadmap.finish.title }}
            </p>
          </div>

          <span
            v-if="roadmap.finishPill"
            :class="['rm-finish pointer-events-none absolute', percent === 100 && 'rm-finish--lit']"
            :style="{
              left: `${roadmap.finishPill.x}px`,
              top: `${roadmap.finishPill.y}px`,
              width: `${roadmap.finishPill.width}px`,
              height: `${roadmap.finishPill.height}px`,
            }"
          >
            <span class="rm-finish__ck">
              <UiIcon
                name="check"
                :size="11"
                :stroke="3"
              />
            </span>
            {{ percent === 100 ? 'Finished.' : 'The finish line' }}
          </span>

          <!-- The cobalt chips: each one starts a new course. -->
          <button
            v-for="link in roadmap.links"
            :key="link.id"
            type="button"
            class="rm-link absolute px-3 text-center text-[13px] font-semibold"
            :style="{
              left: `${link.x}px`,
              top: `${link.y}px`,
              width: `${link.width}px`,
              height: `${link.height}px`,
            }"
            :title="`Start a new course: ${link.link.topic}`"
            :disabled="readonly"
            @click="emit('further', link.link)"
          >
            <span class="truncate">{{ link.lines[0] }}</span>
            <UiIcon
              name="arrow-up-right"
              :size="13"
              :stroke="2.2"
              class="shrink-0"
            />
          </button>
        </div>
      </div>
    </div>

    <!-- The brief: what a clicked lesson is for, and the one button that opens it. -->
    <UiModal
      v-model:open="peekOpen"
      size="md"
    >
      <WorkspaceNodeBrief
        v-if="peekNode"
        :node="peekNode"
        :nodes="nodes"
        :readonly="readonly"
        :can-compose="canCompose"
        @open="openFromBrief"
        @expand="writeFromBrief"
        @compose="composeFromBrief"
        @focus="peekId = $event"
        @progress="(id, state) => emit('progress', id, state)"
      />
      <div class="absolute top-2.5 right-2.5">
        <UiBtn
          variant="ghost"
          size="sm"
          square
          icon="x"
          label="Close"
          @click="peekOpen = false"
        />
      </div>
    </UiModal>
  </div>
</template>

<style scoped>
/*
 * Daylight 2's path (docs/design/daylight2/css/04-cycler.css .cp-*, course.css
 * .road): the line is drawn on the page itself, no canvas grid. A topic is a
 * card with its status mark, its title and its number on the line; the step
 * the learner is on is the one yellow (highlighter) card, and it pulses on
 * arrival. Read and checked steps take a leaf tint, so the path visibly clears
 * behind you. Subtopics are paper chips tied back with dotted curves, a little
 * square saying which badge they wear. The line is solid ink behind the
 * learner and dotted ahead. A readonly board (a public course nobody is on)
 * keeps ink milestones.
 */

.rm-desk {
  background: var(--surface);
}

/* The title sits on the line; a page-coloured backing cuts the line out. */
.rm-title__line {
  padding: 2px 10px;
  border-radius: 8px;
  background: var(--surface);
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

/* -- Lines ---------------------------------------------------------------- */

.rm-lead {
  fill: none;
  stroke: var(--text-faint);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-dasharray: 2 6;
}

.rm-start {
  fill: var(--surface);
  stroke: var(--text-muted);
  stroke-width: 2;
}

.rm-tie {
  fill: none;
  stroke: var(--border-strong);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-dasharray: 1 4;
  transition:
    stroke 150ms,
    stroke-width 150ms;
}

.rm-tie--lit {
  stroke: var(--brand);
  stroke-width: 2;
  stroke-dasharray: none;
}

/* Ahead: dotted. */
.rm-rail {
  fill: none;
  stroke: var(--text-faint);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-dasharray: 2 6;
  transition: stroke 300ms;
}

/* Where the learner has already been: solid ink. */
.rm-rail--done {
  stroke: var(--text-muted);
  stroke-dasharray: none;
}

@media (prefers-reduced-motion: no-preference) {
  .rm-rail--done {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: rm-draw 460ms var(--ease) forwards;
    animation-delay: calc(var(--i, 0) * 55ms);
  }
}

@keyframes rm-draw {
  to {
    stroke-dashoffset: 0;
  }
}

/* -- Boxes ---------------------------------------------------------------- */

.rm-topic,
.rm-item {
  display: flex;
  align-items: center;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 200ms,
    color 200ms,
    box-shadow 250ms,
    transform 300ms var(--ease);
}

/* A lesson being written pulses; waiting its turn, a hollow ring. */
.rm-writing {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--brand);
  box-shadow: 0 0 0 2px var(--surface);
  animation: pulse-dot 1.2s ease-in-out infinite;
  pointer-events: none;
}

.rm-writing--queued {
  border: 1.5px solid var(--brand);
  background: var(--surface);
  animation: none;
}

/* A topic: course.html's .node.topic. */
.rm-topic {
  gap: 8px;
  padding: 0 10px 0 12px;
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font-size: 13.5px;
  font-weight: 650;
  letter-spacing: -0.01em;
  box-shadow: 0 0 0 1px var(--border-strong), var(--shadow-card);
}

.rm-topic .rm-label {
  flex: 1;
}

.rm-nn {
  flex: none;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-faint);
}

.rm-topic:hover {
  transform: translateY(-1px);
  box-shadow: 0 0 0 1px var(--border-strong), var(--shadow-raised);
}

/* A course nobody is on (a public page): the ink milestone, centred. */
.rm-topic--ink {
  justify-content: center;
  text-align: center;
  background: var(--inverse);
  color: var(--on-inverse);
  box-shadow: var(--shadow-raised);
}

.rm-topic--ink .rm-label {
  flex: none;
}

.rm-topic--ink .rm-nn {
  position: absolute;
  left: 12px;
  color: var(--on-inverse);
  opacity: 0.5;
}

.rm-topic--done,
.rm-topic--checked {
  background: color-mix(in oklab, var(--leaf-soft) 55%, var(--surface));
}

.rm-topic--skipped {
  color: var(--text-faint);
  box-shadow: none;
  outline: 1.5px dashed var(--border-dashed);
  outline-offset: -1.5px;
}

.rm-topic--skipped .rm-label {
  text-decoration: line-through;
  text-decoration-color: var(--border-dashed);
}

/* The step the learner is on: the highlighter. It pulses three times as it lands. */
.rm-topic--here {
  background: var(--accent);
  color: var(--on-accent);
  box-shadow:
    0 0 0 1px color-mix(in oklab, var(--hi-2) 80%, var(--accent-strong)),
    0 10px 24px -10px rgb(150 110 0 / 0.55);
}

.rm-topic--here .rm-nn {
  color: rgb(31 28 23 / 0.5);
}

.rm-topic--here:hover {
  box-shadow:
    0 0 0 1px color-mix(in oklab, var(--hi-2) 80%, var(--accent-strong)),
    0 14px 28px -12px rgb(150 110 0 / 0.6);
}

@media (prefers-reduced-motion: no-preference) {
  .rm-topic--here::after {
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

/* A subtopic: course.html's .node.sub, a paper chip. */
.rm-item {
  gap: 7px;
  padding: 0 10px;
  border-radius: 9px;
  background: var(--bg);
  color: var(--text-soft);
  font-size: 12.5px;
  font-weight: 580;
  box-shadow: 0 0 0 1px var(--border);
}

.rm-item:hover {
  background: var(--surface);
  color: var(--text);
  transform: translateY(-1px);
  box-shadow: 0 0 0 1px var(--border-strong), var(--shadow-card);
}

.rm-item--kin {
  box-shadow: 0 0 0 1.5px var(--brand-line);
}

.rm-item--done {
  background: color-mix(in oklab, var(--leaf-soft) 55%, var(--surface));
}

.rm-item--learning {
  box-shadow: 0 0 0 1.5px var(--hi-2);
}

.rm-item--skipped {
  background: transparent;
  color: var(--text-faint);
  box-shadow: none;
  outline: 1px dashed var(--border-dashed);
  outline-offset: -1px;
}

.rm-item--skipped .rm-label {
  text-decoration: line-through;
  text-decoration-color: var(--border-dashed);
}

.rm-bd {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 3px;
}

/* The lesson open in the foreground tab, or ticked to be written: a sky ring. */
.rm-box--active,
.rm-box--selected,
.rm-topic.rm-box--active {
  box-shadow:
    0 0 0 2px var(--sky),
    var(--shadow-raised);
}

.rm-box--peek {
  box-shadow:
    0 0 0 2px var(--sky),
    var(--shadow-raised);
}

/*
 * The title wraps by CSS and is clamped to the line count the layout budgeted
 * for. The prediction is a character count and errs generous; when it is still
 * short the text is clipped with an ellipsis rather than spilling out of its
 * box and over the tie beside it.
 */
.rm-label {
  display: -webkit-box;
  min-width: 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  overflow-wrap: anywhere;
}

/* -- "You are here" ------------------------------------------------------- */

.rm-here {
  z-index: 2;
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--inverse);
  color: var(--on-inverse);
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
  box-shadow: var(--shadow-raised);
}

/* -- The end of the line --------------------------------------------------- */

.rm-finish {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 650;
  box-shadow: 0 0 0 1px var(--border-strong);
}

.rm-finish__ck {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border-radius: 999px;
  background: rgb(var(--wash-rgb) / 0.065);
}

.rm-finish--lit {
  background: var(--leaf-soft);
  color: var(--leaf-ink);
  box-shadow: 0 0 0 1.5px var(--leaf);
}

.rm-finish--lit .rm-finish__ck {
  background: var(--leaf);
  color: #fff;
}

/* -- Panels, notes, links ------------------------------------------------- */

.rm-group {
  border-radius: 12px;
  background: rgb(var(--wash-rgb) / 0.035);
  box-shadow: 0 0 0 1px var(--border);
  transition: box-shadow 150ms;
}

.rm-group--lit {
  box-shadow: 0 0 0 1.5px var(--brand-line);
}

/* A note beside the line: course.html's .rnote, butter. */
.rm-note {
  padding: 9px 11px 9px 32px;
  border-radius: 11px;
  background: var(--butter-soft);
  color: var(--text-soft);
  font-size: 12px;
  line-height: 16px;
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--butter-ink) 18%, transparent);
}

.rm-note__icon {
  position: absolute;
  top: 10px;
  left: 11px;
  color: var(--butter-ink);
}

.rm-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border-radius: 999px;
  background: var(--sky-soft);
  color: var(--sky-ink);
  cursor: pointer;
  transition:
    background-color 200ms,
    transform 300ms var(--ease);
}

.rm-link:hover:not(:disabled) {
  background: color-mix(in oklab, var(--sky-soft) 70%, var(--sky));
  transform: translateY(-1px);
}

.rm-link:disabled {
  cursor: default;
}
</style>
