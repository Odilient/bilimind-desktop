<script setup lang="ts">
/**
 * The chat page's right-hand column (a sheet on smaller screens): what the
 * answers are grounded in, and what this chat has read so far. NotebookLM's
 * sources, said in BiliMind's words.
 *
 * "Added to this chat" is everything the learner gave it (files, notes,
 * links, pasted text, a Moodle course), once each, so a chat about three
 * PDFs reads like a notebook of three PDFs.
 *
 * "Answers from" is everything by default, or one course: a switch per
 * course, and turning one on narrows every answer to that course's
 * classes, slides, recordings, notes and cards (it becomes the screen's
 * context, so the scope follows). "Read in this chat" lists each source the
 * answers cited, once, newest first, each one a tap from where it lives.
 */
import { useAiThread } from '~/companion/ai/thread'
import { citationIcon, citationTarget } from '~/companion/ai/links'
import type { AiAttachment, AiCitation } from '~/companion/ai/types'
import { attachmentLook } from '~/companion/ai/attach'
import { useAi } from '~/companion/ai/state'
import { useCompanion } from '~/companion/store'
import { courseColor } from '~/companion/colors'
import { fetchFileUrl } from '~/companion/files'

const source = defineModel<string | null>({ default: null })
const emit = defineEmits<{ navigate: [] }>()

const store = useCompanion()
const t = useAiThread()
const ai = useAi()
const toast = useToast()

const courses = computed(() =>
  store.subjects.value.map((s) => {
    const notes = store.items.value.filter((i) => i.subject_id === s.id && (i.kind === 'page' || i.kind === 'board')).length
    const files = store.items.value.filter((i) => i.subject_id === s.id && (i.kind === 'file' || i.kind === 'recording' || i.kind === 'photo')).length
    const parts = [notes ? `${notes} ${notes === 1 ? 'note' : 'notes'}` : '', files ? `${files} ${files === 1 ? 'file' : 'files'}` : ''].filter(Boolean)
    return { subject: s, sub: parts.join(' · ') || 'Nothing added yet' }
  }),
)

const totals = computed(() => {
  const notes = store.items.value.filter((i) => i.kind === 'page' || i.kind === 'board').length
  const n = store.subjects.value.length
  return `${n} ${n === 1 ? 'course' : 'courses'} · ${notes} ${notes === 1 ? 'note' : 'notes'}`
})

function toggle(id: string): void {
  source.value = source.value === id ? null : id
}

/** Every source this chat's answers cited, once each, latest first. */
const read = computed<AiCitation[]>(() => {
  const seen = new Set<string>()
  const out: AiCitation[] = []
  for (const m of [...t.messages.value].reverse()) {
    for (const c of m.citations ?? []) {
      const key = `${c.kind}:${c.id}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(c)
    }
  }
  return out.slice(0, 12)
})

/** What the learner gave this chat, once each, in the order given. */
const given = computed<AiAttachment[]>(() => {
  const seen = new Set<string>()
  const out: AiAttachment[] = []
  for (const m of t.messages.value) {
    for (const a of m.attachments ?? []) {
      const key = `${a.kind}:${a.item_id ?? a.url ?? a.subject_id ?? a.label}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(a)
    }
  }
  return out
})

function openGiven(a: AiAttachment): void {
  if ((a.kind === 'link' || a.kind === 'calendar') && a.url) {
    window.open(a.url.replace(/^webcal:/i, 'https:'), '_blank', 'noopener')
    return
  }
  if (a.kind === 'moodle' && a.subject_id) {
    emit('navigate')
    void navigateTo(`/app/courses/${a.subject_id}`)
    return
  }
  if (a.item_id) void open({ kind: 'item', id: a.item_id, label: a.label })
}

async function open(cite: AiCitation): Promise<void> {
  const target = citationTarget(store, cite)
  if (!target) {
    toast.info({ title: cite.label, body: 'That source isn\'t on this device yet.' })
    return
  }
  if ('href' in target) {
    window.open(target.href, '_blank', 'noopener')
    return
  }
  if ('item' in target) {
    const tab = window.open('', '_blank')
    const url = target.item.kind === 'link' ? target.item.meta.url ?? null : await fetchFileUrl(target.item)
    if (url && tab) tab.location.href = url
    else tab?.close()
    return
  }
  if (!ai.wide.value) ai.hide()
  emit('navigate')
  await navigateTo(target.to)
}

const row =
  'flex w-full cursor-pointer items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-left transition-colors hover:bg-surface-sunken focus-visible:bg-surface-sunken'
</script>

<template>
  <div class="grid gap-6">
    <section aria-labelledby="ai-src-from">
      <h3
        id="ai-src-from"
        class="px-2.5 pb-1.5 text-[12px] font-semibold text-text-muted"
      >
        Answers from
      </h3>
      <ul class="grid gap-px">
        <li>
          <button
            type="button"
            :class="row"
            role="switch"
            :aria-checked="source === null"
            @click="source = null"
          >
            <span class="grid size-7 shrink-0 place-items-center rounded-[9px] bg-surface-sunken text-text-soft">
              <UiIcon
                name="layers"
                :size="14"
              />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[13px] font-semibold text-text">All your courses</span>
              <span class="block truncate text-[12px] text-text-muted">{{ totals }}</span>
            </span>
            <UiIcon
              v-if="source === null"
              name="check"
              :size="15"
              :stroke="2"
              class="shrink-0 text-cobalt"
            />
          </button>
        </li>
        <li
          v-for="c in courses"
          :key="c.subject.id"
        >
          <button
            type="button"
            :class="row"
            role="switch"
            :aria-checked="source === c.subject.id"
            :title="source === c.subject.id ? 'Back to all your courses' : `Answer only from ${c.subject.title}`"
            @click="toggle(c.subject.id)"
          >
            <span class="grid size-7 shrink-0 place-items-center rounded-[9px] bg-surface-sunken">
              <i
                class="size-2.5 rounded-full"
                :style="{ background: courseColor(c.subject.color) }"
              />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[13px] font-semibold text-text">{{ c.subject.title }}</span>
              <span class="block truncate text-[12px] text-text-muted">{{ c.sub }}</span>
            </span>
            <!-- A switch, drawn small: on means "only this one". -->
            <span
              :class="[
                'relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors duration-150',
                source === c.subject.id ? 'bg-ink' : 'bg-surface-track',
              ]"
              aria-hidden="true"
            >
              <span
                :class="[
                  'absolute top-[2px] size-[14px] rounded-full bg-surface shadow-card transition-[left] duration-150',
                  source === c.subject.id ? 'left-[14px]' : 'left-[2px]',
                ]"
              />
            </span>
          </button>
        </li>
      </ul>
    </section>

    <section
      v-if="given.length"
      aria-labelledby="ai-src-given"
    >
      <h3
        id="ai-src-given"
        class="px-2.5 pb-1.5 text-[12px] font-semibold text-text-muted"
      >
        Added to this chat
      </h3>
      <ul class="grid gap-px">
        <li
          v-for="a in given"
          :key="`${a.kind}:${a.item_id ?? a.url ?? a.subject_id ?? a.label}`"
        >
          <button
            v-if="a.kind !== 'text'"
            type="button"
            :class="row"
            :title="a.url ?? a.label"
            @click="openGiven(a)"
          >
            <CompanionIcon
              :name="attachmentLook(a).icon"
              :size="14"
              :class="['shrink-0', attachmentLook(a).tone]"
            />
            <span class="min-w-0 flex-1 truncate text-[13px] text-text-body">{{ a.label }}</span>
          </button>
          <span
            v-else
            :class="[row, 'cursor-default hover:bg-transparent']"
          >
            <CompanionIcon
              name="paste"
              :size="14"
              class="shrink-0 text-text-faint"
            />
            <span class="min-w-0 flex-1 truncate text-[13px] text-text-body">{{ a.label }}</span>
          </span>
        </li>
      </ul>
    </section>

    <section aria-labelledby="ai-src-read">
      <h3
        id="ai-src-read"
        class="px-2.5 pb-1.5 text-[12px] font-semibold text-text-muted"
      >
        Read in this chat
      </h3>
      <p
        v-if="!read.length"
        class="px-2.5 text-[12.5px] leading-[1.5] text-text-faint"
      >
        Every slide, page and lesson an answer leans on shows up here, so you can open it.
      </p>
      <ul
        v-else
        class="grid gap-px"
      >
        <li
          v-for="c in read"
          :key="`${c.kind}:${c.id}`"
        >
          <button
            type="button"
            :class="row"
            :title="c.quote ? `“${c.quote}”` : c.label"
            @click="open(c)"
          >
            <CompanionIcon
              :name="citationIcon(store, c)"
              :size="14"
              class="shrink-0 text-text-faint"
            />
            <span class="min-w-0 flex-1 truncate text-[13px] text-text-body">{{ c.label }}</span>
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>
