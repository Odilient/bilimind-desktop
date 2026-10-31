<script setup lang="ts">
import type { Flashcard, FlashcardsBlock } from '~/types/api'
import BlockShell from './BlockShell.vue'

/**
 * A real deck: flip, next/previous, shuffle, and a "got it / again" pass that
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
        class="num inline-flex h-6 items-center rounded-full bg-surface-sunken px-2.5 text-[11.5px] font-semibold text-text-soft"
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
          <div
            class="card-inner relative min-h-48 w-full"
            :class="flipped && 'is-flipped'"
          >
            <!-- The question on a small cobalt slab (gradient, beams, grain), the
                 answer on lime: two faces you could tell apart across a room. -->
            <div
              class="face cb-cobalt relative isolate grid min-h-48 place-items-center overflow-hidden rounded-[20px] px-6 py-10 text-center shadow-[0_24px_40px_-24px_rgb(20_40_200/0.55)]"
            >
              <span class="cb-beams" />
              <span class="cb-grain" />
              <span
                class="absolute top-3.5 left-4 rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-white/80 ring-1 ring-white/20"
                >FRONT</span
              >
              <p
                class="relative max-w-[460px] font-display text-[22px] leading-snug font-semibold tracking-[-0.02em] text-balance text-white"
              >
                {{ current.front || '—' }}
              </p>
              <span class="absolute bottom-3.5 text-[11px] text-white/60"
                >click, or press space, to flip</span
              >
            </div>

            <div
              class="face face-back absolute inset-0 grid min-h-48 place-items-center rounded-[20px] bg-lime px-6 py-10 text-center"
            >
              <span
                class="absolute top-3.5 left-4 rounded-full bg-ink px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-lime"
                >BACK</span
              >
              <p class="max-w-[480px] text-[16.5px] leading-relaxed font-medium text-ink text-balance">
                {{ current.back || '—' }}
              </p>
              <span class="absolute bottom-3.5 text-[11px] text-ink/60"
                >press K to mark it known</span
              >
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
        class="h-1.5 w-full overflow-hidden rounded-full bg-surface-track"
        role="progressbar"
        :aria-valuenow="Math.round(progress)"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div
          class="h-full rounded-full bg-lime-2 transition-[width] duration-300"
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
.deck {
  perspective: 1400px;
}

.card-inner {
  transform-style: preserve-3d;
  transition: transform 0.45s cubic-bezier(0.16, 0.84, 0.44, 1);
}

.card-inner.is-flipped {
  transform: rotateX(180deg);
}

.face {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.face-back {
  transform: rotateX(180deg);
}

.deck:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 4px;
  border-radius: var(--radius-lg);
}

@media (prefers-reduced-motion: reduce) {
  .card-inner {
    transition: none;
  }
}
</style>
