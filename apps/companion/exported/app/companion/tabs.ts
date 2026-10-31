/**
 * The desktop's open tabs: courses, deadlines, pages and boards kept open
 * side by side along the top of the main area (the mockup's "Networks ·
 * Lecture 7 notes · Routing board · Past paper 2025"). Today, the Inbox and
 * the Calendar are places in the rail, not tabs.
 *
 * Pages and boards register themselves when they open:
 *
 *   openCompanionTab({ kind: 'page', id: item.id, title: item.title,
 *     to: `/app/p/${item.id}`, color: subject?.color })
 *
 * and may rename theirs as the title is edited with `renameCompanionTab`.
 * Remembered per device in localStorage; the phone never shows them.
 */
import { ref, watch } from 'vue'

export interface CompanionTab {
  /** `${kind}:${id}`, filled in when left out. */
  key?: string
  kind: 'course' | 'deadline' | 'page' | 'board' | 'file' | 'practice'
  id: string
  title: string
  /** Where clicking the tab goes. */
  to: string
  /** A course colour token or hex, for the dot. */
  color?: string | null
}

const STORE_KEY = 'bm:companion-tabs'
const MAX_TABS = 8

const tabs = ref<(CompanionTab & { key: string })[]>(restore())

function restore(): (CompanionTab & { key: string })[] {
  if (!import.meta.client) return []
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as (CompanionTab & { key: string })[]) : []
  } catch {
    return []
  }
}

if (import.meta.client) {
  watch(
    tabs,
    (value) => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(value))
      } catch {
        // Private mode: tabs last for the session only.
      }
    },
    { deep: true },
  )
}

export function openCompanionTab(tab: CompanionTab): string {
  const key = tab.key ?? `${tab.kind}:${tab.id}`
  const existing = tabs.value.find((t) => t.key === key)
  if (existing) {
    Object.assign(existing, tab, { key })
    return key
  }
  tabs.value.push({ ...tab, key })
  // The oldest tab goes first; a ninth open document is a sign the eighth
  // isn't being read.
  if (tabs.value.length > MAX_TABS) tabs.value.splice(0, tabs.value.length - MAX_TABS)
  return key
}

export function renameCompanionTab(key: string, title: string): void {
  const tab = tabs.value.find((t) => t.key === key)
  if (tab) tab.title = title
}

/** Close a tab; returns where to go if it was the one on screen. */
export function closeCompanionTab(key: string): string | null {
  const i = tabs.value.findIndex((t) => t.key === key)
  if (i < 0) return null
  tabs.value.splice(i, 1)
  const neighbour = tabs.value[i] ?? tabs.value[i - 1]
  return neighbour?.to ?? null
}

export function useCompanionTabs() {
  return { tabs, open: openCompanionTab, close: closeCompanionTab, rename: renameCompanionTab }
}

/** Sign-out: the next person on this device shouldn't see the last one's open pages. */
export function clearCompanionTabs(): void {
  tabs.value = []
}
