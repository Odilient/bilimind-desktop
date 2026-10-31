<script setup lang="ts">
import type { Hotspot, IllustrationBlock } from '~/types/api'
import type { IllustrationOutcome } from '~/composables/useIllustration'
import BlockShell from './BlockShell.vue'

/**
 * IMAGERY — a picture drawn for this lesson, with its labels written by us.
 *
 * Two live findings decided everything here. A generated leaf cross-section came
 * back structurally perfect and labelled "Cuticile", "Palisade Mesowhyll",
 * "Lonweny Mesolerhyll" — so the server asks for an UNLABELLED drawing and every
 * word on top of it is real DOM text, exactly as `annotated_media` does it. That
 * text is selectable, searchable, screen-readable and translatable, which is not
 * a nicety in a product that teaches in sixteen languages: a misspelt English
 * label baked into a PNG is wrong twice over.
 *
 * And each picture costs $0.0387 of real money, which is why nothing is drawn
 * until someone scrolls near it, why only a signed-in owner can trigger one, and
 * why the four states below are all designed to be *finished* rather than
 * broken. `alt_text` is required by the server precisely because it is this
 * block whenever there is no picture — so the degraded state renders it as
 * prose, at reading size, not as an error inside a box.
 *
 * The last thing this component owes anyone is honesty about WHY a picture is
 * missing. A hit ceiling and a dead queue worker both end with the learner
 * reading alt text, and until the owner can tell those apart, an outage looks
 * exactly like the product working as designed.
 */
const props = defineProps<{
  block: IllustrationBlock
  /**
   * The read-only course page. `isAuthenticated` alone cannot tell a signed-in
   * stranger from the owner, so without this the public page spends one 404 per
   * illustration on anyone who happens to have an account. The server is still
   * the authority — this only stops us asking a question we know the answer to.
   */
  readonly?: boolean
}>()

const { request, forget } = useIllustration()
const { isAuthenticated } = useAuth()

const payload = computed(() => props.block.payload ?? null)
const points = computed<Hotspot[]>(() => payload.value?.points ?? [])
const detailed = computed(() => points.value.filter((point) => Boolean(point.detail)))

/** What our own trigger found, if we ever got as far as asking. */
const drawn = ref<IllustrationOutcome | null>(null)
const asking = ref(false)
const broken = ref(false)

/** Read off the file once it decodes, so the frame never letterboxes. */
const natural = ref<{ width: number; height: number } | null>(null)

/**
 * The server hydrates `image` at read time for a picture that already exists, so
 * the common case — a lesson opened for the second time, or by anyone at all
 * after the first reader — costs no request. Falling back to our own trigger's
 * answer covers the first one.
 */
const picture = computed(() => {
  if (broken.value) return null

  const hydrated = payload.value?.image
  if (hydrated?.url) return hydrated

  const own = drawn.value
  if (own?.state === 'ready' && own.url) return own

  return null
})

const drawing = computed(() => asking.value || drawn.value?.state === 'generating')

/**
 * 1024x1024 is what the model returns, so a square is the right guess to hold
 * the space with — and holding it is the point: a lesson that reflows a screen's
 * worth of height when a picture lands loses the reader's place.
 */
const frameRatio = computed(() => {
  const measured = natural.value ?? picture.value
  return measured?.width && measured?.height ? `${measured.width} / ${measured.height}` : '1 / 1'
})

/* -------------------------------------------------------------------------- */
/* Labels, drawn over the picture as text                                     */
/* -------------------------------------------------------------------------- */

function pct(value: number): number {
  return Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0))
}

function dotStyle(point: Hotspot): Record<string, string> {
  return { left: `${pct(point.x_pct)}%`, top: `${pct(point.y_pct)}%` }
}

/**
 * A label sits beside its dot, on whichever side keeps it inside the picture —
 * anchoring the far edge rather than the near one is what lets `max-w` clamp a
 * long label instead of letting it run off the frame.
 */
function labelStyle(point: Hotspot): Record<string, string> {
  const x = pct(point.x_pct)
  const base = { top: `${pct(point.y_pct)}%` }

  return x > 50
    ? { ...base, right: `calc(${100 - x}% + 11px)` }
    : { ...base, left: `calc(${x}% + 11px)` }
}

/* -------------------------------------------------------------------------- */
/* Asking for one                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Only reasons a person could act on. `not_owner` is the answer a signed-in
 * reader gets for somebody else's course, which is a fact about them rather than
 * about the lesson, so it is never shown.
 */
const REASON_ICON: Record<string, string> = {
  course_cap: 'lock',
  plan_cap: 'lock',
  weekly_budget: 'lock',
  disabled: 'lock',
  provider_halted: 'clock',
  worker_stalled: 'alert',
  generation_failed: 'alert',
  no_subject: 'alert',
}

/** The outage cases, and the only ones where asking again could change anything. */
const RETRYABLE = new Set(['worker_stalled', 'generation_failed', 'provider_halted'])

const explanation = computed(() => {
  const own = drawn.value
  if (!own || own.state === 'ready' || own.reason === 'not_owner') return null
  if (!own.message) return null

  return {
    icon: own.reason ? (REASON_ICON[own.reason] ?? 'alert') : 'alert',
    message: own.message,
    retryable: own.reason !== null && RETRYABLE.has(own.reason),
  }
})

/**
 * What is left of each ceiling, shown beside the explanation. A cap the owner
 * can see coming is a budget; a cap they discover is a bug report.
 */
const allowance = computed(() => {
  const figures = drawn.value?.allowance
  if (!figures || !explanation.value) return null

  const parts: string[] = []

  if (figures.course_limit !== null) {
    parts.push(`${figures.course_used} of ${figures.course_limit} in this course`)
  }
  if (figures.month_limit !== null) {
    parts.push(`${figures.month_used} of ${figures.month_limit} this month`)
  }
  if (figures.week_budget_usd !== null && !figures.using_own_key) {
    parts.push(
      `$${figures.week_spend_usd.toFixed(2)} of $${figures.week_budget_usd.toFixed(2)} this week`,
    )
  }

  return parts.length > 0 ? parts.join(' · ') : null
})

const frame = ref<HTMLElement | null>(null)
let watcher: IntersectionObserver | null = null

function wanted(): boolean {
  return (
    import.meta.client &&
    !picture.value &&
    !asking.value &&
    drawn.value === null &&
    isAuthenticated.value &&
    !props.readonly &&
    Boolean(payload.value?.subject)
  )
}

async function draw(): Promise<void> {
  if (!wanted()) return

  asking.value = true
  try {
    drawn.value = await request(props.block.id)
  } finally {
    asking.value = false
  }
}

function stopWatching(): void {
  watcher?.disconnect()
  watcher = null
}

/**
 * Nothing is drawn until the block is roughly a screen away.
 *
 * This is a cost control, not a loading optimisation: a twenty-lesson course
 * spends $0.04 for every illustration it renders, and someone who opens a lesson
 * and bounces should not have paid for the picture four screens down.
 */
function arm(): void {
  stopWatching()
  if (!wanted()) return

  if (typeof IntersectionObserver === 'undefined') {
    void draw()
    return
  }

  watcher = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      stopWatching()
      void draw()
    },
    { rootMargin: '600px 0px' },
  )

  if (frame.value) watcher.observe(frame.value)
}

function retry(): void {
  forget(props.block.id)
  drawn.value = null
  broken.value = false
  void draw()
}

onMounted(arm)
onBeforeUnmount(stopWatching)

/* The renderer reuses this instance when one illustration follows another, so a
   new block id has to clear the last one's answer as well as its picture. */
watch(
  () => props.block.id,
  () => {
    drawn.value = null
    asking.value = false
    broken.value = false
    natural.value = null
    nextTick(arm)
  },
)

function measure(event: Event): void {
  const img = event.target as HTMLImageElement
  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
    natural.value = { width: img.naturalWidth, height: img.naturalHeight }
  }
}
</script>

<template>
  <BlockShell
    :type="block.type"
    :source-material-ids="block.source_material_ids"
  >
    <div ref="frame">
      <figure
        v-if="picture"
        class="m-0"
      >
        <!-- Capped rather than full-bleed: a square at the full 760px measure is
             a whole viewport of picture, and the labels only need to be legible,
             not enormous. -->
        <div
          class="relative mx-auto w-full max-w-[480px] overflow-hidden rounded-[14px] bg-surface-track"
          :style="{ aspectRatio: frameRatio }"
        >
          <img
            :src="picture.url ?? ''"
            :alt="payload?.alt_text ?? ''"
            loading="lazy"
            decoding="async"
            class="block size-full object-contain"
            @load="measure"
            @error="broken = true"
          />

          <template
            v-for="(point, index) in points"
            :key="index"
          >
            <span
              class="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime shadow-[0_0_0_3px_rgb(var(--wash-rgb)/0.85)]"
              :style="dotStyle(point)"
              aria-hidden="true"
            />
            <!-- Real text, never baked in. The image model misspells; this does
                 not, and a screen reader, a translator and ctrl-F can all reach
                 it. -->
            <span
              class="absolute max-w-[46%] -translate-y-1/2 truncate rounded-[9px] bg-ink/88 px-2 py-1 text-[11.5px] leading-tight font-semibold text-white shadow-[0_6px_14px_-6px_rgb(11_13_16/0.5)]"
              :style="labelStyle(point)"
              :title="point.label"
              >{{ point.label }}</span
            >
          </template>
        </div>

        <figcaption class="mx-auto mt-2.5 w-full max-w-[480px]">
          <p
            v-if="payload?.caption"
            class="text-[13.5px] leading-relaxed text-text-soft"
          >
            {{ payload.caption }}
          </p>
          <!-- Permanent, and not decoration: this is the condition on which we
               are allowed to show a synthetic picture at all. It sits exactly
               where AnnotatedMediaBlock puts its licence line, and means the
               opposite thing. -->
          <p class="mt-1 text-[11.5px] text-text-faint">
            Illustration · drawn for this lesson, not a photograph
          </p>
        </figcaption>
      </figure>

      <div v-else-if="drawing">
        <div
          class="animate-shimmer mx-auto w-full max-w-[480px] rounded-[14px] bg-surface-track"
          :style="{ aspectRatio: frameRatio }"
        />
        <p
          class="mx-auto mt-2.5 flex w-full max-w-[480px] items-center gap-1.5 text-[12.5px] text-text-muted"
        >
          <UiIcon
            name="sparkles"
            :size="13"
          />
          Drawing this illustration. It is kept, so it is only drawn once.
        </p>
      </div>

      <!-- The degraded state, and it is a state rather than a failure: alt_text
           is written to teach on its own, so it is set as prose at reading size.
           Boxing it in grey would tell the learner something is broken when the
           lesson is complete. -->
      <template v-else>
        <p
          v-if="payload?.alt_text"
          class="text-[15.5px] leading-[1.72] text-text-body"
        >
          {{ payload.alt_text }}
        </p>

        <p
          v-if="payload?.caption"
          class="mt-2 text-[13px] leading-relaxed text-text-muted"
        >
          {{ payload.caption }}
        </p>
      </template>

      <ul
        v-if="picture && detailed.length"
        class="mx-auto mt-3 flex w-full max-w-[480px] flex-col gap-1.5"
      >
        <li
          v-for="(point, index) in detailed"
          :key="index"
          class="text-[13px] leading-relaxed text-text-muted"
        >
          <span class="font-semibold text-text">{{ point.label }}</span>
          — {{ point.detail }}
        </li>
      </ul>

      <!-- Owner-only, and the whole reason the endpoint answers with a reason:
           a ceiling and an outage read identically from the learner's side. -->
      <p
        v-if="explanation"
        class="mt-3 flex items-start gap-1.5 border-t border-border-rule pt-2.5 text-[11.5px] leading-relaxed text-text-faint"
      >
        <UiIcon
          :name="explanation.icon"
          :size="12"
          class="mt-0.5 shrink-0"
        />
        <span>
          {{ explanation.message }}
          <span
            v-if="allowance"
            class="num"
            >&nbsp;({{ allowance }})</span
          >
          <button
            v-if="explanation.retryable"
            type="button"
            class="ml-1 cursor-pointer underline underline-offset-2 hover:text-text-muted"
            @click="retry"
          >
            Try again
          </button>
        </span>
      </p>
    </div>
  </BlockShell>
</template>
