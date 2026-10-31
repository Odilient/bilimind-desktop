<script setup lang="ts">
import type { Deadline, Subject } from '~/companion/types'
import type { MenuAction } from '~/components/ui/Menu.vue'
import { courseColor } from '~/companion/colors'

/**
 * The course's 56px bar on a desktop, the old workspace's top bar extended:
 *
 *   [sidebar] Courses / ● Databases / Lesson 3 · SQL joins     [Lab 4 report ·
 *   in 3 days · 45% ready]  [+ New ▾]  [Ask]  […]
 *
 * The crumbs say where you are down to the document in front, and the
 * course's name in them goes back to its home. The chip is the nearest date
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
  <header class="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface pr-3 pl-3">
    <button
      type="button"
      :title="sidebarOpen ? 'Hide the course outline' : 'Show the course outline'"
      :aria-label="sidebarOpen ? 'Hide the course outline' : 'Show the course outline'"
      :aria-pressed="sidebarOpen"
      :class="[
        'grid size-[34px] shrink-0 cursor-pointer place-items-center rounded-[10px] transition-colors',
        sidebarOpen
          ? 'text-text-muted hover:bg-surface-sunken hover:text-text'
          : 'bg-accent-soft text-accent-strong',
      ]"
      @click="sidebarOpen = !sidebarOpen"
    >
      <UiIcon
        name="panel-left"
        :size="18"
        :stroke="1.9"
      />
    </button>

    <nav
      class="ml-1 flex min-w-0 items-center gap-2 text-[14px] whitespace-nowrap"
      aria-label="Breadcrumb"
    >
      <NuxtLink
        to="/app/courses"
        class="shrink-0 rounded-[6px] text-text-faint transition-colors hover:text-text-soft"
      >Courses</NuxtLink>
      <span class="text-text-ghost">/</span>
      <button
        type="button"
        :class="[
          'flex min-w-0 cursor-pointer items-center gap-2 rounded-[6px] transition-colors',
          docTitle ? 'shrink-[2] text-text-soft hover:text-text' : 'font-semibold text-text',
        ]"
        :aria-current="docTitle ? undefined : 'page'"
        @click="emit('home')"
      >
        <span
          class="size-2 shrink-0 rounded-full"
          :style="{ background: courseColor(subject.color) }"
        />
        <span class="truncate">{{ subject.title }}</span>
      </button>
      <template v-if="docTitle">
        <span class="text-text-ghost">/</span>
        <span
          class="min-w-0 truncate font-semibold text-text"
          aria-current="page"
        >{{ docTitle }}</span>
      </template>
    </nav>

    <span
      v-if="archived"
      class="flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-surface-sunken pr-1 pl-2.5 text-[12.5px] font-medium text-text-muted"
    >
      Archived
      <button
        type="button"
        class="h-5 cursor-pointer rounded-full px-2 font-semibold text-text transition-colors hover:bg-surface-track focus-visible:outline-2 focus-visible:outline-cobalt"
        @click="emit('restore')"
      >
        Restore
      </button>
    </span>

    <div class="min-w-4 flex-1" />

    <!-- The nearest date that counts, as the old bar drew its writing pill. -->
    <NuxtLink
      v-if="due"
      :to="`/app/d/${due.deadline.id}`"
      class="flex h-[34px] min-w-0 shrink items-center gap-2 rounded-full bg-surface-rail px-3.5 transition-colors hover:bg-surface-track max-[1279px]:hidden"
      :title="`${due.words}: open it`"
    >
      <span :class="['size-[7px] shrink-0 rounded-full', due.ready ? 'bg-lime-2' : 'bg-coral']" />
      <span class="num truncate text-[13px] font-medium whitespace-nowrap text-text-soft">{{ due.words }}</span>
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
      label="Course actions"
    />
  </header>
</template>
