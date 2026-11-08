/**
 * What can be done to a course from the shelf, behind its "⋯": the same menu
 * on a card (`CompanionCourseCard`) and on a list row (`CompanionCoursesRow`),
 * so the two views never disagree about what a course can do.
 *
 *   const menu = useCourseMenu(() => props.subject, { field, ask, group })
 *   <UiMenu :actions="menu.actions.value" />
 *
 * Rename happens in place, in whichever view asked: the host draws the name
 * field (`field`, focused and selected on Rename) and reads `renaming` to
 * know when. "Icon and colour…" opens the host's
 * `CompanionCoursesLookDialog` (`looking`). "Move to group…" and "Ask about this course"
 * belong to the page (one dialog, one assistant), so they're handed back
 * through `group` and `ask`. Archive and Restore are a write each, with Undo
 * on the toast. Delete opens the host's `CompanionCoursesDeleteDialog`
 * (`confirming`).
 *
 * "Make me try first" is a write of the course's `try_first`: the assistant then asks for the learner's attempt before it
 * answers anything in this course, not only graded work. The menu has no
 * checked state, so a ✓ in place of its icon says it's on, and the toast
 * says what changed, with Undo. It is a switch the learner reaches for when
 * cramming, so it sits with the course's own things, not in Settings only.
 *
 * An archived course's menu leads with Restore and keeps only what still
 * makes sense for a course that's been put away: rename, its original, and
 * delete.
 */
import { computed, nextTick, ref, type Ref } from 'vue'
import type { Subject } from './types'
import type { MenuAction } from '~/components/ui/Menu.vue'
import { useCompanion } from './store'
import { useQuietAi } from './quiet-ai'
import { renameCompanionTab } from './tabs'
import { archiveCourse, isArchived, restoreCourse } from './shelf'
import { useToast } from '~/composables/useToast'
import { useExport } from './export/use-export'
import { shareCourse } from './shares'
import { ApiError } from '~/composables/useApi'

export interface CourseMenuHooks {
  /** The name field the host draws while `renaming`. */
  field?: Ref<HTMLInputElement | null>
  ask?: (subject: Subject) => void
  group?: (subject: Subject) => void
}

export function useCourseMenu(subject: () => Subject, hooks: CourseMenuHooks = {}) {
  const c = useCompanion()
  const toast = useToast()
  const { quiet } = useQuietAi()
  const exp = useExport()

  /* -- Rename, in place ------------------------------------------------------ */

  const renaming = ref(false)
  const draft = ref('')

  async function startRename(): Promise<void> {
    draft.value = subject().title
    renaming.value = true
    await nextTick()
    hooks.field?.value?.focus()
    hooks.field?.value?.select()
  }

  function finishRename(save: boolean): void {
    if (!renaming.value) return
    renaming.value = false
    const s = subject()
    const title = draft.value.replace(/\s+/g, ' ').trim()
    if (!save || !title || title === s.title) return
    renameCompanionTab(`course:${s.id}`, title)
    void c.upsert<Subject>('subjects', { id: s.id, title }).catch(() => undefined)
  }

  /* -- Icon and colour (the host's dialog) ---------------------------------- */

  const looking = ref(false)

  /* -- Archive and restore ------------------------------------------------------ */

  async function archive(): Promise<void> {
    const s = subject()
    try {
      await archiveCourse(c, s)
    } catch {
      return
    }
    toast.success({
      title: `Archived ${s.title}`,
      body: 'It’s under Archived, at the foot of Courses.',
      duration: 5200,
      action: { label: 'Undo', handler: () => void restoreCourse(c, s).catch(() => undefined) },
    })
  }

  async function restore(): Promise<void> {
    const s = subject()
    try {
      await restoreCourse(c, s)
    } catch {
      return
    }
    toast.success({
      title: `${s.title} is back`,
      body: s.group_name ? `In ${s.group_name}, where it was.` : undefined,
      action: { label: 'Undo', handler: () => void archiveCourse(c, s).catch(() => undefined) },
    })
  }

  /* -- Make me try first ------------------------------------------------------------ */

  async function setTryFirst(on: boolean, undoable = true): Promise<void> {
    const s = subject()
    try {
      await c.upsert<Subject>('subjects', { id: s.id, try_first: on })
    } catch {
      return
    }
    if (!undoable) return
    toast.success({
      title: on
        ? `BiliMind will ask for your attempt first in ${s.title}.`
        : `BiliMind will answer straight away in ${s.title}, except on graded work.`,
      action: { label: 'Undo', handler: () => void setTryFirst(!on, false) },
    })
  }

  /* -- Invite coursemates (Daylight 2, gaps: a course shared by one link) --------- */

  async function invite(): Promise<void> {
    const s = subject()
    try {
      const view = await shareCourse(s.id)
      await navigator.clipboard?.writeText(view.url).catch(() => undefined)
      toast.success({
        title: `Link copied: ${view.url.replace(/^https?:\/\//, '')}`,
        body: 'Whoever opens it joins with the same path, files and dates. Their notes stay their own.',
      })
    } catch (error) {
      // A refusal says why in its own words ("This course comes from your class at …").
      if (error instanceof ApiError && error.status === 422) toast.error({ title: error.message })
      else toast.error({ title: "Couldn't make the link", body: 'Check the connection and try again.' })
    }
  }

  /* -- Delete (the host's dialog) ------------------------------------------------ */

  const confirming = ref(false)

  /* -- The menu ------------------------------------------------------------- */

  const actions = computed<MenuAction[]>(() => {
    const s = subject()
    const original: MenuAction[] = s.source_url
      ? [
          {
            label: s.source === 'moodle' ? 'Open in Moodle' : 'Open the original',
            icon: 'external',
            run: () => void window.open(s.source_url!, '_blank', 'noopener'),
          },
        ]
      : []
    const remove: MenuAction = {
      label: 'Delete course…',
      icon: 'trash',
      destructive: true,
      run: () => (confirming.value = true),
    }
    // exports: the course as one zip, archived or not (the last thing anyone does before deleting one)
    const download: MenuAction = { label: 'Download this course', icon: 'download', run: () => void exp.course(s) }
    if (isArchived(s)) {
      return [
        { label: 'Restore to the shelf', icon: 'refresh', run: () => void restore() },
        { label: 'Rename', icon: 'pencil', run: () => void startRename() },
        ...original,
        download,
        remove,
      ]
    }
    return [
      { label: 'Rename', icon: 'pencil', run: () => void startRename() },
      { label: 'Icon and colour…', icon: 'image', run: () => (looking.value = true) },
      ...(hooks.group ? [{ label: 'Move to group…', icon: 'layers', run: () => hooks.group!(s) }] : []),
      ...(quiet.value || !hooks.ask
        ? []
        : [{ label: 'Ask about this course', icon: 'spark', run: () => hooks.ask!(s) }]),
      { label: 'Invite coursemates', icon: 'users', run: () => void invite() },
      { label: 'Make me try first', icon: s.try_first ? 'check' : 'target', run: () => void setTryFirst(!s.try_first) },
      ...original,
      download,
      { label: 'Archive', icon: 'archive', run: () => void archive() },
      remove,
    ]
  })

  return {
    actions,
    renaming,
    draft,
    finishRename,
    looking,
    confirming,
    restore,
    invite,
  }
}
