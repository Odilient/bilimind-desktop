<script setup lang="ts">
/**
 * A course drafted in the chat, drawn under the answer that drafted it.
 *
 * Making a course is a conversation now, not a screen: the learner says
 * what they want ("Italian to B1 by June", or "make a course from these"
 * with three PDFs and a link), and the answer carries the draft. This card
 * is that draft, through its whole life:
 *
 *  - drafting: the work list as it happens ("Reading lecture-4.pdf ✓",
 *    "Finding the deadlines…"), the create screen's own checklist made
 *    compact (create/Building), with Stop;
 *  - ready: the course as a thing they'd own. A cover washed in its colour
 *    with its name, the one sentence of what they'll be able to do, the
 *    finish line and the time a week; the path as one line of units that
 *    open (ProposalPath); the deadlines found, each quoting the words it
 *    was found in; what was read and what couldn't be; and one line on what
 *    goes into the course, because the files and notes the learner attached
 *    become the course's only with this press ("Keep in My notes" says no).
 *    Then the decision: Create course (⌘Enter while the card has focus),
 *    Edit (create/Review in a modal or sheet; ProposalEdit), or keep
 *    talking ("make it 6 weeks" drafts again);
 *  - failed: the reason in plain words and Try again, which asks again for
 *    a course whatever the words were;
 *  - replaced: a newer draft below it says the same thing better, so this
 *    one folds to a line (it can still be opened, to compare);
 *  - created: a compact link to the course. The toast offers to open it,
 *    but the learner stays in the chat: they may have more to ask.
 *
 * Message.vue mounts it with one line. It reads the thread itself (what was
 * attached up to here, whether a newer draft replaced it), so the dock, the
 * drawer and the full-page chat all draw it the same way.
 */
import type { StepRow } from '~/components/companion/create/Building.vue'
import type { CourseProposal } from '~/companion/create'
import { deadlineKind, FILE_LOOK, fileKind } from '~/companion/create'
import type { AiAttachment, AiMessage } from '~/companion/ai/types'
import {
  applyEdit,
  createFromProposal,
  materialOf,
  movesLine,
  normaliseProposal,
  paceWords,
  replacedBy,
  restoreEdit,
  sessionsLine,
  threadAttachments,
  topicCount,
} from '~/companion/ai/proposal'
import { useAiThread } from '~/companion/ai/thread'
import { useAi } from '~/companion/ai/state'
import { useCompanion } from '~/companion/store'
import { courseColor } from '~/companion/colors'
import { dayKey, dayMonthLong, daysBetween, shortDate } from '~/companion/time'
import { KIND_WORD } from '~/companion/words'
import { ApiError } from '~/composables/useApi'

const props = withDefaults(
  defineProps<{
    message: AiMessage
    variant?: 'panel' | 'page'
    /** The thread already knows a later answer drafted it again (it is also worked out here). */
    replaced?: boolean
  }>(),
  { variant: 'panel' },
)

const c = useCompanion()
const t = useAiThread()
const ai = useAi()
const toast = useToast()

const draft = computed(() => props.message.proposal ?? null)
const partial = computed(() => (draft.value?.state === 'drafting' ? draft.value.partial ?? null : null))

const proposal = computed<CourseProposal | null>(() => {
  const p = draft.value?.proposal
  return p ? normaliseProposal(p, c.subjects.value.map((s) => s.color)) : null
})

/* -- Where it sits in the thread --------------------------------------------- */

const newer = computed(() => props.replaced || Boolean(replacedBy(t.messages.value, props.message.id)))
const showOld = ref(false)

/** Everything attached in the chat up to this answer: what the draft read, and what the course is made with. */
const attachments = computed<AiAttachment[]>(() => threadAttachments(t.messages.value, props.message.id))

/**
 * What Create carries in: the same, less a file or note the draft says it
 * couldn't read. That one waits in Notes, as the create screen always said,
 * so a scanned PDF that came back empty isn't silently part of the course.
 */
const movable = computed<AiAttachment[]>(() => {
  const unread = new Set((draft.value?.proposal?.sources ?? []).flatMap((s) => (s.read === false && s.item_id ? [s.item_id] : [])))
  return attachments.value.filter((a) => !((a.kind === 'file' || a.kind === 'note') && a.item_id && unread.has(a.item_id)))
})
const material = computed(() => materialOf(movable.value))
const keepFiles = ref(false)
const moves = computed(() => movesLine(material.value, keepFiles.value))

/** The question this answers. */
const ask = computed<AiMessage | null>(() => {
  const list = t.messages.value
  const at = list.findIndex((m) => m.id === props.message.id)
  for (let i = at - 1; i >= 0; i--) if (list[i]!.role === 'user') return list[i]!
  return null
})

type Phase = 'none' | 'drafting' | 'ready' | 'failed' | 'replaced' | 'created'

const phase = computed<Phase>(() => {
  const d = draft.value
  if (!d) return 'none'
  if (d.created) return 'created'
  if (d.state === 'drafting') {
    if (props.message.pending) return 'drafting'
    // Stopped, or the answer broke: the message's own error says so, with its Try again.
    return props.message.error ? 'none' : 'failed'
  }
  if (d.state === 'failed') return 'failed'
  if (newer.value && !showOld.value) return 'replaced'
  return proposal.value ? 'ready' : 'failed'
})

const failure = computed(() => {
  if (draft.value?.state === 'drafting') return 'The draft stopped before it was finished.'
  return draft.value?.error || 'The course couldn\'t be drafted this time.'
})

/* -- Drafting ------------------------------------------------------------------ */

function words(n: number, one: string, many: string): string {
  return n ? (n === 1 ? one : `${n} ${many}`) : ''
}

function listWords(parts: string[]): string {
  const xs = parts.filter(Boolean)
  if (xs.length < 2) return xs[0] ?? ''
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}

/** "From what you wrote, 3 files and a link": what the draft is working from. */
const lead = computed(() => {
  const n = (kinds: AiAttachment['kind'][]) => attachments.value.filter((a) => kinds.includes(a.kind)).length
  const from = listWords([
    ask.value?.text.trim() ? 'what you wrote' : '',
    words(n(['file']), 'a file', 'files'),
    words(n(['note']), 'a note', 'notes'),
    words(n(['link', 'calendar']), 'a link', 'links'),
    words(n(['text']), 'pasted text', 'pasted texts'),
    words(n(['moodle']), 'a Moodle course', 'Moodle courses'),
  ])
  return from ? `From ${from}` : 'From your chat'
})

const stepRows = computed<StepRow[]>(() => {
  const steps = props.message.steps ?? []
  if (!steps.length) {
    const said = props.message.status?.replace(/…$/, '').trim()
    return [{ key: 'start', label: said || 'Reading what you wrote', state: 'run' }]
  }
  return steps.map((s) => ({
    key: s.key,
    label: s.label,
    state: s.state === 'active' ? 'run' : s.state === 'done' ? 'done' : 'skip',
  }))
})

/* -- The draft, read ------------------------------------------------------------ */

const ink = computed(() => courseColor(proposal.value?.color ?? null))
const cover = computed(() => `color-mix(in srgb, ${ink.value} 9%, var(--surface))`)

const finish = computed<{ text: string; detail: string; title: string }>(() => {
  const f = proposal.value!.finish
  if (f.kind === 'none') return { text: 'At your pace', detail: '', title: 'No finish line: the path goes at your pace' }
  const label = f.label || (f.kind === 'exam' ? 'Final exam' : f.kind === 'project' ? 'Final project' : 'Finish line')
  if (!f.date) return { text: label, detail: 'no date yet', title: `${label}, no date yet` }
  const days = daysBetween(dayKey(), f.date)
  const away = days < 0 ? 'passed' : days < 14 ? `in ${days} day${days === 1 ? '' : 's'}` : `in ${Math.round(days / 7)} weeks`
  // A label that already says the day ("By 15 December") isn't followed by it again.
  const says = label.includes(dayMonthLong(f.date)) || label.includes(shortDate(f.date))
  return { text: says ? label : `${label} · ${shortDate(f.date)}`, detail: away, title: `${label}, ${dayMonthLong(f.date)}, ${away}` }
})

const pace = computed<{ text: string; title: string }>(() => {
  const p = proposal.value!
  if (p.kind === 'school') return { text: 'By week, with your classes', title: 'A school course: its weeks follow your timetable' }
  return { text: paceWords(p.minutes_per_week ?? 120), title: `${sessionsLine(p)}, on the evenings you're free` }
})

const allDeadlines = ref(false)
const deadlines = computed(() => {
  const list = proposal.value?.deadlines ?? []
  return allDeadlines.value ? list : list.slice(0, 3)
})

function deadlineWhen(due: string | null): { date: string; away: string } {
  if (!due) return { date: 'No date yet', away: '' }
  const key = due.slice(0, 10)
  const days = daysBetween(dayKey(), key)
  const away = days < 0 ? 'passed' : days === 0 ? 'today' : days === 1 ? 'tomorrow' : days < 14 ? `in ${days} days` : `in ${Math.round(days / 7)} weeks`
  return { date: shortDate(key), away }
}

/** The file a deadline was found in, by name, when the chat attached it. */
function foundIn(itemId?: string | null): string {
  if (!itemId) return ''
  return attachments.value.find((a) => a.item_id === itemId)?.label ?? ''
}

interface SourceChip {
  key: string
  icon: string
  label: string
  ok: boolean
}

/**
 * What was read, as small chips, and what couldn't be, in warning colours.
 * Files and links as the draft reports them: the server marks each `read`;
 * the sample lists only what it read, so there a file the chat attached and
 * the draft doesn't name wasn't. Pasted text, Moodle courses and notes are
 * words, always read, so they come from the chat's own chips; the draft's
 * text source is mostly the learner's sentence, which the chat already shows.
 */
const sources = computed<SourceChip[]>(() => {
  const p = proposal.value
  if (!p) return []
  const listed = p.sources
  const reports = listed.some((s) => typeof s.read === 'boolean')
  const chips: SourceChip[] = []
  listed.forEach((s, i) => {
    if (s.kind === 'text') return
    if (s.kind === 'link') {
      let host = s.label
      try {
        host = new URL(s.label).hostname.replace(/^www\./, '')
      } catch {
        // A label that isn't a URL is already words.
      }
      chips.push({ key: `l${i}`, icon: 'link', label: s.title || host, ok: s.read !== false })
    } else {
      chips.push({ key: `f${i}`, icon: FILE_LOOK[fileKind(s.label)].icon, label: s.title || s.label, ok: s.read !== false })
    }
  })
  for (const a of attachments.value) {
    const key = `a${a.kind}${a.item_id ?? a.subject_id ?? a.label}`
    if (a.kind === 'text') chips.push({ key, icon: 'paste', label: a.label, ok: true })
    else if (a.kind === 'moodle') chips.push({ key, icon: 'cap', label: a.label, ok: true })
    else if (a.kind === 'note' && !listed.some((s) => s.item_id && s.item_id === a.item_id)) chips.push({ key, icon: 'page', label: a.label, ok: true })
    else if (a.kind === 'file' && !reports && !listed.some((s) => (s.item_id && s.item_id === a.item_id) || s.label === a.label)) {
      chips.push({ key, icon: FILE_LOOK[fileKind(a.label, a.mime ?? '')].icon, label: a.label, ok: false })
    }
  }
  return chips
})

const unread = computed(() => sources.value.filter((s) => !s.ok).length)

/* -- Edit -------------------------------------------------------------------- */

const editing = ref(false)

function saveEdit(next: CourseProposal): void {
  applyEdit(props.message, next)
}

onMounted(() => restoreEdit(props.message))
watch(() => props.message.id, () => restoreEdit(props.message))

/* -- Create ------------------------------------------------------------------- */

const creating = ref(false)
const mod = ref('Ctrl')
onMounted(() => {
  if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) mod.value = '⌘'
})

const createdSubject = computed(() => {
  const id = draft.value?.created?.subject_id
  return id ? c.get('subjects', id) : null
})
const createdTitle = computed(() => createdSubject.value?.title || draft.value?.proposal?.title || 'your course')
const createdColor = computed(() => courseColor(createdSubject.value?.color ?? draft.value?.proposal?.color ?? null))

function openCourse(subjectId: string): void {
  // A phone's sheet would cover where it just went.
  if (!ai.wide.value) ai.hide()
  void navigateTo(`/app/courses/${subjectId}`)
}

/**
 * The answer is still typing its sentence out when the draft is already
 * ready; it only has its lasting id once it lands, and that id is what the
 * server marks created. So a press that early waits for it, spinning.
 */
function landed(): Promise<void> {
  if (!props.message.pending) return Promise.resolve()
  return new Promise((resolve) => {
    const stop = watch(
      () => props.message.pending,
      (still) => {
        if (still) return
        stop()
        resolve()
      },
    )
  })
}

async function create(from?: CourseProposal): Promise<void> {
  const p = from ?? proposal.value
  if (!p || creating.value || draft.value?.created) return
  if (!p.title.trim()) {
    editing.value = true
    return
  }
  creating.value = true
  try {
    await landed()
    if (draft.value?.created) return
    const title = p.title.trim()
    const topics = topicCount(p)
    const { subjectId } = await createFromProposal(c, p, {
      messageId: props.message.id,
      attachments: movable.value,
      message: props.message,
      keepFiles: keepFiles.value,
    })
    toast.success({
      title: `${title} is ready`,
      body: topics ? 'It\'s in your courses, its path and deadlines in place.' : 'It\'s in your courses. Add its first topics when you\'re ready.',
      duration: 8000,
      action: { label: 'Open', handler: () => openCourse(subjectId) },
    })
  } catch (error) {
    toast.error({
      title: 'The course wasn\'t made',
      body: error instanceof ApiError && error.status === 422 ? error.allMessages[0] : 'Nothing was lost. Try again in a moment.',
    })
  } finally {
    creating.value = false
  }
}

function onKey(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey) || event.isComposing) return
  if (phase.value !== 'ready' || newer.value) return
  event.preventDefault()
  event.stopPropagation()
  void create()
}

/* -- Talking instead -------------------------------------------------------------- */

function talk(): void {
  t.focus()
}

/** Ask again for a course, whatever the words were: in place of this answer when it is the last one. */
function tryAgain(): void {
  const q = ask.value
  if (!q) return
  const list = t.messages.value
  const at = list.findIndex((m) => m.id === props.message.id)
  const last = at === list.length - 1
  if (last && !t.busy.value) t.messages.value = list.slice(0, list.indexOf(q))
  t.send(q.text, { intent: 'course', attachments: q.attachments ?? [], quote: q.quote ?? null, force: last })
}

function stop(): void {
  t.stop()
}

const BTN_TALL = 'max-lg:h-11'
</script>

<template>
  <div v-if="phase !== 'none'">
    <!-- Drafting: the work list as it happens. -->
    <CompanionCreateBuilding
      v-if="phase === 'drafting'"
      class="max-w-[640px]"
      compact
      title="Drafting your course"
      :steps="stepRows"
      :lead="lead"
      @cancel="stop"
    >
      <CompanionThinking
        v-if="partial?.thinking"
        :text="partial.thinking"
        :length="partial.thinking_length ?? 0"
      />
      <div
        v-if="partial?.title"
        class="grid gap-3 border-t border-border-rule pt-3"
      >
        <div>
          <h3 class="text-[15px] font-semibold text-text">
            {{ partial.title }}
          </h3>
          <p
            v-if="partial.summary"
            class="mt-0.5 text-[13px] leading-[1.45] text-text-soft"
          >
            {{ partial.summary }}
          </p>
        </div>
        <CompanionAiProposalPath
          v-if="partial.units?.length"
          live
          :units="partial.units"
          :color="null"
        />
        <ul
          v-if="partial.deadlines?.length"
          class="grid gap-1 text-[13px] text-text-body"
        >
          <li
            v-for="(d, i) in partial.deadlines"
            :key="i"
            class="flex items-baseline justify-between gap-3"
          >
            <span class="min-w-0 truncate">{{ d.title }}</span>
            <span
              v-if="d.due_at"
              class="num shrink-0 text-[12px] text-text-muted"
            >{{ shortDate(d.due_at.slice(0, 10)) }}</span>
          </li>
        </ul>
      </div>
    </CompanionCreateBuilding>

    <!-- Failed: why, and the one way on. -->
    <div
      v-else-if="phase === 'failed'"
      class="animate-rise flex gap-2.5 rounded-[16px] bg-warn-soft p-3.5 shadow-[inset_0_0_0_1px_var(--warn-line)]"
      role="alert"
    >
      <UiIcon
        name="alert"
        :size="17"
        class="mt-px shrink-0 text-warn"
      />
      <div class="grid min-w-0 flex-1 gap-1">
        <p class="text-[13.5px] font-semibold text-text">
          No course this time
        </p>
        <p class="text-[13px] leading-[1.5] text-text-body">
          {{ failure }} Everything you attached is still in the chat.
        </p>
        <div class="mt-1.5 flex flex-wrap items-center gap-2">
          <UiBtn
            size="sm"
            variant="primary"
            icon="refresh"
            :class="BTN_TALL"
            :disabled="!ask"
            @click="tryAgain"
          >
            Try again
          </UiBtn>
          <button
            type="button"
            class="inline-flex h-8 cursor-pointer items-center rounded-full px-2 text-[12.5px] font-medium text-text-muted transition-colors duration-150 outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-brand-line max-lg:h-11"
            @click="talk"
          >
            or say it another way
          </button>
        </div>
      </div>
    </div>

    <!-- Replaced: a newer draft below says it better. -->
    <button
      v-else-if="phase === 'replaced'"
      type="button"
      class="flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-[12px] px-3 text-left text-[12.5px] text-text-muted shadow-[inset_0_0_0_1px_var(--border)] transition-colors duration-150 outline-none hover:bg-surface-sunken hover:text-text-soft focus-visible:ring-2 focus-visible:ring-brand-line max-lg:min-h-11"
      :title="`Show the earlier draft of ${proposal?.title ?? 'this course'}`"
      @click="showOld = true"
    >
      <span
        class="size-2 shrink-0 rounded-full opacity-60"
        :style="{ background: ink }"
        aria-hidden="true"
      />
      <span class="min-w-0 truncate font-medium text-text-soft line-through decoration-text-ghost">{{ proposal?.title || 'Course draft' }}</span>
      <span class="shrink-0">Replaced by the draft below</span>
      <UiIcon
        name="chevron-down"
        :size="13"
        class="ml-auto shrink-0 text-text-faint"
      />
    </button>

    <!-- Created: a link to the course. -->
    <NuxtLink
      v-else-if="phase === 'created' && draft?.created"
      :to="`/app/courses/${draft.created.subject_id}`"
      class="group/made animate-fade flex min-h-12 items-center gap-3 rounded-[14px] bg-surface px-3 py-2 shadow-[inset_0_0_0_1px_var(--success-line)] transition-colors duration-150 outline-none hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-brand-line"
      @click.prevent="openCourse(draft.created.subject_id)"
    >
      <span
        class="grid size-8 shrink-0 place-items-center rounded-[10px]"
        :style="{ background: `color-mix(in srgb, ${createdColor} 14%, var(--surface))` }"
        aria-hidden="true"
      >
        <UiIcon
          name="check"
          :size="15"
          :stroke="2.4"
          class="text-success"
        />
      </span>
      <span class="grid min-w-0 flex-1">
        <span class="text-[12px] font-semibold text-success-text">Course created</span>
        <span class="truncate text-[13.5px] font-semibold text-text">{{ createdTitle }}</span>
      </span>
      <span class="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-cobalt">
        Open
        <UiIcon
          name="arrow-right"
          :size="13"
          :stroke="2"
          class="transition-transform duration-150 group-hover/made:translate-x-0.5"
        />
      </span>
    </NuxtLink>

    <!-- Ready: the course, before it exists. -->
    <section
      v-else-if="phase === 'ready' && proposal"
      class="@container animate-rise max-w-[640px] overflow-hidden rounded-[18px] bg-surface shadow-[inset_0_0_0_1px_var(--border)] outline-none"
      :aria-label="`Course draft: ${proposal.title}`"
      tabindex="-1"
      @keydown="onKey"
    >
      <!-- The cover, washed in the course's colour. -->
      <header
        class="grid gap-1 px-4 pt-3.5 pb-4"
        :style="{ background: cover }"
      >
        <div class="flex items-center gap-2 text-[12px] font-medium text-text-muted">
          <span
            class="size-2 shrink-0 rounded-full"
            :style="{ background: ink }"
            aria-hidden="true"
          />
          <span class="truncate">{{ newer ? 'Earlier draft' : 'Course draft' }} · {{ proposal.kind === 'school' ? 'School course' : 'On your own' }}</span>
          <button
            v-if="newer"
            type="button"
            class="ml-auto inline-flex h-7 shrink-0 cursor-pointer items-center rounded-full px-2 font-semibold text-text-muted transition-colors duration-150 outline-none hover:bg-surface hover:text-text focus-visible:ring-2 focus-visible:ring-brand-line"
            @click="showOld = false"
          >
            Fold
          </button>
        </div>
        <h3 class="t-head text-[18px] leading-tight text-text @[520px]:text-[21px]">
          {{ proposal.title || 'Untitled course' }}
        </h3>
        <p
          v-if="proposal.summary"
          class="text-[13.5px] leading-[1.5] text-text-soft"
        >
          {{ proposal.summary }}
        </p>
        <ul class="mt-2 flex flex-wrap gap-1.5">
          <li
            class="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full bg-surface px-2.5 text-[12px] text-text-body shadow-[inset_0_0_0_1px_var(--border)]"
            :title="finish.title"
          >
            <CompanionIcon
              name="flag"
              :size="13"
              class="shrink-0 text-text-faint"
            />
            <span class="truncate">{{ finish.text }}</span>
            <span
              v-if="finish.detail"
              class="shrink-0 text-text-muted"
            >· {{ finish.detail }}</span>
          </li>
          <li
            class="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full bg-surface px-2.5 text-[12px] text-text-body shadow-[inset_0_0_0_1px_var(--border)]"
            :title="pace.title"
          >
            <UiIcon
              :name="proposal.kind === 'school' ? 'calendar' : 'clock'"
              :size="13"
              class="shrink-0 text-text-faint"
            />
            <span class="truncate">{{ pace.text }}</span>
          </li>
        </ul>
      </header>

      <div class="grid gap-4 px-4 pt-3.5">
        <!-- The path. -->
        <CompanionAiProposalPath
          :units="proposal.units"
          :color="proposal.color"
        />

        <!-- The deadlines found, each with the words it was found in. -->
        <div
          v-if="proposal.deadlines.length"
          class="grid gap-1"
        >
          <h4 class="flex min-h-7 items-center text-[12.5px] font-semibold text-text-soft">
            Deadlines found
            <span class="ml-1 font-normal text-text-faint">· {{ proposal.deadlines.length }}</span>
          </h4>
          <ul class="grid gap-0.5">
            <li
              v-for="(d, i) in deadlines"
              :key="i"
              class="flex items-start gap-2.5 py-1"
            >
              <span
                class="mt-[3px] grid size-[18px] shrink-0 place-items-center rounded-[6px] bg-surface-sunken text-text-soft"
                aria-hidden="true"
              >
                <CompanionIcon
                  name="flag"
                  :size="11"
                />
              </span>
              <span class="grid min-w-0 flex-1 gap-0.5">
                <span class="flex min-w-0 items-baseline gap-2">
                  <span class="min-w-0 truncate text-[13px] font-medium text-text">{{ d.title }}</span>
                  <span class="ml-auto shrink-0 text-[12.5px] text-text-soft tabular-nums">{{ deadlineWhen(d.due_at).date }}</span>
                </span>
                <span class="flex min-w-0 items-baseline gap-2 text-[12px] text-text-muted">
                  <span class="min-w-0 truncate">
                    {{ KIND_WORD[deadlineKind(d.kind)] }}<template v-if="d.weight_pct"> · {{ d.weight_pct }}%</template><template v-if="d.evidence"> · <span class="italic">“{{ d.evidence }}”</span></template><template v-if="foundIn(d.item_id)"> · {{ foundIn(d.item_id) }}</template>
                  </span>
                  <span class="ml-auto shrink-0">{{ deadlineWhen(d.due_at).away }}</span>
                </span>
              </span>
            </li>
          </ul>
          <button
            v-if="proposal.deadlines.length > 3"
            type="button"
            class="-ml-2 inline-flex h-8 w-fit cursor-pointer items-center rounded-full px-2 text-[12px] font-semibold text-text-muted transition-colors duration-150 outline-none hover:bg-surface-sunken hover:text-text focus-visible:ring-2 focus-visible:ring-brand-line max-lg:h-11"
            :aria-expanded="allDeadlines"
            @click="allDeadlines = !allDeadlines"
          >
            {{ allDeadlines ? 'Show fewer' : `Show all ${proposal.deadlines.length}` }}
          </button>
        </div>

        <!-- What it read, and what it couldn't. -->
        <div
          v-if="sources.length"
          class="grid gap-1.5"
        >
          <h4 class="text-[12.5px] font-semibold text-text-soft">
            Read
            <span
              v-if="unread"
              class="font-normal text-warn-text"
            >· {{ unread }} couldn't be opened, so the draft leaves {{ unread === 1 ? 'it' : 'them' }} out</span>
          </h4>
          <ul class="flex flex-wrap gap-1">
            <li
              v-for="s in sources"
              :key="s.key"
              :class="[
                'inline-flex h-7 max-w-[240px] items-center gap-1.5 rounded-full pr-2.5 pl-2 text-[12px]',
                s.ok ? 'bg-surface-sunken text-text-body' : 'bg-warn-soft text-warn-text',
              ]"
              :title="s.ok ? `Read: ${s.label}` : `Couldn't open ${s.label}`"
            >
              <CompanionIcon
                :name="s.icon"
                :size="12"
                :class="['shrink-0', s.ok ? 'text-text-faint' : 'text-warn']"
              />
              <span class="truncate">{{ s.label }}</span>
              <UiIcon
                :name="s.ok ? 'check' : 'alert'"
                :size="11"
                :stroke="2.2"
                :class="['shrink-0', s.ok ? 'text-success' : 'text-warn']"
              />
            </li>
          </ul>
        </div>
      </div>

      <!-- What goes into the course with this press. -->
      <p
        v-if="moves && !newer"
        class="mx-4 mt-4 flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-[12px] bg-surface-sunken px-3 py-2 text-[12.5px] leading-[1.45] text-text-soft"
      >
        <UiIcon
          name="layers"
          :size="13"
          class="shrink-0 text-text-faint"
        />
        <span class="min-w-0 flex-1">{{ moves }}</span>
        <button
          v-if="material.files.length || material.notes.length"
          type="button"
          class="-my-1 inline-flex h-7 shrink-0 cursor-pointer items-center rounded-full px-2 font-semibold text-text-muted transition-colors duration-150 outline-none hover:bg-surface hover:text-text focus-visible:ring-2 focus-visible:ring-brand-line max-lg:h-11"
          :aria-pressed="keepFiles"
          @click="keepFiles = !keepFiles"
        >
          {{ keepFiles ? 'Move them in' : 'Keep in My notes' }}
        </button>
      </p>

      <!-- The decision. -->
      <footer
        v-if="!newer"
        class="flex flex-wrap items-center gap-2 px-4 pt-4 pb-4"
      >
        <UiBtn
          variant="primary"
          :loading="creating"
          :title="`Create course (${mod}Enter)`"
          :class="BTN_TALL"
          @click="create()"
        >
          Create course
          <span
            class="ml-1 text-[12px] font-medium opacity-55 max-lg:hidden"
            aria-hidden="true"
          >{{ mod }}↵</span>
        </UiBtn>
        <UiBtn
          variant="secondary"
          icon="pencil"
          :disabled="creating"
          :class="BTN_TALL"
          @click="editing = true"
        >
          Edit
        </UiBtn>
        <button
          type="button"
          class="inline-flex h-9 cursor-pointer items-center rounded-full px-1.5 text-[12.5px] text-text-muted transition-colors duration-150 outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-brand-line max-lg:h-11"
          title="Say what to change in the chat: “make it 6 weeks”, “drop joins”"
          @click="talk"
        >
          or tell me what to change
        </button>
      </footer>
      <div
        v-else
        class="h-4"
      />

      <CompanionAiProposalEdit
        v-model:open="editing"
        :proposal="proposal"
        :creating="creating"
        @save="saveEdit"
        @create="create"
      />
    </section>
  </div>
</template>
