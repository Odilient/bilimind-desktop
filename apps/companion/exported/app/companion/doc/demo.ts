import type { JSONContent } from '@tiptap/vue-3'
import type { PageContext } from './context'
import type { Gap } from './gap'

/**
 * What the demo semester's lecture pages say, written out by hand: the notes
 * a student has after class, the gaps "What did I miss?" finds, and a few
 * lines of each recording's transcript.
 *
 * Keyed by topic, because the demo's week is computed from today: Lecture 8
 * (Transactions) only exists once Tuesday's class has started, so Lecture 7
 * (Normalisation) carries the same experience on the other days of the week.
 * Nothing here is reachable outside demo mode.
 */

type DemoTopic = 'transactions' | 'normalisation'

export function demoTopic(ctx: PageContext): DemoTopic | null {
  const title = ctx.topic?.title.toLowerCase() ?? ''
  if (title.startsWith('transactions')) return 'transactions'
  if (title.startsWith('normalisation') || title.startsWith('normal forms')) return 'normalisation'
  return null
}

/* -- Builders --------------------------------------------------------------- */

const text = (value: string, marks?: JSONContent['marks']): JSONContent =>
  marks ? { type: 'text', text: value, marks } : { type: 'text', text: value }
const bold = (value: string) => text(value, [{ type: 'bold' }])
const code = (value: string) => text(value, [{ type: 'code' }])
const para = (...inline: (JSONContent | string)[]): JSONContent => ({
  type: 'paragraph',
  content: inline.map((i) => (typeof i === 'string' ? text(i) : i)),
})
const heading = (value: string): JSONContent => ({ type: 'heading', attrs: { level: 2 }, content: [text(value)] })
const bullets = (...items: JSONContent[][]): JSONContent => ({
  type: 'bulletList',
  content: items.map((inline) => ({ type: 'listItem', content: [para(...inline)] })),
})
const cite = (label: string, itemId: string | null, at: number): JSONContent => ({
  type: 'cite',
  attrs: { label, item_id: itemId, at_seconds: at },
})
const deadlinesView = (subjectId: string | null): JSONContent => ({
  type: 'objectView',
  attrs: { source: 'deadlines', subject_id: subjectId, scope: 'course' },
})

/* -- Transcript lines ------------------------------------------------------- */

export interface Line {
  at: number
  text: string
}

const LINES: Record<DemoTopic, Line[]> = {
  transactions: [
    { at: 300, text: 'Today is transactions: what happens when two people touch the same row at once.' },
    { at: 1210, text: 'Atomicity means all or nothing. If anything fails, ROLLBACK undoes the lot.' },
    { at: 2480, text: "A dirty read is when you read a row another transaction hasn't committed yet, and then it rolls back." },
    { at: 2825, text: "Repeatable read still lets new rows appear. That's a phantom. Serializable stops that too." },
    { at: 3130, text: 'Isolation levels are always question 2. Every year.' },
    { at: 3750, text: 'Back to the bank transfer on the board: two updates, one transaction.' },
    { at: 4800, text: "Next week: recovery, the log, and why durability isn't free." },
  ],
  normalisation: [
    { at: 420, text: 'Normalisation is about one fact living in one place, so an update can never disagree with itself.' },
    { at: 1380, text: 'First normal form: every value is atomic. No lists inside a cell.' },
    { at: 2210, text: 'Second normal form: no non-key column depends on only part of a composite key.' },
    { at: 2320, text: 'Third normal form: no non-key column depends on another non-key column.' },
    { at: 2920, text: 'Normalise to third normal form is on the midterm. Every year, same table.' },
    { at: 3850, text: "BCNF is stricter: every determinant is a candidate key. Sometimes you can't keep every dependency." },
    { at: 4450, text: 'Here on the board: R of A, B, C, D, and we split it twice.' },
  ],
}

export function demoLines(ctx: PageContext): Line[] | null {
  const topic = demoTopic(ctx)
  return topic && ctx.recording ? LINES[topic] : null
}

/** A second worth quoting when the class isn't live. */
export function demoMomentSecond(ctx: PageContext): number | null {
  const topic = demoTopic(ctx)
  return topic === 'transactions' ? 2480 : topic === 'normalisation' ? 2210 : null
}

/* -- Notes ------------------------------------------------------------------ */

export function demoNotes(ctx: PageContext): JSONContent | null {
  const topic = demoTopic(ctx)
  const rec = ctx.recording?.id ?? null
  const subjectId = ctx.subject?.id ?? null

  if (topic === 'transactions') {
    return {
      type: 'doc',
      content: [
        heading('ACID'),
        bullets(
          [bold('Atomicity:'), text(' all or nothing. '), code('ROLLBACK'), text(' undoes the lot.')],
          [bold('Consistency:'), text(' a transaction moves the database from one valid state to another.')],
          [bold('Isolation:'), text(" two transactions never see each other's half-done work.")],
          [bold('Durability:'), text(' once committed, it survives a crash.')],
        ),
        {
          type: 'callout',
          attrs: { icon: 'flag' },
          content: [para(bold('Exam hint.'), ' "Isolation levels are always question 2." ', cite('52:10', rec, 3130))],
        },
        {
          type: 'codeBlock',
          attrs: { language: 'sql' },
          content: [
            text('BEGIN;\nUPDATE accounts SET balance = balance - 100 WHERE id = 1;\nROLLBACK;\nSELECT id, owner, balance FROM accounts;'),
          ],
        },
        {
          type: 'card',
          attrs: {
            card_id: crypto.randomUUID(),
            front: 'What can a dirty read return?',
            back: "A value another transaction wrote but hasn't committed, and may still roll back.",
          },
        },
        deadlinesView(subjectId),
      ],
    }
  }

  if (topic === 'normalisation') {
    return {
      type: 'doc',
      content: [
        heading('Normal forms'),
        bullets(
          [bold('1NF:'), text(' atomic values. No lists inside a cell.')],
          [bold('2NF:'), text(' no non-key column depends on part of a composite key.')],
          [bold('3NF:'), text(' no non-key column depends on another non-key column.')],
        ),
        {
          type: 'callout',
          attrs: { icon: 'flag' },
          content: [para(bold('Exam hint.'), ' "Normalise to 3NF is on the midterm. Every year, same table." ', cite('48:40', rec, 2920))],
        },
        {
          type: 'moment',
          attrs: { item_id: rec, at_seconds: 2210, quote: LINES.normalisation[2]!.text },
        },
        {
          type: 'codeBlock',
          attrs: { language: 'sql' },
          content: [
            text(
              '-- Each owner once, each transfer once: no fact stored twice.\nSELECT t.id, a.owner AS sender, b.owner AS receiver, t.amount\nFROM transfers t\nJOIN accounts a ON a.id = t.from_id\nJOIN accounts b ON b.id = t.to_id;',
            ),
          ],
        },
        {
          type: 'card',
          attrs: {
            card_id: crypto.randomUUID(),
            front: 'What does 2NF forbid?',
            back: 'A non-key column that depends on only part of a composite key.',
          },
        },
        deadlinesView(subjectId),
      ],
    }
  }

  return null
}

/* -- Gaps ------------------------------------------------------------------- */

export function demoGaps(ctx: PageContext): { compared: string; gaps: Gap[] } | null {
  const topic = demoTopic(ctx)
  const rec = ctx.recording?.id ?? null
  const length = ctx.recording?.meta.duration_s
  const minutes = length ? Math.round(length / 60) : null
  const recording = minutes ? `the ${Math.floor(minutes / 60)} h ${minutes % 60} m recording` : 'the recording'

  if (topic === 'transactions') {
    return {
      compared: `Your notes, compared with the 31 slides and ${recording}.`,
      gaps: [
        {
          id: 'l8-serializable',
          title: 'Serializable vs repeatable read',
          body:
            'Repeatable read stops rows you have read from changing, but new rows can still appear (phantoms). ' +
            'Serializable rules phantoms out too: the result is as if the transactions ran one after another.',
          sources: [
            { label: 'slides 18–20', kind: 'slide' },
            { label: '47:05', kind: 'recording', item_id: rec, at_seconds: 2825 },
          ],
        },
        {
          id: 'l8-2pl',
          title: 'Two-phase locking',
          body:
            'A transaction takes all its locks before it releases any: a growing phase, then a shrinking one. ' +
            'Strict 2PL holds write locks until commit, which is what prevents cascading aborts.',
          note: 'skipped in class, in the reading',
          sources: [{ label: 'slide 24', kind: 'slide' }],
        },
        {
          id: 'l8-bank',
          title: 'The bank-transfer example',
          body:
            'Moving 100 from account 1 to account 2 is two UPDATEs in one transaction. If the second fails, ' +
            'ROLLBACK undoes the first, so money is never created or lost.',
          sources: [
            { label: 'whiteboard photo 2', kind: 'photo' },
            { label: '1:02:30', kind: 'recording', item_id: rec, at_seconds: 3750 },
          ],
        },
      ],
    }
  }

  if (topic === 'normalisation') {
    return {
      compared: `Your notes, compared with the 28 slides and ${recording}.`,
      gaps: [
        {
          id: 'l7-bcnf',
          title: 'BCNF, and when 3NF is enough',
          body:
            'BCNF asks that every determinant is a candidate key. It is stricter than 3NF, and sometimes reaching it ' +
            'means losing a dependency, which is why 3NF is the usual stopping point.',
          sources: [
            { label: 'slides 21–23', kind: 'slide' },
            { label: '1:04:10', kind: 'recording', item_id: rec, at_seconds: 3850 },
          ],
        },
        {
          id: 'l7-lossless',
          title: 'Lossless-join decomposition',
          body:
            'A split is lossless when joining the parts gives back exactly the original rows. It holds when the ' +
            'shared columns are a key of at least one of the parts.',
          note: 'skipped in class, in the reading',
          sources: [{ label: 'slide 27', kind: 'slide' }],
        },
        {
          id: 'l7-board',
          title: 'The R(A, B, C, D) example',
          body:
            'With A → B and B → C, R(A, B, C, D) splits into R1(A, B, D) and R2(B, C): the transitive dependency ' +
            'goes, and joining on B gives the original back.',
          sources: [
            { label: 'whiteboard photo 2', kind: 'photo' },
            { label: '1:14:10', kind: 'recording', item_id: rec, at_seconds: 4450 },
          ],
        },
      ],
    }
  }

  return null
}
