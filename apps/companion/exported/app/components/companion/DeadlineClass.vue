<script setup lang="ts">
/**
 * "Your class" on a deadline's page: how the learners on BiliMind with the
 * same assessment are doing, as anonymous numbers.
 *
 *   <CompanionDeadlineClass :deadline="deadline" />
 *
 * Not a chat, not a feed, and never a person: no avatars, no names, no list
 * of who is here. A class is a layer of counts over the learner's own
 * readiness, and it has to be useful with one member, so every state ends in
 * the one thing that makes it better, "Invite your class" (the share sheet
 * where there is one, else the text and link copied for the class chat
 * they already have).
 *
 * The server decides what may be shown (`ClassView`): numbers only from 5
 * learners who share, and only to a learner who shares too. A course that
 * can't be matched to classmates (`possible` false: not from an LMS, not a
 * standard exam), or a class that didn't load, draws nothing at all; the
 * page is complete without it. Turning sharing on in Settings loads it
 * again, so the numbers appear without a reload.
 */
import type { ClassView, Deadline } from '~/companion/types'
import { useCompanion } from '~/companion/store'

const props = defineProps<{ deadline: Deadline }>()

const c = useCompanion()
const auth = useAuth()
const toast = useToast()

const view = ref<ClassView | null>(null)

async function load(): Promise<void> {
  const id = props.deadline.id
  try {
    const next = await c.repo().classOf(id)
    if (id === props.deadline.id) view.value = next
  } catch {
    if (id === props.deadline.id) view.value = null
  }
}

watch(() => props.deadline.id, load, { immediate: true })
watch(() => auth.user.value?.preferences?.companion?.share_results, load)

const shown = computed(() => (view.value?.possible ? view.value : null))

/** "12 classmates are preparing for it.", "Most are about 55% ready.", "Hardest so far: …". */
const numbers = computed(() => {
  const v = shown.value
  if (!v?.shown || !v.sharing) return []
  const lines: string[] = []
  if (v.preparing != null) {
    lines.push(v.preparing === 1 ? '1 classmate is preparing for it.' : `${v.preparing} classmates are preparing for it.`)
  }
  if (v.readiness_median != null) lines.push(`Most are about ${v.readiness_median}% ready.`)
  const hard = v.hardest.map((h, i) => (i === 0 ? `${h.title} (missed by ${h.missed_pct}%)` : `${h.title} (${h.missed_pct}%)`))
  if (hard.length) lines.push(`Hardest so far: ${hard.join(', ')}.`)
  return lines
})

/** Not enough of the class here yet to show anything about it. */
const waiting = computed(() => {
  const v = shown.value
  if (!v || v.shown || !v.sharing) return null
  if (v.members <= 1) {
    return 'Studying with classmates? When 5 of you are here, you\'ll see how ready the class is and which topics it finds hardest.'
  }
  // Enough people, but not 5 of them sharing: say what the number waits for.
  if (v.members >= 5) return `${v.members} of you are on BiliMind for this. Class numbers show once 5 of you share results.`
  return `${v.members} of you are on BiliMind for this. Class numbers show from 5.`
})

async function invite(): Promise<void> {
  const card = shown.value?.invite
  if (!card) return
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: card.title, text: card.text, url: card.url })
      return
    } catch (error) {
      // Closing the share sheet is a choice, not a failure.
      if ((error as Error).name === 'AbortError') return
    }
  }
  try {
    await navigator.clipboard.writeText(`${card.text} ${card.url}`)
    toast.success('Copied. Paste it in your class chat.')
  } catch {
    toast.error({ title: 'Copying isn\'t allowed here', body: `The link to send: ${card.url}` })
  }
}
</script>

<template>
  <CompanionBox
    v-if="shown"
    label="Your class"
  >
    <div class="grid gap-1 text-[15px] leading-relaxed text-text-soft">
      <p v-if="!shown.sharing">
        You're not sharing your results, so class numbers stay hidden.
        <NuxtLink
          to="/app/settings?section=preferences"
          class="font-semibold text-text underline decoration-border-field underline-offset-4 hover:decoration-current"
        >
          Turn it on in Settings
        </NuxtLink>.
      </p>
      <template v-else-if="numbers.length">
        <p
          v-for="line in numbers"
          :key="line"
        >
          {{ line }}
        </p>
      </template>
      <p v-else-if="waiting">
        {{ waiting }}
      </p>
    </div>
    <UiBtn
      variant="secondary"
      class="mt-2 justify-self-start"
      @click="invite"
    >
      Invite your class
    </UiBtn>
  </CompanionBox>
</template>
