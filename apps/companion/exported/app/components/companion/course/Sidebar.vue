<script setup lang="ts">
import type { CourseNode, ProgressState } from '~/types/api'
import type { Item, Subject } from '~/companion/types'
import type { MenuAction } from '~/components/ui/Menu.vue'
import type { NewKind } from '~/companion/notes/new'
import { useCompanion } from '~/companion/store'
import { usePanelWidth } from '~/companion/panel-width'
import { courseColor } from '~/companion/colors'
import { isMaterial } from '~/companion/course-home'

/**
 * The left panel of a course, in the old workspace's own panel
 * (`WorkspaceSidebar`'s chrome, `bg-surface-chrome`): the whole course at
 * once, nothing behind a switch.
 *
 *  - The course's own row: its colour and name (which opens the course's
 *    home), and its "…".
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
}>()

const emit = defineEmits<{
  home: []
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
    class="relative flex shrink-0 flex-col border-r border-border bg-surface-chrome"
    aria-label="Course"
    :style="{ width: size.css.value }"
  >
    <CompanionShellResizeHandle
      panel="column"
      edge="right"
      label="Resize the course sidebar"
      class="right-0 translate-x-1/2"
    />
    <!-- The course's own row: the way home, and its menu. -->
    <div class="flex items-center gap-1 pt-3 pr-2 pb-2 pl-2.5">
      <button
        type="button"
        :class="[
          'flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-[10px] px-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-cobalt',
          homeOpen ? 'bg-surface shadow-[inset_0_0_0_1px_var(--border)]' : 'hover:bg-surface-mute',
        ]"
        :title="`${subject.title}: the course's home`"
        @click="emit('home')"
      >
        <span
          class="size-2.5 shrink-0 rounded-full"
          :style="{ background: courseColor(subject.color) }"
        />
        <span class="min-w-0 flex-1 truncate font-display text-[15px] font-semibold tracking-[-0.01em] text-text">{{ subject.title }}</span>
      </button>
      <UiMenu
        v-if="actions.length"
        :actions="actions"
        :title="subject.title"
        label="Course actions"
      />
    </div>

    <!-- One field narrows the whole course. -->
    <div class="px-3 pb-2">
      <label
        class="flex h-8 items-center gap-2 rounded-[10px] bg-surface px-2.5 shadow-[inset_0_0_0_1px_var(--border)] transition-shadow focus-within:shadow-[inset_0_0_0_1.5px_var(--color-cobalt)]"
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
          placeholder="Find in this course"
          aria-label="Find in this course"
          class="min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-text-faint [&::-webkit-search-cancel-button]:hidden"
          @keydown="onFieldKey"
        >
        <button
          v-if="filter"
          type="button"
          class="grid size-5 shrink-0 cursor-pointer place-items-center rounded-full text-text-faint transition-colors hover:bg-surface-track hover:text-text"
          aria-label="Clear"
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

    <div class="om-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-6">
      <CompanionCourseSidebarSection
        title="Lessons"
        :count="lessonCount"
        :open="isOpen('lessons')"
        add-label="A lesson on a topic"
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
              ? 'No lessons match.'
              : 'No topics yet. They come from the course outline and the lectures, as soon as either arrives.'
          }}
        </p>
      </CompanionCourseSidebarSection>

      <CompanionCourseSidebarSection
        title="Notes & whiteboards"
        :count="noteCount"
        :open="isOpen('notes')"
        class="mt-1"
        @toggle="toggle('notes')"
      >
        <template #add>
          <CompanionNotesNewButton
            :subject-id="subject.id"
            :kinds="NOTE_KINDS"
            :name="`New page or whiteboard in ${subject.title}`"
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
        title="Materials"
        :count="materialCount"
        :open="isOpen('materials')"
        class="mt-1"
        @toggle="toggle('materials')"
      >
        <template #add>
          <CompanionNotesNewButton
            :subject-id="subject.id"
            :kinds="materialKinds"
            :name="`Add materials to ${subject.title}`"
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
