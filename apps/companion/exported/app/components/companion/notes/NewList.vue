<script setup lang="ts">
const { t: tt } = useI18n()
import { NEW_NOTE_TYPES, offered, useNewNote, type NewKind, type NewNoteType } from '~/companion/notes/new'
import { normaliseUrl } from '~/companion/capture'
import { courseColor } from '~/companion/colors'
import { useQuietAi } from '~/companion/quiet-ai'
import { useCompanion } from '~/companion/store'
// Google
import { namedTarget } from '~/companion/capture'
import { driveBusy, googleAvailable, importFromDrive, preloadGoogle } from '~/companion/google/drive'

/**
 * What Notes' "+" opens: one row per kind of note (a tinted round icon, what
 * it is, one line on what it's for, the letter that picks it), and under
 * Page and Whiteboard the shapes they can start in as small chips, so a
 * Cornell page is one press, not a dialog. "Draft with AI…" sits apart, in
 * the AI's own mark.
 *
 * "Add a link" turns the list into one field and a button, in place, with
 * Back; everything else acts at once and asks to be closed (`done`). The
 * foot says where what's made goes: My notes, unless a course's own button
 * opened this. It reads as the rule, so nobody wonders whether the course
 * on screen just got a page they didn't ask for.
 *
 * Drawn by `CompanionNotesNewButton` (a popover, a sheet on a phone) and by
 * the capture sheet's menu. The arrows walk every row and chip; a letter
 * picks a row while nothing is being typed.
 *
 * A course's workspace draws a part of it under each sidebar heading
 * (`kinds`: pages and boards under Notes, files, links and recordings under
 * Materials) and makes the thing itself (`here`), so what's made opens as a
 * tab beside the others, filed under the class you're in, instead of
 * leaving the course for Notes. Draft with AI still opens the assistant.
 */
const props = withDefaults(
  defineProps<{
    subjectId?: string | null
    /** The phone sheet: 52px rows. */
    roomy?: boolean
    /** Put the focus on the first row when shown (a menu opened from the keyboard or a click). */
    autofocus?: boolean
    /** Only these kinds, in the list's own order. */
    kinds?: NewKind[] | null
    /** The parent makes it: rows emit `pick` (and a link `link`) instead of making and opening. */
    here?: boolean
  }>(),
  { subjectId: null, roomy: false, autofocus: true, kinds: null, here: false },
)

const emit = defineEmits<{
  made: [id: string]
  done: []
  pick: [kind: NewKind, template: string | null]
  link: [url: string]
}>()

const store = useCompanion()
const { quiet } = useQuietAi()
const make = useNewNote({ subjectId: () => props.subjectId, made: (id) => emit('made', id) })

const course = computed(() => store.get('subjects', props.subjectId))
const types = computed(() =>
  NEW_NOTE_TYPES.filter(
    // recording: `offered` leaves "Record screen" out off the desktop
    (t) => (!props.kinds || props.kinds.includes(t.key)) && !(quiet.value && t.key === 'draft') && offered(t),
  ),
)
const plain = computed(() => types.value.filter((t) => t.key !== 'draft'))
const draftRow = computed(() => types.value.find((t) => t.key === 'draft') ?? null)

/* -- Acting ------------------------------------------------------------------ */

const mode = ref<'list' | 'link'>('list')

function pick(type: NewNoteType, template: string | null = null): void {
  if (props.here && type.key !== 'draft' && type.key !== 'link') {
    emit('pick', type.key, template)
    emit('done')
    return
  }
  switch (type.key) {
    case 'page':
      void make.page(template)
      break
    case 'board':
      void make.board(template)
      break
    case 'upload':
    case 'photo':
      void make.files(type.key)
      break
    case 'record':
      make.record()
      break
    // recording
    case 'screen':
      make.screen()
      break
    // imports
    case 'notion':
      make.notion()
      break
    case 'draft':
      make.draft()
      break
    case 'link':
      mode.value = 'link'
      void nextTick(() => linkField.value?.focus())
      return
  }
  emit('done')
}

/* -- A link ------------------------------------------------------------------ */

const url = ref('')
const linkField = ref<HTMLInputElement | null>(null)
const parsed = computed(() => normaliseUrl(url.value))
const tried = ref(false)

async function addLink(): Promise<void> {
  tried.value = true
  if (!parsed.value) return
  const value = parsed.value
  emit('done')
  if (props.here) emit('link', value)
  else await make.link(value)
  url.value = ''
  tried.value = false
  mode.value = 'list'
}

function back(): void {
  mode.value = 'list'
  url.value = ''
  tried.value = false
  void nextTick(() => root.value?.querySelector<HTMLElement>('[data-new-option="link"]')?.focus())
}

/* -- Keys -------------------------------------------------------------------- */

const root = ref<HTMLElement | null>(null)

function onKey(event: KeyboardEvent): void {
  if (mode.value === 'link') {
    if (event.key === 'Escape') {
      event.stopPropagation()
      back()
    }
    return
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const all = [...(root.value?.querySelectorAll<HTMLElement>('[data-new-option]:not(:disabled)') ?? [])]
    const at = all.indexOf(document.activeElement as HTMLElement)
    const step = event.key === 'ArrowDown' ? 1 : -1
    all[at < 0 ? 0 : (at + step + all.length) % all.length]?.focus()
    return
  }
  const type = types.value.find((t) => t.letter === event.key.toLowerCase())
  if (type) {
    event.preventDefault()
    pick(type)
  }
}

onMounted(() => {
  if (props.autofocus) root.value?.querySelector<HTMLElement>('[data-new-option]')?.focus({ preventScroll: true })
})

const working = (key: NewKind): boolean => make.busy.value === key

/*
 * Google: "From Google Drive" sits under a course's Materials "+" (the
 * one list here that files uploads into a course), where Google is set up and the
 * device can open its sign-in. It files in that course, as the button says, and
 * does the work itself: the Picker is Google's window, not something the course
 * page has to host.
 */
const drive = computed(() => props.here && Boolean(props.kinds?.includes('upload')) && googleAvailable())

onMounted(() => {
  if (drive.value) preloadGoogle()
})

function fromDrive(): void {
  emit('done')
  void importFromDrive(store, namedTarget(store, props.subjectId))
}
</script>

<template>
  <div
    ref="root"
    class="grid"
    @keydown="onKey"
  >
    <template v-if="mode === 'list'">
      <div
        role="menu"
        :aria-label="tt('notes.newNote')"
        class="grid gap-px"
      >
        <div
          v-for="t in plain"
          :key="t.key"
          class="grid"
        >
          <button
            type="button"
            role="menuitem"
            :data-new-option="t.key"
            :disabled="Boolean(make.busy.value)"
            :class="[
              'group/opt flex w-full cursor-pointer items-center gap-3 rounded-[12px] px-2 text-left transition-colors duration-150 outline-none hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:shadow-[inset_0_0_0_2px_var(--brand)] disabled:cursor-wait',
              roomy ? 'min-h-[56px] py-2' : 'min-h-[48px] py-1.5',
              t.templates && 'pb-1',
            ]"
            @click="pick(t)"
          >
            <span :class="['grid shrink-0 place-items-center rounded-full', t.tone, roomy ? 'size-10' : 'size-9']">
              <UiIcon
                v-if="working(t.key)"
                name="loader"
                :size="16"
                class="animate-spin"
              />
              <CompanionNotesGlyph
                v-else
                :name="t.icon"
                :size="roomy ? 19 : 17"
                :stroke="1.9"
              />
            </span>
            <span class="grid min-w-0 flex-1 gap-px">
              <span :class="['font-semibold text-text', roomy ? 'text-[15px]' : 'text-[14px]']">{{ t.label }}</span>
              <span :class="['truncate leading-snug text-text-muted', roomy ? 'text-[13px]' : 'text-[12.5px]']">{{ t.hint }}</span>
            </span>
            <kbd
              class="hidden shrink-0 rounded-[6px] border border-border-field px-1.5 py-0.5 font-sans text-[11px] text-text-faint opacity-0 transition-opacity group-hover/opt:opacity-100 group-focus-visible/opt:opacity-100 lg:block"
              aria-hidden="true"
            >{{ t.letter.toUpperCase() }}</kbd>
          </button>
          <!-- The shapes it can start in: one press each. -->
          <div
            v-if="t.templates"
            :class="['flex flex-wrap gap-1 pr-2 pb-2', roomy ? 'pl-[60px]' : 'pl-[56px]']"
          >
            <button
              v-for="tpl in t.templates"
              :key="tpl.key"
              type="button"
              :data-new-option="`${t.key}:${tpl.key}`"
              :disabled="Boolean(make.busy.value)"
              :title="tt('notes.newTplTitle', { kind: t.key === 'page' ? tt('notes.kindPage') : tt('notes.kindBoard'), tpl: tpl.label })"
              :class="[
                'cursor-pointer rounded-full bg-surface-sunken px-2.5 font-medium text-text-soft transition-colors duration-150 outline-none hover:bg-surface-track hover:text-text focus-visible:shadow-[inset_0_0_0_2px_var(--brand)] disabled:cursor-wait',
                roomy ? 'h-9 text-[13.5px]' : 'h-[26px] text-[12px]',
              ]"
              @click="pick(t, tpl.key)"
            >
              {{ tpl.label }}
            </button>
          </div>
        </div>

        <!-- Google: files picked in Drive, filed in this course. -->
        <button
          v-if="drive"
          type="button"
          role="menuitem"
          data-new-option="drive"
          :disabled="Boolean(make.busy.value) || driveBusy"
          :class="[
            'group/opt flex w-full cursor-pointer items-center gap-3 rounded-[12px] px-2 text-left transition-colors duration-150 outline-none hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:shadow-[inset_0_0_0_2px_var(--brand)] disabled:cursor-wait',
            roomy ? 'min-h-[56px] py-2' : 'min-h-[48px] py-1.5',
          ]"
          @click="fromDrive"
        >
          <span :class="['grid shrink-0 place-items-center rounded-full bg-surface-sunken text-text-soft', roomy ? 'size-10' : 'size-9']">
            <UiIcon
              v-if="driveBusy"
              name="loader"
              :size="16"
              class="animate-spin"
            />
            <CompanionNotesGlyph
              v-else
              name="download"
              :size="roomy ? 19 : 17"
              :stroke="1.9"
            />
          </span>
          <span class="grid min-w-0 flex-1 gap-px">
            <span :class="['font-semibold text-text', roomy ? 'text-[15px]' : 'text-[14px]']">{{ tt('notes.fromDrive') }}</span>
            <span :class="['truncate leading-snug text-text-muted', roomy ? 'text-[13px]' : 'text-[12.5px]']">{{ tt('notes.fromDriveHint') }}</span>
          </span>
        </button>

        <!-- The AI, apart, in its own mark. -->
        <template v-if="draftRow">
          <div class="mx-2 my-1 border-t border-border-rule" />
          <button
            type="button"
            role="menuitem"
            data-new-option="draft"
            :class="[
              'group/opt flex w-full cursor-pointer items-center gap-3 rounded-[12px] px-2 text-left transition-colors duration-150 outline-none hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:shadow-[inset_0_0_0_2px_var(--brand)]',
              roomy ? 'min-h-[56px] py-2' : 'min-h-[48px] py-1.5',
            ]"
            @click="pick(draftRow)"
          >
            <span :class="['grid shrink-0 place-items-center rounded-full bg-inverse', roomy ? 'size-10' : 'size-9']">
              <span class="grid size-6 place-items-center rounded-full bg-accent text-on-accent">
                <UiIcon
                  name="spark"
                  :size="13"
                />
              </span>
            </span>
            <span class="grid min-w-0 flex-1 gap-px">
              <span :class="['font-semibold text-text', roomy ? 'text-[15px]' : 'text-[14px]']">{{ draftRow.label }}</span>
              <span :class="['truncate leading-snug text-text-muted', roomy ? 'text-[13px]' : 'text-[12.5px]']">{{ draftRow.hint }}</span>
            </span>
            <kbd
              class="hidden shrink-0 rounded-[6px] border border-border-field px-1.5 py-0.5 font-sans text-[11px] text-text-faint opacity-0 transition-opacity group-hover/opt:opacity-100 group-focus-visible/opt:opacity-100 lg:block"
              aria-hidden="true"
            >A</kbd>
          </button>
        </template>
      </div>
    </template>

    <!-- A link: the field, in place of the list. -->
    <form
      v-else
      class="grid gap-3 p-2"
      @submit.prevent="addLink"
    >
      <div class="flex items-center gap-1.5">
        <button
          type="button"
          class="-ml-1.5 grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-text-faint transition-colors hover:bg-surface-sunken hover:text-text focus-visible:outline-2 focus-visible:outline-brand max-lg:size-11"
          :aria-label="tt('notes.backToList')"
          :title="tt('notes.backEsc')"
          @click="back"
        >
          <UiIcon
            name="chevron-left"
            :size="17"
          />
        </button>
        <span class="text-[14px] font-semibold text-text">{{ tt('notes.addLink') }}</span>
      </div>
      <label
        :class="[
          'flex items-center gap-2 rounded-[12px] bg-surface-sunken px-3 text-text-faint transition-shadow focus-within:bg-surface focus-within:shadow-[inset_0_0_0_2px_var(--brand)]',
          roomy ? 'h-12' : 'h-10',
          tried && !parsed && 'shadow-[inset_0_0_0_2px_var(--danger)]',
        ]"
      >
        <UiIcon
          name="link"
          :size="15"
          class="shrink-0"
        />
        <input
          ref="linkField"
          v-model="url"
          type="url"
          inputmode="url"
          autocomplete="off"
          spellcheck="false"
          :placeholder="tt('notes.pasteLink')"
          :aria-label="tt('notes.theLink')"
          :class="['min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-text-faint', roomy ? 'text-[16px]' : 'text-[14px]']"
        >
      </label>
      <p
        v-if="tried && !parsed"
        class="-mt-1 text-[12.5px] text-danger"
        role="alert"
      >
        {{ tt('notes.badLink') }}
      </p>
      <UiBtn
        type="submit"
        variant="primary"
        :size="roomy ? 'lg' : 'md'"
        :disabled="!url.trim()"
        :loading="make.busy.value === 'link'"
      >
        {{ tt('notes.addLinkBtn') }}
      </UiBtn>
    </form>

    <!-- Where it goes: the rule, said once. -->
    <p
      :class="[
        'mt-1.5 flex items-center gap-1.5 border-t border-border-rule px-2 pt-2 text-text-faint',
        roomy ? 'text-[13px]' : 'text-[12px]',
      ]"
    >
      <span
        v-if="course"
        class="size-1.5 shrink-0 rounded-full"
        :style="{ background: courseColor(course.color) }"
      />
      <CompanionIcon
        v-else
        name="notebook"
        :size="13"
        class="shrink-0"
      />
      <span class="truncate">
        <template v-if="course">{{ tt('notes.goesInCourse', { course: course.title }) }}</template>
        <template v-else>{{ tt('notes.goesInMine') }}</template>
      </span>
    </p>
  </div>
</template>
