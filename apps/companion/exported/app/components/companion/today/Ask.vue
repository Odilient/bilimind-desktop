<script setup lang="ts">
/**
 * Today's question: the chat's own box, and the chat's "Choose what to
 * make" tiles under it as one row. Anything asked here opens in the chat
 * (`newChatLink({ q, attach })`), a new chat with the question already
 * sent, where a long answer, a quiz or a course draft has room. Today never
 * answers in place: one place to talk, one place to see the day.
 *
 * The words are this box's own, not the shared draft, so the dock beside
 * the page never mirrors them or takes the caret. A tile writes its words
 * here (`@pick`, "Create a quiz on "). The tray is the shared one
 * (`useAiAttachments()`): a file dropped here uploads at once into My notes
 * and goes with the question by its id.
 * The keys are the chat's: Enter sends, Shift+Enter is a new line.
 *
 * Quiet AI leaves the whole thing out (the page decides).
 */
import { useAiAttachments } from '~/companion/ai/attach'
import { newChatLink } from '~/companion/ai/routes'
import { withWords, type MakeTile } from '~/companion/ai/make'

const { t } = useI18n()
const tray = useAiAttachments()
const draft = ref('')
const box = ref<{ focus: () => void } | null>(null)
const root = ref<HTMLElement | null>(null)

function send(text: string): void {
  draft.value = ''
  // The box holds a send until its files are up, so each has its item by now.
  const attach = tray.tray.value.flatMap((a) =>
    a.kind === 'note' ? [a.itemId] : a.kind === 'file' && a.itemId ? [a.itemId] : [],
  )
  void navigateTo(newChatLink({ q: text, attach }))
}

function pick(tile: MakeTile): void {
  draft.value = withWords(tile, draft.value)
  box.value?.focus()
}

/** Get set up's "Ask": the box, brought into view with the caret in it. */
function focus(): void {
  root.value?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  box.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <section
    ref="root"
    :aria-label="t('today.ask.label')"
  >
    <CompanionAiComposer
      ref="box"
      v-model="draft"
      size="lg"
      menu-placement="down"
      :placeholder="t('today.ask.placeholder')"
      @send="send"
    />
    <CompanionAiMakeTray
      variant="row"
      class="mt-3"
      @pick="pick"
    />
  </section>
</template>
