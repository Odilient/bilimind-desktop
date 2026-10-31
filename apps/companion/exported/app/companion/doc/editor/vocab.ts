import { Extension } from '@tiptap/vue-3'
import { TableRow } from '@tiptap/extension-table'
import type { Node as PMNode } from '@tiptap/pm/model'

/**
 * A vocabulary list is an ordinary table whose rows become cards.
 *
 * Any table with a "Word" (or "Term") column and a "Meaning" (or
 * "Definition", "Translation") column qualifies, whichever template made it.
 * A row with both filled gets a card id stamped on it and a card row saved;
 * editing the row later updates that card's words. The id lives on the row,
 * so reordering or sorting the table keeps each card with its word.
 */

export const VocabRow = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      card_id: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-card-id'),
        renderHTML: (attrs: Record<string, unknown>) => (attrs.card_id ? { 'data-card-id': attrs.card_id } : {}),
      },
    }
  },
})

export interface VocabCard {
  id: string
  word: string
  meaning: string
  example: string
  isNew: boolean
}

interface VocabOptions {
  save: ((card: VocabCard) => void) | null
}

interface VocabStorage {
  timer: ReturnType<typeof setTimeout> | null
  /** What each card was last saved as, so unchanged rows aren't re-sent. */
  saved: Map<string, string>
  primed: boolean
}

const WORD = /^(word|term|phrase|vocab)/i
const MEANING = /^(meaning|definition|translation|means)/i
const EXAMPLE = /^(example|sentence|usage)/i

function columns(table: PMNode): { word: number; meaning: number; example: number } | null {
  const header = table.firstChild
  if (!header) return null
  const names: string[] = []
  header.forEach((cell) => names.push(cell.textContent.trim()))
  const word = names.findIndex((n) => WORD.test(n))
  const meaning = names.findIndex((n) => MEANING.test(n))
  if (word < 0 || meaning < 0) return null
  return { word, meaning, example: names.findIndex((n) => EXAMPLE.test(n)) }
}

export const VocabCards = Extension.create<VocabOptions, VocabStorage>({
  name: 'vocabCards',

  addOptions() {
    return { save: null }
  },

  addStorage() {
    return { timer: null, saved: new Map(), primed: false }
  },

  onUpdate() {
    if (!this.options.save) return
    if (this.storage.timer) clearTimeout(this.storage.timer)
    this.storage.timer = setTimeout(() => this.editor.commands.syncVocabCards(), 1200)
  },

  onDestroy() {
    if (this.storage.timer) clearTimeout(this.storage.timer)
  },

  addCommands() {
    return {
      syncVocabCards:
        () =>
        ({ state, tr, dispatch }) => {
          const save = this.options.save
          const storage = this.storage
          if (!save) return false
          // The first pass after opening only learns what's there: those
          // cards were saved on an earlier visit.
          const priming = !storage.primed
          storage.primed = true
          let stamped = false

          state.doc.descendants((node, pos) => {
            if (node.type.name !== 'table') return true
            const cols = columns(node)
            if (!cols) return false
            let offset = pos + 1
            node.forEach((row, _, index) => {
              const rowPos = offset
              offset += row.nodeSize
              if (index === 0) return
              const cell = (i: number) => (i >= 0 ? (row.maybeChild(i)?.textContent.trim() ?? '') : '')
              const word = cell(cols.word)
              const meaning = cell(cols.meaning)
              const example = cell(cols.example)
              if (!word || !meaning) return
              const key = `${word}\u0000${meaning}\u0000${example}`
              const existing = row.attrs.card_id as string | null
              if (!existing) {
                const id = crypto.randomUUID()
                tr.setNodeMarkup(rowPos, undefined, { ...row.attrs, card_id: id })
                stamped = true
                storage.saved.set(id, key)
                save({ id, word, meaning, example, isNew: true })
              } else if (storage.saved.get(existing) !== key) {
                storage.saved.set(existing, key)
                if (!priming) save({ id: existing, word, meaning, example, isNew: false })
              }
            })
            return false
          })

          if (stamped && dispatch) dispatch(tr)
          return true
        },
    }
  },
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    vocabCards: { syncVocabCards: () => ReturnType }
  }
}
