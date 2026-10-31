<script setup lang="ts">
import { basicSetup } from 'codemirror'
import { EditorView, keymap } from '@codemirror/view'
import { EditorState, Compartment, type Extension } from '@codemirror/state'
import { indentWithTab } from '@codemirror/commands'
import { oneDark } from '@codemirror/theme-one-dark'
import { python } from '@codemirror/lang-python'
import { javascript } from '@codemirror/lang-javascript'
import { sql } from '@codemirror/lang-sql'
import { html } from '@codemirror/lang-html'

/**
 * A thin CodeMirror 6 wrapper. This is the DARK code surface of the sandbox —
 * always `@codemirror/theme-one-dark` regardless of the light workspace chrome
 * around it, matching the `--color-code-*` palette the rest of the sandbox uses.
 *
 * CodeMirror needs a live DOM, so the whole `EditorView` is built inside
 * `onMounted` (client only) and the module imports here never touch the DOM at
 * import time — safe to statically import in an SSR build. During SSR the root
 * div renders empty and the editor hydrates on the client.
 *
 * `modelValue` is a normal `v-model`. Language, read-only state and height are
 * each held in a CodeMirror Compartment so they can be reconfigured live
 * without tearing the editor down.
 */

type EditorLang = 'python' | 'javascript' | 'sql' | 'html'

const props = withDefaults(
  defineProps<{
    language?: EditorLang
    readonly?: boolean
    /** CSS height for the editor host, e.g. '320px' or '100%'. */
    height?: string
    /** Placeholder-ish label announced to assistive tech. */
    ariaLabel?: string
    /**
     * Tab inserts an indent instead of moving to the next control. True by
     * default because Tab-to-indent is genuinely useful in Python — see the
     * Escape keymap below, which is what keeps that from being a keyboard trap.
     */
    tabIndents?: boolean
  }>(),
  {
    language: 'javascript',
    readonly: false,
    height: '320px',
    ariaLabel: 'Code editor',
    tabIndents: true,
  },
)

const model = defineModel<string>({ default: '' })

const emit = defineEmits<{
  /** Fired on Cmd/Ctrl+Enter — the muscle-memory "run this" chord. */
  run: []
  /**
   * The learner has put the cursor in here. Callers use it as the signal to
   * start downloading a runtime, so nothing is fetched for an exercise that is
   * only scrolled past.
   */
  focus: []
}>()

const host = ref<HTMLElement | null>(null)
let view: EditorView | null = null

const languageConf = new Compartment()
const readonlyConf = new Compartment()

function langExtension(lang: EditorLang): Extension {
  switch (lang) {
    case 'python':
      return python()
    case 'sql':
      return sql()
    case 'html':
      return html()
    case 'javascript':
    default:
      return javascript()
  }
}

function readonlyExtension(ro: boolean): Extension {
  return [EditorState.readOnly.of(ro), EditorView.editable.of(!ro)]
}

/** Fills its host; the host's own height (a prop) is the single source of size. */
const heightTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px', backgroundColor: 'transparent' },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.6',
  },
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none' },
  '.cm-content': { padding: '10px 0' },
  '&.cm-focused': { outline: 'none' },
})

onMounted(() => {
  if (!host.value) return

  const state = EditorState.create({
    doc: model.value,
    extensions: [
      basicSetup,
      keymap.of([
        { key: 'Mod-Enter', preventDefault: true, run: () => (emit('run'), true) },
        // WCAG 2.1.2, No Keyboard Trap. `indentWithTab` takes Tab away from the
        // learner, so there has to be a documented way back out and this is it:
        // Escape blurs, and the next Tab moves on. Bound unconditionally and
        // FIRST, so it works even where Tab does not indent.
        {
          key: 'Escape',
          run: (target) => {
            target.contentDOM.blur()
            return true
          },
        },
        ...(props.tabIndents ? [indentWithTab] : []),
      ]),
      languageConf.of(langExtension(props.language)),
      readonlyConf.of(readonlyExtension(props.readonly)),
      oneDark,
      heightTheme,
      EditorView.domEventHandlers({
        focus: () => {
          emit('focus')
          // Never claim the event: CodeMirror still needs its own focus handling.
          return false
        },
      }),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return
        const next = update.state.doc.toString()
        // Guard the feedback loop: only emit when the value truly diverged.
        if (next !== model.value) model.value = next
      }),
    ],
  })

  view = new EditorView({ state, parent: host.value })
})

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})

// External model changes (reset, postMessage init) → replace the document.
watch(model, (next) => {
  if (!view) return
  const current = view.state.doc.toString()
  if (next === current) return
  view.dispatch({
    changes: { from: 0, to: current.length, insert: next ?? '' },
  })
})

watch(
  () => props.language,
  (lang) => {
    view?.dispatch({ effects: languageConf.reconfigure(langExtension(lang)) })
  },
)

watch(
  () => props.readonly,
  (ro) => {
    view?.dispatch({ effects: readonlyConf.reconfigure(readonlyExtension(ro)) })
  },
)

defineExpose({
  /** Move keyboard focus into the editor. */
  focus: () => view?.focus(),
})
</script>

<template>
  <div
    ref="host"
    class="sandbox-editor w-full overflow-hidden"
    :style="{ height }"
    role="textbox"
    aria-multiline="true"
    :aria-label="ariaLabel"
    :aria-readonly="readonly || undefined"
  />
</template>

<style scoped>
/* Let the dark editor bleed to its container edges; the panel owns the border. */
.sandbox-editor :deep(.cm-editor) {
  height: 100%;
  background: transparent;
}
</style>
