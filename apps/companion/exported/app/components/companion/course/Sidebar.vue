<script setup lang="ts">
import type { CourseNode, ProgressState } from '~/types/api'
import type { Item, Subject } from '~/companion/types'
import type { MenuAction } from '~/components/ui/Menu.vue'
import type { NewKind } from '~/companion/notes/new'
import { useCompanion } from '~/companion/store'
import { usePanelWidth } from '~/companion/panel-width'
import { isMaterial, type CourseView } from '~/companion/course-home'
import { useCourseNav, type CourseNavItem } from './Home.vue'
const { t } = useI18n()

/**
 * The left panel of a course, on the paper beside the page's card
 * (docs/design/daylight2/course.html `.sb`): the whole course at once,
 * nothing behind a switch.
 *
 *  - The course switcher: its cover, name and code · lecturer; it opens the
 *    other courses, All courses and the course's actions.
 *  - The countdown (`CompanionCourseExamCard`): the date that matters most,
 *    days left, the topics as a bar of status colours.
 *  - The course's views (Path, Grades, Practice) with their counts; each
 *    opens the home on that view.
 *  - "Find in this course": one field that narrows all three lists below as
 *    you type, so a lesson, a note or last week's slides are one word away.
 *  - Lessons: the old `WorkspaceNodeList`, handed the topics as lesson boxes
 *    (`companion/roadmap.ts`), so numbering, the status dot and
 *    right-click-to-mark behave as they always did. Its chapters (this term's
 *    weeks, or a path's units) fold; this week's, or the unit being worked
 *    on, starts open. A lesson not written yet offers "Write" on hover.
 *  - Notes & whiteboards: the course's pages as the same tree Notes draws
 *    (`CompanionCourseNotesList`: rename, pin, move, drag to nest), or the
 *    matches, flat, while searching (`SidebarNotes`). Its "+" is Notes' own
 *    list cut to pages and whiteboards (and their templates).
 *  - Materials: what the school gave, by week (`SidebarMaterials`). Its "+"
 *    is the same list cut to files, photos, links and, where the course
 *    allows it, a recording.
 *
 * Both "+"s hand the pick to the course page (`here`), which files it under
 * the class you're in and opens it as a tab; nothing leaves the course.
 *
 * Each part folds under its heading and the fold is remembered per course,
 * so a learner who never looks at the files can keep them out of the way.
 * Every row opens beside the others as a tab; nothing here leaves the course.
 */
const props = defineProps<{
  subject: Subject
  nodes: CourseNode[]
  activeNodeId: number | null
  openNodeIds: number[]
  activeItemId: string | null
  openItemIds: string[]
  homeOpen: boolean
  actions: MenuAction[]
  /** Chapters open by default: this week's, the current unit's. */
  openChapters: string[]
  currentChapter: string | null
  canRecord: boolean
  /** The home's view in front, lit in the nav while the home is. */
  view: CourseView
  /** Steps recalled in a check: the filled leaf mark. */
  checkedIds: number[]
}>()

const emit = defineEmits<{
  home: [view?: CourseView]
  openNode: [nodeId: number]
  write: [nodeId: number]
  progress: [nodeId: number, state: ProgressState]
  openItem: [item: Item]
  newNote: [template: string | null]
  newBoard: [template: string | null]
  newLesson: []
  upload: []
  photo: []
  link: [url: string]
  record: []
}>()

const NOTE_KINDS: NewKind[] = ['page', 'board', 'draft']
const materialKinds = computed<NewKind[]>(() =>
  props.canRecord ? ['upload', 'photo', 'link', 'record'] : ['upload', 'photo', 'link'],
)

function onPick(kind: NewKind, template: string | null): void {
  if (kind === 'page') emit('newNote', template)
  else if (kind === 'board') emit('newBoard', template)
  else if (kind === 'upload') emit('upload')
  else if (kind === 'photo') emit('photo')
  else if (kind === 'record') emit('record')
}

const c = useCompanion()
const filter = ref('')
const field = ref<HTMLInputElement | null>(null)

const noteCount = computed(
  () => c.items.value.filter((i) => i.subject_id === props.subject.id && (i.kind === 'page' || i.kind === 'board')).length,
)
const materialCount = computed(
  () => c.items.value.filter((i) => i.subject_id === props.subject.id && isMaterial(i)).length,
)
const lessonCount = computed(() => props.nodes.length)

const lessonMatches = computed(() => {
  const needle = filter.value.trim().toLowerCase()
  return !needle || props.nodes.some((n) => n.title.toLowerCase().includes(needle))
})

/* -- Which parts are folded, per course, on this device -------------------- */

type Part = 'lessons' | 'notes' | 'materials'
const folded = ref<Record<Part, boolean>>({ lessons: false, notes: false, materials: false })
const storageKey = computed(() => `bm:course-sections:${props.subject.id}`)

function load(): void {
  try {
    const raw = localStorage.getItem(storageKey.value)
    folded.value = { lessons: false, notes: false, materials: false, ...(raw ? JSON.parse(raw) : {}) }
  } catch {
    folded.value = { lessons: false, notes: false, materials: false }
  }
}

function toggle(part: Part): void {
  folded.value = { ...folded.value, [part]: !folded.value[part] }
  try {
    localStorage.setItem(storageKey.value, JSON.stringify(folded.value))
  } catch {
    // Remembered for this visit only.
  }
}

onMounted(load)
watch(storageKey, load)

const size = usePanelWidth('column')

/* -- The course switcher and the views -------------------------------------- */

const NAV = useCourseNav(() => props.subject)
// The sidebar names the home's views that are about the course itself; Notes,
// Materials and Practice have their own parts below.
const SIDE_VIEWS = new Set<CourseView>(['map', 'weeks', 'path', 'deadlines', 'grades', 'practice'])
const nav = computed(() => NAV.value.filter((item) => SIDE_VIEWS.has(item.view)))
const isOn = (item: CourseNavItem) => props.homeOpen && item.views.includes(props.view)

const subtitle = computed(() =>
  [props.subject.code, props.subject.lecturer].filter(Boolean).join(' · ') ||
  (props.subject.format === 'path' ? t('course.side.alone') : t('course.side.course')),
)

const switcher = ref<HTMLElement | null>(null)
const switching = ref(false)
const others = computed(() => c.shelf.value.filter((s) => s.id !== props.subject.id))

function onDocClick(event: MouseEvent): void {
  if (switching.value && !switcher.value?.contains(event.target as Node)) switching.value = false
}
onMounted(() => document.addEventListener('click', onDocClick, true))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick, true))

/** While searching, every part shows what it found. */
function isOpen(part: Part): boolean {
  return filter.value.trim() !== '' || !folded.value[part]
}

function onFieldKey(event: KeyboardEvent): void {
  if (event.key === 'Escape' && filter.value) {
    event.stopPropagation()
    filter.value = ''
  }
}
</script>

<template>
  <aside
    class="relative flex shrink-0 flex-col"
    :aria-label="t('course.side.course')"
    :style="{ width: size.css.value }"
  >
    <CompanionShellResizeHandle
      panel="column"
      edge="right"
      :label="t('course.side.resize')"
      class="right-0 translate-x-1/2"
    />
    <!-- course.html's sidebar head: the course switcher, the countdown, the course's views. -->
    <div class="shrink-0 px-2 pt-2.5">
      <div
        ref="switcher"
        class="relative"
      >
        <button
          type="button"
          class="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left transition-colors hover:bg-[rgb(var(--wash-rgb)/0.035)] focus-visible:outline-2 focus-visible:outline-brand"
          :aria-expanded="switching"
          aria-haspopup="menu"
          :title="`${subject.title}: switch course`"
          @click="switching = !switching"
        >
          <CompanionCourseCover
            :subject="subject"
            size="sm"
            :px="34"
          />
          <span class="min-w-0 flex-1">
            <b class="block truncate text-[14px] font-bold tracking-[-0.015em] text-text">{{ subject.title }}</b>
            <small class="block truncate text-[12px] text-text-muted">{{ subtitle }}</small>
          </span>
          <UiIcon
            name="chevron-down"
            :size="15"
            class="shrink-0 text-text-faint"
          />
        </button>
        <Transition
          enter-active-class="transition duration-200 ease-[var(--ease)]"
          enter-from-class="opacity-0 -translate-y-1 scale-[0.98]"
          leave-active-class="transition duration-100"
          leave-to-class="opacity-0"
        >
          <div
            v-if="switching"
            role="menu"
            class="absolute top-full right-0 left-0 z-40 mt-1 grid gap-px rounded-[14px] bg-surface p-1.5 shadow-[var(--shadow-pop)]"
          >
            <NuxtLink
              v-for="other in others"
              :key="other.id"
              role="menuitem"
              :to="`/app/courses/${other.id}`"
              class="flex h-9 items-center gap-2.5 rounded-[9px] px-2 text-[13.5px] font-medium text-text-dim transition-colors hover:bg-surface-sunken hover:text-text"
              @click="switching = false"
            >
              <CompanionCourseCover
                :subject="other"
                size="sm"
                :px="22"
              />
              <span class="min-w-0 truncate">{{ other.title }}</span>
            </NuxtLink>
            <div
              v-if="others.length"
              class="my-1 border-t border-border-rule"
            />
            <NuxtLink
              role="menuitem"
              to="/app/courses"
              class="flex h-9 items-center gap-2.5 rounded-[9px] px-2 text-[13.5px] font-medium text-text-dim transition-colors hover:bg-surface-sunken hover:text-text"
              @click="switching = false"
            >
              <span class="grid size-[22px] place-items-center text-text-muted">
                <UiIcon
                  name="grid"
                  :size="15"
                />
              </span>
              {{ t('course.side.all') }}
            </NuxtLink>
            <template
              v-for="action in actions"
              :key="action.label"
            >
              <div
                v-if="action.destructive"
                class="my-1 border-t border-border-rule"
              />
              <button
                type="button"
                role="menuitem"
                :disabled="action.disabled"
                :class="[
                  'flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-[9px] px-2 text-left text-[13.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  action.destructive ? 'text-danger hover:bg-danger-soft' : 'text-text-dim hover:bg-surface-sunken hover:text-text',
                ]"
                @click="switching = false; action.run()"
              >
                <span class="grid size-[22px] place-items-center opacity-80">
                  <UiIcon
                    v-if="action.icon"
                    :name="action.icon"
                    :size="15"
                  />
                </span>
                {{ action.label }}
              </button>
            </template>
          </div>
        </Transition>
      </div>

      <CompanionCourseExamCard
        class="mt-2.5 mb-2"
        :subject="subject"
        :nodes="nodes"
        :checked-ids="checkedIds"
      />

      <nav
        class="mt-1 grid gap-px"
        :aria-label="t('course.side.views')"
      >
        <button
          v-for="item in nav"
          :key="item.label"
          type="button"
          :aria-current="isOn(item) ? 'page' : undefined"
          :class="[
            'flex h-[30px] w-full cursor-pointer items-center gap-[9px] rounded-[8px] px-2 text-left text-[13.5px] font-medium transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand',
            isOn(item)
              ? 'bg-surface text-text shadow-[0_0_0_1px_var(--border),var(--shadow-card)]'
              : 'text-text-soft hover:bg-[rgb(var(--wash-rgb)/0.035)] hover:text-text',
          ]"
          @click="emit('home', item.view)"
        >
          <CompanionIcon
            :name="item.icon"
            :size="16"
            :stroke="1.9"
            :class="isOn(item) ? 'text-text' : 'text-text-muted'"
          />
          <span class="min-w-0 truncate">{{ item.label }}</span>
          <span
            v-if="item.count"
            :class="[
              'num ml-auto shrink-0 text-[11.5px] font-semibold',
              item.warn ? 'rounded-full bg-rose-soft px-[7px] py-px text-rose-ink' : 'text-text-muted',
            ]"
          >{{ item.count }}</span>
        </button>
      </nav>
    </div>

    <!-- One field narrows the whole course. -->
    <div class="shrink-0 px-2 pt-2.5 pb-1">
      <label
        class="flex h-8 items-center gap-2 rounded-[9px] px-2.5 shadow-[inset_0_0_0_1px_var(--border)] transition-[box-shadow,background-color] focus-within:bg-surface focus-within:shadow-[inset_0_0_0_1.5px_var(--color-brand)]"
      >
        <UiIcon
          name="search"
          :size="14"
          class="shrink-0 text-text-faint"
        />
        <input
          ref="field"
          v-model="filter"
          type="search"
          :placeholder="t('course.side.find')"
          :aria-label="t('course.side.find')"
          class="min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-text-faint [&::-webkit-search-cancel-button]:hidden"
          @keydown="onFieldKey"
        >
        <button
          v-if="filter"
          type="button"
          class="grid size-5 shrink-0 cursor-pointer place-items-center rounded-full text-text-faint transition-colors hover:bg-surface-track hover:text-text"
          :aria-label="t('course.side.clear')"
          @click="filter = ''; field?.focus()"
        >
          <UiIcon
            name="x"
            :size="11"
            :stroke="2.4"
          />
        </button>
      </label>
    </div>

    <div class="om-scroll min-h-0 flex-1 overflow-y-auto pr-1.5 pb-6 pl-2">
      <CompanionCourseSidebarSection
        :title="t('course.side.topics')"
        :count="lessonCount"
        :open="isOpen('lessons')"
        :add-label="t('course.side.addTopic')"
        @toggle="toggle('lessons')"
        @add="emit('newLesson')"
      >
        <WorkspaceNodeList
          v-if="nodes.length && lessonMatches"
          :nodes="nodes"
          :active-node-id="activeNodeId"
          :open-node-ids="openNodeIds"
          :filter="filter"
          :open-chapters="openChapters"
          :current-chapter="currentChapter"
          :checked-ids="checkedIds"
          fold-chapters
          writable
          class="pt-0!"
          @open="emit('openNode', $event)"
          @write="emit('write', $event)"
          @progress="(id, state) => emit('progress', id, state)"
        />
        <p
          v-else
          class="px-2 py-1 text-[12.5px] leading-relaxed text-text-muted"
        >
          {{
            filter
              ? t('course.side.noLessons')
              : t('course.side.noTopics')
          }}
        </p>
      </CompanionCourseSidebarSection>

      <CompanionCourseSidebarSection
        :title="t('course.side.notes')"
        :count="noteCount"
        :open="isOpen('notes')"
        class="mt-1"
        @toggle="toggle('notes')"
      >
        <template #add>
          <CompanionNotesNewButton
            :subject-id="subject.id"
            :kinds="NOTE_KINDS"
            :name="t('course.side.newPage', { title: subject.title })"
            align="end"
            here
            @pick="onPick"
          />
        </template>
        <!-- Searching: the matches, flat. Otherwise the same tree as Notes. -->
        <CompanionCourseSidebarNotes
          v-if="filter.trim()"
          :subject="subject"
          :active-item-id="activeItemId"
          :open-item-ids="openItemIds"
          :filter="filter"
          @open-item="emit('openItem', $event)"
        />
        <CompanionCourseNotesList
          v-else
          :subject="subject"
          :active-item-id="activeItemId"
          :open-item-ids="openItemIds"
          class="pt-0!"
          @open-item="emit('openItem', $event)"
        />
      </CompanionCourseSidebarSection>

      <CompanionCourseSidebarSection
        :title="t('course.side.materials')"
        :count="materialCount"
        :open="isOpen('materials')"
        class="mt-1"
        @toggle="toggle('materials')"
      >
        <template #add>
          <CompanionNotesNewButton
            :subject-id="subject.id"
            :kinds="materialKinds"
            :name="t('course.side.addMaterials', { title: subject.title })"
            align="end"
            here
            @pick="onPick"
            @link="emit('link', $event)"
          />
        </template>
        <CompanionCourseSidebarMaterials
          :subject="subject"
          :filter="filter"
          @open-item="emit('openItem', $event)"
        />
      </CompanionCourseSidebarSection>
    </div>
  </aside>
</template>
