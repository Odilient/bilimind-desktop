<script setup lang="ts">
import type { PlaygroundBlock } from '~/types/api'
import BlockShell from './BlockShell.vue'
import Markdown from './Markdown.vue'

/**
 * EXPAND §2/§6 — sliders bound to a model-authored formula.
 *
 * The formula is JavaScript written by a language model, so it never touches
 * the main thread. It runs in the SAME sandboxed Web Worker as the code
 * exercises — `useCodeRunner` — with the same hard kill. There is deliberately
 * no second execution path: one sandbox is auditable, two is a matter of time.
 *
 * The worker returns each call's value as an inspected string, so asking it for
 * a value is a matter of running a "test" whose expectation is never met.
 *
 * Beyond the single read-out, the first slider is swept across its range and
 * plotted. That costs nothing extra — the whole sweep is one batch in one
 * worker round-trip — and it is the difference between knowing what the answer
 * is at this setting and understanding the shape of the relationship, which is
 * the entire reason this block type exists.
 */
const props = defineProps<{ block: PlaygroundBlock }>()

const runner = useCodeRunner({ timeoutMs: 1500 })

const inputs = computed(() => props.block.payload?.inputs ?? [])

const values = reactive<Record<string, number>>({})
const output = ref<string | null>(null)
const broken = ref(false)
const sweep = ref<number[]>([])

/** The slider the sparkline sweeps. */
const swept = computed(() => inputs.value[0] ?? null)

const SWEEP_POINTS = 28

watch(
  inputs,
  (next) => {
    for (const input of next) values[input.key] = input.default
  },
  { immediate: true },
)

/**
 * A JS object literal from slider positions. Keys are validated server-side
 * against `/^[a-z_][a-z0-9_]{0,31}$/i`, and every value is a number, so nothing
 * here can carry a string into the call.
 */
function call(override?: { key: string; value: number }): string {
  const args = inputs.value
    .map((input) => {
      const value =
        override && override.key === input.key
          ? override.value
          : Number(values[input.key] ?? input.default)
      return `${input.key}:${value}`
    })
    .join(',')

  return `compute({${args}})`
}

/** The sweep's x positions, in the swept input's own units. */
const sweepXs = computed<number[]>(() => {
  const input = swept.value
  if (!input || inputs.value.length === 0) return []

  const span = input.max - input.min
  if (!Number.isFinite(span) || span <= 0) return []

  return Array.from(
    { length: SWEEP_POINTS },
    (_, i) => input.min + (span * i) / (SWEEP_POINTS - 1),
  )
})

async function evaluate(): Promise<void> {
  const formula = props.block.payload?.formula_js

  if (!formula) {
    broken.value = true
    return
  }

  const input = swept.value
  const xs = sweepXs.value

  const tests = [
    { name: 'value', call: call(), expect: null },
    ...(input
      ? xs.map((x, i) => ({ name: `s${i}`, call: call({ key: input.key, value: x }), expect: null }))
      : []),
  ]

  const result = await runner.run(formula, tests)

  const received = result.results[0]?.received ?? null
  broken.value = Boolean(result.error) || result.timedOut || received === null
  output.value = broken.value ? null : (received as string)

  sweep.value = broken.value
    ? []
    : result.results
        .slice(1)
        .map((row) => Number.parseFloat(String(row.received ?? '')))
        .map((value) => (Number.isFinite(value) ? value : Number.NaN))
}

/**
 * Dragging fires continuously; each run spins up a worker. Coalescing to one
 * run per frame keeps a drag at one evaluation per repaint instead of forty.
 */
let queued: ReturnType<typeof setTimeout> | undefined

function schedule(): void {
  if (queued !== undefined) clearTimeout(queued)
  queued = setTimeout(() => void evaluate(), 60)
}

watch(values, schedule, { deep: true })
onMounted(() => void evaluate())
onBeforeUnmount(() => {
  if (queued !== undefined) clearTimeout(queued)
})

function reset(): void {
  for (const input of inputs.value) values[input.key] = input.default
}

/** Slider steps are often fractional; trailing zeros read as noise. */
function label(value: number, step: number): string {
  const decimals = String(step).includes('.') ? String(step).split('.')[1]!.length : 0
  return value.toFixed(Math.min(decimals, 4))
}

/* -- The sparkline --------------------------------------------------------- */

const VIEW = { w: 320, h: 74 }

const polyline = computed(() => {
  const points = sweep.value.filter((value) => Number.isFinite(value))
  if (points.length < 2) return ''

  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1

  return sweep.value
    .map((value, index) => {
      if (!Number.isFinite(value)) return null
      const x = (index / (sweep.value.length - 1)) * VIEW.w
      // Inverted: SVG y grows downward, and a bigger output should sit higher.
      const y = VIEW.h - ((value - min) / span) * (VIEW.h - 8) - 4
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .filter(Boolean)
    .join(' ')
})

/** Where the current setting sits along the sweep, as a percentage. */
const markerPercent = computed(() => {
  const input = swept.value
  if (!input) return null

  const span = input.max - input.min
  if (span <= 0) return null

  const value = Number(values[input.key] ?? input.default)
  return Math.min(100, Math.max(0, ((value - input.min) / span) * 100))
})

/** How far along its range a slider sits, for the cobalt run behind the thumb. */
function fillOf(input: { key: string; min: number; max: number; default: number }): string {
  const value = values[input.key] ?? input.default
  const span = input.max - input.min
  return `${span > 0 ? Math.min(100, Math.max(0, ((value - input.min) / span) * 100)) : 0}%`
}
</script>

<template>
  <BlockShell
    :type="block.type"
    :source-material-ids="block.source_material_ids"
  >
    <template #actions>
      <UiBtn
        variant="ghost"
        size="xs"
        icon="refresh"
        @click="reset"
        >Reset</UiBtn
      >
    </template>

    <!-- BlockShell is the card now; this is just the instrument inside it. -->
    <div class="pg">
      <Markdown
        v-if="block.payload?.guidance_markdown"
        :source="block.payload.guidance_markdown"
        size="sm"
        class="mb-4.5 text-text-soft"
      />

      <div class="grid gap-x-6.5 gap-y-4.5 sm:grid-cols-2">
        <div
          v-for="input in inputs"
          :key="input.key"
        >
          <div class="mb-2 flex items-baseline justify-between gap-3">
            <label
              :for="`pg-${block.id}-${input.key}`"
              class="text-[13px] font-medium text-text-dim"
              >{{ input.label }}</label
            >
            <span class="num font-display text-[14px] font-semibold text-brand">
              {{ label(values[input.key] ?? input.default, input.step) }}
              <span
                v-if="input.unit"
                class="text-text-faint"
                >{{ input.unit }}</span
              >
            </span>
          </div>

          <input
            :id="`pg-${block.id}-${input.key}`"
            v-model.number="values[input.key]"
            type="range"
            :min="input.min"
            :max="input.max"
            :step="input.step"
            :style="{ '--fill': fillOf(input) }"
          />
        </div>
      </div>

      <div class="mt-5 flex flex-wrap items-end gap-6 border-t border-dashed border-border-strong pt-5">
        <div class="shrink-0">
          <p class="eyebrow-loud text-text-faint">
            {{ block.payload?.output_label ?? 'Result' }}
          </p>

          <p
            v-if="!broken"
            class="num mt-2 font-display text-[40px] leading-none font-semibold tracking-[-0.04em]"
          >
            {{ output ?? '—' }}
            <span
              v-if="block.payload?.output_unit && output"
              class="font-sans text-[15px] font-medium tracking-normal text-text-faint"
              >{{ block.payload.output_unit }}</span
            >
          </p>
          <p
            v-else
            class="mt-1.5 max-w-[180px] text-[12.5px] leading-snug text-warn"
          >
            This calculation could not run.
          </p>
        </div>

        <div
          v-if="polyline && swept"
          class="min-w-0 flex-1"
        >
          <p class="num mb-1.5 text-[11px] text-text-faint">{{ swept.label }} across its range →</p>
          <div class="relative">
            <svg
              :viewBox="`0 0 ${VIEW.w} ${VIEW.h}`"
              preserveAspectRatio="none"
              class="cb-dots block h-[84px] w-full rounded-[12px]"
              role="img"
              :aria-label="`${block.payload?.output_label ?? 'Output'} as ${swept.label} varies`"
            >
              <polyline
                :points="polyline"
                fill="none"
                stroke="var(--brand)"
                stroke-width="2.2"
                vector-effect="non-scaling-stroke"
              />
            </svg>
            <!-- Where you are on that curve right now. -->
            <span
              v-if="markerPercent !== null"
              class="pointer-events-none absolute inset-y-0 w-0 border-l border-dashed border-text/40"
              :style="{ left: `${markerPercent}%` }"
            >
              <span
                class="absolute top-1/2 -left-[6px] size-3 -translate-y-1/2 rounded-full bg-lime ring-2 ring-text"
              />
            </span>
          </div>
        </div>
      </div>

      <p
        v-if="!runner.supported.value"
        class="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-text-faint"
      >
        <UiIcon
          name="alert"
          :size="12"
          class="mt-px"
        />
        <span>This browser cannot run the calculation (Web Workers are unavailable).</span>
      </p>
    </div>
  </BlockShell>
</template>

<style scoped>
/* The player's sliders: a cobalt run on a grey track, a lime thumb ringed in ink. */
.pg input[type='range'] {
  height: 6px;
  border-radius: 99px;
  background: linear-gradient(var(--brand), var(--brand)) 0 / var(--fill, 50%) 100% no-repeat,
    var(--surface-track);
}

.pg input[type='range']::-webkit-slider-thumb {
  width: 18px;
  height: 18px;
  background: var(--lime);
  border: 2px solid var(--ink);
}

.pg input[type='range']::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: var(--lime);
  border: 2px solid var(--ink);
}
</style>
