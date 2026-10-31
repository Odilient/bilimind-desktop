<script setup lang="ts">
import type { RunLang, RunResult, SandboxTest, SandboxTestResult } from '~/composables/useWasmSandbox'
import { LANG_MARKS } from '~/composables/useCodeExercise'
import ResultTable from '~/components/assessments/code/ResultTable.vue'
import HtmlPreview from '~/components/assessments/code/HtmlPreview.vue'

/**
 * The Codecademy-style coding studio: a language switch with real language marks,
 * Run/Reset, a live timing readout, the dark CodeMirror surface, and an output
 * region that dresses itself to the language — a terminal for console text, a
 * data grid for SQL, or a little browser window for an HTML preview.
 *
 * All execution goes through `useWasmSandbox`, which runs the code 100%
 * client-side in WebAssembly — the server never sees it. The panel keeps its OWN
 * editable copy of the code/language seeded from the `initialCode`/`initialLang`
 * props and re-seeds when the host swaps them (a popped-out window receiving a
 * fresh `sandbox-init` payload). Every run emits `result` so an embedding lesson
 * — or the standalone window — can capture pass/fail.
 */

const props = withDefaults(
  defineProps<{
    initialCode?: string
    initialLang?: RunLang
    tests?: SandboxTest[]
    /** Lock the language switch to a single language. */
    lockLanguage?: boolean
    /** Tighter, shorter layout for embedding inside a lesson block. */
    compact?: boolean
    /** Wall-clock kill switch handed to the sandbox. */
    timeoutMs?: number
  }>(),
  { initialCode: '', initialLang: 'python', tests: () => [], lockLanguage: false, compact: false },
)

const emit = defineEmits<{
  result: [result: RunResult]
  'update:code': [code: string]
}>()

const { running, run, warmup, ready, warming } = useWasmSandbox()

/**
 * Per-language identity. The monogram and its colour come from `LANG_MARKS`, so
 * this panel and the inline exercise card cannot end up labelling the same
 * runtime two different ways; only the starter snippet belongs to the sandbox.
 */
const STARTER_SNIPPETS: Record<RunLang, string> = {
  python: 'print("Hello from Python")\n',
  javascript: 'console.log("Hello from JavaScript")\n',
  sql: "SELECT 1 AS answer, 'ok' AS status;\n",
  html: '<!doctype html>\n<h1>Hello</h1>\n<p>Edit me and press Run.</p>\n',
}

const LANGS: Array<{
  value: RunLang
  label: string
  glyph: string
  color: string
  starter: string
}> = (['python', 'javascript', 'sql', 'html'] as const).map((value) => ({
  value,
  ...LANG_MARKS[value],
  starter: STARTER_SNIPPETS[value],
}))
const langMeta = (l: RunLang) => LANGS.find((x) => x.value === l)!
const STARTERS = Object.fromEntries(LANGS.map((l) => [l.value, l.starter])) as Record<RunLang, string>

const lang = ref<RunLang>(props.initialLang)
const code = ref<string>(props.initialCode || STARTERS[props.initialLang])
const result = ref<RunResult | null>(null)
const hasRun = ref(false)

const active = computed(() => langMeta(lang.value))

// Re-seed when the host swaps the payload (postMessage init / lesson change).
watch(
  () => [props.initialCode, props.initialLang] as const,
  ([nextCode, nextLang]) => {
    lang.value = nextLang
    code.value = nextCode || STARTERS[nextLang]
    result.value = null
    hasRun.value = false
  },
)

watch(code, (value) => emit('update:code', value))

const editorLang = computed(() => lang.value as 'python' | 'javascript' | 'sql' | 'html')

/* -------------------------------------------------------------------------- */
/* Runtime warmup — decouple the one-time download from the 5s exec limit      */
/* -------------------------------------------------------------------------- */

const isWarming = computed(() => warming(lang.value))
const isReady = computed(() => ready(lang.value))

// While the runtime is still downloading and nothing has been run yet, the
// output panel explains the wait instead of sitting blank.
const showPreparing = computed(() => isWarming.value && !hasRun.value)

const runBusy = computed(() => running.value || isWarming.value)
const runLabel = computed(() => (running.value ? 'Running' : isWarming.value ? 'Preparing' : 'Run'))

/** A calm one-word runtime state shown as a status dot in the header. */
const runtimeState = computed<'ready' | 'loading' | 'idle'>(() => {
  if (lang.value === 'html') return 'ready'
  if (isReady.value) return 'ready'
  if (isWarming.value) return 'loading'
  return 'idle'
})

function warmCurrent(): void {
  if (lang.value === 'html' || isReady.value) return
  void warmup(lang.value)
}

onMounted(warmCurrent)

function onLangChange(next: RunLang) {
  if (next === lang.value) return
  const untouched = code.value.trim() === '' || code.value === STARTERS[lang.value]
  lang.value = next
  if (untouched) code.value = STARTERS[next]
  result.value = null
  hasRun.value = false
  warmCurrent()
}

watch(lang, warmCurrent)

/* -------------------------------------------------------------------------- */
/* Run                                                                         */
/* -------------------------------------------------------------------------- */

async function onRun() {
  if (running.value) return
  const res = await run({
    lang: lang.value,
    code: code.value,
    tests: props.tests.length ? props.tests : undefined,
    timeoutMs: props.timeoutMs,
  })
  result.value = res
  hasRun.value = true
  emit('result', res)
}

function onReset() {
  code.value = props.initialCode || STARTERS[lang.value]
  result.value = null
  hasRun.value = false
}

/* -------------------------------------------------------------------------- */
/* Derived output state                                                        */
/* -------------------------------------------------------------------------- */

const isHtml = computed(() => lang.value === 'html')
const isSql = computed(() => lang.value === 'sql')

const testResults = computed<SandboxTestResult[]>(() => result.value?.tests ?? [])
const passedCount = computed(() => testResults.value.filter((t) => t.passed).length)
const allPassed = computed(
  () => testResults.value.length > 0 && passedCount.value === testResults.value.length,
)

const errored = computed(
  () => !!result.value && (result.value.timedOut || !!result.value.error || !result.value.ok),
)

const consoleText = computed(() => result.value?.stdout || '')

const durationLabel = computed(() => {
  const r = result.value
  if (!r) return ''
  if (r.timedOut) return 'timed out'
  return `${Math.max(0, Math.round(r.durationMs))}ms`
})

const rowCount = computed(() => result.value?.table?.rows.length ?? 0)

const editorHeight = computed(() => (props.compact ? '220px' : '100%'))
const outputMinHeight = computed(() => (props.compact ? '150px' : '0'))

/** Cmd/Ctrl-Enter from inside the editor runs the current buffer. */
function onEditorRun() {
  if (!runBusy.value || isWarming.value) void onRun()
}
</script>

<template>
  <section
    class="sandbox-panel flex flex-col overflow-hidden rounded-[22px] bg-code-bg shadow-[0_40px_80px_-40px_rgb(11_13_16/0.55)]"
    :class="compact ? '' : 'h-full'"
    aria-label="Code sandbox"
  >
    <!-- Toolbar -->
    <header
      class="sandbox-bar flex flex-wrap items-center gap-x-1.5 gap-y-2 border-b border-code-line px-2.5 py-2"
    >
      <!-- Language marks -->
      <div
        v-if="!lockLanguage"
        class="flex items-center gap-1"
        role="tablist"
        aria-label="Language"
      >
        <button
          v-for="l in LANGS"
          :key="l.value"
          type="button"
          role="tab"
          :aria-selected="l.value === lang"
          class="lang-pill"
          :class="l.value === lang ? 'is-active' : ''"
          :style="{ '--lc': l.color }"
          @click="onLangChange(l.value)"
        >
          <span
            class="lang-tile"
            aria-hidden="true"
            >{{ l.glyph }}</span
          >
          <span class="lang-label">{{ l.label }}</span>
        </button>
      </div>
      <div
        v-else
        class="flex items-center gap-2 pl-1"
      >
        <span
          class="lang-tile is-static"
          :style="{ '--lc': active.color }"
          aria-hidden="true"
          >{{ active.glyph }}</span
        >
        <span class="text-[12.5px] font-semibold text-code-text">{{ active.label }}</span>
      </div>

      <div class="ml-auto flex items-center gap-1.5">
        <!-- runtime health -->
        <span
          class="hidden items-center gap-1.5 pr-1 sm:inline-flex"
          :title="`${active.label} runtime`"
        >
          <span
            class="size-1.5 rounded-full"
            :class="{
              'bg-success-bright': runtimeState === 'ready',
              'animate-pulse bg-warn-bright': runtimeState === 'loading',
              'bg-code-meta': runtimeState === 'idle',
            }"
          />
          <span class="text-[10.5px] tracking-tight text-code-meta">
            {{ runtimeState === 'loading' ? 'downloading' : runtimeState === 'ready' ? 'ready' : 'idle' }}
          </span>
        </span>

        <span
          v-if="durationLabel"
          class="mono-num text-[11px] tracking-tight"
          :class="errored ? 'text-danger-bright' : 'text-code-meta'"
          aria-live="polite"
          >{{ durationLabel }}</span
        >

        <span
          v-if="testResults.length"
          class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
          :class="allPassed ? 'bg-success/15 text-success-bright' : 'bg-danger/15 text-danger-bright'"
        >
          <UiIcon
            :name="allPassed ? 'check-circle' : 'alert'"
            :size="11"
          />
          {{ passedCount }}/{{ testResults.length }}
        </span>

        <button
          type="button"
          class="tool-btn"
          :disabled="running"
          title="Reset to the starter code"
          @click="onReset"
        >
          <UiIcon
            name="refresh"
            :size="13"
          />
          <span :class="compact ? 'sr-only' : ''">Reset</span>
        </button>

        <button
          type="button"
          class="run-btn"
          :disabled="running"
          :aria-busy="runBusy || undefined"
          @click="onRun"
        >
          <UiIcon
            :name="runBusy ? 'loader' : 'play'"
            :size="13"
            :class="runBusy ? 'animate-spin-slow' : ''"
          />
          {{ runLabel }}
          <kbd
            v-if="!runBusy && !compact"
            class="run-kbd"
            >⌘↵</kbd
          >
        </button>
      </div>
    </header>

    <!-- Body: editor + output -->
    <div
      class="flex min-h-0 flex-1"
      :class="compact ? 'flex-col' : 'flex-col lg:flex-row'"
    >
      <!-- Editor -->
      <div
        class="editor-wrap min-h-0 overflow-hidden"
        :class="compact ? 'border-b border-code-line' : 'flex-1 border-b border-code-line lg:border-r lg:border-b-0'"
      >
        <SandboxCodeEditor
          v-model="code"
          :language="editorLang"
          :height="editorHeight"
          aria-label="Code editor"
          @run="onEditorRun"
        />
      </div>

      <!-- Output -->
      <div
        class="flex min-h-0 flex-1 flex-col bg-code-bg"
        :style="{ minHeight: outputMinHeight }"
      >
        <div class="flex items-center gap-2 border-b border-code-line px-3 py-1.5">
          <span class="eyebrow-loud text-code-meta">Output</span>
          <span
            v-if="isSql && result?.table && hasRun"
            class="mono-num ml-auto text-[10.5px] text-code-meta"
            >{{ rowCount }} {{ rowCount === 1 ? 'row' : 'rows' }}</span
          >
        </div>

        <div class="om-scroll relative min-h-0 flex-1 overflow-auto">
          <!-- Preparing the runtime (the one-time WASM download). -->
          <div
            v-if="showPreparing"
            class="flex h-full min-h-[140px] flex-col items-center justify-center gap-3 px-6 py-8 text-center"
          >
            <span
              class="lang-tile is-loading size-9 text-[13px]"
              :style="{ '--lc': active.color }"
              >{{ active.glyph }}</span
            >
            <div>
              <p class="text-[12.5px] font-medium text-code-dim">Preparing the {{ active.label }} runtime</p>
              <p class="mt-0.5 text-[11px] text-code-meta">Downloads once, then every run is instant.</p>
            </div>
            <span class="prep-bar"><span class="prep-bar-fill" /></span>
          </div>

          <!-- Empty -->
          <div
            v-else-if="!hasRun"
            class="flex h-full min-h-[140px] flex-col items-center justify-center gap-2.5 px-6 py-8 text-center"
          >
            <span class="grid size-9 place-items-center rounded-full border border-code-line text-code-meta">
              <UiIcon
                name="play"
                :size="15"
              />
            </span>
            <p class="text-[12px] text-code-meta">
              Press <span class="font-semibold text-code-dim">Run</span> to see the result.
            </p>
          </div>

          <!-- HTML preview. The exercise card shows the same window, from the
               same component: two copies of browser chrome drift, and the one
               the learner sees would depend on which surface they opened. Here
               it is fed the RUN's output, so this panel stays run-driven. -->
          <HtmlPreview
            v-else-if="isHtml"
            :code="result?.stdout ?? ''"
            :debounce-ms="0"
            file-name="preview.html"
          />

          <!-- SQL result grid, shared with the inline `query` exercise. -->
          <ResultTable
            v-else-if="isSql && result?.table"
            :table="result.table"
          />

          <!-- Console -->
          <div
            v-else
            class="console p-3"
          >
            <pre
              v-if="consoleText"
              class="console-out"
            >{{ consoleText }}</pre>
            <div
              v-if="result?.stderr"
              class="console-err"
            >
              <UiIcon
                name="alert"
                :size="12"
                class="mt-0.5 shrink-0"
              />
              <pre>{{ result.stderr }}</pre>
            </div>
            <p
              v-if="!consoleText && !result?.stderr"
              class="text-[12px] text-code-meta"
            >
              Ran cleanly — no output.
            </p>
          </div>
        </div>

        <!-- Test detail footer -->
        <div
          v-if="testResults.length"
          class="border-t border-code-line px-3 py-2"
        >
          <ul class="flex flex-col gap-1">
            <li
              v-for="(t, i) in testResults"
              :key="i"
              class="flex items-baseline gap-2 text-[11.5px]"
            >
              <UiIcon
                :name="t.passed ? 'check' : 'x'"
                :size="12"
                :class="t.passed ? 'text-success-bright' : 'text-danger-bright'"
                class="translate-y-0.5"
              />
              <span class="font-medium text-code-dim">{{ t.name }}</span>
              <span
                v-if="!t.passed && t.detail"
                class="font-mono text-[11px] text-code-meta"
                >{{ t.detail }}</span
              >
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Subtle depth on the toolbar so it reads as a raised console, not a flat bar. */
.sandbox-bar {
  background: linear-gradient(180deg, color-mix(in oklab, var(--color-code-bar) 88%, white 4%), var(--color-code-bar));
}

/* Language marks — a coloured monogram tile + label. */
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
.lang-tile.is-static {
  width: 24px;
  height: 24px;
}
.lang-tile.is-loading {
  animation: tile-pulse 1.4s ease-in-out infinite;
}
@keyframes tile-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 color-mix(in oklab, var(--lc) 40%, transparent);
  }
  50% {
    box-shadow: 0 0 0 6px color-mix(in oklab, var(--lc) 0%, transparent);
  }
}

.lang-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 3px 9px 3px 4px;
  border-radius: 9px;
  cursor: pointer;
  color: var(--color-code-meta);
  border: 1px solid transparent;
  transition: background-color 0.14s ease, color 0.14s ease, border-color 0.14s ease;
}
.lang-pill .lang-label {
  font-size: 12px;
  font-weight: 500;
}
.lang-pill:hover {
  background: color-mix(in oklab, var(--color-code-line) 55%, transparent);
  color: var(--color-code-dim);
}
.lang-pill.is-active {
  background: color-mix(in oklab, var(--lc) 12%, transparent);
  border-color: color-mix(in oklab, var(--lc) 32%, transparent);
  color: var(--color-code-text);
}
.lang-pill:not(.is-active) .lang-tile {
  color: color-mix(in oklab, var(--color-code-meta) 90%, var(--lc));
  background: color-mix(in oklab, var(--color-code-line) 45%, transparent);
  border-color: transparent;
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-code-dim);
  border: 1px solid var(--color-code-line);
  cursor: pointer;
  transition: background-color 0.14s ease, color 0.14s ease;
}
.tool-btn:hover {
  background: color-mix(in oklab, var(--color-code-line) 60%, transparent);
  color: var(--color-code-text);
}
.tool-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

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
  transition: background-color 0.14s ease, transform 0.14s ease;
}
.run-btn:hover:not(:disabled) {
  background: #d2f86a;
}
.run-btn:active:not(:disabled) {
  transform: scale(0.97);
}
.run-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.run-kbd {
  font-family: var(--font-mono);
  font-size: 9.5px;
  line-height: 1;
  padding: 3px 4px;
  border-radius: 4px;
  color: color-mix(in oklab, var(--color-on-accent) 80%, transparent);
  background: color-mix(in oklab, black 22%, transparent);
}

/* Preparing progress shimmer. */
.prep-bar {
  position: relative;
  width: 132px;
  height: 3px;
  border-radius: 999px;
  overflow: hidden;
  background: color-mix(in oklab, var(--color-code-line) 70%, transparent);
}
.prep-bar-fill {
  position: absolute;
  inset: 0;
  width: 40%;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, var(--color-accent), transparent);
  animation: prep-slide 1.15s ease-in-out infinite;
}
@keyframes prep-slide {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(320%);
  }
}

/* Terminal console. */
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
  color: #fca5a5;
  background: color-mix(in oklab, #ef4444 12%, transparent);
  border: 1px solid color-mix(in oklab, #ef4444 26%, transparent);
}
.console-err pre {
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (prefers-reduced-motion: reduce) {
  .prep-bar-fill,
  .lang-tile.is-loading {
    animation: none;
  }
}
</style>
