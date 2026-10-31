<script setup lang="ts">
/**
 * The top of the companion wherever it opens (dock, drawer, phone sheet):
 * who it is, and what it can see.
 *
 * The first line is the identity, the old assistant's lime spark and "Ask
 * BiliMind", then four quiet tools: a new chat, past chats, full screen
 * (the chat page, `/app/chat/<id>`, carrying this chat) and close.
 *
 * The second line is the scope, said as a chip: "Lesson · SQL joins",
 * "Databases", "All your courses". It is a chip rather than a three-way
 * switch because what it names matters more than the switch: a 360px panel
 * can show "Lecture 8 · Transactions" or three tiny tabs, not both. Pressed,
 * it opens the three groundings (This · Course · Everything), each with a
 * line on what that means.
 */
import { useAi } from '~/companion/ai/state'
import { useAiThread } from '~/companion/ai/thread'
import { chatPath } from '~/companion/ai/routes'
import type { AiScope } from '~/companion/ai/types'
import { useCompanion } from '~/companion/store'
import { courseColor } from '~/companion/colors'

withDefaults(defineProps<{ mode?: 'dock' | 'drawer' | 'sheet' }>(), { mode: 'dock' })

const ai = useAi()
const t = useAiThread()
const store = useCompanion()

const ctx = computed(() => ai.context.value)
const subject = computed(() => (ctx.value.subjectId ? store.get('subjects', ctx.value.subjectId) : null))

const KIND: Record<string, { word: string; icon: string }> = {
  lesson: { word: 'Lesson', icon: 'book' },
  page: { word: 'Page', icon: 'page' },
  board: { word: 'Whiteboard', icon: 'board' },
  deadline: { word: 'Deadline', icon: 'flag' },
}

interface ScopeRow {
  value: AiScope
  title: string
  sub: string
  icon: string
  color: string | null
}

const rows = computed<ScopeRow[]>(() =>
  t.scopes.value.map((value) => {
    if (value === 'here') {
      const k = KIND[ctx.value.kind] ?? { word: 'This', icon: 'file' }
      return { value, title: `This ${k.word.toLowerCase()}`, sub: ctx.value.label, icon: k.icon, color: null }
    }
    if (value === 'course') {
      return {
        value,
        title: subject.value?.title ?? 'This course',
        sub: 'The whole course: classes, slides, notes, cards',
        icon: 'notebook',
        color: subject.value ? courseColor(subject.value.color) : null,
      }
    }
    return { value, title: 'Everything', sub: 'All your courses, notes and deadlines', icon: 'layers', color: null }
  }),
)

const chip = computed(() => {
  const scope = t.scope.value
  if (scope === 'here') {
    const k = KIND[ctx.value.kind] ?? { word: 'This', icon: 'file' }
    return { icon: k.icon, text: `${k.word} · ${ctx.value.label}`, color: null as string | null }
  }
  if (scope === 'course' && subject.value) {
    return { icon: null, text: subject.value.title, color: courseColor(subject.value.color) }
  }
  return { icon: 'layers', text: 'All your courses', color: null as string | null }
})

/* -- The two popovers ---------------------------------------------------------- */

const menu = ref<'scope' | 'history' | null>(null)
const root = ref<HTMLElement | null>(null)

function toggleMenu(which: 'scope' | 'history'): void {
  menu.value = menu.value === which ? null : which
}

function pickScope(value: AiScope): void {
  t.scope.value = value
  menu.value = null
}

function openThread(id: string): void {
  menu.value = null
  void t.load(id)
}

function onPointerDown(event: PointerEvent): void {
  // A chat row's ⋯ menu floats outside the popover (UiMenu `float`); pressing in it isn't a click away.
  if ((event.target as HTMLElement | null)?.closest?.('[role="menu"]')) return
  if (menu.value && !root.value?.contains(event.target as Node)) menu.value = null
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && menu.value) {
    // The menu closes; the drawer around it stays.
    event.stopPropagation()
    menu.value = null
  }
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown, true))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown, true))

function fresh(): void {
  menu.value = null
  t.reset()
}

/**
 * Off to the chat page. A drawer or sheet closes behind; a dock is left as
 * it is, because whether it is open is the learner's standing choice and
 * the chat page hides it anyway.
 */
function leave(): void {
  menu.value = null
  ai.overlay.value = false
}

async function fullScreen(): Promise<void> {
  const id = t.threadId.value
  leave()
  await navigateTo(chatPath(id))
}

const iconBtn =
  'grid size-8 cursor-pointer place-items-center rounded-[9px] text-text-faint transition-colors hover:bg-surface-sunken hover:text-text focus-visible:bg-surface-sunken disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent max-lg:size-10'
</script>

<template>
  <div
    ref="root"
    class="relative shrink-0"
    @keydown="onKeydown"
  >
    <div class="flex h-[52px] items-center gap-1 pr-2 pl-4">
      <span class="grid size-[26px] place-items-center rounded-full bg-accent text-on-accent">
        <UiIcon
          name="spark"
          :size="13"
        />
      </span>
      <h2 class="ml-1.5 font-display text-[15px] font-semibold tracking-[-0.01em] text-text">
        Ask BiliMind
      </h2>
      <span class="flex-1" />

      <button
        type="button"
        :class="iconBtn"
        :disabled="!t.messages.value.length"
        title="New chat"
        aria-label="New chat"
        @click="fresh"
      >
        <UiIcon
          name="plus"
          :size="16"
        />
      </button>
      <button
        type="button"
        :class="[iconBtn, menu === 'history' && 'bg-surface-sunken text-text']"
        title="Past chats"
        aria-label="Past chats"
        :aria-expanded="menu === 'history'"
        @click="toggleMenu('history')"
      >
        <UiIcon
          name="clock"
          :size="16"
        />
      </button>
      <button
        v-if="mode !== 'sheet'"
        type="button"
        :class="iconBtn"
        title="Open full screen"
        aria-label="Open full screen"
        @click="fullScreen"
      >
        <UiIcon
          name="pop-out"
          :size="15"
        />
      </button>
      <button
        type="button"
        :class="iconBtn"
        :title="mode === 'dock' ? 'Close (⌘J)' : 'Close (Esc)'"
        aria-label="Close Ask BiliMind"
        @click="ai.hide()"
      >
        <UiIcon
          :name="mode === 'sheet' ? 'chevron-down' : 'x'"
          :size="mode === 'sheet' ? 18 : 15"
          :stroke="2"
        />
      </button>
    </div>

    <!-- What it can see, and the way to widen or narrow it. -->
    <div class="px-3 pb-2">
      <button
        type="button"
        :class="[
          'inline-flex h-8 max-w-full items-center gap-1.5 rounded-full pr-2.5 pl-2.5 text-[12.5px] font-medium text-text-body transition-colors',
          rows.length > 1 ? 'cursor-pointer bg-surface-sunken hover:bg-surface-track focus-visible:bg-surface-track' : 'cursor-default bg-surface-sunken',
          menu === 'scope' && 'bg-surface-track',
        ]"
        :aria-expanded="rows.length > 1 ? menu === 'scope' : undefined"
        aria-haspopup="listbox"
        :title="rows.length > 1 ? 'What it answers from' : undefined"
        @click="rows.length > 1 && toggleMenu('scope')"
      >
        <i
          v-if="chip.color"
          class="size-2 shrink-0 rounded-full"
          :style="{ background: chip.color }"
        />
        <CompanionIcon
          v-else-if="chip.icon"
          :name="chip.icon"
          :size="13"
          class="shrink-0 text-text-faint"
        />
        <span class="truncate">{{ chip.text }}</span>
        <UiIcon
          v-if="rows.length > 1"
          name="chevron-down"
          :size="13"
          :stroke="2"
          :class="['shrink-0 text-text-faint transition-transform duration-150', menu === 'scope' && 'rotate-180']"
        />
      </button>
    </div>

    <!-- Scope -->
    <div
      v-if="menu === 'scope'"
      class="pop-in absolute top-[92px] left-3 z-30 w-[288px] max-w-[calc(100%-24px)] rounded-[16px] bg-surface p-1.5 shadow-pop ring-1 ring-border"
      role="listbox"
      aria-label="What it answers from"
    >
      <button
        v-for="row in rows"
        :key="row.value"
        type="button"
        role="option"
        :aria-selected="t.scope.value === row.value"
        class="flex w-full cursor-pointer items-start gap-2.5 rounded-[11px] px-2.5 py-2 text-left transition-colors hover:bg-surface-sunken focus-visible:bg-surface-sunken"
        @click="pickScope(row.value)"
      >
        <span class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-[8px] bg-surface-sunken text-text-soft">
          <i
            v-if="row.color"
            class="size-2.5 rounded-full"
            :style="{ background: row.color }"
          />
          <CompanionIcon
            v-else
            :name="row.icon"
            :size="13"
          />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-[13px] font-semibold text-text">{{ row.title }}</span>
          <span class="block truncate text-[12px] text-text-muted">{{ row.sub }}</span>
        </span>
        <UiIcon
          v-if="t.scope.value === row.value"
          name="check"
          :size="15"
          :stroke="2"
          class="mt-1 shrink-0 text-cobalt"
        />
      </button>
    </div>

    <!-- History -->
    <div
      v-if="menu === 'history'"
      class="pop-in absolute top-[48px] right-2 z-30 flex max-h-[min(440px,70vh)] w-[312px] max-w-[calc(100%-16px)] flex-col rounded-[16px] bg-surface p-1.5 shadow-pop ring-1 ring-border"
    >
      <div class="flex items-center justify-between px-2 pt-1 pb-2">
        <span class="text-[13px] font-semibold text-text">Past chats</span>
        <NuxtLink
          :to="chatPath(t.threadId.value)"
          class="text-[12px] font-semibold text-cobalt underline-offset-4 hover:underline"
          @click="leave"
        >
          Open full screen
        </NuxtLink>
      </div>
      <CompanionAiThreadList
        compact
        class="om-scroll min-h-0 overflow-y-auto"
        @open="openThread"
      />
    </div>
  </div>
</template>
