<script setup lang="ts">
const { t } = useI18n()
import { useNoteCreate } from '~/companion/notes/actions'
import { courseColor } from '~/companion/colors'
import { useCompanion } from '~/companion/store'

/**
 * "Start something": the shapes a page or a whiteboard can start in, as big
 * tiles that make the thing at once and open it. No dialog after the click.
 * They go to My notes (or to `subjectId`, when the button that showed them
 * named a course); a class on now or the course on screen only becomes the
 * new note's "Add to …?" suggestion.
 *
 * Each tile carries a small drawing of what it starts as (the Cornell cue
 * column, a mind map's root and branches), drawn in the theme's own lines so
 * it reads in dark mode too.
 *
 * `size="sm"` is the phone's strip, which scrolls sideways under the thumb.
 * The rarer shapes (a lab report, a revision map, a kanban) are chips in
 * Notes' "+ New" list.
 */
type Art = 'blank' | 'lecture' | 'cornell' | 'reading' | 'vocab' | 'board' | 'mind' | 'concept'

interface Tile {
  kind: 'page' | 'board'
  template: string
  label: string
  hint: string
  art: Art
}

const START = computed<Tile[]>(() => [
  { kind: 'page', template: 'blank', label: t('notes.tileBlank'), hint: t('notes.tileBlankHint'), art: 'blank' },
  { kind: 'page', template: 'lecture', label: t('notes.tileLecture'), hint: t('notes.tileLectureHint'), art: 'lecture' },
  { kind: 'page', template: 'cornell', label: t('notes.tileCornell'), hint: t('notes.tileCornellHint'), art: 'cornell' },
  { kind: 'page', template: 'reading', label: t('notes.tileReading'), hint: t('notes.tileReadingHint'), art: 'reading' },
  { kind: 'page', template: 'vocab', label: t('notes.tileVocab'), hint: t('notes.tileVocabHint'), art: 'vocab' },
  { kind: 'board', template: 'blank', label: t('notes.tileBoard'), hint: t('notes.tileBoardHint'), art: 'board' },
  { kind: 'board', template: 'mindmap', label: t('notes.tileMind'), hint: t('notes.tileMindHint'), art: 'mind' },
  { kind: 'board', template: 'concept', label: t('notes.tileConcept'), hint: t('notes.tileConceptHint'), art: 'concept' },
])

const props = withDefaults(
  defineProps<{
    /** A course the button named: the tiles make their notes there. */
    subjectId?: string | null
    /** The course on screen: only the suggestion's guess. */
    onScreen?: string | null
    size?: 'lg' | 'sm'
  }>(),
  { subjectId: null, onScreen: null, size: 'lg' },
)

const store = useCompanion()
const create = useNoteCreate()

const course = computed(() => store.get('subjects', props.subjectId))
const where = computed(() => course.value?.title ?? t('notes.myNotes'))
const ink = computed(() => (course.value ? courseColor(course.value.color) : 'var(--brand)'))

const making = ref<string | null>(null)

async function make(tile: Tile): Promise<void> {
  if (create.busy.value) return
  making.value = `${tile.kind}:${tile.template}`
  try {
    const input = { subjectId: props.subjectId, template: tile.template, onScreen: props.onScreen }
    if (tile.kind === 'page') await create.page(input)
    else await create.board(input)
  } finally {
    making.value = null
  }
}
</script>

<template>
  <div
    :class="
      size === 'lg'
        ? 'grid grid-cols-2 gap-3 min-[720px]:grid-cols-4'
        : 'om-scroll -mx-4 flex snap-x scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1'
    "
  >
    <button
      v-for="tile in START"
      :key="`${tile.kind}:${tile.template}`"
      type="button"
      :disabled="create.busy.value"
      :aria-label="t('notes.tileAria', { tile: tile.label, where })"
      :class="[
        'group/tile grid cursor-pointer content-start rounded-[16px] bg-surface text-left shadow-[inset_0_0_0_1px_var(--border)] transition duration-150 outline-none hover:-translate-y-px hover:shadow-[inset_0_0_0_1px_var(--border-strong),0_10px_24px_-14px_rgb(13_22_96/0.35)] focus-visible:shadow-[inset_0_0_0_2px_var(--brand)] disabled:cursor-wait motion-reduce:hover:translate-y-0',
        size === 'lg' ? 'gap-3 p-2.5 pb-3.5' : 'w-[148px] shrink-0 snap-start gap-2 p-2 pb-2.5',
        making === `${tile.kind}:${tile.template}` && 'opacity-70',
      ]"
      @click="make(tile)"
    >
      <!-- What it starts as, drawn small. -->
      <span
        :class="[
          'relative grid place-items-center overflow-hidden rounded-[11px] bg-surface-sunken transition-colors group-hover/tile:bg-surface-track',
          size === 'lg' ? 'h-[88px]' : 'h-[64px]',
        ]"
      >
        <svg
          viewBox="0 0 120 64"
          :class="size === 'lg' ? 'h-[64px] w-[120px]' : 'h-[48px] w-[90px]'"
          fill="none"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <g
            stroke="var(--border-strong)"
            stroke-width="3"
          >
            <template v-if="tile.art === 'blank'">
              <rect
                x="34"
                y="6"
                width="52"
                height="52"
                rx="5"
                stroke-width="2"
                fill="var(--surface)"
              />
              <path
                d="M44 20h22"
                :stroke="ink"
              />
              <path
                d="M44 30h32M44 38h26"
                stroke-width="2.4"
              />
            </template>
            <template v-else-if="tile.art === 'lecture'">
              <path
                d="M14 10h40"
                :stroke="ink"
              />
              <path
                d="M20 20h56M20 28h44M14 40h30"
                stroke-width="2.4"
              />
              <path
                d="M20 50h62M20 58h38"
                stroke-width="2.4"
              />
              <circle
                cx="15"
                cy="20"
                r="1.6"
                fill="var(--border-strong)"
                stroke="none"
              />
              <circle
                cx="15"
                cy="28"
                r="1.6"
                fill="var(--border-strong)"
                stroke="none"
              />
              <rect
                x="84"
                y="36"
                width="24"
                height="22"
                rx="4"
                :stroke="ink"
                stroke-width="2"
              />
            </template>
            <template v-else-if="tile.art === 'cornell'">
              <rect
                x="10"
                y="6"
                width="100"
                height="40"
                rx="4"
                stroke-width="2"
              />
              <path
                d="M40 6v40"
                stroke-width="2"
              />
              <path
                d="M16 16h16M16 26h12"
                :stroke="ink"
                stroke-width="2.4"
              />
              <path
                d="M48 16h50M48 24h40M48 32h46"
                stroke-width="2.4"
              />
              <path
                d="M10 54h70M10 60h50"
                stroke-width="2.4"
              />
            </template>
            <template v-else-if="tile.art === 'reading'">
              <path
                d="M14 10h12M14 18h20"
                stroke-width="2.4"
              />
              <path
                d="M14 30h36"
                :stroke="ink"
              />
              <path
                d="M20 40v16"
                :stroke="ink"
                stroke-width="2.4"
              />
              <path
                d="M28 42h70M28 50h56"
                stroke-width="2.4"
              />
              <path
                d="M60 10h46M60 18h36"
                stroke-width="2.4"
              />
            </template>
            <template v-else-if="tile.art === 'vocab'">
              <rect
                x="10"
                y="8"
                width="100"
                height="48"
                rx="4"
                stroke-width="2"
              />
              <path
                d="M10 22h100M10 36h100M43 8v48M77 8v48"
                stroke-width="2"
              />
              <path
                d="M16 15h18M50 15h20M84 15h18"
                :stroke="ink"
                stroke-width="2.4"
              />
            </template>
            <template v-else-if="tile.art === 'board'">
              <g stroke="none">
                <rect
                  x="14"
                  y="10"
                  width="28"
                  height="24"
                  rx="3"
                  fill="var(--warn-soft)"
                />
                <rect
                  x="48"
                  y="20"
                  width="28"
                  height="24"
                  rx="3"
                  :fill="ink"
                  fill-opacity="0.22"
                />
              </g>
              <path
                d="M80 46c6-10 14-14 26-12"
                :stroke="ink"
                stroke-width="2.4"
              />
              <path
                d="M18 50c8-4 12 4 20 0s12-4 18 0"
                stroke-width="2.4"
              />
            </template>
            <template v-else>
              <!-- Mind map, concept map: a root and its branches. -->
              <path
                d="M60 32 26 14M60 32 26 50M60 32l34-18M60 32l34 18"
                stroke-width="2"
              />
              <rect
                :x="tile.art === 'concept' ? 42 : 44"
                y="24"
                :width="tile.art === 'concept' ? 36 : 32"
                height="16"
                :rx="tile.art === 'concept' ? 8 : 5"
                :fill="ink"
                stroke="none"
              />
              <rect
                v-for="(at, i) in [[10, 8], [10, 44], [86, 8], [86, 44]]"
                :key="i"
                :x="at[0]"
                :y="at[1]"
                width="24"
                height="12"
                rx="4"
                stroke-width="2"
                fill="var(--surface)"
              />
            </template>
          </g>
        </svg>
        <span
          v-if="making === `${tile.kind}:${tile.template}`"
          class="absolute inset-0 grid place-items-center bg-surface/60"
        >
          <UiIcon
            name="loader"
            :size="18"
            class="animate-spin text-text-muted"
          />
        </span>
      </span>
      <span class="grid gap-0.5 px-1">
        <span :class="['font-semibold text-text', size === 'lg' ? 'text-[14.5px]' : 'text-[13.5px]']">{{ tile.label }}</span>
        <span
          v-if="size === 'lg'"
          class="truncate text-[12.5px] text-text-muted"
        >{{ tile.hint }}</span>
        <span
          v-if="course"
          class="flex min-w-0 items-center gap-1.5 text-[12px] text-text-faint"
        >
          <span
            class="size-1.5 shrink-0 rounded-full"
            :style="{ background: ink }"
          />
          <span class="truncate">in {{ where }}</span>
        </span>
      </span>
    </button>
  </div>
</template>
