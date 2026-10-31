<script setup lang="ts">
import type { CourseNode, FurtherCourse, ProgressState } from '~/types/api'
import type { ItemBox, TopicBox } from '~/composables/useRoadmap'

/**
 * The course as a roadmap, in roadmap.sh's grammar and the workspace's ink.
 *
 * `useRoadmap` decides where everything goes; this file's only job is to make
 * each kind of box look like what it is, using the same tokens as the rest of
 * the app, because the drawing is worthless if a subtopic can be mistaken for
 * the next topic:
 *
 *  - a TOPIC is a dark milestone on the line — the one near-black ink the app
 *    already uses for "commit" — numbered by its place;
 *  - a SUBTOPIC is a light card tied back with a dotted curve, wearing a
 *    coloured badge in its corner when it is an option;
 *  - a GROUP is a sunken panel with an eyebrow heading around the subtopics
 *    that are one family; a FAMILY is a subtopic on top of a panel of its own
 *    members;
 *  - a NOTE is a warm paper card — advice, not a lesson;
 *  - a LINK is a soft violet button that starts a new course.
 *
 * Progress is painted onto the box: a done topic goes light with a green tick
 * so the path visibly clears behind you, learning goes violet, skipped goes
 * hollow and dashed. The line itself fills in green as topics are finished.
 *
 * Clicking a box does NOT open the lesson. It opens a small brief — what the
 * lesson is for, what it covers, what comes next — and the brief has the one
 * button that opens it. roadmap.sh's marking gestures still work as shortcuts:
 * right-click marks done, shift-click marks learning, alt-click skips.
 *
 * The canvas is laid out at a fixed width and scaled to fit the pane it is in,
 * so the whole map is readable without a horizontal scrollbar on a laptop and
 * never wider than it needs to be on a big screen.
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
}>()

const emit = defineEmits<{
  open: [nodeId: number]
  /** A lesson that is not written yet: the learner asked for it to be. */
  expand: [nodeId: number, instruction?: string]
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

function fit(): void {
  if (!frame.value) return
  const available = frame.value.clientWidth - 16
  if (available <= 0) return
  scale.value = Math.max(MIN_SCALE, Math.min(1, available / roadmap.value.width))
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

watch(() => roadmap.value.width, () => fit())

const percent = computed(() =>
  roadmap.value.counts.total === 0
    ? 0
    : Math.round((roadmap.value.counts.done / roadmap.value.counts.total) * 100),
)

const START_Y = METRICS.pad

/**
 * Where the learner is on the line, the way the course player marks it: the
 * topic being learned, else the first one not yet finished. Nothing finished
 * and nothing started reads "Start here" rather than claiming progress.
 */
const here = computed<{ topic: TopicBox; started: boolean } | null>(() => {
  if (props.readonly) return null
  const topics = roadmap.value.topics
  const learning = topics.find((topic) => tintOf(topic.node) === 'learning')
  const topic = learning ?? topics.find((item) => tintOf(item.node) === null)
  if (!topic) return null
  return { topic, started: !!learning || roadmap.value.counts.done > 0 }
})
</script>

<template>
  <div class="rm">
    <!-- The sticky bar: what the map is, how to read it, how far along it the learner is. -->
    <div
      class="sticky top-0 z-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-surface/94 px-5 py-2.5 backdrop-blur-[8px]"
    >
      <div class="flex items-baseline gap-2.5">
        <span class="font-display text-[16px] font-semibold tracking-[-0.01em]">Roadmap</span>
        <span class="num text-[12.5px] text-text-faint">
          {{ roadmap.counts.topics }} {{ roadmap.counts.topics === 1 ? 'topic' : 'topics' }}<template
            v-if="roadmap.counts.subtopics"
          >
            · {{ roadmap.counts.subtopics }} subtopics</template
          >
          · {{ minutesLabel(roadmap.counts.minutes) }}
        </span>
      </div>

      <!-- The legend: the three badges. Colour alone teaches nobody. -->
      <div
        class="flex items-center gap-3.5 text-[12.5px] text-text-soft"
        aria-label="Badges"
      >
        <span
          v-for="mark in MARK_ORDER"
          :key="mark"
          class="inline-flex items-center gap-1.5"
          :title="MARK_META[mark].blurb"
        >
          <span
            class="rm-badge shrink-0"
            :style="{ background: MARK_META[mark].color, color: MARK_META[mark].ink }"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="m20 6.5-11 11L4 12.5" />
            </svg>
          </span>
          {{ MARK_META[mark].label }}
        </span>
      </div>

      <span class="flex-1" />

      <span
        v-if="!readonly"
        class="hidden text-[11.5px] text-text-faint 2xl:inline"
        >Click a box to see what it covers</span
      >

      <div
        v-if="!readonly && roadmap.counts.total"
        class="flex items-center gap-2.5 text-[12px]"
        :title="`${roadmap.counts.done} of ${roadmap.counts.total} done${roadmap.counts.learning ? `, ${roadmap.counts.learning} learning` : ''}`"
      >
        <span class="h-1.5 w-[120px] overflow-hidden rounded-full bg-surface-track">
          <span
            class="block h-full rounded-full bg-cobalt transition-[width] duration-400"
            :style="{ width: `${percent}%` }"
          />
        </span>
        <span class="num font-semibold text-text-body">{{ percent }}% done</span>
      </div>

      <!-- The way back in: cobalt's lime "continue" pill, naming the step. -->
      <button
        v-if="here"
        type="button"
        class="group inline-flex h-[34px] max-w-[min(100%,340px)] cursor-pointer items-center gap-2 rounded-full bg-lime pr-1 pl-3.5 text-[13px] font-semibold text-ink transition-colors hover:bg-[#d2f86a]"
        :title="here.topic.node.title"
        @click="emit('open', here.topic.id)"
      >
        <span class="min-w-0 truncate"
          >{{ here.started ? 'Continue' : 'Start' }} · Step {{ here.topic.step }},
          {{ here.topic.node.title }}</span
        >
        <span
          class="grid size-[26px] shrink-0 place-items-center rounded-full bg-ink text-lime transition-transform group-hover:translate-x-0.5"
        >
          <UiIcon
            name="arrow-right"
            :size="13"
            :stroke="2.4"
          />
        </span>
      </button>
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
      <div :style="{ width: `${roadmap.width * scale}px`, height: `${roadmap.height * scale}px` }">
        <div
          class="rm-canvas fade-in relative origin-top-left select-none"
          :style="{
            width: `${roadmap.width}px`,
            height: `${roadmap.height}px`,
            transform: `scale(${scale})`,
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
              pathLength="1"
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
              class="inline-flex h-6 max-w-full items-center truncate rounded-full bg-surface px-3 text-[10.5px] font-semibold tracking-[0.08em] text-text-soft uppercase shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.14)]"
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
              class="truncate px-3 pt-[10px] text-[10px] font-semibold tracking-[0.08em] text-text-faint uppercase"
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

            <!-- The badge, in the corner nearer the spine, as roadmap.sh places it. -->
            <span
              v-if="item.mark"
              :class="['rm-badge rm-badge--corner', item.side === 'right' ? 'rm-badge--left' : 'rm-badge--right']"
              :style="{ background: MARK_META[item.mark].color, color: MARK_META[item.mark].ink }"
              :title="`${MARK_META[item.mark].label} — ${MARK_META[item.mark].blurb}`"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="m20 6.5-11 11L4 12.5" />
              </svg>
            </span>
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
            <span class="rm-step num">
              <UiIcon
                v-if="tintOf(topic.node) === 'done'"
                name="check"
                :size="11"
                :stroke="3"
              />
              <template v-else>{{ topic.step }}</template>
            </span>
            <span
              class="rm-label"
              :style="{ '-webkit-line-clamp': topic.lines.length }"
              >{{ topic.node.title }}</span
            >

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
            :style="{ left: `${here.topic.x - 8}px`, top: `${here.topic.y - 15}px` }"
          >
            <span class="rm-here__dot">
              <UiIcon
                name="target"
                :size="11"
                :stroke="2.2"
              />
            </span>
            {{ here.started ? 'You are here' : 'Start here' }}
          </span>

          <!-- Where to go from here: the box at the end. -->
          <div
            v-if="roadmap.finish"
            class="absolute rounded-[12px] bg-surface shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.12)]"
            :style="{
              left: `${roadmap.finish.x}px`,
              top: `${roadmap.finish.y}px`,
              width: `${roadmap.finish.width}px`,
              height: `${roadmap.finish.height}px`,
            }"
          >
            <p class="pt-[9px] text-center text-[11px] font-semibold tracking-[0.08em] text-text-faint uppercase">
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
        @open="openFromBrief"
        @expand="writeFromBrief"
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
 * Cobalt's path: a dotted canvas and one rule for colour, so where the learner
 * is can be seen without reading anything. Blue is progress: the line and the
 * finished steps go pale, the step they are on is the one solid blue box, what
 * is ahead stays white. Lime is only ever "here" (the tag, the Continue pill).
 * A readonly board has no learner on it and keeps the ink milestones. Around
 * those: white hairline subtopics, butter mentor notes, grey group trays and
 * cobalt "further" chips.
 */

/* The canvas: cobalt's dot grid on its own off-white, painted on the unscaled
   frame so the dots stay crisp. */
.rm-desk {
  background-color: var(--surface-canvas);
  background-image: radial-gradient(circle, var(--rm-dot, rgb(11 13 16 / 0.12)) 1px, transparent 1.3px);
  background-size: 20px 20px;
  background-position: 10px 10px;
}

/* The title sits on the line; a canvas-coloured backing cuts the line out. */
.rm-title__line {
  padding: 2px 10px;
  border-radius: 8px;
  background: var(--surface-canvas);
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

/* -- Lines ---------------------------------------------------------------- */

.rm-lead {
  fill: none;
  stroke: var(--rm-lead, #a9adb8);
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-dasharray: 0.5 7;
}

.rm-start {
  fill: var(--surface);
  stroke: var(--rm-tie, #9da2ae);
  stroke-width: 2.2;
}

.rm-tie {
  fill: none;
  stroke: var(--rm-tie, #9da2ae);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-dasharray: 2 4;
  transition:
    stroke 150ms,
    stroke-width 150ms;
}

.rm-tie--lit {
  stroke: var(--brand);
  stroke-width: 2;
}

.rm-rail {
  fill: none;
  stroke: var(--rm-rail, #cdd0d8);
  stroke-width: 2.5;
  stroke-linecap: round;
  transition:
    stroke 300ms,
    stroke-width 300ms;
}

/* The run: where the learner has already been. */
.rm-rail--done {
  stroke: var(--cobalt);
  stroke-width: 5;
}

@media (prefers-reduced-motion: no-preference) {
  .rm-rail {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: rm-draw 460ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
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
  justify-content: center;
  text-align: center;
  cursor: pointer;
  transition:
    background-color 140ms,
    color 140ms,
    box-shadow 140ms,
    transform 140ms;
}

/* A lesson being written pulses cobalt; waiting its turn, a hollow ring. */
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

/* A topic: a step still ahead. */
.rm-topic {
  padding: 0 14px 0 40px;
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  font-size: 13.5px;
  box-shadow:
    inset 0 0 0 1.5px rgb(11 13 16 / 0.2),
    0 6px 14px -10px rgb(11 13 16 / 0.35);
}

.rm-topic:hover {
  transform: translateY(-1px);
  box-shadow:
    inset 0 0 0 1.5px rgb(11 13 16 / 0.34),
    0 10px 20px -12px rgb(11 13 16 / 0.4);
}

/* A course nobody is on (a public page): the ink milestone. */
.rm-topic--ink {
  background: var(--ink);
  color: #fff;
  box-shadow: 0 10px 20px -12px rgb(11 13 16 / 0.6);
}

.rm-topic--ink:hover {
  box-shadow: 0 16px 26px -14px rgb(11 13 16 / 0.65);
}

.rm-topic--done {
  background: var(--cobalt-soft);
  color: var(--text-muted);
  box-shadow: inset 0 0 0 1px var(--brand-line);
}

.rm-topic--learning {
  background: var(--surface);
  color: var(--cobalt);
  box-shadow: inset 0 0 0 1.5px var(--cobalt);
}

/* The step the learner is on: the one solid box on the board. */
.rm-topic--here {
  background: var(--cobalt);
  color: #fff;
  box-shadow:
    0 0 0 5px var(--brand-line),
    0 14px 26px -12px rgb(35 64 230 / 0.7);
}

.rm-topic--here:hover {
  box-shadow:
    0 0 0 6px var(--brand-line),
    0 16px 28px -12px rgb(35 64 230 / 0.75);
}

.rm-topic--skipped {
  background: var(--surface);
  color: var(--text-ghost);
  box-shadow: inset 0 0 0 1.5px var(--border-dashed);
  outline: 1.5px dashed var(--border-dashed);
  outline-offset: -1.5px;
}

.rm-topic--skipped .rm-label {
  text-decoration: line-through;
  text-decoration-color: rgb(var(--wash-rgb) / 0.3);
}

.rm-step {
  position: absolute;
  top: 50%;
  left: 10px;
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 999px;
  background: var(--surface-sunken);
  color: var(--text-dim);
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 600;
  transform: translateY(-50%);
  transition:
    background-color 140ms,
    color 140ms;
}

.rm-topic--ink .rm-step {
  background: rgb(255 255 255 / 0.14);
  color: #fff;
}

.rm-topic--done .rm-step {
  background: var(--cobalt);
  color: #fff;
}

.rm-topic--learning .rm-step {
  background: var(--cobalt-soft);
  color: var(--cobalt);
}

.rm-topic--here .rm-step {
  background: #fff;
  color: var(--cobalt);
}

.rm-topic--skipped .rm-step {
  border: 1.5px dashed var(--border-dashed);
  background: transparent;
  color: var(--text-ghost);
}

/* A subtopic: the white badge card. */
.rm-item {
  padding: 0 12px;
  border-radius: 9px;
  background: var(--surface);
  color: var(--text-body);
  font-size: 12.5px;
  box-shadow: inset 0 0 0 1px rgb(var(--wash-rgb) / 0.12);
}

.rm-item:hover {
  transform: translateY(-1px);
  box-shadow:
    inset 0 0 0 1px rgb(var(--wash-rgb) / 0.2),
    0 6px 14px -6px rgb(11 13 16 / 0.18);
}

.rm-item--kin {
  box-shadow: inset 0 0 0 1.5px var(--brand-line);
}

.rm-item--done {
  background: var(--cobalt-soft);
  color: var(--text-muted);
  box-shadow: inset 0 0 0 1px var(--brand-line);
}

.rm-item--learning {
  color: var(--cobalt);
  box-shadow: inset 0 0 0 1.5px var(--cobalt);
}

.rm-item--skipped {
  background: transparent;
  color: var(--text-ghost);
  box-shadow: none;
  outline: 1px dashed var(--border-dashed);
  outline-offset: -1px;
}

.rm-item--done .rm-label,
.rm-item--skipped .rm-label {
  text-decoration: line-through;
  text-decoration-color: rgb(var(--wash-rgb) / 0.3);
}

/* The lesson open in the foreground tab, or ticked to be written: a cobalt ring. */
.rm-box--active,
.rm-box--selected,
.rm-topic.rm-box--active {
  box-shadow:
    0 0 0 2px var(--canvas),
    0 0 0 4px var(--cobalt);
}

.rm-box--peek {
  box-shadow: 0 0 0 4px var(--brand-line);
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

/* -- Badges --------------------------------------------------------------- */

.rm-badge {
  display: grid;
  width: 14px;
  height: 14px;
  place-items: center;
  border-radius: 999px;
  color: #fff;
}

.rm-badge svg {
  width: 9px;
  height: 9px;
  fill: none;
  stroke: currentColor;
  stroke-width: 3.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.rm-badge--corner {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  box-shadow: 0 0 0 2px var(--surface);
}

.rm-badge--left {
  left: -7px;
}

.rm-badge--right {
  right: -7px;
}

/* -- "You are here" ------------------------------------------------------- */

.rm-here {
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 11px 0 3px;
  border-radius: 999px;
  background: var(--lime);
  color: var(--ink);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: 0 6px 14px -6px rgb(100 140 10 / 0.6);
}

.rm-here__dot {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border-radius: 999px;
  background: var(--ink);
  color: var(--lime);
}

/* -- The end of the line --------------------------------------------------- */

.rm-finish {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-faint);
  font-family: var(--font-display);
  font-size: 13.5px;
  font-weight: 600;
  box-shadow: inset 0 0 0 1.5px var(--rm-finish-line, #d9dce4);
}

.rm-finish__ck {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 999px;
  background: var(--surface-track);
}

.rm-finish--lit {
  background: var(--lime);
  color: var(--ink);
  box-shadow: 0 0 0 6px rgb(198 242 78 / 0.35);
}

.rm-finish--lit .rm-finish__ck {
  background: var(--ink);
  color: var(--lime);
}

/* -- Panels, notes, links ------------------------------------------------- */

.rm-group {
  border-radius: 12px;
  background: var(--rm-group, #eef0f4);
  box-shadow: inset 0 0 0 1px var(--border);
  transition: box-shadow 150ms;
}

.rm-group--lit {
  box-shadow: inset 0 0 0 1.5px var(--brand-line);
}

.rm-note {
  padding: 9px 12px 9px 32px;
  border-radius: 10px;
  background: var(--warn-soft);
  color: var(--warn-text);
  font-size: 12px;
  line-height: 16px;
  box-shadow: inset 0 0 0 1px var(--warn-line);
}

.rm-note__icon {
  position: absolute;
  top: 10px;
  left: 11px;
  color: var(--warn-bright);
}

.rm-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border-radius: 999px;
  background: var(--brand-soft);
  color: var(--brand);
  cursor: pointer;
  transition:
    background-color 120ms,
    transform 120ms;
}

.rm-link:hover:not(:disabled) {
  background: var(--rm-link-hover, #e1e7fd);
  transform: translateY(-1px);
}

.rm-link:disabled {
  cursor: default;
}
</style>
