import type { ResearchedResource, ResourceKind } from '~/types/api'

/**
 * How one verified resource is drawn. Decided in one place because two
 * components have to agree: ResourceCard draws the shape, ResourceBlock decides
 * how much of the row it gets.
 *
 * - `player`: an embeddable YouTube video. A live iframe, always.
 * - `line`:   an article — a row: thumbnail beside the words. Reading is
 *             something you scan a list of; a tall card per article turns
 *             three links into a wall of posters.
 * - `card`:   docs, a book, a tool — things with a cover, drawn with one.
 */
export type ResourceLayout = 'player' | 'line' | 'card'

export const RESOURCE_KIND_LABEL: Record<ResourceKind, string> = {
  video: 'Video',
  article: 'Article',
  docs: 'Documentation',
  book: 'Book',
  tool: 'Tool',
  image: 'Image',
}

export function resourceKind(item: ResearchedResource): ResourceKind {
  return RESOURCE_KIND_LABEL[item.kind] ? item.kind : 'article'
}

export function isPlayer(item: ResearchedResource): boolean {
  return item.provider === 'youtube' && item.embeddable && Boolean(item.provider_id)
}

export function layoutOf(item: ResearchedResource): ResourceLayout {
  if (isPlayer(item)) return 'player'
  return resourceKind(item) === 'article' ? 'line' : 'card'
}

/** Players and lines want the whole row; only cards share it. */
export function spansRow(item: ResearchedResource): boolean {
  return layoutOf(item) !== 'card'
}
