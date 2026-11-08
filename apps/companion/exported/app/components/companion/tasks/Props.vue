<script setup lang="ts">
/**
 * A card's properties, a tracker's sidebar (adgen-new's to-do): each value
 * is a picker. On a computer they stand in a column beside the page; on a
 * phone (`chips`) they fold into a row of pills under the title.
 *
 * An own task has all six. A deadline's course and date are the school's,
 * so they are read, not picked, and it adds what kind of thing it is and
 * what it weighs. Its column, priority, note and steps are the learner's.
 * A move to another column goes up to the page (`column`), which keeps the
 * tick's toast and Undo in one place.
 */
import type { Priority } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { dayKey, whenLabel } from '~/companion/time'
import {
  COLUMN_LABELS,
  DURATION_OPTIONS,
  KIND_LABELS,
  PRIORITY_LABELS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  TIME_OPTIONS,
  columnOf,
  courseOptions,
  dayOptions,
  editTask,
  minutesLabel,
  priorityOf,
  relativeTo,
  updateEntry,
  type TaskColumn,
  type TaskEntry,
} from '~/companion/tasks'

const props = defineProps<{ entry: TaskEntry; chips?: boolean }>()

const emit = defineEmits<{ column: [column: TaskColumn] }>()

const c = useCompanion()
const { t } = useI18n()

const today = computed(() => dayKey())
const column = computed(() => columnOf(props.entry))
const priority = computed(() => priorityOf(props.entry))
const task = computed(() => (props.entry.kind === 'task' ? props.entry.task : null))
const deadline = computed(() => (props.entry.kind === 'deadline' ? props.entry.deadline : null))
const subject = computed(() => c.subjectOf(task.value ?? deadline.value!))
const days = computed(() => [...dayOptions(today.value), { key: '', label: t('tasks.day.none') }])

const variant = computed(() => (props.chips ? 'chip' : 'side'))

function edit(changes: Parameters<typeof editTask>[2]): void {
  if (task.value) void editTask(c, task.value, changes).catch(() => undefined)
}

function pickDay(key: string): void {
  edit({ date: key || null })
}

function rank(key: string): void {
  void updateEntry(c, props.entry, { priority: Number(key) as Priority }).catch(() => undefined)
}
</script>

<template>
  <div
    :class="chips ? 'flex flex-wrap gap-1.5' : 'grid gap-0.5'"
    :aria-label="t('tasks.field.properties')"
    role="group"
  >
    <div :class="!chips && 'grid grid-cols-[84px_minmax(0,1fr)] items-center'">
      <span
        v-if="!chips"
        class="text-[13px] text-text-muted"
      >{{ t('tasks.field.status') }}</span>
      <CompanionTasksPropMenu
        :label="t('tasks.field.status')"
        kind="status"
        :variant="variant"
        align="right"
        :options="STATUS_OPTIONS"
        :value="column"
        @pick="emit('column', $event as TaskColumn)"
      >
        <CompanionTasksStatusIcon :s="column" />{{ COLUMN_LABELS[column] }}
      </CompanionTasksPropMenu>
    </div>

    <div :class="!chips && 'grid grid-cols-[84px_minmax(0,1fr)] items-center'">
      <span
        v-if="!chips"
        class="text-[13px] text-text-muted"
      >{{ t('tasks.field.priority') }}</span>
      <CompanionTasksPropMenu
        :label="t('tasks.field.priority')"
        kind="priority"
        :variant="variant"
        align="right"
        :options="PRIORITY_OPTIONS"
        :value="String(priority)"
        @pick="rank"
      >
        <CompanionTasksPriorityIcon :p="priority" />
        <span :class="!priority && 'text-text-muted'">{{ PRIORITY_LABELS[priority] }}</span>
      </CompanionTasksPropMenu>
    </div>

    <div :class="!chips && 'grid grid-cols-[84px_minmax(0,1fr)] items-center'">
      <span
        v-if="!chips"
        class="text-[13px] text-text-muted"
      >{{ t('tasks.field.course') }}</span>
      <CompanionTasksPropMenu
        v-if="task"
        :label="t('tasks.field.course')"
        kind="course"
        :variant="variant"
        align="right"
        :search="true"
        :options="courseOptions(c.shelf.value)"
        :value="task.subject_id ?? ''"
        @pick="edit({ subject_id: $event || null })"
      >
        <CompanionCourseCover
          v-if="subject"
          :subject="subject"
          size="sm"
          :px="16"
        />
        <span :class="['truncate', !subject && 'text-text-muted']">{{ subject?.title ?? t('tasks.course.none') }}</span>
      </CompanionTasksPropMenu>
      <NuxtLink
        v-else-if="subject"
        :to="`/app/courses/${subject.id}`"
        :class="[
          'inline-flex min-w-0 items-center gap-2 text-[13.5px] text-text hover:underline',
          chips ? 'h-8 rounded-[9px] px-2.5 shadow-[inset_0_0_0_1px_var(--border)]' : 'min-h-8 px-2',
        ]"
      >
        <CompanionCourseCover
          :subject="subject"
          size="sm"
          :px="16"
        />
        <span class="truncate">{{ subject.title }}</span>
      </NuxtLink>
    </div>

    <template v-if="task">
      <div :class="!chips && 'grid grid-cols-[84px_minmax(0,1fr)] items-center'">
        <span
          v-if="!chips"
          class="text-[13px] text-text-muted"
        >{{ t('tasks.field.day') }}</span>
        <CompanionTasksPropMenu
          :label="t('tasks.field.day')"
          :variant="variant"
          align="right"
          :search="false"
          :options="days"
          @pick="pickDay"
        >
          <UiIcon
            name="calendar"
            :size="14"
            class="text-text-faint"
          />
          <span :class="!task.date && 'text-text-muted'">{{ task.date ? relativeTo(task.date, today) : t('tasks.day.none') }}</span>
          <template #extra="{ close }">
            <label class="mt-1 flex h-10 items-center gap-2 border-t border-border-rule px-2 pt-1 text-[13px] text-text-muted">
              {{ t('tasks.day.pick') }}
              <input
                type="date"
                :value="task.date ?? ''"
                class="h-8 min-w-0 flex-1 cursor-pointer rounded-[8px] bg-surface-sunken px-2 text-[13px] text-text tabular-nums outline-none"
                @change="pickDay(($event.target as HTMLInputElement).value); close()"
              >
            </label>
          </template>
        </CompanionTasksPropMenu>
      </div>

      <div :class="!chips && 'grid grid-cols-[84px_minmax(0,1fr)] items-center'">
        <span
          v-if="!chips"
          class="text-[13px] text-text-muted"
        >{{ t('tasks.field.time') }}</span>
        <CompanionTasksPropMenu
          :label="t('tasks.field.time')"
          :variant="variant"
          align="right"
          :disabled="!task.date"
          :options="[{ key: '', label: t('tasks.day.noTime') }, ...TIME_OPTIONS]"
          :value="task.starts_at ?? ''"
          @pick="edit({ starts_at: $event || null })"
        >
          <UiIcon
            name="clock"
            :size="14"
            class="text-text-faint"
          />
          <span
            :class="!task.starts_at && 'text-text-muted'"
            :title="task.date ? undefined : t('tasks.day.pickDayFirst')"
          >{{ task.starts_at ?? (task.date ? t('tasks.day.noTime') : t('tasks.day.pickDayFirst')) }}</span>
        </CompanionTasksPropMenu>
      </div>

      <div :class="!chips && 'grid grid-cols-[84px_minmax(0,1fr)] items-center'">
        <span
          v-if="!chips"
          class="text-[13px] text-text-muted"
        >{{ t('tasks.field.length') }}</span>
        <CompanionTasksPropMenu
          :label="t('tasks.field.length')"
          :variant="variant"
          align="right"
          :options="DURATION_OPTIONS"
          :value="String(task.minutes)"
          @pick="edit({ minutes: Number($event) })"
        >
          <UiIcon
            name="timer"
            :size="14"
            class="text-text-faint"
          />
          <span>{{ minutesLabel(task.minutes) }}</span>
        </CompanionTasksPropMenu>
      </div>
    </template>

    <template v-else-if="deadline">
      <div :class="!chips && 'grid grid-cols-[84px_minmax(0,1fr)] items-center'">
        <span
          v-if="!chips"
          class="text-[13px] text-text-muted"
        >{{ t('tasks.field.due') }}</span>
        <span
          :class="[
            'inline-flex min-w-0 items-center gap-2 text-[13.5px] text-text',
            chips ? 'h-8 rounded-[9px] px-2.5 shadow-[inset_0_0_0_1px_var(--border)]' : 'min-h-8 px-2',
          ]"
        >
          <UiIcon
            name="calendar"
            :size="14"
            class="text-text-faint"
          />
          <span class="num">{{ deadline.due_at ? whenLabel(deadline.due_at, deadline.all_day).replace(/^./, (m) => m.toUpperCase()) : t('tasks.day.noneYet') }}</span>
        </span>
      </div>
      <div :class="!chips && 'grid grid-cols-[84px_minmax(0,1fr)] items-center'">
        <span
          v-if="!chips"
          class="text-[13px] text-text-muted"
        >{{ t('tasks.field.kind') }}</span>
        <span
          :class="[
            'inline-flex min-w-0 items-center gap-2 text-[13.5px] text-text',
            chips ? 'h-8 rounded-[9px] px-2.5 shadow-[inset_0_0_0_1px_var(--border)]' : 'min-h-8 px-2',
          ]"
        >
          <CompanionIcon
            name="cap"
            :size="14"
            class="text-text-faint"
          />
          <span class="min-w-0 truncate">{{ KIND_LABELS[deadline.kind] }}<template v-if="deadline.weight_pct">
            · <span class="num">{{ deadline.weight_pct }}%</span> {{ t('tasks.card.ofGrade') }}
          </template></span>
        </span>
      </div>
    </template>
  </div>
</template>
