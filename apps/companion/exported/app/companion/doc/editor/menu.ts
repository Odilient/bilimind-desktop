import { exitSuggestion, type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion'
import type { PluginKey } from '@tiptap/pm/state'

/**
 * The state behind a suggestion menu (the "/" menu, the "@" menu), kept as a
 * plain reactive object so our own Vue components draw it: a floating list on
 * desktop, a sheet on the phone. The suggestion plugin only reports what was
 * typed and where; this turns that into a list, a highlighted row, and the
 * keys that move through it.
 */
export interface MenuState<I> {
  open: boolean
  query: string
  items: I[]
  index: number
  /** Where the trigger character sits on screen, for the floating list. */
  rect: (() => DOMRect | null) | null
  choose: (item: I) => void
  close: () => void
}

export function createMenuState<I>(): MenuState<I> {
  return reactive({
    open: false,
    query: '',
    items: [],
    index: 0,
    rect: null,
    choose: () => {},
    close: () => {},
  }) as MenuState<I>
}

/** Wires a menu state to `@tiptap/suggestion`'s `render` hooks. */
export function menuRenderer<I>(state: MenuState<I>, pluginKey: PluginKey) {
  return () => {
    function sync(props: SuggestionProps<I, I>): void {
      state.query = props.query
      state.items = props.items
      state.rect = props.clientRect ?? null
      state.choose = (item: I) => props.command(item)
      if (state.index >= props.items.length) state.index = 0
    }

    return {
      onStart(props: SuggestionProps<I, I>) {
        state.index = 0
        sync(props)
        state.open = true
        // A click away: drop the menu, keep the typed "/query" as text.
        state.close = () => {
          state.open = false
          exitSuggestion(props.editor.view, pluginKey)
        }
      },
      onUpdate(props: SuggestionProps<I, I>) {
        sync(props)
      },
      onKeyDown({ event }: SuggestionKeyDownProps) {
        if (!state.open) return false
        const count = state.items.length
        if (event.key === 'ArrowDown') {
          if (count) state.index = (state.index + 1) % count
          return true
        }
        if (event.key === 'ArrowUp') {
          if (count) state.index = (state.index - 1 + count) % count
          return true
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          const item = state.items[state.index]
          if (!item) return false
          state.choose(item)
          return true
        }
        if (event.key === 'Escape') {
          state.open = false
          return true
        }
        return false
      },
      onExit() {
        state.open = false
      },
    }
  }
}
