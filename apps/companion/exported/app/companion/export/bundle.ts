/**
 * A course as one zip, and the whole account as one ("Back up everything"):
 *
 *   Databases/
 *     Pages/Lecture 8 notes.docx, Lecture 8 notes.md, …
 *     Whiteboards/Quiz 2 revision map.png, …
 *     Deadlines, tasks and grades.xlsx
 *     Cards for flashcard apps.txt, Cards.csv
 *
 * The backup holds one such folder per course (archived ones too: a backup
 * is everything), "My notes" for what isn't in a course, and the
 * spreadsheet for the whole account at the top. Pages go in twice on
 * purpose: Word for people, Markdown for other apps (Obsidian, Notion's
 * import, a git repo).
 *
 * Uploaded files and recordings stay out: they are the learner's own files
 * already, can run to gigabytes, and a zip of them is better made by the
 * device that holds them.
 *
 * A page or board that can't be read (offline and never opened here) is
 * left out and named in `missed`, so the rest still arrives. Pages are read
 * one at a time: each opens its document as the editor would, and a
 * course of eighty pages shouldn't open eighty at once.
 */
import { strToU8, zipSync, type Zippable } from 'fflate'
import { toMarkdown } from '../doc/markdown'
import type { CompanionStore } from '../store'
import { dayKey } from '../time'
import type { Subject } from '../types'
import { boardToPng } from './board'
import { docToDocx, readPage } from './docx'
import { blobOf, fileName, uniqueName } from './formats'
import { cardFiles, spreadsheet } from './sheets'

export interface Bundle {
  blob: Blob
  name: string
  /** Titles of the pages and boards that couldn't be read. */
  missed: string[]
}

async function bytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

/** One course's folder (or My notes', `subjectId` null) into `files`. */
async function addFolder(c: CompanionStore, files: Zippable, folder: string, subjectId: string | null, missed: string[]) {
  const taken = new Set<string>()
  const notes = c.items.value.filter((i) => i.subject_id === subjectId && (i.kind === 'page' || i.kind === 'board'))
  for (const item of notes) {
    try {
      if (item.kind === 'page') {
        const page = await readPage(item)
        const base = uniqueName(taken, fileName(page.title || item.title), '')
        // Already compressed inside (a .docx is a zip): stored, not squeezed twice.
        files[`${folder}/Pages/${base}.docx`] = [await bytes(await docToDocx(page.title, page.doc)), { level: 0 }]
        files[`${folder}/Pages/${base}.md`] = strToU8(toMarkdown(page.title, page.doc))
      } else {
        const base = uniqueName(taken, fileName(item.title, 'Whiteboard'), '')
        files[`${folder}/Whiteboards/${base}.png`] = [await bytes(await boardToPng(item)), { level: 0 }]
      }
    } catch {
      missed.push(item.title || 'Untitled')
    }
  }
  if (subjectId) files[`${folder}/Deadlines, tasks and grades.xlsx`] = [await spreadsheet(c, subjectId), { level: 0 }]
  const cards = await cardFiles(c, subjectId)
  if (cards.count) {
    files[`${folder}/Cards for flashcard apps.txt`] = strToU8(cards.anki)
    files[`${folder}/Cards.csv`] = strToU8(cards.csv)
  }
}

export async function courseZip(c: CompanionStore, subject: Subject): Promise<Bundle> {
  const name = fileName(subject.title, 'Course')
  const files: Zippable = {}
  const missed: string[] = []
  await addFolder(c, files, name, subject.id, missed)
  return { blob: blobOf(zipSync(files), 'application/zip'), name: `${name}.zip`, missed }
}

export async function backupZip(c: CompanionStore): Promise<Bundle> {
  const root = `BiliMind backup ${dayKey()}`
  const files: Zippable = {}
  const missed: string[] = []
  const folders = new Set<string>(['my notes'])
  for (const subject of c.subjects.value) {
    await addFolder(c, files, `${root}/${uniqueName(folders, fileName(subject.title, 'Course'), '')}`, subject.id, missed)
  }
  await addFolder(c, files, `${root}/My notes`, null, missed)
  files[`${root}/Deadlines, tasks and grades.xlsx`] = [await spreadsheet(c, undefined), { level: 0 }]
  return { blob: blobOf(zipSync(files), 'application/zip'), name: `${root}.zip`, missed }
}
