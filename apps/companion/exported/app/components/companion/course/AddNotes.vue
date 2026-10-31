<script setup lang="ts">
import type { Subject } from '~/companion/types'
import type { Note } from '~/companion/notes/tree'
import { useNoteActions, useNotesTree } from '~/companion/notes/actions'

/**
 * "Add notes…": how a course pulls in what the learner already has. Notes
 * are made in My notes and stay there (nothing is filed by guesswork any
 * more), so a course's notes and materials each offer this one way to bring
 * them in: the Notes picker, showing only notes that are in no course yet,
 * and the picked ones move here at once through Notes' own move
 * (`moveMany`), so what's under a page comes along, a pending "Add to …?"
 * suggestion clears, and the toast has Undo, exactly as a move in Notes does.
 *
 * Three looks for the three places it sits: a button in the Notes view's
 * heading, a quiet row at the foot of a sidebar section, and an inline link
 * in a sentence (the Materials drop zone, an empty state). `look="none"`
 * draws no trigger at all, for a menu that calls `start()` itself.
 */
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    subject: Subject
    look?: 'button' | 'row' | 'link' | 'none'
    /** The trigger's words. */
    label?: string
  }>(),
  { look: 'button', label: 'Add notes…' },
)

const actions = useNoteActions()
const { full } = useNotesTree()
const open = ref(false)

function start(): void {
  open.value = true
}

function pick(ids: string[]): void {
  const notes = ids.map((id) => full.value.byId.get(id)).filter((n): n is Note => Boolean(n))
  if (notes.length) void actions.moveMany(notes, props.subject.id)
}

defineExpose({ start })
</script>

<template>
  <UiBtn
    v-if="look === 'button'"
    v-bind="$attrs"
    variant="ghost"
    size="md"
    icon="plus"
    :title="`Bring notes from My notes into ${subject.title}`"
    @click="start"
  >
    {{ label }}
  </UiBtn>
  <button
    v-else-if="look === 'row'"
    v-bind="$attrs"
    type="button"
    class="flex min-h-[30px] w-full cursor-pointer items-center gap-2 rounded-[10px] py-1 pr-2 pl-[26px] text-left text-text-muted transition-colors hover:bg-surface-mute hover:text-text focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cobalt max-lg:min-h-11"
    :title="`Bring notes from My notes into ${subject.title}`"
    @click="start"
  >
    <UiIcon
      name="plus"
      :size="13"
      :stroke="2.1"
      class="shrink-0"
    />
    <span class="min-w-0 flex-1 truncate text-[12.5px]">{{ label }}</span>
  </button>
  <button
    v-else-if="look === 'link'"
    v-bind="$attrs"
    type="button"
    class="cursor-pointer rounded-[4px] text-cobalt underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt"
    @click="start"
  >
    {{ label }}
  </button>

  <CompanionNotesPicker
    v-model:open="open"
    :title="`Add notes to ${subject.title}`"
    :confirm="`Add to ${subject.title}`"
    only-unfiled
    @pick="pick"
  />
</template>
