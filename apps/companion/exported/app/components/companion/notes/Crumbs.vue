<script setup lang="ts">
const { t } = useI18n()
import type { Item } from '~/companion/types'
import type { NoteMenuItem } from '~/companion/notes/actions'
import { noteTo, suggestionOf, useNoteActions, useNotesSidebar } from '~/companion/notes/actions'
import { ancestors, noteIcon, untitled } from '~/companion/notes/tree'
import { courseColor } from '~/companion/colors'
import { useCompanion } from '~/companion/store'

/**
 * Where an open note is, as a path you can click back up: "Notes /
 * ● Databases ▾ / Lecture 8 notes / Worked examples". Notes goes home, a page
 * above opens that page. More than two pages above collapse into "…", which
 * lists them. The last part is the note itself: a board's name renames in
 * place (a click), a page's focuses its own title (`title`), since that's
 * where a page is named.
 *
 * The course part is where the note is filed, and it is the way to change
 * that: "My notes ▾" or "● Databases ▾" opens the list of courses (No course
 * first, the one it's in checked), and a pick moves it there with whatever
 * is inside it, with Undo in the toast. "Open Databases" heads the list, as
 * that part used to be a link to the course. Beside it, for a note in My
 * notes made somewhere a course was obvious, the one question it may ask:
 * "Add to Databases?" (`CompanionNotesSuggest`).
 *
 * When Notes' sidebar is folded away, a button to bring it back leads the
 * path. On a phone the path is too long to be useful: it's a back arrow
 * (Back when there's somewhere in the app to go back to, else up a level),
 * the course picker and the suggestion.
 */
const props = defineProps<{
  item: Item
  /** The title as typed right now, ahead of the row's debounced save. */
  title: string
  phone?: boolean
  /** The last part renames in place (boards). */
  renameable?: boolean
}>()

const emit = defineEmits<{ title: []; rename: [value: string] }>()

const store = useCompanion()
const router = useRouter()
const sidebar = useNotesSidebar()
const actions = useNoteActions()
const tree = actions.tree

const subject = computed(() => store.get('subjects', props.item.subject_id))

/* -- Where it's filed, and moving it ----------------------------------------- */

const nested = computed(() => Boolean(tree.value.parent.get(props.item.id)))
const suggested = computed(() => suggestionOf(store, props.item)?.subject.id ?? null)

const places = computed<NoteMenuItem[]>(() => {
  const here = props.item.subject_id ?? null
  const move = (to: string | null) => () => {
    if (to === here && !nested.value) return
    void actions.moveTo(props.item, to)
  }
  const list: NoteMenuItem[] = []
  if (subject.value) {
    const s = subject.value
    list.push({ label: t('notes.openCourse', { course: s.title }), icon: 'workspace', run: () => void navigateTo(`/app/courses/${s.id}`) })
  }
  list.push({
    label: t('notes.noCourse'),
    icon: 'notebook',
    caption: here ? t('notes.backToMine') : nested.value ? t('notes.inMineNested') : t('notes.inMine'),
    checked: !here,
    divider: Boolean(subject.value),
    run: move(null),
  })
  for (const s of store.subjects.value) {
    list.push({
      label: s.title,
      icon: 'workspace',
      color: courseColor(s.color),
      checked: s.id === here,
      caption: s.id === here && nested.value ? t('notes.hereNested') : s.id === suggested.value ? t('notes.suggested') : undefined,
      run: move(s.id),
    })
  }
  return list
})

const placeLabel = computed(() => subject.value?.title ?? t('notes.myNotes'))
const above = computed(() => ancestors(tree.value, props.item.id))
/** First and last pages above stay; the middle folds into "…". */
const shown = computed(() => (above.value.length > 2 ? [above.value[0]!, above.value.at(-1)!] : above.value))
const folded = computed<NoteMenuItem[]>(() =>
  above.value.length > 2
    ? above.value.slice(1, -1).map((n) => ({
        label: n.title || t('notes.untitled'),
        icon: noteIcon(n),
        run: () => void navigateTo(noteTo(n.id)),
      }))
    : [],
)

const name = computed(() => props.title || untitled(props.item))

/* -- The phone's way back ---------------------------------------------------- */

const up = computed(() => {
  const parent = above.value.at(-1)
  return parent ? noteTo(parent.id) : '/app/notes'
})

function back(): void {
  const state = import.meta.client ? (window.history.state as { back?: string | null } | null) : null
  if (state?.back?.startsWith('/app')) router.back()
  else void navigateTo(up.value)
}

/* -- Renaming a board here --------------------------------------------------- */

const renaming = ref(false)
const draft = ref('')
const field = ref<HTMLInputElement | null>(null)

function startRename(): void {
  if (!props.renameable) return emit('title')
  draft.value = props.title
  renaming.value = true
  nextTick(() => field.value?.select())
}

function finishRename(save: boolean): void {
  if (!renaming.value) return
  renaming.value = false
  const value = draft.value.trim()
  if (save && value && value !== props.title) emit('rename', value)
}

defineExpose({ startRename })

const crumb =
  'flex h-7 min-w-0 shrink items-center gap-1.5 rounded-[7px] px-1.5 text-text-muted transition-colors hover:bg-surface-mute hover:text-text outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--brand)]'
</script>

<template>
  <div
    v-if="phone"
    class="flex min-w-0 flex-1 items-center gap-1"
  >
    <button
      type="button"
      class="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-text-soft transition-colors active:bg-surface-sunken"
      :aria-label="t('notes.back')"
      @click="back"
    >
      <UiIcon
        name="chevron-left"
        :size="21"
        :stroke="2"
      />
    </button>
    <CompanionNotesMenu
      class="min-w-0"
      :items="places"
      :label="t('notes.whereFiled')"
      :title="t('notes.whereFiled')"
    >
      <template #default="{ toggle, open }">
        <button
          type="button"
          aria-haspopup="menu"
          :aria-expanded="open"
          :aria-label="t('notes.filedIn', { place: placeLabel })"
          class="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-full px-1 text-[15px] font-semibold text-text-soft active:bg-surface-sunken"
          @click="toggle"
        >
          <span
            v-if="subject"
            class="size-2 shrink-0 rounded-full"
            :style="{ background: courseColor(subject.color) }"
          />
          <span class="max-w-[38vw] truncate">{{ placeLabel }}</span>
          <UiIcon
            name="chevron-down"
            :size="14"
            :stroke="2.2"
            class="shrink-0 text-text-faint"
          />
        </button>
      </template>
    </CompanionNotesMenu>
    <CompanionNotesSuggest
      :item="item"
      compact
      class="ml-1"
    />
  </div>

  <nav
    v-else
    class="flex min-w-0 flex-1 items-center gap-0.5 text-[13.5px] whitespace-nowrap"
    :aria-label="t('notes.whereThis')"
  >
    <button
      v-if="!sidebar.open.value"
      type="button"
      class="mr-1 grid size-[30px] shrink-0 cursor-pointer place-items-center rounded-[9px] bg-accent-soft text-accent-strong transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-brand"
      :title="t('notes.showSidebarKey')"
      :aria-label="t('notes.showSidebar')"
      @click="sidebar.set(true)"
    >
      <UiIcon
        name="panel-left"
        :size="16"
        :stroke="1.9"
      />
    </button>
    <NuxtLink
      to="/app/notes"
      :class="[crumb, 'shrink-0']"
    >
      {{ t('notes.notes') }}
    </NuxtLink>
    <span
      class="shrink-0 text-text-ghost"
      aria-hidden="true"
    >/</span>
    <CompanionNotesMenu
      class="min-w-0"
      :items="places"
      :label="t('notes.whereFiled')"
      :title="t('notes.whereFiled')"
      :width="248"
    >
      <template #default="{ toggle, open }">
        <button
          type="button"
          aria-haspopup="menu"
          :aria-expanded="open"
          :class="[crumb, open && 'bg-surface-mute text-text']"
          :title="subject ? t('notes.inCourseHint', { course: subject.title }) : t('notes.inMineHint')"
          @click="toggle"
        >
          <span
            v-if="subject"
            class="size-2 shrink-0 rounded-full"
            :style="{ background: courseColor(subject.color) }"
          />
          <span class="max-w-[200px] truncate">{{ placeLabel }}</span>
          <UiIcon
            name="chevron-down"
            :size="12"
            :stroke="2.2"
            class="-ml-0.5 shrink-0 text-text-faint"
          />
        </button>
      </template>
    </CompanionNotesMenu>

    <template
      v-for="(note, index) in shown"
      :key="note.id"
    >
      <span
        class="shrink-0 text-text-ghost"
        aria-hidden="true"
      >/</span>
      <template v-if="index === 1 && folded.length">
        <CompanionNotesMenu
          :items="folded"
          :label="t('notes.pagesBetween')"
          :title="t('notes.pagesBetween')"
        >
          <template #default="{ toggle }">
            <button
              type="button"
              :class="crumb"
              :aria-label="t('notes.pagesBetween')"
              @click="toggle"
            >
              …
            </button>
          </template>
        </CompanionNotesMenu>
        <span
          class="shrink-0 text-text-ghost"
          aria-hidden="true"
        >/</span>
      </template>
      <NuxtLink
        :to="noteTo(note.id)"
        :class="crumb"
      >
        <span class="max-w-[180px] truncate">{{ note.title || t('notes.untitled') }}</span>
      </NuxtLink>
    </template>

    <span
      class="shrink-0 text-text-ghost"
      aria-hidden="true"
    >/</span>
    <input
      v-if="renaming"
      ref="field"
      v-model="draft"
      type="text"
      maxlength="160"
      :aria-label="t('notes.name')"
      class="h-7 min-w-[160px] rounded-[7px] bg-surface px-1.5 font-medium text-text outline-2 outline-brand"
      @keydown.enter.prevent="finishRename(true)"
      @keydown.esc.prevent.stop="finishRename(false)"
      @blur="finishRename(true)"
    >
    <button
      v-else
      type="button"
      :class="[crumb, 'font-medium', title ? 'text-text' : 'text-text-faint']"
      :title="renameable ? t('notes.rename') : t('notes.goToTitle')"
      @click="startRename"
    >
      <span class="truncate">{{ name }}</span>
    </button>

    <CompanionNotesSuggest
      :item="item"
      class="ml-2"
    />
  </nav>
</template>
