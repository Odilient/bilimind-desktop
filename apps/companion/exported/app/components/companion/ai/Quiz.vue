<script setup lang="ts">
/**
 * "Quiz me", answered in the thread itself: one question at a time, the
 * answer behind a button so it is recalled before it is read, then the
 * learner's own verdict ("Got it" / "Missed it"). Recall first, then honest
 * self-marking: the two things that make practice stick, and nothing to
 * type on a phone.
 *
 * At the end it says the score in words and offers the one useful next
 * step: the questions that were missed, as cards, so they come back in
 * practice until they're held. Nothing is saved before that press.
 */
import { runAction, type ActionDone } from '~/companion/ai/actions'
import { madeFor, rememberMade } from '~/companion/ai/made'

const props = defineProps<{
  questions: { q: string; a: string }[]
  subjectId?: string | null
  topicId?: string | null
  /** The card's key in made.ts, so the missed ones are never added twice. */
  madeKey?: string | null
}>()

const toast = useToast()

const index = ref(0)
const shown = ref(false)
const marks = ref<('got' | 'missed')[]>([])
const saving = ref(false)
const missedKey = computed(() => (props.madeKey ? `${props.madeKey}:missed` : null))
const saved = ref<ActionDone | null>(madeFor(missedKey.value))
const root = ref<HTMLElement | null>(null)

const total = computed(() => props.questions.length)
const finished = computed(() => marks.value.length >= total.value)
const current = computed(() => props.questions[index.value] ?? null)
const got = computed(() => marks.value.filter((m) => m === 'got').length)
const missed = computed(() => props.questions.filter((_, i) => marks.value[i] === 'missed'))

const verdict = computed(() => {
  const share = got.value / Math.max(1, total.value)
  if (share === 1) return 'All of them. That one\'s held.'
  if (share >= 0.7) return 'Nearly there.'
  if (share >= 0.4) return 'Half held. The rest is worth another look.'
  return 'Early days for this one. That\'s what practice is for.'
})

function mark(value: 'got' | 'missed'): void {
  marks.value = [...marks.value, value]
  shown.value = false
  if (index.value < total.value - 1) {
    index.value += 1
    nextTick(() => root.value?.querySelector<HTMLElement>('[data-reveal]')?.focus())
  }
}

function again(): void {
  index.value = 0
  shown.value = false
  marks.value = []
  // A second round's misses are new cards to offer; the first round's stay made.
  saved.value = null
}

async function keepMissed(): Promise<void> {
  if (saving.value || !missed.value.length) return
  saving.value = true
  try {
    saved.value = await runAction(
      {
        type: 'create_cards',
        subject_id: props.subjectId ?? null,
        topic_id: props.topicId ?? null,
        cards: missed.value.map((x) => ({ front: x.q, back: x.a })),
      },
      { subjectId: props.subjectId ?? null },
    )
    // Only the first round's: a later round offers its own misses again.
    if (!madeFor(missedKey.value)) rememberMade(missedKey.value, saved.value)
  } catch (error) {
    toast.error({ title: 'The cards weren\'t added', body: (error as Error).message || 'Try again in a moment.' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section
    ref="root"
    class="overflow-hidden rounded-[14px] bg-surface shadow-[0_0_0_1px_var(--border-strong),var(--shadow-card)]"
    aria-label="Quiz"
  >
    <header class="flex items-center gap-2 px-3.5 pt-3">
      <span class="grid size-7 place-items-center rounded-[8px] bg-lilac-soft text-lilac-ink">
        <UiIcon
          name="quiz"
          :size="13"
          :stroke="2"
        />
      </span>
      <span class="text-[13px] font-semibold text-text">Quiz</span>
      <span
        v-if="!finished"
        class="num text-[12px] text-text-faint"
      >{{ index + 1 }} of {{ total }}</span>
      <span class="flex-1" />
      <!-- One dot a question: how far, and how it's going. -->
      <span
        class="flex items-center gap-1"
        aria-hidden="true"
      >
        <span
          v-for="(_, i) in questions"
          :key="i"
          :class="[
            'block size-1.5 rounded-full transition-colors duration-200',
            marks[i] === 'got'
              ? 'bg-leaf'
              : marks[i] === 'missed'
                ? 'bg-rose'
                : i === index && !finished
                  ? 'bg-text-soft'
                  : 'bg-surface-track',
          ]"
        />
      </span>
    </header>

    <div
      v-if="!finished && current"
      :key="index"
      class="animate-fade px-3.5 pt-2.5 pb-3.5"
    >
      <p class="text-[14.5px] leading-[1.5] font-semibold text-text">
        {{ current.q }}
      </p>

      <div
        v-if="shown"
        class="animate-fade mt-2.5 rounded-[12px] bg-surface-sunken px-3 py-2.5 text-[13.5px] leading-[1.55] text-text-body"
        aria-live="polite"
      >
        {{ current.a }}
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <UiBtn
          v-if="!shown"
          data-reveal
          size="sm"
          @click="shown = true"
        >
          Show the answer
        </UiBtn>
        <template v-else>
          <UiBtn
            size="sm"
            variant="primary"
            icon="check"
            @click="mark('got')"
          >
            Got it
          </UiBtn>
          <UiBtn
            size="sm"
            variant="ghost"
            @click="mark('missed')"
          >
            Missed it
          </UiBtn>
        </template>
        <span
          v-if="!shown"
          class="text-[12px] text-text-faint"
        >Answer it in your head first</span>
      </div>
    </div>

    <div
      v-else
      class="animate-fade px-3.5 pt-2 pb-3.5"
    >
      <p class="font-display text-[20px] font-semibold tracking-[-0.02em] text-text">
        {{ got }} of {{ total }}
      </p>
      <p class="mt-0.5 text-[13px] text-text-soft">
        {{ verdict }}
      </p>

      <ul
        v-if="missed.length"
        class="mt-3 grid gap-1.5"
      >
        <li
          v-for="(x, i) in missed"
          :key="i"
          class="rounded-[12px] bg-surface-sunken px-3 py-2 text-[12.5px] leading-[1.5]"
        >
          <span class="font-semibold text-text">{{ x.q }}</span>
          <span class="block text-text-soft">{{ x.a }}</span>
        </li>
      </ul>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <template v-if="missed.length">
          <UiBtn
            v-if="!saved"
            size="sm"
            variant="primary"
            icon="cards"
            :loading="saving"
            @click="keepMissed"
          >
            Make cards of the {{ missed.length === 1 ? 'one' : missed.length }} I missed
          </UiBtn>
          <span
            v-else
            class="inline-flex items-center gap-1.5 text-[13px] font-semibold text-success-text"
          >
            <UiIcon
              name="check-circle"
              :size="15"
            />
            {{ saved.label }}
            <NuxtLink
              v-if="saved.to"
              :to="saved.to"
              class="ml-1 text-brand underline-offset-4 hover:underline"
            >Practise</NuxtLink>
          </span>
        </template>
        <UiBtn
          size="sm"
          variant="ghost"
          icon="refresh"
          @click="again"
        >
          Again
        </UiBtn>
      </div>
    </div>
  </section>
</template>
