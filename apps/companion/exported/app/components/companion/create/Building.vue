<script setup lang="ts">
/**
 * While the course is being made: the AI's own mark (the ink disc with the
 * lime spark, the old assistant's), one line saying what it is working
 * from, and the steps as a checklist that ticks itself off — one per source
 * ("Reading Lecture 1.pdf", with its upload's percentage while it goes up),
 * then the three every course gets. The default slot sits under the list, for
 * what is being written as it is written.
 *
 * Twenty files would make a wall of rows, so the finished ones fold into
 * "Read 12 sources" and only the next few waiting ones show. Cancel is
 * always there; nothing has been made yet that it would leave behind,
 * except the uploaded files, which wait in Notes.
 *
 * `compact` is the same list inside a chat answer (ai/Proposal): the answer
 * already wears the spark beside it, so the mark goes, the type steps down
 * to the thread's size, and Cancel says Stop, like the composer's.
 */
export interface StepRow {
  key: string
  label: string
  /** `skip`: a file that didn't upload; the course is built without it. */
  state: 'wait' | 'run' | 'done' | 'skip'
  note?: string | null
}

const props = defineProps<{
  steps: StepRow[]
  lead: string
  /** Inside a chat answer: no mark, smaller, "Stop". */
  compact?: boolean
  title?: string
  /** Rows that aren't sources: nothing folds into "Read 12 sources". */
  flat?: boolean
}>()

const emit = defineEmits<{ cancel: [] }>()

/* Two answers can be drafting on one screen (the dock and an older card): ids of their own. */
const uid = useId()

const doneCount = computed(() => props.steps.filter((s) => s.state === 'done' || s.state === 'skip').length)
const percent = computed(() => {
  const run = props.steps.some((s) => s.state === 'run') ? 0.5 : 0
  return Math.round(((doneCount.value + run) / Math.max(1, props.steps.length)) * 100)
})

/** Finished rows past the last two fold into one; at most four waiting ones show. */
const rows = computed(() => {
  if (props.flat) return props.steps as (StepRow & { more?: boolean })[]
  const done = props.steps.filter((s) => s.state === 'done' || s.state === 'skip')
  const rest = props.steps.filter((s) => s.state !== 'done' && s.state !== 'skip')
  // A skipped file never folds away: it is the one row the learner needs to see.
  const foldable = done.filter((s) => s.state === 'done')
  const folded = foldable.length > 3 ? foldable.slice(0, foldable.length - 2) : []
  const shown = done.filter((s) => !folded.includes(s))
  const waiting = rest.filter((s) => s.state === 'wait')
  const running = rest.filter((s) => s.state === 'run')
  const out: (StepRow & { more?: boolean })[] = []
  if (folded.length) out.push({ key: 'folded', label: `Read ${folded.length} sources`, state: 'done' })
  out.push(...shown, ...running, ...waiting.slice(0, 4))
  if (waiting.length > 4) out.push({ key: 'more', label: `${waiting.length - 4} more`, state: 'wait', more: true })
  return out
})
</script>

<template>
  <section
    :class="[
      'animate-rise grid border border-border bg-surface-chrome',
      compact ? 'gap-3 rounded-[16px] p-3.5' : 'gap-4 rounded-[22px] p-4 min-[600px]:p-6',
    ]"
    :aria-labelledby="`${uid}-title`"
  >
    <header :class="['flex items-center', compact ? 'gap-2.5' : 'gap-3.5']">
      <span
        v-if="!compact"
        class="cp-build-mark relative grid size-11 shrink-0 place-items-center rounded-full bg-ink"
        aria-hidden="true"
      >
        <span class="grid size-7 place-items-center rounded-full bg-lime text-ink">
          <UiIcon
            name="spark"
            :size="15"
          />
        </span>
      </span>
      <div class="grid min-w-0 flex-1 gap-0.5">
        <h2
          :id="`${uid}-title`"
          :class="compact ? 'text-[14.5px] font-semibold text-text' : 't-head text-[18px] min-[600px]:text-[20px]'"
        >
          {{ title ?? 'Building your course' }}
        </h2>
        <p :class="['truncate text-text-muted', compact ? 'text-[12.5px]' : 'text-[13.5px]']">
          {{ lead }}
        </p>
      </div>
      <UiBtn
        variant="ghost"
        :size="compact ? 'sm' : 'md'"
        :title="compact ? 'Stop' : 'Cancel (Esc)'"
        :class="compact && 'max-lg:h-11'"
        @click="emit('cancel')"
      >
        {{ compact ? 'Stop' : 'Cancel' }}
      </UiBtn>
    </header>

    <ol
      class="grid gap-0.5"
      aria-live="polite"
    >
      <li
        v-for="s in rows"
        :key="s.key"
        :class="['flex items-center gap-3 rounded-[10px] px-1', compact ? 'min-h-8' : 'min-h-9']"
      >
        <span class="grid size-5 shrink-0 place-items-center">
          <span
            v-if="s.state === 'done'"
            class="grid size-5 place-items-center rounded-full bg-success-soft text-success"
          >
            <UiIcon
              name="check"
              :size="12"
              :stroke="2.4"
            />
          </span>
          <UiIcon
            v-else-if="s.state === 'skip'"
            name="alert"
            :size="16"
            class="text-warn"
          />
          <UiIcon
            v-else-if="s.state === 'run'"
            name="loader"
            :size="16"
            class="animate-spin-slow text-cobalt"
          />
          <span
            v-else
            class="size-1.5 rounded-full bg-text-ghost"
          />
        </span>
        <span
          class="min-w-0 flex-1 truncate transition-colors duration-200"
          :class="[compact ? 'text-[13.5px]' : 'text-[14.5px]', s.state === 'run' ? 'font-semibold text-text' : s.state === 'done' ? 'text-text-soft' : s.state === 'skip' ? 'text-text-muted line-through decoration-text-ghost' : 'text-text-faint']"
        >{{ s.label }}{{ s.state === 'run' ? '…' : '' }}</span>
        <span
          v-if="s.note"
          class="shrink-0 text-[12.5px] tabular-nums"
          :class="s.state === 'skip' ? 'font-medium text-warn-text' : 'text-text-muted'"
        >{{ s.note }}</span>
      </li>
    </ol>

    <slot />

    <div
      class="h-1 overflow-hidden rounded-full bg-surface-track"
      role="progressbar"
      :aria-valuenow="percent"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-label="Building"
    >
      <div
        class="h-full rounded-full bg-cobalt transition-[width] duration-500 ease-out"
        :style="{ width: `${Math.max(4, percent)}%` }"
      />
    </div>
  </section>
</template>

<style scoped>
/* A slow lime halo: alive, not urgent. */
.cp-build-mark::after {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 999px;
  box-shadow: 0 0 0 0 var(--accent-line);
  animation: cp-build-halo 2.2s ease-out infinite;
}

@keyframes cp-build-halo {
  0% {
    box-shadow: 0 0 0 0 var(--accent-line);
  }
  70%,
  100% {
    box-shadow: 0 0 0 10px transparent;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cp-build-mark::after {
    animation: none;
  }
}
</style>
