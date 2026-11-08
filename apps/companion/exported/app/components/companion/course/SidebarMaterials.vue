<script setup lang="ts">
import type { Item, Subject } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { materialGroups } from '~/companion/course-home'
import { itemIcon } from '~/companion/words'
const { t } = useI18n()

/**
 * The course's files in the sidebar: slides from Moodle, recordings, links,
 * photos of the board, uploads, by the week of the class they belong to
 * (`materialGroups`). This week's group is open, the older ones fold to a
 * line with their count, so a term of slides stays a short list. A row opens
 * the file in a new window, as a class's file link does. Files already
 * uploaded elsewhere come in from the course's "+ New" (Add from My notes).
 */
const props = defineProps<{
  subject: Subject
  filter?: string
}>()

const emit = defineEmits<{ openItem: [item: Item] }>()

const c = useCompanion()
const needle = computed(() => (props.filter ?? '').trim().toLowerCase())

const groups = computed(() => {
  const all = materialGroups(c, props.subject)
  if (!needle.value) return all
  return all
    .map((g) => ({ ...g, items: g.items.filter((i) => i.title.toLowerCase().includes(needle.value)) }))
    .filter((g) => g.items.length)
})

/* The newest group and this week's start open; the rest fold. */
const toggled = ref(new Set<string>())
function isOpen(key: string, index: number, current: boolean): boolean {
  const byDefault = needle.value !== '' || current || index === 0
  return toggled.value.has(key) ? !byDefault : byDefault
}
function toggle(key: string): void {
  const next = new Set(toggled.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  toggled.value = next
}
</script>

<template>
  <div>
    <template
      v-for="(g, index) in groups"
      :key="g.key"
    >
      <button
        type="button"
        class="group/mat flex min-h-[28px] w-full cursor-pointer items-center gap-1.5 rounded-[10px] pr-2 pl-[26px] text-left transition-colors hover:bg-surface-mute focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
        :aria-expanded="isOpen(g.key, index, g.current)"
        :title="g.label"
        @click="toggle(g.key)"
      >
        <span class="min-w-0 flex-1 truncate text-[12px] font-medium text-text-muted">{{ g.label }}</span>
        <span
          v-if="g.current"
          class="shrink-0 rounded-full bg-accent-soft px-1.5 py-px text-[10.5px] font-semibold text-accent-strong"
        >{{ t('course.materials.now') }}</span>
        <span
          v-else-if="!isOpen(g.key, index, g.current)"
          class="num shrink-0 text-[11.5px] text-text-faint"
        >{{ g.items.length }}</span>
      </button>
      <template v-if="isOpen(g.key, index, g.current)">
        <button
          v-for="i in g.items"
          :key="i.id"
          type="button"
          class="flex min-h-[28px] w-full cursor-pointer items-center gap-2 rounded-[10px] py-1 pr-2 pl-[26px] text-left transition-colors hover:bg-surface-mute focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
          :title="i.title"
          @click="emit('openItem', i)"
        >
          <CompanionIcon
            :name="itemIcon(i)"
            :size="13"
            class="shrink-0 text-text-faint"
          />
          <span class="min-w-0 flex-1 truncate text-[12.5px] leading-[1.3] text-text-soft">{{ i.title || t('course.notes.untitled') }}</span>
          <UiIcon
            v-if="i.kind === 'link'"
            name="arrow-up-right"
            :size="11"
            class="shrink-0 text-text-ghost"
          />
        </button>
      </template>
    </template>
    <p
      v-if="!groups.length"
      class="px-2 py-1 text-[12.5px] leading-relaxed text-text-muted"
    >
      {{ filter ? t('course.materials.noMatch') : t('course.materials.empty') }}
    </p>
  </div>
</template>
