<script setup lang="ts">
import type { Item } from '~/companion/types'
import { suggestionOf, useNoteActions } from '~/companion/notes/actions'
import { courseColor } from '~/companion/colors'
import { useCompanion } from '~/companion/store'

/**
 * "Add to Databases?": the one question a note in My notes may ask, in its
 * header, when it was made somewhere a course was obvious (during that
 * course's class, or with the course open). One tap files it there (under
 * the class too), with Undo in the toast; ✕ forgets the question on this
 * note for good. Until one of those, the note stays exactly where it is.
 *
 * Quiet on purpose: the sunken grey of a chip, the course's dot, no colour
 * fill, so it reads as an offer and never as an alert. `compact` is the
 * phone's header, where the course's name is allowed to run short.
 */
const props = withDefaults(defineProps<{ item: Item; compact?: boolean }>(), { compact: false })

const store = useCompanion()
const actions = useNoteActions()
const suggestion = computed(() => suggestionOf(store, props.item))
const busy = ref(false)

const why = computed(() => {
  const s = suggestion.value
  if (!s) return ''
  return s.session
    ? `Made during ${s.session.title}. File it in ${s.subject.title}, under that class.`
    : `Made with ${s.subject.title} open. File it there.`
})

async function accept(): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    await actions.acceptSuggestion(props.item)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0 translate-y-0.5"
    leave-active-class="transition duration-150 ease-in"
    leave-to-class="opacity-0"
  >
    <span
      v-if="suggestion"
      :class="[
        'inline-flex min-w-0 shrink items-center rounded-full bg-surface-sunken text-text-soft',
        compact ? 'h-9' : 'h-7',
      ]"
    >
      <button
        type="button"
        :disabled="busy"
        :title="why"
        :class="[
          'flex min-w-0 cursor-pointer items-center gap-1.5 self-stretch rounded-l-full pr-1 font-medium transition-colors duration-150 outline-none hover:bg-surface-track hover:text-text focus-visible:shadow-[inset_0_0_0_2px_var(--cobalt)] disabled:cursor-wait',
          compact ? 'pl-3 text-[13.5px]' : 'pl-2.5 text-[12.5px]',
        ]"
        @click="accept"
      >
        <span
          class="size-2 shrink-0 rounded-full"
          :style="{ background: courseColor(suggestion.subject.color) }"
        />
        <span class="shrink-0">Add to</span>
        <span class="min-w-0 truncate">{{ suggestion.subject.title }}?</span>
      </button>
      <button
        type="button"
        :class="[
          'grid shrink-0 cursor-pointer place-items-center self-stretch rounded-r-full text-text-faint transition-colors duration-150 outline-none hover:bg-surface-track hover:text-text focus-visible:shadow-[inset_0_0_0_2px_var(--cobalt)]',
          compact ? 'w-9' : 'w-7',
        ]"
        :aria-label="`Keep it out of ${suggestion.subject.title}`"
        title="Keep it in My notes, and don't ask again"
        @click="actions.dismissSuggestion(item)"
      >
        <UiIcon
          name="x"
          :size="compact ? 14 : 12"
          :stroke="2.2"
        />
      </button>
    </span>
  </Transition>
</template>
