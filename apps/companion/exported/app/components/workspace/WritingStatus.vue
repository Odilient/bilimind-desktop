<script setup lang="ts">
import type { Course, CourseNode } from '~/types/api'

/**
 * The one line that says the course is being worked on, and how far along.
 *
 * Two kinds of work happen in a course the learner is already looking at, and
 * neither used to say anything:
 *
 *  - LESSONS being written. A lesson took a couple of minutes behind a dot that
 *    pulsed, with no clock, no place in line and no word when it was done — so
 *    it read as nothing happening, and "Write this lesson" got pressed again.
 *  - PARTS being added. For a few minutes after a plan lands, the steps are
 *    broken into smaller lessons a batch at a time, and the roadmap grew new
 *    boxes with no explanation.
 *
 * So this shows what is being written right now with its clock, how many are
 * waiting, roughly how long until they are all done (`writingQueue`), and when
 * the last one lands, says so for a moment before it goes. It renders nothing
 * while nothing is happening, so it costs the screen nothing the rest of the time.
 */
const props = defineProps<{
  course: Course
  nodes: CourseNode[]
  /** The phone layout: two lines, smaller type. */
  phone?: boolean
}>()

const emit = defineEmits<{
  /** Open a lesson named in the line. */
  open: [nodeId: number]
}>()

/** Each poll carries fresh server-side clocks; this ticks them between polls. */
const clock = useStopwatch(() => props.nodes)

function elapsedOf(node: CourseNode): number {
  return clock.since(node.writing_for) ?? 0
}

const ordered = computed(() => courseTree(props.nodes).flat.map((entry) => entry.node))

const queue = computed(() => writingQueue(ordered.value, elapsedOf))

const inFlight = computed(() => queue.value.writing.length + queue.value.waiting.length)

/* -- What finished while this was on screen -------------------------------- */

/**
 * Lessons seen in flight, so that one turning `ready` can be counted and
 * named. Only what happened while the learner was here: a lesson written
 * overnight is not news.
 */
const tracked = new Set<number>()
const finished = ref<CourseNode[]>([])
/** The moment the last lesson in flight lands, for a short "all done". */
const allDone = ref(false)
let doneTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => props.nodes,
  (nodes) => {
    for (const node of nodes) {
      if (node.status === 'queued' || node.status === 'generating') {
        tracked.add(node.id)
      } else if (tracked.has(node.id)) {
        tracked.delete(node.id)
        if (node.status === 'ready') finished.value = [...finished.value, node]
      }
    }

    if (inFlight.value > 0) {
      allDone.value = false
      if (doneTimer) clearTimeout(doneTimer)
      doneTimer = undefined
    } else if (finished.value.length > 0 && !allDone.value) {
      allDone.value = true
      doneTimer = setTimeout(() => {
        allDone.value = false
        finished.value = []
      }, 6000)
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (doneTimer) clearTimeout(doneTimer)
})

/* -- Lessons --------------------------------------------------------------- */

/** The lesson the line names: the one that has been writing longest. */
const current = computed(() =>
  [...queue.value.writing].sort((a, b) => elapsedOf(b) - elapsedOf(a))[0] ?? null,
)

const lessonsLine = computed(() => {
  const count = inFlight.value
  if (count === 0) return null
  return count === 1 ? 'Writing 1 lesson' : `Writing ${count} lessons`
})

const lessonsLeft = computed(() =>
  queue.value.slow ? 'Taking longer than usual' : `${aboutLabel(queue.value.secondsLeft)} left`,
)

/**
 * Done ones, plus how far each one in flight is through its usual time, over
 * everything this stretch of writing is about. Moves every second; reaches the
 * end only when the last lesson really has landed.
 */
const lessonsProgress = computed(() => {
  const done = finished.value.length
  const total = done + inFlight.value
  if (total === 0) return 1
  const partial = queue.value.writing.reduce(
    (sum, node) => sum + easedProgress(elapsedOf(node), PACE.lessonSeconds),
    0,
  )
  return (done + partial) / total
})

/* -- Parts ----------------------------------------------------------------- */

const parts = computed(() => {
  const pipeline = props.course.pipeline
  return pipeline?.stage === 'parts' ? pipeline : null
})

const partsElapsed = computed(() => clock.since(parts.value?.elapsed) ?? 0)

const partsLine = computed(() => {
  const stage = parts.value
  if (!stage) return null
  const total = stage.batches_total ?? 0
  const done = stage.batches_done ?? 0
  const added = stage.added ?? 0

  const bits = ['Adding smaller lessons under each step']
  if (total > 1) bits.push(`part ${Math.min(done + 1, total)} of ${total}`)
  if (added > 0) bits.push(`${added} added so far`)
  return bits.join(' · ')
})

const partsLeft = computed(() => {
  const stage = parts.value
  if (!stage) return ''
  const total = Math.max(1, stage.batches_total ?? 1)
  const left = total * PACE.partsBatchSeconds - partsElapsed.value
  return left > 0 ? `${aboutLabel(left)} left` : 'Nearly done'
})

const partsProgress = computed(() => {
  const stage = parts.value
  if (!stage) return 0
  const total = Math.max(1, stage.batches_total ?? 1)
  return Math.max(
    (stage.batches_done ?? 0) / total,
    easedProgress(partsElapsed.value, total * PACE.partsBatchSeconds),
  )
})

/* -- The bar --------------------------------------------------------------- */

const visible = computed(() => inFlight.value > 0 || parts.value !== null || allDone.value)

const progress = computed(() => {
  if (inFlight.value > 0) return lessonsProgress.value
  if (parts.value) return partsProgress.value
  return 1
})

const doneLine = computed(() => {
  const list = finished.value
  if (list.length === 1) return `“${list[0]!.title}” is written`
  return `${list.length} lessons written`
})
</script>

<template>
  <div
    v-if="visible"
    :class="[
      'relative shrink-0 border-b',
      allDone && inFlight === 0 && !parts
        ? 'border-[rgb(141_181_30/0.4)] bg-accent-soft'
        : 'border-brand-line bg-brand-soft',
    ]"
    role="status"
    aria-live="polite"
  >
    <div
      :class="[
        'flex flex-col gap-1',
        phone ? 'px-4 py-2 text-[12px]' : 'px-4.5 py-[7px] text-[12.5px]',
      ]"
    >
      <!-- Lessons being written. -->
      <div
        v-if="lessonsLine"
        class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5"
      >
        <UiIcon
          name="loader"
          :size="13"
          class="shrink-0 animate-spin-slow text-brand"
        />
        <span class="font-medium text-text">{{ lessonsLine }}</span>

        <span
          v-if="finished.length"
          class="text-text-muted"
          >· {{ finished.length }} done</span
        >

        <span
          v-if="current"
          class="flex min-w-0 items-center gap-1.5 text-text-soft"
        >
          <!-- On a phone this wraps to its own line, where a leading dot reads as debris. -->
          <span
            v-if="!phone"
            class="text-text-ghost"
            >·</span
          >
          <span class="shrink-0">Now:</span>
          <button
            type="button"
            class="min-w-0 cursor-pointer truncate text-left font-medium text-text-body underline decoration-brand-line underline-offset-2 hover:text-brand"
            :class="phone ? 'max-w-[11rem]' : 'max-w-[22rem]'"
            @click="emit('open', current.id)"
          >
            {{ current.title }}
          </button>
          <span class="num shrink-0 text-text-muted">{{ clockLabel(elapsedOf(current)) }}</span>
        </span>

        <span
          v-else-if="queue.waiting.length"
          class="text-text-muted"
          >· starting</span
        >

        <span class="ml-auto shrink-0 text-text-muted">{{ lessonsLeft }}</span>
      </div>

      <!-- The plan's steps being broken into parts. -->
      <div
        v-if="partsLine"
        class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5"
      >
        <UiIcon
          :name="lessonsLine ? 'layers' : 'loader'"
          :size="13"
          :class="['shrink-0 text-brand', !lessonsLine && 'animate-spin-slow']"
        />
        <span :class="lessonsLine ? 'text-text-soft' : 'font-medium text-text'">{{ partsLine }}</span>
        <span class="ml-auto shrink-0 text-text-muted">{{ partsLeft }}</span>
      </div>

      <!-- And the moment it is over. -->
      <div
        v-if="!lessonsLine && !partsLine && allDone"
        class="fade-in flex min-w-0 items-center gap-2"
      >
        <UiIcon
          name="check"
          :size="13"
          :stroke="2.4"
          class="shrink-0 text-accent-strong"
        />
        <span class="min-w-0 truncate font-semibold text-accent-strong">{{ doneLine }}</span>
        <button
          v-if="finished.length === 1"
          type="button"
          class="shrink-0 cursor-pointer font-semibold text-accent-strong underline underline-offset-2"
          @click="emit('open', finished[0]!.id)"
        >
          Open it
        </button>
      </div>
    </div>

    <!-- Progress along the bottom edge. -->
    <div
      v-if="lessonsLine || partsLine"
      class="absolute inset-x-0 bottom-0 h-[2px] bg-brand-line"
    >
      <div
        class="h-full bg-brand transition-[width] duration-1000 ease-linear"
        :style="{ width: `${Math.round(progress * 100)}%` }"
      />
    </div>
  </div>
</template>
