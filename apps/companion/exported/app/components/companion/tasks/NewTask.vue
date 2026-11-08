<script setup lang="ts">
/**
 * New task, like a tracker's "New issue" (adgen-new's to-do): a big title,
 * a note, and a row of property pickers: column, priority, course, day,
 * time and length. Ctrl/Cmd+Enter adds it from anywhere in the dialog.
 * Opened by a column's "+", the page's New task button, `c` on the page, or
 * the quick add's "more" with what was typed so far.
 *
 * Minutes at the end of the title ("Read ch. 3 30 min") still count, as in
 * the quick add, unless a length was picked here.
 */
import type { Priority, Uuid } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { dayKey, dayLabel } from '~/companion/time'
import {
  COLUMN_LABELS,
  DURATION_OPTIONS,
  PRIORITY_LABELS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  TIME_OPTIONS,
  addTask,
  courseOptions,
  dayOptions,
  minutesLabel,
  relativeTo,
  type TaskColumn,
} from '~/companion/tasks'

const props = defineProps<{
  /** Open while set: the column it starts in, and anything already chosen. */
  start: { column: TaskColumn; text?: string; subjectId?: Uuid | null } | null
}>()

const emit = defineEmits<{ close: [] }>()

const c = useCompanion()
const toast = useToast()
const { t } = useI18n()

const open = computed({
  get: () => props.start !== null,
  set: (value: boolean) => {
    if (!value) emit('close')
  },
})

const title = ref('')
const notes = ref('')
const column = ref<TaskColumn>('todo')
const priority = ref<Priority>(0)
const subjectId = ref<Uuid | null>(null)
const date = ref<string | null>(null)
const time = ref<string | null>(null)
const minutes = ref<number | null>(null)
const saving = ref(false)

watch(
  () => props.start,
  (start) => {
    if (!start) return
    title.value = start.text ?? ''
    notes.value = ''
    column.value = start.column
    priority.value = 0
    subjectId.value = start.subjectId ?? null
    date.value = null
    time.value = null
    minutes.value = null
  },
  { immediate: true },
)

const today = computed(() => dayKey())
const subject = computed(() => (subjectId.value ? c.get('subjects', subjectId.value) : null))
const days = computed(() => [...dayOptions(today.value), { key: '', label: t('tasks.day.none') }])

function pickDay(key: string): void {
  date.value = key || null
  if (!date.value) time.value = null
}

async function create(): Promise<void> {
  if (!title.value.trim() || saving.value) return
  saving.value = true
  try {
    const task = await addTask(c, {
      text: title.value,
      detail: notes.value,
      subject_id: subjectId.value,
      date: date.value,
      starts_at: time.value,
      minutes: minutes.value ?? undefined,
      priority: priority.value,
      column: column.value,
    })
    if (task) {
      toast.success({
        title: t('tasks.new.addedTo', { col: COLUMN_LABELS[column.value] }),
        action: { label: t('common.open'), handler: () => void navigateTo(`/app/tasks/${task.id}`) },
      })
    }
    emit('close')
  } catch {
    // The store has said why; the dialog keeps what was typed.
  } finally {
    saving.value = false
  }
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    void create()
  }
}
</script>

<template>
  <UiModal
    v-model:open="open"
    size="lg"
  >
    <template #header>
      <div class="flex items-center gap-1.5 text-[13px] text-text-muted">
        <span class="inline-flex h-6 items-center gap-1.5 rounded-[7px] px-2 font-semibold text-text shadow-[inset_0_0_0_1px_var(--border)]">
          <UiIcon
            name="check-circle"
            :size="13"
          />{{ t('tasks.title') }}
        </span>
        <UiIcon
          name="chevron-right"
          :size="13"
          class="text-text-faint"
        />
        <h2 class="font-semibold text-text-soft">
          {{ t('tasks.new.heading') }}
        </h2>
      </div>
    </template>

    <form
      class="-mx-1 -my-1"
      @submit.prevent="create"
      @keydown="onKey"
    >
      <label
        for="new-task-title"
        class="sr-only"
      >{{ t('tasks.new.what') }}</label>
      <input
        id="new-task-title"
        v-model="title"
        type="text"
        maxlength="300"
        autocomplete="off"
        :placeholder="t('tasks.new.what')"
        class="w-full bg-transparent px-1 py-1 text-[21px] font-semibold text-text outline-none placeholder:text-text-ghost"
        autofocus
      >
      <label
        for="new-task-notes"
        class="sr-only"
      >{{ t('tasks.field.note') }}</label>
      <textarea
        id="new-task-notes"
        v-model="notes"
        rows="3"
        maxlength="5000"
        :placeholder="t('tasks.new.notePlaceholder')"
        class="mt-1 min-h-[76px] w-full resize-none bg-transparent px-1 text-[15px] leading-relaxed text-text-body outline-none placeholder:text-text-faint"
      />

      <div class="mt-3 flex flex-wrap gap-1.5">
        <CompanionTasksPropMenu
          :label="t('tasks.field.status')"
          kind="status"
          variant="chip"
          :options="STATUS_OPTIONS"
          :value="column"
          @pick="column = $event as TaskColumn"
        >
          <CompanionTasksStatusIcon :s="column" />{{ COLUMN_LABELS[column] }}
        </CompanionTasksPropMenu>
        <CompanionTasksPropMenu
          :label="t('tasks.field.priority')"
          kind="priority"
          variant="chip"
          :options="PRIORITY_OPTIONS"
          :value="String(priority)"
          @pick="priority = Number($event) as Priority"
        >
          <CompanionTasksPriorityIcon :p="priority" />
          <span :class="!priority && 'text-text-muted'">{{ priority ? PRIORITY_LABELS[priority] : t('tasks.field.priority') }}</span>
        </CompanionTasksPropMenu>
        <CompanionTasksPropMenu
          :label="t('tasks.field.course')"
          kind="course"
          variant="chip"
          :options="courseOptions(c.shelf.value)"
          :value="subjectId ?? ''"
          :search="true"
          @pick="subjectId = $event || null"
        >
          <CompanionCourseCover
            v-if="subject"
            :subject="subject"
            size="sm"
            :px="15"
          />
          <CompanionIcon
            v-else
            name="cap"
            :size="13"
            class="text-text-faint"
          />
          <span :class="['max-w-[160px] truncate', !subject && 'text-text-muted']">{{ subject?.title ?? t('tasks.field.course') }}</span>
        </CompanionTasksPropMenu>
        <CompanionTasksPropMenu
          :label="t('tasks.field.day')"
          kind="plain"
          variant="chip"
          :options="days"
          :search="false"
          @pick="pickDay"
        >
          <UiIcon
            name="calendar"
            :size="13"
            class="text-text-faint"
          />
          <span :class="!date && 'text-text-muted'">{{ date ? relativeTo(date, today) : t('tasks.field.day') }}</span>
          <template #extra="{ close }">
            <label class="mt-1 flex h-10 items-center gap-2 border-t border-border-rule px-2 pt-1 text-[13px] text-text-muted">
              {{ t('tasks.day.pick') }}
              <input
                type="date"
                :value="date ?? ''"
                class="h-8 min-w-0 flex-1 cursor-pointer rounded-[8px] bg-surface-sunken px-2 text-[13px] text-text tabular-nums outline-none"
                @change="pickDay(($event.target as HTMLInputElement).value); close()"
              >
            </label>
          </template>
        </CompanionTasksPropMenu>
        <CompanionTasksPropMenu
          :label="t('tasks.field.time')"
          kind="plain"
          variant="chip"
          :options="[{ key: '', label: t('tasks.day.noTime') }, ...TIME_OPTIONS]"
          :disabled="!date"
          @pick="time = $event || null"
        >
          <UiIcon
            name="clock"
            :size="13"
            class="text-text-faint"
          />
          <span
            :class="!time && 'text-text-muted'"
            :title="date ? undefined : t('tasks.day.pickDayFirst')"
          >{{ time ?? t('tasks.field.time') }}</span>
        </CompanionTasksPropMenu>
        <CompanionTasksPropMenu
          :label="t('tasks.field.length')"
          kind="plain"
          variant="chip"
          :options="DURATION_OPTIONS"
          @pick="minutes = Number($event)"
        >
          <UiIcon
            name="timer"
            :size="13"
            class="text-text-faint"
          />
          <span :class="!minutes && 'text-text-muted'">{{ minutes ? minutesLabel(minutes) : t('tasks.field.length') }}</span>
        </CompanionTasksPropMenu>
      </div>

      <button
        type="submit"
        class="sr-only"
        tabindex="-1"
      >
        {{ t('tasks.new.add') }}
      </button>
    </form>

    <template #footer>
      <span class="mr-auto hidden text-[12.5px] text-text-faint sm:inline">
        <kbd class="font-sans">Ctrl</kbd> + <kbd class="font-sans">Enter</kbd> {{ date ? t('tasks.day.addsItOn', { day: dayLabel(date) }) : t('tasks.new.addsIt') }}
      </span>
      <UiBtn
        variant="ghost"
        @click="emit('close')"
      >
        {{ t('common.cancel') }}
      </UiBtn>
      <UiBtn
        variant="primary"
        :disabled="!title.trim()"
        :loading="saving"
        @click="create"
      >
        {{ t('tasks.new.add') }}
      </UiBtn>
    </template>
  </UiModal>
</template>
