<script setup lang="ts">
import type { Item, Subject } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { dayKey, shortDate, untilLabel } from '~/companion/time'

/**
 * A course's notes and whiteboards, as a view of its home (`?tab=notes`): a
 * tidy grid of cards, each with its first lines (or, for a board, what is on
 * it) so the right one is recognised before it is opened. Cards are grouped
 * by what they were written for, the way a learner remembers them: the class
 * ("Lecture 8 · Transactions"), else the topic, else "Other notes"; the group
 * worked in most recently comes first.
 *
 * The two ways to start one sit in the heading, and both land in this course,
 * filed where the learner is in it (the course page decides: the class on
 * now, the lesson open). Beside them, "Add notes…" brings in notes made
 * elsewhere: notes start in My notes and only come into a course when the
 * learner says so (`CompanionCourseAddNotes`).
 */
const props = defineProps<{
  subject: Subject
  openItemIds: string[]
}>()

const emit = defineEmits<{
  openItem: [item: Item]
  newNote: []
  newBoard: []
}>()

const c = useCompanion()
const openSet = computed(() => new Set(props.openItemIds))

const own = computed(() =>
  c.items.value.filter((i) => i.subject_id === props.subject.id && (i.kind === 'page' || i.kind === 'board')),
)

function touched(i: Item): number {
  return Date.parse(i.updated_at ?? i.created_at ?? '') || 0
}

interface Group {
  key: string
  label: string
  sub: string
  items: Item[]
  latest: number
}

const groups = computed<Group[]>(() => {
  const map = new Map<string, Group>()
  for (const item of own.value) {
    const session = c.get('sessions', item.session_id)
    const topic = c.get('topics', item.topic_id ?? session?.topic_id)
    let key = 'other'
    let label = 'Other notes'
    let sub = ''
    if (session) {
      key = `class:${session.id}`
      label = topic ? `${session.title} · ${topic.title}` : session.title
      sub = shortDate(dayKey(session.starts_at))
    } else if (topic) {
      key = `topic:${topic.id}`
      label = topic.title
    }
    const group = map.get(key) ?? { key, label, sub, items: [], latest: 0 }
    group.items.push(item)
    group.latest = Math.max(group.latest, touched(item))
    map.set(key, group)
  }
  for (const g of map.values()) g.items.sort((a, b) => Number(b.pinned) - Number(a.pinned) || touched(b) - touched(a))
  // "Other notes" last whatever its age: it is the drawer, not a class.
  return [...map.values()].sort((a, b) => Number(a.key === 'other') - Number(b.key === 'other') || b.latest - a.latest)
})

function edited(i: Item): string {
  const at = i.updated_at ?? i.created_at
  if (!at || Date.parse(at) > Date.now()) return ''
  return `Edited ${untilLabel(at)}`
}
</script>

<template>
  <div class="mx-auto grid w-full max-w-[1040px] content-start gap-8 px-4 pt-6 pb-20 min-[900px]:px-8">
    <header class="flex flex-wrap items-center gap-3">
      <div class="grid min-w-0 flex-1 gap-0.5">
        <h2 class="t-head text-[19px]">
          Notes & whiteboards
        </h2>
        <p class="text-[14px] text-text-muted">
          {{ own.length ? `${own.length} in this course, by the class or topic they were written for.` : 'Pages and whiteboards for this course, by the class they were written for.' }}
        </p>
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <CompanionCourseAddNotes :subject="subject" />
        <UiBtn
          variant="secondary"
          size="md"
          icon="plus"
          :title="`New whiteboard in ${subject.title}`"
          @click="emit('newBoard')"
        >
          Whiteboard
        </UiBtn>
        <UiBtn
          variant="primary"
          size="md"
          icon="plus"
          :title="`New page in ${subject.title}`"
          @click="emit('newNote')"
        >
          Page
        </UiBtn>
      </div>
    </header>

    <section
      v-for="g in groups"
      :key="g.key"
      :aria-label="g.label"
      class="grid gap-3"
    >
      <h3 class="flex items-baseline gap-2 text-[14px] font-semibold text-text-soft">
        <span class="min-w-0 truncate">{{ g.label }}</span>
        <span
          v-if="g.sub"
          class="shrink-0 font-normal text-text-faint"
        >{{ g.sub }}</span>
      </h3>
      <ul class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        <li
          v-for="i in g.items"
          :key="i.id"
        >
          <button
            type="button"
            class="group relative flex h-[168px] w-full cursor-pointer flex-col overflow-hidden rounded-[16px] bg-surface text-left shadow-[inset_0_0_0_1px_var(--border)] transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-[inset_0_0_0_1px_var(--border-strong),0_10px_24px_-14px_rgb(11_13_16/0.3)] focus-visible:outline-2 focus-visible:outline-cobalt"
            @click="emit('openItem', i)"
          >
            <!-- A board's card is a little sheet of dotted paper; a page's is plain. -->
            <span
              :class="[
                'relative min-h-0 flex-1 overflow-hidden px-4 pt-3.5',
                i.kind === 'board' && 'bg-surface-sunken bg-[radial-gradient(circle,rgb(11_13_16/0.12)_1px,transparent_1.2px)] bg-[length:14px_14px]',
              ]"
            >
              <span class="flex items-center gap-1.5 text-[12px] font-medium text-text-muted">
                <CompanionIcon
                  :name="i.kind === 'board' ? 'board' : 'page'"
                  :size="13"
                />
                {{ i.kind === 'board' ? 'Whiteboard' : 'Page' }}
                <span
                  v-if="openSet.has(i.id)"
                  class="ml-auto rounded-full bg-accent-soft px-1.5 text-[11px] font-semibold text-accent-strong"
                >Open</span>
                <UiIcon
                  v-else-if="i.pinned"
                  name="target"
                  :size="12"
                  class="ml-auto text-text-faint"
                />
              </span>
              <span class="mt-2 line-clamp-2 block font-display text-[15.5px] leading-snug font-semibold tracking-[-0.01em] text-text">{{ i.title || 'Untitled' }}</span>
              <span
                v-if="i.preview"
                class="mt-1.5 line-clamp-3 block text-[13px] leading-[1.45] text-text-muted"
              >{{ i.preview }}</span>
              <span
                v-else
                class="mt-1.5 block text-[13px] text-text-faint italic"
              >Empty so far</span>
            </span>
            <span class="flex h-9 shrink-0 items-center border-t border-border-rule px-4 text-[12px] text-text-faint">
              <span class="truncate">{{ edited(i) }}</span>
              <UiIcon
                name="arrow-right"
                :size="13"
                class="ml-auto shrink-0 opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0.5 group-hover:opacity-100"
              />
            </span>
          </button>
        </li>
      </ul>
    </section>

    <section
      v-if="!own.length"
      class="grid justify-items-center gap-3 rounded-[20px] bg-surface-sunken px-6 py-14 text-center"
    >
      <span class="grid size-12 place-items-center rounded-full bg-lime text-ink">
        <CompanionIcon
          name="page"
          :size="20"
        />
      </span>
      <h3 class="t-head text-[19px]">
        No notes in {{ subject.title }} yet
      </h3>
      <p class="max-w-[460px] text-[15px] text-text-body">
        A page made here is filed under the class you're in, or the lesson you have open, so it's
        where you'll look for it before the exam. Notes made elsewhere wait in My notes until you
        add them.
      </p>
      <UiBtn
        variant="primary"
        size="md"
        icon="plus"
        @click="emit('newNote')"
      >
        New page in {{ subject.title }}
      </UiBtn>
      <p class="text-[13.5px] text-text-muted">
        Or
        <CompanionCourseAddNotes
          :subject="subject"
          look="link"
          label="add notes you already have"
        />
      </p>
    </section>
  </div>
</template>
