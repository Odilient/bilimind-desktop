<script setup lang="ts">
/**
 * "Recent", under a new chat's box: the way back into what the learner was
 * doing, in three tabs, Chats, Courses and Notes.
 * recent projects under its own box. A search over the tab's names, and a
 * list or a grid.
 *
 * A row is a small picture (a chat glyph, the course's own cover, a note's
 * kind), the name, when it last changed, the course it belongs to, and a ⋯
 * with what makes sense from here: a course can be asked about (it becomes
 * what the chat answers from), a note can be attached to the message, a
 * chat deleted. About eight rows, then "Show all", which opens the tab's
 * own place (Courses, Notes) or the rest of the chats in place.
 *
 * "When it last changed" is honest about what is known: the app keeps when
 * a thing was updated, not when it was looked at.
 */
import type { MenuAction } from '~/components/ui/Menu.vue'
import type { Item, Subject } from '~/companion/types'
import { chatPath } from '~/companion/ai/routes'
import { itemRoute } from '~/companion/ai/links'
import { useAiThread } from '~/companion/ai/thread'
import { useAiAttachments } from '~/companion/ai/attach'
import { noteIcon } from '~/companion/notes/tree'
import { useCompanion } from '~/companion/store'
import { courseColor } from '~/companion/colors'
import { clock, dayKey, relativeDay, shortDate } from '~/companion/time'

const t = useAiThread()
const tray = useAiAttachments()
const store = useCompanion()

type Tab = 'chats' | 'courses' | 'notes'
const tab = ref<string>('chats')
const view = ref<'list' | 'grid'>('list')
const query = ref('')
const all = ref(false)

const KEY = 'bm:chat-recent'
onMounted(() => {
  if (!t.threadsState.loaded) void t.refreshThreads()
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { tab?: Tab; view?: 'list' | 'grid' }
    if (kept.tab && ['chats', 'courses', 'notes'].includes(kept.tab)) tab.value = kept.tab
    if (kept.view === 'grid' || kept.view === 'list') view.value = kept.view
  } catch {
    // Nothing kept.
  }
})
watch([tab, view], () => {
  all.value = false
  try {
    localStorage.setItem(KEY, JSON.stringify({ tab: tab.value, view: view.value }))
  } catch {
    // Forgotten next time.
  }
})

const TABS = [
  { value: 'chats', label: 'Chats' },
  { value: 'courses', label: 'Courses' },
  { value: 'notes', label: 'Notes' },
]

/* -- The rows ------------------------------------------------------------------------ */

interface RecentRow {
  key: string
  kind: Tab
  name: string
  to: string
  at: string | null
  subject: Subject | null
  /** A chat's or a note's glyph; a course draws its cover instead. */
  icon: string
  actions: MenuAction[]
}

const time = (iso: string | null | undefined) => (iso ? Date.parse(iso) || 0 : 0)

/** A course's last change: its own row, or anything filed in it. */
function touched(s: Subject): string | null {
  let best = s.updated_at ?? null
  for (const i of store.items.value) {
    if (i.subject_id === s.id && time(i.updated_at) > time(best)) best = i.updated_at ?? null
  }
  return best
}

function noteTo(item: Item): string {
  return itemRoute(item) ?? `/app/notes/${item.id}`
}

const rows = computed<RecentRow[]>(() => {
  if (tab.value === 'chats') {
    return t.threads.value.map((x) => ({
      key: `c:${x.id}`,
      kind: 'chats' as const,
      name: x.title || 'Untitled chat',
      to: chatPath(x.id),
      at: x.updated_at,
      subject: x.subject_id ? store.get('subjects', x.subject_id) : null,
      icon: x.has_proposal ? 'path' : 'chat',
      actions: [
        { label: 'Open', icon: 'arrow-right', run: () => void navigateTo(chatPath(x.id)) },
        { label: 'Delete', icon: 'trash', destructive: true, run: () => t.removeThread(x.id) },
      ],
    }))
  }
  if (tab.value === 'courses') {
    return store.subjects.value
      .map((s) => ({ s, at: touched(s) }))
      .sort((a, b) => time(b.at) - time(a.at))
      .map(({ s, at }) => ({
        key: `s:${s.id}`,
        kind: 'courses' as const,
        name: s.title,
        to: `/app/courses/${s.id}`,
        at,
        subject: s,
        icon: 'notebook',
        actions: [
          { label: 'Open', icon: 'arrow-right', run: () => void navigateTo(`/app/courses/${s.id}`) },
          {
            label: 'Ask about this course',
            icon: 'chat',
            run: () => {
              t.answersFrom.value = s.id
              t.focus()
            },
          },
        ],
      }))
  }
  return store.items.value
    .filter((i) => !i.parent_id)
    .sort((a, b) => time(b.updated_at) - time(a.updated_at))
    .map((i) => ({
      key: `n:${i.id}`,
      kind: 'notes' as const,
      name: i.title || 'Untitled',
      to: noteTo(i),
      at: i.updated_at ?? null,
      subject: i.subject_id ? store.get('subjects', i.subject_id) : null,
      icon: noteIcon(i),
      actions: [
        { label: 'Open', icon: 'arrow-right', run: () => void navigateTo(noteTo(i)) },
        {
          label: 'Attach to the message',
          icon: 'plus',
          run: () => {
            tray.addNotes([i.id])
            t.focus()
          },
        },
      ],
    }))
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? rows.value.filter((r) => r.name.toLowerCase().includes(q) || r.subject?.title.toLowerCase().includes(q)) : rows.value
})

const LIMIT = 8
const shown = computed(() => (all.value ? filtered.value.slice(0, 40) : filtered.value.slice(0, LIMIT)))
const more = computed(() => filtered.value.length > LIMIT && !all.value)

function when(iso: string | null): string {
  if (!iso) return ''
  const key = dayKey(iso)
  const rel = relativeDay(key)
  if (rel === 'today') return `Today, ${clock(iso)}`
  if (rel === 'yesterday') return 'Yesterday'
  return shortDate(key)
}

const loading = computed(() => tab.value === 'chats' && t.threadsState.loading && !t.threadsState.loaded)

const EMPTY: Record<Tab, string> = {
  chats: 'No chats yet. What you ask is kept here, a tap from carrying on.',
  courses: 'No courses yet. Pick "Course" above and say what you want to learn.',
  notes: 'No notes yet. Pages, whiteboards and files you add show up here.',
}

const showAllTo = computed(() => (tab.value === 'courses' ? '/app/courses' : tab.value === 'notes' ? '/app/notes' : null))
</script>

<template>
  <section
    class="grid grid-cols-[minmax(0,1fr)] gap-3"
    aria-labelledby="ai-recent"
  >
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h2
        id="ai-recent"
        class="font-display text-[16px] font-semibold tracking-[-0.01em] text-text"
      >
        Recent
      </h2>
      <UiSegmented
        v-model="tab"
        :options="TABS"
        size="xs"
        label="What to show"
      />
      <span class="min-w-0 flex-1" />
      <label class="flex h-9 w-[220px] items-center gap-2 rounded-[10px] bg-surface-sunken px-2.5 text-text-faint focus-within:shadow-[inset_0_0_0_1.5px_var(--brand-line)] max-sm:order-last max-sm:h-11 max-sm:w-full">
        <UiIcon
          name="search"
          :size="14"
        />
        <input
          v-model="query"
          type="search"
          :placeholder="`Search ${tab}`"
          :aria-label="`Search your ${tab}`"
          class="min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-text-faint max-sm:text-[16px]"
        >
      </label>
      <div
        class="flex items-center rounded-[10px] bg-surface-sunken p-0.5"
        role="group"
        aria-label="Show as"
      >
        <button
          v-for="v in (['list', 'grid'] as const)"
          :key="v"
          type="button"
          :class="[
            'grid size-8 cursor-pointer place-items-center rounded-[8px] transition-colors outline-none focus-visible:shadow-[inset_0_0_0_1.5px_var(--brand-line)] max-sm:size-10',
            view === v ? 'bg-surface text-text shadow-card' : 'text-text-faint hover:text-text',
          ]"
          :aria-pressed="view === v"
          :aria-label="v === 'list' ? 'List' : 'Grid'"
          :title="v === 'list' ? 'List' : 'Grid'"
          @click="view = v"
        >
          <svg
            viewBox="0 0 16 16"
            class="size-[15px]"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path
              v-if="v === 'list'"
              d="M2.5 4h11M2.5 8h11M2.5 12h11"
            />
            <path
              v-else
              d="M2.5 3.5a1 1 0 0 1 1-1h3v4.5h-4Zm6.5-1h3.5a1 1 0 0 1 1 1V7H9ZM2.5 9h4.5v4.5h-3.5a1 1 0 0 1-1-1Zm6.5 0h4.5v3.5a1 1 0 0 1-1 1H9Z"
            />
          </svg>
        </button>
      </div>
    </div>

    <div
      v-if="loading"
      class="grid gap-3 py-2"
      aria-busy="true"
      aria-label="Loading"
    >
      <span
        v-for="i in 4"
        :key="i"
        class="cp-skel h-9"
        :style="{ width: `${96 - i * 8}%` }"
      />
    </div>

    <p
      v-else-if="!filtered.length"
      class="rounded-[14px] px-3 py-6 text-center text-[13.5px] text-text-muted shadow-[inset_0_0_0_1px_var(--border-strong)]"
    >
      {{ query ? 'Nothing here has those words in its name.' : EMPTY[tab as Tab] }}
    </p>

    <!-- List -->
    <ul
      v-else-if="view === 'list'"
      class="grid grid-cols-[minmax(0,1fr)]"
    >
      <li
        v-for="r in shown"
        :key="r.key"
        class="group/r relative border-b border-border-rule last:border-b-0"
      >
        <NuxtLink
          :to="r.to"
          class="flex min-h-14 items-center gap-3 rounded-[12px] py-2 pr-12 pl-1.5 transition-colors duration-150 outline-none hover:bg-surface-sunken focus-visible:bg-surface-sunken"
        >
          <CompanionCourseCover
            v-if="r.kind === 'courses' && r.subject"
            :subject="r.subject"
            size="sm"
          />
          <span
            v-else
            class="grid size-10 shrink-0 place-items-center rounded-[12px] bg-surface-sunken text-text-soft"
            aria-hidden="true"
          >
            <CompanionIcon
              :name="r.icon"
              :size="17"
            />
          </span>
          <span class="min-w-0 flex-1 truncate text-[14px] font-medium text-text">{{ r.name }}</span>
          <span
            v-if="r.kind !== 'courses' && r.subject"
            class="inline-flex max-w-[180px] shrink-0 items-center gap-1.5 rounded-full bg-surface-sunken px-2.5 py-1 text-[12px] text-text-body max-[699px]:hidden"
          >
            <i
              class="size-2 shrink-0 rounded-full"
              :style="{ background: courseColor(r.subject.color) }"
            />
            <span class="truncate">{{ r.subject.title }}</span>
          </span>
          <span class="w-[104px] shrink-0 text-right text-[12.5px] text-text-muted max-sm:hidden">{{ when(r.at) }}</span>
        </NuxtLink>
        <div class="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 transition-opacity duration-150 group-focus-within/r:opacity-100 group-hover/r:opacity-100 has-[[aria-expanded=true]]:opacity-100 max-lg:opacity-100">
          <UiMenu
            float
            :actions="r.actions"
            :label="`More for ${r.name}`"
            :title="r.name"
          />
        </div>
      </li>
    </ul>

    <!-- Grid -->
    <ul
      v-else
      class="grid grid-cols-2 gap-2.5 min-[600px]:grid-cols-3 min-[900px]:grid-cols-4"
    >
      <li
        v-for="r in shown"
        :key="r.key"
        class="group/r relative"
      >
        <NuxtLink
          :to="r.to"
          class="grid gap-2 rounded-[14px] bg-surface p-2 shadow-[0_0_0_1px_var(--border-strong),var(--shadow-card)] transition-[background-color,box-shadow,transform] duration-200 outline-none hover:-translate-y-px hover:shadow-[0_0_0_1px_var(--border-field),var(--shadow-raised)] focus-visible:shadow-[inset_0_0_0_1.5px_var(--brand-line)]"
        >
          <span
            class="grid h-[76px] place-items-center rounded-[9px] bg-surface-sunken text-text-faint"
            :style="r.subject ? { background: `color-mix(in srgb, ${courseColor(r.subject.color)} 14%, var(--surface))` } : undefined"
            aria-hidden="true"
          >
            <CompanionCourseCover
              v-if="r.kind === 'courses' && r.subject"
              :subject="r.subject"
              size="sm"
            />
            <CompanionIcon
              v-else
              :name="r.icon"
              :size="22"
              :style="r.subject ? { color: courseColor(r.subject.color) } : undefined"
            />
          </span>
          <span class="grid min-w-0 gap-0.5 px-0.5 pr-8">
            <span class="truncate text-[13.5px] font-medium text-text">{{ r.name }}</span>
            <span class="truncate text-[12px] text-text-muted">{{ [r.kind !== 'courses' ? r.subject?.title : null, when(r.at)].filter(Boolean).join(' · ') }}</span>
          </span>
        </NuxtLink>
        <div class="absolute right-1.5 bottom-2 opacity-0 transition-opacity duration-150 group-focus-within/r:opacity-100 group-hover/r:opacity-100 has-[[aria-expanded=true]]:opacity-100 max-lg:opacity-100">
          <UiMenu
            float
            :actions="r.actions"
            :label="`More for ${r.name}`"
            :title="r.name"
          />
        </div>
      </li>
    </ul>

    <div
      v-if="more || (showAllTo && filtered.length > LIMIT)"
      class="flex justify-center"
    >
      <NuxtLink
        v-if="showAllTo"
        :to="showAllTo"
        class="inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold text-brand transition-colors hover:bg-brand-soft focus-visible:bg-brand-soft"
      >
        Show all
        <UiIcon
          name="arrow-right"
          :size="13"
          :stroke="2"
        />
      </NuxtLink>
      <button
        v-else
        type="button"
        class="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold text-brand transition-colors hover:bg-brand-soft focus-visible:bg-brand-soft"
        @click="all = true"
      >
        Show all {{ filtered.length }}
      </button>
    </div>
  </section>
</template>
