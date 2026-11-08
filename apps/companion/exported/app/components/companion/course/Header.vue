<script setup lang="ts">
import type { Deadline, Subject } from '~/companion/types'
import type { MenuAction } from '~/components/ui/Menu.vue'
const { t } = useI18n()

/**
 * The course's 46px bar on a desktop (course.html `.topbar`):
 *
 *   [sidebar] [● | Lesson 3 · SQL joins ×| Notes ×]      [Lab 4 report ·
 *   in 3 days · 45% ready]  [+ New ▾]  [Ask]  […]
 *
 * The default slot is the course's tab strip (`CompanionCourseTabs`); the
 * pinned home tab goes back to the course's home, and the sidebar's course
 * switcher goes to the other courses, so the bar needs no crumbs. The chip is the nearest date
 * that counts, with how ready you are for it, and opens it. "+ New" is the
 * one way to make things here (`CompanionCourseNewMenu`), Record included,
 * for a school course that allows it; the AI's button and the course's "…"
 * close the row. An archived course says so beside its name, with the way
 * back to the shelf, since it can still be opened from a link or search.
 */
defineProps<{
  subject: Subject
  /** The document in front, or null on the course's home. */
  docTitle: string | null
  due: { deadline: Deadline; words: string; ready: boolean } | null
  canRecord: boolean
  live: boolean
  /** Where a new note lands: "Lecture 8 · Transactions". */
  newWhere: string
  canWrite: boolean
  actions: MenuAction[]
  archived?: boolean
}>()

const sidebarOpen = defineModel<boolean>('sidebarOpen', { required: true })

const emit = defineEmits<{
  home: []
  record: []
  note: []
  board: []
  upload: []
  lesson: []
  restore: []
}>()
</script>

<template>
  <header class="flex h-[46px] shrink-0 items-center gap-1.5 border-b border-border px-2">
    <button
      type="button"
      :title="sidebarOpen ? t('course.header.hide') : t('course.header.show')"
      :aria-label="sidebarOpen ? t('course.header.hide') : t('course.header.show')"
      :aria-pressed="sidebarOpen"
      :class="[
        'grid size-[30px] shrink-0 cursor-pointer place-items-center rounded-[8px] transition-colors',
        sidebarOpen
          ? 'text-text-muted hover:bg-[rgb(var(--wash-rgb)/0.065)] hover:text-text'
          : 'bg-accent-soft text-accent-strong',
      ]"
      @click="sidebarOpen = !sidebarOpen"
    >
      <UiIcon
        name="panel-left"
        :size="17"
        :stroke="1.9"
      />
    </button>

    <!-- The course's open things: the home pinned first, then each lesson, note and board. -->
    <slot />

    <span
      v-if="archived"
      class="flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-surface-sunken pr-1 pl-2.5 text-[12.5px] font-medium text-text-muted"
    >
      {{ t('course.header.archived') }}
      <button
        type="button"
        class="h-5 cursor-pointer rounded-full px-2 font-semibold text-text transition-colors hover:bg-surface-track focus-visible:outline-2 focus-visible:outline-brand"
        @click="emit('restore')"
      >
        {{ t('course.header.restore') }}
      </button>
    </span>

    <!-- The nearest date that counts, as the old bar drew its writing pill. -->
    <NuxtLink
      v-if="due"
      :to="`/app/d/${due.deadline.id}`"
      class="flex h-[30px] min-w-0 shrink items-center gap-2 rounded-full px-3 shadow-[inset_0_0_0_1px_var(--border-strong)] transition-colors hover:bg-[rgb(var(--wash-rgb)/0.035)] max-[1279px]:hidden"
      :title="t('course.header.due', { words: due.words })"
    >
      <span :class="['size-1.5 shrink-0 rounded-full', due.ready ? 'bg-leaf' : 'bg-rose']" />
      <span class="num max-w-[220px] truncate text-[12.5px] font-semibold whitespace-nowrap text-text-soft">{{ due.words }}</span>
    </NuxtLink>

    <CompanionCourseNewMenu
      :subject="subject"
      :where="newWhere"
      :can-write="canWrite"
      :can-record="canRecord"
      :live="live"
      @note="emit('note')"
      @board="emit('board')"
      @upload="emit('upload')"
      @record="emit('record')"
      @lesson="emit('lesson')"
    />

    <CompanionAiToggle />

    <UiMenu
      v-if="actions.length"
      :actions="actions"
      :title="subject.title"
      :label="t('course.header.actions')"
    />
  </header>
</template>
