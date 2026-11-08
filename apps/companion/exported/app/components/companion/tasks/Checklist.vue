<script setup lang="ts">
/**
 * The steps inside one task or deadline (an essay's outline, draft and
 * references): tick one, rename it in place, take it out, add the next with
 * Enter, which keeps the field for the one after. The whole list is one
 * column (`checklist`), written as a whole on every change, so two quick
 * ticks never race each other into a half-written list.
 */
import type { ChecklistItem } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { checklistOf, checklistProgress, updateEntry, type TaskEntry } from '~/companion/tasks'

const props = defineProps<{ entry: TaskEntry }>()

const c = useCompanion()
const { t } = useI18n()

const items = computed(() => checklistOf(props.entry))
const progress = computed(() => checklistProgress(items.value))
const draft = ref('')
const field = ref<HTMLInputElement | null>(null)

function save(next: ChecklistItem[]): void {
  void updateEntry(c, props.entry, { checklist: next.length ? next : null }).catch(() => undefined)
}

function add(): void {
  const text = draft.value.trim().slice(0, 300)
  if (!text) return
  draft.value = ''
  save([...items.value, { id: crypto.randomUUID().slice(0, 8), text, done: false }])
  void nextTick(() => field.value?.focus())
}

function tick(item: ChecklistItem): void {
  save(items.value.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))
}

function rename(item: ChecklistItem, event: Event): void {
  const text = (event.target as HTMLInputElement).value.trim().slice(0, 300)
  if (!text) return drop(item)
  if (text !== item.text) save(items.value.map((i) => (i.id === item.id ? { ...i, text } : i)))
}

function drop(item: ChecklistItem): void {
  save(items.value.filter((i) => i.id !== item.id))
}
</script>

<template>
  <section aria-labelledby="task-steps">
    <header class="flex h-8 items-center gap-2 text-[13.5px] font-semibold text-text-soft">
      <UiIcon
        name="check-circle"
        :size="15"
      />
      <h2 id="task-steps">
        {{ t('tasks.steps.title') }}
      </h2>
      <template v-if="progress">
        <span class="num font-medium text-text-faint">{{ progress.done }}/{{ progress.total }}</span>
        <span
          class="h-1 w-16 overflow-hidden rounded-full bg-surface-track"
          aria-hidden="true"
        >
          <span
            class="block h-full rounded-full bg-leaf transition-[width] duration-200"
            :style="{ width: `${(progress.done / progress.total) * 100}%` }"
          />
        </span>
      </template>
    </header>

    <ul class="mt-1">
      <li
        v-for="item in items"
        :key="item.id"
        class="group flex min-h-10 items-center gap-1 rounded-[10px] px-1 hover:bg-[rgb(var(--wash-rgb)/0.03)]"
      >
        <button
          type="button"
          role="checkbox"
          :aria-checked="item.done"
          :aria-label="`${item.done ? t('tasks.card.done') : t('tasks.card.markDone')}: ${item.text}`"
          class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-leaf-soft"
          @click="tick(item)"
        >
          <CompanionTasksStatusIcon :s="item.done ? 'done' : 'todo'" />
        </button>
        <input
          :value="item.text"
          type="text"
          maxlength="300"
          :aria-label="t('tasks.steps.step', { text: item.text })"
          :class="[
            'h-9 min-w-0 flex-1 rounded-[8px] bg-transparent px-1.5 text-[14.5px] outline-none focus:bg-surface-sunken',
            item.done ? 'text-text-faint line-through decoration-text-ghost' : 'text-text',
          ]"
          @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
          @blur="rename(item, $event)"
        >
        <button
          type="button"
          :aria-label="t('tasks.steps.takeOut', { text: item.text })"
          :title="t('tasks.steps.takeOutTitle')"
          class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-text-faint opacity-100 hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
          @click="drop(item)"
        >
          <UiIcon
            name="x"
            :size="14"
          />
        </button>
      </li>
    </ul>

    <form
      class="mt-1 flex items-center gap-1 px-1"
      @submit.prevent="add"
    >
      <span class="grid size-8 shrink-0 place-items-center text-text-faint">
        <UiIcon
          name="plus"
          :size="15"
        />
      </span>
      <label
        for="task-step-add"
        class="sr-only"
      >{{ t('tasks.steps.add') }}</label>
      <input
        id="task-step-add"
        ref="field"
        v-model="draft"
        type="text"
        maxlength="300"
        :placeholder="t('tasks.steps.add')"
        class="h-9 min-w-0 flex-1 rounded-[8px] bg-transparent px-1.5 text-[14.5px] text-text outline-none placeholder:text-text-faint focus:bg-surface-sunken"
      >
    </form>
  </section>
</template>
