<script setup lang="ts">
import type { BlockType } from '~/types/api'
import { presentationOf } from '~/composables/useBlockPresentation'

/**
 * The frame every block sits in.
 *
 * A lesson is one continuous sequence of up to twenty wildly different formats —
 * prose, a diagram, a slider, a branching scenario, a code editor with tests.
 * The thing that has to hold that together is *rhythm*, not chrome.
 *
 * Which is why this takes a block `type` and nothing else about its looks. It
 * used to take `label`, `variant`, `tone` and `interactive` from whoever
 * rendered it, and the result was that every one of the twenty-odd components
 * named itself and most of them drew a box: a six-block lesson arrived as six
 * boxed, captioned objects — a taxonomy, not a lesson. Presentation now comes
 * from one table (`BLOCK_PRESENTATION`), so the choice is made once, for all of
 * them, by someone looking at the whole page.
 *
 * The dot beside an eyebrow turns accent-coloured for `task` blocks only. That
 * is the single signal separating "read this" from "do this", and it only works
 * while it is the only thing that uses the accent.
 */
const props = withDefaults(
  defineProps<{
    /** Drives the eyebrow, the frame and the measure. There is no default. */
    type: BlockType | string
    /** The block's own heading, when it has one. Sits under the eyebrow. */
    title?: string
    /**
     * Overrides the eyebrow. It exists for a block whose *category* is
     * model-authored, and there is currently none — a model-authored NAME goes
     * in `title`, where an 18px heading can hold a sentence and a 12px eyebrow
     * cannot. If you are reaching for this to rename a block, change the table.
     */
    label?: string
    /**
     * State, not style: a checklist that is finished, a submission that failed.
     * There is no `raised`/`sunken` any more; five card weights in one column
     * was five kinds of nothing.
     */
    tone?: 'default' | 'success' | 'warn' | 'danger'
    /** Small status pill after the label, e.g. "Passed", "2 of 4 tests". */
    badge?: string
    badgeTone?: 'neutral' | 'accent' | 'success' | 'warn' | 'danger'
    sourceMaterialIds?: number[] | null
  }>(),
  { tone: 'default', badgeTone: 'neutral' },
)

const presentation = computed(() => presentationOf(props.type))

/** A model-authored name wins over the table's; the table wins over nothing. */
const eyebrow = computed(() => {
  const authored = props.label?.trim()
  return authored ? authored : presentation.value.label
})

/**
 * The kind tile beside the eyebrow — cobalt's `.bk i` (`story.css`) and the
 * course player's block heads: a 22px rounded square, cobalt on cobalt-soft
 * for things you read, lime with ink for things you DO. The tile keeps the
 * old dot's single job — separating "read this" from "do this" — and adds a
 * glyph so a learner can tell a comparison from a timeline at a glance.
 */
const KIND_ICON: Record<string, string> = {
  explainer: 'book',
  key_points: 'list',
  example: 'file',
  worked_example: 'steps',
  analogy: 'bulb',
  misconception: 'warning',
  reflection: 'pencil',
  timeline: 'time',
  resource: 'link',
  audio: 'speaker',
  walkthrough: 'steps',
  checklist: 'list',
  diagram: 'flow',
  comparison: 'scales',
  reference_table: 'table',
  annotated_media: 'image',
  video: 'video',
  illustration: 'image',
  quiz: 'quiz',
  exam: 'target',
  project: 'wand',
  code: 'code',
  playground: 'sliders',
  scenario: 'sign',
  flashcards: 'cards',
  speaking: 'mic',
  dialogue: 'chat',
}

const kindIcon = computed(() => KIND_ICON[props.type] ?? 'layers')

// Daylight's block head (course.css .blk-h): a plain glyph and the name, muted. Something
// to DO keeps the one loud colour, a highlighter square behind its glyph.
const tileClass = computed(() => {
  if (props.type === 'misconception') return 'text-rose-ink'
  if (presentation.value.voice === 'task') return 'bg-accent text-on-accent'
  return 'text-text-muted'
})

/* White cards cut with a hairline and a long low drop — the lesson cards of the
   course player. State tones swap the ground, never the shape. */
const cardTones = {
  default: 'bg-surface-mute shadow-[0_0_0_1px_var(--border)]',
  success: 'bg-success-soft shadow-[inset_0_0_0_1px_var(--success-line)]',
  warn: 'bg-warn-soft shadow-[inset_0_0_0_1px_var(--warn-line)]',
  danger: 'bg-danger-soft shadow-[inset_0_0_0_1px_var(--danger-line)]',
} as const

const badgeTones = {
  neutral: 'bg-surface-sunken text-text-soft',
  accent: 'bg-accent-soft text-accent-strong',
  success: 'bg-success-soft text-success-text',
  warn: 'bg-warn-soft text-warn-text',
  danger: 'bg-danger-soft text-danger-text',
} as const

const isCard = computed(() => presentation.value.frame === 'card')

/* A dashed hairline above an aside, not a box around it: an aside is a change
   of voice inside the lesson, and boxing it makes it a separate document. */
const frameClass = computed(() =>
  presentation.value.frame === 'rule'
    ? 'border-t border-dashed border-border-strong pt-6'
    : isCard.value
      ? ['rounded-[14px] px-4 pt-4 pb-4.5 sm:px-[18px] sm:pb-5', cardTones[props.tone]]
      : '',
)
</script>

<template>
  <section :class="frameClass">
    <header
      v-if="eyebrow || $slots.actions"
      class="mb-2.5 flex min-h-6 items-center gap-[7px]"
    >
      <span
        v-if="eyebrow"
        :class="['grid size-5 shrink-0 place-items-center rounded-[6px]', tileClass]"
      >
        <UiIcon
          :name="kindIcon"
          :size="14"
          :stroke="2"
        />
      </span>
      <span
        v-if="eyebrow"
        class="text-[12px] leading-none font-bold text-text-muted"
        >{{ eyebrow }}</span
      >
      <span
        v-if="badge"
        :class="['rounded-full px-2.5 py-1 text-[11px] leading-none font-semibold', badgeTones[badgeTone]]"
        >{{ badge }}</span
      >

      <span class="flex-1" />

      <div
        v-if="$slots.actions"
        class="flex shrink-0 items-center gap-1.5"
      >
        <slot name="actions" />
      </div>
    </header>

    <h3
      v-if="title"
      class="t-head mb-3 text-[19px] leading-snug text-text"
    >
      {{ title }}
    </h3>

    <div>
      <slot />
    </div>

    <p
      v-if="sourceMaterialIds && sourceMaterialIds.length"
      class="mt-4 flex flex-wrap items-center gap-2 text-[12px] text-text-faint"
    >
      From your files
      <span
        class="inline-flex h-[21px] items-center gap-1 rounded-[6px] bg-[rgb(var(--wash-rgb)/0.065)] px-[7px] text-[12px] font-semibold text-text-soft"
      >
        <UiIcon
          name="file"
          :size="11"
          :stroke="2"
        />
        {{ sourceMaterialIds.length }}
        {{ sourceMaterialIds.length === 1 ? 'material' : 'materials' }}
      </span>
    </p>
  </section>
</template>
