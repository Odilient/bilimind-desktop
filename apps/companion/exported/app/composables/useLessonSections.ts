import type { Block, BlockType } from '~/types/api'
import type { BlockVoice } from '~/composables/useBlockPresentation'
import { presentationOf, VOICE_NOUN } from '~/composables/useBlockPresentation'

/**
 * The lesson's shape, derived once.
 *
 * A lesson is forty-five minutes of scrolling, and until now the only position
 * signal on the page was the string "12 sections" — a count of a thing that was
 * never named or numbered anywhere, next to a progress bar that reported
 * assessments passed and therefore read 0% for the first four fifths of the
 * read. This turns the block list into an outline a learner can point at.
 *
 * Heading resolution is centralised because three components already did their
 * own version of it — ExplainerBlock promotes a leading `# heading` out of its
 * markdown, ExampleBlock and ProjectBlock read `payload.title` — and an outline
 * that disagrees with what the block actually renders points at the wrong thing.
 */
export interface LessonSection {
  blockId: number
  /**
   * 1-based position in the outline. A block that continues the section above
   * shares that section's ordinal, so scrolling through a run of paragraphs
   * does not make the spine flicker between numbers.
   */
  ordinal: number
  heading: string
  voice: BlockVoice
  /** Whether this block opens a section of its own or continues the one above. */
  opens: boolean
}

/**
 * The names the outline uses for blocks that carry no eyebrow on the page.
 *
 * A contents list is the one place a format word is useful — "where was that
 * comparison?" is a real question — so these exist here rather than as labels
 * in `BLOCK_PRESENTATION`, which would put them back on the page. Deliberately
 * `Partial`: anything missing falls back to the voice's noun, so a new block
 * type gets a sane outline entry without a second exhaustive table to maintain.
 */
const OUTLINE_NOUN: Partial<Record<BlockType, string>> = {
  explainer: 'Explanation',
  key_points: 'Key points',
  example: 'Example',
  worked_example: 'Worked example',
  diagram: 'Diagram',
  comparison: 'Comparison',
  annotated_media: 'Picture',
  video: 'Video',
}

/**
 * Split a leading `# Heading` off a block's markdown.
 *
 * Shared rather than duplicated: the explainer renders the heading through
 * BlockShell's title slot, and the outline has to resolve the same string or a
 * jump lands on a section with a different name than the one clicked.
 */
export function leadingHeading(markdown: string): { heading: string | null; body: string } {
  const raw = String(markdown ?? '').trim()
  const match = raw.match(/^#{1,3}\s+(.+?)\s*(?:\n|$)/)

  if (!match?.[1]) return { heading: null, body: raw }

  return { heading: match[1], body: raw.replace(/^#{1,3}\s+.+?(?:\n|$)/, '').trim() }
}

/** The name a block gave itself, if it gave itself one. */
function authoredName(block: Block): string | null {
  if (block.type === 'explainer') return leadingHeading(block.payload?.markdown ?? '').heading

  /* Half the payload shapes carry a `title` and half do not, and which is which
     is not worth a second union here — the outline only wants the string if it
     is there. */
  const title = (block.payload as { title?: unknown } | null | undefined)?.title

  return typeof title === 'string' && title.trim() !== '' ? title.trim() : null
}

export function lessonSections(blocks: Block[]): LessonSection[] {
  let ordinal = 0

  return blocks.map((block, position) => {
    const presentation = presentationOf(block.type)
    const named = authoredName(block)

    /*
     * An unnamed paragraph is not a place, it is the rest of the place above
     * it — so it folds in rather than adding an "Explanation" to the outline
     * for the third time. Everything else opens a section, and the first block
     * always does, or a lesson that opens with prose would have no first entry
     * to scroll back to.
     */
    const opens = position === 0 || named !== null || block.type !== 'explainer'
    if (opens) ordinal += 1

    return {
      blockId: block.id,
      ordinal,
      heading:
        named ?? presentation.label ?? OUTLINE_NOUN[block.type] ?? VOICE_NOUN[presentation.voice],
      voice: presentation.voice,
      opens,
    }
  })
}
