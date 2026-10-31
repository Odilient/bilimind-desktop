<script setup lang="ts">
import type { CheckResult, CodeMode, ExerciseRun, ExerciseSpec } from '~/types/api'
import type { WarmPhase } from '~/composables/useWasmSandbox'
import type { RunProgress } from '~/composables/useCodeExercise'
import { LANG_MARKS } from '~/composables/useCodeExercise'
import { markdownToText } from '~/composables/useMarkdown'
import CheckList from './CheckList.vue'
import ResultTable from './ResultTable.vue'
import HtmlPreview from './HtmlPreview.vue'
import RuntimeState from './RuntimeState.vue'

/**
 * The exercise, as a single dark instrument: a title strip, an editor beside its
 * output, and one toolbar spanning both.
 *
 * ONE component renders this inline in the lesson and full-screen in focus mode,
 * because the previous version kept two hand-written copies of the same panel
 * and the phone one had already drifted — different buttons, no console, its own
 * result list. A takeover is a size, not a different exercise.
 *
 * The editor|output split is driven by a CONTAINER query on the card, never a
 * viewport breakpoint. The lesson column sits between a 274px sidebar and a
 * 320px assistant dock, so at 1280px with both open it is really ~622px wide: a
 * `lg:` rule would confidently split a pane with no room to split, and the
 * failure would look like a styling bug rather than a wrong question.
 */
const props = withDefaults(
  defineProps<{
    spec: ExerciseSpec
    variant?: 'inline' | 'focus'
    disabled?: boolean
    running: boolean
    progress: RunProgress | null
    run: ExerciseRun | null
    stale: boolean
    canCancel: boolean
    /** Reactive warm phase for this exercise's runtime. */
    phase: WarmPhase
    passedCount: number
    /** The prompt, for the editor's accessible name and the focus dialog's title. */
    label: string
    canReset: boolean
    canUndoReset: boolean
    timeoutMs: number
  }>(),
  { variant: 'inline', disabled: false },
)

const emit = defineEmits<{
  run: []
  cancel: []
  reset: []
  undoReset: []
  openFocus: []
  closeFocus: []
  /** The learner has shown intent; the caller uses it to warm the runtime. */
  editorFocus: []
}>()

const code = defineModel<string>({ default: '' })
const tab = defineModel<string>('tab', { default: '' })

const isFocus = computed(() => props.variant === 'focus')
const mark = computed(() => LANG_MARKS[props.spec.lang])

/**
 * The mode's own header. BlockShell owns the block's label ("Exercise") for the
 * whole lesson; an exercise that needs to say "Fix the bug" says it here, inside
 * its own frame, rather than renaming the block type for one payload.
 */
const MODE_HEADER: Record<CodeMode, string> = {
  function: 'Write the function',
  script: 'Write the program',
  debug: 'Fix the bug',
  query: 'Write the query',
  build: 'Build the page',
}

/* -------------------------------------------------------------------------- */
/* Tabs                                                                        */
/* -------------------------------------------------------------------------- */

interface PaneTab {
  id: string
  label: string
}

const tabs = computed<PaneTab[]>(() => {
  const spec = props.spec
  switch (spec.mode) {
    case 'script':
      return [{ id: 'checks', label: 'Cases' }, { id: 'console', label: 'Console' }]
    case 'query':
      return [
        ...(spec.tables.length > 0 ? [{ id: 'tables', label: 'Tables' }] : []),
        { id: 'result', label: 'Result' },
        ...(spec.graded ? [{ id: 'checks', label: 'Checks' }] : []),
        { id: 'console', label: 'Console' },
      ]
    case 'build':
      return [
        { id: 'preview', label: 'Preview' },
        ...(spec.graded ? [{ id: 'checks', label: 'Checks' }] : []),
        ...(spec.requirements.length > 0 ? [{ id: 'requirements', label: 'Done when' }] : []),
      ]
    default:
      return [{ id: 'checks', label: 'Checks' }, { id: 'console', label: 'Console' }]
  }
})

/** Where the pane opens: the thing the learner needs BEFORE they have run anything. */
const openingTab = computed(() => {
  if (props.spec.mode === 'query' && props.spec.tables.length > 0) return 'tables'
  return tabs.value[0]?.id ?? 'checks'
})

/** Where a finished run lands: the verdict, except for build, which has no run. */
const verdictTab = computed(() => {
  if (props.spec.mode === 'build') return props.spec.graded ? 'checks' : 'preview'
  if (props.spec.mode === 'query') return 'result'
  return 'checks'
})

const active = computed(() =>
  tabs.value.some((paneTab) => paneTab.id === tab.value) ? tab.value : openingTab.value,
)

watch(
  () => props.run,
  (next) => {
    // A finished run selects the verdict; a manual choice then holds until the
    // next one, which is why this watches the run and not the running flag.
    if (next && !next.aborted) tab.value = verdictTab.value
  },
)

/** Something arrived in Console that the learner has not looked at. */
const consoleUnseen = computed(
  () =>
    Boolean(props.run?.stderr) &&
    active.value !== 'console' &&
    tabs.value.some((paneTab) => paneTab.id === 'console'),
)

const tabRefs = ref<HTMLButtonElement[]>([])

/** Roving arrow keys, per the tablist pattern; Tab still leaves the strip. */
function onTabKeydown(event: KeyboardEvent, index: number): void {
  const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End']
  if (!keys.includes(event.key)) return
  event.preventDefault()

  const count = tabs.value.length
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? count - 1
        : event.key === 'ArrowRight'
          ? (index + 1) % count
          : (index - 1 + count) % count

  tab.value = tabs.value[next]!.id
  nextTick(() => tabRefs.value[next]?.focus())
}

/* -------------------------------------------------------------------------- */
/* Run state, said in one line                                                 */
/* -------------------------------------------------------------------------- */

const total = computed(() => props.run?.results.length ?? 0)
const allPassed = computed(() => total.value > 0 && props.passedCount === total.value)

const summary = computed<{ text: string; tone: string }>(() => {
  if (props.running) {
    const p = props.progress
    return {
      text: p ? `running case ${p.index} of ${p.total}…` : 'running…',
      tone: 'text-code-dim',
    }
  }
  if (props.phase === 'warming') return { text: 'preparing the runtime…', tone: 'text-code-meta' }

  const run = props.run
  if (run?.aborted) return { text: 'the runtime could not load', tone: 'text-danger-on-dark' }

  if (run) {
    if (props.spec.graded) {
      return {
        text: `${props.passedCount}/${total.value} passing · ${run.durationMs}ms`,
        tone: allPassed.value ? 'text-success-on-dark' : 'text-danger-on-dark',
      }
    }
    if (run.stderr) return { text: 'stopped with an error', tone: 'text-danger-on-dark' }
    return { text: `ran in ${run.durationMs}ms`, tone: 'text-code-meta' }
  }

  if (!props.spec.graded) {
    return {
      text:
        props.spec.mode === 'build' ? 'reviewed, not executed' : 'nothing to check automatically',
      tone: 'text-code-meta',
    }
  }

  const count = props.spec.checks.length
  return {
    text: `${count} ${count === 1 ? 'check' : 'checks'} ready`,
    tone: 'text-code-meta',
  }
})

const runLabel = computed(() => {
  if (props.running) return 'Running'
  if (props.phase === 'warming') return 'Preparing'
  if (props.phase === 'failed') return 'Retry'

  const ran = props.run !== null && !props.run.aborted

  if (props.spec.mode === 'build') return ran ? 'Check again' : 'Check the page'
  if (ran) return 'Run again'
  if (!props.spec.graded) return 'Run'

  const count = props.spec.checks.length
  return `Run ${count} ${count === 1 ? 'check' : 'checks'}`
})

const runBusy = computed(() => props.running || props.phase === 'warming')

/**
 * A `build` with no structural checks has nothing to press: the preview is
 * already live and updates as you type. Offering a Run button there would
 * promise a verdict that is never coming.
 */
const showRun = computed(() => !(props.spec.mode === 'build' && !props.spec.graded))

/** `html` needs no runtime at all, so it never claims to be loading one. */
const showRuntimeDot = computed(() => props.spec.lang !== 'html')

const runtimeWord = computed(() => {
  switch (props.phase) {
    case 'ready':
      return 'ready'
    case 'warming':
      return 'downloading'
    case 'failed':
      return 'unavailable'
    default:
      return 'not loaded'
  }
})

/**
 * The output pane hands itself over to the runtime while there is nothing else
 * to show. Once a run exists its results are more useful than a status card —
 * except an ABORTED one, which has no results and whose whole content is why.
 */
const runtimeCard = computed<'warming' | 'failed' | null>(() => {
  if (props.run?.aborted) return 'failed'
  if (props.run) return null
  if (props.phase === 'warming') return 'warming'
  if (props.phase === 'failed') return 'failed'
  return null
})

/** The output pane before anything has been run, said in the mode's own terms. */
const emptyLine = computed(() => {
  switch (props.spec.mode) {
    case 'debug':
      return 'Run it first — this code already has a bug in it. The failing check tells you where.'
    case 'script':
      return 'Run it to see what your program prints for each case.'
    case 'query':
      return 'Run your query to see the rows it returns.'
    case 'build':
      return 'Check the page once you have written some markup.'
    default:
      return 'Run the checks to see how you did.'
  }
})

const resetLabel = computed(() =>
  props.spec.mode === 'debug' ? 'Restore the broken code' : 'Reset',
)

/* -------------------------------------------------------------------------- */
/* The brief the takeover has to carry                                         */
/* -------------------------------------------------------------------------- */

/**
 * Inline, the ask and the symptom sit in the lesson right above this card, so
 * repeating them here would be noise. Full-screen, they are off the screen
 * entirely — and a learner hunting a fault nobody described is guessing, not
 * debugging.
 *
 * Flattened to plain text rather than rendered: the panel is the one deliberately
 * dark region in a light product, and the prose renderer's colours are tuned for
 * the other one. Losing a pair of asterisks is the cheaper mistake.
 */
const brief = computed(() => (props.variant === 'focus' ? markdownToText(props.label, 600) : ''))

const symptom = computed(() =>
  props.variant === 'focus' && props.spec.symptomMarkdown
    ? markdownToText(props.spec.symptomMarkdown, 400)
    : '',
)

/* -------------------------------------------------------------------------- */
/* build: the learner's own checklist                                          */
/* -------------------------------------------------------------------------- */

/**
 * UI state, never submitted. `SubmitAttemptRequest` declares no rule for it, so
 * Laravel's `validated()` would drop it silently between the request and the
 * grader — and gating submission on self-ticked boxes only teaches people to
 * tick boxes.
 */
const ticked = ref<boolean[]>([])

watch(
  () => props.spec.requirements.length,
  (count) => {
    ticked.value = Array.from({ length: count }, (_, index) => ticked.value[index] ?? false)
  },
  { immediate: true },
)

/* -------------------------------------------------------------------------- */
/* Layout — every width decision measures the CARD                             */
/* -------------------------------------------------------------------------- */

const gridClass = computed(() => [
  'grid grid-cols-1 @[560px]:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]',
  // minmax(0,…) on both tracks is load-bearing: without it one long line in the
  // editor blows its track out and the output pane disappears off the card.
  isFocus.value ? 'min-h-0 flex-1 grid-rows-[1.15fr_1fr] @[560px]:grid-rows-1' : '',
])

const editorClass = computed(() =>
  isFocus.value ? 'min-h-0' : 'h-[220px] @[560px]:h-[300px]',
)

const outputClass = computed(() =>
  isFocus.value ? 'min-h-0' : 'min-h-[180px] @[560px]:h-[300px]',
)

/** Two exercises can sit in one lesson, so the checkbox labels need distinct ids. */
const uid = useId()

const editorHost = useTemplateRef<{ focus: () => void }>('editorHost')

defineExpose({ focus: () => editorHost.value?.focus() })
</script>

<template>
  <!-- The container is the CARD. Anything measuring a wider ancestor measures a
       width this pane does not have. -->
  <div
    :class="[
      '@container',
      isFocus
        ? 'fixed inset-0 z-100 flex flex-col bg-code-bg pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]'
        : '',
    ]"
    :role="isFocus ? 'dialog' : undefined"
    :aria-modal="isFocus ? 'true' : undefined"
    :aria-label="isFocus ? `Exercise: ${label}` : undefined"
  >
    <div
      :class="[
        'flex flex-col bg-code-bg',
        isFocus
          ? 'min-h-0 flex-1'
          : 'overflow-hidden rounded-[18px] shadow-[0_24px_44px_-28px_rgb(11_13_16/0.55)]',
      ]"
    >
      <!-- Strip -->
      <header
        class="flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b border-code-line bg-code-bar px-3 py-2"
      >
        <span
          class="lang-tile"
          :style="{ '--lc': mark.color }"
          aria-hidden="true"
          >{{ mark.glyph }}</span
        >
        <span class="text-[12.5px] font-semibold text-code-text">{{ MODE_HEADER[spec.mode] }}</span>
        <span class="mono-num hidden text-[10px] text-code-meta @[420px]:inline">
          {{ spec.language }} · sandbox · {{ Math.round(timeoutMs / 1000) }}s
        </span>

        <span class="flex-1" />

        <span
          v-if="showRuntimeDot"
          class="hidden items-center gap-1.5 @[480px]:inline-flex"
          :title="`${mark.label} runtime`"
        >
          <span
            :class="[
              'size-1.5 rounded-full',
              phase === 'ready'
                ? 'bg-success-on-dark'
                : phase === 'warming'
                  ? 'animate-pulse bg-warn-bright'
                  : phase === 'failed'
                    ? 'bg-danger-on-dark'
                    : 'bg-code-meta',
            ]"
          />
          <span class="text-[10.5px] text-code-meta">{{ runtimeWord }}</span>
        </span>

        <slot name="actions" />

        <button
          v-if="canUndoReset"
          type="button"
          class="strip-btn"
          @click="emit('undoReset')"
        >
          <UiIcon
            name="refresh"
            :size="12"
          />
          Undo reset
        </button>
        <!-- The word goes first when the card is narrow: on a phone this strip
             holds four controls and the icon alone still reads as "start over". -->
        <button
          v-else
          type="button"
          class="strip-btn"
          :disabled="disabled || !canReset"
          :title="resetLabel"
          :aria-label="resetLabel"
          @click="emit('reset')"
        >
          <UiIcon
            name="refresh"
            :size="12"
          />
          <span class="hidden @[440px]:inline">{{ resetLabel }}</span>
        </button>

        <button
          type="button"
          class="strip-btn"
          data-focus-toggle
          @click="isFocus ? emit('closeFocus') : emit('openFocus')"
        >
          <UiIcon
            :name="isFocus ? 'x' : 'pop-out'"
            :size="12"
          />
          {{ isFocus ? 'Done' : 'Focus' }}
        </button>
      </header>

      <div
        v-if="brief || symptom"
        class="om-scroll max-h-[22vh] shrink-0 overflow-auto border-b border-code-line px-3.5 py-2.5"
      >
        <p
          v-if="brief"
          class="text-[12.5px] leading-relaxed text-code-dim"
        >
          {{ brief }}
        </p>
        <div
          v-if="symptom"
          class="mt-2 rounded-md border border-warn-bright/25 bg-warn-bright/10 px-2.5 py-2"
        >
          <p class="eyebrow mb-1 text-warn-bright">What it does now</p>
          <p class="text-[12px] leading-relaxed text-code-dim">{{ symptom }}</p>
        </div>
      </div>

      <!-- Editor | output -->
      <div :class="gridClass">
        <div
          :class="[
            'overflow-hidden border-b border-code-line @[560px]:border-r @[560px]:border-b-0',
            editorClass,
          ]"
        >
          <SandboxCodeEditor
            ref="editorHost"
            v-model="code"
            :language="spec.lang"
            :readonly="disabled"
            height="100%"
            :aria-label="`Your solution for: ${label}`"
            @run="emit('run')"
            @focus="emit('editorFocus')"
          />
        </div>

        <div :class="['flex min-w-0 flex-col', outputClass]">
          <div
            class="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-code-line px-1.5"
            role="tablist"
            aria-label="Exercise output"
          >
            <button
              v-for="(paneTab, index) in tabs"
              :key="paneTab.id"
              ref="tabRefs"
              type="button"
              role="tab"
              :aria-selected="paneTab.id === active"
              :tabindex="paneTab.id === active ? 0 : -1"
              :class="['pane-tab', paneTab.id === active ? 'is-active' : '']"
              @click="tab = paneTab.id"
              @keydown="onTabKeydown($event, index)"
            >
              {{ paneTab.label }}
              <span
                v-if="paneTab.id === 'console' && consoleUnseen"
                class="size-1 rounded-full bg-warn-bright"
                aria-hidden="true"
              />
            </button>
          </div>

          <div
            class="om-scroll min-h-0 flex-1 overflow-auto"
            role="tabpanel"
          >
            <!-- The one-time runtime download, or its failure. -->
            <RuntimeState
              v-if="runtimeCard"
              :lang="spec.lang"
              :phase="runtimeCard"
              :message="run?.stderr ?? null"
            />

            <template v-else-if="active === 'checks'">
              <CheckList
                :mode="spec.mode"
                :checks="spec.checks"
                :results="run?.results ?? []"
                :stale="stale"
              />
              <p
                v-if="!run && spec.checks.length"
                class="px-3.5 pb-3 text-[11.5px] leading-relaxed text-code-meta"
              >
                {{ emptyLine }}
              </p>
              <p
                v-else-if="!spec.checks.length"
                class="px-3.5 py-3 text-[11.5px] leading-relaxed text-code-meta"
              >
                This exercise declares nothing that can be checked automatically. Your work is
                recorded as done when you say it is.
              </p>
            </template>

            <template v-else-if="active === 'console'">
              <div class="p-3">
                <pre
                  v-if="run?.stdout"
                  class="console-out"
                >{{ run.stdout }}</pre>
                <div
                  v-if="run?.stderr"
                  class="console-err"
                >
                  <UiIcon
                    name="alert"
                    :size="12"
                    class="mt-0.5 shrink-0"
                  />
                  <pre>{{ run.stderr }}</pre>
                </div>
                <p
                  v-if="!run"
                  class="text-[11.5px] leading-relaxed text-code-meta"
                >
                  {{ emptyLine }}
                </p>
                <p
                  v-else-if="!run.stdout && !run.stderr"
                  class="text-[12px] text-code-meta"
                >
                  Ran cleanly — nothing was printed.
                </p>
              </div>
            </template>

            <template v-else-if="active === 'result'">
              <ResultTable
                v-if="run"
                :table="run.table"
              />
              <p
                v-else
                class="px-3.5 py-3 text-[11.5px] leading-relaxed text-code-meta"
              >
                {{ emptyLine }}
              </p>
            </template>

            <!-- The tables the fixture actually creates. Derived from the SQL that
                 runs, so the schema on screen cannot drift from the one queried. -->
            <template v-else-if="active === 'tables'">
              <div class="flex flex-col gap-2.5 p-3">
                <div
                  v-for="table in spec.tables"
                  :key="table.name"
                  class="rounded-lg border border-code-line"
                >
                  <p class="border-b border-code-line px-2.5 py-1.5 font-mono text-[11.5px] text-code-text">
                    {{ table.name }}
                  </p>
                  <ul class="flex flex-wrap gap-x-3 gap-y-1 px-2.5 py-2">
                    <li
                      v-for="column in table.columns"
                      :key="column"
                      class="font-mono text-[11px] text-code-meta"
                    >
                      {{ column }}
                    </li>
                  </ul>
                </div>
              </div>
            </template>

            <template v-else-if="active === 'preview'">
              <HtmlPreview :code="code" />
            </template>

            <template v-else-if="active === 'requirements'">
              <div class="p-3">
                <ul class="flex flex-col gap-1.5">
                  <li
                    v-for="(requirement, index) in spec.requirements"
                    :key="index"
                    class="flex items-start gap-2"
                  >
                    <input
                      :id="`${uid}-req-${index}`"
                      v-model="ticked[index]"
                      type="checkbox"
                      class="mt-0.5 size-3.5 shrink-0 accent-success-bright"
                    />
                    <label
                      :for="`${uid}-req-${index}`"
                      class="cursor-pointer text-[12px] leading-relaxed text-code-dim"
                      >{{ requirement }}</label
                    >
                  </li>
                </ul>
                <p class="mt-3 text-[11px] leading-relaxed text-code-meta">
                  <template v-if="spec.graded">
                    The Checks tab looks at the STRUCTURE of what you wrote. Whether it looks right
                    is yours to judge — tick these off yourself.
                  </template>
                  <template v-else>
                    Nothing here runs a test against your page. Tick these off yourself — the
                    preview is the check.
                  </template>
                </p>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Toolbar, spanning both panes -->
      <footer
        class="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-t border-code-line bg-code-bar px-3 py-2.5"
      >
        <button
          v-if="canCancel"
          type="button"
          class="strip-btn"
          @click="emit('cancel')"
        >
          <UiIcon
            name="x"
            :size="12"
          />
          Cancel
        </button>
        <button
          v-else-if="showRun"
          type="button"
          class="run-btn"
          :disabled="disabled || runBusy || code.trim() === ''"
          :aria-busy="runBusy || undefined"
          @click="emit('run')"
        >
          <UiIcon
            :name="runBusy ? 'loader' : 'play'"
            :size="12"
            :stroke="2.4"
            :class="runBusy ? 'animate-spin-slow' : ''"
          />
          {{ runLabel }}
        </button>

        <!-- The ONE announced line. Putting aria-live on the check list would make
             a screen reader re-read every row on every re-render. -->
        <span
          :class="['mono-num min-w-0 text-[11.5px]', summary.tone]"
          aria-live="polite"
          >{{ summary.text }}</span
        >

        <span
          v-if="showRun"
          class="mono-num ml-auto hidden text-[10.5px] text-code-meta @[420px]:inline"
          >⌘↵ to run</span
        >
      </footer>

      <p
        v-if="stale && run"
        class="flex shrink-0 items-center gap-1.5 border-t border-warn-bright/30 bg-warn-bright/10 px-3.5 py-2 text-[11.5px] text-warn-bright"
      >
        <UiIcon
          name="alert"
          :size="12"
        />
        Edited since this run — run again to submit.
      </p>

      <slot name="hints" />

      <p class="shrink-0 border-t border-code-line px-3.5 py-2 text-[10.5px] text-code-meta">
        Tab indents inside the editor. Press Esc, then Tab, to move on.
      </p>
    </div>
  </div>
</template>

<style scoped>
.lang-tile {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--lc);
  background: color-mix(in oklab, var(--lc) 20%, transparent);
  border: 1px solid color-mix(in oklab, var(--lc) 34%, transparent);
}

.strip-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 11px;
  border-radius: 99px;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--color-code-dim);
  background: rgb(255 255 255 / 0.06);
  border: 1px solid rgb(255 255 255 / 0.1);
  cursor: pointer;
  transition:
    background-color 0.14s ease,
    color 0.14s ease;
}
.strip-btn:hover:not(:disabled) {
  background: color-mix(in oklab, var(--color-code-line) 60%, transparent);
  color: var(--color-code-text);
}
.strip-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.pane-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 9px;
  border-bottom: 2px solid transparent;
  font-size: 11.5px;
  font-weight: 500;
  white-space: nowrap;
  color: var(--color-code-meta);
  cursor: pointer;
  transition: color 0.14s ease;
}
.pane-tab:hover {
  color: var(--color-code-dim);
}
.pane-tab.is-active {
  color: var(--color-code-text);
  border-bottom-color: var(--color-accent-on-dark);
}

/* Cobalt's run pill: lime carrying ink, the one loud thing on the ink stage. */
.run-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 15px 0 12px;
  border-radius: 99px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--ink);
  background: var(--lime);
  cursor: pointer;
  transition:
    background-color 0.14s ease,
    transform 0.14s ease;
}
.run-btn:hover:not(:disabled) {
  background: #d2f86a;
}
.run-btn:active:not(:disabled) {
  transform: scale(0.97);
}
.run-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.console-out {
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--color-code-text);
}
.console-err {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  color: var(--color-danger-on-dark);
  background: color-mix(in oklab, var(--color-danger-on-dark) 12%, transparent);
  border: 1px solid color-mix(in oklab, var(--color-danger-on-dark) 26%, transparent);
}
.console-err pre {
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
