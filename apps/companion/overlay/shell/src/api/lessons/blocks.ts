// A lesson's parts and the questions they carry. A question with attempts is retired, never deleted: it is the learner's
// history, parked where no block points at it and completion no longer counts it.
import { CARRIES_ASSESSMENTS, type BlockType } from '@bilimind/core'
import type { Rec, Store } from '../store.ts'
import { RETIRED, scrub } from './wire.ts'

export const carries = (type: string) => CARRIES_ASSESSMENTS.includes(type as BlockType)

export function retireOrDelete(store: Store, assessments: Rec[]): void {
  for (const a of assessments) {
    if (store.recs('attempt', a.id).length) store.save('assessment', { ...a, block_id: null, position: RETIRED })
    else store.drop('assessment', a.id)
  }
}

export interface BlockSpec { id: number | null; type: string; payload: Record<string, any>; source_material_ids: number[] | null }

/** The lesson's parts become exactly these, in this order. An `assessment_ids` the client left out stays as it was. */
export function syncBlocks(store: Store, node: Rec, specs: BlockSpec[]): number[] {
  const existing = new Map(store.recs('block', node.id).map((b) => [b.id, b]))
  const kept: number[] = []
  specs.forEach((spec, position) => {
    const block = spec.id === null ? undefined : existing.get(spec.id)
    const payload = scrub(spec.payload)
    if (carries(spec.type) && !('assessment_ids' in payload)) payload.assessment_ids = block?.payload?.assessment_ids ?? []
    const fields = { type: spec.type, payload, position, ...(spec.source_material_ids !== null ? { source_material_ids: spec.source_material_ids } : {}) }
    const saved = block
      ? store.save('block', { ...block, ...fields })
      : store.add('block', node.id, { node_id: node.id, source_material_ids: null, ...fields })
    kept.push(saved.id)
  })
  const gone = [...existing.keys()].filter((id) => !kept.includes(id))
  if (gone.length) {
    retireOrDelete(store, store.recs('assessment', node.id).filter((a) => gone.includes(a.block_id)))
    for (const id of gone) store.drop('block', id)
  }
  return kept
}

export interface DraftAssessment { kind: string; prompt: string; options?: unknown; answer_key?: unknown; rubric?: unknown; grader: string; max_score: number; bloom?: string; explanation?: string }

/** Create a block's questions and write their ids into its payload. */
export function attachAssessments(store: Store, node: Rec, block: Rec, items: DraftAssessment[], position: { next: number }): void {
  const ids = items.map((item) => store.add('assessment', node.id, {
    node_id: node.id,
    block_id: block.id,
    kind: item.kind,
    prompt: item.prompt,
    options: item.options ?? null,
    answer_key: item.answer_key ?? null,
    rubric: item.rubric ?? null,
    grader: item.grader,
    max_score: item.max_score ?? 100,
    position: position.next++,
    ...(item.bloom ? { bloom: item.bloom } : {}),
    ...(item.explanation ? { explanation: item.explanation } : {}),
  }).id)
  if (carries(block.type)) store.save('block', { ...store.rec('block', block.id)!, payload: { ...block.payload, assessment_ids: ids } })
}

export interface WrittenBlock { type: string; payload: Record<string, any>; source_material_ids: number[] | null; assessments: DraftAssessment[] }

/** The generated parts out, the new ones in; questions with attempts stay as history. */
export function replaceContent(store: Store, node: Rec, blocks: WrittenBlock[]): void {
  retireOrDelete(store, store.recs('assessment', node.id).filter((a) => a.position !== RETIRED))
  for (const b of store.recs('block', node.id)) store.drop('block', b.id)
  const position = { next: 0 }
  blocks.forEach((written, index) => {
    const block = store.add('block', node.id, { node_id: node.id, position: index, type: written.type, payload: written.payload, source_material_ids: written.source_material_ids })
    attachAssessments(store, node, block, written.assessments, position)
  })
}
