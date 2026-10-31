/**
 * What an answer's action card does when its button is pressed: the one
 * moment the AI's words become the learner's rows. Every action goes through
 * the store (or the same helpers the screens use), so what it makes appears
 * in the rail, the course and Today at once, works offline from the outbox,
 * and is undone the way anything else is.
 *
 *   const done = await runAction(action, { subjectId, topicId })
 *   done.to       // where the thing now lives, for the card's "Open"
 *   done.label    // "Saved to Databases", "6 cards added"
 *
 * - `create_page`: a page whose first text is the answer, made by Notes'
 *   `makePage` and set out once by the editor from `meta.seed_html` (the
 *   path the server's own seeded pages take; see usePageEditor `seed()`).
 * - `create_cards`: card rows, new to the scheduler and due now, so they are
 *   in the next practice; filed under the course and topic they are about.
 * - `create_board`: a board built whole before it opens, as `makeBoard`
 *   does, with the map merged in by `applyMap` and laid out by the
 *   whiteboard's own mind-map layout.
 * - `write_lesson`: `writeLesson`, so the cap, the charge and the queue are
 *   the ones every other "Write this lesson" goes through.
 * - `add_tasks`: the learner's own plan rows (`kind: 'own'`), which the
 *   planner never replaces.
 * - `add_deadline`: a deadline the learner set, confirmed.
 * - `create_course` and `draft_course` are the chat's next message, asked as
 *   a course (ActionCard sends it); called from anywhere else they open a
 *   new chat in course mode with the course's words in the box.
 * - `open` only navigates; `quiz` is drawn inline.
 */
import { createEmptyCard } from 'ts-fsrs'
import { escapeHtml, parseMarkdown, type MdToken } from '~/composables/useMarkdown'
import { useCompanion } from '../store'
import type { Card, Deadline, Item, PlanTask } from '../types'
import { dayKey, dayLabel, isoWithOffset, nowIso, relativeDay } from '../time'
import { writeLesson } from '../lessons'
import { boardContext } from '../board/context'
import { buildBoard } from '../board/templates'
import { boardParts, newUuid, writeMeta } from '../board/model'
import { openBoard } from '../board/active'
import { applyMap, boardPreview, type MapNode } from '../board/ops'
import { courseHex } from '../board/palette'
import { seedBoard } from '../board/persistence'
import { makePage, suggestWhere } from '../notes/make'
import { itemRoute, lessonRoute } from './links'
import { newChatLink } from './routes'
import type { AiAction, AiMapBranch } from './types'

export interface ActionWhere {
  subjectId?: string | null
  topicId?: string | null
  /** A drawing's picture, from the card showing it. */
  image?: { src: string; w: number; h: number; words?: string } | null
}

export interface ActionDone {
  /** Where the made thing lives; the card's "Open". */
  to: string | null
  /** The done line: "Saved to Databases". */
  label: string
  /** Leave the page for `to` now (making a course, opening something). */
  go?: boolean
}

/** Thrown when the failure was already said (a toast from `writeLesson`). */
export class QuietActionError extends Error {}

/* -- Markdown to the page editor's HTML --------------------------------------- */

/** Citation markers mean nothing on a page of one's own. */
function withoutMarkers(markdown: string): string {
  return markdown.replace(/ ?\[E?\d{1,3}\]/g, '')
}

function listHtml(token: Extract<MdToken, { kind: 'list' }>): string {
  const tag = token.ordered ? 'ol' : 'ul'
  let html = `<${tag}${token.ordered && token.start !== 1 ? ` start="${token.start}"` : ''}>`
  let nested = false
  token.items.forEach((item, i) => {
    if (item.depth === 0 || i === 0) {
      if (nested) html += '</ul>'
      nested = false
      if (i > 0) html += '</li>'
      html += `<li><p>${item.html}</p>`
    } else {
      if (!nested) html += '<ul>'
      nested = true
      html += `<li><p>${item.html}</p></li>`
    }
  })
  if (nested) html += '</ul>'
  return `${html}</li></${tag}>`
}

function tokensHtml(tokens: MdToken[]): string {
  return tokens
    .map((t) => {
      switch (t.kind) {
        case 'heading': {
          // The page's own title is its h1; headings inside start at h2.
          const level = Math.min(3, Math.max(2, t.level))
          return `<h${level}>${t.html}</h${level}>`
        }
        case 'paragraph':
          return `<p>${t.html}</p>`
        case 'list':
          return listHtml(t)
        case 'code':
          return `<pre><code${t.language ? ` class="language-${escapeHtml(t.language)}"` : ''}>${escapeHtml(t.code)}</code></pre>`
        case 'quote':
          return `<blockquote>${tokensHtml(t.tokens)}</blockquote>`
        case 'rule':
          return '<hr>'
        case 'table': {
          const head = `<tr>${t.head.map((c) => `<th><p>${c}</p></th>`).join('')}</tr>`
          const rows = t.rows.map((r) => `<tr>${r.map((c) => `<td><p>${c}</p></td>`).join('')}</tr>`).join('')
          return `<table><tbody>${head}${rows}</tbody></table>`
        }
        default:
          return ''
      }
    })
    .join('')
}

/**
 * An answer's Markdown as the HTML a page is first set out from. Built from
 * `useMarkdown`'s tokens, which are escaped before any tag is added, so the
 * model's text can never become markup of its own.
 */
export function markdownToPageHtml(markdown: string, title?: string): string {
  let tokens = parseMarkdown(withoutMarkers(markdown))
  // An answer that opens with the page's own name would say it twice.
  const first = tokens[0]
  if (first?.kind === 'heading' && title && first.text.trim().toLowerCase() === title.trim().toLowerCase()) {
    tokens = tokens.slice(1)
  }
  return tokensHtml(tokens)
}

/* -- Running ------------------------------------------------------------------ */

function toMap(branch: AiMapBranch): MapNode {
  return { text: branch.title, children: branch.children?.map(toMap) }
}

function courseWords(subjectId: string | null): string {
  const subject = subjectId ? useCompanion().get('subjects', subjectId) : null
  return subject ? subject.title : 'My notes'
}

/** A topic is only filed with a card when it belongs to the card's course. */
function topicIn(subjectId: string | null, topicId: string | null | undefined): string | null {
  if (!topicId) return null
  const topic = useCompanion().get('topics', topicId)
  return topic && (!subjectId || topic.subject_id === subjectId) ? topic.id : null
}

export async function runAction(action: AiAction, where: ActionWhere = {}): Promise<ActionDone> {
  const store = useCompanion()
  await store.load()

  switch (action.type) {
    case 'draw': {
      // The picture itself comes from the card: only what's on screen knows the view.
      const image = where.image
      if (!image) throw new Error('The drawing isn\'t ready yet.')
      const open = openBoard.value
      if (open) {
        open.place(image.src, { w: image.w, h: image.h })
        return { to: null, label: 'On your whiteboard' }
      }
      const title = action.title?.trim() || 'Drawing'
      const words = image.words ? markdownToPageHtml(image.words, title) : ''
      const id = await makePage({
        subjectId: null,
        onScreen: where.subjectId ?? null,
        title,
        seedHtml: `<img src="${image.src.replace(/"/g, '%22')}" alt="">${words}`,
      })
      const item = store.get('items', id)
      return { to: item ? itemRoute(item) : `/app/notes/${id}`, label: 'Saved to My notes' }
    }

    case 'create_page': {
      // Through Notes' own maker. It goes to the course the card named
      // before the press, else to My notes, never into the course that
      // happens to be on screen: that one is only kept as the note's
      // "Add to Databases?" chip (`onScreen`).
      const subjectId = action.subject_id ?? null
      const title = action.title?.trim() || 'Notes'
      const id = await makePage({
        subjectId,
        onScreen: where.subjectId ?? null,
        topicId: subjectId ? topicIn(subjectId, where.topicId) : null,
        title,
        seedHtml: markdownToPageHtml(action.markdown, title),
      })
      const item = store.get('items', id)
      return {
        to: item ? itemRoute(item) : `/app/notes/${id}`,
        label: `Saved to ${courseWords(item?.subject_id ?? null)}`,
      }
    }

    case 'create_cards': {
      const subjectId = action.subject_id ?? where.subjectId ?? null
      const topicId = topicIn(subjectId, action.topic_id ?? where.topicId)
      const now = new Date()
      const fsrs = JSON.parse(JSON.stringify(createEmptyCard(now))) as Record<string, unknown>
      const cards = action.cards.filter((c) => c.front.trim() && c.back.trim())
      if (!cards.length) throw new Error('There were no cards in that answer to add.')
      await Promise.all(
        cards.map((c) =>
          store.upsert<Card>('cards', {
            id: crypto.randomUUID(),
            subject_id: subjectId,
            topic_id: topicId,
            item_id: null,
            kind: 'basic',
            front: c.front.trim(),
            back: c.back.trim(),
            source_quote: null,
            fsrs,
            // Due now: asking for cards is asking to practise them.
            due_at: isoWithOffset(now),
            last_review_at: null,
            suspended: false,
          }),
        ),
      )
      return {
        to: subjectId ? `/app/practice?subject=${subjectId}` : '/app/practice',
        label: `${cards.length} ${cards.length === 1 ? 'card' : 'cards'} added to ${courseWords(subjectId)}`,
      }
    }

    case 'create_board': {
      // Filed like a page: the course the card named, else My notes. The
      // course on screen still colours the map and is offered as "Add to …?".
      const subjectId = action.subject_id ?? null
      const ctx = boardContext(store, subjectId ?? where.subjectId ?? null, null)
      const offer = subjectId ? null : suggestWhere(store, where.subjectId ?? null)
      const doc = buildBoard('blank', ctx)
      const parts = boardParts(doc)
      const title = action.title?.trim() || `${action.root} map`
      writeMeta(parts, { title })
      applyMap(
        parts,
        { title, summary: '', root: { text: action.root, children: action.branches.map(toMap) } },
        { at: { x: 0, y: 0 }, color: courseHex(ctx.subject?.color) },
      )
      const id = newUuid()
      const item: Item = {
        id,
        kind: 'board',
        subject_id: subjectId,
        session_id: null,
        topic_id: subjectId ? topicIn(subjectId, where.topicId) : null,
        parent_id: null,
        title,
        preview: boardPreview(parts) || null,
        meta: {
          template: 'blank',
          props: {},
          ...(offer ? { suggested_subject_id: offer.subject_id, suggested_session_id: offer.session_id } : {}),
        },
        source: 'made',
        source_ref: null,
        position: store.items.value.filter((i) => i.subject_id === subjectId).length,
        pinned: false,
      }
      try {
        await store.upsert<Item>('items', item)
        await seedBoard(id, doc, store.repo())
      } finally {
        doc.destroy()
      }
      return { to: itemRoute(item), label: `Whiteboard made in ${courseWords(item.subject_id)}` }
    }

    case 'write_lesson': {
      const topic = store.get('topics', action.topic_id)
      if (!topic) throw new Error('That topic isn\'t in your courses any more.')
      const nodeId = await writeLesson(topic, action.instruction)
      if (nodeId == null) throw new QuietActionError()
      return { to: lessonRoute(store, nodeId, topic.subject_id), label: 'Lesson on its way' }
    }

    case 'add_tasks': {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(action.date ?? '') ? action.date : dayKey()
      const already = store.planTasks.value.filter((t) => t.date === date).length
      const stamp = nowIso()
      await Promise.all(
        action.tasks.map((task, i) =>
          store.upsert<PlanTask>('plan-tasks', {
            id: crypto.randomUUID(),
            date,
            subject_id: task.subject_id ?? null,
            deadline_id: null,
            topic_id: null,
            item_id: null,
            kind: 'own',
            title: task.title,
            detail: null,
            minutes: Math.max(5, Math.round(task.minutes || 25)),
            position: already + i,
            done_at: null,
            generated_at: stamp,
          }),
        ),
      )
      const day = relativeDay(date)
      return {
        to: date === dayKey() ? '/app' : '/app/calendar',
        label: day === 'today' ? 'Added to today\'s plan' : `Added to ${day === 'tomorrow' ? 'tomorrow' : dayLabel(date)}`,
      }
    }

    case 'add_deadline': {
      if (!store.get('subjects', action.subject_id)) throw new Error('That course isn\'t in your list any more.')
      const id = crypto.randomUUID()
      await store.upsert<Deadline>('deadlines', {
        id,
        subject_id: action.subject_id,
        kind: (action.kind as Deadline['kind']) || 'other',
        title: action.title,
        due_at: action.due_at,
        all_day: false,
        weight_pct: null,
        location: null,
        status: 'upcoming',
        confidence: 'own',
        confirmed: true,
        scope_note: null,
        grade: null,
        source_ref: null,
        tentative: false,
        topic_ids: [],
        sources: [],
      })
      return { to: `/app/d/${id}`, label: `Added to ${courseWords(action.subject_id)}` }
    }

    case 'create_course': {
      const goal = [action.title, action.summary, action.topics.length ? `Topics: ${action.topics.join(', ')}.` : '']
        .filter(Boolean)
        .join('. ')
        .replace(/\.\./g, '.')
      const link = newChatLink({ intent: 'course', prompt: goal })
      return { to: `${link.path}?${new URLSearchParams(link.query)}`, label: 'Opening a new chat', go: true }
    }

    case 'draft_course': {
      const link = newChatLink({ intent: 'course', prompt: action.label })
      return { to: `${link.path}?${new URLSearchParams(link.query)}`, label: 'Opening a new chat', go: true }
    }

    case 'open':
      return { to: action.to, label: action.label, go: true }

    case 'quiz':
      return { to: null, label: '' }
  }
}
