// A lesson's history. Everything about to be replaced is kept first, which is what makes Regenerate undoable.
import { createHash } from 'node:crypto'
import type { Raw, Rec, Store } from '../store.ts'
import { retireOrDelete, syncBlocks, carries, type BlockSpec } from './blocks.ts'
import { blockLabel, byPosition, isLive, scrub } from './wire.ts'

export type Cause = 'generated' | 'edited' | 'rewritten' | 'regenerated' | 'restored'
const CAUSE_LABEL: Record<Cause, string> = { generated: 'Generated', edited: 'Edited', rewritten: 'Rewritten by AI', regenerated: 'Regenerated', restored: 'Restored' }
const MAX_LINES = 400
const MAX_WORDS = 400

const sorted = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sorted)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sorted((value as Record<string, unknown>)[k])]))
}
const canonical = (value: unknown) => JSON.stringify(sorted(value ?? null))

export function snapshot(store: Store, node: Rec) {
  return {
    title: node.title,
    summary: node.summary ?? null,
    estimated_minutes: node.estimated_minutes,
    blocks: store.recs('block', node.id).sort(byPosition).map((b) => ({ id: b.id, type: b.type, payload: b.payload, source_material_ids: b.source_material_ids ?? null })),
    assessments: store.recs('assessment', node.id).filter(isLive).sort(byPosition).map((a) => ({
      id: a.id, block_id: a.block_id, kind: a.kind, prompt: a.prompt, options: a.options ?? null, answer_key: a.answer_key ?? null, rubric: a.rubric ?? null, grader: a.grader, max_score: a.max_score, position: a.position,
    })),
  }
}

const hashOf = (snap: unknown) => createHash('sha256').update(canonical(snap)).digest('hex')

export function record(store: Store, node: Rec, cause: Cause, summary: string | null = null, restoredFrom: number | null = null): Rec {
  const snap = snapshot(store, node)
  const hash = hashOf(snap)
  const current = node.current_revision_id ? store.rec('revision', node.current_revision_id) : null
  if (current && current.hash === hash && cause === 'edited') return current
  const revision = store.add('revision', node.id, {
    node_id: node.id,
    cause,
    summary: summarise(current?.snapshot ?? null, snap, cause, summary),
    hash,
    snapshot: snap,
    restored_from_revision_id: restoredFrom,
    bytes: Buffer.byteLength(JSON.stringify(snap)),
  })
  // The pointer is bookkeeping: it doesn't count as the lesson changing.
  store.save('node', { ...store.rec('node', node.id)!, current_revision_id: revision.id }, false)
  node.current_revision_id = revision.id
  return revision
}

/** A lesson with content always has a revision that says so, before anything changes it. */
export function ensureCurrent(store: Store, node: Rec): Rec | null {
  if (!store.recs('block', node.id).length) return null
  const current = node.current_revision_id ? store.rec('revision', node.current_revision_id) : null
  if (current && current.hash === hashOf(snapshot(store, node))) return current
  return record(store, node, current ? 'edited' : 'generated')
}

export function restore(store: Store, revision: Rec): void {
  const node = store.rec('node', revision.node_id)!
  const snap = revision.snapshot
  ensureCurrent(store, node)
  const existing = new Set(store.recs('block', node.id).map((b) => b.id))
  const specs: BlockSpec[] = (snap.blocks ?? []).map((b: Rec) => {
    const { assessment_ids: _ids, ...payload } = b.payload ?? {}
    return { id: existing.has(b.id) ? b.id : null, type: b.type, payload, source_material_ids: b.source_material_ids ?? null }
  })
  const ids = syncBlocks(store, node, specs)
  const blockMap = new Map<number, number>((snap.blocks ?? []).map((b: Rec, i: number) => [b.id, ids[i]!]))

  const wanted: Rec[] = snap.assessments ?? []
  const wantedIds = wanted.map((a) => a.id)
  retireOrDelete(store, store.recs('assessment', node.id).filter((a) => isLive(a) && !wantedIds.includes(a.id)))

  const perBlock = new Map<number, number[]>()
  for (const item of wanted) {
    const blockId = item.block_id ? blockMap.get(item.block_id) ?? null : null
    const fields = { node_id: node.id, block_id: blockId, kind: item.kind, prompt: item.prompt, options: item.options, answer_key: item.answer_key, rubric: item.rubric, grader: item.grader, max_score: item.max_score, position: item.position }
    const found = store.rec('assessment', item.id)
    const saved = found && found.node_id === node.id ? store.save('assessment', { ...found, ...fields }) : store.add('assessment', node.id, fields)
    if (blockId) perBlock.set(blockId, [...(perBlock.get(blockId) ?? []), saved.id])
  }
  for (const block of store.recs('block', node.id)) {
    if (carries(block.type)) store.save('block', { ...block, payload: { ...block.payload, assessment_ids: perBlock.get(block.id) ?? [] } })
  }

  const at = new Date(revision.created_at)
  const when = `${at.getDate()} ${at.toLocaleString('en-GB', { month: 'short' })}, ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
  const next = store.save('node', { ...store.rec('node', node.id)!, title: snap.title, summary: snap.summary ?? null, estimated_minutes: snap.estimated_minutes, edited_at: new Date().toISOString() })
  record(store, next, 'restored', `Restored the version from ${when}`, revision.id)
}

// ---------- reading it back ----------

function previous(store: Store, revision: Rec): Rec | null {
  return store.recs('revision', revision.node_id).filter((r) => r.id < revision.id).at(-1) ?? null
}

export function revisionWire(store: Store, revision: Rec): Raw {
  const node = store.rec('node', revision.node_id)
  return {
    id: revision.id,
    node_id: revision.node_id,
    cause: revision.cause,
    cause_label: CAUSE_LABEL[revision.cause as Cause] ?? revision.cause,
    summary: revision.summary,
    user: null,
    is_current: node?.current_revision_id === revision.id,
    restored_from_revision_id: revision.restored_from_revision_id ?? null,
    bytes: revision.bytes,
    created_at: revision.created_at,
  }
}

function against(store: Store, revision: Rec, wanted: string | null): Rec | null | undefined {
  if (!wanted) return previous(store, revision)
  const found = store.rec('revision', Number(wanted))
  return found && found.node_id === revision.node_id ? found : undefined
}

export function revisionDetail(store: Store, revision: Rec, wanted: string | null): Raw | null {
  const base = against(store, revision, wanted)
  if (base === undefined) return null
  const snap = revision.snapshot
  return {
    ...revisionWire(store, revision),
    against_id: base?.id ?? null,
    changes: compare(base?.snapshot ?? null, snap),
    // What the page shows of a version: never a key.
    snapshot: {
      title: snap.title ?? null,
      summary: snap.summary ?? null,
      estimated_minutes: snap.estimated_minutes ?? null,
      blocks: (snap.blocks ?? []).map((b: Rec, position: number) => ({ id: b.id, position, type: b.type, type_label: blockLabel(b.type), payload: scrub(b.payload ?? {}), source_material_ids: b.source_material_ids ?? [] })),
      assessments: (snap.assessments ?? []).map((a: Rec) => ({ id: a.id, block_id: a.block_id ?? null, kind: a.kind, prompt: a.prompt, options: scrub(a.options ?? null), position: a.position })),
    },
  }
}

function fieldText(snap: Raw, blockId: number, field: string): string {
  const block = (snap.blocks ?? []).find((b: Rec) => b.id === blockId)
  const value = block?.payload?.[field]
  if (value === undefined || value === null) return ''
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

export function fieldDiff(store: Store, revision: Rec, block: number, field: string, wanted: string | null): Raw | null {
  const base = against(store, revision, wanted)
  if (base === undefined) return null
  const before = base ? fieldText(base.snapshot, block, field) : ''
  return { block_id: block, field, against_id: base?.id ?? null, tokens: words(before, fieldText(revision.snapshot, block, field)) }
}

// ---------- the diff ----------

function changedFields(before: Raw, after: Raw): string[] {
  const fields: string[] = []
  if (before.type !== after.type) fields.push('type')
  const left = before.payload ?? {}
  const right = after.payload ?? {}
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    if (key !== 'assessment_ids' && canonical(left[key]) !== canonical(right[key])) fields.push(key)
  }
  if (canonical(before.source_material_ids ?? []) !== canonical(after.source_material_ids ?? [])) fields.push('source_material_ids')
  return fields
}

function longestIncreasingRun(values: number[]): number[] {
  if (!values.length) return []
  const length = values.map(() => 1)
  const prev = values.map(() => -1)
  let best = 0
  values.forEach((value, i) => {
    for (let j = 0; j < i; j++) {
      if (values[j]! < value && length[i]! < length[j]! + 1) { length[i] = length[j]! + 1; prev[i] = j }
    }
    if (length[i]! > length[best]!) best = i
  })
  const run: number[] = []
  for (let k = best; k !== -1; k = prev[k]!) run.unshift(k)
  return run
}

export function compare(before: Raw | null, after: Raw) {
  const beforeBlocks = new Map<number, { block: Rec; index: number }>((before?.blocks ?? []).map((block: Rec, index: number) => [block.id, { block, index }]))
  const counts = { added: 0, removed: 0, changed: 0, moved: 0 }
  const survivors: number[] = []
  const entries: Raw[] = (after.blocks ?? []).map((block: Rec) => {
    const previousBlock = beforeBlocks.get(block.id)
    if (!previousBlock) {
      counts.added++
      return { id: block.id, type: block.type, label: blockLabel(block.type), change: 'added', moved: false, fields: [] }
    }
    survivors.push(previousBlock.index)
    const fields = changedFields(previousBlock.block, block)
    if (fields.length) counts.changed++
    return { id: block.id, type: block.type, label: blockLabel(block.type), change: fields.length ? 'changed' : 'same', moved: false, fields }
  })
  const inPlace = longestIncreasingRun(survivors)
  let cursor = 0
  for (const entry of entries) {
    if (entry.change === 'added') continue
    if (!inPlace.includes(cursor)) { entry.moved = true; counts.moved++ }
    cursor++
  }
  const afterIds = new Set((after.blocks ?? []).map((b: Rec) => b.id))
  const removed: Raw[] = []
  for (const [id, { block, index }] of beforeBlocks) {
    if (afterIds.has(id)) continue
    counts.removed++
    removed.push({ id, type: block.type, label: blockLabel(block.type), before_index: index })
  }
  return {
    title: (before?.title ?? null) !== (after.title ?? null),
    summary: (before?.summary ?? null) !== (after.summary ?? null),
    estimated_minutes: (before?.estimated_minutes ?? null) !== (after.estimated_minutes ?? null),
    blocks: entries,
    removed,
    counts,
  }
}

const withArticle = (label: string) => `${/^[aeiou]/.test(label.toLowerCase()) ? 'an' : 'a'} ${label.toLowerCase()}`

function describeEdit(before: Raw | null, after: Raw): string {
  const c = compare(before, after)
  const parts: string[] = []
  if (c.title) parts.push('changed the title')
  if (c.summary) parts.push('changed the summary')
  if (c.estimated_minutes) parts.push('changed the length')
  const added = c.blocks.filter((b) => b.change === 'added')
  const changed = c.blocks.filter((b) => b.change === 'changed')
  if (added.length) parts.push(added.length === 1 ? `added ${withArticle(added[0]!.label)}` : `added ${added.length} parts`)
  if (changed.length) parts.push(changed.length === 1 ? `edited the ${changed[0]!.label.toLowerCase()}` : `edited ${changed.length} parts`)
  if (c.removed.length) parts.push(c.removed.length === 1 ? `removed ${withArticle(c.removed[0]!.label)}` : `removed ${c.removed.length} parts`)
  if (c.counts.moved) parts.push('reordered')
  if (!parts.length) return 'Saved'
  const sentence = parts.join(', ')
  return sentence[0]!.toUpperCase() + sentence.slice(1)
}

function summarise(before: Raw | null, after: Raw, cause: Cause, summary: string | null): string {
  if (summary?.trim()) return summary.trim().slice(0, 250)
  switch (cause) {
    case 'generated': return before === null ? 'Generated' : 'Saved'
    case 'regenerated': return 'Regenerated'
    case 'rewritten': return 'Rewritten by AI'
    case 'restored': return 'Restored an earlier version'
    default: return describeEdit(before, after)
  }
}

type Hunk = { op: 'eq' | 'del' | 'ins'; lines: string[] } | { op: 'replace'; del: string[]; ins: string[] }

function diff(a: string[], b: string[]): Hunk[] {
  const n = a.length
  const m = b.length
  const lengths = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lengths[i]![j] = a[i] === b[j] ? lengths[i + 1]![j + 1]! + 1 : Math.max(lengths[i + 1]![j]!, lengths[i]![j + 1]!)
    }
  }
  const hunks: Hunk[] = []
  let del: string[] = []
  let ins: string[] = []
  let eq: string[] = []
  const flushChanges = () => {
    if (del.length && ins.length) hunks.push({ op: 'replace', del, ins })
    else if (del.length) hunks.push({ op: 'del', lines: del })
    else if (ins.length) hunks.push({ op: 'ins', lines: ins })
    del = []
    ins = []
  }
  const flushEqual = () => {
    if (eq.length) hunks.push({ op: 'eq', lines: eq })
    eq = []
  }
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { flushChanges(); eq.push(a[i]!); i++; j++ }
    else if (lengths[i + 1]![j]! >= lengths[i]![j + 1]!) { flushEqual(); del.push(a[i]!); i++ }
    else { flushEqual(); ins.push(b[j]!); j++ }
  }
  if (i < n || j < m) flushEqual()
  while (i < n) del.push(a[i++]!)
  while (j < m) ins.push(b[j++]!)
  flushChanges()
  flushEqual()
  return hunks
}

type Token = { op: string; text: string }

function wordsInLine(before: string, after: string): Token[] {
  const a = before.split(/(\s+)/u).filter(Boolean)
  const b = after.split(/(\s+)/u).filter(Boolean)
  if (a.length > MAX_WORDS || b.length > MAX_WORDS) return [{ op: 'del', text: before }, { op: 'ins', text: after }]
  const out: Token[] = []
  for (const hunk of diff(a, b)) {
    if (hunk.op === 'replace') {
      out.push({ op: 'del', text: hunk.del.join('') }, { op: 'ins', text: hunk.ins.join('') })
    } else out.push({ op: hunk.op, text: hunk.lines.join('') })
  }
  return out
}

export function words(before: string, after: string): Token[] {
  if (before === after) return before === '' ? [] : [{ op: 'eq', text: before }]
  const a = before.split(/\r\n|\r|\n/u)
  const b = after.split(/\r\n|\r|\n/u)
  if (a.length > MAX_LINES || b.length > MAX_LINES) return [{ op: 'del', text: before }, { op: 'ins', text: after }]
  const out: Token[] = []
  let first = true
  const newline = () => { if (!first) out.push({ op: 'eq', text: '\n' }); first = false }
  for (const hunk of diff(a, b)) {
    if (hunk.op === 'replace') {
      for (let i = 0; i < Math.max(hunk.del.length, hunk.ins.length); i++) {
        newline()
        const left = hunk.del[i]
        const right = hunk.ins[i]
        if (left !== undefined && right !== undefined) out.push(...wordsInLine(left, right))
        else if (left !== undefined) out.push({ op: 'del', text: left })
        else if (right !== undefined) out.push({ op: 'ins', text: right })
      }
      continue
    }
    for (const line of hunk.lines) {
      newline()
      out.push({ op: hunk.op, text: line })
    }
  }
  const merged: Token[] = []
  for (const token of out) {
    if (!token.text) continue
    const last = merged.at(-1)
    if (last && last.op === token.op) last.text += token.text
    else merged.push({ ...token })
  }
  return merged
}
