<script setup lang="ts">
import type { Item, Subject } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { materialGroups, materialMeta } from '~/companion/course-home'
import { itemIcon } from '~/companion/words'
const { t } = useI18n()

/**
 * Everything the school gave for a course, as a view of its home
 * (`?tab=materials`): Moodle's slides and files, links, lecture recordings,
 * photos of the board and the learner's own uploads, by the week of the class
 * they belong to, this week first (`materialGroups`). It is the "I don't have
 * to open Moodle" page: the file is here, a click opens it.
 *
 * On top, the drop zone: drop any number of files (or browse) and they are
 * filed where the learner is, which it says before anything is dropped. The
 * course page does the uploading; this only hands the files over. Files
 * already uploaded somewhere else sit in My notes until the learner adds
 * them, so the zone also offers that (`CompanionCourseAddNotes`).
 */
const props = defineProps<{
  subject: Subject
  /** Where an upload lands: "Databases · Lecture 8". */
  where: string
  uploading: number
}>()

const emit = defineEmits<{
  openItem: [item: Item]
  upload: [files: File[]]
  pick: []
}>()

const c = useCompanion()
const groups = computed(() => materialGroups(c, props.subject))
const count = computed(() => groups.value.reduce((n, g) => n + g.items.length, 0))

const dragDepth = ref(0)
const over = computed(() => dragDepth.value > 0)

function onDrop(event: DragEvent): void {
  dragDepth.value = 0
  const files = [...(event.dataTransfer?.files ?? [])]
  if (files.length) emit('upload', files)
}

function hasFiles(event: DragEvent): boolean {
  return [...(event.dataTransfer?.types ?? [])].includes('Files')
}

const tile =
  'grid size-9 shrink-0 place-items-center rounded-[10px] bg-surface-sunken text-text-soft transition-colors group-hover:bg-surface-track group-hover:text-text'
</script>

<template>
  <div class="mx-auto grid w-full max-w-[760px] content-start gap-8 px-4 pt-6 pb-20 min-[900px]:px-8">
    <header class="grid gap-0.5">
      <h2 class="t-head text-[19px]">
        {{ t('course.side.materials') }}
      </h2>
      <p class="text-[14px] text-text-muted">
        {{
          count
            ? t('course.mat.sub', { n: count })
            : t('course.mat.subNone')
        }}
      </p>
    </header>

    <!-- Drop anything here; it's filed where you are. -->
    <div
      :class="[
        'grid justify-items-center gap-2 rounded-[18px] border-[1.5px] border-dashed px-6 py-7 text-center transition-colors duration-150',
        over ? 'border-brand bg-brand-soft' : 'border-border-dashed bg-surface-sunken/60',
      ]"
      @dragenter.prevent="hasFiles($event) && dragDepth++"
      @dragover.prevent
      @dragleave="dragDepth = Math.max(0, dragDepth - 1)"
      @drop.prevent="onDrop"
    >
      <span
        :class="[
          'grid size-10 place-items-center rounded-full transition-colors',
          over ? 'bg-brand text-white' : 'bg-surface text-text-soft shadow-[inset_0_0_0_1px_var(--border)]',
        ]"
      >
        <UiIcon
          :name="uploading ? 'loader' : 'upload'"
          :size="18"
          :class="uploading && 'animate-spin-slow'"
        />
      </span>
      <p class="text-[15px] font-semibold text-text">
        <template v-if="uploading">
          {{ t('course.mat.uploading', { n: uploading }, uploading) }}
        </template>
        <template v-else-if="over">
          {{ t('course.mat.drop') }}
        </template>
        <template v-else>
          {{ t('course.mat.dropHere') }}
          <button
            type="button"
            class="cursor-pointer text-brand underline-offset-2 hover:underline"
            @click="emit('pick')"
          >
            {{ t('course.mat.browse') }}
          </button>
        </template>
      </p>
      <p class="text-[13px] text-text-muted">
        {{ t('course.mat.several', { where }) }}
      </p>
      <p
        v-if="!uploading && !over"
        class="text-[13px] text-text-muted"
      >
        {{ t('course.mat.already') }}
        <CompanionCourseAddNotes
          :subject="subject"
          look="link"
          :label="t('course.mat.fromNotes')"
        />
      </p>
    </div>

    <section
      v-for="g in groups"
      :key="g.key"
      :aria-label="g.label"
    >
      <header class="mb-1.5 flex items-baseline justify-between gap-3">
        <h3 class="min-w-0 truncate text-[14px] font-semibold text-text-soft">
          {{ g.label }}
        </h3>
        <span
          v-if="g.current"
          class="shrink-0 text-[13px] font-medium text-text-muted"
        >{{ t('course.mat.thisWeek') }}</span>
      </header>
      <ul class="divide-y divide-border-rule border-y border-border-rule">
        <li
          v-for="i in g.items"
          :key="i.id"
        >
          <button
            type="button"
            class="group -mx-2 flex w-[calc(100%+16px)] cursor-pointer items-center gap-3 rounded-[12px] px-2 py-2.5 text-left transition-colors hover:bg-surface-mute focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
            :title="i.kind === 'link' ? t('course.mat.openLink', { title: i.title }) : t('course.mat.openFile', { title: i.title })"
            @click="emit('openItem', i)"
          >
            <span :class="tile">
              <CompanionIcon
                :name="itemIcon(i)"
                :size="17"
              />
            </span>
            <span class="grid min-w-0 flex-1 gap-0.5">
              <span class="truncate text-[15px] leading-snug font-medium text-text">{{ i.title || t('course.notes.untitled') }}</span>
              <span class="truncate text-[13px] text-text-muted">{{ materialMeta(i) }}</span>
            </span>
            <UiIcon
              :name="i.kind === 'link' ? 'arrow-up-right' : 'external'"
              :size="15"
              class="shrink-0 text-text-faint opacity-0 transition-opacity group-hover:opacity-100"
            />
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>
