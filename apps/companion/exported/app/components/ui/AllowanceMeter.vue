<script setup lang="ts">
import type { MeterAllowance } from '~/types/api'

/**
 * What is left on one meter, drawn in the app's own ink.
 *
 * THE UNIT GLYPH IS THE ROADMAP NODE. Not a coin, which says money at the moment
 * somebody is deciding whether to study — and which implies these can be earned,
 * a promise the product does not keep. Not a star, which is a rating and a
 * bookmark everywhere else on the web, so a number beside one reads as a score.
 * A lesson looks like a node in this app, and a row of nodes emptying out is
 * progress along a path, which is the one visual idea the whole product rests on.
 *
 * The representation follows the number rather than fighting it. Twelve free
 * lessons are twelve countable things, so they are twelve dots and you can see at
 * a glance that three are gone. A hundred and fifty is not countable at a glance
 * and never will be, so it becomes one continuous track at the node's own corner
 * radius — same ink, same shape language, an honest read of a proportion instead
 * of a wall of specks nobody can count.
 *
 * Top-ups are drawn as a SEPARATE run after the plan's, never merged into it.
 * They behave differently — bought, carried over, given at signup or set for a
 * centre's pilot, and they outlive the month — and one blended bar would hide
 * the part somebody paid for.
 */
const props = withDefaults(
  defineProps<{
    allowance: MeterAllowance | null
    /** Plural noun for the thing counted, e.g. `lessons`. */
    unit: string
    /** Heading. Falls back to the unit, capitalised. */
    label?: string
    icon?: string
    /** Drop the heading row and the caption — for the point of action. */
    compact?: boolean
  }>(),
  { label: undefined, icon: 'node', compact: false },
)

/** Above this the dots stop being countable and become a track. */
const DOTS_MAX = 24

const metered = computed(() => Boolean(props.allowance?.metered))

const limit = computed(() => props.allowance?.plan_limit ?? 0)
const used = computed(() => Math.min(props.allowance?.plan_used ?? 0, limit.value))
const planLeft = computed(() => props.allowance?.plan_remaining ?? 0)
const topup = computed(() => props.allowance?.topup_remaining ?? 0)
const total = computed(() => props.allowance?.remaining ?? 0)

/**
 * The signup gift, named apart from anything bought. It sits inside `topup`
 * (it is a top-up row and is spent like one), but "50 topped up" to somebody
 * who has never paid reads like a mistake — and its deadline is the one fact
 * about it worth knowing.
 */
const starter = computed(() => Math.min(props.allowance?.starter_remaining ?? 0, topup.value))

/**
 * A learning centre's pilot pool, named for the same reason: the centre has
 * bought nothing, and the date it ends is what the teacher plans around.
 */
const pilot = computed(() =>
  Math.min(props.allowance?.pilot_remaining ?? 0, topup.value - starter.value),
)
const bought = computed(() => topup.value - starter.value - pilot.value)

function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

const starterUntil = computed(() => shortDate(props.allowance?.starter_expires_at))
const pilotUntil = computed(() => shortDate(props.allowance?.pilot_expires_at))

const extraLabel = computed(() => {
  const parts: string[] = []
  if (pilot.value > 0) {
    parts.push(`${pilot.value} pilot ${props.unit}${pilotUntil.value ? ` until ${pilotUntil.value}` : ''}`)
  }
  if (starter.value > 0) {
    parts.push(
      `${starter.value} starter ${props.unit}${starterUntil.value ? ` until ${starterUntil.value}` : ''}`,
    )
  }
  if (bought.value > 0) parts.push(`${bought.value} topped up`)
  return parts.join(' · ')
})

/**
 * Dots only while EVERYTHING fits — the bought run included. A free plan is 12
 * countable things until somebody adds a hundred to it, at which point drawing
 * a hundred and twelve specks (or, worse, truncating them silently) says less
 * than one honest proportion does.
 */
const asDots = computed(
  () => metered.value && limit.value > 0 && limit.value + topup.value <= DOTS_MAX,
)

/** One entry per unit of the plan's share, spent ones first. */
const dots = computed(() =>
  Array.from({ length: limit.value }, (_, index) => index < used.value),
)

const percent = computed(() => props.allowance?.percent_used ?? 0)

const tone = computed<'accent' | 'warn' | 'danger'>(() => {
  if (total.value <= 0) return 'danger'
  if (topup.value === 0 && percent.value >= 80) return 'warn'
  return 'accent'
})

const fillColor = computed(
  () =>
    ({
      accent: 'var(--accent)',
      warn: 'var(--warn)',
      danger: 'var(--danger)',
    })[tone.value],
)

const heading = computed(
  () => props.label ?? props.unit.charAt(0).toUpperCase() + props.unit.slice(1),
)

/**
 * The caption. Written as a sentence about lessons rather than as an accounting
 * line, and it only mentions the bought half when there is one — most people
 * never buy a pack and should never be shown a slot for one.
 */
const caption = computed(() => {
  if (!metered.value) return ''
  if (total.value <= 0) return `No ${props.unit} left this month.`

  const base = `${used.value} of ${limit.value} used this month`
  return extraLabel.value ? `${base} · ${extraLabel.value}` : base
})
</script>

<template>
  <div v-if="metered">
    <div
      v-if="!compact"
      class="mb-2 flex items-baseline gap-2"
    >
      <UiIcon
        :name="icon"
        :size="13"
        class="translate-y-px"
        :style="{ color: fillColor }"
      />
      <span class="text-[13px] font-medium text-text-dim">{{ heading }}</span>
      <span class="flex-1" />
      <span class="num text-[13px] font-semibold tabular-nums text-text">{{ total }}</span>
      <span class="text-[12px] text-text-faint">left</span>
    </div>

    <!-- Countable: one node per lesson. -->
    <div
      v-if="asDots"
      class="flex flex-wrap items-center gap-[3px]"
      :aria-label="`${total} of ${limit + topup} ${unit} left`"
    >
      <span
        v-for="(spent, index) in dots"
        :key="index"
        class="size-[7px] rounded-[2.5px] transition-colors"
        :style="{ background: spent ? 'var(--surface-track)' : fillColor }"
      />
      <span
        v-if="topup > 0"
        class="mx-1 h-[9px] w-px bg-border"
      />
      <span
        v-for="index in topup"
        :key="`t${index}`"
        class="size-[7px] rounded-[2.5px] border"
        :style="{ borderColor: fillColor, background: 'transparent' }"
      />
    </div>

    <!-- Too many to count: the same shape as one continuous run. -->
    <div
      v-else
      class="flex items-center gap-1"
      :aria-label="`${total} of ${limit + topup} ${unit} left`"
    >
      <span class="h-[7px] flex-1 overflow-hidden rounded-full bg-surface-track">
        <span
          class="block h-full rounded-full transition-[width] duration-400"
          :style="{ width: `${Math.max(0, 100 - percent)}%`, background: fillColor }"
        />
      </span>
      <span
        v-if="topup > 0"
        class="h-[7px] w-8 shrink-0 rounded-full border"
        :style="{ borderColor: fillColor }"
        :title="extraLabel"
      />
    </div>

    <p
      v-if="!compact && caption"
      class="mt-2 text-[12px] text-text-faint"
    >
      {{ caption }}
    </p>
  </div>
</template>
