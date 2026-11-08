<script setup lang="ts">
/**
 * "Cards from Quizlet" (Daylight 2, landing 10 Connections): paste a set's
 * export and it comes in as flashcards in this course, due now. Quizlet has no
 * public API, so the modal says where the text is (the set's ⋯ → Export). A
 * front the course already has is kept as it is, so pasting twice adds nothing.
 * In a course shared with a class, the toast offers to give them to everyone.
 *
 * Placed by whoever owns the menu it opens from (a course's "+", the chat's
 * attach menu): `<CompanionImportsQuizletModal v-model:open="x" :subject-id="id" />`.
 */
import type { Uuid } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { importCards, parseCardList } from '~/companion/imports/quizlet'
import { shareCardsWithClass } from '~/companion/shares'

const props = defineProps<{ subjectId: Uuid | null }>()
const open = defineModel<boolean>('open', { default: false })

const c = useCompanion()
const toast = useToast()
const text = ref('')
const busy = ref(false)

watch(open, (now) => {
  if (now) text.value = ''
})

const cards = computed(() => parseCardList(text.value))
const place = computed(() => c.get('subjects', props.subjectId)?.title ?? 'My notes')

async function add(): Promise<void> {
  if (busy.value || !cards.value.length) return
  busy.value = true
  try {
    const { added, skipped, ids } = await importCards(c, cards.value, { subjectId: props.subjectId })
    open.value = false
    const shareId = c.get('subjects', props.subjectId)?.share_id ?? null
    toast.success({
      title: added ? `${added} ${added === 1 ? 'card' : 'cards'} added to ${place.value}` : 'Those cards were already here',
      body: skipped && added ? `${skipped} you already had stayed as they were.` : undefined,
      action: shareId && ids.length
        ? {
            label: 'Give them to the class',
            handler: () => void shareCardsWithClass(shareId, ids, 'Quizlet set')
              .then((n) => toast.success(`${n} cards merged into everyone's`))
              .catch(() => toast.error("Couldn't share them just now.")),
          }
        : undefined,
    })
  } catch {
    toast.error({ title: "Couldn't add the cards", body: 'Try again in a moment.' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UiModal
    v-model:open="open"
    title="Cards from Quizlet"
    description="Open the set on Quizlet, choose ⋯ then Export, copy the text and paste it here."
    size="lg"
  >
    <label
      for="cp-quizlet-paste"
      class="sr-only"
    >Quizlet export</label>
    <textarea
      id="cp-quizlet-paste"
      v-model="text"
      autofocus
      rows="10"
      placeholder="Proactive interference&#9;Old learning gets in the way of new"
      class="block max-h-[52vh] min-h-[200px] w-full resize-y rounded-[16px] border border-border-field bg-surface px-4 py-3 text-[14.5px] leading-relaxed text-text outline-none placeholder:text-text-faint focus:border-brand focus:ring-3 focus:ring-brand-line"
    />
    <template #footer>
      <span class="mr-auto text-[13px] text-text-muted">
        {{ cards.length ? `${cards.length} ${cards.length === 1 ? 'card' : 'cards'} for ${place}` : 'Nothing to add yet' }}
      </span>
      <UiBtn
        variant="ghost"
        @click="open = false"
      >
        Cancel
      </UiBtn>
      <UiBtn
        variant="primary"
        :disabled="!cards.length"
        :loading="busy"
        @click="add"
      >
        {{ cards.length ? `Add ${cards.length} ${cards.length === 1 ? 'card' : 'cards'}` : 'Add cards' }}
      </UiBtn>
    </template>
  </UiModal>
</template>
