<script setup lang="ts">
import type { Subject } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { courseColor } from '~/companion/colors'
import { courseBeads, courseInitials, courseProgress, type BeadState } from '~/companion/course-home'
import { coverImageUrl, coverPicture } from '~/companion/course-icons'
const { t } = useI18n()

/**
 * A course's cover: the one picture of a course, wherever a course is shown
 * as a thing (the Courses shelf, a course row in the chat's Recent list).
 * It is the course's colour washed into the surface, the dotted canvas the
 * roadmap is drawn on, its picture, and its path. The picture is the one the
 * learner picked (a glyph or an emoji, `subjects.icon`), else the one its
 * title calls for, else its initials (`coverPicture`).
 *
 *   <CompanionCourseCover :subject="s" />               the card's cover
 *   <CompanionCourseCover :subject="id" size="sm" />    a 40px thumbnail
 *
 * `subject` is the course or its id; an id that no longer resolves draws a
 * neutral tile rather than nothing, so a row about a deleted course keeps
 * its shape.
 *
 * **lg** (the card's top, 140px tall, as wide as its box): a label like a
 * binder's (initials on a solid tile, the course code or "On your own", how
 * far along it is in words) and, along the foot, the course as one line of
 * beads (README: a course is a path, never a graph): filled for done, ringed
 * for where the learner is, hollow for what's ahead, a long course folded to
 * twenty (`courseBeads`). With `links` each bead opens its lesson. Hovering
 * a bead names it, any bead and not only the current one, in a small ink
 * tooltip over the path: the lesson's title, its number and how far it is
 * walked, or for a bead that holds a run of lessons, the first few of them.
 * While it shows, whatever the host floats over the path (the card's
 * Continue) steps aside, so the two never sit on each other. Three
 * slots let a host put its own controls on the cover: `actions` top right
 * (the card's "⋯"), `over` just above the path (the card's Continue), and
 * `foot`, which takes the path's place while it's filled. With `picker` the
 * picture is a button that emits `look` (the card's "Icon and colour"). Everything drawn is a mix of the course colour with a surface
 * or text token, so it holds on a light page and a dark one; the mixes are
 * set as `--course-*` on the root for slot content to use too.
 *
 * **sm** (40px, decorative, `aria-hidden`): the wash and the dots, the
 * initials in the course's ink, and the path reduced to a hairline along the
 * bottom edge, filled as far as the learner has walked. It sits beside a
 * title that already says which course it is.
 */
const props = withDefaults(
  defineProps<{
    subject: Subject | string
    size?: 'sm' | 'lg'
    /** lg: the line under the label instead of how far along it is ("Pick a colour"). */
    note?: string | null
    /** lg: beads are links into the course's lessons. */
    links?: boolean
    /**
     * sm: its side in px when not the 40px default: 34 on the app rail, 22 in
     * the sidebar's course list. Radius and initials scale with it, so a cover
     * is the same picture at every size.
     */
    px?: number
    /** lg: the picture is a button that asks for "Icon and colour" (`look`). */
    picker?: boolean
  }>(),
  { size: 'lg', note: null, links: true, px: 40, picker: false },
)

const emit = defineEmits<{ look: [] }>()

// A thumbnail is seen before it is read: twice the card's wash, so a row of
// them tells the courses apart at a glance.
const box = computed(() => ({
  background: `color-mix(in srgb, ${color.value} 22%, var(--surface))`,
  ...(props.px === 40
    ? {}
    : { width: `${props.px}px`, height: `${props.px}px`, borderRadius: `${Math.round(props.px * 0.3)}px` }),
}))

const c = useCompanion()

const course = computed<Subject | null>(() =>
  typeof props.subject === 'string' ? c.get('subjects', props.subject) : props.subject,
)

const color = computed(() => courseColor(course.value?.color))
const initials = computed(() => (course.value ? courseInitials(course.value.title) : '·'))
/** An uploaded picture that won't load (gone, offline) gives way to what the name calls for. */
const broken = ref(false)
watch(() => course.value?.icon, () => (broken.value = false))
const picture = computed(() => {
  const s = course.value
  if (!s) return { kind: 'initials' as const }
  const p = coverPicture(s)
  return p.kind === 'image' && broken.value ? coverPicture({ title: s.title }) : p
})
const imageSrc = computed(() => (picture.value.kind === 'image' ? coverImageUrl(picture.value.name) : ''))
const beads = computed(() => (course.value ? courseBeads(c, course.value) : []))
const progress = computed(() =>
  course.value ? courseProgress(c, course.value) : { done: 0, total: 0, words: '' },
)

const nowAt = computed(() => beads.value.findIndex((b) => b.state === 'now'))

/** How much of the spine is walked: up to the current bead, or the last one done. */
const walked = computed(() => {
  const n = beads.value.length
  if (n <= 1) return beads.value[0]?.state === 'done' ? 1 : 0
  const last = nowAt.value >= 0 ? nowAt.value : beads.value.map((b) => b.state).lastIndexOf('done')
  return Math.max(0, last) / (n - 1)
})

const kind = computed(() => {
  const s = course.value
  if (!s) return ''
  // The code first: a centre's class copy carries its group's name there, and isn't "On your own".
  return s.code || (s.format === 'path' ? t('course.cover.alone') : t('course.cover.school'))
})

const pathLabel = computed(() => {
  const here = nowAt.value >= 0 ? beads.value[nowAt.value]?.title.replace(/^[\d–]+ · /, '') : null
  return [progress.value.words || t('course.cover.noTopics'), here ? t('course.cover.now', { here }) : null].filter(Boolean).join(', ')
})

function beadTo(open: string): string {
  return `/app/courses/${course.value?.id}?open=${encodeURIComponent(open)}`
}

/* -- A bead's name, on hover ------------------------------------------------ */

/** The bead under the pointer. A touch screen has no hover, and its beads take no pointer. */
const hovered = ref<number | null>(null)

/** How many of a run's lessons the tooltip lists before "and 3 more". */
const RUN_SHOWN = 3

/** A bead's state in words: a path is walked by the learner, a school course by its classes. */
const stateWord = (kind: 'path' | 'weeks', s: BeadState): string => t(`course.cover.${kind}_${s}`)

const tip = computed(() => {
  const i = hovered.value
  const bead = i === null ? null : beads.value[i]
  if (!bead) return null
  const path = course.value?.format === 'path'
  const word = path ? t('course.cover.lesson') : t('course.cover.topic')
  const state = stateWord(path ? 'path' : 'weeks', bead.state)
  // Placed like the card's Continue: at the bead's fraction of the line,
  // pulled back by the same fraction of its own width, so it stays inside.
  const at = beads.value.length > 1 ? i! / (beads.value.length - 1) : 0
  const place = { left: `${at * 100}%`, transform: `translateX(-${at * 100}%)` }
  if (bead.names.length === 1) {
    return { head: bead.names[0]!, lines: [] as string[], meta: t('course.cover.metaOne', { word, n: bead.number, state }), place }
  }
  const more = bead.names.length - RUN_SHOWN
  return {
    head: t(path ? 'course.cover.lessons' : 'course.cover.topics', { from: bead.number, to: bead.number + bead.names.length - 1 }),
    lines: [...bead.names.slice(0, RUN_SHOWN), ...(more > 0 ? [t('course.cover.more', { n: more })] : [])],
    meta: state,
    place,
  }
})

const tones = computed(() => ({
  '--course': color.value,
  '--course-wash': `color-mix(in srgb, ${color.value} 11%, var(--surface))`,
  '--course-dots': `color-mix(in srgb, ${color.value} 30%, transparent)`,
  '--course-line': `color-mix(in srgb, ${color.value} 26%, transparent)`,
  '--course-ring': `color-mix(in srgb, ${color.value} 48%, transparent)`,
  '--course-halo': `color-mix(in srgb, ${color.value} 20%, transparent)`,
  '--course-ink': `color-mix(in srgb, ${color.value} 72%, var(--text))`,
}))

const slots = useSlots()
const NuxtLinkComponent = resolveComponent('NuxtLink')
</script>

<template>
  <span
    v-if="size === 'sm'"
    class="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-[12px] bg-[var(--course-wash)] shadow-[inset_0_0_0_1px_var(--course-line)]"
    :style="[tones, box]"
    aria-hidden="true"
  >
    <span
      v-if="px >= 30 && picture.kind !== 'image'"
      class="absolute inset-0 bg-[radial-gradient(circle,var(--course-dots)_0.8px,transparent_1.1px)] bg-[length:7px_7px] bg-[position:3.5px_2px] [mask-image:linear-gradient(to_bottom,transparent_10%,black_95%)]"
    />
    <template v-if="picture.kind === 'image'">
      <img
        :src="imageSrc"
        alt=""
        class="absolute inset-0 size-full object-cover"
        draggable="false"
        @error="broken = true"
      >
      <span class="absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.12)]" />
    </template>
    <CompanionIcon
      v-else-if="picture.kind === 'glyph'"
      :name="picture.key"
      :size="Math.round(px * 0.5)"
      :stroke="px >= 30 ? 1.9 : 2.1"
      class="relative text-[color:var(--course-ink)]"
    />
    <span
      v-else-if="picture.kind === 'emoji'"
      class="relative leading-none"
      :style="{ fontSize: `${Math.round(px * 0.5)}px` }"
    >{{ picture.text }}</span>
    <span
      v-else
      class="relative font-display leading-none font-bold tracking-[-0.03em] text-[color:var(--course-ink)]"
      :style="{ fontSize: `${Math.round(px * 0.35)}px` }"
    >{{ initials }}</span>
    <span
      v-if="beads.length && px >= 30"
      class="absolute inset-x-0 bottom-0 h-[3px] bg-[var(--course-line)]"
    >
      <span
        class="block h-full bg-[var(--course)]"
        :style="{ width: `${Math.round(walked * 100)}%` }"
      />
    </span>
  </span>

  <div
    v-else
    class="relative h-[140px] shrink-0 bg-[var(--course-wash)]"
    :style="tones"
  >
    <span
      class="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle,var(--course-dots)_1px,transparent_1.4px)] bg-[length:14px_14px] bg-[position:7px_5px] [mask-image:linear-gradient(to_bottom,transparent_8%,black_88%)]"
      aria-hidden="true"
    />

    <div class="absolute inset-x-0 top-0 flex items-start gap-3 pt-4 pr-2.5 pl-4">
      <component
        :is="picker ? 'button' : 'span'"
        :type="picker ? 'button' : undefined"
        :class="[
          'relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-[12px] bg-[var(--course)] font-display text-[16px] leading-none font-bold tracking-[-0.03em] text-on-brand shadow-[0_8px_16px_-8px_var(--course-ring)]',
          picker &&
            'relative z-10 cursor-pointer transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        ]"
        :title="picker ? t('course.cover.look') : undefined"
        :aria-label="picker ? t('course.cover.lookFor', { title: course?.title ?? t('course.cover.thisCourse') }) : undefined"
        :aria-hidden="picker ? undefined : 'true'"
        @click="picker && emit('look')"
      >
        <template v-if="picture.kind === 'image'">
          <img
            :src="imageSrc"
            alt=""
            class="absolute inset-0 size-full object-cover"
            draggable="false"
            @error="broken = true"
          >
          <span class="absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.12)]" />
        </template>
        <CompanionIcon
          v-else-if="picture.kind === 'glyph'"
          :name="picture.key"
          :size="21"
          :stroke="2"
        />
        <span
          v-else-if="picture.kind === 'emoji'"
          class="text-[21px]"
        >{{ picture.text }}</span>
        <template v-else>{{ initials }}</template>
      </component>
      <span class="grid min-w-0 flex-1 gap-px pt-0.5">
        <span class="truncate text-[12.5px] font-semibold text-[color:var(--course-ink)]">{{ kind }}</span>
        <span class="truncate text-[12px] text-text-muted">{{ note ?? (progress.words || t('course.cover.noTopics')) }}</span>
      </span>
      <div
        v-if="slots.actions"
        class="relative z-10"
      >
        <slot name="actions" />
      </div>
    </div>

    <div
      v-if="slots.foot"
      class="absolute inset-x-3 bottom-2.5 z-10"
    >
      <slot name="foot" />
    </div>

    <template v-else>
      <!-- Over the path, inset to the beads' centres: the host's Continue. -->
      <div
        v-if="slots.over"
        :class="[
          'pointer-events-none absolute inset-x-[27px] bottom-[42px] h-9 transition-[opacity,visibility] duration-150',
          tip && 'invisible opacity-0',
        ]"
      >
        <slot name="over" />
      </div>

      <!-- The path: one line of beads, walked from the left. -->
      <div
        class="absolute inset-x-5 bottom-[18px] h-3.5"
        role="img"
        :aria-label="pathLabel"
      >
        <span
          v-if="beads.length"
          class="absolute inset-x-[7px] top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[var(--course-line)]"
          aria-hidden="true"
        />
        <span
          v-else
          class="absolute inset-x-[7px] top-1/2 -translate-y-1/2 border-t-[1.5px] border-dashed border-[color:var(--course-ring)]"
          aria-hidden="true"
        />
        <span
          v-if="walked > 0 && beads.length > 1"
          class="absolute left-[7px] top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[var(--course)]"
          :style="{ width: `calc((100% - 14px) * ${walked})` }"
          aria-hidden="true"
        />
        <div
          class="relative flex h-full items-center justify-between"
          aria-hidden="true"
        >
          <component
            :is="links && course ? NuxtLinkComponent : 'span'"
            v-for="(bead, i) in beads"
            :key="i"
            :to="links && course ? beadTo(bead.open) : undefined"
            :tabindex="links && course ? -1 : undefined"
            class="group/bead relative z-10 grid size-3.5 place-items-center pointer-coarse:pointer-events-none"
            @pointerenter="hovered = i"
            @pointerleave="hovered = null"
          >
            <span
              :class="[
                'block rounded-full transition-transform duration-150',
                links && 'group-hover/bead:scale-[1.35]',
                bead.state === 'done' && 'size-2 bg-[var(--course)]',
                bead.state === 'now' &&
                  'size-3.5 bg-surface shadow-[inset_0_0_0_3px_var(--course),0_0_0_4px_var(--course-halo)]',
                bead.state === 'ahead' && 'size-2 bg-surface shadow-[inset_0_0_0_1.5px_var(--course-ring)]',
              ]"
            />
          </component>
        </div>

        <!-- The hovered bead's name. -->
        <span
          v-if="tip"
          class="pointer-events-none absolute bottom-[calc(100%+10px)] z-30 grid w-max max-w-[min(240px,100%)] gap-px rounded-[10px] bg-inverse px-[11px] pt-[7px] pb-2 text-left text-on-inverse shadow-[var(--shadow-pop)]"
          :style="tip.place"
          aria-hidden="true"
        >
          <span class="truncate text-[13px] leading-snug font-semibold">{{ tip.head }}</span>
          <span
            v-for="(line, n) in tip.lines"
            :key="n"
            class="truncate text-[12px] leading-snug text-white/75"
          >{{ line }}</span>
          <span class="text-[12px] leading-snug text-white/55">{{ tip.meta }}</span>
        </span>
      </div>
    </template>
  </div>
</template>
