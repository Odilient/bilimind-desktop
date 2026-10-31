<script setup lang="ts">
import type { CourseNode, ProgressState } from '~/types/api'
import type { TreeItem } from '~/composables/useRoadmap'

/**
 * What one lesson is for, before it is opened.
 *
 * Clicking a box on the roadmap used to open the lesson in a tab at once, which
 * made the map a poor place to look around: every glance cost a tab. Now a
 * click shows this instead — where the lesson sits, what it covers, what it
 * hangs off and what comes next — and opening it is the one deliberate button,
 * with the neighbours and the mark quiet below it, in that order because that
 * is the order they get asked about. The desktop board shows it in a small dialog, the phone in a
 * sheet; the words are the same because this is the only place they are
 * written.
 *
 * Everything here is read out of `courseTree`, so it can never disagree with
 * the board or the sidebar about what the course is.
 */
const props = defineProps<{
  node: CourseNode
  /** The whole course, to place the lesson on it. */
  nodes: CourseNode[]
  /** Nothing opens and nothing can be marked. */
  readonly?: boolean
  /** The phone sheet: one big button, thumb-sized. */
  phone?: boolean
}>()

const emit = defineEmits<{
  open: [nodeId: number]
  /** A lesson that is not written yet: the learner asked for it to be. */
  expand: [nodeId: number, instruction?: string]
  /** Look at another lesson instead — a neighbour, or something under this one. */
  focus: [nodeId: number]
  progress: [nodeId: number, state: ProgressState]
}>()

const tree = computed(() => courseTree(props.nodes))
const mark = computed(() => lessonMark(props.node))
const state = computed(() => progressOf(props.node))
const status = computed(() => nodeStatusStyle(props.node.status))

interface Place {
  onPath: boolean
  /** 1-based step on the path — its own, or the one it sits under. */
  step: number | null
  steps: number
  /** The topic a subtopic sits under. */
  topic: CourseNode | null
  /** What a subtopic hangs off directly, when that is another subtopic. */
  family: CourseNode | null
  chapter: string | null
  previous: CourseNode | null
  next: CourseNode | null
  /** What hangs off this lesson: a topic's subtopics, or a family's members. */
  under: CourseNode[]
}

function findItem(items: TreeItem[], id: number): TreeItem | null {
  for (const item of items) {
    if (item.node.id === id) return item
    const child = item.children.find((c) => c.node.id === id)
    if (child) return child
  }
  return null
}

const place = computed<Place>(() => {
  const { steps, parentOf, stepOf, byId } = tree.value
  const id = props.node.id
  const index = steps.findIndex((step) => step.node.id === id)

  if (index !== -1) {
    const step = steps[index]!
    return {
      onPath: true,
      step: step.step,
      steps: steps.length,
      topic: null,
      family: null,
      chapter: String(step.node.section ?? '').trim() || null,
      previous: steps[index - 1]?.node ?? null,
      next: steps[index + 1]?.node ?? null,
      under: step.items.map((item) => item.node),
    }
  }

  const stepNo = stepOf.get(id) ?? null
  const step = stepNo ? steps[stepNo - 1] : undefined
  const parentId = parentOf.get(id)
  const parent = parentId != null ? (byId.get(parentId) ?? null) : null
  const own = step ? findItem(step.items, id) : null

  return {
    onPath: false,
    step: stepNo,
    steps: steps.length,
    topic: step?.node ?? null,
    family: parent && parent.id !== step?.node.id ? parent : null,
    chapter: step ? String(step.node.section ?? '').trim() || null : null,
    previous: null,
    next: null,
    under: own?.children.map((child) => child.node) ?? [],
  }
})

/** Where it sits, as one line. The step already says if it is the first or the last. */
const where = computed(() => {
  const { onPath, step, steps, chapter } = place.value
  const position = step ? `${onPath ? 'Step' : 'Under step'} ${step} of ${steps}` : null
  return [position, chapter, props.node.group].filter(Boolean).join(' · ')
})

/** The one-paragraph answer to "what is this for". */
const summary = computed(() => {
  const own = String(props.node.summary ?? '').trim()
  if (own) return own
  const { onPath, step, steps, topic } = place.value
  if (onPath) return `Step ${step} of ${steps} on the path. The lessons beside it fill in the detail.`
  return topic ? `Part of “${topic.title}”.` : 'A lesson in this course.'
})

/** The rows under the summary: only the lessons genuinely adjacent to this one. */
const neighbours = computed(() => {
  const { onPath, topic, family, previous, next } = place.value
  const rows: Array<{ label: string; node: CourseNode }> = []
  if (onPath) {
    if (previous) rows.push({ label: 'Previous', node: previous })
    if (next) rows.push({ label: 'Next', node: next })
  } else {
    if (family) rows.push({ label: 'Part of', node: family })
    if (topic) rows.push({ label: family ? 'Step' : 'Part of', node: topic })
  }
  return rows
})

/* -- While it is being written --------------------------------------------- */

/**
 * The clock and the place in line. "Being written now" on a busy button was
 * the whole of what this used to say, for a wait of a couple of minutes — and
 * a learner with no way to tell a slow lesson from a stuck one asks again.
 */
const clock = useStopwatch(() => props.nodes)

function elapsedOf(node: CourseNode): number {
  return clock.since(node.writing_for) ?? 0
}

const writingLine = computed(() => {
  const node = props.node

  if (node.status === 'generating') {
    const seconds = elapsedOf(node)
    return seconds > PACE.lessonSlowSeconds
      ? `Writing for ${clockLabel(seconds)} — longer than usual, still going`
      : `Writing for ${clockLabel(seconds)} · usually ${aboutLabel(PACE.lessonSeconds)}`
  }

  if (node.status === 'queued') {
    const queue = writingQueue(tree.value.flat.map((entry) => entry.node), elapsedOf)
    const ahead = Math.max(0, queue.waiting.findIndex((n) => n.id === node.id))
    const wait = startsIn(ahead, queue, elapsedOf)
    const when = wait < 20 ? 'starting now' : `starts in ${aboutLabel(wait)}`
    return ahead === 0 ? `Next in line · ${when}` : `${ahead} ahead of it · ${when}`
  }

  return null
})

/* -- Marking --------------------------------------------------------------- */

const MARKS: Array<{ state: Exclude<ProgressState, 'available'>; label: string; icon: string }> = [
  { state: 'completed', label: 'Done', icon: 'check' },
  { state: 'in_progress', label: 'Learning', icon: 'play' },
  { state: 'skipped', label: 'Skip', icon: 'arrow-right' },
]

/** Each mark toggles, so an accidental one is undone by pressing it again. */
function toggle(target: Exclude<ProgressState, 'available'>): void {
  if (props.readonly) return
  emit('progress', props.node.id, state.value === target ? 'available' : target)
}

/* -- The one button -------------------------------------------------------- */

const action = computed(() => {
  if (props.readonly) return null
  const kind = props.node.status
  if (kind === 'ready') {
    return { label: 'Open lesson', variant: 'primary' as const, icon: 'arrow-right', busy: false }
  }
  if (kind === 'generating') {
    return { label: 'Being written now', variant: 'secondary' as const, icon: undefined, busy: true }
  }
  if (kind === 'queued') {
    return { label: 'Waiting to be written', variant: 'secondary' as const, icon: undefined, busy: true }
  }
  return { label: 'Write this lesson', variant: 'accent' as const, icon: 'sparkles', busy: false }
})

/** How they want it written, for a lesson that isn't yet. */
const steer = ref('')
const canSteer = computed(() => !props.readonly && (props.node.status === 'stub' || props.node.status === 'failed'))

/**
 * Most lessons are written as they are, so the field waits to be asked for. It
 * stays open once it is: closing it would leave words that still get sent.
 */
const steering = ref(false)
const actions = useTemplateRef<HTMLElement>('actions')

watch(() => props.node.id, () => {
  steer.value = ''
  steering.value = false
})

async function openSteer(): Promise<void> {
  steering.value = true
  await nextTick()
  actions.value?.querySelector('textarea')?.focus()
}

function act(): void {
  if (!action.value || action.value.busy) return
  if (props.node.status === 'ready') emit('open', props.node.id)
  else emit('expand', props.node.id, steer.value)
}

function tintOf(node: CourseNode): string {
  const s = progressOf(node)
  if (s === 'completed') return 'line-through text-text-faint'
  if (s === 'skipped') return 'line-through text-text-ghost'
  if (s === 'in_progress') return 'text-accent-strong'
  return 'text-text-dim'
}
</script>

<template>
  <div>
    <!-- What it is: where it sits, its name, its state, what it is for. -->
    <div class="flex items-start gap-2 pr-7 text-[12.5px] leading-5 text-text-muted">
      <span
        :class="[
          'num grid size-5 shrink-0 place-items-center rounded-full font-display text-[10.5px] font-semibold',
          state === 'completed'
            ? 'bg-chip text-lime'
            : state === 'in_progress'
              ? 'bg-accent text-on-accent'
              : place.onPath
                ? 'bg-chip text-white'
                : 'bg-surface-track text-text-soft',
        ]"
      >
        <UiIcon
          v-if="state === 'completed'"
          name="check"
          :size="10"
          :stroke="3"
        />
        <template v-else>{{ place.step ?? '·' }}</template>
      </span>
      <span>{{ where }}</span>
    </div>

    <h2 class="mt-3 pr-7 font-display text-[23px] leading-[1.2] font-semibold tracking-[-0.025em] text-text">
      {{ node.title }}
    </h2>

    <div class="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px]">
      <UiStatusDot
        :status="node.status"
        :size="7"
      />
      <span :class="status.text">{{ status.label }}</span>
      <span class="text-text-ghost">·</span>
      <span class="text-text-muted">{{ node.estimated_minutes }} min</span>
      <span
        v-if="mark"
        class="ml-1 inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface px-2 py-[2px] text-[11px] font-medium text-text-soft"
        :title="MARK_META[mark].blurb"
      >
        <span
          class="size-2 rounded-full"
          :style="{ background: MARK_META[mark].color }"
        />
        {{ MARK_META[mark].label }}
      </span>
    </div>

    <p
      v-if="writingLine"
      class="num mt-2 flex items-center gap-1.5 text-[12.5px] text-brand"
    >
      <UiIcon
        :name="node.status === 'generating' ? 'loader' : 'clock'"
        :size="12"
        :class="node.status === 'generating' && 'animate-spin-slow'"
      />
      {{ writingLine }}
    </p>

    <p class="mt-4 text-[14.5px] leading-relaxed text-text-soft">
      {{ summary }}
    </p>

    <p
      v-if="mark"
      class="mt-2 text-[13px] leading-relaxed text-text-muted"
    >
      {{ MARK_META[mark].blurb }}
    </p>

    <!-- The mentor's aside, when the topic has one. -->
    <div
      v-if="node.note"
      class="mt-3 flex gap-2.5 rounded-[12px] bg-warn-soft px-3 py-2.5 text-[12.5px] leading-snug text-warn-text shadow-[inset_0_0_0_1px_var(--warn-line)]"
    >
      <UiIcon
        name="sparkles"
        :size="14"
        :stroke="1.8"
        class="mt-px shrink-0 text-warn-bright"
      />
      <span>{{ node.note }}</span>
    </div>

    <!-- What hangs off it. Each one is a place to look next. -->
    <section
      v-if="place.under.length"
      class="mt-5"
    >
      <h3 class="mb-1.5 text-[13px] font-medium text-text-muted">
        {{ place.onPath ? 'Covers' : 'Includes' }}
      </h3>
      <div class="divide-y divide-border-rule border-y border-border-rule">
        <button
          v-for="item in place.under"
          :key="item.id"
          type="button"
          class="-mx-2 flex min-h-10 w-[calc(100%+1rem)] cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-mute"
          @click="emit('focus', item.id)"
        >
          <span
            v-if="lessonMark(item)"
            class="size-2 shrink-0 rounded-full"
            :style="{ background: MARK_META[lessonMark(item)!].color }"
            :title="MARK_META[lessonMark(item)!].label"
          />
          <UiStatusDot
            v-else
            :status="item.status"
            :size="6"
            still
          />
          <span :class="['min-w-0 flex-1 text-[13px] leading-snug', tintOf(item)]">{{ item.title }}</span>
          <UiIcon
            name="chevron-right"
            :size="14"
            :stroke="2.2"
            class="shrink-0 text-text-faint"
          />
        </button>
      </div>
    </section>

    <!-- What to do with this lesson: the one real button, how to write it when
         they ask to say, and where they are with it. -->
    <div
      v-if="action"
      ref="actions"
      class="mt-6 grid gap-2.5"
    >
      <WorkspaceLessonSteer
        v-if="canSteer && steering"
        v-model="steer"
        @submit="act"
      />

      <!-- Busy is a statement, not a button: a spinner with its words, never a
           blank one. UiBtn's loading state hides the label, which left a
           lesson being written showing an empty button with a dial in it. -->
      <span
        v-if="action.busy"
        :class="[
          'flex items-center justify-center gap-2 border border-accent-line bg-accent-soft font-medium whitespace-nowrap text-accent-strong',
          phone ? 'h-12 rounded-xl text-[15px]' : 'h-11 rounded-full text-[14px]',
        ]"
        role="status"
      >
        <UiIcon
          name="loader"
          :size="14"
          class="animate-spin-slow"
        />
        {{ action.label }}
      </span>

      <div
        v-else
        class="flex gap-2"
      >
        <UiBtn
          :variant="action.variant"
          size="lg"
          :icon="action.icon"
          :class="['grow', phone && 'h-12! rounded-xl! text-[15px]!']"
          autofocus
          @click="act"
          >{{ action.label }}</UiBtn
        >
        <UiBtn
          v-if="canSteer && !steering"
          variant="secondary"
          size="lg"
          :class="phone && 'h-12! rounded-xl! text-[15px]!'"
          @click="openSteer"
          >Customize</UiBtn
        >
      </div>

      <div class="mt-1.5 flex items-center justify-between gap-3">
        <span class="text-[13px] text-text-muted">Mark as</span>
        <div
          class="inline-flex items-center gap-[3px] rounded-[12px] bg-surface-track p-1"
          role="group"
          aria-label="Mark this lesson"
        >
          <button
            v-for="m in MARKS"
            :key="m.state"
            type="button"
            :class="[
              'inline-flex h-[30px] cursor-pointer items-center gap-1.5 rounded-[9px] px-2.5 text-[12.5px] font-semibold transition-colors',
              state === m.state
                ? 'bg-surface text-text shadow-segment'
                : 'text-text-faint hover:text-text-soft',
            ]"
            :aria-pressed="state === m.state"
            @click="toggle(m.state)"
          >
            <UiIcon
              :name="m.icon"
              :size="12"
              :stroke="2.4"
              :class="
                state === m.state &&
                (m.state === 'completed'
                  ? 'text-accent-strong'
                  : m.state === 'in_progress'
                    ? 'text-accent-strong'
                    : 'text-text-muted')
              "
            />
            {{ m.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- The lessons either side, the way a book's pages sit: back on the left,
         on to the right, even when only one exists. A subtopic has no sides, so
         what it belongs to takes the whole width. -->
    <nav
      v-if="neighbours.length"
      :class="['mt-5 grid gap-2 border-t border-border-rule pt-4', place.onPath && 'grid-cols-2']"
      aria-label="Lessons around this one"
    >
      <button
        v-for="row in neighbours"
        :key="row.label + row.node.id"
        type="button"
        :class="[
          'flex min-h-[64px] cursor-pointer items-center gap-2.5 rounded-[14px] border border-border-strong px-3 py-2.5 text-left transition-colors hover:bg-surface-mute',
          row.label === 'Next' && 'col-start-2 flex-row-reverse text-right',
        ]"
        :title="row.node.title"
        @click="emit('focus', row.node.id)"
      >
        <UiIcon
          :name="row.label === 'Previous' ? 'chevron-left' : 'chevron-right'"
          :size="15"
          :stroke="2.2"
          class="shrink-0 text-text-faint"
        />
        <span class="min-w-0 flex-1">
          <span
            :class="[
              'flex items-center gap-1.5 text-[12px] text-text-muted',
              row.label === 'Next' && 'justify-end',
            ]"
          >
            <UiStatusDot
              :status="row.node.status"
              still
            />
            {{ row.label }}
          </span>
          <span :class="['mt-1 line-clamp-2 text-[13px] leading-snug font-medium', tintOf(row.node)]">{{ row.node.title }}</span>
        </span>
      </button>
    </nav>
  </div>
</template>
