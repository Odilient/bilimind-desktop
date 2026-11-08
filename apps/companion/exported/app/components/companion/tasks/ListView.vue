<script setup lang="ts">
/**
 * The same cards as the board, as a tracker's list (adgen-new's to-do): one
 * group per column, each folding, one dense row per card: its priority (a
 * picker, so a row is re-ranked without opening it), the status ring that
 * ticks it, the title, then its steps, its course and when. A row opens the
 * card's page.
 */
import type { Priority } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import {
  COLUMN_LABELS,
  KIND_LABELS,
  PRIORITY_LABELS,
  PRIORITY_OPTIONS,
  checklistOf,
  checklistProgress,
  entryWhen,
  priorityOf,
  titleOf,
  updateEntry,
  type BoardCard,
  type TaskColumn,
  type TaskEntry,
} from '~/companion/tasks'

const props = defineProps<{ columns: Record<TaskColumn, BoardCard[]> }>()

const emit = defineEmits<{ add: [column: TaskColumn]; toggle: [entry: TaskEntry] }>()

const c = useCompanion()
const { t } = useI18n()

const COLUMNS: TaskColumn[] = ['todo', 'doing', 'done']
const shut = ref<Partial<Record<TaskColumn, boolean>>>({})

function subjectOf(entry: TaskEntry) {
  return c.subjectOf(entry.kind === 'task' ? entry.task : entry.deadline)
}

function when(card: BoardCard): string {
  const at = entryWhen(card.entry, card.group)
  return card.group === 'today' ? [t('common.today'), at].filter(Boolean).join(' ') : at
}

function rank(entry: TaskEntry, key: string): void {
  void updateEntry(c, entry, { priority: Number(key) as Priority }).catch(() => undefined)
}

function open(entry: TaskEntry): void {
  void navigateTo(`/app/tasks/${entry.id}`)
}
</script>

<template>
  <!-- minmax(0, 1fr): a row's one-line title must not widen the list past the page. -->
  <div class="grid grid-cols-[minmax(0,1fr)] gap-3">
    <section
      v-for="col in COLUMNS"
      :key="col"
      :aria-labelledby="`list-${col}`"
    >
      <header class="flex h-10 items-center gap-1 rounded-[12px] bg-[rgb(var(--wash-rgb)/0.04)] pr-1.5 pl-1">
        <button
          type="button"
          :aria-expanded="!shut[col]"
          class="inline-flex h-8 cursor-pointer items-center gap-2 rounded-[8px] px-2 hover:bg-[rgb(var(--wash-rgb)/0.05)]"
          @click="shut[col] = !shut[col]"
        >
          <UiIcon
            name="chevron-down"
            :size="14"
            :class="['text-text-faint transition-transform duration-150', shut[col] && '-rotate-90']"
          />
          <CompanionTasksStatusIcon :s="col" />
          <span
            :id="`list-${col}`"
            class="text-[14px] font-semibold text-text"
          >{{ COLUMN_LABELS[col] }}</span>
          <span class="num text-[13px] text-text-faint">{{ props.columns[col].length }}</span>
        </button>
        <span class="flex-1" />
        <button
          v-if="col !== 'done'"
          type="button"
          :aria-label="t('tasks.list.newIn', { col: COLUMN_LABELS[col] })"
          :title="t('tasks.list.newIn', { col: COLUMN_LABELS[col] })"
          class="grid size-8 cursor-pointer place-items-center rounded-[8px] text-text-faint hover:bg-[rgb(var(--wash-rgb)/0.06)] hover:text-text"
          @click="emit('add', col)"
        >
          <UiIcon
            name="plus"
            :size="16"
          />
        </button>
      </header>

      <ul
        v-if="!shut[col]"
        class="mt-1"
      >
        <li
          v-for="card in props.columns[col]"
          :key="card.entry.id"
          role="link"
          tabindex="0"
          :aria-label="titleOf(card.entry)"
          class="group flex h-11 cursor-pointer items-center gap-1 border-b border-border-rule px-1 last:border-b-0 hover:bg-[rgb(var(--wash-rgb)/0.03)] focus-visible:rounded-[8px] focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
          @click="open(card.entry)"
          @keydown.enter.self="open(card.entry)"
        >
          <CompanionTasksPropMenu
            :label="t('tasks.field.priority')"
            kind="priority"
            variant="icon"
            :options="PRIORITY_OPTIONS"
            :value="String(priorityOf(card.entry))"
            @pick="rank(card.entry, $event)"
          >
            <CompanionTasksPriorityIcon :p="priorityOf(card.entry)" />
            <span class="sr-only">{{ t('tasks.card.priority', { name: PRIORITY_LABELS[priorityOf(card.entry)] }) }}</span>
          </CompanionTasksPropMenu>
          <button
            type="button"
            role="checkbox"
            :aria-checked="col === 'done'"
            :aria-label="`${col === 'done' ? t('tasks.card.done') : t('tasks.card.markDone')}: ${titleOf(card.entry)}`"
            class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-leaf-soft"
            @click.stop="emit('toggle', card.entry)"
          >
            <CompanionTasksStatusIcon :s="col" />
          </button>
          <span
            :class="[
              'min-w-0 flex-1 truncate pl-1 text-[14px] font-medium',
              col === 'done' ? 'text-text-faint line-through decoration-text-ghost' : 'text-text',
            ]"
          >{{ titleOf(card.entry) }}</span>
          <span
            v-if="checklistProgress(checklistOf(card.entry))"
            class="num hidden shrink-0 items-center gap-1 text-[12.5px] text-text-muted sm:inline-flex"
          >
            <UiIcon
              name="check-circle"
              :size="12"
            />{{ checklistProgress(checklistOf(card.entry))!.done }}/{{ checklistProgress(checklistOf(card.entry))!.total }}
          </span>
          <span
            v-if="card.entry.kind === 'deadline'"
            class="hidden shrink-0 items-center gap-1 text-[12.5px] text-text-muted md:inline-flex"
          >
            <CompanionIcon
              name="cap"
              :size="12"
            />{{ KIND_LABELS[card.entry.deadline.kind] }}
          </span>
          <span
            v-if="subjectOf(card.entry)"
            class="hidden max-w-[180px] shrink-0 items-center gap-1.5 rounded-full py-0.5 pr-2 pl-1 text-[12.5px] text-text-soft shadow-[inset_0_0_0_1px_var(--border)] md:inline-flex"
          >
            <CompanionCourseCover
              :subject="subjectOf(card.entry)!"
              size="sm"
              :px="14"
            />
            <span class="truncate">{{ subjectOf(card.entry)!.title }}</span>
          </span>
          <span
            :class="[
              'num w-[110px] shrink-0 truncate text-right text-[12.5px] sm:w-[124px]',
              col !== 'done' && card.group === 'overdue' ? 'font-semibold text-rose-ink' : 'text-text-muted',
            ]"
          >{{ when(card) }}</span>
        </li>
        <li
          v-if="!props.columns[col].length"
          class="px-3 py-3 text-[13.5px] text-text-muted"
        >
          {{ col === 'todo' ? t('tasks.list.emptyTodo') : col === 'doing' ? t('tasks.list.emptyDoing') : t('tasks.list.emptyDone') }}
        </li>
      </ul>
    </section>
  </div>
</template>
