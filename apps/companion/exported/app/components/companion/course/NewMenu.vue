<script setup lang="ts">
import type { Subject } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { namedTarget } from '~/companion/capture'
import { googleAvailable, importFromDrive } from '~/companion/google/drive'
const { t } = useI18n()

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

const c = useCompanion()

const adder = ref<{ start: () => void } | null>(null)

const open = ref(false)
const quizlet = ref(false)
const linking = ref(false)
/** Drive only where Google is set up and the device can open its sign-in (`drive.ts`). */
const drive = ref(false)
onMounted(() => (drive.value = googleAvailable()))
const root = ref<HTMLElement | null>(null)
const list = ref<HTMLElement | null>(null)

interface Row {
  key: 'note' | 'board' | 'upload' | 'record' | 'pull' | 'quizlet' | 'lesson' | 'drive' | 'notion' | 'link'
  icon: string
  label: string
  hint: string
  keyHint?: string
}

const rows = computed<Row[]>(() => {
  const course = props.subject?.title ?? null
  const under = course && props.where !== course ? t('course.menu.under', { where: props.where }) : t('course.menu.top')
  const record: Row[] = props.canRecord
    ? [
        {
          key: 'record',
          icon: 'mic',
          label: props.live ? t('course.menu.recordClass') : t('course.menu.recordAudio'),
          hint: props.live ? t('course.menu.live', { where: props.where }) : t('course.menu.recordHint'),
          keyHint: 'R',
        },
      ]
    : []
  return [
    ...(props.live ? record : []),
    { key: 'note', icon: 'page', label: t('course.menu.page'), hint: under, keyHint: 'N' },
    {
      key: 'board',
      icon: 'board',
      label: t('course.menu.board'),
      hint: t('course.menu.boardHint'),
      keyHint: 'B',
    },
    { key: 'upload', icon: 'upload', label: t('course.menu.upload'), hint: t('course.menu.uploadHint') },
    ...(props.live ? [] : record),
    ...(props.subject
      ? [
          // Integrations: the apps a course's things already live in.
          ...(drive.value ? [{ key: 'drive' as const, icon: 'download', label: t('course.menu.drive'), hint: t('course.menu.driveHint') }] : []),
          { key: 'link' as const, icon: 'link', label: t('course.menu.link'), hint: t('course.menu.linkHint') },
          { key: 'notion' as const, icon: 'notebook', label: t('course.menu.notion'), hint: t('course.menu.notionHint') },
          { key: 'pull' as const, icon: 'notebook', label: t('course.menu.pull'), hint: t('course.menu.pullHint') },
          // Daylight 2 (gaps): a Quizlet set becomes this course's cards.
          { key: 'quizlet' as const, icon: 'cards', label: t('course.menu.quizlet'), hint: t('course.menu.quizletHint') },
        ]
      : []),
    ...(props.canWrite === false
      ? []
      : [{ key: 'lesson' as const, icon: 'wand', label: t('course.menu.lesson'), hint: t('course.menu.lessonHint') }]),
  ]
})

function choose(key: Row['key']): void {
  open.value = false
  if (key === 'note') emit('note')
  else if (key === 'board') emit('board')
  else if (key === 'upload') emit('upload')
  else if (key === 'record') emit('record')
  else if (key === 'pull') adder.value?.start()
  else if (key === 'quizlet') quizlet.value = true
  else if (key === 'link') linking.value = true
  else if (key === 'drive' && props.subject) void importFromDrive(c, namedTarget(c, props.subject.id))
  else if (key === 'notion' && props.subject) void navigateTo({ path: '/app/notion', query: { subject: props.subject.id } })
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
      :title="t('course.menu.make')"
      @click="toggle"
    >
      {{ t('course.menu.new') }}
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
        :aria-label="subject ? t('course.menu.addTo', { course: subject.title }) : t('course.menu.new')"
        class="absolute top-full right-0 z-50 mt-1.5 w-[320px] max-w-[calc(100vw-24px)] origin-top-right rounded-[16px] bg-surface-pop p-1.5 shadow-[var(--shadow-pop)]"
        @keydown="onKeydown"
      >
        <p
          v-if="subject"
          class="px-2.5 pt-1.5 pb-2 text-[13px] leading-snug text-text-muted"
          role="presentation"
        >
          <i18n-t keypath="course.menu.addTo" tag="span"><template #course><span class="font-semibold text-text">{{ subject.title }}</span></template></i18n-t>
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

    <CompanionImportsQuizletModal
      v-if="subject"
      v-model:open="quizlet"
      :subject-id="subject.id"
    />
    <CompanionIntegrationsLinkDialog
      v-if="subject"
      v-model:open="linking"
      :subject-id="subject.id"
      :title="t('course.menu.addLink', { title: subject.title })"
      :example="t('course.menu.example')"
    />
  </div>
</template>
