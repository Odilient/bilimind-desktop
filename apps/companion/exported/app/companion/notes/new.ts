/**
 * Notes' "+": every kind of note a learner can make, in one list, and what
 * each one does. The sidebar's Notes row, Notes' own sidebar, the phone's
 * Notes screen and the capture sheet's menu all draw this list
 * (`CompanionNotesNewList`), so a whiteboard is "Whiteboard · Draw it out…"
 * wherever it is offered and lands in the same place.
 *
 * Where it lands: My notes, unless the button was a course's own ("+" on
 * Databases' folder passes `subjectId`). The course on screen or the class
 * on now is only remembered as the note's suggestion (`make.ts`).
 *
 * Every row makes the note at once and opens it at `/app/notes/<id>`; the
 * ones that need something first say so on the row (files to pick, a link
 * to paste) and then do the same. Record opens the recorder, which files
 * the recording when it stops. "Draft with AI…" opens the assistant with
 * "Write a note about " in its box: the AI's answer becomes a page with one
 * press of its "Save as note".
 */
import { ref, type MaybeRefOrGetter, toValue } from 'vue'
import { useCompanion } from '../store'
import { translate } from '~/utils/i18n'
import { addLink, namedTarget, uploadMany, useCapture } from '../capture'
import { useAi } from '../ai/state'
import { newChatLink, onChatPage } from '../ai/routes'
import { makeBoard, makePage } from './make'
import { noteTo } from './actions'
// recording
import { isDesktopApp } from '../platform'
import { askFor } from '../recorder'

export type NewKind = 'page' | 'board' | 'upload' | 'link' | 'record' | 'photo' | 'draft'
  // recording: the desktop app's screen recorder
  | 'screen'
  // imports: pages and an assignments table from Notion (/app/notion)
  | 'notion'

export interface NewTemplate {
  key: string
  label: string
}

export interface NewNoteType {
  key: NewKind
  label: string
  hint: string
  icon: string
  /** The round icon's tint: the family each kind wears elsewhere. */
  tone: string
  /** Picks it while the list has the focus (no modifier). */
  letter: string
  /** Shapes it can start in besides blank, offered as small chips on its row. */
  templates?: NewTemplate[]
  /** Recording: only in the desktop app, so every list leaves it out elsewhere (`offered`). */
  desktop?: true
}

export const NEW_NOTE_TYPES: NewNoteType[] = [
  {
    key: 'page',
    get label() { return translate('notes.typePage') },
    get hint() { return translate('notes.typePageHint') },
    icon: 'page',
    tone: 'bg-brand-soft text-brand',
    letter: 'p',
    templates: [
      { key: 'lecture', get label() { return translate('notes.tplLecture') } },
      { key: 'cornell', get label() { return translate('notes.tplCornell') } },
      { key: 'reading', get label() { return translate('notes.tplReading') } },
      { key: 'vocab', get label() { return translate('notes.tplVocab') } },
      { key: 'lab', get label() { return translate('notes.tplLab') } },
    ],
  },
  {
    key: 'board',
    get label() { return translate('notes.typeBoard') },
    get hint() { return translate('notes.typeBoardHint') },
    icon: 'board',
    tone: 'bg-accent-soft text-accent-strong',
    letter: 'w',
    templates: [
      { key: 'mindmap', get label() { return translate('notes.tplMind') } },
      { key: 'concept', get label() { return translate('notes.tplConcept') } },
      { key: 'revision', get label() { return translate('notes.tplRevision') } },
      { key: 'kanban', get label() { return translate('notes.tplKanban') } },
    ],
  },
  {
    key: 'upload',
    get label() { return translate('notes.typeUpload') },
    get hint() { return translate('notes.typeUploadHint') },
    icon: 'upload',
    tone: 'bg-surface-sunken text-text-soft',
    letter: 'u',
  },
  {
    key: 'link',
    get label() { return translate('notes.addLink') },
    get hint() { return translate('notes.typeLinkHint') },
    icon: 'link',
    tone: 'bg-cobalt-soft text-cobalt',
    letter: 'l',
  },
  // recording
  {
    key: 'screen',
    get label() { return translate('notes.typeScreen') },
    get hint() { return translate('notes.typeScreenHint') },
    icon: 'monitor',
    tone: 'bg-danger-soft text-danger',
    letter: 's',
    desktop: true,
  },
  {
    key: 'photo',
    get label() { return translate('notes.typePhoto') },
    get hint() { return translate('notes.typePhotoHint') },
    icon: 'camera',
    tone: 'bg-warn-soft text-warn-text',
    letter: 'o',
  },
  // imports: opens /app/notion, which files where this "+" says
  {
    key: 'notion',
    get label() { return translate('notes.typeNotion') },
    get hint() { return translate('notes.typeNotionHint') },
    icon: 'notebook',
    tone: 'bg-surface-sunken text-text-soft',
    letter: 'n',
  },
  {
    key: 'draft',
    get label() { return translate('notes.typeDraft') },
    get hint() { return translate('notes.typeDraftHint') },
    icon: 'spark',
    tone: '',
    letter: 'a',
  },
]

/** Recording: whether a kind is offered here; "Record screen" is the desktop app's alone. */
export function offered(type: NewNoteType): boolean {
  return !type.desktop || isDesktopApp()
}

/**
 * Pick files without a mounted `<input>`: a detached one, clicked inside the
 * press that asked. A menu closes the moment a row is chosen, and an input
 * inside it would go with it before the files came back.
 */
function pickFiles(accept: string, multiple: boolean, capture = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    if (capture) input.setAttribute('capture', 'environment')
    input.style.display = 'none'
    let done = false
    const finish = (files: File[]): void => {
      if (done) return
      done = true
      input.remove()
      resolve(files)
    }
    input.addEventListener('change', () => finish([...(input.files ?? [])]))
    input.addEventListener('cancel', () => finish([]))
    document.body.appendChild(input)
    input.click()
  })
}

/** One note being made at a time, shared, so two "+"s on screen don't make two. */
const busy = ref<NewKind | null>(null)

export interface NewNoteOptions {
  /** A course the button named: what's made is filed there. Null: My notes. */
  subjectId?: MaybeRefOrGetter<string | null | undefined>
  /** Called with the new note's id once it's made and opening. */
  made?: (id: string) => void
}

export function useNewNote(options: NewNoteOptions = {}) {
  const store = useCompanion()
  const toast = useToast()
  const route = useRoute()
  const capture = useCapture()
  const ai = useAi()

  const subjectId = (): string | null => toValue(options.subjectId) ?? null

  /**
   * The course on screen, for the suggestion only: the course page's, or the
   * open note's course in Notes.
   */
  function onScreen(): string | null {
    const id = typeof route.params.id === 'string' ? route.params.id : null
    if (!id) return null
    if (route.path.startsWith('/app/courses/')) return store.get('subjects', id)?.id ?? null
    if (route.path.startsWith('/app/notes/')) return store.get('items', id)?.subject_id ?? null
    return null
  }

  async function open(id: string): Promise<void> {
    options.made?.(id)
    await navigateTo(noteTo(id))
  }

  async function run(kind: NewKind, what: string, make: () => Promise<string | null>): Promise<string | null> {
    if (busy.value) return null
    busy.value = kind
    try {
      const id = await make()
      if (id) await open(id)
      return id
    } catch {
      toast.error({ title: translate(`notes.couldntMake_${what}`), body: translate('notes.couldntMakeBody') })
      return null
    } finally {
      busy.value = null
    }
  }

  function page(template: string | null = null): Promise<string | null> {
    return run('page', 'page', () =>
      makePage({ subjectId: subjectId(), template, onScreen: onScreen() }),
    )
  }

  function board(template: string | null = null): Promise<string | null> {
    return run('board', 'whiteboard', () =>
      makeBoard({ subjectId: subjectId(), template, onScreen: onScreen() }),
    )
  }

  async function files(kind: 'upload' | 'photo'): Promise<string | null> {
    if (busy.value) return null
    const picked = await pickFiles(kind === 'photo' ? 'image/*' : '', kind === 'upload', kind === 'photo')
    if (!picked.length) return null
    return run(kind, kind === 'photo' ? 'photo' : 'upload', async () => {
      const target = namedTarget(store, subjectId())
      const made = await uploadMany(store, picked, target, { onScreen: onScreen(), quiet: picked.length === 1 })
      return made[0]?.id ?? null
    })
  }

  function link(url: string, title: string | null = null): Promise<string | null> {
    return run('link', 'link', async () => {
      const item = await addLink(store, url, namedTarget(store, subjectId()), {
        onScreen: onScreen(),
        title,
        quiet: true,
      })
      return item.id
    })
  }

  function record(): void {
    capture.show('record', subjectId(), null)
  }

  /** Recording: the Record sheet, straight to which screen. */
  function screen(): void {
    askFor('screen')
    capture.show('record', subjectId(), null)
  }

  /** The assistant, with the sentence started; on the chat page, the chat's own box. */
  function draft(): void {
    const prompt = 'Write a note about '
    if (onChatPage(route.path)) void navigateTo(newChatLink({ prompt }))
    else ai.show({ prompt })
  }

  /** Imports: the Notion page, bringing things into the course this "+" named. */
  function notion(): void {
    const id = subjectId()
    void navigateTo({ path: '/app/notion', query: id ? { subject: id } : {} })
  }

  return { busy, page, board, files, link, record, screen, draft, notion }
}
