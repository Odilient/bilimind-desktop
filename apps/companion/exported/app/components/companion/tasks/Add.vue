<script setup lang="ts">
/**
 * Tasks' quick add, at the top of the board's To do column: one line for
 * what to do. Enter adds it and keeps the field for the next one, so three
 * things are three lines typed, not three dialogs. Minutes at the end ("read
 * ch. 3 30 min") are read as on Today. It goes under the course the board is
 * filtered to, if any, with no day ("No date").
 *
 * Anything more (a day, a time, a priority, a note) is New task's: the
 * expand button opens it with what was typed so far.
 */
import type { Uuid } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { addTask } from '~/companion/tasks'

const props = defineProps<{ subjectId?: Uuid | null }>()

const emit = defineEmits<{ more: [text: string] }>()

const c = useCompanion()
const { t } = useI18n()

const text = ref('')
const field = ref<HTMLInputElement | null>(null)

async function add(): Promise<void> {
  if (!text.value.trim()) return
  const typed = text.value
  text.value = ''
  field.value?.focus()
  try {
    await addTask(c, { text: typed, subject_id: props.subjectId ?? null, date: null })
  } catch {
    // The store has said why and taken the row back; the words come back too.
    text.value = typed
  }
}

function more(): void {
  const typed = text.value
  text.value = ''
  emit('more', typed)
}
</script>

<template>
  <form
    class="flex items-center gap-1 rounded-[12px] bg-surface p-1 shadow-[0_0_0_1px_var(--border),var(--shadow-card)] focus-within:shadow-[0_0_0_1px_var(--border-strong),var(--shadow-card)]"
    @submit.prevent="add"
  >
    <span class="grid size-8 shrink-0 place-items-center text-text-faint">
      <UiIcon
        name="plus"
        :size="16"
      />
    </span>
    <label
      for="tasks-add"
      class="sr-only"
    >{{ t('tasks.add.label') }}</label>
    <input
      id="tasks-add"
      ref="field"
      v-model="text"
      type="text"
      maxlength="300"
      :placeholder="t('tasks.add.action')"
      class="h-9 min-w-0 flex-1 bg-transparent text-[16px] text-text outline-none placeholder:text-text-faint min-[700px]:text-[14.5px]"
    >
    <button
      type="button"
      :title="t('tasks.add.moreTitle')"
      :aria-label="t('tasks.add.moreAria')"
      class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-[8px] text-text-faint hover:bg-[rgb(var(--wash-rgb)/0.06)] hover:text-text"
      @click="more"
    >
      <UiIcon
        name="sliders"
        :size="15"
      />
    </button>
  </form>
</template>
