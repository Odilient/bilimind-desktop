import type { InjectionKey } from 'vue'
import type { CompanionRepo } from '../../repo'
import type { CompanionStore } from '../../store'
import type { Item, Uuid } from '../../types'
import type { PageContext } from '../context'

/**
 * What a block on a page needs to know about the page around it: the repo to
 * read and write rows through, the page's own item, and where it lives. The
 * editor's host provides it; every Vue node view injects it.
 */
export interface PageEnv {
  /** For the document itself and uploads. */
  repo: CompanionRepo
  /** For rows: reactive reads, optimistic writes with an offline outbox. */
  store: CompanionStore
  page: Readonly<Ref<Item>>
  ctx: Readonly<Ref<PageContext>>
  /**
   * Move the app's player to a second of a recording. Never plays: it only
   * seeks, and the app's own player decides what to show.
   */
  seek(itemId: Uuid | null, seconds: number): void
  /** Open a page or board the way the app opens things. */
  open(item: { id: Uuid; kind: 'page' | 'board' }): void
}

export const PAGE_ENV: InjectionKey<PageEnv> = Symbol('page-env')

export function usePageEnv(): PageEnv {
  const env = inject(PAGE_ENV, null)
  if (!env) throw new Error('A page block was rendered outside a page editor')
  return env
}

/** The default seek: an event the app shell's player listens for. */
export function dispatchSeek(itemId: Uuid | null, seconds: number): void {
  window.dispatchEvent(new CustomEvent('companion:seek', { detail: { item_id: itemId, at_seconds: seconds } }))
}
