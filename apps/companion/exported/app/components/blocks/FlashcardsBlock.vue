<script setup lang="ts">
import type { Flashcard, FlashcardsBlock } from '~/types/api'
import BlockShell from './BlockShell.vue'

/**
 * A real deck: turn over (a fade, never a 3D flip), next/previous, shuffle, and a "got it / again" pass that
 * re-queues the cards the learner missed. Fully keyboard driven once focused —
 * space flips, arrows move, S shuffles.
 */
const props = defineProps<{ block: FlashcardsBlock }>()

const cards = computed<Flashcard[]>(() =>
  (props.block.payload?.cards ?? [])
    .filter((card): card is Flashcard => Boolean(card) && typeof card === 'object')
    .map((card) => ({
      front: String(card.front ?? '').trim(),
      back: String(card.back ?? '').trim(),
    }))
    .filter((card) => card.front !== '' || card.back !== ''),
)

/** Indexes into `cards`, in the current (possibly shuffled) study order. */
const order = ref<number[]>([])
const cursor = ref(0)
const flipped = ref(false)
const known = ref<Set<number>>(new Set())
const shuffled = ref(false)

function reset(): void {
  order.value = cards.value.map((_, index) => index)
  cursor.value = 0
  flipped.value = false
  known.value = new Set()
  shuffled.value = false
}

watch(cards, reset, { immediate: true })

const total = computed(() => order.value.length)
const currentIndex = computed(() => order.value[cursor.value] ?? 0)
const current = computed<Flashcard | null>(() => cards.value[currentIndex.value] ?? null)
const isKnown = computed(() => known.value.has(currentIndex.value))
const progress = computed(() => (total.value === 0 ? 0 : (known.value.size / total.value) * 100))

function flip(): void {
  flipped.value = !flipped.value
}

function go(step: number): void {
  if (total.value === 0) return
  cursor.value = (cursor.value + step + total.value) % total.value
  flipped.value = false
}

function shuffle(): void {
  const next = [...order.value]

  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j] as number, next[i] as number]
  }

  order.value = next
  cursor.value = 0
  flipped.value = false
  shuffled.value = true
}

function mark(good: boolean): void {
  const next = new Set(known.value)

  if (good) next.add(currentIndex.value)
  else next.delete(currentIndex.value)

  known.value = next
  go(1)
}

function onKeydown(event: KeyboardEvent): void {
  const key = event.key

  if (key === ' ' || key === 'Enter') {
    event.preventDefault()
    flip()
    return
  }

  if (key === 'ArrowRight') {
    event.preventDefault()
    go(1)
    return
  }

  if (key === 'ArrowLeft') {
    event.preventDefault()
    go(-1)
    return
  }

  if (key === 's' || key === 'S') {
    event.preventDefault()
    shuffle()
    return
  }

  if (key === 'k' || key === 'K') {
    event.preventDefault()
    mark(true)
  }
}
</script>

<template>
  <BlockShell
    :type="block.type"
    :source-material-ids="block.source_material_ids"
  >
    <template #actions>
      <span
        v-if="total"
        class="num inline-flex h-6 items-center rounded-full bg-[rgb(var(--wash-rgb)/0.065)] px-2.5 text-[12px] font-semibold text-text-soft"
        >{{ known.size }}/{{ total }} known</span
      >
      <UiBtn
        v-if="total > 1"
        variant="ghost"
        size="xs"
        icon="refresh"
        @click="shuffle"
      >
        Shuffle
      </UiBtn>
    </template>

    <div
      v-if="current"
      class="flex flex-col gap-3"
    >
      <div
        class="deck relative outline-none"
        role="group"
        tabindex="0"
        :aria-label="`Flashcard ${cursor + 1} of ${total}. Space flips, arrows move, S shuffles.`"
        @keydown="onKeydown"
      >
        <button
          type="button"
          class="block w-full text-left"
          :aria-pressed="flipped"
          :aria-label="flipped ? 'Show the question' : 'Show the answer'"
          @click="flip"
        >
          <!-- Daylight's card (course.css .fcard): the question on the card, the answer on sky.
               Turning one over fades and slides the other in; nothing flips in 3D. -->
          <div
            class="card-inner grid min-h-44 w-full"
            :class="flipped && 'is-flipped'"
          >
            <div
              class="face face-front grid min-h-44 place-items-center rounded-[13px] bg-surface px-6 py-10 text-center shadow-[0_0_0_1px_var(--border-strong),var(--shadow-card)]"
              :aria-hidden="flipped"
            >
              <span class="absolute top-3.5 left-4 text-[11.5px] font-semibold text-text-muted">Question</span>
              <p
                class="max-w-[460px] font-display text-[21px] leading-[1.2] font-semibold tracking-[-0.02em] text-balance text-text"
              >
                {{ current.front || '—' }}
              </p>
              <span class="absolute bottom-3.5 text-[11.5px] text-text-faint">Click, or press space, to turn it over</span>
            </div>

            <div
              class="face face-back grid min-h-44 place-items-center rounded-[13px] bg-sky-soft px-6 py-10 text-center shadow-[0_0_0_1px_var(--border),var(--shadow-card)]"
              :aria-hidden="!flipped"
            >
              <span class="absolute top-3.5 left-4 text-[11.5px] font-semibold text-sky-ink">Answer</span>
              <p class="max-w-[480px] text-[16px] leading-relaxed font-medium text-text text-balance">
                {{ current.back || '—' }}
              </p>
              <span class="absolute bottom-3.5 text-[11.5px] text-text-muted">Press K to mark it known</span>
            </div>
          </div>
        </button>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <UiBtn
            variant="secondary"
            size="sm"
            square
            icon="chevron-left"
            label="Previous card"
            @click="go(-1)"
          />
          <span class="num min-w-16 text-center font-display text-[13px] font-semibold text-text-soft">
            {{ cursor + 1 }} / {{ total }}
          </span>
          <UiBtn
            variant="secondary"
            size="sm"
            square
            icon="chevron-right"
            label="Next card"
            @click="go(1)"
          />
        </div>

        <div class="flex items-center gap-1.5">
          <UiBtn
            variant="ghost"
            size="sm"
            icon="refresh"
            @click="mark(false)"
          >
            Again
          </UiBtn>
          <UiBtn
            :variant="isKnown ? 'success' : 'secondary'"
            size="sm"
            icon="check"
            @click="mark(true)"
          >
            Got it
          </UiBtn>
        </div>
      </div>

      <div
        class="h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--wash-rgb)/0.065)]"
        role="progressbar"
        :aria-valuenow="Math.round(progress)"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div
          class="h-full rounded-full bg-leaf transition-[width] duration-300"
          :style="{ width: `${progress}%` }"
        />
      </div>

      <p
        v-if="shuffled"
        class="text-[11.5px] text-text-faint"
      >
        Deck shuffled.
        <button
          type="button"
          class="font-semibold text-brand hover:underline"
          @click="reset"
        >
          Restore original order
        </button>
      </p>
    </div>

    <p
      v-else
      class="text-[13px] text-text-faint italic"
    >
      This deck came back empty.
    </p>
  </BlockShell>
</template>

<style scoped>
/* Both faces sit in one grid cell; the one in front fades and slides in. */
.face {
  position: relative;
  grid-area: 1 / 1;
  transition:
    opacity 0.3s var(--ease),
    transform 0.45s var(--ease),
    visibility 0s;
}

.face-back,
.card-inner.is-flipped .face-front {
  opacity: 0;
  visibility: hidden;
  transform: translateY(8px);
  transition:
    opacity 0.2s var(--ease),
    transform 0.3s var(--ease),
    visibility 0s 0.3s;
}

.card-inner.is-flipped .face-back {
  opacity: 1;
  visibility: visible;
  transform: none;
  transition:
    opacity 0.3s var(--ease),
    transform 0.45s var(--ease),
    visibility 0s;
}

.card-inner.is-flipped .face-front {
  transform: translateY(-8px);
}

.deck:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 4px;
  border-radius: 13px;
}

@media (prefers-reduced-motion: reduce) {
  .face {
    transition: none !important;
    transform: none !important;
  }
}
</style>
