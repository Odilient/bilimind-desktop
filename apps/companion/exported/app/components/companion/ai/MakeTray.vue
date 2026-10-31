<script setup lang="ts">
/**
 * "Choose what to make": the tiles a new chat starts from (make.ts).
 *
 *   <CompanionAiMakeTray />              under the chat page's box, as a drawer
 *   <CompanionAiMakeTray variant="row" /> a strip of small ones, in the dock
 *
 * The tray slides out from under the composer (it is tucked beneath the
 * box's bottom edge, in the sunken tint, so the two read as one object), a
 * label that folds it away, and a grid of tiles: six to a row on a desktop,
 * three on a phone, scrolling inside itself past two rows. The first tiles
 * after "Just ask" are the learner's own (their next exam, the topic they
 * hold least well), washed in that course's colour with its name under
 * them; then the kinds of thing anyone makes.
 *
 * Picking a tile writes its words in the box, never sends: "Create a quiz
 * on " ready to finish, or a personal tile's whole request (make.ts
 * `withWords`); "Check my attempt" also puts the box in its mode. The tile
 * whose words lead the box, or whose mode is on, is drawn picked. A
 * screen with a box of its own (Today) takes the tile with `@pick` and
 * writes it there instead. Folded or open is remembered per device.
 */
import { makeTiles, wash, type MakeTile } from '~/companion/ai/make'
import { useAiThread } from '~/companion/ai/thread'
import { useCompanion } from '~/companion/store'

const props = withDefaults(
  defineProps<{
    variant?: 'tray' | 'row'
    /** `@pick`: the tile goes to the caller's own box rather than the chat's. */
    onPick?: (tile: MakeTile) => void
  }>(),
  { variant: 'tray', onPick: undefined },
)

const t = useAiThread()
const store = useCompanion()

const tiles = computed<MakeTile[]>(() => {
  const all = makeTiles(store, props.variant === 'row' ? 2 : 3)
  return props.variant === 'row' ? all.filter((x) => x.key !== 'ask') : all
})

function selected(tile: MakeTile): boolean {
  if (tile.intent && t.intent.value === tile.intent) return true
  return Boolean(tile.prompt) && t.draft.value.startsWith(tile.prompt!)
}

function choose(tile: MakeTile): void {
  if (props.onPick) props.onPick(tile)
  else t.write(tile)
}

/* -- Folded or open, per device --------------------------------------------------- */

const KEY = 'bm:make-tray'
const open = ref(true)

onMounted(() => {
  try {
    open.value = localStorage.getItem(KEY) !== '0'
  } catch {
    // Private mode: it opens, which is the default anyway.
  }
})

function toggle(): void {
  open.value = !open.value
  try {
    localStorage.setItem(KEY, open.value ? '1' : '0')
  } catch {
    // Forgotten next time; harmless.
  }
}
</script>

<template>
  <!-- In the dock: one strip, scrolling sideways. -->
  <div
    v-if="variant === 'row'"
    class="om-scroll -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1.5"
    role="group"
    aria-label="Choose what to make"
  >
    <button
      v-for="tile in tiles"
      :key="tile.key"
      type="button"
      :class="[
        'group/t flex w-[88px] shrink-0 cursor-pointer flex-col gap-1 rounded-[12px] p-1 text-left transition-colors duration-150 outline-none focus-visible:bg-surface-sunken',
        selected(tile) ? 'bg-brand-soft' : 'hover:bg-surface-sunken',
      ]"
      :aria-pressed="selected(tile)"
      :title="tile.sub ? `${tile.label} · ${tile.sub}` : tile.label"
      @click="choose(tile)"
    >
      <span
        :class="[
          'block h-[48px] w-full overflow-hidden rounded-[9px] bg-surface p-1 shadow-[inset_0_0_0_1px_var(--border)] transition-shadow duration-150',
          selected(tile) && 'shadow-[inset_0_0_0_2px_var(--cobalt)]',
        ]"
        :style="tile.color ? { background: wash(tile.color, 14) } : undefined"
      >
        <CompanionAiMakeThumb
          :kind="tile.thumb"
          :accent="tile.color"
        />
      </span>
      <span
        :class="[
          'block truncate px-0.5 text-[11.5px] leading-tight font-medium',
          selected(tile) ? 'text-cobalt' : 'text-text-body group-hover/t:text-text',
        ]"
      >{{ tile.label }}</span>
    </button>
  </div>

  <!-- On the chat page: the drawer under the box. -->
  <div
    v-else
    class="relative rounded-b-[22px] bg-surface-sunken px-2.5 pt-8 pb-2.5 shadow-[inset_0_0_0_1px_var(--border)] min-[600px]:px-3"
  >
    <button
      type="button"
      class="mb-1 flex h-9 w-full cursor-pointer items-center gap-1.5 rounded-[10px] px-1.5 text-left text-[13px] font-semibold text-text-soft transition-colors outline-none hover:text-text focus-visible:text-text"
      :aria-expanded="open"
      aria-controls="ai-make-tiles"
      @click="toggle"
    >
      Choose what to make
      <UiIcon
        name="chevron-up"
        :size="14"
        :stroke="2"
        :class="['transition-transform duration-200', !open && 'rotate-180']"
      />
    </button>

    <div
      v-show="open"
      id="ai-make-tiles"
      class="om-scroll grid max-h-[316px] grid-cols-3 gap-1.5 overflow-y-auto pb-0.5 min-[600px]:grid-cols-4 min-[900px]:max-h-[296px] min-[900px]:grid-cols-6"
      role="group"
      aria-label="Choose what to make"
    >
      <button
        v-for="tile in tiles"
        :key="tile.key"
        type="button"
        :class="[
          'group/t flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-[14px] p-1.5 text-left transition-colors duration-150 outline-none focus-visible:bg-surface',
          selected(tile) ? 'bg-brand-soft' : 'hover:bg-surface',
        ]"
        :aria-pressed="selected(tile)"
        :title="tile.sub ? `${tile.label} · ${tile.sub}` : tile.label"
        @click="choose(tile)"
      >
        <span
          :class="[
            'block aspect-[10/7] w-full overflow-hidden rounded-[11px] bg-surface p-1.5 shadow-[inset_0_0_0_1px_var(--border)] transition-shadow duration-150',
            selected(tile) && 'shadow-[inset_0_0_0_2px_var(--cobalt)]',
          ]"
          :style="tile.color ? { background: wash(tile.color, 14) } : undefined"
        >
          <CompanionAiMakeThumb
            :kind="tile.thumb"
            :accent="tile.color"
          />
        </span>
        <span class="grid min-w-0 gap-px px-0.5">
          <span
            :class="[
              'line-clamp-2 text-[12.5px] leading-[1.3] font-medium',
              selected(tile) ? 'text-cobalt' : 'text-text-body group-hover/t:text-text',
            ]"
          >{{ tile.label }}</span>
          <span
            v-if="tile.sub"
            class="truncate text-[11px] text-text-muted"
          >{{ tile.sub }}</span>
        </span>
      </button>
    </div>
  </div>
</template>
