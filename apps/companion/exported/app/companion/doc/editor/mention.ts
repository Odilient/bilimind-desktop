import { Extension } from '@tiptap/vue-3'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import { dayKey, dayLabel, relativeDay, shiftDay, whenLabel } from '../../time'
import type { PageContext } from '../context'
import { menuRenderer, type MenuState } from './menu'

/**
 * "@" mentions of the things a course already knows: its topics, its
 * deadlines, and dates. A mention is a chip that stays live: a deadline chip
 * opens the deadline, and its label is the deadline's title when it was made.
 */

export interface MentionItem {
  kind: 'topic' | 'deadline' | 'date'
  id: string
  label: string
  hint: string
}

export function mentionItems(ctx: PageContext, query: string): MentionItem[] {
  const q = query.trim().toLowerCase()
  const match = (label: string) => !q || label.toLowerCase().split(/[\s·,]+/).some((w) => w.startsWith(q)) || label.toLowerCase().includes(q)

  const today = dayKey()
  const dates: MentionItem[] = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => {
    const key = shiftDay(today, n)
    const rel = relativeDay(key, today)
    const label = n <= 1 ? `${rel[0]!.toUpperCase()}${rel.slice(1)}` : dayLabel(key)
    return { kind: 'date' as const, id: key, label, hint: n <= 1 ? dayLabel(key) : rel }
  })

  // What's still coming first; last month's lab is rarely what's meant.
  const now = Date.now()
  const upcomingFirst = [...ctx.deadlines].sort((a, b) => {
    const pa = a.due_at && Date.parse(a.due_at) < now ? 1 : 0
    const pb = b.due_at && Date.parse(b.due_at) < now ? 1 : 0
    return pa - pb
  })
  const deadlines: MentionItem[] = upcomingFirst.map((d) => ({
    kind: 'deadline',
    id: d.id,
    label: d.title,
    hint: d.due_at ? `${whenLabel(d.due_at, d.all_day)}${d.tentative ? ' · tentative' : ''}` : 'no date yet',
  }))

  const topics: MentionItem[] = ctx.topics.map((t) => ({ kind: 'topic', id: t.id, label: t.title, hint: 'topic' }))

  // Typed a date-ish word ("fri", "tom"): dates first. Otherwise the course's
  // own things first, and only a few dates.
  const wantsDate = /^(to|mo|tu|we|th|fr|sa|su|ne|\d)/.test(q)
  const pickedDates = dates.filter((d) => match(d.label) || match(d.hint))
  const list = wantsDate
    ? [...pickedDates, ...deadlines.filter((d) => match(d.label)), ...topics.filter((t) => match(t.label))]
    : [...deadlines.filter((d) => match(d.label)), ...topics.filter((t) => match(t.label)), ...pickedDates.slice(0, q ? 8 : 2)]
  return list.slice(0, 9)
}

export const mentionKey = new PluginKey('page-mention')

export const MentionSuggest = Extension.create<{ state: MenuState<MentionItem> | null; ctx: () => PageContext | null }>({
  name: 'mentionSuggest',

  addOptions() {
    return { state: null, ctx: () => null }
  },

  addProseMirrorPlugins() {
    const state = this.options.state
    if (!state) return []
    return [
      Suggestion<MentionItem, MentionItem>({
        editor: this.editor,
        pluginKey: mentionKey,
        char: '@',
        allowSpaces: false,
        allow: ({ state: s, range }) => s.doc.resolve(range.from).parent.type.name !== 'codeBlock',
        items: ({ query }) => {
          const ctx = this.options.ctx()
          return ctx ? mentionItems(ctx, query) : []
        },
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              { type: 'mention', attrs: { kind: props.kind, id: props.id, label: props.label } },
              { type: 'text', text: ' ' },
            ])
            .run()
        },
        render: menuRenderer(state, mentionKey),
      }),
    ]
  },
})
