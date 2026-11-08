<script setup lang="ts">
/**
 * One card on the Tasks board, laid out the way a tracker lays one out so it
 * reads at a glance (adgen-new's to-do): a small top row with its state and
 * its course, the title, then small chips for what matters about it, its
 * priority, when, how long, its steps done, and for a deadline what kind of
 * thing the school set and what it weighs.
 *
 * The status ring is the tick: a press marks it done (a deadline handed in)
 * or back. Anywhere else opens the card's page (`/app/tasks/{id}`); the "⋯"
 * moves it between columns, and an own task between days, without a pointer.
 * The page drags it (`grab`).
 */
import type { MenuAction } from '~/components/ui/Menu.vue'
import type { PlanTask } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { dayKey, mondayOf, shiftDay } from '~/companion/time'
import {
  COLUMN_LABELS,
  KIND_LABELS,
  PRIORITY_LABELS,
  checklistProgress,
  checklistOf,
  columnOf,
  entryWhen,
  minutesLabel,
  notesOf,
  priorityOf,
  titleOf,
  type TaskColumn,
  type TaskEntry,
  type TaskGroupKey,
} from '~/companion/tasks'

const props = defineProps<{ entry: TaskEntry; group: TaskGroupKey; dragging?: boolean }>()

const emit = defineEmits<{
  toggle: [entry: TaskEntry]
  column: [entry: TaskEntry, column: TaskColumn]
  move: [task: PlanTask, date: string | null]
  remove: [task: PlanTask]
  grab: [event: PointerEvent]
}>()

const c = useCompanion()
const { t } = useI18n()

const column = computed(() => columnOf(props.entry))
const done = computed(() => column.value === 'done')
const title = computed(() => titleOf(props.entry))
const subject = computed(() => c.subjectOf(props.entry.kind === 'task' ? props.entry.task : props.entry.deadline))
const priority = computed(() => priorityOf(props.entry))
const steps = computed(() => checklistProgress(checklistOf(props.entry)))
const noted = computed(() => Boolean(notesOf(props.entry).trim()))

const when = computed(() => {
  const at = entryWhen(props.entry, props.group)
  return props.group === 'today' ? [t('common.today'), at].filter(Boolean).join(' ') : at
})

/** 15 minutes is what a task gets when nobody said, so only a length someone gave is worth a chip. */
const minutes = computed(() =>
  props.entry.kind === 'task' && !done.value && props.entry.task.minutes !== 15 ? minutesLabel(props.entry.task.minutes) : '',
)

const ICONS: Record<TaskColumn, string> = { todo: 'list', doing: 'play', done: 'check' }

const actions = computed<MenuAction[]>(() => {
  const list: MenuAction[] = (['todo', 'doing', 'done'] as const)
    .filter((col) => col !== column.value)
    .map((col) => ({ label: t('tasks.card.moveTo', { col: COLUMN_LABELS[col] }), icon: ICONS[col], run: () => emit('column', props.entry, col) }))
  if (props.entry.kind !== 'task') return list
  const task = props.entry.task
  if (!task.done_at) {
    const today = dayKey()
    const days: [string, string | null][] = [
      [t('tasks.card.doToday'), today],
      [t('tasks.card.doTomorrow'), shiftDay(today, 1)],
      [t('tasks.day.nextWeek'), shiftDay(mondayOf(today), 7)],
      [t('tasks.day.none'), null],
    ]
    for (const [label, date] of days) {
      if (date !== task.date) list.push({ label, icon: date ? 'calendar' : 'x', run: () => emit('move', task, date) })
    }
  }
  list.push({ label: t('common.delete'), icon: 'trash', destructive: true, run: () => emit('remove', task) })
  return list
})

function open(): void {
  void navigateTo(`/app/tasks/${props.entry.id}`)
}

/** A press on the ring or the "⋯" is theirs, never the start of a drag. */
function grab(event: PointerEvent): void {
  if (event.button !== 0 || (event.target as HTMLElement).closest('[data-no-drag]')) return
  emit('grab', event)
}
</script>

<template>
  <article
    role="link"
    tabindex="0"
    :aria-label="title"
    :class="[
      'group relative grid cursor-pointer touch-manipulation gap-1.5 rounded-[12px] bg-surface px-2.5 pt-1.5 pb-2.5 shadow-[0_0_0_1px_var(--border),var(--shadow-card)] transition-[box-shadow,opacity,translate] duration-150 select-none hover:-translate-y-px hover:shadow-[0_0_0_1px_var(--border-strong),var(--shadow-raised)] focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none motion-reduce:hover:translate-y-0',
      dragging && 'opacity-40',
    ]"
    @pointerdown="grab"
    @click="open"
    @keydown.enter.self="open"
  >
    <div class="flex min-h-8 items-center gap-1.5">
      <button
        type="button"
        role="checkbox"
        :aria-checked="done"
        :aria-label="`${done ? t('tasks.card.done') : entry.kind === 'deadline' ? t('tasks.card.markHandedIn') : t('tasks.card.markDone')}: ${title}`"
        :title="done ? t('tasks.card.notDone') : entry.kind === 'deadline' ? t('tasks.card.markHandedIn') : t('tasks.card.markDone')"
        class="-ml-1.5 grid size-8 shrink-0 cursor-pointer place-items-center rounded-full transition-colors hover:bg-leaf-soft focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        data-no-drag
        @click.stop="emit('toggle', entry)"
      >
        <CompanionTasksStatusIcon
          :s="column"
          :size="16"
        />
      </button>
      <CompanionCourseCover
        v-if="subject"
        :subject="subject"
        size="sm"
        :px="16"
      />
      <span class="min-w-0 flex-1 truncate text-[12.5px] text-text-muted">{{ subject?.title ?? t('tasks.course.none') }}</span>
      <div
        class="-mr-1 shrink-0 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
        data-no-drag
        @click.stop
      >
        <UiMenu
          :actions="actions"
          :title="title"
          :label="t('tasks.card.moreFor', { title })"
          float
        />
      </div>
    </div>

    <p
      class="line-clamp-2 text-[14.5px] leading-snug font-semibold [overflow-wrap:anywhere]"
      :class="done ? 'text-text-faint line-through decoration-text-ghost' : 'text-text'"
    >
      {{ title }}
    </p>

    <div
      v-if="priority || when || minutes || steps || noted || entry.kind === 'deadline'"
      class="flex flex-wrap items-center gap-1 text-[12px]"
    >
      <span
        v-if="priority"
        class="grid size-[22px] place-items-center rounded-[7px] shadow-[inset_0_0_0_1px_var(--border)]"
        :title="t('tasks.card.priority', { name: PRIORITY_LABELS[priority] })"
      >
        <CompanionTasksPriorityIcon
          :p="priority"
          :size="13"
        />
        <span class="sr-only">{{ t('tasks.card.priority', { name: PRIORITY_LABELS[priority] }) }}</span>
      </span>
      <span
        v-if="when"
        :class="[
          'num inline-flex h-[22px] items-center gap-1 rounded-[7px] px-1.5 font-semibold whitespace-nowrap',
          done
            ? 'text-text-ghost shadow-[inset_0_0_0_1px_var(--border)]'
            : group === 'overdue'
              ? 'bg-rose-soft text-rose-ink'
              : group === 'today'
                ? 'bg-accent-soft text-accent-strong'
                : 'text-text-soft shadow-[inset_0_0_0_1px_var(--border)]',
        ]"
      >
        <UiIcon
          name="calendar"
          :size="12"
        />{{ when }}
      </span>
      <span
        v-if="minutes"
        class="num inline-flex h-[22px] items-center gap-1 rounded-[7px] px-1.5 text-text-muted shadow-[inset_0_0_0_1px_var(--border)]"
      >
        <UiIcon
          name="timer"
          :size="12"
        />{{ minutes }}
      </span>
      <span
        v-if="steps"
        :class="[
          'num inline-flex h-[22px] items-center gap-1 rounded-[7px] px-1.5 shadow-[inset_0_0_0_1px_var(--border)]',
          steps.done === steps.total ? 'text-leaf-ink' : 'text-text-muted',
        ]"
        :title="t('tasks.card.steps', { done: steps.done, total: steps.total })"
      >
        <UiIcon
          name="check-circle"
          :size="12"
        />{{ steps.done }}/{{ steps.total }}
      </span>
      <span
        v-if="entry.kind === 'deadline'"
        class="inline-flex h-[22px] items-center gap-1 rounded-[7px] px-1.5 whitespace-nowrap text-text-muted shadow-[inset_0_0_0_1px_var(--border)]"
        :title="t('tasks.card.fromCourse', { kind: KIND_LABELS[entry.deadline.kind].toLowerCase() })"
      >
        <CompanionIcon
          name="cap"
          :size="12"
        />{{ KIND_LABELS[entry.deadline.kind] }}<template v-if="entry.deadline.weight_pct">
          · <span class="num">{{ entry.deadline.weight_pct }}%</span>
        </template>
      </span>
      <span
        v-if="entry.kind === 'deadline' && entry.deadline.grade != null"
        class="inline-flex h-[22px] items-center gap-1 rounded-[7px] px-1.5 whitespace-nowrap text-text shadow-[inset_0_0_0_1px_var(--border)]"
        :title="t('tasks.card.mark')"
      >
        {{ t('tasks.card.got') }} <span class="num font-semibold">{{ Math.round(entry.deadline.grade) }}%</span>
      </span>
      <span
        v-if="noted"
        class="grid size-[22px] place-items-center text-text-faint"
        :title="t('tasks.card.hasNote')"
      >
        <UiIcon
          name="file"
          :size="13"
        />
        <span class="sr-only">{{ t('tasks.card.hasNote') }}</span>
      </span>
    </div>
  </article>
</template>
