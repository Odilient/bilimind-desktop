/**
 * Every export, as the screens call it: make the file, save it the
 * platform's way (`platform.saveFile`: a download in the browser, the Save
 * dialog on the desktop), and say so only when there's something to say.
 *
 *   const exp = useExport()        // in setup: it holds the platform and the toasts
 *   exp.page('docx', title, editor.getJSON())
 *   exp.course(subject)
 *
 * Exports are free on every plan and need no AI, so nothing here checks a
 * plan. A quick file (a page, a board) just downloads; a zip or a
 * spreadsheet that has to fetch pages first says "Getting … ready" while it
 * does. A failure is one toast; nothing is left half-made.
 *
 * What's where:
 *  - a page: Word (`docx.ts`, also the google workstream's `pageToDocx`),
 *    Markdown (`doc/markdown.ts`), plain text (`text.ts`), PDF (the print
 *    stylesheet, printed by the desktop or by the browser's dialog);
 *  - a board: PNG and PDF (`board.ts`);
 *  - deadlines, tasks and grades: a spreadsheet and CSVs (`sheets.ts`, `formats.ts`);
 *  - a course, and everything: zips (`bundle.ts`), its cards inside as a CSV and a
 *    flashcard-app text file. Never offered on their own: a download beside
 *    "Review now" read as "review them somewhere else".
 */
import type { JSONContent } from '@tiptap/vue-3'
import { useToast } from '~/composables/useToast'
import { toMarkdown } from '../doc/markdown'
import { usePlatform } from '../platform'
import { useCompanion } from '../store'
import type { Item, Subject } from '../types'
import { boardToPdf, boardToPng } from './board'
import type { Bundle } from './bundle'
import { docToDocx } from './docx'
import { blobOf, fileName } from './formats'
import { deadlinesCsv, spreadsheet, tasksCsv, type Scope } from './sheets'
import { toText } from './text'

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const CSV = 'text/csv;charset=utf-8'

export function useExport() {
  const platform = usePlatform()
  const toast = useToast()
  const c = useCompanion()

  /** `name` is the file's, unless `make` brings a zip with its own (and the notes it couldn't read). */
  async function save(name: string, make: () => Promise<Blob | Bundle>, slow = false): Promise<void> {
    const working = slow ? toast.push({ title: `Getting ${name} ready…`, duration: 0 }) : null
    try {
      const made = await make()
      const file = made instanceof Blob ? { blob: made, name, missed: [] } : made
      await platform.saveFile(file.blob, file.name)
      if (file.missed.length) {
        toast.push(
          {
            title: file.missed.length === 1 ? `“${file.missed[0]}” isn't in the zip` : `${file.missed.length} notes aren't in the zip`,
            body: 'They couldn’t be read just now. Open them once while online, then download again.',
            duration: 8000,
          },
          'warn',
        )
      }
    } catch {
      toast.error({ title: `Couldn't make ${name}`, body: 'Check the connection and try again.' })
    } finally {
      if (working != null) toast.dismiss(working)
    }
  }

  /** "Databases – …", or the account-wide name with no course. */
  function named(scope: Scope, what: string, all: string): string {
    const course = scope ? c.get('subjects', scope)?.title : scope === null ? 'My notes' : null
    return course ? `${fileName(course)} – ${what}` : all
  }

  return {
    /** "Save as PDF" makes the file itself here (the desktop); elsewhere it's "Print or save as PDF". */
    savesPdf: Boolean(platform.printToPdf),

    /** A page from its editor's own document, so what's on screen is what's saved. */
    page(format: 'docx' | 'md' | 'txt', title: string, doc: JSONContent): Promise<void> {
      const name = `${fileName(title)}.${format}`
      if (format === 'docx') return save(name, () => docToDocx(title, doc))
      const text = format === 'md' ? toMarkdown(title, doc) : toText(title, doc)
      return save(name, async () => new Blob([text], { type: format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8' }))
    },

    /**
     * The page on screen as a PDF. On the desktop the window prints itself to a file, with the page set
     * out alone first (`setOut`, then `tidy`, the page's own print root). Elsewhere, and in a desktop
     * shell from before this, it's the print dialog, whose `beforeprint` sets the page out by itself.
     */
    async pagePdf(title: string, setOut: () => void, tidy: () => void): Promise<void> {
      if (platform.printToPdf) {
        setOut()
        try {
          const pdf = blobOf(await platform.printToPdf(), 'application/pdf')
          return await platform.saveFile(pdf, `${fileName(title)}.pdf`)
        } catch {
          // An older shell without the call: the dialog below.
        } finally {
          tidy()
        }
      }
      window.print()
    },

    board(format: 'png' | 'pdf', item: Item): Promise<void> {
      return save(`${fileName(item.title, 'Whiteboard')}.${format}`, () => (format === 'png' ? boardToPng(item) : boardToPdf(item)))
    },

    /** Deadlines, the learner's own tasks and grades, one tab each: one course, or every course. */
    spreadsheet(scope?: string): Promise<void> {
      const name = named(scope, 'deadlines and grades.xlsx', 'Deadlines, tasks and grades.xlsx')
      return save(name, async () => blobOf(await spreadsheet(c, scope), XLSX), true)
    },

    deadlinesCsv(scope?: string): Promise<void> {
      return save(named(scope, 'deadlines.csv', 'Deadlines.csv'), async () => new Blob([deadlinesCsv(c, scope)], { type: CSV }))
    },

    tasksCsv(scope?: string): Promise<void> {
      return save(named(scope, 'tasks.csv', 'Tasks.csv'), async () => new Blob([await tasksCsv(c, scope)], { type: CSV }))
    },

    course(subject: Subject): Promise<void> {
      return save(`${fileName(subject.title, 'Course')}.zip`, async () => (await import('./bundle')).courseZip(c, subject), true)
    },

    /** Settings' "Back up everything". */
    backup(): Promise<void> {
      return save('your backup', async () => (await import('./bundle')).backupZip(c), true)
    },
  }
}
