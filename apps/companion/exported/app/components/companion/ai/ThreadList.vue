<script setup lang="ts">
/**
 * Past chats, newest first, grouped the way a person looks for one ("that
 * thing I asked yesterday"): Today, This week, Earlier. ChatGPT's list,
 * drawn in three places:
 *
 *   <CompanionAiThreadList variant="sidebar" />   the app sidebar's Chats
 *   <CompanionAiThreadList compact @open="…" />    the dock's history popover
 *   <CompanionAiThreadList searchable />           anywhere a search box helps
 *
 * In the sidebar a row is a link to the chat's own address
 * (`/app/chat/<id>`), so it opens in a new tab with ⌘-click like any link;
 * in the dock it opens the chat in place (`open`), since the dock is the
 * same conversation beside the page.
 *
 * Each row says what it is at a glance: the chat open now is lit, one that
 * is answering right now breathes a dot, and one that drafted a course
 * carries the course cap. On hover (always, on a phone) a ⋯ offers Rename,
 * which turns the row into its own field (Enter saves, Esc doesn't), and
 * Delete, which asks nothing because the toast that follows has Undo.
 */
import { chatPath } from '~/companion/ai/routes'
import { groupThreads, useAiThread } from '~/companion/ai/thread'
import type { AiThread } from '~/companion/ai/types'
import { useCompanion } from '~/companion/store'
import { courseColor } from '~/companion/colors'
import { relativeDay, dayKey, clock } from '~/companion/time'
import type { MenuAction } from '~/components/ui/Menu.vue'

const props = withDefaults(
  defineProps<{
    variant?: 'list' | 'sidebar'
    searchable?: boolean
    compact?: boolean
  }>(),
  { variant: 'list' },
)

const emit = defineEmits<{
  open: [id: string]
  /** A row was followed (sidebar): a drawer around the list can close. */
  navigate: []
}>()

const t = useAiThread()
const store = useCompanion()
const query = ref('')
const Link = resolveComponent('NuxtLink')

onMounted(() => {
  if (!t.threadsState.loaded) void t.refreshThreads()
})

const groups = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = q ? t.threads.value.filter((x) => x.title.toLowerCase().includes(q)) : t.threads.value
  return groupThreads(list)
})

const sidebar = computed(() => props.variant === 'sidebar')

function when(iso: string): string {
  const key = dayKey(iso)
  const rel = relativeDay(key)
  return rel === 'today' ? clock(iso) : rel
}

function dot(subjectId: string | null): string | null {
  const s = subjectId ? store.get('subjects', subjectId) : null
  return s ? courseColor(s.color) : null
}

function answering(thread: AiThread): boolean {
  return t.busy.value && t.threadId.value === thread.id
}

/* -- Rename, in place ----------------------------------------------------------- */

const renaming = ref<string | null>(null)
const name = ref('')
const field = ref<HTMLInputElement[] | HTMLInputElement | null>(null)

function startRename(thread: AiThread): void {
  renaming.value = thread.id
  name.value = thread.title
  void nextTick(() => {
    const el = Array.isArray(field.value) ? field.value[0] : field.value
    el?.focus()
    el?.select()
  })
}

function saveRename(): void {
  const id = renaming.value
  renaming.value = null
  if (id && name.value.trim()) void t.renameThread(id, name.value)
}

function menu(thread: AiThread): MenuAction[] {
  return [
    { label: 'Rename', icon: 'pencil', run: () => startRename(thread) },
    { label: 'Delete', icon: 'trash', destructive: true, run: () => t.removeThread(thread.id) },
  ]
}

function follow(thread: AiThread): void {
  if (sidebar.value) emit('navigate')
  else emit('open', thread.id)
}

const rowClass = (thread: AiThread) => [
  'flex w-full cursor-pointer items-center gap-2 rounded-[10px] py-2 pr-10 pl-2.5 text-left transition-colors duration-150 outline-none',
  props.compact ? 'min-h-9' : 'min-h-10 max-lg:min-h-11',
  thread.id === t.threadId.value
    ? 'bg-surface-sunken text-text'
    : 'text-text-body hover:bg-surface-sunken hover:text-text focus-visible:bg-surface-sunken focus-visible:text-text',
]
</script>

<template>
  <div class="flex min-h-0 flex-col">
    <label
      v-if="searchable"
      class="mx-1 mb-2 flex h-9 items-center gap-2 rounded-[10px] bg-surface-sunken px-2.5 text-text-faint focus-within:shadow-[inset_0_0_0_1.5px_var(--brand-line)]"
    >
      <UiIcon
        name="search"
        :size="14"
      />
      <input
        v-model="query"
        type="search"
        placeholder="Search your chats"
        aria-label="Search your chats"
        class="min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-text-faint"
      >
    </label>

    <div
      v-if="t.threadsState.loading && !t.threadsState.loaded"
      class="grid gap-2.5 px-2.5 py-1.5"
      aria-busy="true"
      aria-label="Loading your chats"
    >
      <span
        v-for="i in 4"
        :key="i"
        class="cp-skel h-3.5"
        :style="{ width: `${88 - i * 9}%` }"
      />
    </div>

    <div
      v-else-if="t.threadsState.error && !t.threads.value.length"
      class="px-2.5 py-2 text-[13px] text-text-muted"
    >
      {{ t.threadsState.error }}
      <button
        type="button"
        class="ml-1 cursor-pointer font-semibold text-brand underline-offset-4 hover:underline"
        @click="t.refreshThreads()"
      >
        Try again
      </button>
    </div>

    <p
      v-else-if="!groups.length"
      class="px-2.5 py-2 text-[13px] leading-[1.5] text-text-muted"
    >
      {{ query ? 'No chat has those words in its title.' : 'No chats yet. Ask something, or make a course, and it\'s kept here.' }}
    </p>

    <div
      v-else
      class="grid grid-cols-[minmax(0,1fr)] gap-3"
    >
      <section
        v-for="group in groups"
        :key="group.label"
        :aria-label="group.label"
      >
        <h3 class="px-2.5 pb-1 text-[11.5px] font-medium text-text-faint">
          {{ group.label }}
        </h3>
        <ul class="grid grid-cols-[minmax(0,1fr)] gap-px">
          <li
            v-for="thread in group.threads"
            :key="thread.id"
            class="group/row relative"
          >
            <!-- Renaming: the row is its own field. -->
            <form
              v-if="renaming === thread.id"
              class="flex min-h-10 items-center rounded-[10px] bg-surface px-1 shadow-[inset_0_0_0_1.5px_var(--brand-line)]"
              @submit.prevent="saveRename"
            >
              <input
                ref="field"
                v-model="name"
                type="text"
                maxlength="120"
                aria-label="Chat name"
                class="h-9 min-w-0 flex-1 bg-transparent px-1.5 text-[13px] text-text outline-none"
                @keydown.esc.prevent.stop="renaming = null"
                @blur="saveRename"
              >
            </form>

            <template v-else>
              <component
                :is="sidebar ? Link : 'button'"
                :to="sidebar ? chatPath(thread.id) : undefined"
                :type="sidebar ? undefined : 'button'"
                :class="rowClass(thread)"
                :aria-current="thread.id === t.threadId.value ? 'page' : undefined"
                :title="thread.title || 'Untitled chat'"
                @click="follow(thread)"
              >
                <span
                  v-if="answering(thread)"
                  class="size-2 shrink-0 animate-pulse-dot rounded-full bg-accent-strong"
                  aria-label="Answering"
                />
                <i
                  v-else-if="dot(thread.subject_id)"
                  class="size-2 shrink-0 rounded-full"
                  :style="{ background: dot(thread.subject_id)! }"
                />
                <span class="min-w-0 flex-1 truncate text-[13px]">{{ thread.title || 'Untitled chat' }}</span>
                <CompanionIcon
                  v-if="thread.has_proposal"
                  name="cap"
                  :size="13"
                  class="shrink-0 text-text-faint"
                  aria-label="Drafted a course"
                />
                <span
                  v-if="!sidebar"
                  class="num shrink-0 text-[11.5px] text-text-faint transition-opacity group-hover/row:opacity-0 max-lg:hidden"
                >{{ when(thread.updated_at) }}</span>
              </component>
              <div class="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 transition-opacity duration-150 group-focus-within/row:opacity-100 group-hover/row:opacity-100 has-[[aria-expanded=true]]:opacity-100 max-lg:opacity-100">
                <UiMenu
                  float
                  :actions="menu(thread)"
                  :label="`More for “${thread.title || 'Untitled chat'}”`"
                  :title="thread.title || 'Untitled chat'"
                />
              </div>
            </template>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
