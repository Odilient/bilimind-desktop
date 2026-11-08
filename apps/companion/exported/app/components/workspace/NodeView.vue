<script setup lang="ts">
import type { Attachment, Block, BlockType, BoardAnnotation, DiffToken, RevisionDetail } from '~/types/api'
import type { LessonMark } from '~/types/api'
import type { MenuAction } from '~/components/ui/Menu.vue'
import type { Placed } from '~/composables/useRoadmap'
import BlockRenderer from '~/components/blocks/BlockRenderer.vue'
import LessonSpine from '~/components/workspace/LessonSpine.vue'
import EditorFrame from '~/components/editor/EditorFrame.vue'
import BlockEditor from '~/components/editor/BlockEditor.vue'
import InsertMenu from '~/components/editor/InsertMenu.vue'
import RewriteDialog from '~/components/editor/RewriteDialog.vue'
import BlockDiff from '~/components/history/BlockDiff.vue'
import LessonAttachments from '~/components/attachments/LessonAttachments.vue'
import MarkupBlock from '~/components/markup/MarkupBlock.vue'
import MarkupToolbar from '~/components/markup/MarkupToolbar.vue'
import { BLOCK_EDIT_SCHEMA, emptyPayload } from '~/components/editor/schema'
import { INPUT } from '~/components/editor/fields/classes'
import { useLessonEditor, type DraftBlock } from '~/composables/useLessonEditor'
import { presentationOf } from '~/composables/useBlockPresentation'
import { lessonSections } from '~/composables/useLessonSections'
import { useUsage } from '~/companion/usage'

/**
 * One open lesson: the title, one pinned strip, then the block sequence.
 *
 * The strip earns its stickiness and the title does not. A lesson is
 * forty-five minutes of scrolling through twenty different formats, and the two
 * things a learner loses in that time are where they are and whether they have
 * finished — so those, and only those, stay pinned. The title, the step number
 * and the neighbouring lessons scroll away with everything else; they answer a
 * question you ask once, on arrival.
 *
 * That is also why the strip carries a section spine rather than the progress
 * bar it used to. The bar reported assessments passed, so on a lesson with
 * nothing graded it read 0% until the moment it read 100%, and on a lesson with
 * a quiz at the end it read 0% for the whole read. It has moved to the finish
 * card, where it is next to the button it describes.
 *
 * The reading column is a grid, not a single max-width — see `.lesson` in
 * main.css. Prose keeps its measure; a comparison table, a diagram or a video
 * takes the wide track, because one cap on the container forces the same
 * measure on a paragraph and a four-column table.
 */
const props = withDefaults(
  defineProps<{
    nodeId: number
    language?: string
    /** Course level, threaded to speaking/dialogue blocks to pitch the role-play. */
    level?: string
    /**
     * Whether this pane is the foreground tab. Background tabs stay mounted so
     * their scroll position and ungraded answers survive, but they must not go
     * on billing the learner for time they are not spending here.
     */
    active?: boolean
    /**
     * EDIT — whether this person may change the lesson. The owner's workspace
     * says yes; a shared or public view never does.
     */
    editable?: boolean
    /**
     * Whether this person is the course's author — the one who may have a lesson
     * written or rewritten (which spends their allowance). Separate from
     * `editable` because the phone layout reads a lesson without the editor but
     * still lets its author write a stub; false for a member of an organisation
     * reading a course it shares.
     */
    author?: boolean
    /** The course allows code exercises, so the insert picker may offer one. */
    allowsCode?: boolean
    /**
     * EDIT — a version from History to show instead of the live lesson.
     * Read-only, with the parts that differ from the previous version outlined.
     */
    preview?: RevisionDetail | null
    /** Bump to make the view refetch its lesson (after a restore). */
    refreshToken?: number
    /** Open straight into writing it by hand, when there is nothing in it yet. */
    compose?: boolean
    /** More under the strip's paperclip, after "A file": the companion's "A link". */
    attachActions?: MenuAction[]
  }>(),
  { active: true, editable: false, author: true, allowsCode: false, preview: null, refreshToken: 0, compose: false, attachActions: () => [] },
)

const emit = defineEmits<{
  changed: []
  open: [nodeId: number]
  /** Continue the run: open this lesson and let go of the one being left. */
  next: [nodeId: number]
  close: []
  /** Lets the workspace attribute materials and ground the assistant. */
  blocks: [nodeId: number, blocks: Block[]]
  /** EDIT — open this lesson's history beside it. */
  history: [nodeId: number]
  /** MARKUP — open (or create) a whiteboard for this lesson as a tab. */
  board: [nodeId: number, board: BoardAnnotation]
  /** `compose` was acted on. */
  composed: []
}>()

const player = useNodePlayer(
  () => props.nodeId,
  () => emit('changed'),
  () => props.active,
)

/* Blocks setup until the node has been fetched, so the content is present in
   the server-rendered HTML. The parent supplies the Suspense boundary. */
await player.ready

const {
  node,
  loading,
  loadError,
  blocks,
  assessments,
  attempts,
  passedCount,
  completed,
  marking,
  inFlight,
  workingLabel,
} = player

watch(blocks, (value) => emit('blocks', props.nodeId, value), { immediate: true })

watch(
  () => props.refreshToken,
  () => {
    void player.load()
  },
)

/* -- Attachments ------------------------------------------------------------ */

/*
 * Files the owner added to this lesson. They arrive with the lesson payload
 * and are kept here so a change made in the section shows at once without a
 * refetch; they are not content, so neither the editor nor History knows them.
 */
const lessonAttachments = ref<Attachment[]>([])

watch(
  node,
  (value) => {
    lessonAttachments.value = value?.attachments ?? []
  },
  { immediate: true },
)

/* -- Markup ---------------------------------------------------------------- */

/*
 * A reader's own highlights, notes, drawings on pictures and whiteboards.
 * Private to them and separate from the lesson's content: any signed-in
 * person who can open the course may mark it up, owner or not, which is why
 * `MarkupBlock` gets "signed in" rather than `editable`.
 */
const { isAuthenticated } = useAuth()
const canMark = isAuthenticated
const marks = useAnnotations(() => props.nodeId)
const pen = useMarkupTool()

/*
 * The tray is the mode. A pencil in the corner, or the pen button in a top bar,
 * opens it
 * (armed with the pen, which is what a pen promises) and Done puts it away.
 * While it is out it floats at the bottom of the pane, where a hand already
 * is; the disc that used to sit in that corner all the time, covering the
 * last lines of every lesson, is gone. Highlights need no tray at all:
 * selecting text offers them.
 *
 * Only the foreground lesson shows it, and never while the lesson is being
 * edited, previewed from History, or has nothing written in it yet.
 */
const markupMode = useMarkupMode()

function openMarkup(): void {
  markupMode.toggle(props.nodeId)
}

const markupOpen = computed(
  () =>
    markupMode.nodeId.value === props.nodeId &&
    props.active &&
    canMark.value &&
    !editing.value &&
    !props.preview &&
    !showsStateCard.value,
)

const boardList = computed(() =>
  marks.boards.value.map((board) => ({ uuid: board.uuid, title: board.data.title ?? 'Whiteboard' })),
)

/* A whiteboard has its own tray in its own tab, so this one goes away. */
function openBoard(uuid: string): void {
  const board = marks.boards.value.find((item) => item.uuid === uuid)
  if (!board) return
  closeMarkup()
  emit('board', props.nodeId, board)
}

/* -- Reading ---------------------------------------------------------------- */

const reading = useReadingSettings()

function closeMarkup(): void {
  pen.disarm()
  if (markupMode.nodeId.value === props.nodeId) markupMode.close()
}

function newBoard(): void {
  const board = marks.createBoard()
  closeMarkup()
  emit('board', props.nodeId, board)
}

onMounted(() => {
  void marks.load()
})

/* -- Editing --------------------------------------------------------------- */

const api = useApi()

const editor = useLessonEditor({
  nodeId: () => props.nodeId,
  node: player.node,
  apply: (fresh) => {
    player.node.value = fresh
  },
  onSaved: () => emit('changed'),
})

const { editing, draft, dirty, saving, savedAt, conflict, problem, selectedKey, canUndo, canRedo, cancelling, changed } =
  editor

/*
 * Cancel is the way out that keeps nothing. Autosave means it is not a matter
 * of walking away from an unsaved form — the lesson on the server has already
 * moved — so it asks first whenever there is anything to lose, and puts the
 * lesson back the way editing found it.
 */
const cancelAsk = ref(false)

function askCancel(): void {
  if (!changed.value) {
    editor.discard()
    return
  }
  cancelAsk.value = true
}

async function confirmCancel(): Promise<void> {
  await editor.cancel()
  // The dialog closes when editing is actually over; a restore that failed
  // leaves both it and the draft up, so nothing is lost to a dead network.
  if (!editing.value) cancelAsk.value = false
}

const canEdit = computed(
  () => props.editable && !props.preview && !!node.value && node.value.status === 'ready' && blocks.value.length > 0,
)

/** What the strip says about the draft, in three words at most. */
const saveState = computed(() => {
  if (conflict.value) return 'Not saved'
  if (saving.value) return 'Saving…'
  if (dirty.value) return 'Unsaved changes'
  if (savedAt.value) return 'Saved'
  return ''
})

/** A draft block as the renderer expects one. */
function asBlock(block: DraftBlock, index: number): Block {
  return {
    id: block.id ?? -(index + 1),
    node_id: props.nodeId,
    position: index,
    type: block.type,
    payload: block.payload,
    source_material_ids: block.source_material_ids,
  } as unknown as Block
}

function labelOf(type: BlockType): string {
  return presentationOf(type).label ?? type.replace(/_/g, ' ')
}

async function insertAt(index: number, type: BlockType, instruction: string | null): Promise<void> {
  const key = editor.insert(index, type, emptyPayload(type))

  if (instruction !== null || !(BLOCK_EDIT_SCHEMA[type]?.length ?? 0)) {
    await editor.rewrite(key, instruction ?? `Write this ${labelOf(type).toLowerCase()} for this lesson.`)
    return
  }

  editor.select(key)
}

/* Rewrite dialog */
const rewriteKey = ref<string | null>(null)
const rewriteOpen = ref(false)
const rewriteBusy = ref(false)

const rewriteLabel = computed(() => {
  const block = draft.value?.blocks.find((item) => item.key === rewriteKey.value)
  return block ? labelOf(block.type) : 'part'
})

function askRewrite(key: string): void {
  rewriteKey.value = key
  rewriteOpen.value = true
}

async function submitRewrite(instruction: string): Promise<void> {
  if (!rewriteKey.value) return
  rewriteBusy.value = true
  const started = await editor.rewrite(rewriteKey.value, instruction)
  rewriteBusy.value = false
  if (started) rewriteOpen.value = false
}

/* Drag to reorder. Native drag events: the handle is `draggable`, every frame
   is a drop zone, and the target index comes from which half of the frame the
   pointer is over. */
const dragKey = ref<string | null>(null)
const dropAt = ref<number | null>(null)

function onDragStart(key: string, event: DragEvent): void {
  dragKey.value = key
  event.dataTransfer?.setData('text/plain', key)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDragOver(index: number, event: DragEvent): void {
  if (!dragKey.value) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  dropAt.value = event.clientY - rect.top > rect.height / 2 ? index + 1 : index
}

function onDrop(): void {
  const key = dragKey.value
  const target = dropAt.value
  dragKey.value = null
  dropAt.value = null
  if (!key || target === null || !draft.value) return

  const from = draft.value.blocks.findIndex((block) => block.key === key)
  if (from === -1) return
  editor.move(key, target > from ? target - 1 : target)
}

function onDragEnd(): void {
  dragKey.value = null
  dropAt.value = null
}

async function beginEditing(): Promise<void> {
  regenOpen.value = false
  closeMarkup()
  editor.begin()
}

/*
 * Writing it yourself: a lesson with nothing in it opens in the editor with one
 * empty text block. No model runs and nothing is spent, so it works on Free too.
 * The block isn't committed, so nothing is sent (an empty one wouldn't save)
 * until something is typed; the first save makes it a written lesson.
 */
const canWriteYourself = computed(
  () => props.author && !props.preview && (node.value?.status === 'stub' || node.value?.status === 'failed'),
)

const usage = useUsage()
if (import.meta.client && props.author) void usage.ensure()
/** Out of AI (Free with no credits): writing it yourself is the way that works. */
const noAi = computed(() => usage.limited.value)

function writeYourself(): void {
  if (!canWriteYourself.value) return
  closeMarkup()
  editor.begin()
  draft.value?.blocks.push({
    key: 'first',
    id: null,
    type: 'explainer',
    payload: emptyPayload('explainer'),
    source_material_ids: null,
  })
  editor.select('first')
  // Straight to typing: the block's text field, once the editor has drawn it
  // (opened from elsewhere, that is only after the new tab has mounted).
  let tries = 0
  const focusText = (): void => {
    const field = lessonEl.value?.querySelector<HTMLTextAreaElement>('textarea')
    if (field) field.focus()
    else if (++tries < 30) requestAnimationFrame(focusText)
  }
  if (import.meta.client) requestAnimationFrame(focusText)
}

watch(
  () => props.compose,
  (wanted) => {
    if (!wanted) return
    writeYourself()
    emit('composed')
  },
  { immediate: true },
)

/* Undo/redo shortcuts belong to the foreground pane only. */
watch(
  [editing, () => props.active],
  ([isEditing, isActive]) => {
    if (!import.meta.client) return
    window.removeEventListener('keydown', editor.onKeydown)
    if (isEditing && isActive) window.addEventListener('keydown', editor.onKeydown)
  },
)

onBeforeUnmount(() => {
  if (import.meta.client) window.removeEventListener('keydown', editor.onKeydown)
})

/* -- Previewing a version --------------------------------------------------- */

const previewBlocks = computed<Block[]>(() => props.preview?.snapshot.blocks ?? [])

const previewChange = computed(() => {
  const map = new Map<number, { change: string; moved: boolean; fields: string[] }>()
  for (const entry of props.preview?.changes.blocks ?? []) {
    if (entry.id !== null) map.set(entry.id, entry)
  }
  return map
})

const previewRemoved = computed(() =>
  (props.preview?.changes.removed ?? []).map((item) => item.label.toLowerCase()),
)

const previewWhen = computed(() => {
  if (!props.preview) return ''
  const date = new Date(props.preview.created_at)
  return date.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
})

/** Field diffs opened for a block in the preview, keyed by block id. */
const openDiffs = ref<Record<number, Array<{ field: string; tokens: DiffToken[] }> | 'loading'>>({})

/** Fields worth diffing as text: strings and lists of strings. */
function diffableFields(blockId: number): string[] {
  const entry = previewChange.value.get(blockId)
  const block = previewBlocks.value.find((item) => item.id === blockId)
  if (!entry || !block) return []
  const payload = block.payload as unknown as Record<string, unknown>
  return entry.fields.filter((field) => {
    const value = payload[field]
    return typeof value === 'string' || (Array.isArray(value) && value.every((item) => typeof item === 'string'))
  })
}

async function toggleDiff(blockId: number): Promise<void> {
  if (openDiffs.value[blockId]) {
    const next = { ...openDiffs.value }
    delete next[blockId]
    openDiffs.value = next
    return
  }

  if (!props.preview) return
  openDiffs.value = { ...openDiffs.value, [blockId]: 'loading' }

  const fields = diffableFields(blockId)
  const loaded = await Promise.all(
    fields.map(async (field) => {
      const result = await api.get<{ tokens: DiffToken[] }>(`/revisions/${props.preview!.id}/field`, {
        query: { block: blockId, field },
      })
      return { field, tokens: result.tokens }
    }),
  )

  openDiffs.value = { ...openDiffs.value, [blockId]: loaded }
}

watch(
  () => props.preview?.id,
  () => {
    openDiffs.value = {}
  },
)

/* -- Where this sits on the path ------------------------------------------- */

const prerequisites = computed(() => node.value?.prerequisites ?? [])
const unlocks = computed(() => node.value?.next_nodes ?? [])

const track = computed(() => (node.value ? lessonTrack(node.value) : 'core'))

/** The one lesson that actually follows this one, and what hangs off it. */
const nextOnPath = computed(() => unlocks.value.filter((item) => (item.track ?? 'core') === 'core'))
const detours = computed(() => unlocks.value.filter((item) => (item.track ?? 'core') !== 'core'))
/** The step before this one (a subtopic's is the step it hangs from): the left half at the end. */
const prevStep = computed(() => prerequisites.value.find((item) => (item.track ?? 'core') === 'core') ?? prerequisites.value[0] ?? null)

/** The badge a subtopic wears on the map, said in words here. */
function markOf(item: Placed): LessonMark | null {
  return lessonMark(item)
}

/**
 * Neighbours are quoted by name rather than counted: "2 prerequisites" tells
 * you nothing you can act on, a title tells you what to go back and read. But a
 * name is also what wraps — two sixty-character lesson titles quoted in one
 * line is three lines of grey text above the heading — so they are clipped, and
 * the clipping is on the string because hiding the overflow would still make
 * the browser lay it out.
 */
function short(title: string): string {
  return title.length > 30 ? `${title.slice(0, 29).trimEnd()}…` : title
}

const contextLead = computed(() => {
  if (!node.value) return ''
  if (track.value === 'core') return `Step ${node.value.layer + 1}`
  const mark = lessonMark(node.value)
  return mark ? MARK_META[mark].label : TRACK_META.subtopic.label
})

const afterTitle = computed(() => {
  const first = prerequisites.value[0]
  return first ? short(first.title) : null
})

/** The next STEP, never a detour: a detour is not what comes after this. */
const thenTitle = computed(() => {
  const next = nextOnPath.value[0]
  return next && track.value === 'core' ? short(next.title) : null
})

/* -- Finishing ------------------------------------------------------------ */

/**
 * The one line beside "Mark complete" at the end of the lesson. Checks passed
 * when there are any, because that is the only signal the backend has about
 * whether the learner understood any of this; otherwise it just says what the
 * button is for, rather than inventing a scroll-depth percentage.
 */
const finishLine = computed(() => {
  const total = assessments.value.length
  if (total > 0) return `${passedCount.value} of ${total} ${total === 1 ? 'check' : 'checks'} passed`
  return completed.value ? 'It counts towards your progress.' : 'Nothing here is graded.'
})

/* -- The lesson's shape ---------------------------------------------------- */

const sections = computed(() => lessonSections(blocks.value))
const outline = computed(() => sections.value.filter((section) => section.opens))

/**
 * Where the practice at the end of a lesson starts: the last run of task
 * blocks (flashcards, a quiz, an exercise). The reading and the practice used
 * to run on as one column, so nobody could tell where the lesson ended. An
 * exercise the author put mid-lesson stays where it is; a lesson with no
 * reading before its tasks, or no tasks, gets no break (-1).
 */
const practiceFrom = computed(() => {
  let at = blocks.value.length
  while (at > 0 && presentationOf(blocks.value[at - 1]!.type).voice === 'task') at--
  return at > 0 && at < blocks.value.length ? at : -1
})

/** "Flashcards, then Check yourself." and what counts, under "Now practise". */
const practiceLine = computed(() => {
  if (practiceFrom.value < 0) return ''
  const names = [
    ...new Set(blocks.value.slice(practiceFrom.value).map((b) => presentationOf(b.type).label).filter(Boolean)),
  ] as string[]
  const parts = names.length > 1 ? `${names.slice(0, -1).join(', ')}, then ${names.at(-1)}` : (names[0] ?? 'A few tasks')
  const counts = assessments.value.length
    ? ' Your answers to the checks count towards finishing the lesson.'
    : ' Nothing here is graded.'
  return `${parts}: what you just read, from memory.${counts}`
})

/** The three facts under the title: how long, how many parts, how many checks. */
const headChips = computed(() => {
  const chips: Array<{ icon: string; label: string }> = []
  if (node.value?.estimated_minutes) {
    chips.push({ icon: 'clock', label: `${node.value.estimated_minutes} min` })
  }
  const parts = outline.value.length
  chips.push({ icon: 'list', label: `${parts} ${parts === 1 ? 'part' : 'parts'}` })
  const checks = assessments.value.length
  if (checks) chips.push({ icon: 'check', label: `${checks} ${checks === 1 ? 'check' : 'checks'}` })
  return chips
})

const activeOrdinal = ref(1)

const lessonEl = ref<HTMLElement | null>(null)

let sectionObserver: IntersectionObserver | undefined
const onScreen = new Set<number>()

function stopWatchingSections(): void {
  sectionObserver?.disconnect()
  sectionObserver = undefined
  onScreen.clear()
}

function watchSections(): void {
  stopWatchingSections()

  const root = lessonEl.value
  if (!root || typeof IntersectionObserver === 'undefined') return

  /* The pane scrolls, not the window: every open lesson is an absolutely
     positioned `.om-scroll` box stacked in the workspace. Handing the observer
     that box is what makes the margin below mean "under the pinned strip"
     instead of "under the top of the browser window". */
  const scroller = root.closest('.om-scroll')

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const id = Number(entry.target.id.slice('block-'.length))
        if (entry.isIntersecting) onScreen.add(id)
        else onScreen.delete(id)
      }

      /* The topmost block still on screen is the one being read. Nothing is
         cleared when none matches: mid-scroll through a very tall block the
         honest answer is "still that one". */
      const first = sections.value.find((section) => onScreen.has(section.blockId))
      if (first) activeOrdinal.value = first.ordinal
    },
    { root: scroller, rootMargin: '-56px 0px 0px 0px' },
  )

  sectionObserver = observer

  for (const element of root.querySelectorAll('.lesson-section')) observer.observe(element)
}

/* Every open tab stays mounted, so an ungated observer would run for all of
   them at once — eight lessons open means eight observers firing on a scroll
   that moves one pane. Gated exactly as the time ticker in useNodePlayer is. */
watch(
  [() => props.active, blocks],
  ([isActive]) => {
    if (!import.meta.client) return
    if (isActive) void nextTick(watchSections)
    else stopWatchingSections()
  },
  { immediate: true },
)

/* The immediate run above happens during setup, before the lesson container
   exists; this is the one that catches the first paint. */
onMounted(() => {
  if (props.active) watchSections()
})

onBeforeUnmount(stopWatchingSections)

function jumpTo(blockId: number): void {
  document.getElementById(`block-${blockId}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
}

/**
 * The pinned strip's measured height, published so a jump clears it.
 *
 * Measured rather than guessed: the strip grows when the rewrite panel opens,
 * and it wraps on a narrow phone. The `7rem` fallback in `.lesson-section`
 * covers the server render and the no-JS case.
 */
const stripEl = ref<HTMLElement | null>(null)
const stripHeight = ref<string | null>(null)

let stripObserver: ResizeObserver | undefined

watch(
  stripEl,
  (element) => {
    stripObserver?.disconnect()
    stripObserver = undefined

    if (!element || typeof ResizeObserver === 'undefined') return

    stripObserver = new ResizeObserver(() => {
      stripHeight.value = `${element.offsetHeight}px`
    })
    stripObserver.observe(element)
  },
  { immediate: true },
)

onBeforeUnmount(() => stripObserver?.disconnect())

/* -- Moving on ------------------------------------------------------------- */

/**
 * Whether the tab this lesson occupies can be handed to the next one.
 *
 * Closing it loses this pane's scroll position and anything typed but not
 * submitted, which is only a safe trade once there is nothing here to lose: the
 * lesson is marked complete, or it has nothing to answer in the first place.
 */
const canReplaceTab = computed(() => completed.value || assessments.value.length === 0)

function goNext(nodeId: number): void {
  if (canReplaceTab.value) emit('next', nodeId)
  else emit('open', nodeId)
}

/* -- Regenerate ------------------------------------------------------------ */

const regenOpen = ref(false)
const instruction = ref('')
const regenNote = ref<string | null>(null)

async function submitRegen(): Promise<void> {
  const steer = instruction.value
  if (await player.regenerate(steer)) {
    regenOpen.value = false
    instruction.value = ''
    regenNote.value =
      steer.trim() === ''
        ? 'Rewriting this lesson. Your progress and past answers are kept.'
        : `Rewriting with “${steer.trim()}”. Your progress and past answers are kept.`
  }
}

/*
 * Everything the strip does not need a button for. History comes with the
 * editor; Regenerate is the author's. A reader of a course their organisation
 * shares reads the lesson as it stands and has nothing to spend — the API
 * refuses both for them anyway.
 */
/** The paperclip in the strip: files here, and whatever the host adds (a link). */
const attachEl = ref<InstanceType<typeof LessonAttachments> | null>(null)
const attachMenu = computed<MenuAction[]>(() => [
  ...(props.editable ? [{ label: 'A file', icon: 'upload', run: () => attachEl.value?.pick() }] : []),
  ...props.attachActions,
])

const stripActions = computed<MenuAction[]>(() => [
  ...(props.editable
    ? [{ label: 'History', icon: 'clock', run: () => emit('history', props.nodeId) }]
    : []),
  ...(props.author
    ? [
        {
          label: 'Regenerate…',
          icon: 'refresh',
          disabled: inFlight.value || editing.value,
          run: () => {
            regenOpen.value = !regenOpen.value
          },
        },
      ]
    : []),
])

/* -- State card ------------------------------------------------------------ */

const statusStyle = computed(() => nodeStatusStyle(node.value?.status))

/* While it is written: a clock against the usual time, not a bar that pulses
   at the same width forever. `writing_for` comes back on every poll. */
const writeClock = useStopwatch(() => node.value)

const writingSeconds = computed(() => writeClock.since(node.value?.writing_for) ?? 0)

const workingNote = computed(() => {
  if (node.value?.status === 'queued') return 'Waiting its turn — lessons are written two at a time'
  if (writingSeconds.value > PACE.lessonSlowSeconds) return 'Longer than usual, but still going'
  return `Usually ${aboutLabel(PACE.lessonSeconds)}`
})

/** Lessons with no content to show: stub, queued, generating, failed. */
const showsStateCard = computed(
  () => !!node.value && !editing.value && (node.value.status !== 'ready' || blocks.value.length === 0),
)

/** Being written, and the server has something to show of it. */
const showsDraft = computed(() => isWorking(node.value?.status) && !!node.value?.draft?.note)
/* Down here because it reads the editor and the state card, which are set up
   above. The tray coming out picks up the pen; going away puts it down. */
watch(markupOpen, (open) => {
  if (open) {
    if (!pen.tool.value) pen.arm('pen')
  } else {
    pen.disarm()
  }
})

/* A lesson that cannot hold the tray right now — it is being edited, or it is
   showing an old version — hands the request back, so the top bar's pen does
   not read as pressed for a tray nobody can see. */
watch(
  () =>
    markupMode.nodeId.value === props.nodeId &&
    props.active &&
    (editing.value || !!props.preview || showsStateCard.value),
  (refused) => {
    if (refused) markupMode.close()
  },
)
</script>

<template>
  <div
    :class="['min-h-full bg-surface text-text', ...reading.classes.value]"
    :style="[reading.style.value, stripHeight ? { '--lesson-header-h': stripHeight } : {}]"
  >
    <!-- Loading -->
    <div
      v-if="loading"
      class="mx-auto max-w-(--reading-measure) px-8 py-8"
    >
      <UiSkeleton
        w="14rem"
        h="0.7rem"
      />
      <UiSkeleton
        w="70%"
        h="1.7rem"
        class="mt-3"
      />
      <UiSkeleton
        h="18rem"
        rounded="lg"
        class="mt-8"
      />
    </div>

    <UiEmptyState
      v-else-if="loadError || !node"
      icon="alert"
      tone="danger"
      title="This lesson can't be opened"
      :description="loadError ?? 'It may have been removed from the course.'"
      class="mx-auto max-w-[560px] px-8 py-20"
    >
      <UiBtn
        variant="secondary"
        icon="refresh"
        @click="player.load()"
        >Try again</UiBtn
      >
      <UiBtn
        variant="ghost"
        @click="emit('close')"
        >Close tab</UiBtn
      >
    </UiEmptyState>

    <template v-else>
      <!-- ---------------------------------------------------------------- -->
      <!-- The lesson's heading. Scrolls away with the rest of the page.     -->
      <!-- ---------------------------------------------------------------- -->
      <div class="lesson-heading mx-auto max-w-(--reading-measure) px-5 pt-5 pb-4 sm:px-8 sm:pt-7">
        <p class="text-[12.5px] leading-snug font-medium text-text-muted">
          <span>{{ contextLead }}</span>
          <span class="num"> · {{ node.estimated_minutes }} min</span>
          <span v-if="afterTitle"> · after “{{ afterTitle }}”</span>
          <!-- Below `sm` the line has room for one neighbour, and the one worth
               keeping is where you came from. -->
          <span
            v-if="thenTitle"
            class="hidden sm:inline"
          >
            · then “{{ thenTitle }}”</span
          >
        </p>
        <template v-if="editing && draft">
          <input
            :value="draft.title"
            type="text"
            aria-label="Lesson title"
            class="mt-1.5 w-full border-0 border-b border-dashed border-border-strong bg-transparent px-0 py-0.5 text-[21px] leading-[1.15] t-head outline-none focus:border-hi-2 sm:text-[30px] sm:leading-[1.1]"
            @input="editor.setTitle(($event.target as HTMLInputElement).value)"
          />
          <div class="mt-3 grid gap-3 sm:grid-cols-[1fr_9rem]">
            <textarea
              :value="draft.summary"
              rows="2"
              aria-label="Summary"
              placeholder="One or two sentences on what this lesson covers."
              :class="[INPUT, 'resize-y']"
              @input="editor.setSummary(($event.target as HTMLTextAreaElement).value)"
            />
            <label class="flex items-center gap-2 text-[12.5px] text-text-muted">
              <input
                :value="draft.estimated_minutes"
                type="number"
                min="1"
                max="600"
                aria-label="Minutes"
                :class="[INPUT, 'w-20']"
                @input="editor.setMinutes(Number(($event.target as HTMLInputElement).value))"
              />
              minutes
            </label>
          </div>
        </template>
        <template v-else>
          <h1
            class="mt-2.5 font-display text-[32px] leading-[1.02] font-semibold tracking-[-0.045em] text-balance text-text sm:text-[42px]"
          >
            {{ preview ? preview.snapshot.title : node.title }}
          </h1>
          <!-- The companion's LessonPane: the teach-back expectation, read before the lesson starts. -->
          <slot name="under-title" />

          <!-- The lesson's size in three facts, as the course player prints
               them under its title: time, parts, checks. Counted from what is
               actually on the page, so an unwritten lesson shows none. -->
          <ul
            v-if="!preview && outline.length"
            class="mt-3.5 flex flex-wrap gap-1.5"
            aria-label="This lesson"
          >
            <li
              v-for="chip in headChips"
              :key="chip.label"
              class="inline-flex h-6 items-center gap-1.5 rounded-full bg-[rgb(var(--wash-rgb)/0.065)] px-2.5 text-[12px] font-semibold text-text-soft"
            >
              <UiIcon
                :name="chip.icon"
                :size="13"
                :stroke="2"
                class="text-text-muted"
              />
              <span class="num">{{ chip.label }}</span>
            </li>
          </ul>
        </template>
      </div>

      <!-- ---------------------------------------------------------------- -->
      <!-- Viewing a version from History                                    -->
      <!-- ---------------------------------------------------------------- -->
      <div
        v-if="preview"
        class="sticky top-0 z-5 border-y border-brand-line bg-brand-soft/92 backdrop-blur-[10px]"
      >
        <div class="mx-auto flex max-w-(--reading-measure) flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-[12.5px] font-medium text-brand sm:px-8">
          <UiIcon
            name="clock"
            :size="13"
          />
          <span
            >Viewing the version from {{ previewWhen }} — {{ preview.summary.toLowerCase() }}.
            <template v-if="preview.changes.counts.changed || preview.changes.counts.added">
              Changed parts are outlined.
            </template>
            <template v-if="previewRemoved.length">
              Removed here: {{ previewRemoved.join(', ') }}.
            </template>
          </span>
        </div>
      </div>

      <!-- ---------------------------------------------------------------- -->
      <!-- The one pinned strip: where you are, and whether you are done.    -->
      <!-- A lesson with nothing in it yet gets neither — offering           -->
      <!-- "Regenerate" for prose that was never written, and "Mark          -->
      <!-- complete" for an empty page, is the state card's job to refuse.   -->
      <!-- ---------------------------------------------------------------- -->
      <div
        v-if="!showsStateCard && !preview"
        ref="stripEl"
        class="sticky top-0 z-5 border-y border-border bg-surface/92 backdrop-blur-[10px]"
      >
        <div class="mx-auto flex max-w-(--reading-measure) items-center gap-2 px-5 py-2.5 sm:px-8">
          <LessonSpine
            :sections="outline"
            :active="activeOrdinal"
            @jump="jumpTo"
          />

          <span class="flex-1" />

          <!-- Editing: what state the draft is in, undo, and the two ways
               out — Done keeps the changes, Cancel puts the lesson back. -->
          <template v-if="editing">
            <span
              :class="['hidden text-[12px] sm:inline', conflict ? 'text-danger' : 'text-text-faint']"
              aria-live="polite"
              >{{ saveState }}</span
            >
            <button
              type="button"
              class="hidden cursor-pointer rounded-md px-2 py-1 text-[12.5px] text-text-soft transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-40 sm:inline-flex"
              :disabled="!canUndo"
              title="Undo (Ctrl+Z)"
              @click="editor.undo()"
            >
              Undo
            </button>
            <button
              type="button"
              class="hidden cursor-pointer rounded-md px-2 py-1 text-[12.5px] text-text-soft transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-40 sm:inline-flex"
              :disabled="!canRedo"
              title="Redo (Ctrl+Shift+Z)"
              @click="editor.redo()"
            >
              Redo
            </button>
            <UiBtn
              variant="ghost"
              size="md"
              class="shrink-0"
              :loading="cancelling"
              title="Put this lesson back the way it was when you started editing"
              @click="askCancel()"
              >Cancel</UiBtn
            >
            <UiBtn
              variant="primary"
              size="md"
              class="shrink-0"
              icon="check"
              :loading="saving"
              @click="editor.finish()"
              >Done</UiBtn
            >
          </template>

          <template v-else>
            <!-- The companion's LessonPane: the reading settings ("Aa"), which
                 the old course page keeps in its own header. -->
            <slot name="strip" />
            <!-- Attaching, as everywhere else: a paperclip, not a dropzone at the end of every lesson. -->
            <UiMenu
              v-if="attachMenu.length"
              icon="paperclip"
              :actions="attachMenu"
              label="Attach to this lesson"
              title="Attach to this lesson"
            />
            <UiBtn
              v-if="canEdit"
              variant="secondary"
              size="md"
              icon="pencil"
              class="shrink-0"
              :disabled="inFlight || markupOpen"
              @click="beginEditing()"
              >Edit</UiBtn
            >
            <UiBtn
              :variant="completed ? 'accent' : 'primary'"
              size="md"
              class="shrink-0"
              :icon="completed ? 'check' : undefined"
              :loading="marking"
              @click="player.toggleComplete()"
              >{{ completed ? 'Completed' : 'Mark complete' }}</UiBtn
            >
            <UiMenu
              v-if="stripActions.length > 0"
              :actions="stripActions"
              label="More for this lesson"
              title="This lesson"
            />
          </template>
        </div>

        <!-- Highlights the lesson no longer has room for -->
        <div
          v-if="!editing && marks.orphans.value > 0"
          class="mx-auto max-w-(--reading-measure) px-5 pb-3 sm:px-8"
        >
          <p class="text-[12px] text-text-faint">
            {{ marks.orphans.value === 1 ? 'One highlight' : `${marks.orphans.value} highlights` }} could not
            be placed since this lesson changed.
          </p>
        </div>

        <!-- Editing went wrong -->
        <div
          v-if="editing && (conflict || problem)"
          class="mx-auto max-w-(--reading-measure) px-5 pb-3 sm:px-8"
        >
          <div
            :class="[
              'pop-in flex flex-wrap items-center gap-2.5 rounded-[12px] border px-3 py-2',
              conflict ? 'border-warn-line bg-warn-soft' : 'border-danger-line bg-danger-soft',
            ]"
          >
            <UiIcon
              name="alert"
              :size="14"
              :class="conflict ? 'text-warn-text' : 'text-danger'"
            />
            <span :class="['flex-1 text-[12.5px]', conflict ? 'text-warn-text' : 'text-danger']">
              {{ conflict ? 'This lesson changed elsewhere. Reload to see the latest version — your unsaved typing here will be lost.' : problem }}
            </span>
            <UiBtn
              v-if="conflict"
              variant="secondary"
              size="sm"
              icon="refresh"
              @click="editor.reload()"
              >Reload</UiBtn
            >
            <UiBtn
              v-if="conflict"
              variant="ghost"
              size="sm"
              @click="editor.discard()"
              >Stop editing</UiBtn
            >
          </div>
        </div>

        <!-- Regenerate -->
        <div
          v-if="regenOpen"
          class="mx-auto max-w-(--reading-measure) px-5 pb-3 sm:px-8"
        >
          <div class="pop-in rounded-[18px] bg-surface-mute p-4 shadow-[inset_0_0_0_1px_var(--border)]">
            <p class="mb-2.5 text-[12.5px] text-text-soft">
              Ask for it again, differently. Your progress and past answers are kept.
              <template v-if="node.edited_at">
                <strong class="font-medium text-warn-text">This lesson has your edits</strong> — regenerating
                replaces them, and you can always restore them from History.
              </template>
            </p>

            <WorkspaceLessonSteer
              v-model="instruction"
              @submit="submitRegen"
            >
              <UiBtn
                variant="primary"
                size="lg"
                @click="submitRegen"
                >Rebuild</UiBtn
              >
            </WorkspaceLessonSteer>
          </div>
        </div>

        <div
          v-if="regenNote"
          class="mx-auto max-w-(--reading-measure) px-5 pb-3 sm:px-8"
        >
          <div
            class="pop-in flex items-center gap-2.5 rounded-[12px] bg-accent-soft px-3 py-2 shadow-[inset_0_0_0_1px_rgb(141_181_30/0.45)]"
          >
            <UiIcon
              name="check"
              :size="14"
              :stroke="2.4"
              class="text-accent-strong"
            />
            <span class="flex-1 text-[12.5px] font-medium text-accent-strong">{{ regenNote }}</span>
            <button
              type="button"
              class="cursor-pointer text-text-faint hover:text-text-soft"
              aria-label="Dismiss"
              @click="regenNote = null"
            >
              <UiIcon
                name="x"
                :size="13"
              />
            </button>
          </div>
        </div>
      </div>

      <!-- ---------------------------------------------------------------- -->
      <!-- No content yet: stub, queued, generating, failed                  -->
      <!-- ---------------------------------------------------------------- -->
      <WorkspaceLessonDraft
        v-if="showsDraft && node.draft"
        :node-id="nodeId"
        :draft="node.draft"
        :seconds="node.status === 'generating' ? writingSeconds : null"
        :progress="easedProgress(writingSeconds, PACE.lessonSeconds)"
        :language="language"
      />
      <div
        v-else-if="showsStateCard"
        class="mx-auto max-w-[560px] px-8 pt-4 pb-16"
      >
        <div class="rounded-[22px] bg-surface p-7 text-center shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.1)]">
          <div
            :class="[
              'mx-auto mb-4 grid size-12 place-items-center rounded-full',
              node.status === 'failed'
                ? 'bg-danger-soft text-danger'
                : node.status === 'stub'
                  ? 'bg-surface-track text-text-soft'
                  : 'bg-brand-soft text-brand',
            ]"
          >
            <UiIcon
              :name="
                node.status === 'failed' ? 'alert' : node.status === 'stub' ? 'layers' : 'loader'
              "
              :size="20"
              :class="isWorking(node.status) && 'animate-spin-slow'"
            />
          </div>

          <p :class="['font-display text-[17px] font-semibold tracking-[-0.02em]', statusStyle.text]">
            {{ inFlight && workingLabel ? workingLabel : statusStyle.label }}
          </p>

          <p class="mx-auto mt-3 max-w-[400px] text-[14px] leading-relaxed text-text-soft">
            {{ node.status === 'failed' ? (node.failure_reason ?? statusStyle.blurb) : statusStyle.blurb }}
          </p>

          <!-- What this lesson is *about*, so a stub is still worth opening. -->
          <p
            v-if="node.summary && node.status === 'stub'"
            class="mx-auto mt-4 max-w-[400px] rounded-[14px] bg-surface-mute px-4 py-3 text-left text-[13px] leading-relaxed text-text-soft shadow-[inset_0_0_0_1px_var(--border)]"
          >
            {{ node.summary }}
          </p>

          <div
            v-if="isWorking(node.status)"
            class="mx-auto mt-4 max-w-[340px]"
          >
            <div class="h-1.5 overflow-hidden rounded-full bg-surface-track">
              <div
                v-if="node.status === 'generating'"
                class="h-full rounded-full bg-brand transition-[width] duration-1000 ease-linear"
                :style="{ width: `${Math.round(easedProgress(writingSeconds, PACE.lessonSeconds) * 100)}%` }"
              />
              <div
                v-else
                class="animate-shimmer h-full w-1/3 rounded-full bg-brand"
              />
            </div>
            <p class="num mt-1.5 flex items-center justify-between gap-3 text-[11.5px] text-text-faint">
              <span>{{ workingNote }}</span>
              <span
                v-if="node.status === 'generating'"
                class="text-text-muted"
                >{{ clockLabel(writingSeconds) }}</span
              >
            </p>
          </div>

          <WorkspaceLessonSteer
            v-if="(node.status === 'stub' || node.status === 'failed') && author"
            v-model="instruction"
            class="mt-5 text-left"
            @submit="player.expand(instruction)"
          />

          <div class="mt-5 flex flex-wrap justify-center gap-2">
            <UiBtn
              v-if="node.status === 'stub' && author"
              :variant="noAi ? 'secondary' : 'accent'"
              size="lg"
              icon="sparkles"
              :loading="player.working.value"
              @click="player.expand(instruction)"
              >Write this lesson</UiBtn
            >
            <UiBtn
              v-if="canWriteYourself"
              :variant="noAi ? 'accent' : 'secondary'"
              size="lg"
              icon="pencil"
              @click="writeYourself()"
              >Write it yourself</UiBtn
            >
            <UiBtn
              v-else-if="node.status === 'failed' && author"
              variant="primary"
              size="lg"
              icon="refresh"
              :loading="player.working.value"
              @click="player.expand(instruction)"
              >Try again</UiBtn
            >
            <UiBtn
              variant="secondary"
              size="lg"
              @click="emit('close')"
              >Close tab</UiBtn
            >
          </div>
        </div>

        <!-- Neighbours: from a dead end, the path is the way out. Only the
             lesson before and the lesson after — never a bag of related ones. -->
        <div
          v-if="prerequisites.length || unlocks.length"
          class="mt-6 grid gap-5 sm:grid-cols-2"
        >
          <div v-if="prerequisites.length">
            <p class="mb-2 text-[12px] font-semibold text-text-faint">Comes before</p>
            <button
              v-for="item in prerequisites"
              :key="item.id"
              type="button"
              class="mb-1.5 flex h-[42px] w-full cursor-pointer items-center gap-2.5 rounded-[12px] bg-surface px-3 text-left shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.1)] transition-colors hover:bg-surface-mute"
              @click="emit('open', item.id)"
            >
              <UiStatusDot :status="item.status" />
              <span class="min-w-0 flex-1 truncate text-[13px] font-medium text-text-body">{{
                item.title
              }}</span>
              <UiIcon
                name="chevron-right"
                :size="13"
                :stroke="2.2"
                class="text-text-faint"
              />
            </button>
          </div>

          <div v-if="nextOnPath.length || detours.length">
            <p class="mb-2 text-[12px] font-semibold text-text-faint">
              {{ nextOnPath.length ? 'Comes next' : 'Under this step' }}
            </p>
            <button
              v-for="item in [...nextOnPath, ...detours]"
              :key="item.id"
              type="button"
              :class="[
                'mb-1.5 flex h-[42px] w-full cursor-pointer items-center gap-2.5 rounded-[12px] px-3 text-left transition-colors hover:bg-surface-mute',
                (item.track ?? 'core') === 'core'
                  ? 'bg-surface shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.1)]'
                  : 'border border-dashed border-border-dashed',
              ]"
              @click="emit('open', item.id)"
            >
              <UiStatusDot :status="item.status" />
              <span class="min-w-0 flex-1 truncate text-[13px] font-medium text-text-body">{{
                item.title
              }}</span>
              <span
                v-if="(item.track ?? 'core') !== 'core' && markOf(item)"
                class="size-[11px] shrink-0 rounded-full"
                :style="{ background: MARK_META[markOf(item)!].color }"
                :title="MARK_META[markOf(item)!].label"
              />
              <UiIcon
                v-else-if="(item.track ?? 'core') === 'core'"
                name="chevron-right"
                :size="13"
                :stroke="2.2"
                class="text-text-faint"
              />
            </button>
          </div>
        </div>
      </div>

      <!-- ---------------------------------------------------------------- -->
      <!-- The lesson                                                        -->
      <!-- ---------------------------------------------------------------- -->
      <!-- A version from History, read-only -->
      <div
        v-else-if="preview"
        class="lesson gap-y-10 px-5 pt-7 pb-24 sm:px-8 sm:pt-8 sm:pb-30"
      >
        <div
          v-for="(block, index) in previewBlocks"
          :key="`p${block.id}`"
          :class="[
            'rounded-[18px]',
            presentationOf(block.type).measure === 'wide' && 'is-wide',
            previewChange.get(block.id)?.change === 'added' && '-mx-3 px-3 py-2 ring-[1.5px] ring-hi-2',
            previewChange.get(block.id)?.change === 'changed' && '-mx-3 px-3 py-2 ring-[1.5px] ring-brand',
          ]"
        >
          <p
            v-if="previewChange.get(block.id)?.change === 'added'"
            class="mb-2 text-[12px] font-semibold text-accent-strong"
          >
            Added in this version
          </p>
          <div
            v-else-if="previewChange.get(block.id)?.change === 'changed'"
            class="mb-2 flex items-center gap-2"
          >
            <span class="text-[12px] font-semibold text-brand">
              Changed{{ previewChange.get(block.id)?.moved ? ' · moved' : '' }}
            </span>
            <button
              v-if="diffableFields(block.id).length"
              type="button"
              class="cursor-pointer rounded-full px-2 py-0.5 text-[11.5px] font-semibold text-brand transition-colors hover:bg-brand-soft"
              @click="toggleDiff(block.id)"
            >
              {{ openDiffs[block.id] ? 'Hide changes' : 'Show changes' }}
            </button>
          </div>
          <p
            v-else-if="previewChange.get(block.id)?.moved"
            class="mb-2 text-[12px] font-medium text-text-faint"
          >
            Moved
          </p>

          <template v-if="openDiffs[block.id] && openDiffs[block.id] !== 'loading'">
            <div
              v-for="item in openDiffs[block.id] as Array<{ field: string; tokens: DiffToken[] }>"
              :key="item.field"
              class="mb-3"
            >
              <p class="mb-1 text-[11px] text-text-faint">{{ item.field.replace(/_/g, ' ') }}</p>
              <BlockDiff :tokens="item.tokens" />
            </div>
          </template>
          <BlockDiff
            v-else-if="openDiffs[block.id] === 'loading'"
            :tokens="[]"
            loading
            class="mb-3"
          />

          <BlockRenderer
            :block="block"
            :assessments="[]"
            :language="language"
            :level="level"
            readonly
            :style="{ '--d': `${Math.min(index, 8) * 45}ms` }"
            class="rise"
          />
        </div>
      </div>

      <!-- Editing -->
      <div
        v-else-if="editing && draft"
        ref="lessonEl"
        class="lesson gap-y-2 px-5 pt-5 pb-24 sm:px-8 sm:pt-6 sm:pb-30"
        @dragend="onDragEnd"
      >
        <template
          v-for="(block, index) in draft.blocks"
          :key="block.key"
        >
          <InsertMenu
            :allows-code="allowsCode"
            @insert="(type, instruction) => insertAt(index, type, instruction)"
          />
          <div
            :class="[
              'relative rounded-xl py-2',
              presentationOf(block.type).measure === 'wide' && 'is-wide',
              dropAt === index && dragKey && 'drop-before',
              dropAt === index + 1 && index === draft.blocks.length - 1 && dragKey && 'drop-after',
            ]"
            @dragover.prevent="onDragOver(index, $event)"
            @drop.prevent="onDrop"
          >
            <EditorFrame
              :block="block"
              :index="index"
              :count="draft.blocks.length"
              :selected="selectedKey === block.key"
              :rewriting="editor.isRewriting(block.key)"
              :rewrite-error="blocks.find((item) => item.id === block.id)?.rewrite_error ?? null"
              @select="editor.select(block.key)"
              @done="editor.select(null)"
              @cancel="editor.cancelSelection()"
              @rewrite="askRewrite(block.key)"
              @remove="editor.remove(block.key)"
              @duplicate="editor.duplicate(block.key)"
              @move-up="editor.shift(block.key, -1)"
              @move-down="editor.shift(block.key, 1)"
              @drag-start="onDragStart(block.key, $event)"
            >
              <BlockEditor
                v-if="selectedKey === block.key"
                :block="block"
                @update="(payload, field) => editor.updatePayload(block.key, payload, field)"
              />
              <BlockRenderer
                v-else
                :block="asBlock(block, index)"
                :assessments="assessments"
                :attempts="attempts"
                :language="language"
                :level="level"
                readonly
              />
            </EditorFrame>
          </div>
        </template>

        <InsertMenu
          standalone
          :allows-code="allowsCode"
          class="mt-4"
          @insert="(type, instruction) => insertAt(draft!.blocks.length, type, instruction)"
        />

        <LessonAttachments
          :node-id="nodeId"
          :attachments="lessonAttachments"
          editable
          class="mt-6"
          @changed="(list) => (lessonAttachments = list)"
        />

        <RewriteDialog
          v-model:open="rewriteOpen"
          :label="rewriteLabel"
          :busy="rewriteBusy"
          @submit="submitRewrite"
        />

        <!-- Cancel: everything this session did, undone. -->
        <UiModal
          v-model:open="cancelAsk"
          size="compact"
          title="Discard your changes?"
          description="This lesson goes back to the version you started editing. Anything saved along the way is undone, and stays in History if you want it later."
        >
          <div class="flex justify-end gap-2">
            <UiBtn
              variant="secondary"
              :disabled="cancelling"
              @click="cancelAsk = false"
              >Keep editing</UiBtn
            >
            <UiBtn
              variant="danger"
              icon="refresh"
              :loading="cancelling"
              @click="confirmCancel()"
              >Discard changes</UiBtn
            >
          </div>
        </UiModal>
      </div>

      <div
        v-else
        ref="lessonEl"
        class="lesson isolate gap-y-10 px-5 pt-7 pb-20 sm:px-8 sm:pt-8 sm:pb-24"
      >
        <!-- MarkupBlock takes the grid slot; the #block-{id} anchor stays on the
             renderer inside it, so search jumps and the section spine still land. -->
        <template
          v-for="(block, index) in blocks"
          :key="block.id"
        >
          <!-- Where reading ends and practice starts: one plain break says what the rest is. -->
          <template v-if="index === practiceFrom">
            <section
              class="mt-6"
              aria-labelledby="lesson-practice-head"
            >
              <div
                class="flex items-center gap-3 text-[12px] font-semibold text-text-faint"
                aria-hidden="true"
              >
                <span class="h-px flex-1 bg-border" />
                End of reading
                <span class="h-px flex-1 bg-border" />
              </div>
              <div class="mt-6 flex items-start gap-3.5 rounded-[18px] bg-surface-mute px-5 py-4">
                <span class="grid size-10 shrink-0 place-items-center rounded-[11px] bg-inverse text-on-inverse">
                  <UiIcon
                    name="target"
                    :size="19"
                  />
                </span>
                <div class="min-w-0">
                  <h2
                    id="lesson-practice-head"
                    class="font-display text-[21px] leading-tight font-semibold tracking-[-0.02em] text-text"
                  >
                    Now practise
                  </h2>
                  <p class="mt-1 text-[14.5px] leading-relaxed text-text-muted">
                    {{ practiceLine }}
                  </p>
                </div>
              </div>
            </section>
          </template>
          <MarkupBlock
            :block-id="block.id"
            :node-id="nodeId"
            :annotations="marks.byBlock(block.id)"
            :tool="pen.tool.value"
            :color="pen.color.value"
            :size="pen.size.value"
            :armed="pen.armed.value"
            :editable="canMark"
            :class="['rise', presentationOf(block.type).measure === 'wide' && 'is-wide']"
            :style="{ '--d': `${Math.min(index, 8) * 45}ms` }"
            @upsert="marks.upsert"
            @remove="marks.remove"
            @orphans="(count) => marks.reportOrphans(block.id, count)"
          >
            <BlockRenderer
              :block="block"
              :assessments="assessments"
              :attempts="attempts"
              :language="language"
              :level="level"
              @graded="player.onGraded"
            />
          </MarkupBlock>
        </template>

        <!-- What the owner attached (files, and the host's links), only when there is some:
             adding is the strip's paperclip. -->
        <LessonAttachments
          ref="attachEl"
          :node-id="nodeId"
          :attachments="lessonAttachments"
          :editable="editable"
          quiet
          @changed="(list) => (lessonAttachments = list)"
        />
        <slot name="attached" />

        <!--
          The end of the lesson, then the way on. A rule says the lesson is over;
          one row says whether it is done, with its one or two buttons; then the
          way out as two halves, back on the left and on on the right. The next
          lesson keeps the right half even on the first lesson, so it reads as
          the next step and not as one more card in the column (11-09).
        -->
        <footer
          class="mt-4"
          aria-label="End of lesson"
        >
          <div
            class="flex items-center gap-3 text-[12px] font-semibold text-text-faint"
            aria-hidden="true"
          >
            <span class="h-px flex-1 bg-border" />
            End of lesson
            <span class="h-px flex-1 bg-border" />
          </div>

          <!-- Done, and the companion's "Explain it back" (LessonPane's `finish`) beside it. -->
          <div class="mt-5 flex flex-wrap items-center gap-x-3 gap-y-3">
            <div class="min-w-0 flex-1 basis-[200px]">
              <p class="text-[15px] font-semibold text-text">
                {{ completed ? 'You finished this lesson' : 'Finished this lesson?' }}
              </p>
              <p class="mt-0.5 text-[13px] text-text-faint">{{ finishLine }}</p>
            </div>
            <slot name="finish" />
            <UiBtn
              :variant="completed ? 'accent' : 'primary'"
              size="md"
              :icon="completed ? 'check' : undefined"
              :loading="marking"
              @click="player.toggleComplete()"
              >{{ completed ? 'Completed' : 'Mark complete' }}</UiBtn
            >
          </div>

          <!-- Where to go: back on the left, on on the right, and what hangs off this step under them. -->
          <nav
            v-if="prevStep || nextOnPath.length || detours.length || track === 'core'"
            class="mt-6"
            aria-label="Where to go next"
          >
            <div class="grid gap-3 sm:grid-cols-2">
              <button
                v-if="prevStep"
                type="button"
                class="group flex min-w-0 cursor-pointer items-center gap-3 rounded-[16px] px-4 py-3.5 text-left shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.12)] transition-[background-color,box-shadow] hover:bg-surface-mute hover:shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.2)] max-sm:order-last"
                @click="goNext(prevStep.id)"
              >
                <UiIcon
                  name="chevron-left"
                  :size="18"
                  :stroke="2"
                  class="shrink-0 text-text-faint transition-[color,transform] group-hover:-translate-x-0.5 group-hover:text-text"
                />
                <span class="min-w-0 flex-1">
                  <span class="block text-[11.5px] font-semibold text-text-faint">Previous lesson</span>
                  <span class="mt-0.5 block truncate text-[15px] font-semibold text-text">{{ prevStep.title }}</span>
                </span>
              </button>
              <button
                v-for="item in nextOnPath"
                :key="item.id"
                type="button"
                class="group flex min-w-0 cursor-pointer items-center gap-3 rounded-[16px] bg-surface-mute px-4 py-3.5 text-right shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.12)] transition-[background-color,box-shadow] hover:bg-surface-sunken hover:shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.2)] sm:col-start-2"
                @click="goNext(item.id)"
              >
                <span class="min-w-0 flex-1">
                  <span class="block text-[11.5px] font-semibold text-text-faint">
                    Next lesson<template v-if="item.status !== 'ready'">
                      · {{ nodeStatusStyle(item.status).label.toLowerCase() }}</template
                    >
                  </span>
                  <span class="mt-0.5 block truncate text-[15px] font-semibold text-text">{{
                    item.title
                  }}</span>
                </span>
                <UiIcon
                  name="arrow-right"
                  :size="18"
                  :stroke="2"
                  class="shrink-0 text-text-faint transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-text"
                />
              </button>
              <p
                v-if="!nextOnPath.length && track === 'core'"
                class="flex items-center justify-end rounded-[16px] px-4 py-3.5 text-right text-[13px] text-text-faint shadow-[inset_0_0_0_1px_var(--border-dashed)] sm:col-start-2"
              >
                This is the last step on the path.
              </p>
            </div>

            <div
              v-if="detours.length"
              class="mt-3 flex flex-wrap items-center gap-1.5"
            >
              <span class="mr-1 text-[12.5px] text-text-faint">Optional, under this step:</span>
              <button
                v-for="item in detours"
                :key="item.id"
                type="button"
                class="flex h-[30px] cursor-pointer items-center gap-1.5 rounded-full bg-surface-rail px-3 text-[12.5px] font-medium text-text-dim transition-colors hover:bg-surface-sunken hover:text-text"
                :title="markOf(item) ? MARK_META[markOf(item)!].label : undefined"
                @click="emit('open', item.id)"
              >
                <span
                  v-if="markOf(item)"
                  class="size-[8px] shrink-0 rounded-full"
                  :style="{ background: MARK_META[markOf(item)!].color }"
                />
                {{ item.title }}
              </button>
            </div>
          </nav>
        </footer>
      </div>

      <!-- The pen tray, while it is out: sticky to the bottom of the scrolling
           pane while the lesson scrolls under it; `pointer-events` so the
           lesson stays clickable either side of it. -->
      <div
        v-if="canMark && !editing && !preview && !showsStateCard"
        :class="[
          'pointer-events-none sticky bottom-4 z-40 flex px-4',
          markupOpen ? 'justify-center' : 'justify-end',
        ]"
      >
        <MarkupToolbar
          v-if="markupOpen"
          v-model:tool="pen.tool.value"
          v-model:color="pen.color.value"
          v-model:size="pen.size.value"
          :can-undo="marks.canUndo.value"
          :can-redo="marks.canRedo.value"
          :boards="boardList"
          placement="inline"
          class="pointer-events-auto"
          @undo="marks.undo()"
          @redo="marks.redo()"
          @new-board="newBoard()"
          @open-board="openBoard"
          @done="closeMarkup()"
        />
        <button
          v-else
          type="button"
          title="Draw, write and highlight"
          aria-label="Draw, write and highlight"
          class="pointer-events-auto grid size-12 cursor-pointer place-items-center rounded-full bg-inverse text-on-inverse shadow-[var(--shadow-lift)] transition-transform duration-300 ease-[var(--spring)] hover:scale-105 active:scale-95"
          @click="openMarkup()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-5"
            aria-hidden="true"
          >
            <path d="m11 10 3 3" />
            <path d="M6.5 21A3.5 3.5 0 1 0 3 17.5a2.62 2.62 0 0 1-.708 1.792A1 1 0 0 0 3 21z" />
            <path d="M9.969 17.031 21.378 5.624a1 1 0 0 0-3.002-3.002L6.967 14.031" />
          </svg>
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Where a dragged part will land: a hairline in the accent, above or below. */
.drop-before::before,
.drop-after::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  border-radius: 1px;
  background: var(--color-accent);
}

.drop-before::before {
  top: -2px;
}

.drop-after::after {
  bottom: -2px;
}
</style>
