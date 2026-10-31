import type { NodeStatus } from '~/types/api'

/**
 * A node's state shows up as a dot in five places — the sidebar list, the tab
 * strip, the dependency map, the mobile roadmap and the focus sheet — and it
 * has to mean the same thing in all of them. This is that vocabulary.
 *
 * Worth being precise about what the colours say, because it is easy to
 * misread: green means the content has been *written*, not that the learner
 * has finished it. Learner progress is a separate signal (`NodeProgress`) and
 * is drawn as a ring, never as this dot.
 */
export interface NodeStatusStyle {
  /** Short label for a tab or a meta line. */
  label: string
  /** What the state means, in the learner's terms. Used in empty states. */
  blurb: string
  /** Tailwind classes for the 8px dot. */
  dot: string
  /** Text colour for a label sitting next to the dot. */
  text: string
  /** Whether the dot should pulse. Only ever true while work is in flight. */
  pulsing: boolean
}

const STYLES: Record<NodeStatus, NodeStatusStyle> = {
  ready: {
    label: 'Ready',
    blurb: 'This lesson is written and ready to read.',
    // Cobalt's "written" mark is the line-weight lime, not a traffic-light green.
    dot: 'bg-lime-2',
    text: 'text-accent-strong',
    pulsing: false,
  },
  generating: {
    label: 'Writing',
    blurb:
      'BiliMind is writing this now — usually about two minutes. Read something else meanwhile; it opens here the moment it is done.',
    // Work in flight pulses cobalt, the way the landing's story draws it.
    dot: 'bg-brand',
    text: 'text-brand',
    pulsing: true,
  },
  queued: {
    label: 'Queued',
    blurb: 'Waiting its turn behind the lessons already being written. It starts as soon as one of them is done.',
    dot: 'bg-surface border-[1.5px] border-brand-line',
    text: 'text-brand',
    pulsing: false,
  },
  stub: {
    label: 'Not written',
    blurb:
      'This one is in the plan but nothing has been written for it yet. Writing is the part that takes time, so it is your call which lessons get made.',
    dot: 'bg-surface border-[1.5px] border-border-dashed',
    text: 'text-text-faint',
    pulsing: false,
  },
  failed: {
    label: 'Needs another go',
    blurb: "Writing this one didn't finish, so it doesn't count against your lessons. Try it again whenever you like.",
    dot: 'bg-danger-bright',
    text: 'text-danger',
    pulsing: false,
  },
}

export function nodeStatusStyle(status: NodeStatus | null | undefined): NodeStatusStyle {
  return STYLES[status ?? 'stub'] ?? STYLES.stub
}

/** True when the node has content a learner can actually open and read. */
export function isReadable(status: NodeStatus | null | undefined): boolean {
  return status === 'ready'
}

/** True while the backend still has work in flight for this node. */
export function isWorking(status: NodeStatus | null | undefined): boolean {
  return status === 'generating' || status === 'queued'
}
