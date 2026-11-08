<script setup lang="ts">
/**
 * One turn of the conversation.
 *
 * The learner's is a compact bubble on the right, with the passage it asked
 * about and the things it gave (files, notes, links, pasted text) above it,
 * as small chips that open what they name. The companion's is prose with no bubble at all, beside the
 * spark: an answer is something to read, and a bubble around five
 * paragraphs makes it a chat log. While it is being grounded it says what it
 * is reading ("Reading Lecture 8 slides…"), with a clock once the wait is
 * long enough to wonder; while it streams a caret sits at the end of the last
 * line. A note or flashcards it is making are written in the same answer, so
 * their cards appear and fill in under the prose (`making`) as they are written.
 *
 * Citations arrive as `[1]` in the text and become small numbered chips
 * that open their source (a lesson, a page, the slide's file, a deadline),
 * with the sources listed once more under the answer, NotebookLM-style, so
 * where it came from is never more than a glance away. The chips are made
 * here from tokens `useMarkdown` has already escaped; the model's text never
 * reaches the page as markup.
 *
 * An answer that drafted a course carries the draft as a card under its
 * sentence (`CompanionAiProposal`, the proposal agent's), which shows its
 * own work list while it drafts, so the status line steps aside for it. A
 * draft that a later answer re-drafted is `replaced` and folds away.
 *
 * An answer that asked for the learner's attempt instead of doing the work
 * (`guard`, the design notes) says why in one line under the prose, over a
 * hairline and not in a card: "Attempt first. This is part of Assignment
 * 2." It must not read as a lock, so the newest such answer offers the two
 * ways on beside it: "Check my attempt" (the box takes their working) and
 * "I'm stuck, show me" (the next step, sent at once). Older answers keep
 * only the line; the buttons would answer a question that has moved on.
 */
import type { MdToken } from '~/composables/useMarkdown'
import { escapeHtml, parseMarkdown } from '~/composables/useMarkdown'
import type { AiAttachment, AiCitation, AiMessage } from '~/companion/ai/types'
import { useAi } from '~/companion/ai/state'
import { STUCK_WORDS, useAiThread } from '~/companion/ai/thread'
import { ATTEMPT_TILE } from '~/companion/ai/make'
import { attachmentLook } from '~/companion/ai/attach'
import { citationIcon, citationTarget } from '~/companion/ai/links'
import { fetchFileUrl } from '~/companion/files'
import { useCompanion } from '~/companion/store'
import { liftMath } from '~/companion/ai/math'
import 'katex/dist/katex.min.css'

const props = withDefaults(
  defineProps<{
    message: AiMessage
    /** The newest answer: its tools stay visible and it can be asked again. */
    last?: boolean
    variant?: 'panel' | 'page'
    subjectId?: string | null
    topicId?: string | null
    /** A later answer in this chat drafted the course again. */
    replaced?: boolean
  }>(),
  { variant: 'panel' },
)

const emit = defineEmits<{ retry: [] }>()

const store = useCompanion()
const ai = useAi()
const toast = useToast()

const CARET = ''
const cites = computed<AiCitation[]>(() => props.message.citations ?? [])

function decorate(html: string): string {
  return html
    .replace(/ ?\[(\d{1,2})\]/g, (_m, n: string) => {
      const cite = cites.value[Number(n) - 1]
      if (!cite) return ''
      const label = escapeHtml(cite.label)
      return `<button type="button" class="ai-cite" data-cite="${n}" title="${label}" aria-label="Source ${n}: ${label}">${n}</button>`
    })
    .replace(CARET, '<span class="ai-caret" aria-hidden="true"></span>')
}

function dress(tokens: MdToken[], restore: (html: string) => string): MdToken[] {
  const finish = (html: string) => restore(decorate(html))
  return tokens.map((t) => {
    switch (t.kind) {
      case 'heading':
      case 'paragraph':
        return { ...t, html: finish(t.html) }
      case 'list':
        return { ...t, items: t.items.map((item) => ({ ...item, html: finish(item.html) })) }
      case 'table':
        return { ...t, head: t.head.map(finish), rows: t.rows.map((r) => r.map(finish)) }
      case 'quote':
        return { ...t, tokens: dress(t.tokens, restore) }
      case 'code':
        return { ...t, code: t.code.replace(CARET, '') }
      default:
        return t
    }
  })
}

const tokens = computed<MdToken[]>(() => {
  const text = props.message.text ?? ''
  if (!text) return []
  const math = liftMath(text)
  const source = props.message.pending && !props.message.making?.length ? `${math.text}${CARET}` : math.text
  return dress(parseMarkdown(source), math.restore)
})

/* -- Opening a source -------------------------------------------------------- */

async function openCite(cite: AiCitation): Promise<void> {
  const target = citationTarget(store, cite)
  if (!target) {
    toast.info({ title: cite.label, body: cite.quote ? `“${cite.quote}”` : 'That source isn\'t on this device yet.' })
    return
  }
  if ('href' in target) {
    window.open(target.href, '_blank', 'noopener')
    return
  }
  if ('item' in target) {
    const item = target.item
    if (item.kind === 'link' && item.meta.url) {
      window.open(item.meta.url, '_blank', 'noopener')
      return
    }
    // The window opens inside the click, so no popup blocker objects.
    const tab = window.open('', '_blank')
    const url = await fetchFileUrl(item)
    if (url && tab) tab.location.href = url
    else {
      tab?.close()
      toast.info({ title: item.title, body: 'It can\'t be opened right now. Try again when you\'re online.' })
    }
    return
  }
  if (!ai.wide.value) ai.hide()
  await navigateTo(target.to)
}

function onProseClick(event: MouseEvent): void {
  const el = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-cite]')
  if (!el) return
  const cite = cites.value[Number(el.dataset.cite) - 1]
  if (cite) void openCite(cite)
}

const allSources = ref(false)
const sources = computed(() => (allSources.value ? cites.value : cites.value.slice(0, 4)))

/* -- Copy ---------------------------------------------------------------------- */

const copied = ref(false)
async function copy(): Promise<void> {
  const plain = (props.message.text ?? '').replace(/ ?\[E?\d{1,3}\]/g, '')
  try {
    await navigator.clipboard.writeText(plain)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    toast.error('Copying isn\'t allowed here. Select the text instead.')
  }
}

/* -- What the learner gave ------------------------------------------------------- */

const given = computed<AiAttachment[]>(() => props.message.attachments ?? [])

function canOpen(a: AiAttachment): boolean {
  if (a.kind === 'link' || a.kind === 'calendar') return Boolean(a.url)
  if (a.kind === 'moodle') return Boolean(a.subject_id && store.get('subjects', a.subject_id))
  return Boolean(a.item_id && store.get('items', a.item_id))
}

function openGiven(a: AiAttachment): void {
  if ((a.kind === 'link' || a.kind === 'calendar') && a.url) {
    window.open(a.url.replace(/^webcal:/i, 'https:'), '_blank', 'noopener')
    return
  }
  if (a.kind === 'moodle' && a.subject_id) {
    if (!ai.wide.value) ai.hide()
    void navigateTo(`/app/courses/${a.subject_id}`)
    return
  }
  if (a.item_id) void openCite({ kind: 'item', id: a.item_id, label: a.label })
}

const isUser = computed(() => props.message.role === 'user')
/** Waiting for words, and no draft card to show the work instead. */
const waiting = computed(() => props.message.pending && !props.message.text)
const showStatus = computed(() => waiting.value && !props.message.proposal && !props.message.making?.length)
const clock = useStopwatch(() => props.message.id)
/** Silent for a while: count, so a long think can't be mistaken for a stuck one. */
const waited = computed(() => {
  const seconds = showStatus.value ? (clock.since(0) ?? 0) : 0
  return seconds >= 4 ? `${seconds}s` : ''
})
const actions = computed(() => (props.message.pending ? [] : props.message.actions ?? []))

/* -- Attempt first ---------------------------------------------------------------- */

const t = useAiThread()
const guard = computed(() => (props.message.pending ? null : props.message.guard ?? null))

function stuck(): void {
  t.send(STUCK_WORDS, { intent: 'stuck', attachments: [], quote: null })
}
</script>

<template>
  <!-- The learner -->
  <div
    v-if="isUser"
    class="flex flex-col items-end gap-1.5"
  >
    <!-- What came with it. -->
    <ul
      v-if="given.length"
      class="flex max-w-[88%] flex-wrap justify-end gap-1.5"
      aria-label="Added to this message"
    >
      <li
        v-for="(a, i) in given"
        :key="`${a.kind}:${a.item_id ?? a.url ?? a.subject_id ?? i}`"
        class="min-w-0"
      >
        <component
          :is="canOpen(a) ? 'button' : 'span'"
          :type="canOpen(a) ? 'button' : undefined"
          :class="[
            'flex h-9 max-w-[240px] min-w-0 items-center gap-2 rounded-full bg-surface pr-3.5 pl-1 text-left text-[12.5px] text-text shadow-[0_0_0_1px_var(--border-strong),var(--shadow-card)] transition-[background-color,box-shadow] duration-150',
            canOpen(a) && 'cursor-pointer hover:bg-surface-chrome hover:shadow-[0_0_0_1px_var(--border-field),var(--shadow-card)] focus-visible:bg-surface-chrome',
          ]"
          :title="a.url ?? a.label"
          @click="canOpen(a) && openGiven(a)"
        >
          <span
            class="grid size-7 shrink-0 place-items-center rounded-full bg-surface shadow-[0_0_0_1px_var(--border)]"
            :class="attachmentLook(a).tone"
          >
            <CompanionIcon
              :name="attachmentLook(a).icon"
              :size="14"
            />
          </span>
          <span class="truncate font-semibold">{{ a.label }}</span>
        </component>
      </li>
    </ul>
    <div
      v-if="message.quote"
      class="flex max-w-[88%] items-start gap-1.5 rounded-[9px] bg-surface-sunken px-2.5 py-1.5 text-[12.5px] leading-[1.45] text-text-muted"
    >
      <UiIcon
        name="chat"
        :size="12"
        class="mt-[3px] shrink-0 text-text-faint"
      />
      <span class="line-clamp-2">{{ message.quote }}</span>
    </div>
    <p
      :class="[
        'max-w-[88%] rounded-[14px] rounded-br-[4px] bg-bg px-3 py-2 whitespace-pre-wrap text-text shadow-[inset_0_0_0_1px_var(--border)]',
        variant === 'page' ? 'text-[15px] leading-[1.55]' : 'text-[14px] leading-[1.5]',
      ]"
    >
      {{ message.text }}
    </p>
  </div>

  <!-- The companion -->
  <div
    v-else
    class="group/msg flex gap-2.5"
  >
    <!-- Bili: thinking until the first words arrive. -->
    <span class="grid w-6 shrink-0 justify-items-center pt-0.5">
      <CompanionAiBilim
        :size="22"
        :mood="waiting ? 'think' : 'idle'"
      />
    </span>

    <div class="min-w-0 flex-1">
      <!-- What it is reading, until the first words arrive. -->
      <p
        v-if="showStatus"
        class="flex min-h-6 items-center gap-2.5 text-[13px] text-text-muted"
      >
        <span class="ai-status min-w-0">{{ message.status || 'Thinking' }}</span>
        <span
          class="ai-dots"
          aria-hidden="true"
        ><i /><i /><i /></span>
        <span
          v-if="waited"
          class="num text-text-faint"
        >{{ waited }}</span>
      </p>

      <div
        v-if="tokens.length"
        :class="['ai-prose', variant === 'page' ? 'is-page' : 'is-panel']"
        @click="onProseClick"
      >
        <BlocksMarkdown
          :tokens="tokens"
          :size="variant === 'page' ? 'md' : 'sm'"
        />
      </div>

      <!-- The course it drafted. -->
      <CompanionAiProposal
        v-if="message.proposal"
        :message="message"
        :variant="variant"
        :replaced="replaced"
        :class="tokens.length ? 'mt-3' : 'mt-0.5'"
      />

      <!-- It broke: say so, keep what came, and offer the one fix. -->
      <div
        v-if="message.error"
        class="mt-2 flex items-start gap-2 rounded-[12px] bg-danger-soft px-3 py-2.5 text-[13px] leading-[1.45] text-danger-text"
        role="alert"
      >
        <UiIcon
          name="alert"
          :size="15"
          class="mt-px shrink-0"
        />
        <!-- Out of AI: the reason and every way forward, as links. -->
        <CompanionOutOfAi
          v-if="message.limited"
          :reason="message.error"
          class="min-w-0 flex-1"
        />
        <span
          v-else
          class="min-w-0 flex-1"
        >{{ message.error }}</span>
        <button
          v-if="!message.limited && last"
          type="button"
          class="shrink-0 cursor-pointer font-semibold underline underline-offset-4 hover:no-underline"
          @click="emit('retry')"
        >
          Try again
        </button>
      </div>

      <!-- Where it came from. -->
      <div
        v-if="!message.pending && cites.length"
        class="mt-3 flex flex-wrap items-center gap-1.5"
      >
        <span class="mr-0.5 text-[12px] font-semibold text-text-faint">Sources</span>
        <!-- The landing's "with its source" pill, numbered the way the answer cites it. -->
        <button
          v-for="(cite, i) in sources"
          :key="`${cite.kind}:${cite.id}:${i}`"
          type="button"
          class="inline-flex h-8 max-w-[240px] cursor-pointer items-center gap-1.5 rounded-full bg-surface pr-3 pl-1 text-[12.5px] font-semibold text-text shadow-[0_0_0_1px_var(--border-strong),var(--shadow-card)] transition-[background-color,box-shadow] duration-150 hover:bg-surface-chrome hover:shadow-[0_0_0_1px_var(--border-field),var(--shadow-card)] focus-visible:bg-surface-chrome max-lg:h-10"
          :title="cite.quote ? `${cite.label}: “${cite.quote}”` : cite.label"
          @click="openCite(cite)"
        >
          <span class="num grid size-6 shrink-0 place-items-center rounded-full bg-sky-soft text-[10.5px] font-bold text-sky-ink">{{ i + 1 }}</span>
          <CompanionIcon
            :name="citationIcon(store, cite)"
            :size="13"
            class="shrink-0 text-text-faint"
          />
          <span class="truncate">{{ cite.label }}</span>
        </button>
        <button
          v-if="cites.length > 4 && !allSources"
          type="button"
          class="h-8 cursor-pointer rounded-full px-2.5 text-[12.5px] font-semibold text-text-muted shadow-[inset_0_0_0_1px_var(--border)] transition-colors hover:bg-surface-sunken hover:text-text max-lg:h-10"
          @click="allSources = true"
        >
          +{{ cites.length - 4 }}
        </button>
      </div>

      <!-- Why it asked for an attempt, and the two ways on from here. -->
      <div
        v-if="guard"
        class="mt-3 grid gap-2.5 border-t border-border-rule pt-3"
      >
        <p class="text-[13.5px] leading-[1.5] text-text-soft">
          <strong class="font-semibold text-text">Attempt first.</strong>
          <template v-if="guard.reason === 'graded' && guard.deadline_id">
            This is part of
            <NuxtLink
              :to="`/app/d/${guard.deadline_id}`"
              class="font-semibold text-text underline decoration-border-field underline-offset-4 hover:decoration-current"
              @click="!ai.wide.value && ai.hide()"
            >{{ guard.title }}</NuxtLink>.
          </template>
          <template v-else-if="guard.reason === 'graded'">
            This is part of {{ guard.title }}.
          </template>
          <template v-else>
            You turned it on for {{ guard.subject_id ? guard.title : 'everything' }}.
          </template>
        </p>
        <div
          v-if="last"
          class="flex flex-wrap gap-2"
        >
          <UiBtn
            size="sm"
            variant="secondary"
            @click="t.pick(ATTEMPT_TILE)"
          >
            Check my attempt
          </UiBtn>
          <UiBtn
            size="sm"
            variant="ghost"
            :disabled="t.busy.value"
            @click="stuck"
          >
            I'm stuck, show me
          </UiBtn>
        </div>
      </div>

      <!-- What it is making, as it is written. -->
      <div
        v-if="message.pending && message.making?.length"
        class="animate-rise mt-3 grid grid-cols-[minmax(0,1fr)] gap-2"
      >
        <CompanionAiActionCard
          v-for="(action, i) in message.making"
          :key="i"
          live
          :action="action"
        />
      </div>

      <!-- What it offers to make. -->
      <div
        v-if="actions.length"
        class="animate-rise mt-3 grid grid-cols-[minmax(0,1fr)] gap-2"
      >
        <CompanionAiActionCard
          v-for="(action, i) in actions"
          :key="i"
          :action="action"
          :subject-id="subjectId"
          :topic-id="topicId"
          :message-id="message.id"
          :index="i"
        />
      </div>

      <div
        v-if="!message.pending && message.text"
        :class="[
          'mt-1.5 -ml-1.5 flex items-center gap-0.5 transition-opacity duration-150',
          last ? 'opacity-100' : 'opacity-0 group-hover/msg:opacity-100 group-focus-within/msg:opacity-100 max-lg:opacity-100',
        ]"
      >
        <button
          type="button"
          class="grid size-8 cursor-pointer place-items-center rounded-[9px] text-text-faint transition-colors hover:bg-surface-sunken hover:text-text focus-visible:bg-surface-sunken"
          :aria-label="copied ? 'Copied' : 'Copy the answer'"
          :title="copied ? 'Copied' : 'Copy'"
          @click="copy"
        >
          <UiIcon
            v-if="copied"
            name="check"
            :size="14"
            :stroke="2"
          />
          <CompanionIcon
            v-else
            name="copy"
            :size="14"
          />
        </button>
        <button
          v-if="last && !message.error"
          type="button"
          class="grid size-8 cursor-pointer place-items-center rounded-[9px] text-text-faint transition-colors hover:bg-surface-sunken hover:text-text focus-visible:bg-surface-sunken"
          aria-label="Ask again"
          title="Ask again"
          @click="emit('retry')"
        >
          <UiIcon
            name="refresh"
            :size="14"
          />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* A touch larger than the kit's small prose: an answer in a 360px panel is
   still something read for minutes at a time. */
.ai-prose.is-panel :deep(.md) {
  font-size: 14px;
}

.ai-prose.is-page :deep(.md) {
  font-size: 15.5px;
}

.ai-prose :deep(.md > :first-child) {
  margin-top: 0;
}

/* A citation: a small numbered chip riding the line, not a footnote you hunt for. */
.ai-prose :deep(.ai-cite) {
  display: inline-grid;
  place-items: center;
  min-width: 17px;
  height: 17px;
  margin: 0 1px 0 3px;
  padding: 0 4px;
  border-radius: 5px;
  background: var(--sky-soft);
  color: var(--sky-ink);
  font-size: 10.5px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  vertical-align: 1.5px;
  cursor: pointer;
  transition: background-color 120ms, color 120ms;
}

.ai-prose :deep(.ai-cite:hover),
.ai-prose :deep(.ai-cite:focus-visible) {
  background: var(--sky);
  color: var(--surface);
}

.ai-prose :deep(.ai-caret) {
  display: inline-block;
  width: 7px;
  height: 1.05em;
  margin-left: 2px;
  border-radius: 2px;
  background: var(--text-soft);
  vertical-align: -2px;
  animation: ai-blink 1s ease-in-out infinite;
}

/* The status line breathes while it waits, and three dots hop beside it, so a
   slow answer still looks alive. */
.ai-status {
  animation: ai-breathe 1.6s ease-in-out infinite;
}

.ai-dots {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
}

.ai-dots i {
  width: 5px;
  height: 5px;
  border-radius: 99px;
  background: var(--text-muted);
  animation: ai-hop 1.2s cubic-bezier(0.4, 0.14, 0.3, 1) infinite;
}

.ai-dots i:nth-child(2) {
  animation-delay: 0.15s;
}

.ai-dots i:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes ai-hop {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  40% {
    transform: translateY(-3px);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ai-status,
  .ai-dots i {
    animation: none;
  }
}

@keyframes ai-blink {
  0%,
  100% {
    opacity: 0.2;
  }
  50% {
    opacity: 1;
  }
}

@keyframes ai-breathe {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}
</style>
