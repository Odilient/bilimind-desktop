<script setup lang="ts">
const { t } = useI18n()
import type { Note } from '~/companion/notes/tree'
import { MINE, matchNotes, noteIcon, untitled } from '~/companion/notes/tree'
import { useNotesTree } from '~/companion/notes/actions'
import { courseColor } from '~/companion/colors'
import { untilLabel } from '~/companion/time'
import { useCompanion } from '~/companion/store'

/**
 * Pick notes from Notes: to attach to a chat message ("Attach notes"), or to
 * add to a course ("Add notes to Databases", `onlyUnfiled`). A modal on a
 * computer, a bottom sheet on a phone (`UiModal` is both).
 *
 * The same order as Notes' sidebar, so a note is where the learner expects:
 * My notes first, then each course under its dot and name, every note with
 * its glyph (page, whiteboard, file, link, recording, photo) and the pages
 * inside a page indented under it. Typing filters titles and text at once,
 * across every course. Rows are checkboxes; the foot counts what's picked
 * and says it on the button ("Attach 3"). With `multiple` off a row is the
 * choice itself. Notes already there (`exclude`) stay in the list, ticked
 * and greyed, so the list still reads as the learner's notes.
 *
 * Keys: ↓ from the search goes into the list, ↑/↓ walk it, Space or Enter
 * ticks, Ctrl/⌘+Enter confirms, Escape closes.
 */
const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    confirm?: string
    multiple?: boolean
    exclude?: string[]
    onlyUnfiled?: boolean
  }>(),
  { title: undefined, confirm: undefined, multiple: true, exclude: () => [], onlyUnfiled: false },
)

const emit = defineEmits<{ 'update:open': [value: boolean]; pick: [ids: string[]] }>()

const store = useCompanion()
const isPhone = useIsPhone()
const { everything, full } = useNotesTree(store)

const shown = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const query = ref('')
const chosen = ref<ReadonlySet<string>>(new Set())
const excluded = computed(() => new Set(props.exclude))
const list = ref<HTMLElement | null>(null)
const search = ref<HTMLInputElement | null>(null)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    query.value = ''
    chosen.value = new Set()
    // A phone's keyboard would cover half the list before anything is looked at.
    if (!isPhone.value) void nextTick(() => search.value?.focus())
  },
)

/* -- The list ----------------------------------------------------------------- */

interface Line {
  note: Note
  depth: number
}

interface Group {
  key: string
  label: string
  color: string | null
  lines: Line[]
}

function walk(roots: Note[], depth = 0, out: Line[] = []): Line[] {
  for (const note of roots) {
    out.push({ note, depth: Math.min(depth, 3) })
    walk(full.value.children.get(note.id) ?? [], depth + 1, out)
  }
  return out
}

const pool = computed(() => (props.onlyUnfiled ? everything.value.filter((n) => !n.subject_id) : everything.value))

const groups = computed<Group[]>(() => {
  const q = query.value.trim()
  if (q) {
    const found = matchNotes(pool.value, q).slice(0, 60)
    return found.length ? [{ key: 'found', label: t('notes.found', { n: found.length === 60 ? '60+' : found.length }), color: null, lines: found.map((note) => ({ note, depth: 0 })) }] : []
  }
  const out: Group[] = [
    { key: 'mine', label: t('notes.myNotes'), color: null, lines: walk(full.value.roots.get(MINE) ?? []) },
  ]
  if (!props.onlyUnfiled) {
    for (const s of store.subjects.value) {
      out.push({ key: s.id, label: s.title, color: courseColor(s.color), lines: walk(full.value.roots.get(s.id) ?? []) })
    }
  }
  return out.filter((g) => g.lines.length)
})

const searching = computed(() => Boolean(query.value.trim()))

/* -- Picking ------------------------------------------------------------------ */

function toggle(note: Note): void {
  if (excluded.value.has(note.id)) return
  if (!props.multiple) {
    emit('pick', [note.id])
    shown.value = false
    return
  }
  const next = new Set(chosen.value)
  if (next.has(note.id)) next.delete(note.id)
  else next.add(note.id)
  chosen.value = next
}

const count = computed(() => chosen.value.size)
const label = computed(() => (count.value > 1 ? `${props.confirm ?? t('notes.add')} ${count.value}` : (props.confirm ?? t('notes.add'))))

function done(): void {
  if (!count.value) return
  // In the order they're listed, so they attach the way they read.
  const order = groups.value.flatMap((g) => g.lines.map((l) => l.note.id))
  const ids = [...chosen.value].sort((a, b) => order.indexOf(a) - order.indexOf(b))
  emit('pick', ids)
  shown.value = false
}

/* -- Keys --------------------------------------------------------------------- */

function rows(): HTMLElement[] {
  return [...(list.value?.querySelectorAll<HTMLElement>('[data-pick-row]:not(:disabled)') ?? [])]
}

function onSearchKey(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    rows()[0]?.focus()
  } else if (event.key === 'Enter' && !(event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    const first = groups.value[0]?.lines.find((l) => !excluded.value.has(l.note.id))
    if (first) toggle(first.note)
  }
}

function onListKey(event: KeyboardEvent): void {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  const all = rows()
  const at = all.indexOf(document.activeElement as HTMLElement)
  if (at < 0) return
  event.preventDefault()
  if (event.key === 'ArrowUp' && at === 0) return search.value?.focus()
  all[Math.min(all.length - 1, at + (event.key === 'ArrowDown' ? 1 : -1))]?.focus()
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    done()
  }
}

function when(note: Note): string {
  const at = note.updated_at ?? note.created_at
  return at && Date.parse(at) <= Date.now() ? untilLabel(at) : ''
}
</script>

<template>
  <UiModal
    v-model:open="shown"
    size="md"
    :title="title ?? t('notes.pickNotes')"
  >
    <div
      class="-mx-1 grid gap-3"
      @keydown="onKey"
    >
      <label
        class="flex h-11 items-center gap-2 rounded-[12px] bg-surface-sunken px-3 text-text-faint transition-shadow focus-within:bg-surface focus-within:shadow-[inset_0_0_0_2px_var(--brand)]"
      >
        <UiIcon
          name="search"
          :size="16"
          :stroke="2"
          class="shrink-0"
        />
        <input
          ref="search"
          v-model="query"
          type="search"
          :placeholder="t('notes.findNote')"
          :aria-label="t('notes.findNote')"
          class="min-w-0 flex-1 bg-transparent text-[15px] text-text outline-none placeholder:text-text-faint [&::-webkit-search-cancel-button]:hidden"
          @keydown="onSearchKey"
        >
        <button
          v-if="query"
          type="button"
          class="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-text-faint hover:bg-surface-track hover:text-text-soft"
          :aria-label="t('notes.clear')"
          @click="query = ''; search?.focus()"
        >
          <UiIcon
            name="x"
            :size="13"
            :stroke="2.2"
          />
        </button>
      </label>

      <div
        ref="list"
        class="om-scroll -mx-2 max-h-[min(52vh,460px)] overflow-y-auto px-2 max-sm:max-h-[50dvh]"
        role="group"
        :aria-label="title ?? t('notes.pickNotes')"
        @keydown="onListKey"
      >
        <div
          v-if="!store.status.ready"
          class="grid gap-2 py-1"
          aria-busy="true"
        >
          <div
            v-for="n in 6"
            :key="n"
            class="cp-skel h-9 rounded-[10px]"
          />
        </div>

        <template v-else>
          <section
            v-for="group in groups"
            :key="group.key"
            class="pb-2"
          >
            <h3 class="sticky top-0 z-[1] flex items-center gap-2 bg-surface px-1 pt-1 pb-1.5 text-[12.5px] font-semibold text-text-faint">
              <span
                v-if="group.color"
                class="size-2 shrink-0 rounded-full"
                :style="{ background: group.color }"
              />
              <CompanionIcon
                v-else-if="group.key === 'mine'"
                name="notebook"
                :size="14"
                class="shrink-0"
              />
              <span class="truncate">{{ group.label }}</span>
            </h3>
            <button
              v-for="line in group.lines"
              :key="line.note.id"
              type="button"
              data-pick-row
              :role="multiple ? 'checkbox' : 'option'"
              :aria-checked="multiple ? chosen.has(line.note.id) || excluded.has(line.note.id) : undefined"
              :disabled="excluded.has(line.note.id)"
              :class="[
                'flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] pr-2 text-left transition-colors duration-150 outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--brand)] disabled:cursor-default max-sm:min-h-12 sm:min-h-[38px]',
                chosen.has(line.note.id) ? 'bg-brand-soft' : 'hover:bg-surface-sunken focus-visible:bg-surface-sunken',
              ]"
              :style="{ paddingLeft: `${6 + line.depth * 18}px` }"
              @click="toggle(line.note)"
            >
              <span
                v-if="multiple"
                :class="[
                  'grid size-[18px] shrink-0 place-items-center rounded-[5px] transition-colors duration-150',
                  chosen.has(line.note.id) || excluded.has(line.note.id)
                    ? 'bg-brand text-white'
                    : 'shadow-[inset_0_0_0_1.5px_var(--border-strong)]',
                  excluded.has(line.note.id) && 'opacity-45',
                ]"
                aria-hidden="true"
              >
                <UiIcon
                  v-if="chosen.has(line.note.id) || excluded.has(line.note.id)"
                  name="check"
                  :size="12"
                  :stroke="2.8"
                />
              </span>
              <CompanionIcon
                :name="noteIcon(line.note)"
                :size="16"
                :class="['shrink-0', excluded.has(line.note.id) ? 'text-text-ghost' : 'text-text-faint']"
              />
              <span
                :class="[
                  'min-w-0 flex-1 truncate text-[14px]',
                  excluded.has(line.note.id) ? 'text-text-faint' : line.note.title ? 'text-text' : 'text-text-faint',
                ]"
              >{{ line.note.title || untitled(line.note) }}</span>
              <span
                v-if="searching && store.subjectOf(line.note)"
                class="size-[7px] shrink-0 rounded-full"
                :style="{ background: courseColor(store.subjectOf(line.note)?.color) }"
                :title="store.subjectOf(line.note)?.title"
              />
              <span
                v-if="excluded.has(line.note.id)"
                class="shrink-0 text-[12px] text-text-faint"
              >{{ t('notes.added') }}</span>
              <span
                v-else-if="when(line.note)"
                class="shrink-0 text-[12px] text-text-faint max-sm:hidden"
              >{{ when(line.note) }}</span>
            </button>
          </section>
        </template>

        <!-- Nothing to pick: why, and the one way to change that. -->
        <div
          v-if="store.status.ready && !groups.length"
          class="grid justify-items-center gap-2.5 px-4 py-10 text-center"
        >
          <CompanionIcon
            name="notebook"
            :size="24"
            class="text-text-faint"
          />
          <p class="max-w-[38ch] text-[14px] leading-relaxed text-text-muted">
            <template v-if="searching">
              {{ t('notes.noMatch') }}
            </template>
            <template v-else-if="onlyUnfiled">
              {{ t('notes.allFiled') }}
            </template>
            <template v-else>
              {{ t('notes.noNotesYet') }}
            </template>
          </p>
          <UiBtn
            v-if="!searching"
            variant="secondary"
            size="sm"
            to="/app/notes"
            @click="shown = false"
          >
            {{ t('notes.goToNotes') }}
          </UiBtn>
        </div>
      </div>
    </div>

    <template
      v-if="multiple"
      #footer
    >
      <span class="mr-auto text-[13px] text-text-muted">
        {{ count ? t('notes.notesPicked', count) : t('notes.pickOneOrMore') }}
      </span>
      <UiBtn
        variant="ghost"
        @click="shown = false"
      >
        {{ t('notes.cancel') }}
      </UiBtn>
      <UiBtn
        variant="primary"
        :disabled="!count"
        title="Ctrl/⌘ + Enter"
        @click="done"
      >
        {{ label }}
      </UiBtn>
    </template>
  </UiModal>
</template>
