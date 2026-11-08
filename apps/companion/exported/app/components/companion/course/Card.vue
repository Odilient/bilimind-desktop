<script setup lang="ts">
import type { Subject } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { useCourseMenu } from '~/companion/course-menu'
import { continueTarget, courseBeads, courseNextDate, courseWhere, type DateTone } from '~/companion/course-home'
import { dayKey, shortDate } from '~/companion/time'
import { gradeWords, runningGrade } from '~/companion/grades'

/**
 * A course on the Courses shelf. The card it replaces was a dashboard tile
 * (a 6px colour band, a title, a progress bar, a footer button) and the
 * learner said so: it didn't feel like anything. This one is drawn as two
 * things at once.
 *
 *  - **A thing you own.** The top is the course's cover
 *    (`CompanionCourseCover`): the colour washed into the surface (so it
 *    holds in the dark theme too), the dotted canvas the roadmap is drawn
 *    on, fading up from the path, and a label like a binder's: initials on a
 *    solid tile, the course code or "On your own", how far along it is.
 *  - **A path you walk.** Along the cover's foot runs the course as one line
 *    of beads (README: a course is a path, never a graph): filled for done,
 *    a ringed bead for where the learner is, hollow for what's ahead. A bead
 *    is a shortcut: clicking one opens that lesson in the course.
 *
 * Under the cover: the name, one line on where they are ("Lesson 4 of 12 ·
 * SQL joins", or the week and the lecturer at school) and the next date that
 * counts with how ready they are for it, as a chip that opens the deadline.
 *
 * Continue (`continueTarget`, the same answer the course's own home gives)
 * floats above the bead it continues from, so the button sits on the path
 * where the learner stands. It shows on hover and on keyboard focus, so a
 * shelf of six cards isn't six black buttons; on a touch screen, where there
 * is no hover, it's always there.
 *
 * The "⋯" (`useCourseMenu`, the same menu a list row has) holds what can be
 * done to the course itself: rename it in place, pick its icon and colour
 * (`CompanionCoursesLookDialog`, also opened by clicking the cover's
 * picture), move it into one of the learner's groups, ask the assistant about
 * it, open its original in Moodle, archive it (off the shelf, nothing lost),
 * or delete it, which keeps everything the learner made by moving it to My
 * notes first.
 *
 * An archived course is only drawn as a card in the shelf's search results;
 * its cover says when it was put away, and its menu leads with Restore.
 */
const props = defineProps<{
  subject: Subject
}>()

const emit = defineEmits<{ ask: [subject: Subject]; group: [subject: Subject] }>()

const c = useCompanion()

const home = computed(() => `/app/courses/${props.subject.id}`)

const beads = computed(() => courseBeads(c, props.subject))
const where = computed(() => courseWhere(c, props.subject))
const date = computed(() => courseNextDate(c, props.subject))
/** "Averaging 78%": tasks and grades. */
const grade = computed(() => gradeWords(runningGrade(c.deadlines.value.filter((d) => d.subject_id === props.subject.id))))

const next = computed(() => {
  const target = continueTarget(c, props.subject)
  if (!target) return null
  return {
    ...target,
    // The line under the title already numbers it; the button only names it.
    short: target.label.replace(/^Lesson \d+ · /, ''),
    to: `${home.value}?open=${encodeURIComponent(target.open)}`,
    live: target.why === 'in class now',
  }
})

/* -- The path ------------------------------------------------------------- */

const nowAt = computed(() => beads.value.findIndex((b) => b.state === 'now'))

/**
 * Where the Continue floats, 0 to 1 along the line: over the bead it opens
 * (at school that may be the topic just taught, one behind "now"), else over
 * where the learner stands.
 */
const standing = computed(() => {
  const n = beads.value.length
  if (n <= 1) return 0
  const target = next.value ? beads.value.findIndex((b) => b.covers.includes(next.value!.open)) : -1
  if (target >= 0) return target / (n - 1)
  if (nowAt.value >= 0) return nowAt.value / (n - 1)
  return beads.value.every((b) => b.state === 'done') ? 1 : 0
})

const TONE_DOT: Record<DateTone, string> = {
  good: 'bg-leaf',
  mid: 'bg-warn-bright',
  low: 'bg-danger',
  calm: 'bg-border-dashed',
}

const NuxtLinkComponent = resolveComponent('NuxtLink')

/* -- The menu: rename in place, the rest through dialogs and the page ------- */

const field = ref<HTMLInputElement | null>(null)

const { actions, renaming, draft, finishRename, looking, confirming } = useCourseMenu(
  () => props.subject,
  { field, ask: (s) => emit('ask', s), group: (s) => emit('group', s) },
)

/** The line under the cover's label: when it was put away. */
const note = computed(() =>
  props.subject.archived_at ? `Archived ${shortDate(dayKey(props.subject.archived_at))}` : null,
)
</script>

<template>
  <article
    class="group/card relative flex h-full flex-col rounded-[22px] bg-surface transition-transform duration-200 ease-out hover:z-20 hover:-translate-y-0.5 focus-within:z-20 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    :aria-labelledby="`course-card-${subject.id}`"
  >
    <!-- The cover: the course's colour, its canvas, its label and its path. -->
    <CompanionCourseCover
      :subject="subject"
      :note="note"
      picker
      class="rounded-t-[22px]"
      @look="looking = true"
    >
      <template #actions>
        <!-- On the body (`float`): inside the card it went under the next one. -->
        <UiMenu
          :actions="actions"
          :title="subject.title"
          :label="`More for ${subject.title}`"
          float
        />
      </template>

      <!--
        Continue, floating over the bead it continues from. `left` puts it at
        that bead's place along the line and the same fraction of its own
        width pulls it back, so it stays inside the cover at both ends.
      -->
      <template
        v-if="next"
        #over
      >
        <NuxtLink
          :to="next.to"
          :class="[
            'absolute bottom-0 flex h-9 w-max max-w-[min(100%,250px)] translate-y-1 items-center gap-1.5 rounded-full pr-2.5 pl-3.5 text-[13px] font-semibold whitespace-nowrap opacity-0 shadow-[0_10px_22px_-12px_rgb(11_13_16/0.55)] transition-[opacity,translate,background-color] duration-150 ease-out before:absolute before:-inset-1.5 group-hover/card:pointer-events-auto group-hover/card:translate-y-0 group-hover/card:opacity-100 group-focus-within/card:pointer-events-auto group-focus-within/card:translate-y-0 group-focus-within/card:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand pointer-coarse:pointer-events-auto pointer-coarse:translate-y-0 pointer-coarse:opacity-100 motion-reduce:translate-y-0',
            next.live ? 'bg-accent text-on-accent hover:bg-hi-2' : 'bg-inverse text-on-inverse hover:bg-inverse-hover',
          ]"
          :style="{ left: `${standing * 100}%`, transform: `translateX(-${standing * 100}%)` }"
          :title="`${next.verb} · ${next.label} (${next.why})`"
        >
          <span class="shrink-0">{{ next.verb }}</span>
          <span
            class="shrink-0"
            :class="next.live ? 'text-on-accent/40' : 'text-white/40'"
          >·</span>
          <span class="min-w-0 truncate font-medium">{{ next.short }}</span>
          <UiIcon
            name="arrow-right"
            :size="14"
            :stroke="2.2"
            class="shrink-0"
          />
        </NuxtLink>
      </template>
    </CompanionCourseCover>

    <div class="flex flex-1 flex-col px-5 pt-3.5 pb-4">
      <h3
        :id="`course-card-${subject.id}`"
        class="t-head text-[19px] leading-[1.2]"
      >
        <input
          v-if="renaming"
          ref="field"
          v-model="draft"
          type="text"
          class="relative z-10 -mx-1.5 w-[calc(100%+12px)] rounded-[8px] bg-surface-sunken px-1.5 py-0.5 outline-none focus:shadow-[inset_0_0_0_1.5px_var(--brand)]"
          aria-label="Course name"
          @keydown.enter.prevent="finishRename(true)"
          @keydown.esc.prevent.stop="finishRename(false)"
          @blur="finishRename(true)"
        >
        <!-- The whole card opens the course; this link is what it stretches. -->
        <NuxtLink
          v-else
          :to="home"
          class="line-clamp-2 after:absolute after:inset-0 after:rounded-[22px] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-brand"
        >
          {{ subject.title }}
        </NuxtLink>
      </h3>
      <p
        class="mt-1 truncate text-[13.5px] text-text-muted"
        :title="where"
      >
        {{ where }}
      </p>

      <div class="mt-auto flex min-w-0 pt-3.5">
        <component
          :is="date.to ? NuxtLinkComponent : 'span'"
          v-if="date"
          :to="date.to ?? undefined"
          :class="[
            'flex h-7 min-w-0 items-center gap-2 rounded-full bg-surface-sunken px-3',
            date.to &&
              'relative z-10 transition-colors before:absolute before:-inset-y-2 before:inset-x-0 hover:bg-surface-track focus-visible:outline-2 focus-visible:outline-brand',
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
        <!-- Tasks and grades: the running grade, quietly, in words. -->
        <span
          v-if="grade"
          class="ml-auto flex h-7 shrink-0 items-center pl-3 text-[12.5px] text-text-faint"
        >{{ grade }}</span>
      </div>
    </div>

    <!-- The card's edge, drawn over the cover so the colour never eats it. -->
    <span
      class="pointer-events-none absolute inset-0 rounded-[22px] shadow-[inset_0_0_0_1px_var(--border)] transition-shadow duration-200 group-focus-within/card:shadow-[inset_0_0_0_1px_var(--border-strong)] group-hover/card:shadow-[inset_0_0_0_1px_var(--border-strong),0_18px_36px_-22px_rgb(11_13_16/0.38)]"
      aria-hidden="true"
    />

    <CompanionCoursesDeleteDialog
      v-model:open="confirming"
      :subject="subject"
    />
    <CompanionCoursesLookDialog
      v-model:open="looking"
      :subject="subject"
    />
  </article>
</template>
