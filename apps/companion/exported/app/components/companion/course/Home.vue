<script setup lang="ts">
import type { CourseNode, ProgressState } from '~/types/api'
import type { Item, Subject, Topic } from '~/companion/types'
import type { ContinueTarget, CourseProgress, CourseView } from '~/companion/course-home'
import { useCompanion } from '~/companion/store'
import { isMaterial } from '~/companion/course-home'
import { dueTopics } from '~/companion/checks'

/**
 * A course's home: the pinned first tab of its strip, and the page a course
 * opens on.
 *
 *  - On top, the course itself (`CompanionCourseHead`): name, where it
 *    stands, how far along, and Continue.
 *  - Under it, the course's views as an underline nav: Roadmap · Weeks (Path
 *    for a course of one's own) · Deadlines · Notes · Materials, and Practice
 *    once there are cards or a topic to check. Its count is the checks
 *    waiting ("3 to check") before the cards due, because a check is what
 *    moves readiness. They are views of one thing, not documents, which
 *    is why they live here and not in the strip beside open lessons.
 *  - Then the view. The roadmap is the old workspace's board, filling what is
 *    left of the window; the weeks open on this week with the Next card above
 *    it; the rest scroll. A view visited stays mounted, so coming back to it
 *    finds it where it was left.
 *
 * On a phone the course's bottom bar picks the view (the course page draws
 * it), and the head scrolls away with each view instead of staying pinned.
 */
const props = defineProps<{
  subject: Subject
  nodes: CourseNode[]
  activeNodeId: number | null
  line: string
  progress: CourseProgress
  next: ContinueTarget | null
  /** Where a note or an upload lands: "Databases · Lecture 8". */
  where: string
  uploading: number
  openItemIds: string[]
}>()

const view = defineModel<CourseView>('view', { required: true })

const emit = defineEmits<{
  continue: []
  openBox: [nodeId: number]
  write: [nodeId: number, instruction?: string]
  brief: [nodeId: number]
  progress: [nodeId: number, state: ProgressState]
  openTopic: [topic: Topic]
  openItem: [item: Item]
  newNote: []
  newBoard: []
  newLesson: []
  upload: [files: File[]]
  pick: []
}>()

const c = useCompanion()
const isPath = computed(() => props.subject.format === 'path')

const counts = computed(() => {
  const own = c.items.value.filter((i) => i.subject_id === props.subject.id)
  const now = Date.now()
  return {
    deadlines: c.deadlines.value.filter(
      (d) => d.subject_id === props.subject.id && d.status === 'upcoming' && (!d.due_at || Date.parse(d.due_at) > now),
    ).length,
    notes: own.filter((i) => i.kind === 'page' || i.kind === 'board').length,
    materials: own.filter(isMaterial).length,
    cards: c.cards.value.filter((k) => k.subject_id === props.subject.id && !k.suspended).length,
    due: c.cards.value.filter(
      (k) => k.subject_id === props.subject.id && !k.suspended && Date.parse(k.due_at) <= now + 86_400_000,
    ).length,
    toCheck: dueTopics(c, { subjectId: props.subject.id }).length,
  }
})

const NAV = computed<{ view: CourseView; label: string; count: string }[]>(() => [
  { view: 'map', label: 'Roadmap', count: '' },
  isPath.value ? { view: 'path', label: 'Path', count: '' } : { view: 'weeks', label: 'Weeks', count: '' },
  { view: 'deadlines', label: 'Deadlines', count: counts.value.deadlines ? String(counts.value.deadlines) : '' },
  { view: 'notes', label: 'Notes', count: counts.value.notes ? String(counts.value.notes) : '' },
  { view: 'materials', label: 'Materials', count: counts.value.materials ? String(counts.value.materials) : '' },
  ...(counts.value.cards || counts.value.toCheck
    ? [{
        view: 'practice' as const,
        label: 'Practice',
        count: counts.value.toCheck ? `${counts.value.toCheck} to check` : counts.value.due ? `${counts.value.due} due` : '',
      }]
    : []),
])

/* Views are mounted the first time they're shown, then kept. */
const visited = ref(new Set<CourseView>([view.value]))
watch(view, (v) => {
  if (!visited.value.has(v)) visited.value = new Set([...visited.value, v])
})

function shown(v: CourseView): boolean {
  return visited.value.has(v)
}

/* The underline slides under the view in front. */
const nav = ref<HTMLElement | null>(null)
const bar = ref({ left: 0, width: 0, ready: false })

function placeBar(): void {
  const el = nav.value?.querySelector<HTMLElement>(`[data-view="${view.value}"]`)
  // Hidden (a phone's width): measured again once it is drawn.
  if (!el || !el.offsetWidth) return
  bar.value = { left: el.offsetLeft + 10, width: el.offsetWidth - 20, ready: true }
}

let resizes: ResizeObserver | undefined
watch([view, NAV], () => nextTick(placeBar))
onMounted(() => {
  nextTick(placeBar)
  // Fonts land after the first paint and move the labels a pixel or two; a
  // window widened past the phone's line draws the nav for the first time.
  void document.fonts?.ready.then(placeBar)
  if (nav.value && 'ResizeObserver' in window) {
    resizes = new ResizeObserver(() => placeBar())
    resizes.observe(nav.value)
  }
})
onBeforeUnmount(() => resizes?.disconnect())

function onTopic(topic: Topic): void {
  emit('openTopic', topic)
}

const pane = 'om-scroll absolute inset-0 overflow-x-hidden overflow-y-auto'
const hidden = (v: CourseView) => view.value !== v && 'invisible'
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <!-- The course and the views, pinned on a desktop. -->
    <div class="shrink-0 max-lg:hidden">
      <CompanionCourseHead
        :subject="subject"
        :line="line"
        :progress="progress"
        :next="next"
        @continue="emit('continue')"
      />
      <nav
        ref="nav"
        class="relative flex items-end gap-1 overflow-x-auto border-b border-border px-6"
        aria-label="Course views"
      >
        <button
          v-for="item in NAV"
          :key="item.view"
          type="button"
          :data-view="item.view"
          :aria-current="view === item.view ? 'page' : undefined"
          :class="[
            'flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-t-[10px] px-2.5 text-[14px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cobalt',
            view === item.view ? 'font-semibold text-text' : 'font-medium text-text-muted hover:text-text',
          ]"
          @click="view = item.view"
        >
          {{ item.label }}
          <span
            v-if="item.count"
            :class="[
              'num rounded-full px-1.5 text-[11.5px] font-semibold',
              view === item.view ? 'bg-surface-sunken text-text-soft' : 'text-text-faint',
            ]"
          >{{ item.count }}</span>
        </button>
        <span
          class="pointer-events-none absolute -bottom-px h-[2px] rounded-[2px] bg-text"
          :class="bar.ready && 'transition-[left,width] duration-200 ease-out'"
          :style="{ left: `${bar.left}px`, width: `${bar.width}px`, opacity: bar.ready ? 1 : 0 }"
          aria-hidden="true"
        />
      </nav>
    </div>

    <div class="relative min-h-0 flex-1">
      <!-- Roadmap -->
      <div
        v-if="shown('map')"
        :class="[pane, hidden('map')]"
        :inert="view !== 'map'"
      >
        <CompanionCourseHead
          class="lg:hidden"
          :subject="subject"
          :line="line"
          :progress="progress"
          :next="next"
          @continue="emit('continue')"
        />
        <template v-if="nodes.length">
          <WorkspaceRoadmapBoard
            class="max-lg:hidden"
            :nodes="nodes"
            :active-node-id="activeNodeId"
            :title="subject.title"
            @open="emit('openBox', $event)"
            @expand="(id, how) => emit('write', id, how)"
            @progress="(id, state) => emit('progress', id, state)"
          />
          <WorkspaceRoadmap
            class="lg:hidden"
            :nodes="nodes"
            :active-node-id="activeNodeId"
            @focus="emit('brief', $event)"
            @progress="(id, state) => emit('progress', id, state)"
          />
        </template>
        <div
          v-else
          class="mx-auto grid max-w-[460px] justify-items-center gap-3 px-8 py-20 text-center"
        >
          <span class="grid size-12 place-items-center rounded-full bg-lime text-ink">
            <UiIcon
              name="map"
              :size="20"
            />
          </span>
          <h2 class="t-head text-[19px]">
            No topics yet
          </h2>
          <p class="text-[15px] text-text-body">
            The roadmap draws itself from the course outline and the lectures, as soon as either
            arrives. Or start it yourself with the first thing you want to learn.
          </p>
          <UiBtn
            variant="primary"
            size="md"
            icon="wand"
            @click="emit('newLesson')"
          >
            A lesson on a topic
          </UiBtn>
        </div>
      </div>

      <!-- Weeks, or the path -->
      <div
        v-if="shown(isPath ? 'path' : 'weeks')"
        :class="[pane, hidden(isPath ? 'path' : 'weeks')]"
        :inert="view !== (isPath ? 'path' : 'weeks')"
      >
        <CompanionCourseHead
          class="lg:hidden"
          :subject="subject"
          :line="line"
          :progress="progress"
          :next="next"
          @continue="emit('continue')"
        />
        <div class="mx-auto w-full max-w-[760px] px-4 pt-6 pb-20 min-[900px]:px-8">
          <CompanionCoursePath
            v-if="isPath"
            :subject="subject"
            :open-topic="onTopic"
          />
          <CompanionCourseWeeks
            v-else
            :subject="subject"
            :open-topic="onTopic"
          >
            <template #current>
              <CompanionCourseNext :subject="subject" />
            </template>
          </CompanionCourseWeeks>
        </div>
      </div>

      <div
        v-if="shown('deadlines')"
        :class="[pane, hidden('deadlines')]"
        :inert="view !== 'deadlines'"
      >
        <CompanionCourseHead
          class="lg:hidden"
          :subject="subject"
          :line="line"
          :progress="progress"
          :next="next"
          @continue="emit('continue')"
        />
        <CompanionCourseDeadlines :subject="subject" />
      </div>

      <div
        v-if="shown('notes')"
        :class="[pane, hidden('notes')]"
        :inert="view !== 'notes'"
      >
        <CompanionCourseNotesGrid
          :subject="subject"
          :open-item-ids="openItemIds"
          @open-item="emit('openItem', $event)"
          @new-note="emit('newNote')"
          @new-board="emit('newBoard')"
        />
      </div>

      <div
        v-if="shown('materials')"
        :class="[pane, hidden('materials')]"
        :inert="view !== 'materials'"
      >
        <CompanionCourseMaterials
          :subject="subject"
          :where="where"
          :uploading="uploading"
          @open-item="emit('openItem', $event)"
          @upload="emit('upload', $event)"
          @pick="emit('pick')"
        />
      </div>

      <div
        v-if="shown('practice')"
        :class="[pane, hidden('practice')]"
        :inert="view !== 'practice'"
      >
        <CompanionCoursePractice :subject="subject" />
      </div>
    </div>
  </div>
</template>
