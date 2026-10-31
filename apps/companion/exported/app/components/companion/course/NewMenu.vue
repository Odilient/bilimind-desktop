<script setup lang="ts">
import type { Subject } from '~/companion/types'

/**
 * The course's one "+ New": a page, a whiteboard, an upload, a recording,
 * notes brought in from My notes, or a lesson on a topic, in a small menu
 * headed with the course it lands in ("Add to Databases"). A row says what it
 * makes and where in the course ("Under Lecture 8 · Transactions"), and wraps
 * rather than cutting a long name short. Notes made anywhere else start in My
 * notes; this menu is the one place that files into a course, so it says so
 * in so many words. It replaces the two buttons the bar used to carry
 * (+ Note, + Whiteboard), which left no room for the rest and read as a
 * toolbar.
 *
 * Record lives here too, where the course allows it, instead of a button of
 * its own in the bar: while one of the course's classes is on it moves to
 * the top and says so, because that is the moment it is for.
 *
 * `n`, `b` and `r` inside the open menu pick a page, a board or Record, for
 * the hands that never leave the keyboard.
 */
const props = defineProps<{
  /** "Lecture 8 · Transactions", or the course's name: where a page lands. */
  where: string
  /** The course, for the rows' words and "Add from My notes…". */
  subject?: Subject | null
  disabled?: boolean
  /** A lesson can be asked for (a written course stands behind this one, or can). */
  canWrite?: boolean
  /** A school course that allows recording its classes. */
  canRecord?: boolean
  /** One of its classes is on now. */
  live?: boolean
}>()

const emit = defineEmits<{ note: []; board: []; upload: []; record: []; lesson: [] }>()

const adder = ref<{ start: () => void } | null>(null)

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const list = ref<HTMLElement | null>(null)

interface Row {
  key: 'note' | 'board' | 'upload' | 'record' | 'pull' | 'lesson'
  icon: string
  label: string
  hint: string
  keyHint?: string
}

const rows = computed<Row[]>(() => {
  const course = props.subject?.title ?? null
  const under = course && props.where !== course ? `Under ${props.where}` : 'At the top of the course'
  const record: Row[] = props.canRecord
    ? [
        {
          key: 'record',
          icon: 'mic',
          label: props.live ? 'Record the class' : 'Record audio',
          hint: props.live ? `${props.where} is on now` : 'A lecture, a seminar, a thought out loud',
          keyHint: 'R',
        },
      ]
    : []
  return [
    ...(props.live ? record : []),
    { key: 'note', icon: 'page', label: 'Page', hint: under, keyHint: 'N' },
    {
      key: 'board',
      icon: 'board',
      label: 'Whiteboard',
      hint: 'Draw, map and stick notes',
      keyHint: 'B',
    },
    { key: 'upload', icon: 'upload', label: 'Upload files', hint: 'Slides, PDFs, photos; several at once' },
    ...(props.live ? [] : record),
    ...(props.subject
      ? [{ key: 'pull' as const, icon: 'notebook', label: 'Add from My notes…', hint: 'Notes that are in no course yet' }]
      : []),
    ...(props.canWrite === false
      ? []
      : [{ key: 'lesson' as const, icon: 'wand', label: 'Lesson on a topic…', hint: 'Written for you, opened here' }]),
  ]
})

function choose(key: Row['key']): void {
  open.value = false
  if (key === 'note') emit('note')
  else if (key === 'board') emit('board')
  else if (key === 'upload') emit('upload')
  else if (key === 'record') emit('record')
  else if (key === 'pull') adder.value?.start()
  else emit('lesson')
}

async function toggle(): Promise<void> {
  open.value = !open.value
  if (!open.value) return
  await nextTick()
  list.value?.querySelector<HTMLButtonElement>('button')?.focus()
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (!root.value?.contains(event.target as Node)) open.value = false
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    open.value = false
    return
  }
  const key = event.key.toLowerCase()
  if (key === 'n' || key === 'b') {
    event.preventDefault()
    choose(key === 'n' ? 'note' : 'board')
    return
  }
  if (key === 'r' && props.canRecord) {
    event.preventDefault()
    choose('record')
    return
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  event.preventDefault()
  const buttons = [...(list.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
  const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
  const next = event.key === 'ArrowDown' ? (at + 1) % buttons.length : (at - 1 + buttons.length) % buttons.length
  buttons[next]?.focus()
}

watch(open, (isOpen) => {
  if (!import.meta.client) return
  const method = isOpen ? 'addEventListener' : 'removeEventListener'
  document[method]('pointerdown', onDocumentPointerDown as EventListener)
})

onBeforeUnmount(() => {
  if (import.meta.client) document.removeEventListener('pointerdown', onDocumentPointerDown as EventListener)
})
</script>

<template>
  <div
    ref="root"
    class="relative shrink-0"
  >
    <UiBtn
      variant="secondary"
      size="md"
      icon="plus"
      trailing-icon="chevron-down"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="menu"
      title="Make something in this course"
      @click="toggle"
    >
      New
    </UiBtn>

    <Transition
      enter-active-class="duration-150 ease-out"
      enter-from-class="opacity-0 scale-95 -translate-y-1"
      leave-active-class="duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        ref="list"
        role="menu"
        :aria-label="subject ? `Add to ${subject.title}` : 'New'"
        class="absolute top-full right-0 z-50 mt-1.5 w-[320px] max-w-[calc(100vw-24px)] origin-top-right rounded-[16px] bg-surface p-1.5 shadow-[0_0_0_1px_rgb(11_13_16/0.08),0_20px_40px_-12px_rgb(11_13_16/0.25)]"
        @keydown="onKeydown"
      >
        <p
          v-if="subject"
          class="px-2.5 pt-1.5 pb-2 text-[13px] leading-snug text-text-muted"
          role="presentation"
        >
          Add to <span class="font-semibold text-text">{{ subject.title }}</span>
        </p>
        <button
          v-for="row in rows"
          :key="row.key"
          type="button"
          role="menuitem"
          class="group/row flex w-full cursor-pointer items-center gap-3 rounded-[11px] px-2.5 py-2 text-left transition-colors hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:outline-none"
          @click="choose(row.key)"
        >
          <span class="grid size-8 shrink-0 place-items-center rounded-[9px] bg-surface-sunken text-text-soft transition-colors group-hover/row:bg-surface group-hover/row:text-text group-focus-visible/row:bg-surface">
            <CompanionIcon
              :name="row.icon"
              :size="16"
            />
          </span>
          <span class="grid min-w-0 flex-1 gap-px">
            <span class="text-[14px] font-semibold text-text">{{ row.label }}</span>
            <span class="text-[12.5px] leading-snug text-text-muted">{{ row.hint }}</span>
          </span>
          <kbd
            v-if="row.keyHint"
            class="shrink-0 rounded-[5px] px-1.5 text-[11px] font-medium text-text-faint shadow-[inset_0_0_0_1px_var(--border)]"
          >{{ row.keyHint }}</kbd>
        </button>
      </div>
    </Transition>

    <CompanionCourseAddNotes
      v-if="subject"
      ref="adder"
      :subject="subject"
      look="none"
    />
  </div>
</template>
