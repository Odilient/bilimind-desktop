<script setup lang="ts">
/**
 * The proposed course, every part of it editable, before anything exists.
 *
 * Two parts, side by side on a computer and stacked on a phone:
 *
 *  - The course card (sticky on the left): its name, written large and
 *    edited in place; the sentence of what you'll be able to do; whether it
 *    is a class at school (by week, with classes and deadlines) or your own
 *    (a path at your pace); the finish line; time a week, said back as
 *    sessions and checked against the path (too many topics for too little
 *    time is said out loud, before it becomes "behind"); and its colour.
 *  - The path, the deadlines found, and what was read: the outline
 *    (PathEditor), the dated rows (DeadlineEditor), and one line per source
 *    saying whether it was read, so a PDF that came back empty isn't
 *    silently part of the course.
 *
 * The actions sit in a bar pinned to the bottom of the scroll, with the
 * count of what will be made: Create course (⌘Enter) and Start over.
 *
 * `variant: 'sheet'` is the same editor inside the chat's Edit (a modal on
 * a computer, a sheet on a phone; ai/ProposalEdit): one column whatever the
 * window (the breakpoints here are the window's, not the dialog's), the
 * course card flat, and no heading, sources or action bar, which the
 * dialog and the chat's card already carry.
 */
import type { Attachment, CourseProposal } from '~/companion/create'
import { COURSE_PALETTE, FILE_LOOK, fileKind, splitMinutes } from '~/companion/create'
import { courseColor } from '~/companion/colors'
import { dayKey, dayMonthLong, daysBetween } from '~/companion/time'
import { sizeLabel } from '~/companion/words'

const props = withDefaults(
  defineProps<{
    attachments: Attachment[]
    creating?: boolean
    /** "⌘" or "Ctrl", for the shortcut on the button. */
    mod: string
    variant?: 'page' | 'sheet'
  }>(),
  { variant: 'page' },
)

const page = computed(() => props.variant === 'page')

const emit = defineEmits<{ create: []; startOver: []; back: [] }>()

const proposal = defineModel<CourseProposal>({ required: true })

/* -- The card ---------------------------------------------------------------- */

const KINDS = [
  { value: 'school', icon: 'cap', title: 'School course', body: 'By week, with classes and deadlines' },
  { value: 'self', icon: 'flag', title: 'On my own', body: 'Along a path, at your pace' },
] as const

const FINISH = [
  { value: 'exam', label: 'Exam' },
  { value: 'project', label: 'Project' },
  { value: 'date', label: 'Date' },
  { value: 'none', label: 'None' },
]

const FINISH_WORD: Record<CourseProposal['finish']['kind'], string> = {
  exam: 'Final exam',
  project: 'Final project',
  date: 'Finish line',
  none: '',
}

const finishKind = computed({
  get: () => proposal.value.finish.kind,
  set: (kind: string) => {
    const f = proposal.value.finish
    const was = FINISH_WORD[f.kind]
    f.kind = kind as CourseProposal['finish']['kind']
    // A label that was only the old kind's default follows the new kind.
    if (!f.label || f.label === was) f.label = FINISH_WORD[f.kind]
  },
})

function setKind(kind: 'school' | 'self'): void {
  proposal.value.kind = kind
  if (kind === 'self' && !proposal.value.minutes_per_week) proposal.value.minutes_per_week = 120
}

const MINUTE_STEPS = [60, 120, 180, 300, 420]
const minuteOptions = computed(() => {
  const now = proposal.value.minutes_per_week ?? 120
  const steps = MINUTE_STEPS.includes(now) ? MINUTE_STEPS : [...MINUTE_STEPS, now].sort((a, b) => a - b)
  return steps.map((m) => ({ value: String(m), label: m % 60 ? `${Math.floor(m / 60)} h ${m % 60}` : `${m / 60} h` }))
})
const minutes = computed({
  get: () => String(proposal.value.minutes_per_week ?? 120),
  set: (v: string) => {
    proposal.value.minutes_per_week = Number(v)
  },
})

const topicCount = computed(() => proposal.value.units.reduce((n, u) => n + u.topics.length, 0))

const finishLine = computed(() => {
  const f = proposal.value.finish
  if (f.kind === 'none') return 'No finish line. The path goes at your pace.'
  if (!f.date) return 'Pick a date and BiliMind paces the path to it.'
  const days = daysBetween(dayKey(), f.date)
  if (days < 0) return 'That date has passed.'
  const away = days < 14 ? `in ${days} day${days === 1 ? '' : 's'}` : `in ${Math.round(days / 7)} weeks`
  return `${dayMonthLong(f.date)}, ${away}`
})

/**
 * The pace said back, and checked: about 45 minutes a topic, so a week's
 * minutes cover so many topics, and the weeks to the finish need so many.
 * Said gently when they don't add up, with the two ways to fix it.
 */
const pace = computed<{ line: string; tight: boolean }>(() => {
  const { sessions, minutes: each } = splitMinutes(proposal.value.minutes_per_week)
  const line = `${sessions} sessions of ${each} minutes a week, on the evenings you're free.`
  const date = proposal.value.finish.kind !== 'none' ? proposal.value.finish.date : null
  if (!date || !topicCount.value) return { line, tight: false }
  const weeks = Math.max(1, daysBetween(dayKey(), date) / 7)
  const need = topicCount.value / weeks
  const can = (proposal.value.minutes_per_week ?? 120) / 45
  if (need > can * 1.25) {
    return {
      line: `That's about ${Math.ceil(need)} topics a week to finish on time, more than this leaves room for. Give it more time a week, or a later date.`,
      tight: true,
    }
  }
  return { line: `${line} About ${Math.max(1, Math.round(need))} topic${Math.round(need) > 1 ? 's' : ''} a week.`, tight: false }
})

/* -- What was read ------------------------------------------------------------ */

interface SourceRow {
  key: string
  icon: string
  label: string
  detail: string
  ok: boolean
}

/*
 * One row per thing the learner gave, matched to what the server says about
 * it: a file by its item id, a link by its URL (the server's `label` is the
 * URL as sent). `read: false` is a source it couldn't read.
 */
const sourceRows = computed<SourceRow[]>(() => {
  type Source = CourseProposal['sources'][number]
  const listed = proposal.value.sources
  const used = new Set<number>()
  const reports = listed.some((s) => typeof s.read === 'boolean')
  const linkSources = listed.filter((s) => s.kind === 'link').length
  const linkAttachments = props.attachments.filter((a) => a.kind === 'link' || a.kind === 'calendar').length
  const find = (test: (s: Source) => boolean): Source | null => {
    const i = listed.findIndex((s, n) => !used.has(n) && test(s))
    if (i < 0) return null
    used.add(i)
    return listed[i]!
  }
  const rows: SourceRow[] = []
  for (const a of props.attachments) {
    if (a.kind === 'file') {
      const look = FILE_LOOK[fileKind(a.name, a.mime)]
      const base = { key: a.id, icon: look.icon, label: a.name }
      if (a.refused) rows.push({ ...base, detail: `Not sent: ${a.error ?? 'a kind nothing reads'}`, ok: false })
      else if (!a.itemId) rows.push({ ...base, detail: a.error ?? 'Didn\'t upload', ok: false })
      else {
        const source = find((s) => (s.item_id ? s.item_id === a.itemId : s.label === a.name))
        const ok = Boolean(source) && source!.read !== false
        rows.push({ ...base, detail: ok ? [look.word, sizeLabel(a.size)].filter(Boolean).join(' · ') : 'Couldn\'t read it. It waits in Notes.', ok })
      }
    } else if (a.kind === 'link' || a.kind === 'calendar') {
      const source = find((s) => s.kind === 'link' && (s.label === a.url || (!reports && s.label.includes(a.domain))))
      const ok = source ? source.read !== false : !reports && linkSources >= linkAttachments
      const named = source?.title || (a.kind === 'link' ? (a.title ?? a.domain) : 'Calendar link')
      rows.push({
        key: a.id,
        icon: a.kind === 'calendar' ? 'calendar' : a.moodle ? 'cap' : 'link',
        label: named,
        detail: ok ? a.domain : `Couldn't open ${a.domain}`,
        ok,
      })
    } else if (a.kind === 'text') {
      find((s) => s.kind === 'text' && s.label === a.title)
      rows.push({ key: a.id, icon: 'paste', label: a.title, detail: `${a.words.toLocaleString('en')} words, kept as a page in the course`, ok: true })
    } else {
      find((s) => s.kind === 'text' && s.label.includes(a.title))
      rows.push({ key: a.id, icon: 'cap', label: a.title, detail: `Moodle · ${a.detail}`, ok: true })
    }
  }
  // Anything else the server names. A text source nobody pasted is the
  // learner's own sentence (the server labels it with the sentence itself).
  listed.forEach((s, n) => {
    if (used.has(n) || props.attachments.some((a) => a.kind === 'file' && a.itemId && a.itemId === s.item_id)) return
    if (s.kind === 'link' && linkAttachments && !reports) return
    const ok = s.read !== false
    const said = s.kind === 'text'
    rows.push({
      key: `extra-${n}`,
      icon: said ? 'pencil' : s.kind === 'link' ? 'link' : 'file',
      label: said ? 'What you wrote' : s.title || s.label,
      detail: said ? `“${s.label}”` : ok ? 'Read' : 'Couldn\'t read it',
      ok,
    })
  })
  return rows
})

const unread = computed(() => sourceRows.value.filter((r) => !r.ok).length)

const summary = computed(() => {
  const units = proposal.value.units.length
  const deadlines = proposal.value.deadlines.length
  return [
    `${units} unit${units === 1 ? '' : 's'}`,
    `${topicCount.value} topic${topicCount.value === 1 ? '' : 's'}`,
    `${deadlines} deadline${deadlines === 1 ? '' : 's'}`,
  ].join(' · ')
})

const canCreate = computed(() => proposal.value.title.trim().length > 0)

/* The summary grows with its text, like the composer. */
const summaryField = ref<HTMLTextAreaElement | null>(null)
function fit(): void {
  const el = summaryField.value
  if (!el) return
  el.style.height = '0px'
  el.style.height = `${el.scrollHeight}px`
}
watch(() => proposal.value.summary, () => nextTick(fit))
onMounted(fit)
</script>

<template>
  <div :class="page ? 'grid gap-8' : 'grid gap-7'">
    <!-- Heading. -->
    <header
      v-if="page"
      class="grid gap-2"
    >
      <div class="-mt-2 mb-1 flex min-h-11 items-center">
        <button
          type="button"
          class="-ml-2.5 inline-flex h-11 cursor-pointer items-center gap-1 rounded-full pr-4 pl-2 text-[15px] font-semibold text-brand transition-colors duration-150 outline-none hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand-line"
          @click="emit('back')"
        >
          <CompanionIcon
            name="chevron-left"
            :size="18"
          />
          Edit what you gave it
        </button>
      </div>
      <h1 class="t-head text-[28px] min-[900px]:text-[36px]">
        Here's your course
      </h1>
      <p class="max-w-[62ch] text-[16px] leading-relaxed text-text-soft">
        Change anything you like. Nothing is made until you press Create course, and lessons are
        written as you reach them.
      </p>
    </header>

    <fieldset
      :class="[
        'm-0 grid min-w-0 border-0 p-0',
        page ? 'gap-8 min-[1100px]:grid-cols-[360px_minmax(0,1fr)] min-[1100px]:items-start min-[1100px]:gap-10' : 'gap-7',
      ]"
      :disabled="creating"
    >
      <!-- The course card. -->
      <aside
        :class="[
          'grid min-w-0 content-start gap-6',
          page
            ? 'animate-rise rounded-[18px] bg-surface p-5 shadow-[0_0_0_1px_var(--border-strong),var(--shadow-raised)] min-[600px]:p-6 min-[1100px]:sticky min-[1100px]:top-6'
            : 'border-b border-border-rule pb-7',
        ]"
        aria-label="The course"
      >
        <div class="grid gap-2">
          <span class="flex items-center gap-2 text-[13px] font-medium text-text-muted">
            <span
              class="size-2.5 rounded-full transition-colors duration-200"
              :style="{ background: courseColor(proposal.color) }"
            />
            {{ proposal.kind === 'school' ? 'School course' : 'On your own' }}
          </span>
          <label
            for="cp-review-title"
            class="sr-only"
          >Course name</label>
          <input
            id="cp-review-title"
            v-model="proposal.title"
            type="text"
            placeholder="Name the course"
            class="-mx-2 h-auto min-w-0 rounded-[10px] bg-transparent px-2 py-0.5 font-display text-[26px] leading-tight font-semibold tracking-[-0.025em] text-text outline-none placeholder:text-text-faint hover:bg-surface-mute focus:bg-surface-mute focus:ring-2 focus:ring-brand-line"
          >
          <label
            for="cp-review-summary"
            class="sr-only"
          >What you'll be able to do</label>
          <textarea
            id="cp-review-summary"
            ref="summaryField"
            v-model="proposal.summary"
            rows="1"
            placeholder="What you'll be able to do at the end"
            class="-mx-2 resize-none overflow-hidden rounded-[10px] bg-transparent px-2 py-1 text-[15px] leading-relaxed text-text-body outline-none placeholder:text-text-faint hover:bg-surface-mute focus:bg-surface-mute focus:ring-2 focus:ring-brand-line"
          />
        </div>

        <!-- Kind. -->
        <div
          class="grid gap-2"
          role="radiogroup"
          aria-label="What kind of course"
        >
          <span class="text-[13px] font-semibold text-text-soft">Kind</span>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="k in KINDS"
              :key="k.value"
              type="button"
              role="radio"
              :aria-checked="proposal.kind === k.value"
              class="grid cursor-pointer content-start gap-1 rounded-[14px] border px-3 py-2.5 text-left transition-[border-color,background-color,box-shadow] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-brand-line"
              :class="proposal.kind === k.value
                ? 'border-text bg-surface shadow-[inset_0_0_0_1px_var(--text)]'
                : 'border-border bg-surface-mute hover:border-border-strong hover:bg-surface'"
              @click="setKind(k.value)"
            >
              <span class="flex items-center gap-1.5 text-[14px] font-semibold text-text">
                <CompanionIcon
                  :name="k.icon"
                  :size="16"
                  :class="proposal.kind === k.value ? 'text-text' : 'text-text-faint'"
                />
                {{ k.title }}
              </span>
              <span class="text-[12.5px] leading-snug text-text-muted">{{ k.body }}</span>
            </button>
          </div>
        </div>

        <!-- Finish line. -->
        <div class="grid gap-2">
          <span class="flex items-center justify-between gap-2">
            <span class="text-[13px] font-semibold text-text-soft">Finish line</span>
            <UiSegmented
              v-model="finishKind"
              :options="FINISH"
              size="xs"
              label="Finish line"
            />
          </span>
          <div
            v-if="proposal.finish.kind !== 'none'"
            class="grid grid-cols-[minmax(0,1fr)_auto] gap-2"
          >
            <label
              for="cp-review-finish"
              class="sr-only"
            >What the finish line is</label>
            <input
              id="cp-review-finish"
              v-model="proposal.finish.label"
              type="text"
              :placeholder="FINISH_WORD[proposal.finish.kind]"
              class="h-11 min-w-0 rounded-[12px] border border-border-field bg-surface px-3 text-[15px] text-text outline-none placeholder:text-text-faint focus:border-brand focus:ring-3 focus:ring-brand-line"
            >
            <label
              for="cp-review-date"
              class="sr-only"
            >Finish date</label>
            <input
              id="cp-review-date"
              v-model="proposal.finish.date"
              type="date"
              :min="dayKey()"
              class="h-11 w-[150px] min-w-0 rounded-[12px] border border-border-field bg-surface px-3 text-[15px] text-text tabular-nums outline-none focus:border-brand focus:ring-3 focus:ring-brand-line"
            >
          </div>
          <p class="text-[13px] text-text-muted">
            {{ finishLine }}
          </p>
        </div>

        <!-- Time a week, for a course of your own. -->
        <div
          v-if="proposal.kind === 'self'"
          class="grid gap-2"
        >
          <span class="text-[13px] font-semibold text-text-soft">Time a week</span>
          <UiSegmented
            v-model="minutes"
            :options="minuteOptions"
            size="sm"
            block
            label="Time a week"
          />
          <p
            class="text-[13px] leading-snug"
            :class="pace.tight ? 'font-medium text-warn-text' : 'text-text-muted'"
          >
            {{ pace.line }}
          </p>
        </div>

        <!-- Colour. -->
        <div class="grid gap-2">
          <span class="text-[13px] font-semibold text-text-soft">Colour</span>
          <div
            class="flex flex-wrap gap-1"
            role="radiogroup"
            aria-label="Course colour"
          >
            <button
              v-for="tone in COURSE_PALETTE"
              :key="tone"
              type="button"
              role="radio"
              :aria-checked="proposal.color === tone"
              :aria-label="`Colour ${tone}`"
              class="grid size-11 cursor-pointer place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand-line min-[600px]:size-9"
              @click="proposal.color = tone"
            >
              <span
                class="grid size-7 place-items-center rounded-full transition-[box-shadow,transform] duration-150 hover:scale-110"
                :class="proposal.color === tone && 'shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--text)]'"
                :style="{ background: courseColor(tone) }"
              >
                <UiIcon
                  v-if="proposal.color === tone"
                  name="check"
                  :size="13"
                  :stroke="2.6"
                  class="text-on-brand"
                />
              </span>
            </button>
          </div>
        </div>
      </aside>

      <!-- The path, the deadlines, the sources. -->
      <div :class="['grid min-w-0 content-start', page ? 'gap-10' : 'gap-7']">
        <section
          class="grid gap-4"
          aria-labelledby="cp-review-path"
        >
          <div class="grid gap-1">
            <h2
              id="cp-review-path"
              :class="['t-head', page ? 'text-[20px]' : 'text-[17px]']"
            >
              The path
            </h2>
            <p class="text-[14.5px] text-text-muted">
              {{ proposal.units.length }} units, {{ topicCount }} topics, in the order you'll learn them.
              Rename, reorder or remove anything.
            </p>
          </div>
          <CompanionCreatePathEditor
            v-model="proposal.units"
            :disabled="creating"
          />
        </section>

        <section
          class="grid gap-4"
          aria-labelledby="cp-review-deadlines"
        >
          <div class="grid gap-1">
            <h2
              id="cp-review-deadlines"
              :class="['t-head', page ? 'text-[20px]' : 'text-[17px]']"
            >
              Deadlines found
            </h2>
            <p class="text-[14.5px] text-text-muted">
              They go in your calendar, and Today counts down to them.
            </p>
          </div>
          <CompanionCreateDeadlineEditor
            v-model="proposal.deadlines"
            :disabled="creating"
          />
        </section>

        <section
          v-if="page && sourceRows.length"
          class="grid gap-3"
          aria-labelledby="cp-review-sources"
        >
          <div class="grid gap-1">
            <h2
              id="cp-review-sources"
              class="t-head text-[20px]"
            >
              What it read
            </h2>
            <p
              v-if="unread"
              class="text-[14.5px] text-text-muted"
            >
              {{ unread === 1 ? 'One source' : `${unread} sources` }} couldn't be read, so the course was made
              without {{ unread === 1 ? 'it' : 'them' }}.
            </p>
          </div>
          <ul class="divide-y divide-border-rule border-y border-border-rule">
            <li
              v-for="r in sourceRows"
              :key="r.key"
              class="flex min-h-14 items-center gap-3 py-2.5"
            >
              <CompanionIcon
                :name="r.icon"
                :size="18"
                class="shrink-0"
                :class="r.ok ? 'text-text-soft' : 'text-warn'"
              />
              <span class="grid min-w-0 flex-1 gap-0.5">
                <span class="truncate text-[14.5px] font-medium text-text">{{ r.label }}</span>
                <span
                  class="truncate text-[13px] [font-feature-settings:'calt'_0]"
                  :class="r.ok ? 'text-text-muted' : 'text-warn-text'"
                >{{ r.detail }}</span>
              </span>
              <span
                class="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold"
                :class="r.ok ? 'text-success-text' : 'text-warn-text'"
              >
                <UiIcon
                  :name="r.ok ? 'check' : 'alert'"
                  :size="14"
                />
                {{ r.ok ? 'Read' : 'Not read' }}
              </span>
            </li>
          </ul>
        </section>
      </div>
    </fieldset>

    <!-- The one decision, pinned to the bottom of the scroll. -->
    <div
      v-if="page"
      class="sticky bottom-0 z-10 -mx-4 border-t border-border bg-surface-chrome/95 px-4 py-3 backdrop-blur-[12px] min-[900px]:-mx-8 min-[900px]:px-8">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p class="min-w-0 flex-1 truncate text-[14px] text-text-muted max-[599px]:basis-full">
          <span class="font-semibold text-text">{{ proposal.title || 'Untitled course' }}</span> · {{ summary }}
        </p>
        <div class="flex items-center gap-2 max-[599px]:w-full">
          <UiBtn
            variant="ghost"
            size="lg"
            :disabled="creating"
            class="max-[599px]:flex-1"
            @click="emit('startOver')"
          >
            Start over
          </UiBtn>
          <UiBtn
            variant="primary"
            size="lg"
            :loading="creating"
            :disabled="!canCreate"
            :title="`Create course (${mod}Enter)`"
            class="max-[599px]:flex-[2]"
            @click="emit('create')"
          >
            Create course
            <span
              class="ml-1 text-[12.5px] font-medium opacity-55 max-[899px]:hidden"
              aria-hidden="true"
            >{{ mod }}↵</span>
          </UiBtn>
        </div>
      </div>
    </div>
  </div>
</template>
