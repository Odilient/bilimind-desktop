<script setup lang="ts">
import type { Assessment, AttemptResponse, CodeTest } from '~/types/api'
import type { SandboxTest } from '~/composables/useWasmSandbox'
import {
  buildSpec,
  clearDraft,
  lockBodyScroll,
  readDraft,
  unlockBodyScroll,
  writeDraft,
} from '~/composables/useCodeExercise'
import { OPEN_SANDBOX } from '~/composables/useWorkspace'
import ExercisePane from './code/ExercisePane.vue'
import HintTrail from './code/HintTrail.vue'

/**
 * The code exercise: state, and nothing about how it looks.
 *
 * Everything the learner writes runs 100% client-side, in the WebAssembly worker
 * (SECURITY MODEL). The server never executes any of it — it compares the names
 * this component reports against the names the block declared, and records out
 * loud that it ran nothing itself. That is why the panel says so too.
 *
 * `ExercisePane` renders both the inline card and the full-screen takeover, and
 * only one of them is mounted at a time. The version before this one kept two
 * hand-written copies of that panel and the phone copy had already drifted —
 * different buttons, no console, its own results list.
 */
const props = withDefaults(
  defineProps<{
    assessment: Assessment
    disabled?: boolean
    /** Everything below is handed down by the `code` block that owns the payload. */
    mode?: string
    language?: string
    starterCode?: string
    tests?: CodeTest[]
    hints?: string[]
    requirements?: string[]
    setupSql?: string
    tables?: Array<{ name: string; columns: string[] }>
    symptomMarkdown?: string
  }>(),
  { starterCode: '', tests: () => [], language: 'javascript', hints: () => [] },
)

const model = defineModel<AttemptResponse | null>({ default: null })

/** Provided by the workspace; null in a read-only/shared view, which has no tabs. */
const openSandboxTab = inject(OPEN_SANDBOX, null)

const spec = computed(() =>
  buildSpec({
    mode: props.mode,
    language: props.language,
    tests: props.tests,
    setupSql: props.setupSql,
    tables: props.tables,
    requirements: props.requirements,
    symptomMarkdown: props.symptomMarkdown,
    hints: props.hints,
  }),
)

const code = ref(props.starterCode)
const exercise = useCodeExercise(spec, code)

const phase = computed(() => exercise.sandbox.phase(spec.value.lang))

/* -- Runtime warm-up ------------------------------------------------------- */

/**
 * Warmed on INTENT, never on mount. Pyodide is ~10MB, and paying it for every
 * lesson that merely contains a Python exercise taxes content the learner may
 * scroll straight past.
 */
let warmed = false

function warmOnIntent(): void {
  if (warmed || spec.value.lang === 'html') return
  warmed = true
  void exercise.sandbox.warmup(spec.value.lang)
}

/* -- Running --------------------------------------------------------------- */

const runsMade = ref(0)

async function onRun(): Promise<void> {
  if (props.disabled || exercise.running.value || code.value.trim() === '') return
  warmOnIntent()
  await exercise.runAll()
  if (exercise.lastRun.value) runsMade.value += 1
  syncModel()
}

/* -- Reset, with a way back ------------------------------------------------ */

/** Losing thirty lines of Python to a mis-click is the kind of thing that ends a session. */
const stashed = ref<string | null>(null)
let undoTimer: ReturnType<typeof setTimeout> | undefined

function reset(): void {
  if (code.value !== props.starterCode) stashed.value = code.value
  code.value = props.starterCode
  exercise.reset()
  clearDraft(props.assessment.id)
  restoredDraft.value = false
  // The results are gone, so what was submittable a moment ago is not. Resetting
  // to a buffer that already matched the starter changes no ref, and the `code`
  // watcher that normally does this would never fire.
  syncModel()

  if (undoTimer) clearTimeout(undoTimer)
  undoTimer = setTimeout(() => {
    stashed.value = null
  }, 8000)
}

function undoReset(): void {
  if (stashed.value === null) return
  code.value = stashed.value
  stashed.value = null
  if (undoTimer) clearTimeout(undoTimer)
}

/* -- Hints ----------------------------------------------------------------- */

const hintsRevealed = ref(0)

/** Non-whitespace characters written past the starter — "they have had a go". */
const attempted = computed(() => {
  if (runsMade.value > 0) return true
  const written = code.value.replace(/\s/g, '').length
  const starter = props.starterCode.replace(/\s/g, '').length
  return written - starter >= 20
})

/* -- Focus mode ------------------------------------------------------------ */

/**
 * Which output tab is showing. It lives here rather than inside the pane because
 * only one pane is mounted at a time — reading the console, hitting Focus and
 * landing back on Checks is the kind of small betrayal that makes a panel feel
 * like it is not listening.
 */
const paneTab = ref('')

const focused = ref(false)
const inlineRoot = useTemplateRef<HTMLElement>('inlineRoot')
const focusPane = useTemplateRef<{ focus: () => void }>('focusPane')

function openFocus(): void {
  warmOnIntent()
  focused.value = true
  void nextTick(() => focusPane.value?.focus())
}

function closeFocus(): void {
  focused.value = false
  // Focus goes back where it came from. The inline pane is remounted by then, so
  // the button is found by role rather than held as a reference.
  void nextTick(() => {
    inlineRoot.value?.querySelector<HTMLButtonElement>('[data-focus-toggle]')?.focus()
  })
}

watch(focused, (open) => {
  if (open) lockBodyScroll()
  else unlockBodyScroll()
})

/**
 * While the takeover is open the chords have to work from anywhere in it, and it
 * is teleported out of this component's tree — so the listener is on the window
 * rather than on a root that no longer contains the dialog.
 */
function onWindowKeydown(event: KeyboardEvent): void {
  if (!focused.value) return

  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault()
    void onRun()
    return
  }

  if (event.key !== 'Escape') return

  // Deliberate two-press ordering: the first Escape leaves the editor (the
  // keymap in CodeEditor blurs it), the second closes the takeover. Without
  // this, a keyboard user could never step out of the editor without losing
  // the whole panel.
  const target = event.target as HTMLElement | null
  if (target?.closest?.('.cm-editor')) return

  closeFocus()
}

/** The same chord, for focus sitting anywhere on the inline card. */
function onCardKeydown(event: KeyboardEvent): void {
  if (!(event.metaKey || event.ctrlKey) || event.key !== 'Enter') return
  event.preventDefault()
  void onRun()
}

onMounted(() => window.addEventListener('keydown', onWindowKeydown))

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeydown)
  if (undoTimer) clearTimeout(undoTimer)
  if (draftTimer) clearTimeout(draftTimer)
  if (focused.value) unlockBodyScroll()
})

/* -- Draft persistence ----------------------------------------------------- */

const restoredDraft = ref(false)
let draftTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  const draft = readDraft(props.assessment.id)
  if (draft === null || draft.trim() === '' || draft === props.starterCode) return
  code.value = draft
  restoredDraft.value = true
})

function useStarterInstead(): void {
  code.value = props.starterCode
  clearDraft(props.assessment.id)
  restoredDraft.value = false
}

/* -- Model ----------------------------------------------------------------- */

/**
 * True when the block declared nothing checkable, so the server graded this item
 * as self-assessed rather than leaving it stuck `pending` forever. The exercise
 * is unchanged — an explorable fixture still runs queries, a visual build still
 * previews — only who decides it is done.
 */
const selfGraded = computed(() => props.assessment.grader === 'self')

function syncModel(): void {
  const response = exercise.attemptResponse()

  // `SelfGrader` reads `completed`/`note` and nothing else, and Laravel's
  // `validated()` drops every key the rules do not declare — so the assertion it
  // actually reads is sent alongside the work, rather than instead of it.
  model.value = (
    response !== null && selfGraded.value ? { ...response, completed: true } : response
  ) as AttemptResponse | null
}

watch(code, (value) => {
  exercise.markStale()
  syncModel()

  if (draftTimer) clearTimeout(draftTimer)
  draftTimer = setTimeout(() => writeDraft(props.assessment.id, value), 600)
})

watch(
  () => props.starterCode,
  (value) => {
    if (code.value.trim() === '') code.value = value
  },
)

onMounted(syncModel)

/* -- Pop out into the workspace's own sandbox tab -------------------------- */

const canPopOut = computed(() => openSandboxTab !== null && spec.value.lang !== 'html')

function openInSandbox(): void {
  openSandboxTab?.({
    key: props.assessment.id,
    title: `Sandbox · ${spec.value.lang}`,
    lang: spec.value.lang,
    code: code.value,
    tests: spec.value.checks
      .map((check) => check.test)
      .filter((test): test is SandboxTest => test !== undefined),
  })
}
</script>

<template>
  <div
    ref="inlineRoot"
    class="flex flex-col gap-3"
    @keydown="onCardKeydown"
  >
    <p
      v-if="restoredDraft"
      class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[12px] bg-surface-mute px-3.5 py-2 text-[12px] text-text-soft"
    >
      <UiIcon
        name="refresh"
        :size="12"
      />
      Restored the code you had open in this tab.
      <button
        type="button"
        class="cursor-pointer font-semibold text-brand underline underline-offset-2"
        @click="useStarterInstead"
      >
        Use the starter instead
      </button>
    </p>

    <ExercisePane
      v-if="!focused"
      v-model="code"
      v-model:tab="paneTab"
      variant="inline"
      :spec="spec"
      :disabled="disabled"
      :running="exercise.running.value"
      :progress="exercise.progress.value"
      :run="exercise.lastRun.value"
      :stale="exercise.stale.value"
      :can-cancel="exercise.canCancel.value"
      :phase="phase"
      :passed-count="exercise.passedCount.value"
      :label="assessment.prompt"
      :can-reset="code !== starterCode"
      :can-undo-reset="stashed !== null"
      :timeout-ms="exercise.TIMEOUT_MS"
      @run="onRun"
      @cancel="exercise.cancel"
      @reset="reset"
      @undo-reset="undoReset"
      @open-focus="openFocus"
      @close-focus="closeFocus"
      @editor-focus="warmOnIntent"
    >
      <template #actions>
        <button
          v-if="canPopOut"
          type="button"
          class="strip-btn"
          title="Open this exercise in its own sandbox tab"
          @click="openInSandbox"
        >
          <UiIcon
            name="external"
            :size="12"
          />
          <span class="hidden @[520px]:inline">Open in sandbox</span>
        </button>
      </template>

      <template #hints>
        <HintTrail
          :hints="spec.hints"
          :revealed="hintsRevealed"
          :locked="!attempted"
          lock-reason="Have a go first — run it once, or write a few lines. A hint read before the attempt replaces the attempt."
          @reveal="hintsRevealed += 1"
        />
      </template>
    </ExercisePane>

    <ClientOnly>
      <Teleport to="body">
        <ExercisePane
          v-if="focused"
          ref="focusPane"
          v-model="code"
          v-model:tab="paneTab"
          variant="focus"
          :spec="spec"
          :disabled="disabled"
          :running="exercise.running.value"
          :progress="exercise.progress.value"
          :run="exercise.lastRun.value"
          :stale="exercise.stale.value"
          :can-cancel="exercise.canCancel.value"
          :phase="phase"
          :passed-count="exercise.passedCount.value"
          :label="assessment.prompt"
          :can-reset="code !== starterCode"
          :can-undo-reset="stashed !== null"
          :timeout-ms="exercise.TIMEOUT_MS"
          @run="onRun"
          @cancel="exercise.cancel"
          @reset="reset"
          @undo-reset="undoReset"
          @open-focus="openFocus"
          @close-focus="closeFocus"
          @editor-focus="warmOnIntent"
        >
          <template #hints>
            <HintTrail
              :hints="spec.hints"
              :revealed="hintsRevealed"
              :locked="!attempted"
              lock-reason="Have a go first — run it once, or write a few lines."
              @reveal="hintsRevealed += 1"
            />
          </template>
        </ExercisePane>
      </Teleport>
    </ClientOnly>

    <p class="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-text-faint">
      <UiIcon
        :name="spec.graded ? 'lock' : 'alert'"
        :size="12"
        class="mt-px"
      />
      <span v-if="spec.mode === 'build' && !spec.graded">
        Your page is previewed in this browser and never executed on the server. Nothing here is
        checked automatically — it is submitted as done when you say it is.
      </span>
      <span v-else-if="!spec.graded">
        Your code runs in a sandboxed WebAssembly worker in this browser, never on the server. This
        exercise declares nothing that can be checked automatically, so it is recorded as done when
        you say it is.
      </span>
      <span v-else>
        Your code runs in a sandboxed WebAssembly worker in this browser, with a
        {{ Math.round(exercise.TIMEOUT_MS / 1000) }}s timeout — never on the server. The results
        above are what gets submitted.
      </span>
    </p>
  </div>
</template>

<style scoped>
/* The pop-out control sits in the pane's dark strip, so it wears the strip's
   clothes rather than the light card's. */
.strip-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 8px;
  border-radius: 7px;
  font-size: 11.5px;
  color: var(--color-code-dim);
  border: 1px solid var(--color-code-line);
  cursor: pointer;
  transition:
    background-color 0.14s ease,
    color 0.14s ease;
}
.strip-btn:hover {
  background: color-mix(in oklab, var(--color-code-line) 60%, transparent);
  color: var(--color-code-text);
}
</style>
