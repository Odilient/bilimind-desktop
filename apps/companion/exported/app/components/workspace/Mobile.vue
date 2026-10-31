<script setup lang="ts">
import type { MenuAction } from '~/components/ui/Menu.vue'
import type { Course, CourseNode, FurtherCourse, Material, ProgressState } from '~/types/api'

/**
 * The phone surface.
 *
 * Desktop and mobile are different products here. Desktop is where courses get
 * created, materials get uploaded and three panels coexist. Mobile is the
 * returning-user surface — the daily study and review §11 says the whole
 * product lives or dies on — so content is primary and everything structural
 * becomes a tab you summon.
 */
const props = defineProps<{
  course: Course
  nodes: CourseNode[]
  materials: Material[]
  activeNodeId: number | null
  /**
   * Archive and trash, passed in rather than rebuilt here: they navigate away
   * from this course, which is the page's business and not the shell's.
   */
  actions?: MenuAction[]
  /** True while the plan is being drawn again — same button, same state. */
  retrying?: boolean
  /** Open on this tab instead of Study — `?panel=plan` from Today's nudge. */
  initialTab?: 'plan'
  /**
   * False for a member of an organisation reading a course it shares: no
   * "Write lessons", and the lesson's author-only actions are hidden.
   */
  canEdit?: boolean
}>()

const emit = defineEmits<{
  open: [nodeId: number]
  changed: []
  /** Choose lessons to write — with one already chosen, when a brief asked for it. */
  expand: [nodeId?: number]
  addMaterial: []
  /** The learner marked a box on the map or a row in the sheet. */
  progress: [nodeId: number, state: ProgressState]
  /** A purple button: start a new course on this topic. */
  further: [link: FurtherCourse]
  /** The course failed before it had any lessons: draw the plan again. */
  retry: []
}>()

/* This whole tree is in the page on desktop too, hidden by `lg:hidden`. A
   NodeView counts reading time and watches its sections while `active`, so
   the hidden copy has to know it is hidden — otherwise every second on a
   lesson was counted twice, once by each layout. */
const isPhone = useIsPhone()

type MobileTab = 'study' | 'map' | 'plan' | 'files' | 'ask'

/* Nothing open is the map's moment, as on a desktop: "Nothing open" is not a
   place to arrive. */
const tab = ref<MobileTab>(props.initialTab ?? (props.activeNodeId ? 'study' : 'map'))

const TABS: Array<{ value: MobileTab; label: string; icon: string }> = [
  { value: 'study', label: 'Study', icon: 'workspace' },
  { value: 'map', label: 'Map', icon: 'spine' },
  { value: 'plan', label: 'Plan', icon: 'calendar' },
  { value: 'files', label: 'Files', icon: 'file' },
  { value: 'ask', label: 'Ask', icon: 'spark' },
]

const nodesById = computed(() => new Map(props.nodes.map((node) => [node.id, node])))

const stubCount = computed(
  () => props.nodes.filter((node) => node.status === 'stub' || node.status === 'failed').length,
)
const activeNode = computed(() =>
  props.activeNodeId ? (nodesById.value.get(props.activeNodeId) ?? null) : null,
)

/* -- The focus sheet: what one lesson is for ------------------------------- */

const focusId = ref<number | null>(null)
const focusNode = computed(() => (focusId.value ? nodesById.value.get(focusId.value) : null))

/** Open a node and land on the tab that actually shows it. */
function openAndStudy(nodeId: number): void {
  emit('open', nodeId)
  tab.value = 'study'
}

/** The sheet's button, for a lesson that is written. */
function openFocused(nodeId: number): void {
  focusId.value = null
  openAndStudy(nodeId)
}

/** The sheet's button, for a lesson that is not. */
function askToWrite(nodeId: number): void {
  focusId.value = null
  emit('expand', nodeId)
}

const blocks = ref<Record<number, never[]>>({})

/**
 * The phone workspace fills the screen: no rail, no PageHead, and no keyboard to
 * press ⌘K on. Without this button there is no way to reach search at all from
 * inside a course on a phone. The scope comes from the route, so it opens
 * narrowed to this course with a chip that removes to widen.
 */
const { openPalette } = useSearch()

/* The pen lives in this bar on a phone too: a disc in the corner of a 390px
   screen sits on the very words a thumb is trying to mark. */
const { isAuthenticated } = useAuth()
const markupMode = useMarkupMode()

const canMarkUp = computed(
  () => isAuthenticated.value && tab.value === 'study' && activeNode.value?.status === 'ready',
)
const markingUp = computed(
  () => canMarkUp.value && markupMode.nodeId.value !== null && markupMode.nodeId.value === activeNode.value?.id,
)

/* Leaving Study puts the pen away, so the tray is not waiting on return. */
watch(tab, (next) => {
  if (next !== 'study' && markingUp.value) markupMode.close()
})
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col bg-surface-canvas">
    <!--
      The workspace fills the screen on a phone, so without this there is no way
      out of a course and no reminder of which one you are in. It stays out of
      the way: 48px, the course name, and the one action that is not a tab.
    -->
    <header
      class="flex h-12 shrink-0 items-center gap-1.5 border-b border-border bg-surface/92 pr-2.5 pl-1.5 backdrop-blur-[14px]"
    >
      <NuxtLink
        to="/library"
        class="grid size-9 shrink-0 place-items-center rounded-full text-text-soft active:bg-surface-sunken"
        aria-label="Back to your courses"
      >
        <UiIcon
          name="chevron-left"
          :size="21"
          :stroke="2"
        />
      </NuxtLink>

      <p class="min-w-0 flex-1 truncate font-display text-[15px] font-semibold tracking-[-0.02em]">
        {{ course.title }}
      </p>

      <ReadingSettings
        size="sm"
        align="right"
      />

      <button
        v-if="canMarkUp"
        type="button"
        :aria-label="markingUp ? 'Put the pen away' : 'Draw, write and highlight'"
        :aria-pressed="markingUp"
        :class="[
          'grid size-9 shrink-0 place-items-center rounded-full transition-colors',
          markingUp ? 'bg-accent-soft text-accent-strong' : 'text-text-soft active:bg-surface-sunken',
        ]"
        @click="activeNode && markupMode.toggle(activeNode.id)"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.9"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-[19px]"
          aria-hidden="true"
        >
          <path d="M4 20h4L20 8a2.1 2.1 0 0 0-3-3L5 17Z" />
          <path d="m15.5 6.5 3 3" />
        </svg>
      </button>

      <button
        type="button"
        class="grid size-9 shrink-0 place-items-center rounded-full text-text-soft active:bg-surface-sunken"
        aria-label="Search"
        @click="openPalette()"
      >
        <UiIcon
          name="search"
          :size="20"
          :stroke="1.9"
        />
      </button>

      <UiBtn
        v-if="stubCount > 0 && canEdit !== false"
        variant="secondary"
        size="sm"
        class="shrink-0"
        @click="emit('expand')"
      >
        <span class="size-[7px] rounded-full bg-lime-2" />
        Write lessons
      </UiBtn>

      <UiMenu
        v-if="actions?.length"
        :actions="actions"
        :title="course.title"
        label="Course actions"
      />
    </header>

    <WorkspaceWritingStatus
      :course="course"
      :nodes="nodes"
      phone
      @open="openAndStudy"
    />

    <!-- The same failure banner the desktop header carries, for the surface
         where it matters more: a phone has no room for a second explanation. -->
    <div
      v-if="course.status === 'failed'"
      class="flex items-center gap-2.5 border-b border-danger-line bg-danger-soft px-4 py-2.5"
    >
      <UiIcon
        name="alert"
        :size="15"
        class="shrink-0 text-danger-text"
      />
      <p class="min-w-0 flex-1 text-[12.5px] leading-relaxed text-danger-text">
        {{ course.failure_reason ?? 'Something went wrong while building this course.' }}
      </p>
      <UiBtn
        v-if="nodes.length === 0"
        variant="danger"
        size="sm"
        class="shrink-0"
        icon="refresh"
        :loading="retrying"
        @click="emit('retry')"
        >Try again</UiBtn
      >
    </div>

    <div class="om-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
      <!-- ---------------------------------------------------------------- -->
      <!-- Study                                                             -->
      <!-- ---------------------------------------------------------------- -->
      <div v-if="tab === 'study'">
        <div
          v-if="!activeNode"
          class="px-5 py-16 text-center"
        >
          <UiEmptyState
            icon="spine"
            title="Nothing open"
            description="Pick a lesson from the map and it opens here."
          >
            <UiBtn
              variant="primary"
              @click="tab = 'map'"
              >Open the map</UiBtn
            >
          </UiEmptyState>
        </div>

        <div
          v-else
          class="bg-surface"
        >
          <Suspense
            :key="activeNode.id"
            timeout="0"
          >
            <WorkspaceNodeView
              :node-id="activeNode.id"
              :language="course.language"
              :level="course.level ?? undefined"
              :active="isPhone"
              :author="canEdit !== false"
              @changed="emit('changed')"
              @open="emit('open', $event)"
              @next="emit('open', $event)"
              @close="tab = 'map'"
            />

            <template #fallback>
              <div class="px-5 py-8">
                <UiSkeleton
                  w="60%"
                  h="1.5rem"
                />
                <UiSkeleton
                  h="14rem"
                  rounded="lg"
                  class="mt-6"
                />
              </div>
            </template>
          </Suspense>
        </div>
      </div>

      <!-- ---------------------------------------------------------------- -->
      <!-- Roadmap                                                           -->
      <!-- ---------------------------------------------------------------- -->
      <WorkspaceRoadmap
        v-else-if="tab === 'map'"
        :nodes="nodes"
        :active-node-id="activeNodeId"
        :further="course.further ?? []"
        @focus="focusId = $event"
        @progress="(id, state) => emit('progress', id, state)"
        @further="emit('further', $event)"
      />

      <!-- ---------------------------------------------------------------- -->
      <!-- Plan                                                              -->
      <!-- ---------------------------------------------------------------- -->
      <div v-else-if="tab === 'plan'">
        <h1 class="px-5 pt-4 text-[26px] tracking-[-0.03em] t-head">Your plan</h1>
        <div class="px-3.5">
          <WorkspacePlanPanel
            :course-id="course.id"
            :minutes-per-week="course.minutes_per_week"
            :node-count="nodes.length"
            :active-node-id="activeNodeId"
            @open="openAndStudy"
          />
        </div>
      </div>

      <!-- ---------------------------------------------------------------- -->
      <!-- Files                                                             -->
      <!-- ---------------------------------------------------------------- -->
      <div v-else-if="tab === 'files'">
        <h1 class="px-5 pt-4 text-[26px] tracking-[-0.03em] t-head">Files</h1>
        <p class="px-5 pt-1.5 text-[13.5px] leading-snug text-text-soft">
          What you added yourself. BiliMind teaches from these and quotes them back to you.
        </p>
        <div class="px-3.5">
          <WorkspaceFilesPanel
            :materials="materials"
            :nodes="nodes"
            :blocks-by-node="blocks"
            @add="emit('addMaterial')"
            @open="openAndStudy"
          />
        </div>
      </div>

      <!-- ---------------------------------------------------------------- -->
      <!-- Ask                                                               -->
      <!-- ---------------------------------------------------------------- -->
      <div
        v-else
        class="flex min-h-[70vh] flex-col bg-surface"
      >
        <div class="flex items-center gap-2 px-5 pt-4 pb-1">
          <UiIcon
            name="spark"
            :size="18"
            class="text-brand"
          />
          <h1 class="text-[24px] tracking-[-0.03em] t-head">Assistant</h1>
        </div>

        <WorkspaceAssistantMobile
          :course-id="course.id"
          :node-id="activeNodeId"
          :node-title="activeNode?.title ?? course.title"
        />
      </div>
    </div>

    <!-- ------------------------------------------------------------------ -->
    <!-- Bottom bar                                                          -->
    <!-- ------------------------------------------------------------------ -->
    <nav
      class="flex shrink-0 items-center justify-around border-t border-border bg-surface/94 px-1.5 pt-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom))] backdrop-blur-[12px]"
      aria-label="Course"
    >
      <button
        v-for="item in TABS"
        :key="item.value"
        type="button"
        :class="[
          'flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-[3px] py-1 transition-colors',
          tab === item.value ? 'text-text' : 'text-[#6b7080] dark:text-text-muted',
        ]"
        :aria-current="tab === item.value ? 'page' : undefined"
        @click="tab = item.value"
      >
        <!-- The same lime-soft tile the app's bottom bar lights. -->
        <span
          :class="[
            'grid h-[26px] w-[44px] place-items-center rounded-full transition-colors',
            tab === item.value ? 'bg-accent-soft text-accent-strong' : '',
          ]"
        >
          <UiIcon
            :name="item.icon"
            :size="20"
            :stroke="tab === item.value ? 2.1 : 1.8"
          />
        </span>
        <span
          :class="['text-[10.5px]', tab === item.value ? 'font-semibold' : 'font-medium']"
          >{{ item.label }}</span
        >
      </button>
    </nav>

    <!-- ------------------------------------------------------------------ -->
    <!-- Focus sheet — what the roadmap's spine had to leave out             -->
    <!-- ------------------------------------------------------------------ -->
    <UiSheet
      :open="focusId !== null"
      @update:open="focusId = $event ? focusId : null"
    >
      <WorkspaceNodeBrief
        v-if="focusNode"
        :node="focusNode"
        :nodes="nodes"
        phone
        @open="openFocused"
        @expand="askToWrite"
        @focus="focusId = $event"
        @progress="(id, state) => emit('progress', id, state)"
      />
    </UiSheet>
  </div>
</template>
