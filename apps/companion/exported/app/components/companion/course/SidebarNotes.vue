<script setup lang="ts">
import type { Item, Subject } from '~/companion/types'
import { useCompanion } from '~/companion/store'
const { t } = useI18n()

/**
 * The course's pages and whiteboards that match "Find in this course", flat,
 * wherever they sit in the tree. Without a search the sidebar shows the tree
 * itself (`CompanionCourseNotesList`, the same rows as Notes); a search
 * flattens it, because a match three pages deep is still the one wanted.
 * Pinned first, then the most recently touched.
 */
const props = defineProps<{
  subject: Subject
  activeItemId: string | null
  openItemIds: string[]
  filter: string
}>()

const emit = defineEmits<{ openItem: [item: Item] }>()

const c = useCompanion()
const openSet = computed(() => new Set(props.openItemIds))
const needle = computed(() => props.filter.trim().toLowerCase())

function recent(a: Item, b: Item): number {
  return (
    Number(b.pinned) - Number(a.pinned) ||
    Date.parse(b.updated_at ?? b.created_at ?? '') - Date.parse(a.updated_at ?? a.created_at ?? '')
  )
}

const matches = computed(() =>
  c.items.value
    .filter(
      (i) =>
        i.subject_id === props.subject.id &&
        (i.kind === 'page' || i.kind === 'board') &&
        (i.title || t('course.notes.untitled')).toLowerCase().includes(needle.value),
    )
    .sort(recent),
)
</script>

<template>
  <div>
    <button
      v-for="item in matches"
      :key="item.id"
      type="button"
      :class="[
        'flex min-h-[30px] w-full cursor-pointer items-center gap-2 rounded-[10px] py-1 pr-2 pl-[26px] text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand',
        item.id === activeItemId ? 'bg-accent-soft' : 'hover:bg-surface-mute',
      ]"
      :title="item.title || t('course.notes.untitled')"
      :aria-current="item.id === activeItemId ? 'true' : undefined"
      @click="emit('openItem', item)"
    >
      <CompanionIcon
        :name="item.kind === 'board' ? 'board' : 'page'"
        :size="14"
        :class="['shrink-0', item.id === activeItemId ? 'text-text' : 'text-text-faint']"
      />
      <span
        :class="[
          'min-w-0 flex-1 truncate text-[13px] leading-[1.3]',
          item.id === activeItemId ? 'font-semibold text-text' : 'text-text-body',
        ]"
      >{{ item.title || t('course.notes.untitled') }}</span>
      <span
        v-if="openSet.has(item.id) && item.id !== activeItemId"
        class="size-[5px] shrink-0 rounded-full bg-border-dashed"
        :title="t('course.notes.background')"
      />
    </button>
    <p
      v-if="!matches.length"
      class="px-2 py-1 text-[12.5px] leading-relaxed text-text-muted"
    >
      {{ t('course.notes.none') }}
    </p>
  </div>
</template>
