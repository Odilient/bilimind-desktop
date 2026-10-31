<script setup lang="ts">
import type { BoardAnnotation, CourseNode, ProgressState } from '~/types/api'
import type { Deadline, Item, Session, Topic } from '~/companion/types'
import type { MenuAction } from '~/components/ui/Menu.vue'
import type { StripTab } from '~/components/companion/course/Tabs.vue'
import type { RunLang, SandboxTest } from '~/composables/useWasmSandbox'
import type { CourseView } from '~/companion/course-home'
import { OPEN_SANDBOX, type OpenSandboxPayload } from '~/composables/useWorkspace'
import { useCompanion } from '~/companion/store'
import { addLink, fileTarget, namedTarget, useCapture } from '~/companion/capture'
import { openCompanionTab } from '~/companion/tabs'
import { courseColor } from '~/companion/colors'
import { dayKey, shortDate, untilLabel } from '~/companion/time'
import { readyWords } from '~/companion/words'
import { dueTopics } from '~/companion/checks'
import { isTopicBox, topicOfNode, topicsAsNodes, type TopicProgress } from '~/companion/roadmap'
import { useLessonCourse, writeLesson } from '~/companion/lessons'
import { fetchFileUrl, knownFileUrl } from '~/companion/files'
import { contextFrom } from '~/companion/doc/context'
import { isTemplateKey, templateTitle as pageTitle, type TemplateKey } from '~/companion/doc/templates'
import { boardContext, nextProject, nextRevisable } from '~/companion/board/context'
import {
  buildBoard,
  TEMPLATES as BOARD_TEMPLATES,
  templateTitle as boardTitle,
  type TemplateName,
} from '~/companion/board/templates'
import { boardParts, newUuid } from '~/companion/board/model'
import { boardPreview } from '~/companion/board/ops'
import { seedBoard } from '~/companion/board/persistence'
import { makeBoard } from '~/companion/notes/make'
import { archiveCourse, isArchived, restoreCourse } from '~/companion/shelf'
import { useAi, useAiContext } from '~/companion/ai/state'
import { useQuietAi } from '~/companion/quiet-ai'
import { usePanelWidth } from '~/companion/panel-width'
import {
  continueTarget,
  courseProgress,
  courseStateLine,
  recallCourse,
  rememberCourse,
} from '~/companion/course-home'

/**
 * A course: the old course workspace (`pages/[user]/[course].vue`) driven by
 * the companion's own rows, extended into the place a course is studied.
 *
 *   [rail] [ the course's outline ] [ header · strip · content ] [ Ask BiliMind ]
 *
 *  - The left panel (`CompanionCourseSidebar`, the old sidebar's look): the
 *    course's lessons by week or unit, its notes and whiteboards as a tree,
 *    its files, all at once, with one field that narrows them.
 *  - The header (`CompanionCourseHeader`): where you are down to the document
 *    in front, the nearest deadline and how ready you are, Record, one
 *    "+ New", the AI's button and the course's "…".
 *  - The strip (`CompanionCourseTabs`): the course's home first, pinned, then
 *    every open document (a lesson, a note, a whiteboard, a lesson's board,
 *    a sandbox) like editor tabs. The roadmap, weeks and deadlines are views
 *    inside the home, not tabs: they are the course, not things opened in it.
 *  - The home (`CompanionCourseHome`): the course's name, where it stands,
 *    progress in words, and a Continue that already knows what's next; then
 *    Roadmap · Weeks (or Path) · Deadlines · Notes · Materials · Practice.
 *  - A lesson (`CompanionCourseLessonPane`): the old lesson view with its
 *    markup, history, sandbox and boards. The first lesson opened on a wide
 *    screen brings the companion in beside it, as the old page had its chat.
 *  - The AI panel (`CompanionAiPanel`), docked last in the row; it reads what
 *    is in front (the course, the lesson, the note) from `useAiContext`.
 *
 * Every open document stays mounted and is hidden by visibility, so going
 * back to a tab finds it where it was left. What was open, the view and the
 * last lesson read are remembered per course on this device
 * (`companion/course-home.ts`), so a course reopens where it was left and its
 * Continue names that lesson.
 *
 * `?tab=` names a view of the home (roadmap, weeks, path, deadlines, notes,
 * materials, practice) and `?open=` one thing: `lesson:<id>`, `note:<id>`,
 * `board:<id>`, `topic:<id>` (its lesson, or its brief) or `class:<id>`
 * (that class's notes). The address follows what is in front.
 *
 * On a phone: a 48px header (back, the title, Ask, "…"), the home's views on
 * a bottom bar (Map, Weeks or Path, Due, Notes, Files), and a document takes
 * the whole screen with the way back to the view.
 *
 * `/app/courses/notebook` was Notes when Notes lived here; it goes to
 * `/app/notes` now.
 */
definePageMeta({
  layout: 'companion',
  // A course gets the box exactly and brings its own bars.
  workspace: true,
  middleware: [
    (to) => {
      if (to.params.id === 'notebook') return navigateTo('/app/notes', { replace: true })
    },
  ],
})

const route = useRoute()
const router = useRouter()
const c = useCompanion()
const capture = useCapture()
const toast = useToast()
const api = useApi()
const ai = useAi()
const { quiet } = useQuietAi()

const id = computed(() => String(route.params.id))
const subject = computed(() => c.get('subjects', id.value))
const goal = computed(() => c.goalOf(subject.value))
const isPath = computed(() => subject.value?.format === 'path')
const notFound = computed(() => c.status.ready && !subject.value)

// Deleted while open (from the Courses page in another tab, another device): back to Courses.
c.onGone('subjects', () => id.value, () => void navigateTo('/app/courses', { replace: true }))

useHead(() => ({ title: subject.value ? `${subject.value.title} · BiliMind` : 'BiliMind' }))

watch(
  subject,
  (s) => {
    if (s) openCompanionTab({ kind: 'course', id: s.id, title: s.title, to: `/app/courses/${s.id}`, color: s.color })
  },
  { immediate: true },
)

/* Both layouts share one tree; CSS swaps the chrome at the shell's own `lg`
   line. This is for what CSS can't choose: a modal or a sheet. */
const isPhone = useIsPhone()

/* -- The course's rows ----------------------------------------------------- */

const topics = computed(() => c.topics.value.filter((t) => t.subject_id === id.value))
const sessions = computed(() => c.sessions.value.filter((s) => s.subject_id === id.value))
const deadlines = computed(() => c.deadlines.value.filter((d) => d.subject_id === id.value))
const ownItems = computed(() => c.items.value.filter((i) => i.subject_id === id.value))

const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  clock = setInterval(() => (now.value = Date.now()), 60_000)
})
onBeforeUnmount(() => clearInterval(clock))

const liveSession = computed<Session | null>(
  () =>
    sessions.value.find(
      (s) => !s.cancelled && Date.parse(s.starts_at) <= now.value && Date.parse(s.ends_at) > now.value,
    ) ?? null,
)
const nextSession = computed<Session | null>(
  () => sessions.value.find((s) => !s.cancelled && Date.parse(s.starts_at) > now.value) ?? null,
)
const canRecord = computed(() => Boolean(subject.value && !isPath.value && subject.value.recording_allowed))

/** The chip in the top bar: the nearest date that counts, and how ready for it. */
const due = computed<{ deadline: Deadline; words: string; ready: boolean } | null>(() => {
  const d = deadlines.value.find(
    (x) => x.status === 'upcoming' && x.due_at && Date.parse(x.due_at) > now.value,
  )
  if (!d) return null
  const scope = c.readinessOf(d)
  const r = scope.total ? scope : null
  const words = [d.title, untilLabel(d.due_at!, now.value), r ? readyWords(r.checked ? r.percent : null) : null]
    .filter(Boolean)
    .join(' · ')
  return { deadline: d, words, ready: Boolean(r?.checked && r.percent >= 85) }
})

/* -- The roadmap: topics as lesson boxes, or the real lessons ------------- */

const lessons = useLessonCourse(subject)
const lessonCourse = lessons.course

const pathStates = computed(() =>
  isPath.value ? new Map(c.pathOf(id.value).map((step) => [step.topic.id, step.state])) : null,
)

/** Ready is done; heard in class or started is learning; the rest is ahead. */
function topicProgress(topic: Topic): TopicProgress {
  const states = pathStates.value
  if (states) {
    const state = states.get(topic.id)
    return state === 'done' ? 'completed' : state === 'now' ? 'in_progress' : null
  }
  const signal = c.topicSignalOf(topic)
  if (signal.seen && signal.practiced && signal.percent >= 85) return 'completed'
  return signal.seen > 0 ? 'in_progress' : null
}

const synthetic = computed<CourseNode[]>(() =>
  subject.value
    ? topicsAsNodes(topics.value, {
        subject: subject.value,
        goal: goal.value,
        sessions: sessions.value,
        deadlines: deadlines.value,
        progress: topicProgress,
      })
    : [],
)

const realNodes = computed<CourseNode[]>(() => lessonCourse.value?.nodes ?? [])
const usingReal = computed(() => realNodes.value.length > 0)

/**
 * Marks made on the map this visit (right-click, shift-click, the brief's
 * buttons), laid over whatever the boxes say until the course says it too.
 */
const marks = ref<Record<number, ProgressState>>({})

/**
 * A real lesson nobody has marked yet still shows where the companion has the
 * learner (heard in class, practised): the path clears behind them either way,
 * and the map counts what the header and the Courses card count. A unit is
 * done when everything in it is.
 */
function companionMark(node: CourseNode): ProgressState | null {
  if (!usingReal.value || (node.progress && node.progress.state !== 'available')) return null
  const topic = topics.value.find((t) => t.node_id === node.id)
  if (!topic) return null
  const inside = topics.value.filter((t) => t.parent_id === topic.id).map(topicProgress)
  if (!inside.length) return topicProgress(topic)
  return inside.every((mark) => mark === 'completed') ? 'completed' : inside.some(Boolean) ? 'in_progress' : null
}

const nodes = computed<CourseNode[]>(() =>
  (usingReal.value ? realNodes.value : synthetic.value).map((node) => {
    const mark = marks.value[node.id] ?? companionMark(node)
    if (!mark) return node
    return {
      ...node,
      progress: {
        node_id: node.id,
        state: mark,
        time_spent_seconds: node.progress?.time_spent_seconds ?? 0,
        completed_at: mark === 'completed' ? new Date().toISOString() : null,
        last_seen_at: new Date().toISOString(),
      },
    }
  }),
)
const nodesById = computed(() => new Map(nodes.value.map((node) => [node.id, node])))

async function setProgress(nodeId: number, state: ProgressState): Promise<void> {
  const before = marks.value[nodeId]
  marks.value = { ...marks.value, [nodeId]: state }
  // A real lesson's progress lives on the server (the demo's answers in
  // memory); a topic's is the companion's own.
  if (!usingReal.value) return
  try {
    await api.post(`/nodes/${nodeId}/progress`, { state })
    // The shared copy, so the header, the Courses card and Today move too.
    void lessons.refresh()
  } catch (err) {
    const next = { ...marks.value }
    if (before) next[nodeId] = before
    else delete next[nodeId]
    marks.value = next
    toast.error(err instanceof Error ? err.message : 'That could not be saved.')
  }
}

/** The box a written lesson is drawn as: itself, or the topic box that leads to it. */
function boxOf(lessonId: number): number {
  if (usingReal.value) return lessonId
  const topic = topics.value.find((t) => t.node_id === lessonId)
  return (topic && synthetic.value.find((node) => topicOfNode(node, [topic]))?.id) ?? lessonId
}

/* While a lesson is being written its course is stale the moment it lands. */
let poll: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  poll = setInterval(() => {
    const writing = realNodes.value.some((node) => node.status === 'queued' || node.status === 'generating')
    if (writing && document.visibilityState === 'visible') void lessons.refresh()
  }, 4000)
})
onBeforeUnmount(() => clearInterval(poll))

/* -- The sidebar's chapters: this term's weeks, or the path's units --------- */

const TERM_WEEKS = 14
const weekLabel = (n: number): string => (n > TERM_WEEKS ? `Exams, week ${n - TERM_WEEKS}` : `Week ${n}`)

/** The week each topic is first taught in. */
const weekOfTopic = computed(() => {
  const map = new Map<string, number>()
  for (const s of sessions.value) {
    if (s.cancelled || !s.topic_id || map.has(s.topic_id)) continue
    const n = s.week ?? c.weekOf(s.starts_at)
    if (n) map.set(s.topic_id, n)
  }
  return map
})

/**
 * The lesson list in the sidebar: a school course's topics headed by the week
 * they're taught in (a path keeps its units), so this week's lessons can
 * start unfolded and the term reads as the timetable does.
 */
const sidebarNodes = computed<CourseNode[]>(() => {
  if (isPath.value || topics.value.some((t) => t.parent_id)) return nodes.value
  let last: string | null = null
  return nodes.value.map((node) => {
    const topic = topicOfNode(node, topics.value)
    const n = topic ? weekOfTopic.value.get(topic.id) : undefined
    const section = n ? weekLabel(n) : last
    if (section) last = section
    return section === node.section ? node : { ...node, section }
  })
})

const chapters = computed(() => {
  const sections = [...new Set(sidebarNodes.value.map((n) => n.section).filter(Boolean))] as string[]
  if (isPath.value || topics.value.some((t) => t.parent_id)) {
    const nowTopic = c.pathOf(id.value).find((s) => s.state === 'now')?.topic
    const node = nowTopic ? sidebarNodes.value.find((n) => topicOfNode(n, [nowTopic])) : null
    const unit = node?.section ?? null
    return { open: unit ? [unit] : sections.slice(0, 1), current: unit }
  }
  const week = c.currentWeek.value ?? 1
  const current = sections.includes(weekLabel(week)) ? weekLabel(week) : null
  // No topic this week: the next week that has one starts open instead.
  const ahead = sections.find((s) => {
    const n = Number(/(\d+)$/.exec(s)?.[1] ?? 0)
    return !s.startsWith('Exams') && n >= week
  })
  return { open: [current ?? ahead].filter(Boolean) as string[], current }
})

/* -- What's open: the home, and the documents beside it --------------------- */

const HOME = 'home'

type DocTab =
  | { kind: 'lesson'; id: string; nodeId: number }
  | { kind: 'note'; id: string; itemId: string }
  | { kind: 'board'; id: string; itemId: string }
  | { kind: 'markup'; id: string; nodeId: number; uuid: string; title: string }
  | { kind: 'sandbox'; id: string; title: string; lang: RunLang; code: string; tests?: SandboxTest[] }

interface CourseState {
  /** Open documents, in strip order. */
  docs: DocTab[]
  /** The document in front, or `HOME`. */
  front: string
  /** The home's view. */
  view: CourseView
}

/* Per course, for the session, like the old workspace's strip: opening a
   second course doesn't inherit the first one's tabs. */
const all = useState<Record<string, CourseState>>('companion:course-workspace', () => ({}))

function state(): CourseState {
  return all.value[id.value] ?? { docs: [], front: HOME, view: 'map' }
}

function patch(changes: Partial<CourseState>): void {
  all.value = { ...all.value, [id.value]: { ...state(), ...changes } }
}

const mainView = computed<CourseView>(() => (isPath.value ? 'path' : 'weeks'))

function normalView(view: CourseView | null | undefined): CourseView {
  if (!view) return 'map'
  return view === 'weeks' || view === 'path' ? mainView.value : view
}

const docs = computed(() => state().docs)
const view = computed({
  get: () => normalView(state().view),
  set: (next: CourseView) => patch({ view: normalView(next), front: HOME }),
})
const activeId = computed(() => {
  const front = state().front
  return docs.value.some((tab) => tab.id === front) ? front : HOME
})
const frontDoc = computed(() => docs.value.find((tab) => tab.id === activeId.value) ?? null)
const homeActive = computed(() => activeId.value === HOME)

function docsOf<K extends DocTab['kind']>(kind: K): Extract<DocTab, { kind: K }>[] {
  return docs.value.filter((tab): tab is Extract<DocTab, { kind: K }> => tab.kind === kind)
}
const lessonTabs = computed(() => docsOf('lesson'))
const noteTabs = computed(() => docsOf('note'))
const boardTabs = computed(() => docsOf('board'))
const markupTabs = computed(() => docsOf('markup'))
const sandboxTabs = computed(() => docsOf('sandbox'))

/** A new document opens right after the one in front, as editors do. */
function openDoc(tab: DocTab): void {
  const list = state().docs
  if (list.some((t) => t.id === tab.id)) {
    patch({ front: tab.id })
    return
  }
  const at = list.findIndex((t) => t.id === activeId.value)
  const next = at < 0 ? [...list, tab] : [...list.slice(0, at + 1), tab, ...list.slice(at + 1)]
  patch({ docs: next, front: tab.id })
}

function focus(tabId: string): void {
  patch({ front: tabId })
}

function showHome(next?: CourseView): void {
  patch({ front: HOME, ...(next ? { view: normalView(next) } : {}) })
}

function close(tabId: string): void {
  const list = state().docs
  const index = list.findIndex((tab) => tab.id === tabId)
  if (index < 0) return
  const rest = list.filter((tab) => tab.id !== tabId)
  if (activeId.value !== tabId) {
    patch({ docs: rest })
    return
  }
  // The neighbour on the right, then the left, then the course's home.
  const neighbour = rest[index] ?? rest[index - 1] ?? null
  patch({ docs: rest, front: neighbour?.id ?? HOME })
}

function move(tabId: string, before: string | null): void {
  const list = [...state().docs]
  const from = list.findIndex((t) => t.id === tabId)
  if (from < 0) return
  const [tab] = list.splice(from, 1)
  const to = before ? list.findIndex((t) => t.id === before) : list.length
  list.splice(to < 0 ? list.length : to, 0, tab!)
  patch({ docs: list })
}

function openLesson(nodeId: number): void {
  openDoc({ kind: 'lesson', id: `lesson:${nodeId}`, nodeId })
  bringCompanion()
}

function openItem(item: Pick<Item, 'id' | 'kind'>): void {
  if (item.kind === 'page') openDoc({ kind: 'note', id: `note:${item.id}`, itemId: item.id })
  else if (item.kind === 'board') openDoc({ kind: 'board', id: `board:${item.id}`, itemId: item.id })
  else {
    const row = c.get('items', item.id)
    if (row) void openFile(row)
  }
}

/** A lesson's name: the written course's, else the topic's. */
function lessonTitle(nodeId: number): string {
  return (
    realNodes.value.find((node) => node.id === nodeId)?.title ??
    topics.value.find((t) => t.node_id === nodeId)?.title ??
    'Lesson'
  )
}

/** What a tab is called, from the rows as they are now, so a rename shows at once. */
function titleOf(tab: DocTab): string {
  switch (tab.kind) {
    case 'lesson':
      return lessonTitle(tab.nodeId)
    case 'note':
      return c.get('items', tab.itemId)?.title || 'Untitled'
    case 'board':
      return c.get('items', tab.itemId)?.title || 'Untitled whiteboard'
    default:
      return tab.title
  }
}

const strip = computed<StripTab[]>(() =>
  docs.value.map((tab) => {
    const base = { id: tab.id, title: titleOf(tab) }
    switch (tab.kind) {
      case 'lesson':
        return { ...base, status: realNodes.value.find((node) => node.id === tab.nodeId)?.status ?? 'ready' }
      case 'note':
        return { ...base, icon: 'page' }
      case 'board':
        return { ...base, icon: 'board' }
      case 'markup':
        return { ...base, icon: 'pencil' }
      default:
        return { ...base, icon: 'code' }
    }
  }),
)

const activeLessonId = computed(() => (frontDoc.value?.kind === 'lesson' ? frontDoc.value.nodeId : null))
const activeBoxId = computed(() => (activeLessonId.value ? boxOf(activeLessonId.value) : null))
const openBoxIds = computed(() => lessonTabs.value.map((tab) => boxOf(tab.nodeId)))
const activeItemId = computed(() =>
  frontDoc.value?.kind === 'note' || frontDoc.value?.kind === 'board' ? frontDoc.value.itemId : null,
)
const openItemIds = computed(() => [...noteTabs.value, ...boardTabs.value].map((tab) => tab.itemId))

/**
 * A tab whose thing is gone closes: a note or board deleted anywhere (its
 * own menu, Notes, this course's lists, another device; at once, while its
 * Undo is up), a lesson no longer in the course's written lessons.
 */
const deadTabs = computed(() =>
  c.status.ready
    ? docs.value.filter((tab) =>
        tab.kind === 'note' || tab.kind === 'board'
          ? !c.get('items', tab.itemId)
          : tab.kind === 'lesson' && usingReal.value && !realNodes.value.some((node) => node.id === tab.nodeId),
      )
    : [],
)
watch(deadTabs, (gone) => gone.forEach((tab) => close(tab.id)), { immediate: true })

/* -- Remembered per course: the view, the open documents, the last lesson -- */

/** The `?open=` words for a document worth reopening tomorrow. */
function docKey(tab: DocTab): string | null {
  if (tab.kind === 'lesson') return `lesson:${tab.nodeId}`
  if (tab.kind === 'note') return `note:${tab.itemId}`
  if (tab.kind === 'board') return `board:${tab.itemId}`
  return null
}

function docFromKey(key: string): DocTab | null {
  const [kind, rest] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)]
  const lessonId = Number(rest)
  // The demo's lessons have negative ids, so any whole number but zero is one.
  if (kind === 'lesson' && Number.isInteger(lessonId) && lessonId !== 0) {
    return { kind: 'lesson', id: key, nodeId: lessonId }
  }
  const item = c.get('items', rest)
  if (!item || item.subject_id !== id.value) return null
  if (kind === 'note' && item.kind === 'page') return { kind: 'note', id: key, itemId: rest }
  if (kind === 'board' && item.kind === 'board') return { kind: 'board', id: key, itemId: rest }
  return null
}

/** The lesson read last in this course, on this device: what Continue picks up. */
const lastLesson = ref<{ id: number; title: string } | null>(null)

watch(
  () => subject.value?.id,
  (subjectId) => {
    if (subjectId) lastLesson.value = recallCourse(subjectId).lesson ?? null
  },
  { immediate: true },
)

/** First visit this session: lay the course out as it was left on this device. */
function restore(): void {
  if (!subject.value || all.value[id.value]) return
  const memory = recallCourse(id.value)
  const restored = (memory.docs ?? []).map(docFromKey).filter((t): t is DocTab => Boolean(t)).slice(-6)
  const front = memory.front && restored.some((t) => t.id === memory.front) ? memory.front : HOME
  patch({ docs: restored, front, view: normalView(memory.view) })
}

watch(
  () => all.value[id.value],
  (s) => {
    if (!s || !subject.value) return
    const keys = s.docs.map(docKey).filter((k): k is string => Boolean(k))
    const front = s.docs.find((t) => t.id === s.front)
    const frontKey = front ? docKey(front) : null
    rememberCourse(id.value, { view: s.view, docs: keys, front: frontKey })
  },
)

watch(activeLessonId, (nodeId) => {
  if (nodeId === null || !subject.value) return
  lastLesson.value = { id: nodeId, title: lessonTitle(nodeId) }
  rememberCourse(id.value, { lesson: lastLesson.value })
})

/* -- The address ---------------------------------------------------------- */

function queryOf(name: string): string | null {
  const value = route.query[name]
  const one = Array.isArray(value) ? value[0] : value
  return typeof one === 'string' && one ? one : null
}

const VIEW_ALIAS: Record<string, CourseView> = {
  map: 'map',
  roadmap: 'map',
  topics: 'map',
  main: 'weeks',
  weeks: 'weeks',
  path: 'path',
  deadlines: 'deadlines',
  due: 'deadlines',
  practice: 'practice',
  notes: 'notes',
  materials: 'materials',
  files: 'materials',
}

/** `?tab=` and `?open=`, applied once the course is here, and again when a link changes them. */
function applyQuery(): void {
  if (!subject.value) return
  restore()
  const opened = queryOf('open')
  if (opened) {
    const kind = opened.slice(0, opened.indexOf(':'))
    const key = opened.slice(opened.indexOf(':') + 1)
    if (kind === 'topic' || kind === 'class') {
      // Not a document: done once, then dropped from the address.
      if (kind === 'topic') {
        const topic = c.get('topics', key)
        if (topic) openTopic(topic)
      } else {
        const session = c.get('sessions', key)
        if (session) void openClass(session)
      }
      void router.replace({ query: { ...route.query, open: undefined } })
      return
    }
    const tab = docFromKey(opened)
    if (tab?.kind === 'lesson') return openLesson(tab.nodeId)
    if (tab) return openDoc(tab)
  }
  const named = VIEW_ALIAS[queryOf('tab') ?? '']
  if (named) showHome(named)
}

/* The address follows what's in front, so it is always the one worth copying. */
watch(
  () => [activeId.value, view.value] as const,
  () => {
    if (!import.meta.client || !subject.value) return
    const front = frontDoc.value
    const next = {
      tab: !front && view.value !== 'map' ? view.value : undefined,
      open: front ? (docKey(front) ?? undefined) : undefined,
    }
    if ((next.tab ?? null) === queryOf('tab') && (next.open ?? null) === queryOf('open')) return
    void router.replace({ query: { ...route.query, ...next } })
  },
)

/* -- Lessons and the brief --------------------------------------------------- */

/** A box on the map or a row in the list: its lesson if it has one, else its brief. */
function openBox(nodeId: number): void {
  const node = nodesById.value.get(nodeId)
  if (!node) return
  if (!isTopicBox(node)) return openLesson(node.id)
  const topic = topicOfNode(node, topics.value)
  if (topic?.node_id) openLesson(topic.node_id)
  else showBrief(node.id)
}

/** A topic named somewhere else (a class, a week, a step): the same as its box. */
function openTopic(topic: Topic): void {
  if (topic.node_id) return openLesson(topic.node_id)
  const box = nodes.value.find((node) => isTopicBox(node) && topicOfNode(node, [topic]))
  if (box) showBrief(box.id)
}

/** Have a topic's lesson written, then open it beside whatever is open. */
async function writeTopic(topic: Topic, instruction?: string): Promise<void> {
  const lessonId = await writeLesson(topic, instruction)
  if (!lessonId) return
  await lessons.refresh()
  openLesson(lessonId)
}

/** "Write this lesson" on a box: the topic behind it, written. */
async function write(nodeId: number, instruction?: string): Promise<void> {
  const node = nodesById.value.get(nodeId)
  if (!node) return
  const topic = topicOfNode(node, topics.value)
  if (!topic) {
    if (!isTopicBox(node)) openLesson(node.id)
    return
  }
  await writeTopic(topic, instruction)
}

const briefId = ref<number | null>(null)
const briefOpen = ref(false)
const briefNode = computed(() => (briefId.value === null ? null : (nodesById.value.get(briefId.value) ?? null)))

function showBrief(nodeId: number): void {
  briefId.value = nodeId
  briefOpen.value = true
}

function openFromBrief(nodeId: number): void {
  briefOpen.value = false
  openBox(nodeId)
}

function writeFromBrief(nodeId: number, instruction?: string): void {
  briefOpen.value = false
  void write(nodeId, instruction)
}

const newLessonOpen = ref(false)

/* -- Continue: the one thing to press ------------------------------------------ */

const nextUp = computed(() =>
  subject.value ? continueTarget(c, subject.value, { lesson: lastLesson.value }, now.value) : null,
)
const line = computed(() => (subject.value ? courseStateLine(c, subject.value) : ''))

// A path's line says whether it's on pace, which is Today's to work out.
watch(
  () => isPath.value && c.status.ready,
  (wanted) => {
    if (wanted && !c.today.value && import.meta.client) void c.loadToday()
  },
  { immediate: true },
)
const progress = computed(() =>
  subject.value ? courseProgress(c, subject.value, now.value) : { done: 0, total: 0, words: '' },
)

function runContinue(): void {
  const target = nextUp.value
  if (!target) return
  const kind = target.open.slice(0, target.open.indexOf(':'))
  const key = target.open.slice(target.open.indexOf(':') + 1)
  if (kind === 'lesson') return openLesson(Number(key))
  if (kind === 'class') {
    const session = c.get('sessions', key)
    if (session) void openClass(session)
    return
  }
  // A topic not written yet: "Start" writes it, one press instead of two.
  const topic = c.get('topics', key)
  if (topic) void writeTopic(topic)
}

/** A class's notes: the page already filed under it, or a new one from the lecture template. */
async function openClass(session: Session): Promise<void> {
  const pages = ownItems.value.filter((i) => i.session_id === session.id && i.kind === 'page')
  const page = pages.find((i) => i.meta.template === 'lecture') ?? pages[0]
  if (page) return openItem(page)
  await newNote({ session_id: session.id, template: 'lecture' })
}

/* -- The companion beside the lesson ------------------------------------------- */

/**
 * The old lesson page had its chat docked on the right. The first lesson
 * opened on a screen wide enough for both brings the companion in beside it,
 * once: whoever has opened or closed it themselves is never second-guessed.
 */
function bringCompanion(): void {
  if (!import.meta.client || quiet.value || window.innerWidth < 1280) return
  try {
    if (localStorage.getItem('bm:ai-open') !== null) return
  } catch {
    return
  }
  ai.show()
}

/** The course, in a few lines the companion can read when asked about it. */
function courseExcerpt(): string {
  const s = subject.value
  if (!s) return ''
  const steps = nodes.value.map((n, i) => {
    const state = n.progress?.state === 'completed' ? ' (done)' : n.progress?.state === 'in_progress' ? ' (learning)' : ''
    return `${i + 1}. ${n.title}${state}`
  })
  const dates = deadlines.value
    .filter((d) => d.status === 'upcoming' && d.due_at)
    .slice(0, 6)
    .map((d) => {
      const r = c.readinessOf(d)
      return `${d.title}, ${shortDate(dayKey(d.due_at!))}${r.total ? `, ${readyWords(r.checked ? r.percent : null)}` : ''}`
    })
  return [
    `${s.title}. ${line.value}. ${progress.value.words}.`,
    steps.length ? `Topics:\n${steps.join('\n')}` : '',
    dates.length ? `Coming up:\n${dates.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 12_000)
}

/* The course is what the companion sees unless a document in front says more:
   a lesson, a note or a board registers itself after this, and wins. */
useAiContext(() =>
  subject.value
    ? { kind: 'course', label: subject.value.title, subjectId: subject.value.id, excerpt: courseExcerpt }
    : null,
)

/* -- What a lesson opens itself: a sandbox, a board, its history ------------ */

provide(OPEN_SANDBOX, (payload: OpenSandboxPayload) => {
  openDoc({
    kind: 'sandbox',
    id: `sandbox:${payload.key}`,
    title: payload.title,
    lang: payload.lang,
    code: payload.code,
    tests: payload.tests,
  })
})

/* The board record a lesson just made, handed to its tab so there is
   something to draw on before the server copy comes back. */
const boardSeeds = ref<Record<string, BoardAnnotation>>({})

function openMarkup(nodeId: number, board: BoardAnnotation): void {
  boardSeeds.value = { ...boardSeeds.value, [board.uuid]: board }
  const title = board.data.title ?? 'Whiteboard'
  openDoc({ kind: 'markup', id: `markup:${board.uuid}`, nodeId, uuid: board.uuid, title })
}

function openNext(nodeId: number, leaving: string): void {
  openLesson(nodeId)
  close(leaving)
}

const historyNodeId = ref<number | null>(null)
const history = useRevisions(historyNodeId)
const {
  revisions: revisionList,
  detail: previewDetail,
  loading: historyLoading,
  failed: historyFailed,
  opening: historyOpening,
  restoring: historyRestoring,
} = history

/** Bumped per lesson after a restore so its open pane refetches. */
const refreshTokens = ref<Record<number, number>>({})

/* History and the companion share the right edge: the companion steps aside
   while a lesson's history is open and comes back when it closes. */
let aiBeforeHistory = false

function openHistory(nodeId: number): void {
  historyNodeId.value = nodeId
  if (ai.open.value) {
    aiBeforeHistory = true
    ai.hide()
  }
  void history.load()
}

function closeHistory(): void {
  history.close()
  historyNodeId.value = null
  if (aiBeforeHistory) {
    aiBeforeHistory = false
    ai.show()
  }
}

async function restoreRevision(revisionId: number): Promise<void> {
  const node = await history.restore(revisionId)
  if (!node) return
  refreshTokens.value = { ...refreshTokens.value, [node.id]: (refreshTokens.value[node.id] ?? 0) + 1 }
  await lessons.refresh()
}

function onLessonChanged(nodeId: number): void {
  void lessons.refresh()
  if (historyNodeId.value === nodeId) void history.load()
}

/* -- Where a new thing lands ---------------------------------------------------- */

interface Filing {
  session_id: string | null
  topic_id: string | null
  /** "Lecture 8 · Transactions", "Lesson · SQL joins", the course's name. */
  label: string
  /** A class on now (or just over, or about to start) gets the lecture template. */
  inClass: boolean
}

/**
 * Where a note made right now belongs, without asking: under the lesson in
 * front; else under this course's class that is on (or just over, or about to
 * start), else its latest class (`fileTarget`); on a path, under the step
 * being worked on; else the course itself.
 */
const filing = computed<Filing>(() => {
  const s = subject.value
  const lessonTopic = activeLessonId.value !== null ? topics.value.find((t) => t.node_id === activeLessonId.value) : null
  if (lessonTopic) {
    return { session_id: null, topic_id: lessonTopic.id, label: `Lesson · ${lessonTopic.title}`, inClass: false }
  }
  if (s && !isPath.value) {
    // Another course's class may be on: then this course's latest one, as
    // `fileTarget` itself would pick when nothing else is happening.
    const target = fileTarget(c, s.id, now.value)
    const ours = target.subject?.id === s.id ? target.session : null
    const session =
      ours ?? [...sessions.value].reverse().find((x) => !x.cancelled && Date.parse(x.starts_at) <= now.value) ?? null
    if (session) {
      const topic = c.get('topics', session.topic_id)
      return {
        session_id: session.id,
        topic_id: topic?.id ?? null,
        label: topic ? `${session.title} · ${topic.title}` : session.title,
        inClass: Boolean(ours) && target.reason !== 'the course you have open',
      }
    }
  }
  if (s && isPath.value) {
    const step = c.pathOf(s.id).find((x) => x.state === 'now')
    if (step) return { session_id: null, topic_id: step.topic.id, label: step.topic.title, inClass: false }
  }
  return { session_id: null, topic_id: null, label: s?.title ?? 'this course', inClass: false }
})

/* -- New notes and whiteboards, filed here and opened here ------------------ */

const making = ref(false)

/** As `/app/p/new` makes one: an id made here, so it works offline, through the store. */
async function newNote(
  where: {
    session_id?: string | null
    topic_id?: string | null
    parent_id?: string | null
    template?: string | null
  } = {},
): Promise<void> {
  if (!subject.value || making.value) return
  making.value = true
  const parent = where.parent_id ? c.get('items', where.parent_id) : null
  // Nothing said: filed where the learner is. Inside a page: where that page is.
  const auto = !where.session_id && !where.topic_id && !parent
  const sessionId = parent ? parent.session_id : auto ? filing.value.session_id : (where.session_id ?? null)
  const topicId = parent ? parent.topic_id : auto ? filing.value.topic_id : (where.topic_id ?? null)
  const wanted = where.template ?? (auto && filing.value.inClass ? 'lecture' : null)
  const template: TemplateKey = isTemplateKey(wanted) ? wanted : 'blank'
  const ctx = contextFrom(c, { subject_id: subject.value.id, session_id: sessionId, topic_id: topicId })
  const item: Item = {
    id: crypto.randomUUID(),
    subject_id: subject.value.id,
    session_id: ctx.session?.id ?? null,
    topic_id: ctx.topic?.id ?? null,
    parent_id: parent?.id ?? null,
    kind: 'page',
    title: parent ? 'Untitled' : pageTitle(template, ctx),
    preview: null,
    meta: { template, props: { fresh: true } },
    source: 'made',
    source_ref: null,
    position: parent ? ownItems.value.filter((i) => i.parent_id === parent.id).length : 0,
    pinned: false,
  }
  try {
    await c.upsert<Item>('items', item)
    openItem(item)
  } catch {
    toast.error({ title: "Couldn't make the note", body: 'Check the connection and try again.' })
  } finally {
    making.value = false
  }
}

/** As `/app/b/new` makes one: built whole from its template, seeded once, then opened. */
async function newBoard(
  where: { session_id?: string | null; template?: string | null; deadline_id?: string | null } = {},
): Promise<void> {
  if (!subject.value || making.value) return
  making.value = true
  try {
    // A mind map is one root, not a built template: Notes' own maker draws it.
    if (where.template === 'mindmap') {
      const made = await makeBoard({
        subjectId: subject.value.id,
        sessionId: where.session_id ?? filing.value.session_id,
        topicId: filing.value.topic_id,
        template: 'mindmap',
      })
      openItem({ id: made, kind: 'board' })
      return
    }
    const template = (BOARD_TEMPLATES as readonly string[]).includes(String(where.template))
      ? (String(where.template) as TemplateName)
      : 'blank'
    let deadline = where.deadline_id ? c.get('deadlines', where.deadline_id) : null
    if (!deadline && template === 'revision') deadline = nextRevisable(c, subject.value.id)
    if (!deadline && template === 'kanban') deadline = nextProject(c, subject.value.id)
    const ctx = boardContext(c, subject.value.id, deadline?.id ?? null)
    const doc = buildBoard(template, ctx)
    const itemId = newUuid()
    await c.upsert<Item>('items', {
      id: itemId,
      kind: 'board',
      subject_id: subject.value.id,
      session_id: where.session_id ?? (where.template ? null : filing.value.session_id),
      topic_id: where.template ? null : filing.value.topic_id,
      parent_id: null,
      title: boardTitle(template, ctx),
      preview: boardPreview(boardParts(doc)) || null,
      meta: { template, props: deadline ? { deadline_id: deadline.id } : {} },
      source: 'made',
      source_ref: null,
      position: ownItems.value.length,
      pinned: false,
    })
    await seedBoard(itemId, doc, c.repo())
    doc.destroy()
    openItem({ id: itemId, kind: 'board' })
  } catch (e) {
    toast.error({ title: "Couldn't make the whiteboard", body: (e as Error).message || 'Try again.' })
  } finally {
    making.value = false
  }
}

/**
 * Links into this course's own pages and boards open here, as a tab, from
 * wherever they are inside it: a class's files, the path's lessons, "Take
 * notes", a class's "New board". A new one made from a template is made here
 * too. Anything else (another course's page, a page with no template picked
 * yet) leaves as it always did.
 */
onBeforeRouteLeave((to) => {
  const s = subject.value
  const match = /^\/app\/(p|b)\/([^/]+)\/?$/.exec(to.path)
  if (!s || !match) return true
  const [, kind, target] = match
  const q = (name: string): string | null => {
    const value = to.query[name]
    return typeof value === 'string' && value ? value : null
  }
  if (target === 'new') {
    if (q('subject_id') !== s.id) return true
    if (kind === 'p') {
      if (!isTemplateKey(q('template'))) return true
      void newNote({ session_id: q('session_id'), topic_id: q('topic_id'), template: q('template') })
    } else {
      void newBoard({ session_id: q('session_id'), template: q('template'), deadline_id: q('deadline_id') })
    }
    return false
  }
  const item = target ? c.get('items', target) : null
  if (!item || item.subject_id !== s.id) return true
  openItem(item)
  return false
})

/* -- Files: the bytes in a new window; uploads filed where you are ---------- */

async function openFile(item: Item): Promise<void> {
  const known = item.kind === 'link' ? (item.meta.url ?? null) : knownFileUrl(item)
  if (known) {
    window.open(known, '_blank', 'noopener')
    return
  }
  if (c.status.mode === 'demo' || !['file', 'photo', 'recording'].includes(item.kind)) {
    toast.info({
      title: item.title,
      body:
        item.source === 'moodle'
          ? 'This file opens straight from Moodle once the course is connected for real.'
          : 'This opens in the viewer, which is on its way.',
    })
    return
  }
  // The window opens inside the click, so no popup blocker objects.
  const tab = window.open('', '_blank')
  const url = await fetchFileUrl(item)
  if (url && tab) tab.location.href = url
  else {
    tab?.close()
    toast.error({ title: item.title, body: "It can't be opened right now. Try again when you're online." })
  }
}

const picker = ref<HTMLInputElement | null>(null)
const photoPicker = ref<HTMLInputElement | null>(null)
const uploading = ref(0)

function pickFiles(): void {
  picker.value?.click()
}

/** The camera on a phone, the photo library on a desk; filed like any upload. */
function pickPhoto(): void {
  photoPicker.value?.click()
}

/** A link from the Materials "+", filed under the class you're in. */
async function addCourseLink(url: string): Promise<void> {
  const s = subject.value
  if (!s) return
  try {
    await addLink(c, url, namedTarget(c, s.id, filing.value.session_id), { onScreen: s.id })
  } catch {
    toast.error({ title: "Couldn't save the link", body: 'Check the connection and try again.' })
  }
}

function onPicked(event: Event): void {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  if (files.length) void upload(files)
}

/** Any number of files, one after another, filed under the class you're in. */
async function upload(files: File[]): Promise<void> {
  const s = subject.value
  if (!s) return
  const where = filing.value
  uploading.value += files.length
  let filed = 0
  for (const file of files) {
    try {
      const item = await c.repo().upload(file, { subject_id: s.id, session_id: where.session_id ?? undefined })
      c.rows.items[item.id] = item
      filed++
    } catch {
      toast.error(`${file.name} didn't upload. Check the connection and try again.`)
    } finally {
      uploading.value = Math.max(0, uploading.value - 1)
    }
  }
  if (!filed) return
  const onMaterials = homeActive.value && view.value === 'materials'
  toast.success({
    title: `Filed under ${where.label}`,
    body: filed === 1 ? files[0]!.name : `${filed} files`,
    ...(onMaterials ? {} : { action: { label: 'Show', handler: () => showHome('materials') } }),
  })
}

/* -- The chrome ----------------------------------------------------------- */

const sidebarOpen = useState<boolean>('companion:course-sidebar', () => true)
const sidebarSize = usePanelWidth('column')

onMounted(() => {
  try {
    if (localStorage.getItem('bm:course-sidebar') === 'closed') sidebarOpen.value = false
  } catch {
    // Storage may be unavailable; the outline stays open.
  }
})
watch(sidebarOpen, (value) => {
  try {
    localStorage.setItem('bm:course-sidebar', value ? 'open' : 'closed')
  } catch {
    // Remembered for this visit only.
  }
})

function record(): void {
  if (subject.value) capture.show('record', subject.value.id, liveSession.value?.id ?? null)
}

const noteSession = computed(() => liveSession.value ?? nextSession.value)
const hasCards = computed(() => c.cards.value.some((k) => k.subject_id === id.value && !k.suspended))

const actions = computed<MenuAction[]>(() => {
  const s = subject.value
  if (!s) return []
  const list: MenuAction[] = []
  if (noteSession.value && !isPath.value) {
    const session = noteSession.value
    list.push({ label: `Notes for ${session.title}`, icon: 'pencil', run: () => void openClass(session) })
  }
  if (!quiet.value) {
    list.push({
      label: isPath.value ? 'Quiz me on this unit' : 'Quiz me on this week',
      icon: 'spark',
      run: () =>
        ai.ask(
          isPath.value
            ? `Quiz me on the lessons I'm on in ${s.title}, one question at a time.`
            : `Quiz me on what ${s.title} covered this week, one question at a time.`,
          { fresh: true },
        ),
    })
  }
  // Shown when Home's Practice tab is: cards, or topics ready to check.
  if (hasCards.value || dueTopics(c, { subjectId: s.id }).length) {
    list.push({ label: 'Practice', icon: 'cards', run: () => showHome('practice') })
  }
  list.push(
    { label: 'Revision whiteboard', icon: 'map', run: () => void newBoard({ template: 'revision' }) },
    { label: 'A page from a template', icon: 'file', run: () => void router.push(`/app/p/new?subject_id=${s.id}`) },
  )
  if (s.source_url) {
    list.push({
      label: s.source === 'moodle' ? 'Open in Moodle' : 'Open the original',
      icon: 'external',
      run: () => void window.open(s.source_url!, '_blank', 'noopener'),
    })
  }
  list.push(
    archived.value
      ? { label: 'Restore to the shelf', icon: 'refresh', run: () => void unarchive() }
      : { label: 'Archive', icon: 'archive', run: () => void archive() },
  )
  return list
})

/* -- Archived: off the shelf, still all here ------------------------------- */

const archived = computed(() => Boolean(subject.value && isArchived(subject.value)))

async function archive(): Promise<void> {
  const s = subject.value
  if (!s) return
  await archiveCourse(c, s)
  toast.success({
    title: `${s.title} is archived`,
    body: 'It leaves Courses and Today. Everything in it stays.',
    action: { label: 'Undo', handler: () => void restoreCourse(c, s) },
  })
}

async function unarchive(): Promise<void> {
  const s = subject.value
  if (s) await restoreCourse(c, s)
}

/* ⌘W (Ctrl+W) closes the document in front; the home stays. */
function onKey(event: KeyboardEvent): void {
  if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== 'w') return
  if (!frontDoc.value || briefOpen.value || newLessonOpen.value) return
  event.preventDefault()
  close(frontDoc.value.id)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

/* -- The phone ------------------------------------------------------------ */

const phoneMenu = ref(false)

const phoneActions = computed<MenuAction[]>(() => [
  ...(canRecord.value
    ? [{ label: liveSession.value ? 'Record the class' : 'Record a class', icon: 'mic', run: record }]
    : []),
  { label: `New page in ${subject.value?.title ?? 'this course'}`, icon: 'plus', run: () => void newNote() },
  { label: `New whiteboard in ${subject.value?.title ?? 'this course'}`, icon: 'plus', run: () => void newBoard() },
  { label: 'Upload files', icon: 'upload', run: pickFiles },
  { label: 'A lesson on a topic', icon: 'wand', run: () => (newLessonOpen.value = true) },
  ...actions.value,
])

function runPhone(action: MenuAction): void {
  phoneMenu.value = false
  action.run()
}

const PHONE_NAV = computed<{ view: CourseView; label: string; icon: string }[]>(() => [
  { view: 'map', label: 'Map', icon: 'map' },
  { view: mainView.value, label: isPath.value ? 'Path' : 'Weeks', icon: isPath.value ? 'path' : 'calendar' },
  { view: 'deadlines', label: 'Due', icon: 'flag' },
  { view: 'notes', label: 'Notes', icon: 'notebook' },
  { view: 'materials', label: 'Files', icon: 'file' },
])

const pane = 'absolute inset-0 flex flex-col'

/* Last, once everything a link can open is declared. */
watch(
  () => [subject.value?.id, queryOf('tab'), queryOf('open')],
  () => applyQuery(),
  { immediate: true },
)
</script>

<template>
  <div
    v-if="notFound"
    class="mx-auto grid max-w-[420px] gap-3 px-6 py-24 text-center"
  >
    <h1 class="t-head text-[22px]">
      This course isn't here
    </h1>
    <p class="text-[15px] text-text-muted">
      It may have been removed, or the link is from another account.
    </p>
    <div>
      <UiBtn
        to="/app/courses"
        variant="secondary"
      >
        All courses
      </UiBtn>
    </div>
  </div>

  <div
    v-else
    class="flex h-full min-h-0 flex-1 bg-surface"
  >
    <!-- The skeleton: the workspace's own shape, so nothing jumps when it lands. -->
    <div
      v-if="!c.status.ready || !subject"
      class="flex min-w-0 flex-1"
      aria-busy="true"
      aria-label="Opening the course"
    >
      <div
        class="shrink-0 border-r border-border bg-surface-chrome p-4 max-lg:hidden"
        :style="{ width: sidebarSize.css.value }"
      >
        <div class="cp-skel h-6 w-40" />
        <div class="cp-skel mt-4 h-8" />
        <div
          v-for="n in 8"
          :key="n"
          class="cp-skel mt-3 h-5"
          :style="{ width: `${60 + ((n * 37) % 35)}%` }"
        />
      </div>
      <div class="grid min-w-0 flex-1 content-start gap-3 p-6 lg:p-8">
        <div class="cp-skel h-7 w-64" />
        <div class="cp-skel h-4 w-80" />
        <div class="cp-skel mt-4 h-[360px] rounded-[24px]" />
      </div>
    </div>

    <template v-else>
      <CompanionCourseSidebar
        v-if="sidebarOpen"
        class="max-lg:hidden"
        :subject="subject"
        :nodes="sidebarNodes"
        :active-node-id="activeBoxId"
        :open-node-ids="openBoxIds"
        :active-item-id="activeItemId"
        :open-item-ids="openItemIds"
        :home-open="homeActive"
        :actions="actions"
        :open-chapters="chapters.open"
        :current-chapter="chapters.current"
        :can-record="canRecord"
        @home="showHome()"
        @open-node="openBox"
        @write="write"
        @progress="setProgress"
        @open-item="openItem"
        @new-note="newNote({ template: $event })"
        @new-board="newBoard({ template: $event })"
        @new-lesson="newLessonOpen = true"
        @upload="pickFiles"
        @photo="pickPhoto"
        @link="addCourseLink"
        @record="record"
      />

      <div class="flex min-w-0 flex-1 flex-col">
        <CompanionCourseHeader
          v-model:sidebar-open="sidebarOpen"
          class="max-lg:hidden"
          :subject="subject"
          :doc-title="frontDoc ? titleOf(frontDoc) : null"
          :due="due"
          :can-record="canRecord"
          :live="Boolean(liveSession)"
          :new-where="filing.label"
          :can-write="true"
          :actions="actions"
          :archived="archived"
          @home="showHome()"
          @restore="unarchive"
          @record="record"
          @note="newNote()"
          @board="newBoard()"
          @upload="pickFiles"
          @lesson="newLessonOpen = true"
        />

        <!-- The phone's header: the way back, the title, Ask and the one menu. -->
        <header class="cp-safe-top shrink-0 border-b border-border bg-surface lg:hidden">
          <div class="flex h-12 items-center gap-1 px-1">
            <button
              v-if="frontDoc"
              type="button"
              class="grid size-11 shrink-0 place-items-center rounded-full text-text-soft active:bg-surface-sunken"
              aria-label="Back to the course"
              @click="showHome()"
            >
              <UiIcon
                name="chevron-left"
                :size="21"
                :stroke="2"
              />
            </button>
            <NuxtLink
              v-else
              to="/app/courses"
              class="grid size-11 shrink-0 place-items-center rounded-full text-text-soft active:bg-surface-sunken"
              aria-label="Back to your courses"
            >
              <UiIcon
                name="chevron-left"
                :size="21"
                :stroke="2"
              />
            </NuxtLink>

            <p class="flex min-w-0 flex-1 items-center gap-2 font-display text-[15px] font-semibold tracking-[-0.02em]">
              <span
                v-if="!frontDoc"
                class="size-2 shrink-0 rounded-full"
                :style="{ background: courseColor(subject.color) }"
              />
              <span class="truncate">{{ frontDoc ? titleOf(frontDoc) : subject.title }}</span>
            </p>

            <CompanionAiToggle compact />

            <button
              type="button"
              class="grid size-11 shrink-0 place-items-center rounded-full text-text-soft active:bg-surface-sunken"
              aria-label="Course actions"
              @click="phoneMenu = true"
            >
              <UiIcon
                name="dots"
                :size="20"
              />
            </button>
          </div>
        </header>

        <WorkspaceWritingStatus
          v-if="lessonCourse"
          :course="lessonCourse"
          :nodes="realNodes"
          :phone="isPhone"
          @open="openLesson"
        />

        <main class="relative flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
          <CompanionCourseTabs
            class="max-lg:hidden"
            :home-title="subject.title"
            :home-color="courseColor(subject.color)"
            :tabs="strip"
            :active-id="activeId"
            @focus="(tabId) => (tabId === HOME ? showHome() : focus(tabId))"
            @close="close"
            @move="move"
          />

          <!--
            The home and every open document are panes stacked in here,
            shown by visibility rather than `v-if`: coming back to a lesson
            restores its scroll and its ungraded answers, a board its view.
          -->
          <div class="relative min-h-0 flex-1">
            <div
              :class="[pane, !homeActive && 'invisible']"
              :inert="!homeActive"
            >
              <CompanionCourseHome
                v-model:view="view"
                :subject="subject"
                :nodes="nodes"
                :active-node-id="activeBoxId"
                :line="line"
                :progress="progress"
                :next="nextUp"
                :where="filing.label"
                :uploading="uploading"
                :open-item-ids="openItemIds"
                @continue="runContinue"
                @open-box="openBox"
                @write="write"
                @brief="showBrief"
                @progress="setProgress"
                @open-topic="openTopic"
                @open-item="openItem"
                @new-note="newNote()"
                @new-board="newBoard()"
                @new-lesson="newLessonOpen = true"
                @upload="upload"
                @pick="pickFiles"
              />
            </div>

            <div
              v-for="tab in lessonTabs"
              :key="tab.id"
              :class="['om-scroll absolute inset-0 overflow-x-hidden overflow-y-auto', tab.id !== activeId && 'invisible']"
              :inert="tab.id !== activeId"
            >
              <CompanionCourseLessonPane
                :node-id="tab.nodeId"
                :title="titleOf(tab)"
                :active="tab.id === activeId"
                :subject-id="subject.id"
                :course-id="lessonCourse?.id ?? subject.generated_course_id"
                :topic-id="topics.find((t) => t.node_id === tab.nodeId)?.id ?? null"
                :language="lessonCourse?.language"
                :level="lessonCourse?.level ?? undefined"
                :editable="c.status.mode !== 'demo' && !isPhone"
                :author="c.status.mode !== 'demo'"
                :allows-code="lessonCourse?.allows_code ?? false"
                :preview="historyNodeId === tab.nodeId ? previewDetail : null"
                :refresh-token="refreshTokens[tab.nodeId] ?? 0"
                @changed="onLessonChanged(tab.nodeId)"
                @history="openHistory"
                @board="openMarkup"
                @open="openLesson"
                @next="openNext($event, tab.id)"
                @close="close(tab.id)"
              />
            </div>

            <!-- Notes and whiteboards fill the box and scroll (or pan) on their own. -->
            <div
              v-for="tab in noteTabs"
              :key="tab.id"
              :class="[pane, tab.id !== activeId && 'invisible']"
              :inert="tab.id !== activeId"
            >
              <CompanionCourseNoteTab
                :item-id="tab.itemId"
                :active="tab.id === activeId"
                class="min-h-0 flex-1"
                @open="openItem({ id: $event.id, kind: $event.kind })"
              />
            </div>

            <div
              v-for="tab in boardTabs"
              :key="tab.id"
              :class="[pane, tab.id !== activeId && 'invisible']"
              :inert="tab.id !== activeId"
            >
              <CompanionCourseBoardTab
                :item-id="tab.itemId"
                :active="tab.id === activeId"
                class="min-h-0 flex-1"
                @open="openItem({ id: $event.id, kind: $event.kind })"
              />
            </div>

            <!-- A lesson's own whiteboard, drawn over from the lesson's pen. -->
            <div
              v-for="tab in markupTabs"
              :key="tab.id"
              :class="[pane, tab.id !== activeId && 'invisible']"
              :inert="tab.id !== activeId"
            >
              <WorkspaceBoardTab
                :node-id="tab.nodeId"
                :uuid="tab.uuid"
                :initial="boardSeeds[tab.uuid] ?? null"
                class="min-h-0 flex-1"
              />
            </div>

            <!-- Coding exercises open the sandbox here, as a tab in the strip. -->
            <div
              v-for="tab in sandboxTabs"
              :key="tab.id"
              :class="[pane, 'p-3', tab.id !== activeId && 'invisible']"
              :inert="tab.id !== activeId"
            >
              <SandboxCodeSandbox
                :initial-lang="tab.lang"
                :initial-code="tab.code"
                :tests="tab.tests"
                class="min-h-0 flex-1"
              />
            </div>
          </div>
        </main>

        <!-- The phone's bottom bar: the home's views; gone under a document,
             which takes the whole screen. -->
        <nav
          v-if="!frontDoc"
          class="flex shrink-0 items-center justify-around border-t border-border bg-surface px-1.5 pt-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom))] lg:hidden"
          aria-label="Course"
        >
          <button
            v-for="item in PHONE_NAV"
            :key="item.view"
            type="button"
            :class="[
              'flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col items-center gap-[3px] py-1 transition-colors',
              view === item.view ? 'text-text' : 'text-text-muted',
            ]"
            :aria-current="view === item.view ? 'page' : undefined"
            @click="showHome(item.view)"
          >
            <span
              :class="[
                'grid h-[26px] w-[44px] place-items-center rounded-full transition-colors',
                view === item.view ? 'bg-accent-soft text-accent-strong' : '',
              ]"
            >
              <CompanionIcon
                :name="item.icon"
                :size="20"
                :stroke="view === item.view ? 2.1 : 1.8"
              />
            </span>
            <span :class="['text-[10.5px]', view === item.view ? 'font-semibold' : 'font-medium']">{{ item.label }}</span>
          </button>
        </nav>
      </div>

      <HistoryPanel
        v-if="historyNodeId"
        class="max-lg:hidden"
        :node-title="lessonTitle(historyNodeId)"
        :revisions="revisionList"
        :loading="historyLoading"
        :failed="historyFailed"
        :previewing="previewDetail"
        :opening="historyOpening"
        :restoring="historyRestoring"
        @close="closeHistory"
        @preview="(revision) => history.open(revision)"
        @back-to-latest="history.close()"
        @restore="restoreRevision"
      />

      <CompanionAiPanel />
    </template>

    <input
      ref="picker"
      type="file"
      multiple
      class="hidden"
      aria-hidden="true"
      tabindex="-1"
      @change="onPicked"
    >
    <input
      ref="photoPicker"
      type="file"
      accept="image/*"
      capture="environment"
      class="hidden"
      aria-hidden="true"
      tabindex="-1"
      @change="onPicked"
    >

    <!-- The brief, for a topic opened from the list or the phone's map. -->
    <UiModal
      v-if="!isPhone"
      v-model:open="briefOpen"
      size="md"
    >
      <WorkspaceNodeBrief
        v-if="briefNode"
        :node="briefNode"
        :nodes="nodes"
        @open="openFromBrief"
        @expand="writeFromBrief"
        @focus="briefId = $event"
        @progress="setProgress"
      />
      <div class="absolute top-2.5 right-2.5">
        <UiBtn
          variant="ghost"
          size="sm"
          square
          icon="x"
          label="Close"
          @click="briefOpen = false"
        />
      </div>
    </UiModal>
    <UiSheet
      v-else
      v-model:open="briefOpen"
    >
      <WorkspaceNodeBrief
        v-if="briefNode"
        :node="briefNode"
        :nodes="nodes"
        phone
        @open="openFromBrief"
        @expand="writeFromBrief"
        @focus="briefId = $event"
        @progress="setProgress"
      />
    </UiSheet>

    <CompanionCourseNewLesson
      v-if="subject"
      v-model:open="newLessonOpen"
      :subject="subject"
      @write="writeTopic"
    />

    <!-- The phone's "…": every action, each a row the thumb can hit. -->
    <UiSheet
      v-model:open="phoneMenu"
      :title="subject?.title"
    >
      <ul class="grid gap-1 pb-2">
        <li
          v-for="action in phoneActions"
          :key="action.label"
        >
          <button
            type="button"
            class="flex min-h-12 w-full items-center gap-3 rounded-[12px] px-3 text-left text-[15px] font-medium text-text transition-colors active:bg-surface-sunken"
            @click="runPhone(action)"
          >
            <CompanionIcon
              :name="action.icon ?? 'arrow-right'"
              :size="18"
              class="shrink-0 text-text-faint"
            />
            <span class="min-w-0 truncate">{{ action.label }}</span>
          </button>
        </li>
      </ul>
    </UiSheet>
  </div>
</template>
