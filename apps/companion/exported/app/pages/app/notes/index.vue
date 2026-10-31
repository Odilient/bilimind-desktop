<script setup lang="ts">
import type { Note } from '~/companion/notes/tree'
import { byEdited, matchNotes } from '~/companion/notes/tree'
import { noteIcon } from '~/companion/notes/tree'
import {
  folderKey,
  noteTo,
  setExpanded,
  useNoteCreate,
  useNotesSidebar,
  useNotesTree,
} from '~/companion/notes/actions'
import { courseColor } from '~/companion/colors'
import { dayKey, daysBetween, untilLabel } from '~/companion/time'
import { useCompanion } from '~/companion/store'

/**
 * Notes' home: what to start, and what you were in.
 *
 * On a desk, beside the sidebar: the big "Notes" heading and a search over
 * every note's words; "Start something", the shapes a page or whiteboard can
 * start in as tiles that make it at once (in My notes); then Recent as cards
 * (a page's first lines, a corner of a board, a photo) under Today, This
 * week and Earlier; and the courses at a glance, each with its latest notes.
 * Typing in the search turns Recent into the results.
 *
 * With nothing written yet, Recent is a short paragraph on how notes and
 * courses fit together, and one button, a blank page.
 *
 * On a phone this is the sidebar itself, full width (search, Recent, Pinned,
 * My notes, the courses), with the tiles as a strip above it and the app's
 * bottom bar under it; the header has "+ New" (every kind of note) and Ask.
 */
useHead({ title: 'Notes · BiliMind' })

const store = useCompanion()
const create = useNoteCreate()
const isPhone = useIsPhone()
const sidebar = useNotesSidebar()
const { everything: notes } = useNotesTree(store)

/* -- Search ------------------------------------------------------------------ */

const query = ref('')
const results = computed(() => (query.value.trim() ? matchNotes(notes.value, query.value).slice(0, 24) : []))

function openFirst(): void {
  const first = results.value[0]
  if (first) void navigateTo(noteTo(first.id))
}

/* -- Recent, by when ---------------------------------------------------------- */

const SHOWN = 9
const showAll = ref(false)

const groups = computed(() => {
  const today = dayKey()
  const sorted = [...notes.value].sort(byEdited)
  const out: { key: string; label: string; notes: Note[]; more: number }[] = [
    { key: 'today', label: 'Today', notes: [], more: 0 },
    { key: 'week', label: 'This week', notes: [], more: 0 },
    { key: 'earlier', label: 'Earlier', notes: [], more: 0 },
  ]
  for (const note of sorted) {
    const at = note.updated_at ?? note.created_at
    const days = at ? daysBetween(dayKey(at), today) : 99
    out[days <= 0 ? 0 : days < 7 ? 1 : 2]!.notes.push(note)
  }
  for (const g of out) {
    const cap = g.key === 'today' ? 12 : SHOWN
    if (!showAll.value && g.notes.length > cap) {
      g.more = g.notes.length - cap
      g.notes = g.notes.slice(0, cap)
    }
  }
  return out.filter((g) => g.notes.length)
})

/* -- The courses at a glance ------------------------------------------------- */

const courses = computed(() =>
  store.subjects.value
    .map((s) => {
      const own = notes.value.filter((n) => n.subject_id === s.id).sort(byEdited)
      const pages = own.filter((n) => n.kind === 'page').length
      const boards = own.filter((n) => n.kind === 'board').length
      const rest = own.length - pages - boards
      return {
        subject: s,
        latest: own.slice(0, 3),
        counts: [
          pages ? `${pages} ${pages === 1 ? 'page' : 'pages'}` : '',
          boards ? `${boards} ${boards === 1 ? 'whiteboard' : 'whiteboards'}` : '',
          rest ? `${rest} more` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        edited: own[0]?.updated_at ?? null,
      }
    })
    .filter((c) => c.latest.length),
)

/** The course's folder in the sidebar, unfolded and in view. */
function revealCourse(subjectId: string): void {
  sidebar.set(true)
  setExpanded(folderKey(subjectId), true)
  nextTick(() =>
    document
      .querySelector(`[data-folder="${subjectId}"]`)
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
  )
}

function when(note: Note): string {
  const at = note.updated_at ?? note.created_at
  return at && Date.parse(at) <= Date.now() ? untilLabel(at) : ''
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <!-- ------------------------------------------------------------------ -->
    <!-- Desktop                                                            -->
    <!-- ------------------------------------------------------------------ -->
    <div class="flex min-h-0 flex-1 flex-col max-lg:hidden">
      <header class="flex h-12 shrink-0 items-center gap-2 border-b border-border pr-2.5 pl-3">
        <button
          v-if="!sidebar.open.value"
          type="button"
          class="grid size-[30px] shrink-0 cursor-pointer place-items-center rounded-[9px] bg-accent-soft text-accent-strong transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-cobalt"
          title="Show the sidebar (Ctrl+\)"
          aria-label="Show the sidebar"
          @click="sidebar.set(true)"
        >
          <UiIcon
            name="panel-left"
            :size="16"
            :stroke="1.9"
          />
        </button>
        <span class="px-1.5 text-[13.5px] font-medium text-text">Notes</span>
        <span class="flex-1" />
        <CompanionAiToggle />
      </header>

      <div
        v-if="!isPhone"
        class="om-scroll min-h-0 flex-1 overflow-y-auto"
      >
        <div class="mx-auto grid w-full max-w-[1040px] content-start gap-11 px-8 pt-10 pb-24 min-[1400px]:px-12">
          <div class="grid gap-5">
            <div class="grid gap-1.5">
              <h1 class="t-head text-[40px]">
                Notes
              </h1>
              <p class="max-w-[60ch] text-[15px] text-text-muted">
                Everything you write, draw, upload or record. New notes start in My notes; put one
                in a course when you want to, from its header or by dragging it in the sidebar.
              </p>
            </div>
            <label
              class="flex h-11 max-w-[560px] items-center gap-2.5 rounded-full bg-surface-sunken px-4 text-text-faint transition-shadow focus-within:bg-surface focus-within:shadow-[inset_0_0_0_2px_var(--cobalt)]"
            >
              <UiIcon
                name="search"
                :size="17"
                :stroke="2"
                class="shrink-0"
              />
              <input
                v-model="query"
                type="search"
                placeholder="Search your notes"
                aria-label="Search your notes"
                class="min-w-0 flex-1 bg-transparent text-[15px] text-text outline-none placeholder:text-text-faint [&::-webkit-search-cancel-button]:hidden"
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
          </div>

          <!-- Results, while something is typed. -->
          <section
            v-if="query.trim()"
            class="grid gap-3"
            aria-label="Results"
          >
            <h2 class="text-[14px] font-semibold text-text-soft">
              {{ results.length ? `${results.length === 24 ? '24+' : results.length} found` : 'Nothing found' }}
            </h2>
            <div
              v-if="results.length"
              class="grid grid-cols-2 gap-3 min-[1180px]:grid-cols-3"
            >
              <CompanionNotesCard
                v-for="note in results"
                :key="note.id"
                :note="note"
                :query="query"
              />
            </div>
            <p
              v-else
              class="text-[14.5px] text-text-muted"
            >
              No note has those words. Search looks at titles and the text you've written.
            </p>
          </section>

          <template v-else>
            <section
              class="grid gap-3"
              aria-labelledby="notes-start"
            >
              <h2
                id="notes-start"
                class="text-[14px] font-semibold text-text-soft"
              >
                Start something
              </h2>
              <CompanionNotesTiles />
            </section>

            <div
              v-if="!store.status.ready"
              class="grid grid-cols-3 gap-3"
              aria-busy="true"
            >
              <div
                v-for="n in 6"
                :key="n"
                class="cp-skel h-[150px] rounded-[16px]"
              />
            </div>

            <!-- Nothing yet: how filing works, and one way in. -->
            <section
              v-else-if="!notes.length"
              class="grid justify-items-start gap-3 rounded-[20px] bg-surface-chrome p-7"
            >
              <CompanionIcon
                name="notebook"
                :size="26"
                class="text-text-faint"
              />
              <h2 class="t-head text-[22px]">
                Your notes will live here
              </h2>
              <p class="max-w-[58ch] text-[14.5px] leading-relaxed text-text-muted">
                Pages, whiteboards, files, links, recordings and photos all live here, and start in
                My notes. Made during a class, a note asks once whether it belongs to that course.
                In the sidebar they're a tree: drag one onto a page to put it inside, or onto a
                course to file it there.
              </p>
              <UiBtn
                variant="primary"
                icon="plus"
                :loading="create.busy.value"
                @click="create.page()"
              >
                Start a blank page
              </UiBtn>
            </section>

            <template v-else>
              <section
                class="grid gap-6"
                aria-labelledby="notes-recent"
              >
                <h2
                  id="notes-recent"
                  class="sr-only"
                >
                  Recent
                </h2>
                <div
                  v-for="group in groups"
                  :key="group.key"
                  class="grid gap-3"
                >
                  <h3 class="text-[14px] font-semibold text-text-soft">
                    {{ group.label }}
                  </h3>
                  <div class="grid grid-cols-2 gap-3 min-[1180px]:grid-cols-3">
                    <CompanionNotesCard
                      v-for="note in group.notes"
                      :key="note.id"
                      :note="note"
                    />
                  </div>
                  <div v-if="group.more">
                    <UiBtn
                      variant="ghost"
                      size="sm"
                      @click="showAll = true"
                    >
                      Show {{ group.more }} more
                    </UiBtn>
                  </div>
                </div>
              </section>

              <section
                v-if="courses.length"
                class="grid gap-3"
                aria-labelledby="notes-courses"
              >
                <h2
                  id="notes-courses"
                  class="text-[14px] font-semibold text-text-soft"
                >
                  In your courses
                </h2>
                <ul class="divide-y divide-border-rule rounded-[16px] shadow-[inset_0_0_0_1px_var(--border)]">
                  <li
                    v-for="course in courses"
                    :key="course.subject.id"
                    class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
                  >
                    <button
                      type="button"
                      class="flex min-w-[200px] cursor-pointer items-center gap-2.5 rounded-[8px] text-left outline-none focus-visible:shadow-[0_0_0_2px_var(--cobalt)]"
                      :title="`Show ${course.subject.title} in the sidebar`"
                      @click="revealCourse(course.subject.id)"
                    >
                      <span
                        class="size-2.5 shrink-0 rounded-full"
                        :style="{ background: courseColor(course.subject.color) }"
                      />
                      <span class="grid min-w-0">
                        <span class="truncate text-[14.5px] font-semibold text-text hover:underline">{{ course.subject.title }}</span>
                        <span class="truncate text-[12.5px] text-text-muted">
                          {{ course.counts }}<template v-if="course.edited"> · edited {{ untilLabel(course.edited) }}</template>
                        </span>
                      </span>
                    </button>
                    <span class="flex min-w-0 flex-1 flex-wrap justify-end gap-1.5">
                      <NuxtLink
                        v-for="note in course.latest"
                        :key="note.id"
                        :to="noteTo(note.id)"
                        class="flex h-8 max-w-[220px] min-w-0 items-center gap-1.5 rounded-full bg-surface-sunken px-3 text-[13px] text-text-body transition-colors hover:bg-surface-track hover:text-text focus-visible:outline-2 focus-visible:outline-cobalt"
                        :title="when(note) ? `${note.title || 'Untitled'}, ${when(note)}` : note.title || 'Untitled'"
                      >
                        <CompanionIcon
                          :name="noteIcon(note)"
                          :size="13"
                          class="shrink-0 text-text-faint"
                        />
                        <span class="truncate">{{ note.title || 'Untitled' }}</span>
                      </NuxtLink>
                      <button
                        type="button"
                        class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-text-faint transition-colors hover:bg-surface-sunken hover:text-text-soft focus-visible:outline-2 focus-visible:outline-cobalt"
                        :aria-label="`New page in ${course.subject.title}`"
                        :title="`New page in ${course.subject.title}`"
                        @click="create.page({ subjectId: course.subject.id })"
                      >
                        <UiIcon
                          name="plus"
                          :size="15"
                          :stroke="2"
                        />
                      </button>
                    </span>
                  </li>
                </ul>
              </section>
            </template>
          </template>
        </div>
      </div>
    </div>

    <!-- ------------------------------------------------------------------ -->
    <!-- Phone: the tree is the list                                        -->
    <!-- ------------------------------------------------------------------ -->
    <div class="flex min-h-0 flex-1 flex-col lg:hidden">
      <header class="cp-safe-top shrink-0 border-b border-border bg-surface">
        <div class="flex h-[52px] items-center gap-1 pr-2 pl-4">
          <h1 class="min-w-0 flex-1 truncate font-display text-[20px] font-semibold tracking-[-0.025em]">
            Notes
          </h1>
          <CompanionNotesNewButton
            label="New"
            size="md"
            align="end"
          />
          <CompanionAiToggle compact />
          <ShellAccountMenu size="md" />
        </div>
      </header>

      <div class="om-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3">
        <CompanionNotesSidebar
          v-if="isPhone"
          variant="page"
        >
          <template #lead>
            <CompanionNotesTiles
              size="sm"
              class="mb-4"
            />
          </template>
        </CompanionNotesSidebar>
      </div>

      <ShellBottomNav />
    </div>
  </div>
</template>
