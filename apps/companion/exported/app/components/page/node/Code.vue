<script setup lang="ts">
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import type { RunLang, RunResult } from '~/composables/useWasmSandbox'
import { CODE_LANGUAGES, SQL_FIXTURE } from '~/companion/doc/editor/code'

/**
 * Code on a page: the dark CodeMirror look, and for JavaScript, Python and SQL
 * a Run button. Runs go through `useWasmSandbox`, the same WebAssembly worker
 * the course player uses, so nothing ever runs on a server and an infinite
 * loop is killed after five seconds. SQL runs against a fresh copy of a small
 * lab database each time. A "Diagram" block is Mermaid text drawn below.
 */
const props = defineProps(nodeViewProps)
const sandbox = useWasmSandbox()

const language = computed(() => String(props.node.attrs.language || 'plain'))
const info = computed(() => CODE_LANGUAGES.find((l) => l.id === language.value) ?? CODE_LANGUAGES[4])
const runnable = computed(() => info.value.runs)
const isDiagram = computed(() => language.value === 'mermaid')

const result = ref<RunResult | null>(null)
const running = ref(false)

const note = computed(() => {
  if (language.value === 'sql') return 'runs here, on a copy of the lab database'
  if (runnable.value) return 'runs here, in your browser'
  if (isDiagram.value) return 'drawn from the text'
  return ''
})

const warming = computed(() => runnable.value && sandbox.warming(language.value as RunLang))

function setLanguage(value: string): void {
  result.value = null
  props.updateAttributes({ language: value })
}

async function run(): Promise<void> {
  if (!runnable.value || running.value) return
  running.value = true
  try {
    result.value = await sandbox.run({
      lang: language.value as RunLang,
      code: props.node.textContent,
      setup: language.value === 'sql' ? SQL_FIXTURE : undefined,
    })
  } finally {
    running.value = false
  }
}

const summary = computed(() => {
  const r = result.value
  if (!r) return ''
  if (r.timedOut) return 'Stopped after 5 seconds. Is there a loop that never ends?'
  if (!r.ok) return ''
  if (r.table) return `${r.table.rows.length} ${r.table.rows.length === 1 ? 'row' : 'rows'}`
  if (!r.stdout.trim()) return language.value === 'sql' ? 'Done. No rows came back.' : 'Done. Nothing was printed.'
  return ''
})

function cell(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  return String(value)
}

/* -- Diagram ----------------------------------------------------------------- */

const svg = ref('')
const diagramFailed = ref(false)
let renders = 0
let timer: ReturnType<typeof setTimeout> | null = null

async function draw(): Promise<void> {
  const source = props.node.textContent.trim()
  if (!source) {
    svg.value = ''
    return
  }
  try {
    const mermaid = (await import('mermaid')).default
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      // Same values as the course player's DiagramBlock: cobalt's tokens in hex,
      // because Mermaid computes shades from them in JS.
      themeVariables: {
        background: '#f6f7fa',
        primaryColor: '#ffffff',
        primaryBorderColor: '#2a2e37',
        primaryTextColor: '#0b0d10',
        secondaryColor: '#eef1fe',
        secondaryBorderColor: '#2340e6',
        tertiaryColor: '#eef9cf',
        tertiaryBorderColor: '#b4e03a',
        lineColor: '#9da2ae',
        textColor: '#2a2e37',
        fontSize: '13px',
      },
      fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
      flowchart: { htmlLabels: false, curve: 'basis' },
    })
    renders += 1
    const { svg: rendered } = await mermaid.render(`pg-diagram-${Math.random().toString(36).slice(2)}-${renders}`, source)
    svg.value = rendered
    diagramFailed.value = false
  } catch {
    diagramFailed.value = true
  }
}

watch(
  () => [isDiagram.value, props.node.textContent] as const,
  ([diagram]) => {
    if (!diagram) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void draw(), 400)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <NodeViewWrapper
    class="pg-code"
    :class="{ 'is-diagram': isDiagram }"
  >
    <div
      class="pg-code-bar"
      contenteditable="false"
    >
      <select
        class="pg-code-lang"
        :value="language"
        aria-label="Language"
        :disabled="!editor.isEditable"
        @change="setLanguage(($event.target as HTMLSelectElement).value)"
      >
        <option
          v-for="l in CODE_LANGUAGES"
          :key="l.id"
          :value="l.id"
        >
          {{ l.label }}
        </option>
      </select>
      <span class="pg-code-note">{{ note }}</span>
      <button
        v-if="runnable"
        type="button"
        class="pg-code-run"
        :disabled="running"
        @click="run"
      >
        <UiIcon
          name="play"
          :size="10"
          :stroke="2.4"
        />{{ running ? (warming ? 'Loading…' : 'Running') : 'Run' }}
      </button>
    </div>
    <pre class="pg-code-pre"><NodeViewContent
      as="code"
      class="pg-code-text"
      spellcheck="false"
    /></pre>
    <div
      v-if="result"
      class="pg-code-out"
      contenteditable="false"
      role="status"
    >
      <pre
        v-if="result.stdout.trim()"
        class="pg-code-stdout"
      >{{ result.stdout.trimEnd() }}</pre>
      <div
        v-if="result.table && result.table.columns.length"
        class="pg-code-table"
      >
        <table>
          <thead>
            <tr>
              <th
                v-for="c in result.table.columns"
                :key="c"
              >
                {{ c }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(r, i) in result.table.rows.slice(0, 50)"
              :key="i"
            >
              <td
                v-for="(v, j) in r"
                :key="j"
              >
                {{ cell(v) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <pre
        v-if="result.stderr.trim()"
        class="pg-code-stderr"
      >{{ result.stderr.trimEnd() }}</pre>
      <span
        v-if="summary"
        class="pg-code-summary"
      >{{ summary }}</span>
    </div>
    <div
      v-if="isDiagram"
      class="pg-code-diagram"
      contenteditable="false"
    >
      <div
        v-if="svg && !diagramFailed"
        v-html="svg"
      />
      <span
        v-else-if="diagramFailed"
        class="pg-code-summary"
      >The diagram has a mistake in it; the text above is kept as it is.</span>
    </div>
  </NodeViewWrapper>
</template>
