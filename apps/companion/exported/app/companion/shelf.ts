/**
 * The Courses shelf once there are forty courses on it: the learner's own
 * groups, the archive, and finding one by name.
 *
 *   shelfSections(c)              // the shelf, section by section
 *   await setGroup(c, [s], 'Year 2 · Autumn')
 *   await archiveCourse(c, s)     // off the shelf; restoreCourse puts it back
 *   findCourses(c, 'net')         // shelf first, then the archive
 *
 * **Groups** are the learner's, named as they like ("Year 2 · Autumn",
 * "Languages"). A group is nothing but the name its courses carry
 * (`subjects.group_name`): putting a course in one writes the name on it,
 * renaming a group rewrites it on each of them, and a group with no courses
 * left is simply gone. Names match whatever the case, so typing "languages"
 * joins "Languages" rather than starting a second one.
 *
 * With no groups the shelf is what it always was: School, then On your own.
 * Groups go first, in name order (numbers read as numbers, so "Year 10"
 * comes after "Year 2"), and whatever is in none stays under School and On
 * your own after them, so making one group never sweeps the rest into an
 * "Other" pile.
 *
 * **Archive** (`subjects.archived_at`) takes a course off the shelf, nothing
 * more: it still opens, its lessons and notes are all there, and it keeps its
 * group, so a restore puts it back where it was. It leaves the lists used
 * every day (`c.shelf` is what the shelf, Today and the planner read), and
 * the server stops planning lessons and reviews for it.
 *
 * **How the shelf is shown** (cards or a list, and which sections are
 * folded) is a choice for this screen on this device, so it lives in
 * localStorage; the groups and the archive are the learner's data and sync.
 */
import { reactive } from 'vue'
import type { Subject } from './types'
import type { CompanionStore } from './store'
import { nowIso } from './time'

/* -- Groups ------------------------------------------------------------------- */

/** The column's length (`subjects.group_name`, 60). */
export const GROUP_NAME_MAX = 60

/** A group name as typed, tidied: single spaces, no ends, at most 60 characters. */
export function cleanGroupName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, GROUP_NAME_MAX).trim()
}

const sameName = (a: string, b: string): boolean => a.toLocaleLowerCase() === b.toLocaleLowerCase()

const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare

/** The learner's groups on the shelf, in name order, each spelled as its first course has it. */
export function groupNames(store: CompanionStore): string[] {
  const names = new Map<string, string>()
  for (const s of store.shelf.value) {
    const name = s.group_name?.trim()
    if (name && !names.has(name.toLocaleLowerCase())) names.set(name.toLocaleLowerCase(), name)
  }
  return [...names.values()].sort(byName)
}

/** The fold key of a section: `group:<name>` for the learner's, or the built-in's own. */
export function groupKey(name: string): string {
  return `group:${name.trim().toLocaleLowerCase()}`
}

export interface ShelfSection {
  /** For folding, and for the heading's id. */
  key: string
  label: string
  /** The built-in sections say what they hold; a group's name already does. */
  hint: string | null
  /** The learner's group, or null for School and On your own. */
  group: string | null
  courses: Subject[]
}

const BUILT_IN_HINTS = {
  school: 'Walked week by week, with your classes',
  self: 'Paths you set yourself, at your own pace',
}

/** The shelf, section by section, each in the courses' own order. Empty sections are left out. */
export function shelfSections(store: CompanionStore): ShelfSection[] {
  const groups = new Map<string, ShelfSection>()
  const school: Subject[] = []
  const own: Subject[] = []
  for (const s of store.shelf.value) {
    const name = s.group_name?.trim()
    if (!name) {
      // A centre's class copy is a path that carries the centre's name as its code: it's taught, not one's own.
      ;(s.format === 'path' && !(s.share_id && s.code) ? own : school).push(s)
      continue
    }
    const key = groupKey(name)
    const section = groups.get(key) ?? { key, label: name, hint: null, group: name, courses: [] }
    section.courses.push(s)
    groups.set(key, section)
  }
  const builtIn: ShelfSection[] = [
    { key: 'school', label: 'School', hint: BUILT_IN_HINTS.school, group: null, courses: school },
    { key: 'self', label: 'On your own', hint: BUILT_IN_HINTS.self, group: null, courses: own },
  ]
  return [...[...groups.values()].sort((a, b) => byName(a.label, b.label)), ...builtIn].filter(
    (section) => section.courses.length,
  )
}

/** Write one group name (or none) on each course that doesn't have it already. */
async function label(store: CompanionStore, subjects: Subject[], name: string | null): Promise<void> {
  await Promise.all(
    subjects
      .filter((s) => (s.group_name?.trim() || null) !== name)
      .map((s) => store.upsert<Subject>('subjects', { id: s.id, group_name: name })),
  )
}

/**
 * Put courses in a group, by name: an existing group's whatever the case, or
 * a new one. An empty name takes them out of any group. Returns the name
 * they're in now.
 */
export async function setGroup(
  store: CompanionStore,
  subjects: Subject[],
  raw: string | null,
): Promise<string | null> {
  const typed = raw ? cleanGroupName(raw) : ''
  const name = typed ? (groupNames(store).find((g) => sameName(g, typed)) ?? typed) : null
  await label(store, subjects, name)
  return name
}

/** Every course carrying a group's name, archived ones too (they go back to it on a restore). */
export function groupMembers(store: CompanionStore, name: string): Subject[] {
  return store.subjects.value.filter((s) => s.group_name && sameName(s.group_name.trim(), name))
}

/**
 * Rename a group. A new name that is another group's merges the two; a
 * change of case alone is a rename like any other. Returns the name it has
 * now, so the screen can carry its fold across.
 */
export async function renameGroup(store: CompanionStore, from: string, raw: string): Promise<string> {
  const typed = cleanGroupName(raw)
  if (!typed || typed === from) return from
  const other = groupNames(store).find((g) => !sameName(g, from) && sameName(g, typed))
  const name = other ?? typed
  await label(store, groupMembers(store, from), name)
  movePrefs(groupKey(from), groupKey(name))
  return name
}

/** Ungroup: the courses go back under School and On your own. Nothing else changes. */
export async function ungroup(store: CompanionStore, name: string): Promise<void> {
  await label(store, groupMembers(store, name), null)
}

/* -- Archive ------------------------------------------------------------------ */

export function isArchived(subject: Subject): boolean {
  return Boolean(subject.archived_at)
}

export async function archiveCourse(store: CompanionStore, subject: Subject): Promise<void> {
  await store.upsert<Subject>('subjects', { id: subject.id, archived_at: nowIso() })
}

export async function restoreCourse(store: CompanionStore, subject: Subject): Promise<void> {
  await store.upsert<Subject>('subjects', { id: subject.id, archived_at: null })
}

/* -- Finding a course ------------------------------------------------------------ */

/**
 * Courses with every word typed somewhere in their name, code, lecturer,
 * group or goal: those whose name starts with it first, then the rest, the
 * shelf before the archive (an archived course is found the same way, and
 * this is how it's found again).
 */
export function findCourses(store: CompanionStore, query: string): Subject[] {
  const q = query.trim().toLocaleLowerCase()
  const words = q.split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const rank = (s: Subject): number => {
    const title = s.title.toLocaleLowerCase()
    return title.startsWith(q) ? 0 : title.includes(q) ? 1 : 2
  }
  const hits = (list: Subject[]) =>
    list
      .filter((s) => {
        const text = [s.title, s.code, s.lecturer, s.group_name, store.goalOf(s)?.title]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase()
        return words.every((w) => text.includes(w))
      })
      .sort((a, b) => rank(a) - rank(b))
  return [...hits(store.shelf.value), ...hits(store.archivedSubjects.value)]
}

/* -- How the shelf is shown, on this device ----------------------------------- */

export type ShelfView = 'cards' | 'list'

interface ShelfPrefs {
  view: ShelfView
  /** Section key => folded. A section not named here is open, except Archived. */
  folded: Record<string, boolean>
}

const PREFS_KEY = 'bm:courses-shelf'

function readPrefs(): ShelfPrefs {
  const fallback: ShelfPrefs = { view: 'cards', folded: {} }
  if (!import.meta.client) return fallback
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null') as Partial<ShelfPrefs> | null
    return {
      view: saved?.view === 'list' ? 'list' : 'cards',
      folded: saved?.folded && typeof saved.folded === 'object' ? saved.folded : {},
    }
  } catch {
    return fallback
  }
}

const prefs = reactive(readPrefs())

function savePrefs(): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Private mode: remembered until the tab closes.
  }
}

/** A renamed group keeps its fold. */
function movePrefs(from: string, to: string): void {
  if (from === to || !(from in prefs.folded)) return
  prefs.folded[to] = prefs.folded[from]!
  delete prefs.folded[from]
  savePrefs()
}

export function useShelfPrefs() {
  return {
    view(): ShelfView {
      return prefs.view
    },
    setView(view: ShelfView): void {
      prefs.view = view
      savePrefs()
    },
    /** Archived starts folded: it's the place courses go to be out of the way. */
    folded(key: string): boolean {
      return prefs.folded[key] ?? key === 'archived'
    },
    setFolded(key: string, folded: boolean): void {
      prefs.folded[key] = folded
      savePrefs()
    },
  }
}
