import type { BlockType } from '~/types/api'

/**
 * How each block type presents itself in the reading column.
 *
 * This table exists because the alternative — every component choosing its own
 * eyebrow, box and tone at its own call site — produced a lesson in which all
 * twenty-odd block types announced themselves by name and most of them drew a
 * box, so six paragraphs of teaching read as six unrelated cards. A label only
 * carries information when it is rare; labelling the majority case is how a
 * teaching page starts reading like an admin panel.
 *
 * `Record<BlockType, …>` does the job here that an exhaustive `match` does in
 * `App\Enums\BlockType`: a block type added anywhere else in the product fails
 * `npm run typecheck` rather than shipping unframed and unlabelled. If you are
 * adding a type, add its row here in the same change.
 */
export type BlockVoice = 'prose' | 'aside' | 'object' | 'task'

/** `rule` is a hairline above the block. There is no third box weight. */
export type BlockFrame = 'none' | 'rule' | 'card'

/** `wide` breaks the reading measure. Nothing else may. */
export type BlockMeasure = 'text' | 'wide'

export interface BlockPresentation {
  /**
   * Mirrors the split the backend already makes — `BlockType::isNarrative()` is
   * `prose`, `isInteractive()` plus the assessed types are `task` — rather than
   * inventing a second taxonomy that would drift away from it.
   *
   * It decides two things and no more: whether the eyebrow's dot is accented
   * (only `task`, which is what makes the dot mean "you do something here"), and
   * the generic word the lesson outline falls back to.
   */
  voice: BlockVoice
  /**
   * Eyebrow text, or `null` for the page's default voice. Prose is not
   * announced; neither is anything that announces itself by being looked at.
   */
  label: string | null
  frame: BlockFrame
  measure: BlockMeasure
}

export const BLOCK_PRESENTATION: Record<BlockType, BlockPresentation> = {
  /* Prose. The default voice of the page, and defaults are not announced. */
  explainer: { voice: 'prose', label: null, frame: 'none', measure: 'text' },
  key_points: { voice: 'prose', label: null, frame: 'rule', measure: 'text' },
  example: { voice: 'prose', label: null, frame: 'none', measure: 'text' },
  worked_example: { voice: 'prose', label: null, frame: 'none', measure: 'text' },

  /* Asides. A hairline and a quiet word — never a box, never the accent dot.
     Each of these labels survives the "is it rare?" test: an analogy, a
     correction and a further-reading list are all things a learner reads
     differently once they know which one they are looking at. */
  analogy: { voice: 'aside', label: 'Analogy', frame: 'rule', measure: 'text' },
  misconception: { voice: 'aside', label: 'Common misconception', frame: 'rule', measure: 'text' },
  reflection: { voice: 'aside', label: 'For you · never graded', frame: 'rule', measure: 'text' },
  timeline: { voice: 'aside', label: 'How it got here', frame: 'rule', measure: 'text' },
  resource: { voice: 'aside', label: 'Go deeper', frame: 'rule', measure: 'text' },
  audio: { voice: 'aside', label: 'Listen', frame: 'rule', measure: 'text' },

  /* Objects. Things you look at rather than read, so they get an edge — and the
     ones made of columns take the wide track, because a four-column table at
     760px wraps every cell to three lines. A picture, a table and a video say
     what they are by existing, so `label: null` keeps the eyebrow off them. */
  walkthrough: { voice: 'object', label: 'Steps', frame: 'card', measure: 'text' },
  checklist: { voice: 'object', label: 'Checklist', frame: 'card', measure: 'text' },
  diagram: { voice: 'object', label: null, frame: 'card', measure: 'wide' },
  comparison: { voice: 'object', label: null, frame: 'card', measure: 'wide' },
  reference_table: { voice: 'object', label: 'Reference', frame: 'card', measure: 'wide' },
  annotated_media: { voice: 'object', label: null, frame: 'card', measure: 'wide' },
  video: { voice: 'object', label: null, frame: 'card', measure: 'wide' },
  /* The one label kept for a reason outside typography: a generated picture may
     never read as a photograph of a real place or event, and the eyebrow is the
     one place that framing cannot be lost when the component is rewritten. */
  illustration: { voice: 'object', label: 'Illustration', frame: 'card', measure: 'text' },

  /* Tasks. The only voice that gets the accent dot, which is what makes the dot
     mean "you do something here" instead of meaning nothing. */
  quiz: { voice: 'task', label: 'Check yourself', frame: 'card', measure: 'text' },
  exam: { voice: 'task', label: 'Exam', frame: 'card', measure: 'text' },
  project: { voice: 'task', label: 'Project', frame: 'card', measure: 'text' },
  /* Deliberately NOT `wide`: the lesson sits between a 274px sidebar and a
     320px assistant dock, so at 1280px with both open this column is ~622px and
     a viewport-keyed breakout would split a pane with no room to split. The
     exercise divides itself on a container query instead. */
  code: { voice: 'task', label: 'Exercise', frame: 'card', measure: 'text' },
  playground: { voice: 'task', label: 'Try it', frame: 'card', measure: 'wide' },
  scenario: { voice: 'task', label: 'Decide', frame: 'card', measure: 'text' },
  flashcards: { voice: 'task', label: 'Practice', frame: 'none', measure: 'text' },
  speaking: { voice: 'task', label: 'Say it', frame: 'card', measure: 'text' },
  dialogue: { voice: 'task', label: 'Role-play', frame: 'card', measure: 'text' },
}

/** A type this build does not know renders as a quiet object, never as a warning. */
export const UNKNOWN_PRESENTATION: BlockPresentation = {
  voice: 'object',
  label: null,
  frame: 'card',
  measure: 'text',
}

export function presentationOf(type: string): BlockPresentation {
  return BLOCK_PRESENTATION[type as BlockType] ?? UNKNOWN_PRESENTATION
}

/** The word the outline uses when a block has no name of its own. */
export const VOICE_NOUN: Record<BlockVoice, string> = {
  prose: 'Explanation',
  aside: 'Note',
  object: 'Figure',
  task: 'Practice',
}
