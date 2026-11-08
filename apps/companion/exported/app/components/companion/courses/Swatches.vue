<script setup lang="ts">
import type { Subject } from '~/companion/types'
import { courseColor } from '~/companion/colors'
import { COURSE_PALETTE } from '~/companion/create'

/**
 * The course palette as eight swatches, the course's own ringed and ticked:
 * how a course is recoloured in place, across a card's cover (where the
 * swatches take the path's place) or along a list row (where they take the
 * progress and the date's). A pick is the whole interaction; Esc puts them
 * away. `compact` is the row's size.
 */
withDefaults(
  defineProps<{
    /** The course, or one not made yet: only its name and colour are read. */
    subject: Pick<Subject, 'title' | 'color'>
    compact?: boolean
  }>(),
  { compact: false },
)

const emit = defineEmits<{ pick: [tone: string]; close: [] }>()

/** The palette's tokens in words, for the swatches' labels. */
const COLOUR_NAMES: Record<string, string> = {
  db: 'Leaf',
  net: 'Apricot',
  prg: 'Lilac',
  mth: 'Rose',
  seg: 'Sea',
  eng: 'Sky',
  ita: 'Butter',
  c8: 'Stone',
}
</script>

<template>
  <div
    class="grid animate-rise grid-cols-8"
    role="radiogroup"
    :aria-label="`Colour for ${subject.title}`"
    @keydown.esc.prevent.stop="emit('close')"
  >
    <button
      v-for="tone in COURSE_PALETTE"
      :key="tone"
      type="button"
      role="radio"
      :aria-checked="subject.color === tone"
      :aria-label="COLOUR_NAMES[tone] ?? tone"
      :title="COLOUR_NAMES[tone] ?? tone"
      :class="[
        'group/swatch grid cursor-pointer place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand-line',
        compact ? 'h-8' : 'h-10',
      ]"
      @click="emit('pick', tone)"
    >
      <span
        :class="[
          'grid place-items-center rounded-full transition-[box-shadow,transform] duration-150 group-hover/swatch:scale-110',
          compact ? 'size-5' : 'size-6',
          subject.color === tone && 'shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--text)]',
        ]"
        :style="{ background: courseColor(tone) }"
      >
        <UiIcon
          v-if="subject.color === tone"
          name="check"
          :size="compact ? 11 : 12"
          :stroke="2.6"
          class="text-on-brand"
        />
      </span>
    </button>
  </div>
</template>
