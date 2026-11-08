<script setup lang="ts">
/**
 * Which course a task is for, or none: a plain select of the shelf, shared
 * by Tasks' quick add and its edit dialog. A task already filed under a
 * course since archived keeps it in the list, so opening the task never
 * quietly moves it out.
 */
import type { Uuid } from '~/companion/types'
import { useCompanion } from '~/companion/store'

const props = defineProps<{ id?: string }>()
const model = defineModel<Uuid | null>({ required: true })

const c = useCompanion()
const { t } = useI18n()

const courses = computed(() => {
  const shelf = c.shelf.value
  const kept = model.value && !shelf.some((s) => s.id === model.value) ? c.get('subjects', model.value) : null
  return kept ? [...shelf, kept] : shelf
})
</script>

<template>
  <select
    :id="props.id"
    :value="model ?? ''"
    class="h-10 max-w-[220px] min-w-0 cursor-pointer truncate rounded-full bg-surface-sunken pr-8 pl-3.5 text-[14px] text-text-body outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--brand)]"
    @change="model = ($event.target as HTMLSelectElement).value || null"
  >
    <option value="">
      {{ t('tasks.course.none') }}
    </option>
    <option
      v-for="s in courses"
      :key="s.id"
      :value="s.id"
    >
      {{ s.title }}
    </option>
  </select>
</template>
