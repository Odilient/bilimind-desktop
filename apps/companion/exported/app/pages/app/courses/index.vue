<script setup lang="ts">
/**
 * Courses: the shelf of everything being learned. Both kinds of
 * course sit on it and read the same way, as cards (`CompanionCourseCard`: a
 * cover in its colour with its path drawn along the foot, where the learner
 * is on it, the next date that counts, and a Continue that floats over the
 * bead it continues from) or, for a shelf of thirty, as a list
 * (`CompanionCoursesRow`, a hairline row each). Which of the two, and which
 * sections are folded, is remembered on this device (`useShelfPrefs`).
 *
 * The shelf is in sections, each folding under its heading (`shelfSections`,
 * in companion/shelf.ts, has the rules):
 *
 *  - the learner's own groups first ("Year 2 · Autumn", "Languages"), in name
 *    order. "New group" makes one from a list of the courses; a course's "⋯"
 *    moves it into one; a group's own "⋯" renames it in place, changes which
 *    courses are in it, or ungroups them.
 *  - then School and On your own, which is all the shelf is until the learner
 *    makes a group, and where anything in no group stays after.
 *  - last, Archived, folded: the courses put away with "Archive", as rows,
 *    each with Restore. Nothing in them is lost, and they open as before.
 *
 * "Find a course" (there once there are more than six) narrows the whole
 * shelf, archive included, to the courses with those words in their name,
 * code, lecturer or group, drawn in the same view; Enter opens the first.
 *
 * A course is made one of two ways. "Build it with AI" opens a new chat set
 * to draft one (`newChatLink({ intent: 'course' })`: one place to say what
 * you want and attach what you have); "Start from scratch" is a course typed
 * by hand, no AI (`CompanionCoursesScratchDialog`), which works on Free.
 * Connecting Moodle opens the chat's own connect step.
 *
 * "Ask about this course" in a course's menu points the assistant at that
 * course for as long as it stays open: the screen registers the course as
 * what's on it, so the panel's suggestions and its answers are about that
 * one, and closing the assistant hands the screen back to "All your courses".
 *
 * Empty, it says what a course is here (a path, drawn as a sample one) and
 * offers the one way to make one. A learner with no school course yet also
 * gets a quiet line about connecting Moodle, since that's where most courses
 * come from.
 */
import type { Subject } from '~/companion/types'
import type { MenuAction } from '~/components/ui/Menu.vue'
import { useCompanion } from '~/companion/store'
import { useAi, useAiContext } from '~/companion/ai/state'
import { newChatLink } from '~/companion/ai/routes'
import {
  findCourses,
  groupMembers,
  renameGroup,
  setGroup,
  shelfSections,
  ungroup,
  useShelfPrefs,
  type ShelfSection,
} from '~/companion/shelf'

definePageMeta({ layout: 'companion' })
const { t } = useI18n()
useHead({ title: 'Courses · BiliMind' })

const c = useCompanion()
const ai = useAi()
const toast = useToast()
const prefs = useShelfPrefs()

const own = computed(() => c.selfSubjects.value)
const week = computed(() => c.currentWeek.value)
const hasMoodle = computed(() => c.connections.value.some((x) => x.kind === 'moodle'))
const hasSchool = computed(() => c.subjects.value.some((s) => s.format === 'weeks'))
const total = computed(() => c.subjects.value.length)

const newCourse = newChatLink({ intent: 'course' })
const scratch = ref(false)
const connectMoodle = newChatLink({ connect: 'moodle' })

/* -- The sections, Archived last -------------------------------------------- */

const shelved = computed(() => shelfSections(c))

const sections = computed<ShelfSection[]>(() => [
  ...shelved.value,
  ...(c.archivedSubjects.value.length
    ? [
        {
          key: 'archived',
          label: 'Archived',
          hint: 'Off the shelf, with everything in them kept',
          group: null,
          courses: c.archivedSubjects.value,
        },
      ]
    : []),
])

function toggle(key: string): void {
  prefs.setFolded(key, !prefs.folded(key))
}

/* -- Cards or a list ---------------------------------------------------------- */

const VIEWS = [
  { value: 'cards', label: 'Cards', icon: 'grid' },
  { value: 'list', label: 'List', icon: 'steps' },
]

const view = computed({
  get: (): string => prefs.view(),
  set: (value: string) => prefs.setView(value === 'list' ? 'list' : 'cards'),
})

/* -- Find a course ------------------------------------------------------------ */

const query = ref('')
const found = computed(() => (query.value.trim() ? findCourses(c, query.value) : []))

function openFirst(): void {
  const first = found.value[0]
  if (first) void navigateTo(`/app/courses/${first.id}`)
}

/* -- Groups ----------------------------------------------------------------- */

/** The course whose "Move to group…" is open. */
const moving = ref<Subject | null>(null)

/** The group dialog: a new group (`editing` null), or the courses of one. */
const grouping = ref(false)
const editing = ref<string | null>(null)

function editGroup(name: string | null): void {
  editing.value = name
  grouping.value = true
}

/** A group being renamed in place, in its heading. */
const renaming = ref<string | null>(null)
const draft = ref('')

async function startRename(name: string): Promise<void> {
  draft.value = name
  renaming.value = name
  await nextTick()
  const field = document.getElementById('courses-group-rename') as HTMLInputElement | null
  field?.focus()
  field?.select()
}

function finishRename(save: boolean): void {
  const from = renaming.value
  if (!from) return
  renaming.value = null
  if (save) void renameGroup(c, from, draft.value).catch(() => undefined)
}

async function unGroup(name: string): Promise<void> {
  const members = groupMembers(c, name)
  try {
    await ungroup(c, name)
  } catch {
    return
  }
  toast.success({
    title: `Ungrouped ${name}`,
    body: 'Its courses are back under School and On your own.',
    action: { label: 'Undo', handler: () => void setGroup(c, members, name).catch(() => undefined) },
  })
}

function groupActions(name: string): MenuAction[] {
  return [
    { label: 'Rename', icon: 'pencil', run: () => void startRename(name) },
    { label: 'Choose courses…', icon: 'check-circle', run: () => editGroup(name) },
    { label: 'Ungroup', icon: 'layers', run: () => void unGroup(name) },
  ]
}

/* -- "Ask about this course" ------------------------------------------------- */

const asked = ref<Subject | null>(null)

useAiContext(() =>
  asked.value ? { kind: 'course', label: asked.value.title, subjectId: asked.value.id } : null,
)

function ask(subject: Subject): void {
  asked.value = subject
  ai.show({ fresh: true })
}

watch(
  () => ai.visible.value,
  (shown) => {
    if (!shown) asked.value = null
  },
)

// A course of one's own says whether it's on pace, which is Today's to work out.
watch(
  () => c.status.ready && own.value.length > 0,
  (wanted) => {
    if (wanted && !c.today.value && import.meta.client) void c.loadToday()
  },
  { immediate: true },
)

/** A sample path for the empty shelf: three done, one now, the rest ahead. */
const SAMPLE = ['done', 'done', 'done', 'now', 'ahead', 'ahead', 'ahead', 'ahead', 'ahead'] as const
</script>

<template>
  <div class="mx-auto grid w-full max-w-[1120px] content-start gap-9 px-4 pt-6 pb-24 min-[900px]:px-8 min-[900px]:pt-12">
    <div class="grid gap-5">
      <header class="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div class="grid min-w-0 flex-1 gap-1.5">
          <h1 class="t-head text-[30px] min-[900px]:text-[40px]">
            Courses
          </h1>
          <p
            v-if="c.termGoal.value"
            class="text-[15px] text-text-muted"
          >
            {{ c.termGoal.value.title }}<template v-if="week && week <= 14">
              · week {{ week }} of 14
            </template>
          </p>
        </div>
        <div class="flex shrink-0 flex-wrap gap-2">
          <UiBtn
            variant="secondary"
            size="lg"
            icon="pencil"
            title="Name it and list the topics yourself, no AI"
            @click="scratch = true"
          >
            Start from scratch
          </UiBtn>
          <UiBtn
            :to="newCourse"
            variant="primary"
            size="lg"
            icon="sparkles"
            title="Say what you want to learn; the chat drafts the course"
          >
            Build it with AI
          </UiBtn>
        </div>
      </header>

      <!-- The shelf's controls: find one, make a group, cards or a list. -->
      <div
        v-if="c.status.ready && total"
        class="flex flex-wrap items-center gap-2.5"
      >
        <label
          v-if="total > 6"
          class="flex h-10 max-w-[420px] min-w-0 flex-[1_1_240px] items-center gap-2.5 rounded-full bg-surface-sunken px-4 text-text-faint transition-shadow focus-within:bg-surface focus-within:shadow-[inset_0_0_0_2px_var(--brand)]"
        >
          <UiIcon
            name="search"
            :size="16"
            :stroke="2"
            class="shrink-0"
          />
          <input
            v-model="query"
            type="search"
            placeholder="Find a course"
            aria-label="Find a course"
            class="min-w-0 flex-1 bg-transparent text-[14.5px] text-text outline-none placeholder:text-text-faint [&::-webkit-search-cancel-button]:hidden"
            @keydown.esc="query = ''"
            @keydown.enter="openFirst"
          >
          <button
            v-if="query"
            type="button"
            class="grid size-6 shrink-0 cursor-pointer place-items-center rounded-full text-text-faint hover:bg-surface-track hover:text-text-soft"
            aria-label="Clear"
            @click="query = ''"
          >
            <UiIcon
              name="x"
              :size="13"
              :stroke="2.2"
            />
          </button>
        </label>
        <span class="flex-1" />
        <UiBtn
          v-if="c.shelf.value.length"
          variant="ghost"
          size="sm"
          icon="plus"
          title="Put courses together under a name of your own"
          @click="editGroup(null)"
        >
          New group
        </UiBtn>
        <UiSegmented
          v-model="view"
          :options="VIEWS"
          label="Show courses as"
        />
      </div>
    </div>

    <!-- Loading: the cards' own shape, cover and all. -->
    <div
      v-if="!c.status.ready"
      class="grid gap-3"
      aria-busy="true"
      aria-label="Loading courses"
    >
      <span class="cp-skel h-4 w-20" />
      <div class="grid grid-cols-[repeat(auto-fill,minmax(296px,1fr))] gap-4">
        <div
          v-for="n in 6"
          :key="n"
          class="flex h-[262px] flex-col overflow-hidden rounded-[22px] shadow-[inset_0_0_0_1px_var(--border)]"
        >
          <div class="relative h-[140px] bg-surface-sunken">
            <span class="cp-skel absolute top-4 left-4 size-10 rounded-[12px]" />
            <span class="cp-skel absolute top-5 left-[68px] h-3 w-24" />
            <span class="cp-skel absolute top-[38px] left-[68px] h-2.5 w-32" />
            <span class="cp-skel absolute inset-x-5 bottom-6 h-[3px]" />
          </div>
          <div class="grid gap-2.5 px-5 pt-4">
            <span class="cp-skel h-5 w-3/5" />
            <span class="cp-skel h-3 w-4/5" />
            <span class="cp-skel mt-2 h-7 w-40 rounded-full" />
          </div>
        </div>
      </div>
    </div>

    <!-- Nothing yet: what a course is here, drawn, and the one way to make one. -->
    <section
      v-else-if="!total"
      class="grid justify-items-center gap-5 rounded-[26px] bg-surface-sunken px-6 pt-14 pb-16 text-center"
    >
      <div
        class="relative h-3.5 w-full max-w-[280px]"
        aria-hidden="true"
      >
        <span class="absolute inset-x-[7px] top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-border-strong" />
        <span class="absolute left-[7px] top-1/2 h-[2px] w-[calc((100%_-_14px)*0.375)] -translate-y-1/2 rounded-full bg-brand" />
        <div class="relative flex h-full items-center justify-between">
          <span
            v-for="(state, i) in SAMPLE"
            :key="i"
            class="grid size-3.5 place-items-center"
          >
            <span
              :class="[
                'block rounded-full',
                state === 'done' && 'size-2 bg-brand',
                state === 'now' && 'size-3.5 bg-surface shadow-[inset_0_0_0_3px_var(--brand),0_0_0_4px_var(--brand-line)]',
                state === 'ahead' && 'size-2 bg-surface shadow-[inset_0_0_0_1.5px_var(--border-dashed)]',
              ]"
            />
          </span>
        </div>
      </div>
      <h2 class="t-head mt-2 text-[22px]">
        Your courses live here
      </h2>
      <p class="max-w-[500px] text-[15.5px] leading-relaxed text-text-body">
        A course is a path: the topics in order, a lesson for each, and the dates that count. Tell
        BiliMind what you want to learn and by when, and attach anything you have, a syllabus, slides
        or a link. It drafts the path; you say go. Or list the topics yourself.
      </p>
      <div class="flex flex-wrap justify-center gap-2">
        <UiBtn
          variant="secondary"
          size="lg"
          icon="pencil"
          @click="scratch = true"
        >
          Start from scratch
        </UiBtn>
        <UiBtn
          :to="newCourse"
          variant="primary"
          size="lg"
          icon="sparkles"
        >
          Build it with AI
        </UiBtn>
      </div>
    </section>

    <!-- Results, while something is typed: the whole shelf, archive included. -->
    <section
      v-else-if="query.trim()"
      class="grid gap-3.5"
      aria-label="Courses found"
    >
      <h2 class="text-[14px] font-semibold text-text-soft">
        {{ found.length ? `${found.length} found` : 'Nothing found' }}
      </h2>
      <CompanionCoursesList
        v-if="found.length"
        :courses="found"
        :view="prefs.view()"
        @ask="ask"
        @group="moving = $event"
      />
      <p
        v-else
        class="text-[14.5px] text-text-muted"
      >
        No course has those words. Find looks at names, codes, lecturers and groups.
      </p>
    </section>

    <template v-else>
      <p
        v-if="!shelved.length"
        class="text-[15px] text-text-muted"
      >
        Every course is archived. Restore one from Archived below, or start a new one.
      </p>

      <section
        v-for="g in sections"
        :key="g.key"
        :aria-labelledby="`courses-${g.key}`"
        class="grid gap-3.5"
      >
        <header class="flex min-h-8 items-center gap-2">
          <h2
            :id="`courses-${g.key}`"
            class="min-w-0"
          >
            <input
              v-if="g.group && renaming === g.group"
              id="courses-group-rename"
              v-model="draft"
              type="text"
              :maxlength="60"
              class="w-[min(320px,70vw)] rounded-[8px] bg-surface-sunken px-1.5 py-0.5 font-display text-[16px] font-semibold tracking-[-0.01em] text-text outline-none focus:shadow-[inset_0_0_0_1.5px_var(--brand)]"
              aria-label="Group name"
              @keydown.enter.prevent="finishRename(true)"
              @keydown.esc.prevent.stop="finishRename(false)"
              @blur="finishRename(true)"
            >
            <button
              v-else
              type="button"
              class="group/fold -ml-1 flex min-w-0 cursor-pointer items-center gap-1.5 rounded-[8px] py-0.5 pr-1.5 pl-1 outline-none focus-visible:shadow-[0_0_0_2px_var(--brand)]"
              :aria-expanded="!prefs.folded(g.key)"
              :aria-controls="`courses-${g.key}-list`"
              @click="toggle(g.key)"
            >
              <UiIcon
                name="chevron-down"
                :size="15"
                :stroke="2.2"
                :class="[
                  'shrink-0 text-text-faint transition-[color,transform] duration-150 group-hover/fold:text-text-soft',
                  prefs.folded(g.key) && '-rotate-90',
                ]"
              />
              <span class="truncate font-display text-[16px] font-semibold tracking-[-0.01em] text-text">{{ g.label }}</span>
              <span class="num text-[13px] font-medium text-text-faint">{{ g.courses.length }}</span>
            </button>
          </h2>
          <span class="flex-1" />
          <span
            v-if="g.hint"
            class="hidden truncate text-[13px] text-text-faint min-[600px]:block"
          >{{ g.hint }}</span>
          <UiMenu
            v-if="g.group"
            :actions="groupActions(g.group)"
            :title="g.label"
            :label="`More for ${g.label}`"
          />
        </header>

        <div
          v-if="!prefs.folded(g.key)"
          :id="`courses-${g.key}-list`"
        >
          <CompanionCoursesList
            :courses="g.courses"
            :view="g.key === 'archived' ? 'list' : prefs.view()"
            @ask="ask"
            @group="moving = $event"
          />
        </div>
      </section>
    </template>

    <!-- No school course yet: the quiet way to bring them all in. -->
    <NuxtLink
      v-if="c.status.ready && !hasSchool && !hasMoodle"
      :to="connectMoodle"
      class="group flex items-center gap-4 rounded-[18px] px-4 py-3.5 shadow-[inset_0_0_0_1px_var(--border)] transition-colors hover:bg-surface-mute focus-visible:outline-2 focus-visible:outline-brand"
    >
      <span class="grid size-10 shrink-0 place-items-center rounded-full bg-surface-sunken text-text-soft">
        <CompanionIcon
          name="plug"
          :size="18"
        />
      </span>
      <span class="grid min-w-0 flex-1 gap-0.5">
        <span class="text-[15px] font-semibold text-text">{{ t('course.shelf.connectMoodle') }}</span>
        <span class="text-[13.5px] text-text-muted">{{ t('course.shelf.connectMoodleHint') }}</span>
      </span>
      <CompanionIcon
        name="chevron-right"
        :size="18"
        class="shrink-0 text-text-faint transition-[color,transform] duration-150 group-hover:translate-x-0.5 group-hover:text-text-soft"
      />
    </NuxtLink>

    <CompanionCoursesMoveDialog
      :subject="moving"
      @close="moving = null"
    />
    <CompanionCoursesGroupDialog
      v-model:open="grouping"
      :group="editing"
    />
    <CompanionCoursesScratchDialog v-model:open="scratch" />
  </div>
</template>
