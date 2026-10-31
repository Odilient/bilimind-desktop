import CodeBlock from '@tiptap/extension-code-block'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import { classHighlighter, highlightTree } from '@lezer/highlight'
import type { Parser } from '@lezer/common'
import { javascriptLanguage } from '@codemirror/lang-javascript'
import { pythonLanguage } from '@codemirror/lang-python'
import { SQLite } from '@codemirror/lang-sql'
import CodeView from '~/components/page/node/Code.vue'

/**
 * A code block that looks like CodeMirror and runs in the WASM sandbox.
 *
 * The code stays ordinary ProseMirror text, so it syncs, undoes, drags and
 * exports like any other block. The colour comes from CodeMirror's own Lezer
 * parsers, run over each block and laid on top as decorations with the same
 * `tok-*` classes CodeMirror uses. A nested CodeMirror editor would have meant
 * keeping two documents in step on every keystroke for no visible gain.
 */

export const CODE_LANGUAGES = [
  { id: 'javascript', label: 'JavaScript', runs: true },
  { id: 'python', label: 'Python', runs: true },
  { id: 'sql', label: 'SQL', runs: true },
  { id: 'mermaid', label: 'Diagram', runs: false },
  { id: 'plain', label: 'Plain text', runs: false },
] as const

function parserFor(language: unknown): Parser | null {
  switch (language) {
    case 'javascript':
    case 'js':
      return javascriptLanguage.parser
    case 'python':
    case 'py':
      return pythonLanguage.parser
    case 'sql':
      return SQLite.language.parser
    default:
      return null
  }
}

function blockDecorations(node: PMNode, pos: number): Decoration[] {
  const parser = parserFor(node.attrs.language)
  if (!parser) return []
  const out: Decoration[] = []
  const start = pos + 1
  highlightTree(parser.parse(node.textContent), classHighlighter, (from, to, classes) => {
    out.push(Decoration.inline(start + from, start + to, { class: classes }))
  })
  return out
}

function decorate(doc: PMNode): DecorationSet {
  const all: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'codeBlock') return true
    all.push(...blockDecorations(node, pos))
    return false
  })
  return DecorationSet.create(doc, all)
}

const highlightKey = new PluginKey<DecorationSet>('page-code-highlight')

export const PageCodeBlock = CodeBlock.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      language: {
        default: 'javascript',
        parseHTML: (el: HTMLElement) =>
          el.getAttribute('data-language') ??
          [...(el.firstElementChild?.classList ?? [])].find((c) => c.startsWith('language-'))?.slice(9) ??
          'javascript',
        renderHTML: (attrs: Record<string, unknown>) => ({ 'data-language': attrs.language }),
      },
    }
  },

  addNodeView() {
    return VueNodeViewRenderer(CodeView)
  },

  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      new Plugin<DecorationSet>({
        key: highlightKey,
        state: {
          init: (_, { doc }) => decorate(doc),
          apply: (tr, set) => (tr.docChanged ? decorate(tr.doc) : set.map(tr.mapping, tr.doc)),
        },
        props: {
          decorations(state) {
            return highlightKey.getState(state)
          },
        },
      }),
    ]
  },
}).configure({
  // Tab indents inside code rather than leaving the block.
  enableTabIndentation: true,
  tabSize: 2,
})

/**
 * "A copy of the lab database": the table every SQL block on a page runs
 * against, rebuilt fresh for each run so nothing a learner does sticks.
 */
export const SQL_FIXTURE = `
CREATE TABLE accounts (id INTEGER PRIMARY KEY, owner TEXT NOT NULL, balance INTEGER NOT NULL);
INSERT INTO accounts VALUES (1, 'Kamila', 500), (2, 'Jasur', 250), (3, 'Aziza', 1200);
CREATE TABLE transfers (id INTEGER PRIMARY KEY, from_id INTEGER, to_id INTEGER, amount INTEGER, at TEXT);
INSERT INTO transfers VALUES (1, 1, 2, 100, '2026-10-20'), (2, 3, 1, 50, '2026-10-21');
`
