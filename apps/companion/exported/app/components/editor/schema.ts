import type { BlockType } from '~/types/api'

/**
 * EDIT — what a person can change in each kind of block, by hand.
 *
 * One table, not twenty-seven forms. A block type maps to a list of fields,
 * a field has a kind, and `BlockEditor.vue` renders whatever it is given. The
 * alternative — an `editable` mode inside every block component — would have
 * meant twenty-seven components each inventing their own textarea.
 *
 * A type missing from the table is not a bug: quiz questions, exam papers,
 * branching scenarios and playground formulas are edited only by asking the
 * model ("make this quiz about bees"), because either their answer keys never
 * reach the browser or their structure is not something a form should ask a
 * beekeeper to hand-author. Those types still get Rewrite with AI.
 */
export type FieldKind =
  | 'text'
  | 'textarea'
  | 'markdown'
  | 'number'
  | 'code'
  | 'select'
  | 'string-list'
  | 'record-list'
  | 'table'

export interface FieldSpec {
  key: string
  label: string
  kind: FieldKind
  /** One line under the label, when the key alone would not say what goes here. */
  hint?: string
  placeholder?: string
  /** The backend refuses an empty value here (UpdateNodeRequest::requiredPayloadKeys). */
  required?: boolean
  /** `select` choices. */
  options?: string[]
  /** `record-list`: the fields of one item. */
  item?: FieldSpec[]
  /** `record-list`: items can be edited but not added or removed (researched resources). */
  fixedLength?: boolean
  /** `table`: the sibling field that holds the column names. */
  columnsKey?: string
  /** `code`: syntax to hint at. */
  language?: string
  /** `number` bounds. */
  min?: number
  max?: number
}

const text = (key: string, label: string, extra: Partial<FieldSpec> = {}): FieldSpec => ({
  key,
  label,
  kind: 'text',
  ...extra,
})

const textarea = (key: string, label: string, extra: Partial<FieldSpec> = {}): FieldSpec => ({
  key,
  label,
  kind: 'textarea',
  ...extra,
})

const markdown = (key: string, label: string, extra: Partial<FieldSpec> = {}): FieldSpec => ({
  key,
  label,
  kind: 'markdown',
  ...extra,
})

const list = (key: string, label: string, extra: Partial<FieldSpec> = {}): FieldSpec => ({
  key,
  label,
  kind: 'string-list',
  ...extra,
})

const records = (key: string, label: string, item: FieldSpec[], extra: Partial<FieldSpec> = {}): FieldSpec => ({
  key,
  label,
  kind: 'record-list',
  item,
  ...extra,
})

export const BLOCK_EDIT_SCHEMA: Partial<Record<BlockType, FieldSpec[]>> = {
  explainer: [markdown('markdown', 'Text', { required: true })],
  key_points: [list('points', 'Points', { required: true })],
  example: [text('title', 'Title', { required: true }), markdown('markdown', 'Text', { required: true })],
  analogy: [
    markdown('markdown', 'The analogy', { required: true }),
    textarea('breaks_down_when', 'Where it breaks down', {
      required: true,
      hint: 'Every analogy stops working somewhere. Say where, so nobody carries it too far.',
    }),
  ],
  misconception: [
    textarea('belief', 'The belief', { required: true, hint: 'What people arrive thinking.' }),
    textarea('why_it_seems_right', 'Why it seems right', { required: true }),
    markdown('what_is_true', 'What is actually true', { required: true }),
    text('tell', 'A tell', { hint: 'A quick way to notice the mistake in the wild.' }),
  ],
  reflection: [textarea('prompt', 'Prompt', { required: true })],
  checklist: [
    text('title', 'Title'),
    records('items', 'Items', [text('text', 'Item', { required: true }), text('why', 'Why it matters')], {
      required: true,
    }),
    textarea('note', 'Note'),
  ],
  walkthrough: [
    textarea('intro', 'Introduction'),
    records(
      'steps',
      'Steps',
      [
        text('title', 'Step', { required: true }),
        markdown('detail_markdown', 'Detail', { required: true }),
        text('warning', 'Warning'),
        text('check', 'How to check it worked'),
      ],
      { required: true },
    ),
  ],
  worked_example: [
    markdown('problem_markdown', 'The problem', { required: true }),
    records('steps', 'Steps', [text('expression', 'Expression', { required: true }), textarea('explanation', 'Explanation')], {
      required: true,
    }),
    text('answer', 'Answer'),
    list('common_mistakes', 'Common mistakes'),
  ],
  comparison: [
    textarea('intro', 'Introduction'),
    list('axes', 'Columns', { required: true, hint: 'What each option is compared on.' }),
    records(
      'items',
      'Options',
      [
        text('name', 'Name', { required: true }),
        list('values', 'Values', { hint: 'One per column, in order.' }),
        text('best_for', 'Best for'),
      ],
      { required: true },
    ),
  ],
  reference_table: [
    text('title', 'Title'),
    list('columns', 'Columns', { required: true }),
    { key: 'rows', label: 'Rows', kind: 'table', columnsKey: 'columns', required: true },
    textarea('note', 'Note'),
  ],
  timeline: [
    records('events', 'Events', [text('when', 'When', { required: true }), text('title', 'What', { required: true }), textarea('detail', 'Detail')], {
      required: true,
    }),
  ],
  flashcards: [
    records('cards', 'Cards', [textarea('front', 'Front', { required: true }), textarea('back', 'Back', { required: true })], {
      required: true,
    }),
  ],
  resource: [
    textarea('note', 'Note'),
    records('items', 'Links', [text('title', 'Title', { required: true }), textarea('why', 'Why it is worth it')], {
      fixedLength: true,
      hint: 'Links were found and checked by research; you can reword them but not add new ones here.',
    }),
  ],
  video: [
    records('items', 'Videos', [text('title', 'Title', { required: true }), textarea('why', 'Why it is worth it')], {
      fixedLength: true,
    }),
  ],
  audio: [markdown('script_markdown', 'Script', { required: true }), text('voice_hint', 'Voice')],
  speaking: [
    markdown('intro_markdown', 'Introduction'),
    records(
      'items',
      'Phrases',
      [text('text', 'Say', { required: true }), text('translation', 'Meaning'), text('phonetic', 'Sounds like')],
      { required: true },
    ),
  ],
  dialogue: [
    markdown('scenario_markdown', 'Scenario', { required: true }),
    text('ai_role', 'The tutor plays', { required: true }),
    text('learner_role', 'You play', { required: true }),
    text('goal', 'Goal', { required: true }),
    text('opening_line', 'Opening line'),
    list('hints', 'Hints'),
  ],
  diagram: [
    { key: 'source', label: 'Diagram', kind: 'code', language: 'mermaid', required: true, hint: 'Mermaid syntax.' },
    text('caption', 'Caption'),
    text('alt_text', 'Description for screen readers'),
  ],
  illustration: [
    text('subject', 'What to draw', { required: true, hint: 'Changing this draws a new picture.' }),
    text('alt_text', 'Description for screen readers', { required: true }),
    text('caption', 'Caption'),
  ],
  annotated_media: [
    text('alt_text', 'Description for screen readers', { required: true }),
    records('hotspots', 'Labels', [text('label', 'Label', { required: true }), textarea('detail', 'Detail')], {
      fixedLength: true,
      hint: 'Positions on the image stay where they are.',
    }),
  ],
  project: [
    text('title', 'Title', { required: true }),
    markdown('brief_markdown', 'Brief', { required: true }),
    list('deliverables', 'Deliverables', { required: true }),
  ],
  quiz: [textarea('intro', 'Introduction', { hint: 'The questions themselves are changed by asking the model.' })],
  exam: [
    textarea('intro', 'Introduction'),
    { key: 'time_limit_minutes', label: 'Time limit (minutes)', kind: 'number', min: 1, max: 600 },
  ],
  code: [
    markdown('instructions_markdown', 'Instructions', { required: true }),
    { key: 'starter_code', label: 'Starter code', kind: 'code', required: true },
    list('hints', 'Hints'),
  ],
}

/** Whether a block of this type has anything a person can edit by hand. */
export function hasEditor(type: BlockType): boolean {
  return (BLOCK_EDIT_SCHEMA[type]?.length ?? 0) > 0
}

/**
 * The picker, grouped the way a person thinks about what to add — not by the
 * generator's archetypes. `ai` types are inserted as a placeholder and
 * immediately rewritten by the model, because their content cannot be typed.
 */
export interface InsertChoice {
  type: BlockType
  label: string
  blurb: string
  /** No hand editor: the model writes it from a description. */
  ai?: boolean
  /** Only offered on courses that allow code exercises. */
  needsCode?: boolean
}

export const INSERT_GROUPS: Array<{ title: string; choices: InsertChoice[] }> = [
  {
    title: 'Write',
    choices: [
      { type: 'explainer', label: 'Explanation', blurb: 'Prose, the plain way to say it.' },
      { type: 'key_points', label: 'Key points', blurb: 'The three things to remember.' },
      { type: 'example', label: 'Example', blurb: 'One concrete case, worked through.' },
      { type: 'analogy', label: 'Analogy', blurb: 'Like something they already know.' },
      { type: 'misconception', label: 'Common misconception', blurb: 'The wrong belief, and why it is wrong.' },
    ],
  },
  {
    title: 'Show',
    choices: [
      { type: 'illustration', label: 'Illustration', blurb: 'A drawing of the thing.' },
      { type: 'diagram', label: 'Diagram', blurb: 'Boxes and arrows.' },
      { type: 'comparison', label: 'Comparison', blurb: 'Options side by side.' },
      { type: 'reference_table', label: 'Reference table', blurb: 'Facts in rows and columns.' },
      { type: 'timeline', label: 'Timeline', blurb: 'How it got here.' },
    ],
  },
  {
    title: 'Do',
    choices: [
      { type: 'quiz', label: 'Quiz', blurb: 'Questions with answers checked.', ai: true },
      { type: 'flashcards', label: 'Flashcards', blurb: 'Front and back, to drill.' },
      { type: 'checklist', label: 'Checklist', blurb: 'Steps to tick off.' },
      { type: 'walkthrough', label: 'Walkthrough', blurb: 'Numbered steps to follow.' },
      { type: 'worked_example', label: 'Worked example', blurb: 'A problem solved line by line.' },
      { type: 'reflection', label: 'Reflection', blurb: 'A question for them, never graded.' },
    ],
  },
  {
    title: 'Practice',
    choices: [
      { type: 'scenario', label: 'Scenario', blurb: 'A decision with consequences.', ai: true },
      { type: 'playground', label: 'Playground', blurb: 'Sliders and a number that moves.', ai: true },
      { type: 'code', label: 'Code exercise', blurb: 'Write code, run tests.', ai: true, needsCode: true },
      { type: 'project', label: 'Project', blurb: 'Something to build and hand in.', ai: true },
      { type: 'exam', label: 'Exam', blurb: 'A longer, timed check.', ai: true },
      { type: 'speaking', label: 'Speaking', blurb: 'Say it out loud and be heard.' },
      { type: 'dialogue', label: 'Role-play', blurb: 'A conversation with the tutor.' },
      { type: 'audio', label: 'Listen', blurb: 'A narrated version.' },
    ],
  },
]

/**
 * A payload the backend will accept for a block that has just been added and
 * says nothing yet. Required keys hold a visible placeholder rather than an
 * empty string, because UpdateNodeRequest refuses empty required fields and
 * a block the model is about to rewrite still has to be saved first.
 */
export function emptyPayload(type: BlockType): Record<string, unknown> {
  const soon = 'Being written…'

  switch (type) {
    case 'explainer':
      return { markdown: '' }
    case 'key_points':
      return { points: [''] }
    case 'example':
      return { title: '', markdown: '' }
    case 'analogy':
      return { markdown: '', breaks_down_when: '' }
    case 'misconception':
      return { belief: '', why_it_seems_right: '', what_is_true: '', tell: null }
    case 'reflection':
      return { prompt: '' }
    case 'checklist':
      return { title: '', items: [{ text: '', why: null }], note: null }
    case 'walkthrough':
      return { intro: null, steps: [{ n: 1, title: '', detail_markdown: '', warning: null, check: null }] }
    case 'worked_example':
      return { problem_markdown: '', steps: [{ expression: '', explanation: '' }], answer: null, common_mistakes: [] }
    case 'comparison':
      return { intro: null, axes: ['', ''], items: [{ name: '', values: ['', ''], best_for: null }] }
    case 'reference_table':
      return { title: null, columns: ['', ''], rows: [['', '']], note: null }
    case 'timeline':
      return { events: [{ when: '', title: '', detail: null }] }
    case 'flashcards':
      return { cards: [{ front: '', back: '' }] }
    case 'audio':
      return { script_markdown: '', voice_hint: null, duration_estimate_s: 60 }
    case 'speaking':
      return { intro_markdown: null, items: [{ text: '', translation: null, phonetic: null }] }
    case 'dialogue':
      return { scenario_markdown: '', ai_role: 'Tutor', learner_role: 'Learner', goal: '', opening_line: null, hints: [] }
    case 'diagram':
      return { format: 'mermaid', source: 'flowchart LR\n  A[Start] --> B[Next]', caption: null, alt_text: null }
    case 'illustration':
      return { subject: '', alt_text: '', caption: null, intent: 'depiction' }
    case 'project':
      return { title: soon, brief_markdown: soon, deliverables: [soon], assessment_ids: [] }
    case 'quiz':
      return { intro: null, assessment_ids: [] }
    case 'exam':
      return { intro: null, time_limit_minutes: null, assessment_ids: [] }
    case 'code':
      return { language: 'javascript', starter_code: '// …', instructions_markdown: soon, assessment_ids: [] }
    case 'scenario':
      return {
        setup_markdown: soon,
        steps: [{ id: 's1', prompt: soon, options: [{ id: 'a', text: soon, correct: true, outcome_markdown: null }] }],
        debrief_markdown: null,
      }
    case 'playground':
      return {
        inputs: [{ key: 'x', label: 'x', min: 0, max: 10, step: 1, default: 5, unit: null }],
        formula_js: 'x',
        output_label: soon,
      }
    default:
      return {}
  }
}

/**
 * Bookkeeping the renderer relies on that a form should never ask for:
 * walkthrough steps are numbered from their order.
 */
export function normalisePayload(type: BlockType, payload: Record<string, unknown>): Record<string, unknown> {
  if (type === 'walkthrough' && Array.isArray(payload.steps)) {
    return {
      ...payload,
      steps: payload.steps.map((step, index) => ({ ...(step as Record<string, unknown>), n: index + 1 })),
    }
  }

  return payload
}

/** The first text a block carries, for naming it in menus and confirmations. */
export function blockExcerpt(payload: Record<string, unknown>): string {
  for (const value of Object.values(payload)) {
    if (typeof value === 'string' && value.trim() !== '') {
      const line = value.replace(/^#+\s*/, '').replace(/\s+/g, ' ').trim()
      return line.length > 60 ? `${line.slice(0, 59).trimEnd()}…` : line
    }
    if (Array.isArray(value) && value.length) {
      const first = value[0]
      if (typeof first === 'string' && first.trim() !== '') return blockExcerpt({ v: first })
      if (first && typeof first === 'object') {
        const nested = blockExcerpt(first as Record<string, unknown>)
        if (nested) return nested
      }
    }
  }
  return ''
}
