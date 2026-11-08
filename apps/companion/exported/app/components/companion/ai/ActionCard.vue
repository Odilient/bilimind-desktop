<script setup lang="ts">
/**
 * Something an answer offers to make, as a card with one button: "Save as a
 * note", "Add 6 flashcards", "Make a mind map on a whiteboard". The card
 * shows what will be made (the first cards, the map's branches, the plan's
 * tasks) so the press is an informed yes, and nothing exists until it is
 * pressed. After it, the card says where the thing went and links there.
 *
 * A quiz isn't a thing to make, so it is drawn straight in (`Quiz.vue`).
 * Opening a page only navigates, so it is one row that is itself the link.
 * "OK, create it" (`create_draft`) is the learner's words pressing Create on
 * the draft above: that card creates it, and this one shows how it went.
 *
 * `live` is the same card while the answer is still writing it: it fills in as
 * the words come and has nothing to press yet. A note shows its words, in live
 * and after, because what was just watched being written shouldn't vanish.
 *
 * Making a course happens in the chat itself: "Make a course from these"
 * (`draft_course`, offered when material came without a request for a
 * course) and an older answer's "Create this course" (`create_course`) both
 * send the next message with `intent: 'course'`, and the draft arrives on
 * the answer below as its own card, with everything said and given so far
 * read into it.
 */
import { runAction, QuietActionError, type ActionDone } from '~/companion/ai/actions'
import { madeFor, rememberMade } from '~/companion/ai/made'
import { openBoard } from '~/companion/board/active'
import type { AiAction } from '~/companion/ai/types'
import { useAi } from '~/companion/ai/state'
import { draftPress, draftsCreating, useAiThread } from '~/companion/ai/thread'
import { useCompanion } from '~/companion/store'
import { courseColor } from '~/companion/colors'
import { dayKey, relativeDay, whenLabel } from '~/companion/time'

const props = defineProps<{
  action: AiAction
  /** The screen's course and topic, for an action that names neither. */
  subjectId?: string | null
  topicId?: string | null
  /** The answer's id and the card's place in it: how a pressed card is remembered. */
  messageId?: string | null
  index?: number
  /** Still being written. */
  live?: boolean
}>()

const store = useCompanion()
const toast = useToast()
const ai = useAi()
const t = useAiThread()

/** Only an answer that has landed has a key; one still streaming has no cards yet. */
const madeKey = computed(() =>
  props.messageId && !props.messageId.startsWith('local-') ? `${props.messageId}:${props.index ?? 0}` : null,
)
// Pressed before (this visit or an earlier one): it opens in its done state.
const earlier = madeFor(madeKey.value)
const state = ref<'idle' | 'busy' | 'done'>(earlier ? 'done' : 'idle')
const done = ref<ActionDone | null>(earlier)
const expanded = ref(false)
const drawing = ref<{ image: () => { src: string; w: number; h: number } | null; words: string } | null>(null)
const drawKey = computed(() => (props.action.type === 'draw' ? props.action.brief.slice(0, 80) : ''))

/**
 * The course the card says it files into. A note or a map goes where the
 * answer named, else My notes: the course on screen is never assumed (the
 * note offers "Add to …?" itself). Cards and deadlines belong to a course,
 * so the one on screen stands in when the answer named none.
 */
const subject = computed(() => {
  const a = props.action
  const own = 'subject_id' in a ? (a.subject_id ?? null) : null
  const id = a.type === 'create_page' || a.type === 'create_board' ? own : (own ?? props.subjectId)
  return id ? store.get('subjects', id) : null
})

interface Look {
  icon: string
  title: string
  detail: string
  button: string
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

const look = computed<Look | null>(() => {
  const a = props.action
  const where = subject.value?.title ?? 'My notes'
  if (props.live) {
    switch (a.type) {
      case 'create_page':
        return { icon: 'page', title: 'Writing a note', detail: a.title, button: '' }
      case 'create_cards':
        return { icon: 'cards', title: 'Writing flashcards', detail: a.cards.length ? plural(a.cards.length, 'card') : '', button: '' }
      case 'create_board':
        return { icon: 'board', title: 'Drawing a mind map', detail: a.root, button: '' }
      case 'add_tasks':
        return { icon: 'calendar', title: 'Planning tasks', detail: a.tasks.length ? plural(a.tasks.length, 'task') : '', button: '' }
      case 'quiz':
        return { icon: 'check', title: 'Writing a quiz', detail: a.questions.length ? plural(a.questions.length, 'question') : '', button: '' }
    }
  }
  switch (a.type) {
    case 'create_page':
      return { icon: 'page', title: 'Save as a note', detail: `“${a.title}” in ${where}`, button: 'Save note' }
    case 'create_cards': {
      const topic = a.topic_id ? store.get('topics', a.topic_id) : null
      return {
        icon: 'cards',
        title: `Add ${plural(a.cards.length, 'flashcard')}`,
        detail: `${topic ? `${topic.title} · ` : ''}${where} · due in your next practice`,
        button: 'Add cards',
      }
    }
    case 'create_board':
      return {
        icon: 'board',
        title: 'Make a mind map on a whiteboard',
        detail: `${a.root} · ${plural(a.branches.length, 'branch', 'branches')}`,
        button: 'Make whiteboard',
      }
    case 'create_course':
      return {
        icon: 'path',
        title: `Make “${a.title}” a course`,
        detail: a.topics.length ? `A path of ${plural(a.topics.length, 'step')}, drafted here for you to check` : 'Drafted here for you to check',
        button: 'Draft the course',
      }
    case 'draft_course':
      return {
        icon: 'path',
        title: a.label || 'Make a course from these',
        detail: 'A path, its deadlines and a pace, from everything in this chat',
        button: 'Draft the course',
      }
    case 'write_lesson':
      return a.rewrite
        ? {
            icon: 'book',
            title: `Rewrite “${store.get('topics', a.topic_id)?.title ?? a.title}”`,
            detail: a.instruction || 'The same lesson, written again',
            button: 'Rewrite lesson',
          }
        : { icon: 'book', title: `Write “${a.title}” as a lesson`, detail: a.instruction || 'Explanation, worked examples and a short quiz', button: 'Write lesson' }
    case 'add_tasks': {
      const day = relativeDay(a.date || dayKey())
      const when = day === 'today' ? 'today\'s' : day === 'tomorrow' ? 'tomorrow\'s' : `${day}'s`
      const minutes = a.tasks.reduce((n, t) => n + (t.minutes || 0), 0)
      return { icon: 'calendar', title: `Add to ${when} plan`, detail: `${plural(a.tasks.length, 'task')} · about ${minutes} min`, button: 'Add to plan' }
    }
    case 'add_deadline':
      return { icon: 'flag', title: `Add “${a.title}”`, detail: `${where} · ${whenLabel(a.due_at)}`, button: 'Add deadline' }
    default:
      return null
  }
})

/** What will be made, shown before the press. */
const preview = computed<string[]>(() => {
  const a = props.action
  if (a.type === 'create_board') return a.branches.map((b) => b.title)
  if (a.type === 'create_course') return a.topics
  if (a.type === 'add_tasks') return a.tasks.map((t) => `${t.title} · ${t.minutes} min`)
  if (a.type === 'quiz' && props.live) return a.questions.map((q) => q.q)
  return []
})

const cards = computed(() => (props.action.type === 'create_cards' ? props.action.cards : []))
// While it is written, the newest is the one to see.
const shownCards = computed(() => (props.live ? cards.value.slice(-3) : expanded.value ? cards.value : cards.value.slice(0, 3)))

const noteWords = computed(() => (props.action.type === 'create_page' ? props.action.markdown.replace(/ ?\[E?\d{1,3}\]/g, '') : ''))

/** Drafting is the next message in this chat, asked as a course. */
function draft(): void {
  const a = props.action
  const words =
    a.type === 'draft_course'
      ? a.label || 'Make a course from these'
      : a.type === 'create_course'
        ? `Make “${a.title}” a course`
        : ''
  t.send(words, { intent: 'course', attachments: [], force: false })
  const result: ActionDone = { to: null, label: 'Drafted below' }
  done.value = result
  state.value = 'done'
  rememberMade(madeKey.value, result)
}

async function press(): Promise<void> {
  if (state.value !== 'idle') return
  if (props.action.type === 'draft_course' || props.action.type === 'create_course') {
    if (!t.busy.value) draft()
    return
  }
  state.value = 'busy'
  try {
    const picture = props.action.type === 'draw' ? drawing.value?.image() : null
    const result = await runAction(props.action, {
      subjectId: props.subjectId ?? null,
      topicId: props.topicId ?? null,
      image: picture ? { ...picture, words: drawing.value?.words ?? '' } : null,
    })
    if (result.go && result.to) {
      state.value = 'idle'
      // A phone's sheet would cover where it just went.
      if (!ai.wide.value) ai.hide()
      await navigateTo(result.to)
      return
    }
    done.value = result
    state.value = 'done'
    rememberMade(madeKey.value, result)
  } catch (error) {
    state.value = 'idle'
    if (error instanceof QuietActionError) return
    toast.error({ title: `Couldn't ${look.value?.button.toLowerCase() ?? 'do that'}`, body: (error as Error).message || 'Check the connection and try again.' })
  }
}

function openDone(): void {
  if (!ai.wide.value) ai.hide()
}

/** A place to open is a link, not a thing to make: one row, its icon by where it goes. */
const openIcon = computed(() => {
  const to = props.action.type === 'open' ? props.action.to : ''
  if (to.startsWith('/app/notes')) return 'notebook'
  if (to.startsWith('/app/courses')) return 'path'
  if (to.startsWith('/app/calendar')) return 'calendar'
  if (to.startsWith('/app/practice')) return 'cards'
  return 'arrow-up-right'
})

/** "OK, create it": the draft it pressed, as the card above it now has it. */
const pressed = computed(() => {
  const a = props.action
  if (a.type !== 'create_draft') return null
  const msg = t.messages.value.find((m) => m.id === a.message_id)
  return {
    title: msg?.proposal?.proposal?.title || 'your course',
    created: msg?.proposal?.created ?? null,
    busy: draftsCreating.has(a.message_id) || draftPress.value === a.message_id,
    gone: !msg?.proposal,
  }
})

function pressDraft(): void {
  if (props.action.type === 'create_draft') draftPress.value = props.action.message_id
}
</script>

<template>
  <div
    v-if="action.type === 'draw'"
    class="overflow-hidden rounded-[14px] bg-surface shadow-[0_0_0_1px_var(--border-strong),var(--shadow-card)]"
  >
    <CompanionAiGraphic
      v-if="action.graphic"
      ref="drawing"
      :graphic="action.graphic"
      :draw-key="drawKey"
      :title="action.title"
      :caption="action.caption"
      :live="live"
    />
    <div
      v-if="!live"
      class="flex items-center justify-between gap-3 border-t border-border-rule px-3 py-2"
    >
      <p class="min-w-0 truncate text-[13px] font-medium">
        {{ state === 'done' && done ? done.label : action.title }}
      </p>
      <NuxtLink
        v-if="state === 'done' && done?.to"
        :to="done.to"
        class="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-brand"
        @click="openDone"
      >
        Open
      </NuxtLink>
      <UiBtn
        v-else-if="state !== 'done'"
        size="sm"
        variant="secondary"
        :loading="state === 'busy'"
        @click="press"
      >
        {{ openBoard ? 'Put on this whiteboard' : 'Keep as a note' }}
      </UiBtn>
    </div>
  </div>

  <NuxtLink
    v-else-if="action.type === 'open'"
    :to="action.to"
    class="group flex items-center gap-2.5 rounded-[14px] bg-surface px-3 py-2.5 shadow-[0_0_0_1px_var(--border-strong),var(--shadow-card)] transition-colors hover:bg-surface-chrome focus-visible:bg-surface-chrome"
    @click="openDone"
  >
    <span
      class="grid size-8 shrink-0 place-items-center rounded-[9px] bg-surface-sunken text-text-dim transition-colors group-hover:bg-surface"
      aria-hidden="true"
    >
      <CompanionIcon
        :name="openIcon"
        :size="16"
      />
    </span>
    <span class="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-text">{{ action.label }}</span>
    <UiIcon
      name="arrow-right"
      :size="14"
      :stroke="2"
      class="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5"
    />
  </NuxtLink>

  <div
    v-else-if="pressed && !pressed.gone"
    :class="[
      'flex min-h-[52px] items-center gap-2.5 rounded-[14px] bg-surface px-3 py-2 shadow-[0_0_0_1px_var(--border-strong),var(--shadow-card)] transition-colors duration-300',
      pressed.created && 'bg-leaf-soft shadow-[0_0_0_1px_var(--success-line)]',
    ]"
  >
    <span
      class="grid size-8 shrink-0 place-items-center rounded-[9px] bg-surface-sunken text-text-dim"
      aria-hidden="true"
    >
      <CompanionIcon
        name="path"
        :size="16"
      />
    </span>
    <template v-if="pressed.created">
      <span class="animate-fade min-w-0 flex-1 truncate text-[13px] font-semibold text-success-text">{{ pressed.title }} is in your courses</span>
      <NuxtLink
        :to="`/app/courses/${pressed.created.subject_id}`"
        class="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-brand transition-colors hover:bg-brand-soft focus-visible:bg-brand-soft"
        @click="openDone"
      >
        Open
        <UiIcon
          name="arrow-right"
          :size="13"
          :stroke="2"
        />
      </NuxtLink>
    </template>
    <template v-else>
      <span class="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-text">{{ pressed.busy ? `Creating ${pressed.title}…` : `Create “${pressed.title}”` }}</span>
      <UiBtn
        size="sm"
        variant="primary"
        :loading="pressed.busy"
        @click="pressDraft"
      >
        Create course
      </UiBtn>
    </template>
  </div>

  <CompanionAiQuiz
    v-else-if="action.type === 'quiz' && !live"
    :questions="action.questions"
    :subject-id="action.subject_id ?? subjectId"
    :topic-id="topicId"
    :made-key="madeKey"
  />

  <div
    v-else-if="look"
    :class="[
      'rounded-[14px] bg-surface shadow-[0_0_0_1px_var(--border-strong),var(--shadow-card)] transition-shadow duration-200',
      state === 'done' && 'shadow-[0_0_0_1px_var(--success-line),var(--shadow-card)]',
    ]"
  >
    <div class="flex items-start gap-2.5 px-3 pt-3">
      <span
        class="relative grid size-8 shrink-0 place-items-center rounded-[9px] bg-surface-sunken text-text-dim"
        aria-hidden="true"
      >
        <CompanionIcon
          :name="look.icon"
          :size="16"
        />
        <i
          v-if="subject"
          class="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-surface"
          :style="{ background: courseColor(subject.color) }"
        />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-[13.5px] leading-[1.35] font-semibold text-text">{{ look.title }}</span>
        <span
          v-if="look.detail"
          class="mt-0.5 block truncate text-[12px] text-text-muted"
        >{{ look.detail }}</span>
      </span>
    </div>

    <!-- A note's words. Column-reverse keeps the newest line in view while it grows. -->
    <div
      v-if="noteWords"
      :class="[
        'mx-3 mt-2.5 rounded-[10px] bg-surface-sunken px-2.5 py-2',
        live ? 'flex max-h-[220px] flex-col-reverse overflow-hidden' : !expanded && 'max-h-[160px] overflow-hidden',
      ]"
    >
      <BlocksMarkdown
        :source="noteWords"
        size="sm"
      />
    </div>
    <button
      v-if="noteWords && !live"
      type="button"
      class="mx-3 mt-1 cursor-pointer rounded-full px-1 text-[12px] font-semibold text-text-muted hover:text-text"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      {{ expanded ? 'Show less' : 'Show all' }}
    </button>

    <!-- Cards: front and back, the first few. -->
    <ul
      v-if="cards.length"
      class="mx-3 mt-2.5 grid gap-1"
    >
      <li
        v-for="(card, i) in shownCards"
        :key="i"
        class="rounded-[10px] bg-surface-sunken px-2.5 py-1.5 text-[12.5px] leading-[1.45]"
      >
        <span class="block font-semibold text-text">{{ card.front }}</span>
        <span class="block text-text-soft">{{ card.back }}</span>
      </li>
      <li v-if="cards.length > 3 && !live">
        <button
          type="button"
          class="cursor-pointer rounded-full px-1 text-[12px] font-semibold text-text-muted hover:text-text"
          :aria-expanded="expanded"
          @click="expanded = !expanded"
        >
          {{ expanded ? 'Show fewer' : `Show all ${cards.length}` }}
        </button>
      </li>
    </ul>

    <!-- A map's branches, a course's steps, a plan's tasks. -->
    <ul
      v-else-if="preview.length"
      class="mx-3 mt-2.5 flex flex-wrap gap-1"
    >
      <li
        v-for="(line, i) in (live ? preview.slice(-6) : expanded ? preview : preview.slice(0, 6))"
        :key="i"
        class="max-w-full truncate rounded-full bg-surface-sunken px-2.5 py-1 text-[12px] text-text-body"
      >
        {{ line }}
      </li>
      <li v-if="preview.length > 6 && !expanded && !live">
        <button
          type="button"
          class="cursor-pointer rounded-full px-2 py-1 text-[12px] font-semibold text-text-muted hover:text-text"
          @click="expanded = true"
        >
          +{{ preview.length - 6 }} more
        </button>
      </li>
    </ul>

    <p
      v-if="live"
      class="flex items-center gap-2 px-3 pt-2 pb-3 text-[12.5px] text-text-muted"
    >
      <span class="animate-pulse-dot">Writing</span>
      <UiIcon
        name="loader"
        :size="13"
        class="animate-spin-slow text-text-faint"
      />
    </p>

    <div
      v-else
      class="flex min-h-[44px] items-center gap-2 px-3 pt-2.5 pb-3"
    >
      <template v-if="state === 'done' && done">
        <span class="animate-fade inline-flex min-w-0 flex-1 items-center gap-1.5 text-[13px] font-semibold text-success-text">
          <UiIcon
            name="check-circle"
            :size="16"
            class="shrink-0"
          />
          <span class="truncate">{{ done.label }}</span>
        </span>
        <NuxtLink
          v-if="done.to"
          :to="done.to"
          class="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-brand transition-colors hover:bg-brand-soft focus-visible:bg-brand-soft"
          @click="openDone"
        >
          Open
          <UiIcon
            name="arrow-right"
            :size="13"
            :stroke="2"
          />
        </NuxtLink>
      </template>
      <UiBtn
        v-else
        size="sm"
        variant="primary"
        :loading="state === 'busy'"
        :disabled="(action.type === 'draft_course' || action.type === 'create_course') && t.busy.value"
        @click="press"
      >
        {{ look.button }}
      </UiBtn>
    </div>
  </div>
</template>
