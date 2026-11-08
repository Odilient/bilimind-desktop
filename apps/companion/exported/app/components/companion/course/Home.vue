<script lang="ts">
import type { Subject as CourseSubject } from '~/companion/types'
import type { CourseView as View } from '~/companion/course-home'
import { useCompanion as companion } from '~/companion/store'
import { isMaterial as material } from '~/companion/course-home'
import { dueTopics as due } from '~/companion/checks'
import { runningGrade as running } from '~/companion/grades'
import { translate as tl } from '~/utils/i18n'

export interface CourseNavItem {
  view: View
  label: string
  count: string
  icon: string
  /** The count is a warning (checks waiting): the rose pill. */
  warn?: boolean
  /** Every view this item stands for; it's lit while any of them is in front. */
  views: View[]
}

/** Map, the list (Weeks, or a path's steps) and the dates: one tab, Path. */
export const PATH_VIEWS: View[] = ['map', 'weeks', 'path', 'deadlines']

/**
 * The course's views with their counts, for the home's switch, the sidebar's
 * nav and the phone's bar, which say the same thing in three places.
 *
 * Path opens on whichever of its two views was looked at last (the map unless
 * the list was), so going to Grades and back doesn't swap the picture.
 */
export function useCourseNav(subject: () => CourseSubject) {
  const c = companion()
  const isPath = () => subject().format === 'path'
  const lastPathView = useState<View>('course:path-view', () => 'map')
  const counts = computed(() => {
    const own = c.items.value.filter((i) => i.subject_id === subject().id)
    const now = Date.now()
    return {
      notes: own.filter((i) => i.kind === 'page' || i.kind === 'board').length,
      materials: own.filter(material).length,
      cards: c.cards.value.filter((k) => k.subject_id === subject().id && !k.suspended).length,
      due: c.cards.value.filter(
        (k) => k.subject_id === subject().id && !k.suspended && Date.parse(k.due_at) <= now + 86_400_000,
      ).length,
      toCheck: due(c, { subjectId: subject().id }).length,
    }
  })

  const graded = computed(() => {
    const course = c.deadlines.value.filter((d) => d.subject_id === subject().id)
    return { any: course.some((d) => d.weight_pct || d.grade != null), running: running(course) }
  })

  const pathView = (): View => {
    const last = lastPathView.value
    return last === 'map' ? 'map' : isPath() ? 'path' : 'weeks'
  }

  return computed<CourseNavItem[]>(() => [
    { view: pathView(), label: tl('course.home.path'), count: '', icon: 'path', views: PATH_VIEWS },
    // Tasks and grades: a school course is graded; one of the
    // learner's own shows Grades once something in it carries a weight or a mark.
    ...(!isPath() || graded.value.any
      ? [{ view: 'grades' as const, label: tl('course.home.grades'), count: graded.value.running ? `${graded.value.running.percent}%` : '', icon: 'cap', views: ['grades' as const] }]
      : []),
    { view: 'notes', label: tl('course.home.notes'), count: counts.value.notes ? String(counts.value.notes) : '', icon: 'notebook', views: ['notes'] },
    { view: 'materials', label: tl('course.home.materials'), count: counts.value.materials ? String(counts.value.materials) : '', icon: 'file', views: ['materials'] },
    ...(counts.value.cards || counts.value.toCheck
      ? [{
          view: 'practice' as const,
          label: tl('course.home.practice'),
          count: counts.value.toCheck ? tl('course.home.toCheck', { n: counts.value.toCheck }) : counts.value.due ? tl('course.home.due', { n: counts.value.due }) : '',
          icon: 'cards',
          warn: counts.value.toCheck > 0,
          views: ['practice' as const],
        }]
      : []),
  ])
}
</script>

<script setup lang="ts">
import type { CourseNode, ProgressState } from '~/types/api'
import type { Item, Subject, Topic } from '~/companion/types'
import type { ContinueTarget, CourseProgress, CourseView } from '~/companion/course-home'
const { t } = useI18n()

/**
 * A course's home: the pinned first tab of its strip, and the page a course
 * opens on.
 *
 *  - On top, the course itself (`CompanionCourseHead`): name, where it
 *    stands, how far along, and Continue.
 *  - Under it, the course's views as a segmented switch: Path · Grades (at
 *    school, or once something is weighted or marked) · Notes · Materials,
 *    and Practice once there are cards or a topic to check. Its count is the
 *    checks waiting ("3 to check") before the cards due, because a check is
 *    what moves readiness. They are views of one thing, not documents, which
 *    is why they live here and not in the strip beside open lessons.
 *  - Path is the course itself, two ways (`CompanionCoursePathBar`, on the
 *    switch's right): the map, or the list (by week at school, by step on a
 *    path of one's own), with its dates as a small table from the corner and
 *    the full list of dates one link further. These were three tabs (Map,
 *    Weeks, Deadlines) that a learner couldn't tell apart.
 *  - Then the view. The map is the old workspace's board, filling what is
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
  compose: [nodeId: number]
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

const isPath = computed(() => props.subject.format === 'path')
/** The lesson the head's Continue opens (`lesson:<id>`), for the map to mark; `null` when it opens no lesson. */
const nextNodeId = computed(() => {
  const m = props.next?.open.match(/^lesson:(\d+)$/)
  return m ? Number(m[1]) : null
})

const NAV = useCourseNav(() => props.subject)
const onPath = computed(() => PATH_VIEWS.includes(view.value))
const isOn = (item: CourseNavItem) => item.views.includes(view.value)

// The Path tab reopens on the view looked at last (useCourseNav reads it).
const lastPathView = useState<CourseView>('course:path-view', () => 'map')
watch(
  view,
  (v) => {
    if (v === 'map' || v === 'weeks' || v === 'path') lastPathView.value = v
  },
  { immediate: true },
)

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
  const el = nav.value?.querySelector<HTMLElement>('[aria-current="page"]')
  // Hidden (a phone's width): measured again once it is drawn.
  if (!el || !el.offsetWidth) return
  bar.value = { left: el.offsetLeft, width: el.offsetWidth, ready: true }
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
      <!-- The views, as course.html's segmented switch: a card slides under the one in front.
           On Path, its own two views and the dates sit at the row's right end. -->
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-[30px] pt-4 pb-3">
        <nav
          ref="nav"
          class="relative inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[10px] bg-[rgb(var(--wash-rgb)/0.065)] p-[3px] [scrollbar-width:none]"
          :aria-label="t('course.side.views')"
        >
          <span
            class="pointer-events-none absolute top-[3px] left-0 h-7 rounded-[8px] bg-surface shadow-[var(--shadow-card),0_0_0_1px_var(--border)]"
            :class="bar.ready && 'transition-[transform,width] duration-[450ms] ease-[var(--ease)] motion-reduce:transition-none'"
            :style="{ width: `${bar.width}px`, transform: `translateX(${bar.left}px)`, opacity: bar.ready ? 1 : 0 }"
            aria-hidden="true"
          />
          <button
            v-for="item in NAV"
            :key="item.label"
            type="button"
            :aria-current="isOn(item) ? 'page' : undefined"
            :class="[
              'relative z-[1] flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-[8px] px-[11px] text-[13px] font-semibold whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand',
              isOn(item) ? 'text-text' : 'text-text-muted hover:text-text',
            ]"
            @click="isOn(item) || (view = item.view)"
          >
            {{ item.label }}
            <!-- The switch is one row: a waiting count is its number alone here, in full in the sidebar. -->
            <span
              v-if="item.count"
              :class="[
                'num text-[11.5px] font-semibold',
                item.warn ? 'rounded-full bg-rose-soft px-1.5 text-rose-ink' : 'text-text-faint',
              ]"
              :title="item.count"
            >{{ item.warn ? item.count.split(' ')[0] : item.count }}</span>
          </button>
        </nav>
        <CompanionCoursePathBar
          v-if="onPath"
          v-model:view="view"
          :subject="subject"
        />
      </div>
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
        <CompanionCoursePathBar
          v-model:view="view"
          class="px-4 pb-3 lg:hidden"
          :subject="subject"
        />
        <template v-if="nodes.length">
          <WorkspaceRoadmapBoard
            class="max-lg:hidden"
            :nodes="nodes"
            :active-node-id="activeNodeId"
            :here-node-id="nextNodeId"
            :title="subject.title"
            @open="emit('openBox', $event)"
            @expand="(id, how) => emit('write', id, how)"
            can-compose
            @compose="emit('compose', $event)"
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
          <span class="grid size-12 place-items-center rounded-full bg-accent text-on-accent">
            <UiIcon
              name="map"
              :size="20"
            />
          </span>
          <h2 class="t-head text-[19px]">
            {{ t('course.home.noTopics') }}
          </h2>
          <p class="text-[15px] text-text-body">
            {{ t('course.home.noTopicsBody') }}
          </p>
          <UiBtn
            variant="primary"
            size="md"
            icon="plus"
            @click="emit('newLesson')"
          >
            {{ t('course.home.addTopic') }}
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
        <CompanionCoursePathBar
          v-model:view="view"
          class="px-4 pb-3 lg:hidden"
          :subject="subject"
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
          <!-- The class (landing 08 Together): who's in it, what they added, the link to invite more.
               A course of one's own gets one line and Invite. -->
          <CompanionClassPanel
            :subject="subject"
            class="mt-10"
          />
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
        <CompanionCoursePathBar
          v-model:view="view"
          class="px-4 pb-3 lg:hidden"
          :subject="subject"
        />
        <CompanionCourseDeadlines :subject="subject" />
      </div>

      <!-- Grades -->
      <div
        v-if="shown('grades')"
        :class="[pane, hidden('grades')]"
        :inert="view !== 'grades'"
      >
        <CompanionCourseHead
          class="lg:hidden"
          :subject="subject"
          :line="line"
          :progress="progress"
          :next="next"
          @continue="emit('continue')"
        />
        <CompanionGradesView :subject="subject" />
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
