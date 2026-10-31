<script setup lang="ts">
import type { Subject } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { courseColor } from '~/companion/colors'
import { useCourseMenu } from '~/companion/course-menu'
import { courseNextDate, courseProgress, courseWhere, type DateTone } from '~/companion/course-home'
import { dayKey, shortDate } from '~/companion/time'

/**
 * A course as one row of the Courses list: the shelf's dense view, for when
 * there are thirty courses and the cards would be three screens of covers.
 * Everything a card says that tells two courses apart, in one line each:
 *
 *   ● Databases                     ▬▬▬▬▭▭  7/13   ● Midterm · in 5 days · 62% ready   ⋯  ›
 *     CSC2104 · Dr. Karimov
 *
 * the course's colour as a dot, its name, its code and lecturer (or, for a
 * course of one's own, the lesson it's on), how far along it is as a short
 * bar in its colour, and the next date that counts (the same chip as the
 * card's, which opens the deadline). The whole row opens the course; the
 * "⋯" is the card's own menu (`useCourseMenu`), so rename and colour happen
 * here in the row: the name becomes a field, and the swatches take the bar
 * and the date's place.
 *
 * On a phone the row keeps the name and the menu; the bar and the date come
 * in as the width allows. An archived course's row says when it was put
 * away and has Restore where the bar was.
 */
const props = defineProps<{
  subject: Subject
}>()

const emit = defineEmits<{ ask: [subject: Subject]; group: [subject: Subject] }>()

const c = useCompanion()

const home = computed(() => `/app/courses/${props.subject.id}`)
const color = computed(() => courseColor(props.subject.color))
const archived = computed(() => Boolean(props.subject.archived_at))
const progress = computed(() => courseProgress(c, props.subject))
const date = computed(() => (archived.value ? null : courseNextDate(c, props.subject)))

/** The line under the name: code and lecturer at school, the lesson it's on for a path. */
const sub = computed(() => {
  const s = props.subject
  const own = s.format === 'path' ? courseWhere(c, s) : [s.code, s.lecturer].filter(Boolean).join(' · ')
  const line = own || (s.format === 'path' ? 'On your own' : 'School')
  return s.archived_at ? `Archived ${shortDate(dayKey(s.archived_at))} · ${line}` : line
})

const TONE_DOT: Record<DateTone, string> = {
  good: 'bg-lime-2',
  mid: 'bg-warn-bright',
  low: 'bg-coral',
  calm: 'bg-border-dashed',
}

const NuxtLinkComponent = resolveComponent('NuxtLink')

const field = ref<HTMLInputElement | null>(null)
const swatches = ref<HTMLElement | null>(null)

const { actions, renaming, draft, finishRename, colouring, recolour, confirming, restore } = useCourseMenu(
  () => props.subject,
  { field, swatches, ask: (s) => emit('ask', s), group: (s) => emit('group', s) },
)
</script>

<template>
  <article
    class="group/row relative flex min-h-[60px] items-center gap-3 py-2.5 pr-2 pl-4 transition-colors duration-150 hover:bg-surface-mute focus-within:bg-surface-mute"
    :aria-labelledby="`course-row-${subject.id}`"
  >
    <span
      class="size-2.5 shrink-0 rounded-full"
      :style="{ background: color }"
      aria-hidden="true"
    />

    <div class="grid min-w-0 flex-1 gap-px">
      <h3
        :id="`course-row-${subject.id}`"
        class="truncate text-[14.5px] leading-snug font-semibold text-text"
      >
        <input
          v-if="renaming"
          ref="field"
          v-model="draft"
          type="text"
          class="relative z-10 -mx-1.5 w-[calc(100%+12px)] rounded-[8px] bg-surface px-1.5 py-0.5 outline-none shadow-[inset_0_0_0_1.5px_var(--cobalt)]"
          aria-label="Course name"
          @keydown.enter.prevent="finishRename(true)"
          @keydown.esc.prevent.stop="finishRename(false)"
          @blur="finishRename(true)"
        >
        <!-- The whole row opens the course; this link is what it stretches. -->
        <NuxtLink
          v-else
          :to="home"
          class="outline-none after:absolute after:inset-0 focus-visible:after:shadow-[inset_0_0_0_2px_var(--cobalt)]"
        >
          {{ subject.title }}
        </NuxtLink>
      </h3>
      <p
        class="truncate text-[12.5px] text-text-muted"
        :title="sub"
      >
        {{ sub }}
      </p>
    </div>

    <!-- Picking a colour: the swatches take the bar and the date's place. -->
    <div
      v-if="colouring"
      ref="swatches"
      class="relative z-10 w-[224px] shrink-0"
    >
      <CompanionCoursesSwatches
        :subject="subject"
        compact
        @pick="recolour"
        @close="colouring = false"
      />
    </div>

    <UiBtn
      v-else-if="archived"
      variant="ghost"
      size="sm"
      icon="refresh"
      class="relative z-10 shrink-0"
      @click="restore"
    >
      Restore
    </UiBtn>

    <template v-else>
      <span
        class="hidden w-[118px] shrink-0 items-center gap-2.5 min-[720px]:flex"
        :title="progress.words || undefined"
      >
        <template v-if="progress.total">
          <span class="h-[5px] min-w-0 flex-1 overflow-hidden rounded-full bg-surface-track">
            <span
              class="block h-full rounded-full"
              :style="{ width: `${Math.round((100 * progress.done) / progress.total)}%`, background: color }"
            />
          </span>
          <span class="num shrink-0 text-[12px] text-text-faint">{{ progress.done }}/{{ progress.total }}</span>
        </template>
        <span
          v-else
          class="text-[12px] text-text-faint"
        >No topics yet</span>
      </span>

      <span class="hidden w-[244px] shrink-0 min-[980px]:flex">
        <component
          :is="date.to ? NuxtLinkComponent : 'span'"
          v-if="date"
          :to="date.to ?? undefined"
          :class="[
            'flex h-7 min-w-0 items-center gap-2 rounded-full bg-surface-sunken px-3',
            date.to &&
              'relative z-10 transition-colors hover:bg-surface-track focus-visible:outline-2 focus-visible:outline-cobalt',
          ]"
          :title="`${date.title}: ${date.words}`"
        >
          <span :class="['size-[7px] shrink-0 rounded-full', TONE_DOT[date.tone]]" />
          <span class="min-w-0 truncate text-[12.5px] text-text-soft">
            <span class="font-semibold text-text">{{ date.title }}</span> · {{ date.words }}
          </span>
        </component>
        <span
          v-else
          class="flex h-7 items-center text-[12.5px] text-text-faint"
        >Nothing due</span>
      </span>
    </template>

    <UiMenu
      :actions="actions"
      :title="subject.title"
      :label="`More for ${subject.title}`"
      float
      class="z-10"
    />
    <UiIcon
      name="chevron-right"
      :size="16"
      class="-ml-1 shrink-0 text-text-faint transition-[color,transform] duration-150 group-hover/row:translate-x-0.5 group-hover/row:text-text-soft"
      aria-hidden="true"
    />

    <CompanionCoursesDeleteDialog
      v-model:open="confirming"
      :subject="subject"
    />
  </article>
</template>
