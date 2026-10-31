<script setup lang="ts">
/**
 * Practice: a spaced-repetition session over the cards in scope — one
 * deadline's topics (`?deadline=`), one course (`?subject=`), or everything
 * due. FSRS runs here with ts-fsrs, so a review on the bus with no signal is
 * still a review; the server stores what the client computed.
 *
 * The screen is one card, big, and nothing else to read: what it's for and
 * how far along at the top, the question in the display face, the answer
 * under a hairline once asked for, and the buttons low where the thumb is.
 * "Show the answer" is the one button until the answer is out; then four
 * plain answers ("Again", "Hard", "Good", "Easy"), each saying when the card
 * comes back, under the question they answer: how well did you remember it?
 *
 * The queue is fixed when the session starts, so cards don't reshuffle under
 * the learner's thumb. "Again" sends a card to the back once. The end says
 * what the session did. Readiness is made of checks now,
 * so practice alone rarely moves it: the readiness line shows only when the
 * words did change, and the end says instead when these topics can next be
 * checked ("Your next check on these opens Saturday"), because practising
 * them is studying them, and a check only counts once they have gone cold.
 * It used to say readiness with a ring.
 *
 * Keys: Space shows the answer; 1–4 rate it.
 */
import type { Card, Readiness } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { readyWords } from '~/companion/words'
import { courseColor } from '~/companion/colors'
import { dueCardsFor } from '~/companion/readiness'
import { nextCheckOpens } from '~/companion/checks'
import { dayWord } from '~/companion/today-layout'
import { RATINGS, intervals, type RatingValue } from '~/companion/fsrs'

definePageMeta({ layout: 'companion' })

const route = useRoute()
const c = useCompanion()

const deadlineId = computed(() => (route.query.deadline ? String(route.query.deadline) : null))
const subjectId = computed(() => (route.query.subject ? String(route.query.subject) : null))
const deadline = computed(() => c.get('deadlines', deadlineId.value))
const scopeSubject = computed(() => c.get('subjects', subjectId.value) ?? c.subjectOf(deadline.value))

const queue = ref<string[]>([])
const index = ref(0)
const revealed = ref(false)
const started = ref(false)
const startedAt = ref(0)
const ratings = ref<RatingValue[]>([])
const requeued = new Set<string>()
const before = ref<Readiness | null>(null)
const after = ref<Readiness | null>(null)
const busy = ref(false)

function scopeCards(): Card[] {
  const until = Date.now() + 86_400_000
  if (deadline.value) return dueCardsFor(deadline.value.topic_ids, c.cards.value, until)
  return c.cards.value
    .filter((k) => !k.suspended && Date.parse(k.due_at) <= Date.now() && (!subjectId.value || k.subject_id === subjectId.value))
    .sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at))
}

async function start(): Promise<void> {
  await c.load()
  queue.value = scopeCards().slice(0, 40).map((k) => k.id)
  index.value = 0
  revealed.value = false
  ratings.value = []
  startedAt.value = Date.now()
  started.value = true
  if (deadline.value) {
    try {
      before.value = await c.repo().readiness(deadline.value.id)
    } catch {
      before.value = c.readinessOf(deadline.value)
    }
  }
}
onMounted(start)
watch([deadlineId, subjectId], start)

const card = computed(() => c.get('cards', queue.value[index.value]))
const topic = computed(() => c.get('topics', card.value?.topic_id))
const cardSubject = computed(() => c.subjectOf(card.value))
const done = computed(() => started.value && queue.value.length > 0 && index.value >= queue.value.length)
const preview = computed(() => (card.value ? intervals(card.value) : null))

async function rate(value: RatingValue): Promise<void> {
  if (!card.value || !revealed.value || busy.value) return
  busy.value = true
  const id = card.value.id
  try {
    await c.reviewCard(id, value)
    ratings.value.push(value)
    if (value === 1 && !requeued.has(id)) {
      requeued.add(id)
      queue.value.push(id)
    }
    index.value++
    revealed.value = false
    if (index.value >= queue.value.length) await finish()
  } finally {
    busy.value = false
  }
}

async function finish(): Promise<void> {
  if (!deadline.value) return
  try {
    after.value = await c.repo().readiness(deadline.value.id)
  } catch {
    after.value = c.readinessOf(deadline.value)
  }
}

function onKey(event: KeyboardEvent): void {
  const el = event.target as HTMLElement | null
  if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA'].includes(el.tagName))) return
  if (event.code === 'Space' && !revealed.value && card.value) {
    event.preventDefault()
    revealed.value = true
    return
  }
  const r = RATINGS.find((x) => x.key === event.key)
  if (r && revealed.value) void rate(r.value)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const reviewed = computed(() => ratings.value.length)
const minutes = computed(() => Math.max(1, Math.round((Date.now() - startedAt.value) / 60_000)))
const remembered = computed(() => ratings.value.filter((r) => r >= 3).length)
const scopeLabel = computed(() => deadline.value?.title ?? scopeSubject.value?.title ?? 'everything due')
const heading = computed(() => (deadline.value || scopeSubject.value ? `Cards for ${scopeLabel.value}` : 'Cards due today'))

/** Readiness in words, the checks' way: a deadline nobody has checked says so. */
function words(r: Readiness): string {
  return readyWords(r.checked ? r.percent : null)
}
const moved = computed(() => (before.value && after.value ? words(before.value) !== words(after.value) : false))

/** When the topics just practised can next be checked; null once they can be now. */
const opens = computed(() => {
  if (!done.value) return null
  const topics = new Set(queue.value.map((id) => c.get('cards', id)?.topic_id).filter((t): t is string => Boolean(t)))
  const at = nextCheckOpens(c, [...topics])
  return at && Date.parse(at) > Date.now() ? dayWord(at) : null
})

const backTo = computed(() => (deadline.value ? `/app/d/${deadline.value.id}` : scopeSubject.value ? `/app/courses/${scopeSubject.value.id}?tab=practice` : '/app'))
</script>

<template>
  <div class="mx-auto flex w-full max-w-[760px] flex-1 flex-col px-4 pt-4 pb-6 min-[900px]:px-8 min-[900px]:pt-10 min-[900px]:pb-12">
    <header class="mb-6 flex items-center gap-2">
      <NuxtLink
        :to="backTo"
        class="-ml-2 grid size-11 shrink-0 place-items-center rounded-full text-text-muted transition-colors hover:bg-surface-mute hover:text-text"
        aria-label="Stop practising"
        title="Stop"
      >
        <CompanionIcon
          name="x"
          :size="20"
        />
      </NuxtLink>
      <div class="grid min-w-0 flex-1 gap-2">
        <p class="flex items-baseline justify-between gap-3">
          <span class="truncate text-[15px] font-semibold text-text">{{ heading }}</span>
          <span
            v-if="queue.length && !done"
            class="shrink-0 text-[14px] text-text-muted"
          >{{ Math.min(index + 1, queue.length) }} of {{ queue.length }}</span>
        </p>
        <span
          class="h-1.5 overflow-hidden rounded-full bg-surface-track"
          aria-hidden="true"
        >
          <span
            class="block h-full rounded-full bg-inverse transition-[width] duration-300"
            :style="{ width: `${queue.length ? (index / queue.length) * 100 : 0}%` }"
          />
        </span>
      </div>
    </header>

    <div
      v-if="!started"
      class="cp-skel h-[360px] rounded-[24px]"
      aria-busy="true"
    />

    <section
      v-else-if="!queue.length"
      class="grid justify-items-center gap-3 py-16 text-center"
    >
      <h1 class="t-head text-[26px]">
        Nothing to review here
      </h1>
      <p class="max-w-[440px] text-[15px] leading-relaxed text-text-muted">
        Every card is resting until its next date. That's the point: you'll see each one again
        just before you'd forget it.
      </p>
      <UiBtn
        :to="backTo"
        variant="secondary"
        size="lg"
        class="mt-2"
      >
        {{ deadline ? `Back to ${deadline.title}` : 'Back' }}
      </UiBtn>
    </section>

    <!-- The end: what the session did. -->
    <section
      v-else-if="done"
      class="grid justify-items-center gap-3 py-16 text-center"
    >
      <h1 class="t-head text-[30px]">
        Done for now
      </h1>
      <p
        v-if="deadline && before && after && moved"
        class="text-[18px] font-medium text-text"
      >
        {{ deadline.title }}: {{ words(before) }} → {{ words(after) }}
      </p>
      <p class="max-w-[440px] text-[15px] leading-relaxed text-text-muted">
        {{ reviewed }} answers in about {{ minutes }} min, {{ remembered }} remembered.
        Each card comes back on its own schedule, just before you'd forget it.
      </p>
      <p
        v-if="opens"
        class="max-w-[440px] text-[15px] leading-relaxed text-text"
      >
        Your next check on these opens {{ opens }}.
      </p>
      <div class="mt-3 flex flex-wrap justify-center gap-2">
        <UiBtn
          :to="backTo"
          variant="primary"
          size="lg"
        >
          {{ deadline ? `Back to ${deadline.title}` : 'Done' }}
        </UiBtn>
        <UiBtn
          to="/app"
          variant="secondary"
          size="lg"
        >
          Today
        </UiBtn>
      </div>
    </section>

    <!-- One card. -->
    <template v-else-if="card">
      <article
        class="grid min-h-[340px] content-start gap-5 rounded-[24px] border border-border bg-surface p-6 min-[900px]:min-h-[400px] min-[900px]:p-10"
        :aria-live="revealed ? 'polite' : 'off'"
      >
        <p class="flex min-w-0 items-center gap-2 text-[14px] text-text-muted">
          <span
            class="size-2 shrink-0 rounded-full"
            :style="{ background: courseColor(cardSubject?.color) }"
          />
          <span class="truncate">{{ topic?.title ?? cardSubject?.title }}</span>
        </p>
        <h1 class="t-head text-[26px] leading-snug min-[900px]:text-[34px]">
          {{ card.front }}
        </h1>
        <template v-if="revealed">
          <hr class="border-border-rule">
          <p class="text-[18px] leading-relaxed text-text-body min-[900px]:text-[20px]">
            {{ card.back }}
          </p>
          <p
            v-if="card.source_quote"
            class="text-[14px] text-text-muted"
          >
            From {{ card.source_quote }}
          </p>
        </template>
      </article>

      <!-- Low on a phone, where the thumb already is. -->
      <div class="mt-auto pt-5 min-[900px]:mt-6 min-[900px]:pt-0">
        <template v-if="!revealed">
          <UiBtn
            variant="primary"
            size="lg"
            block
            @click="revealed = true"
          >
            Show the answer
          </UiBtn>
          <p class="mt-3 hidden text-center text-[14px] text-text-muted min-[900px]:block">
            or press Space
          </p>
        </template>
        <div
          v-else
          class="grid gap-3"
        >
          <p
            id="rate-q"
            class="text-center text-[15px] font-medium text-text"
          >
            How well did you remember it?
          </p>
          <div
            class="grid grid-cols-4 gap-2"
            role="group"
            aria-labelledby="rate-q"
          >
            <button
              v-for="r in RATINGS"
              :key="r.value"
              type="button"
              class="grid min-h-[68px] place-items-center content-center gap-0.5 rounded-[18px] border px-1 py-2 text-[16px] font-semibold transition-colors disabled:opacity-50"
              :class="r.value === 3 ? 'border-transparent bg-ink text-white hover:bg-ink-2' : r.value === 1 ? 'border-transparent bg-coral-soft text-coral-text hover:bg-[#ffd9cc]' : 'border-border-strong bg-surface text-text hover:bg-surface-mute'"
              :disabled="busy"
              :aria-keyshortcuts="r.key"
              @click="rate(r.value)"
            >
              {{ r.label }}
              <span
                class="text-[13px] font-medium"
                :class="r.value === 3 ? 'text-paper-3' : 'opacity-75'"
              >in {{ preview?.[r.value] }}</span>
            </button>
          </div>
          <p class="hidden text-center text-[14px] text-text-muted min-[900px]:block">
            "In 10 min" is when you'll see the card again. Keys 1 to 4 work too.
          </p>
        </div>
      </div>
    </template>
  </div>
</template>
