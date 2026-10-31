/**
 * The demo's stand-ins for the model behind checks: a question writer and a
 * marker, believable enough that `/app/check?demo=1` can be walked end to end
 * with no server.
 *
 * The writer works from the topic's own material, as the real one does: its
 * cards, reworded so the check isn't the card again ("In your own words,
 * why…"), or failing those its notes' first lines, and cites where each
 * question came from (the slides, the recording at the minute, the lesson).
 * A topic with nothing behind it gets a general question, `source: null`,
 * which the page says is general knowledge.
 *
 * The marker reads overlap with the model answer: the short answer itself
 * ("62", "/26") is enough, otherwise most of the key words is right, some is
 * partly, few is missed, and an empty answer is "I don't know". Sure and not
 * right gets a line on why it was tempting, naming the neighbouring topic
 * it's easy to confuse with.
 *
 * Shared by the seed (`demo-seed.ts`, the checks Kamila has already answered)
 * and the repo (`repo.demo.ts`, new sittings), so a seeded question reads like
 * one asked today.
 */
import type { Card, CheckConfidence, CheckKind, CheckResult, CheckSource, Item, Topic } from './types'

/** What the writer needs to see of the world. */
export interface Material {
  topics: Topic[]
  items: Item[]
  cards: Card[]
}

/** A question before it is a row: the prompt, where it came from, and the model answer kept back. */
export interface DemoQuestion {
  kind: CheckKind
  prompt: string
  source: CheckSource | null
  expected: string
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** A card's question asked another way, so answering it tests recall, not recognising the card. */
function reword(front: string, n: number): { kind: CheckKind; prompt: string } {
  const f = front.trim()
  if (/___/.test(f)) return { kind: 'apply', prompt: `Fill it in, without looking: ${f}` }
  if (/^["“]/.test(f)) return { kind: 'recall', prompt: `How do you say ${f} in Italian?` }
  if (/^why\b/i.test(f)) return { kind: 'why', prompt: `In your own words, ${lowerFirst(f)}` }
  // Addresses, prefixes and sums are worked out, not recalled.
  if (/\d+(\.\d+){1,3}|\/\d+|\bhow many\b|\bsplit\b/i.test(f)) {
    return { kind: 'apply', prompt: `Work it out, and show the step: ${lowerFirst(f)}` }
  }
  const what = /^what (is|are) (.+?)\??$/i.exec(f)
  if (what) {
    return n % 2
      ? { kind: 'why', prompt: `Why does ${what[2]} matter? Say what it is and what it's for.` }
      : { kind: 'recall', prompt: `Explain ${what[2]} in your own words, as you would to a classmate.` }
  }
  const does = /^what does (.+?) do\??$/i.exec(f)
  if (does) return { kind: 'why', prompt: `In your own words, what does ${does[1]} do, and why is it needed?` }
  return { kind: 'recall', prompt: `Without looking: ${f}` }
}

/** The most specific thing a question can cite: the card's own item, the slides, the recording, the lesson, a note. */
function sourceFor(w: Material, topic: Topic, card: Card | null): CheckSource | null {
  const items = w.items.filter((i) => !i.deleted_at && i.topic_id === topic.id)
  const quote = card?.back ?? null
  const own = card?.item_id ? items.find((i) => i.id === card.item_id) : undefined
  if (own) return { item_id: own.id, node_id: null, label: own.title, quote, at_seconds: null }

  const said = card?.source_quote ? /recording, (\d+):(\d+)/.exec(card.source_quote) : null
  const recording = items.find((i) => i.kind === 'recording')
  if (said && recording) {
    const at = Number(said[1]) * 60 + Number(said[2])
    return { item_id: recording.id, node_id: null, label: `${recording.title} · ${said[1]}:${said[2]}`, quote, at_seconds: at }
  }
  const slides = items.find((i) => i.kind === 'file' && /^L\d/.test(i.title)) ?? items.find((i) => i.kind === 'file')
  if (slides) {
    const where = card?.source_quote ? /slides? [\d–-]+/.exec(card.source_quote)?.[0] : null
    return { item_id: slides.id, node_id: null, label: where ? `${slides.title} · ${where}` : slides.title, quote, at_seconds: null }
  }
  if (topic.node_id) return { item_id: null, node_id: topic.node_id, label: `Lesson · ${topic.title}`, quote, at_seconds: null }
  const note = items.find((i) => i.kind === 'page' && i.preview)
  if (note) return { item_id: note.id, node_id: null, label: note.title, quote: note.preview, at_seconds: null }
  return null
}

/**
 * `count` questions on one topic, from its cards in order starting at `from`
 * (the number already asked on it, so a topic checked again gets its next
 * cards), else from its notes, else general. `explain` is teach-back: the
 * whole topic, to a listener.
 */
export function writeQuestions(w: Material, topic: Topic, count: number, kind?: 'explain', from = 0): DemoQuestion[] {
  const cards = w.cards.filter((c) => !c.deleted_at && c.topic_id === topic.id)
  if (kind === 'explain') {
    return [{
      kind: 'explain',
      prompt: `Explain ${topic.title} as if to a classmate who missed the class.`,
      source: sourceFor(w, topic, cards[0] ?? null),
      expected: cards.map((c) => c.back).join(' ') || topic.summary || `What ${topic.title} is, why it matters, and one example.`,
    }]
  }
  if (cards.length) {
    return Array.from({ length: count }, (_, i) => {
      const n = from + i
      const card = cards[n % cards.length]!
      return { ...reword(card.front, n), source: sourceFor(w, topic, card), expected: card.back }
    })
  }
  // No cards: the topic's summary or the first lines of a note on it, cited
  // from the slides where there are some. With neither, a general question.
  const note = w.items.find((i) => !i.deleted_at && i.topic_id === topic.id && i.kind === 'page' && i.preview)
  const expected = topic.summary ?? note?.preview ?? null
  const source = expected ? sourceFor(w, topic, null) : null
  if (source) source.quote ??= expected
  const asks = [
    `${topic.title}: what's the main idea, in your own words?`,
    `${topic.title}: why does it matter? Give one example.`,
  ]
  return Array.from({ length: count }, (_, i) => ({
    kind: (from + i) % 2 ? 'why' : 'recall',
    prompt: asks[(from + i) % 2]!,
    source,
    expected: expected ?? `${topic.title}: the main idea in a sentence, and one example of it.`,
  }))
}

/** The listener's one question back: "why not X?", from their side. */
export function followUpFor(topic: Topic): string {
  return `A question back: what would go wrong without ${topic.title}? Why isn't there a simpler way?`
}

const STOP = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'its', 'one', 'our', 'out', 'too', 'use',
  'way', 'who', 'did', 'has', 'his', 'her', 'how', 'was', 'with', 'that', 'this', 'from', 'they', 'them', 'then',
  'than', 'what', 'when', 'where', 'which', 'while', 'into', 'onto', 'each', 'also', 'just', 'only', 'some', 'there',
  'their', 'these', 'those', 'have', 'does', 'will', 'would', 'should', 'could', 'about', 'other', 'every', 'is',
])

function words(s: string): string[] {
  return (s.toLowerCase().match(/[\p{L}\d/]+/gu) ?? []).filter((w) => /\d/.test(w) || (w.length >= 3 && !STOP.has(w)))
}

function squash(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\d/.]+/gu, ' ').trim()
}

/**
 * Marks one answer against the model answer. Returns the verdict, one or two
 * sentences on what they wrote, and, when they were sure and it isn't right,
 * why the wrong answer was tempting.
 */
export function markAnswer(
  q: Pick<DemoQuestion, 'expected'>,
  answer: string,
  confidence: CheckConfidence | null,
  topic: Topic | null,
  neighbour: Topic | null,
  /** The seed's answers were marked long ago: it says how, and gets the words to match. */
  forced?: CheckResult,
): { result: CheckResult; feedback: string | null; tempting: string | null } {
  const said = answer.trim()
  if (!said) return { result: 'wrong', feedback: null, tempting: null }

  // The short answer before the explanation ("62: 64 addresses…", "/26, with…"),
  // when there is one: a number, or an answer that is short to begin with.
  const first = squash(q.expected.split(/[:,]|\.\s/)[0] ?? '')
  const head = /\d/.test(first) || q.expected.length <= 30 ? first : ''
  const keys = [...new Set(words(q.expected))]
  const hit = keys.filter((k) => words(said).includes(k))
  const share = keys.length ? hit.length / keys.length : 0
  const result: CheckResult =
    forced ?? ((head && head.length <= 24 && squash(said).includes(head)) || share >= 0.5 ? 'right' : share >= 0.2 ? 'partly' : 'wrong')

  const missing = keys.filter((k) => !hit.includes(k)).slice(0, 2)
  const feedback =
    result === 'right'
      ? 'That\'s it, and in your own words.'
      : result === 'partly'
        ? missing.length
          ? `You're on the way. The answer also needs ${missing.map((m) => `“${m}”`).join(' and ')}.`
          : 'You\'re on the way, but it isn\'t the whole answer yet.'
        : 'That isn\'t it. Read the answer below once, then say it back to yourself without looking.'
  const tempting =
    confidence === 'sure' && result !== 'right'
      ? neighbour
        ? `It sits right next to ${neighbour.title}, and the two are easy to blur, which is why it felt right.`
        : `Your answer is close in wording to the real one${topic ? ` for ${topic.title}` : ''}, which is why it felt right.`
      : null
  return { result, feedback, tempting }
}

/** The topic before this one in its course: the one it's easiest to confuse it with. */
export function neighbourOf(w: Pick<Material, 'topics'>, topic: Topic): Topic | null {
  const same = w.topics
    .filter((t) => !t.deleted_at && t.subject_id === topic.subject_id && t.parent_id === topic.parent_id)
    .sort((a, b) => a.position - b.position)
  const i = same.findIndex((t) => t.id === topic.id)
  return same[i - 1] ?? same[i + 1] ?? null
}
