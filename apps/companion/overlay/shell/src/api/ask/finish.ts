// The model's raw reply to the message the learner keeps: the block cut off the end and turned into actions, and every
// [E3] marker turned into a numbered chip. An id that wasn't shown, or opens nothing, goes with its marker: a chip that
// goes nowhere is worse than none.
import { FENCE } from './fence.ts'
import { draftRequest, guardOf, validateActions } from './actions.ts'
import type { Grounding } from './grounding.ts'
import { normalise, type Excerpt } from './material.ts'
import type { Store } from '../store.ts'

const QUOTE_CHARS = 240
const COMMON = new Set(['which', 'what', 'that', 'this', 'these', 'those', 'with', 'from', 'have', 'been', 'were', 'when', 'where', 'there', 'their', 'they', 'them', 'then', 'than', 'will', 'would', 'could', 'should', 'about', 'because', 'into', 'over', 'also', 'only', 'just', 'very', 'such', 'some', 'each', 'does', 'your', 'exactly'])
const KNOWN = /"type"\s*:\s*"(create_page|create_cards|create_board|create_course|write_lesson|add_tasks|add_deadline|quiz|open|draft_course|propose_course|attempt_first|draw)"/

/** The prose and the block's JSON. */
export function splitBlock(raw: string): [string, string | null] {
  const at = raw.toLowerCase().lastIndexOf(FENCE)
  if (at >= 0) {
    const after = raw.slice(at + FENCE.length)
    // The last one: a note in the block can hold code samples, each with fences of its own.
    const close = after.lastIndexOf('```')
    return [raw.slice(0, at).trimEnd(), (close >= 0 ? after.slice(0, close) : after).trim()]
  }
  // A model that forgot the fence's name: a LAST ```json block that is a list of known actions is the same offer.
  const m = /```(?:json)?\s*(\[\s*\{[\s\S]*\}\s*\])\s*```\s*$/i.exec(raw)
  if (m && KNOWN.test(m[1]!)) return [raw.slice(0, m.index).trimEnd(), m[1]!]
  return [raw.trimEnd(), null]
}

function decodeBlock(block: string): unknown {
  try { return JSON.parse(block) } catch { /* below */ }
  // Prose or a stray fence around the array: take the outermost [...] or {...}.
  for (const [open, close] of [['[', ']'], ['{', '}']] as const) {
    const first = block.indexOf(open)
    const last = block.lastIndexOf(close)
    if (first >= 0 && last > first) {
      try { return JSON.parse(block.slice(first, last + 1)) } catch { /* next */ }
    }
  }
  return null
}

const sentencesOf = (text: string) => text.split(/(?<=[.!?])\s+|\n+/u).map((s) => s.trim()).filter(Boolean)

const clip = (text: string) => {
  const flat = text.replace(/\s+/gu, ' ').trim()
  return flat.length > QUOTE_CHARS ? `${flat.slice(0, QUOTE_CHARS - 1).trimEnd()}…` : flat
}

/**
 * The excerpt's sentence that backs the claim, or '' when none does. A chip showing a quote reads as proof, so it must
 * only show one that could be: one shared word is a coincidence, unless the claim hardly has more than that.
 */
function quoteFor(excerpt: Excerpt, claim: string): string {
  const meaningful = (text: string) => [...new Set(normalise(text).split(' '))].filter((w) => [...w].length > 3 && !COMMON.has(w))
  const want = new Set(meaningful(claim))
  let best = ''
  let bestScore = 0
  for (const sentence of sentencesOf(excerpt.text).filter((s) => [...s].length > 3)) {
    const score = meaningful(sentence).filter((w) => want.has(w)).length
    if (score > bestScore) [best, bestScore] = [sentence, score]
  }
  return bestScore >= Math.min(2, want.size) && bestScore > 0 ? clip(best) : ''
}

function cite(body: string, g: Grounding): [string, Record<string, unknown>[]] {
  const citations: Record<string, unknown>[] = []
  const index = new Map<string, number>()
  const marker = /([ \t]*)\[\s*(E\d+(?:\s*[,;]\s*E\d+)*)(?:\s*[·|:][^\]\n]{0,200})?\s*\]/giu
  const out = body.replace(marker, (_all, spaces: string, ids: string, offset: number) => {
    const numbers = new Set<number>()
    for (const raw of ids.trim().split(/\s*[,;]\s*/)) {
      const id = raw.trim().toUpperCase()
      const target = g.cites[id]
      const excerpt = g.excerpts.find((e) => e.id === id)
      if (!target || !excerpt) continue
      const key = `${target.kind}|${target.id}|${target.label}|${target.at_seconds ?? ''}`
      if (!index.has(key)) {
        // The sentence of the answer that ends at this marker.
        const claim = sentencesOf(body.slice(Math.max(0, offset - 400), offset)).at(-1) ?? ''
        citations.push({
          kind: target.kind,
          id: target.id,
          label: target.label,
          quote: quoteFor(excerpt, claim),
          at_seconds: target.at_seconds,
          subject_id: target.subject_id,
          // An attached link or pasted text is no row of theirs: the chip opens the URL, if any.
          ...(target.kind === 'attachment' ? { url: target.url ?? null } : {}),
        })
        index.set(key, citations.length)
      }
      numbers.add(index.get(key)!)
    }
    return numbers.size ? `${spaces}${[...numbers].sort((a, b) => a - b).map((n) => `[${n}]`).join('')}` : ''
  })
  // [E3][E3] (two excerpts of one slide range) is one chip, not two.
  return [out.replace(/(\[\d+\])\1+/g, '$1').trim(), citations]
}

/**
 * An alias that leaked into the prose ("the S1 midterm", "Databases {S1}") becomes the row's name, or goes when the
 * name is already beside it. Only aliases this answer was shown, and never inside a fenced code block.
 */
export function unalias(text: string, g: Grounding): string {
  if (!Object.keys(g.aliases).length) return text
  return text.split(/(```[\s\S]*?```)/).map((part, i) => {
    if (i % 2 === 1) return part
    return part.replace(/([ \t]*)[{([]?\b([STD]\d{1,3})\b[})\]]?([ \t]*)/g, (all, before: string, alias: string, after: string, offset: number) => {
      const row = g.aliases[alias]
      if (!row) return all
      const title = row.title.toLowerCase()
      if (part.slice(0, offset).trimEnd().toLowerCase().endsWith(title)) return after
      if (part.slice(offset + all.length).toLowerCase().startsWith(title)) return before
      return `${before}${row.title}${after}`
    })
  }).join('')
}

export function finishAnswer(store: Store, raw: string, g: Grounding) {
  const [body, block] = splitBlock(raw)
  const decoded = block !== null ? decodeBlock(block) : null
  let actions = decoded !== null ? validateActions(store, g, decoded) : []
  const draft = decoded !== null ? draftRequest(decoded) : null
  const guard = decoded !== null ? guardOf(g, decoded) : null
  if (draft) actions = actions.filter((a) => a.type !== 'draft_course' && a.type !== 'create_course')
  const [text, citations] = cite(body, g)
  return { text: unalias(text, g), citations, actions, draft, guard }
}
