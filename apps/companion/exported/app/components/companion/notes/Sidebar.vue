<script setup lang="ts">
const { t } = useI18n()
import type { Note } from '~/companion/notes/tree'
import { byEdited, highlight, matchNotes, MINE, noteIcon, snippet } from '~/companion/notes/tree'
import { NOTES_LIST, type DropZone, type NotesListContext } from '~/companion/notes/ui'
import {
  clearSelection,
  folderKey,
  movingIds,
  noteTo,
  selection,
  setExpanded,
  useNoteActions,
  useNoteCreate,
  useNotesSidebar,
  useNotesTree,
} from '~/companion/notes/actions'
import { courseColor } from '~/companion/colors'
import { useCompanion } from '~/companion/store'
import { usePanelWidth } from '~/companion/panel-width'

/**
 * Notes' left panel: every note (pages, whiteboards, uploads, links,
 * recordings, photos), where it's filed, as a tree. The old workspace
 * sidebar's panel (272px, the chrome grey, the same rows), so moving between
 * a course and Notes doesn't change what the left side of the screen is.
 *
 * Top to bottom: "Notes" and "+ New" (every kind of note, made in My notes:
 * `CompanionNotesNewButton`), a filter over titles and text, then
 *
 *  - Recent: the five last edited, to get back to what you were just in;
 *  - Pinned, when anything is;
 *  - My notes: everything that isn't in a course, which is where anything
 *    new lands until the learner files it;
 *  - one folder per course, its dot and name, its notes as a tree in the
 *    order you put them.
 *
 * Filing is by hand and easy: drag a row (or a selection) onto a folder;
 * ⌘/Ctrl-click or Shift-click to pick several, then "Move to…" in the bar
 * that appears; "Move to…" in any row's "…"; or the course picker in an open
 * note's header. The open note is the highlighted row, and the tree unfolds
 * to show it however it was reached. What's folded is remembered per device.
 *
 * `variant="page"` is the same list as a phone's Notes screen: no panel,
 * 44px rows, the "…" always showing, no dragging or picking (touch has no
 * drag or modifier keys here; "Move to…" is in every row's "…").
 */
const props = withDefaults(defineProps<{ variant?: 'panel' | 'page' }>(), { variant: 'panel' })

const route = useRoute()
const store = useCompanion()
const actions = useNoteActions()
const create = useNoteCreate()
const sidebar = useNotesSidebar()
const { everything: notes, full: tree } = useNotesTree(store)

const roomy = props.variant === 'page'
const size = usePanelWidth('column')

/* -- What's open ------------------------------------------------------------- */

const activeId = computed(() => {
  const id = route.params.id
  return route.path.startsWith('/app/notes/') && typeof id === 'string' ? id : null
})
const activeNote = computed(() => (activeId.value ? tree.value.byId.get(activeId.value) ?? null : null))

const scroller = ref<HTMLElement | null>(null)

/** Unfold the way to the open doc, then bring its row into view. */
function reveal(): void {
  const note = activeNote.value
  if (!note) return
  setExpanded(folderKey(note.subject_id), true)
  let at = tree.value.parent.get(note.id)
  while (at) {
    setExpanded(at.id, true)
    at = tree.value.parent.get(at.id)
  }
  // After the fold's 200ms, so the row has its final place.
  setTimeout(() => {
    // Its place in the tree, which comes after Recent and Pinned.
    const rows = scroller.value?.querySelectorAll<HTMLElement>(`[data-note-item] [aria-current="page"]`)
    rows?.[rows.length - 1]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, 220)
}

watch(() => activeNote.value?.id, reveal, { immediate: true })

/* -- The rows' context ------------------------------------------------------- */

const drag = reactive<{ id: string | null; ids: string[] | null; over: string | null; zone: DropZone | null }>({
  id: null,
  ids: null,
  over: null,
  zone: null,
})

async function addInside(note: Note): Promise<void> {
  setExpanded(note.id, true)
  await create.page({ parentId: note.id })
}

function drop(note: Note, target: Note, zone: DropZone, many?: Note[]): void {
  const list = many ?? [note]
  if (zone === 'inside') void actions.nestMany(list, target)
  else void actions.placeMany(list, target, zone)
}

provide<NotesListContext>(NOTES_LIST, {
  activeId,
  roomy,
  linkTo: (note) => noteTo(note.id),
  addInside: (note) => void addInside(note),
  drag: roomy ? null : drag,
  drop: roomy ? undefined : drop,
  select: !roomy,
})

function dropOn(subjectId: string | null, ids: string[]): void {
  const list = ids.map((id) => tree.value.byId.get(id)).filter((n): n is Note => Boolean(n))
  if (list.length) void actions.moveMany(list, subjectId)
  if (list.length > 1) clearSelection()
}

/* -- Several picked ------------------------------------------------------------ */

/** The picked notes still here (one deleted elsewhere drops out), in the order on screen. */
const picked = computed(() =>
  [...selection.value].map((id) => tree.value.byId.get(id)).filter((n): n is Note => Boolean(n)),
)

function movePicked(): void {
  movingIds.value = picked.value.map((n) => n.id)
}

function deletePicked(): void {
  const list = picked.value
  clearSelection()
  actions.removeMany(list)
}

function onWindowKey(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !selection.value.size) return
  const el = event.target as HTMLElement | null
  if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA'].includes(el.tagName))) return
  clearSelection()
}

onMounted(() => window.addEventListener('keydown', onWindowKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKey)
  clearSelection()
})

/* -- Sections ---------------------------------------------------------------- */

const recent = computed(() => [...notes.value].sort(byEdited).slice(0, 5))
const pinned = computed(() => notes.value.filter((n) => n.pinned).sort(byEdited))
const mine = computed(() => tree.value.roots.get(MINE) ?? [])
const courses = computed(() =>
  store.subjects.value.map((s) => ({
    subject: s,
    roots: tree.value.roots.get(s.id) ?? [],
    count: notes.value.filter((n) => n.subject_id === s.id).length,
  })),
)

/* -- Filter ------------------------------------------------------------------ */

const query = ref('')
const searchField = ref<HTMLInputElement | null>(null)
const results = computed(() => (query.value.trim() ? matchNotes(notes.value, query.value).slice(0, 40) : []))

function onSearchKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (query.value) {
      event.stopPropagation()
      query.value = ''
    } else searchField.value?.blur()
  } else if (event.key === 'Enter' && results.value[0]) {
    void navigateTo(noteTo(results.value[0].id))
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    scroller.value?.querySelector<HTMLElement>('[data-note-link]')?.focus()
  }
}

/* -- ↑ / ↓ through every row on screen --------------------------------------- */

function onListKey(event: KeyboardEvent): void {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT') return
  const rows = [...(scroller.value?.querySelectorAll<HTMLElement>('[data-note-link]') ?? [])].filter(
    (el) => !el.closest('[inert]'),
  )
  const at = rows.indexOf(target.closest<HTMLElement>('[data-note-link]') ?? target)
  if (at < 0) return
  event.preventDefault()
  if (event.key === 'ArrowUp' && at === 0) return searchField.value?.focus()
  rows[Math.min(rows.length - 1, Math.max(0, at + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus()
}

defineExpose({ focusSearch: () => searchField.value?.focus() })
</script>

<template>
  <component
    :is="variant === 'panel' ? 'aside' : 'div'"
    :class="
      variant === 'panel'
        ? 'relative flex shrink-0 flex-col'
        : 'flex flex-col'
    "
    :style="variant === 'panel' ? { width: size.css.value } : undefined"
    :aria-label="t('notes.notes')"
  >
    <CompanionShellResizeHandle
      v-if="variant === 'panel'"
      panel="column"
      edge="right"
      :label="t('notes.resizeSidebar')"
      class="right-0 translate-x-1/2"
    />
    <!-- t('notes.notes'), New, and folding the panel away. -->
    <div
      v-if="variant === 'panel'"
      class="group/top flex items-center gap-1.5 pt-4 pr-3 pb-3 pl-[18px]"
    >
      <NuxtLink
        to="/app/notes"
        class="rounded-[6px] font-display text-[15px] font-semibold tracking-[-0.01em] text-text outline-none hover:text-text-soft focus-visible:shadow-[0_0_0_2px_var(--brand)]"
        :title="t('notes.notesHome')"
      >
        {{ t('notes.notes') }}
      </NuxtLink>
      <span class="flex-1" />
      <button
        type="button"
        class="grid size-[30px] cursor-pointer place-items-center rounded-[9px] text-text-faint opacity-0 transition hover:bg-surface-track hover:text-text-soft group-hover/top:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-brand"
        :title="t('notes.hideSidebarKey')"
        :aria-label="t('notes.hideSidebar')"
        @click="sidebar.set(false)"
      >
        <UiIcon
          name="panel-left"
          :size="16"
          :stroke="1.9"
        />
      </button>
      <CompanionNotesNewButton
        :label="t('notes.new')"
        size="md"
        align="end"
      />
    </div>

    <!-- The filter: instant, over titles and text. -->
    <div :class="variant === 'panel' ? 'px-3 pb-2.5' : 'pb-3'">
      <label
        :class="[
          'flex items-center gap-2 rounded-[10px] bg-surface px-2.5 text-text-faint shadow-[inset_0_0_0_1px_var(--border-strong)] transition-shadow focus-within:shadow-[inset_0_0_0_2px_var(--brand)]',
          roomy ? 'h-11' : 'h-[32px]',
        ]"
      >
        <UiIcon
          name="search"
          :size="roomy ? 17 : 14"
          :stroke="2"
          class="shrink-0"
        />
        <input
          ref="searchField"
          v-model="query"
          type="search"
          :placeholder="t('notes.findNote')"
          :aria-label="t('notes.findNote')"
          :class="[
            'min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-text-faint [&::-webkit-search-cancel-button]:hidden',
            roomy ? 'text-[16px]' : 'text-[13px]',
          ]"
          @keydown="onSearchKey"
        >
        <button
          v-if="query"
          type="button"
          class="grid size-5 shrink-0 cursor-pointer place-items-center rounded-full text-text-faint hover:bg-surface-track hover:text-text-soft"
          :aria-label="t('notes.clear')"
          @click="query = ''; searchField?.focus()"
        >
          <UiIcon
            name="x"
            :size="12"
            :stroke="2.2"
          />
        </button>
      </label>
    </div>

    <!-- Several picked: what to do with them all. -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="!roomy && picked.length"
        class="mx-3 mb-2.5 flex h-9 items-center gap-0.5 rounded-[10px] bg-inverse pr-1 pl-3 text-[12.5px] text-on-inverse"
        role="toolbar"
        :aria-label="t('notes.pickedN', picked.length)"
      >
        <span class="min-w-0 flex-1 truncate font-semibold">{{ t('notes.noteCount', picked.length) }}</span>
        <button
          type="button"
          class="h-7 cursor-pointer rounded-[7px] px-2 font-semibold transition-colors hover:bg-[rgb(255_255_255/0.14)] focus-visible:outline-2 focus-visible:outline-accent"
          :title="t('notes.moveHint')"
          @click="movePicked"
        >
          {{ t('notes.moveTo') }}
        </button>
        <button
          type="button"
          class="grid size-7 cursor-pointer place-items-center rounded-[7px] transition-colors hover:bg-[rgb(255_255_255/0.14)] focus-visible:outline-2 focus-visible:outline-accent"
          :aria-label="t('notes.deleteThem')"
          :title="t('notes.deleteUndo')"
          @click="deletePicked"
        >
          <UiIcon
            name="trash"
            :size="14"
          />
        </button>
        <button
          type="button"
          class="grid size-7 cursor-pointer place-items-center rounded-[7px] transition-colors hover:bg-[rgb(255_255_255/0.14)] focus-visible:outline-2 focus-visible:outline-accent"
          :aria-label="t('notes.clearSelection')"
          :title="t('notes.clearEsc')"
          @click="clearSelection()"
        >
          <UiIcon
            name="x"
            :size="14"
            :stroke="2.2"
          />
        </button>
      </div>
    </Transition>

    <!-- The phone's tiles, under the search; gone while searching. -->
    <slot
      v-if="!query.trim()"
      name="lead"
    />

    <div
      ref="scroller"
      role="tree"
      :aria-label="t('notes.yourNotes')"
      :class="variant === 'panel' ? 'om-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-6' : 'pb-6'"
      @keydown="onListKey"
    >
      <div
        v-if="!store.status.ready"
        class="grid gap-2 px-2 pt-2"
        aria-busy="true"
      >
        <div
          v-for="n in 7"
          :key="n"
          class="cp-skel h-[22px]"
          :style="{ width: `${88 - (n % 3) * 18}%` }"
        />
      </div>

      <!-- Results, while something is typed. -->
      <template v-else-if="query.trim()">
        <p class="px-2 pt-1 pb-1.5 text-[12px] font-semibold text-text-faint">
          {{ results.length ? t('notes.found', { n: results.length === 40 ? '40+' : results.length }) : t('notes.nothingFound') }}
        </p>
        <NuxtLink
          v-for="note in results"
          :key="note.id"
          :to="noteTo(note.id)"
          data-note-link
          :aria-current="note.id === activeId ? 'page' : undefined"
          :class="[
            'grid gap-0.5 rounded-[8px] px-2 py-1.5 outline-none transition-colors focus-visible:shadow-[inset_0_0_0_2px_var(--brand)]',
            note.id === activeId ? 'bg-accent-soft' : 'hover:bg-surface-mute',
          ]"
        >
          <span class="flex min-w-0 items-center gap-2">
            <CompanionIcon
              :name="noteIcon(note)"
              :size="roomy ? 17 : 15"
              class="shrink-0 text-text-faint"
            />
            <span :class="['min-w-0 flex-1 truncate text-text', roomy ? 'text-[15px]' : 'text-[13px]']"><template
              v-for="(piece, i) in highlight(note.title || t('notes.untitled'), query)"
              :key="i"
            ><mark
              v-if="piece.hit"
              class="rounded-[3px] bg-accent-soft px-px text-text shadow-[inset_0_-2px_0_var(--accent)]"
            >{{ piece.text }}</mark><template v-else>{{ piece.text }}</template></template></span>
            <span
              v-if="store.subjectOf(note)"
              class="size-[7px] shrink-0 rounded-full"
              :style="{ background: courseColor(store.subjectOf(note)?.color) }"
              :title="store.subjectOf(note)?.title"
            />
          </span>
          <span
            v-if="note.preview"
            :class="['line-clamp-2 pl-[23px] leading-snug text-text-muted', roomy ? 'text-[13.5px]' : 'text-[12px]']"
          ><template
            v-for="(piece, i) in highlight(snippet(note.preview, query), query)"
            :key="i"
          ><mark
            v-if="piece.hit"
            class="rounded-[2px] bg-accent-soft text-text-body"
          >{{ piece.text }}</mark><template v-else>{{ piece.text }}</template></template></span>
        </NuxtLink>
        <p
          v-if="!results.length"
          class="px-2 text-[12.5px] leading-relaxed text-text-muted"
        >
          No note has those words. Search looks at titles and the text you've written.
        </p>
      </template>

      <template v-else>
        <CompanionNotesSection
          v-if="recent.length"
          :label="t('notes.recent')"
          fold-key="s:recent"
          default-open
        >
          <CompanionNotesRow
            v-for="note in recent"
            :key="note.id"
            :note="note"
            flat
          />
        </CompanionNotesSection>

        <CompanionNotesSection
          v-if="pinned.length"
          :label="t('notes.pinned')"
          fold-key="s:pinned"
          default-open
        >
          <CompanionNotesRow
            v-for="note in pinned"
            :key="note.id"
            :note="note"
            flat
          />
        </CompanionNotesSection>

        <div class="mt-3" />
        <CompanionNotesSection
          :label="t('notes.myNotes')"
          :fold-key="folderKey(null)"
          look="folder"
          default-open
          addable
          :add-label="t('notes.newPageMine')"
          droppable
          @add="create.page({ subjectId: null })"
          @drop="dropOn(null, $event)"
        >
          <CompanionNotesRow
            v-for="note in mine"
            :key="note.id"
            :note="note"
          />
          <p
            v-if="!mine.length"
            :class="['py-1 pr-2 pl-[34px] leading-relaxed text-text-muted', roomy ? 'text-[14px]' : 'text-[12.5px]']"
          >
            {{ t('notes.mineEmpty') }}
          </p>
        </CompanionNotesSection>

        <p
          v-if="courses.length"
          class="mt-4 px-1.5 pb-1 text-[12px] font-semibold text-text-faint"
        >
          {{ t('notes.courses') }}
        </p>
        <CompanionNotesSection
          v-for="course in courses"
          :key="course.subject.id"
          :data-folder="course.subject.id"
          :label="course.subject.title"
          :fold-key="folderKey(course.subject.id)"
          look="folder"
          :color="courseColor(course.subject.color)"
          addable
          :add-label="t('notes.newPageIn', { course: course.subject.title })"
          droppable
          @add="create.page({ subjectId: course.subject.id })"
          @drop="dropOn(course.subject.id, $event)"
        >
          <template #extra>
            <span
              v-if="course.count"
              class="num mr-1.5 shrink-0 text-[11.5px] text-text-faint group-hover/head:hidden"
            >{{ course.count }}</span>
          </template>
          <CompanionNotesRow
            v-for="note in course.roots"
            :key="note.id"
            :note="note"
          />
          <p
            v-if="!course.roots.length"
            :class="['py-1 pr-2 pl-[34px] leading-relaxed text-text-muted', roomy ? 'text-[14px]' : 'text-[12.5px]']"
          >
            {{ t('notes.courseEmpty') }}
          </p>
        </CompanionNotesSection>
      </template>
    </div>
  </component>
</template>
