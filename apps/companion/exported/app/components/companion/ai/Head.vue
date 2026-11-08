<script setup lang="ts">
/**
 * The top of the companion wherever it opens (dock, drawer, phone sheet):
 * who it is, and which chat this is.
 *
 * The first line is the identity, Bili itself (thinking while it answers,
 * happy for a moment when it is done), its name and the chat's under it, then four quiet tools: past chats, a new
 * chat, full screen (the chat page, `/app/chat/<id>`, carrying this chat)
 * and close.
 *
 * What it reads is the composer's "Reads" chip (`ScopePick`), not a row here:
 * the head stays the identity, and the choice sits where the question is typed.
 */
import { useAi } from '~/companion/ai/state'
import { useAiThread } from '~/companion/ai/thread'
import { chatPath } from '~/companion/ai/routes'

withDefaults(defineProps<{ mode?: 'dock' | 'drawer' | 'sheet' }>(), { mode: 'dock' })

const ai = useAi()
const t = useAiThread()

/* -- Past chats ---------------------------------------------------------- */

const menu = ref<'history' | null>(null)
const root = ref<HTMLElement | null>(null)

function toggleMenu(which: 'history'): void {
  menu.value = menu.value === which ? null : which
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

/** Thinking while it answers, a smile when it finishes, then back to rest. */
const mood = ref<'idle' | 'think' | 'happy'>('idle')
let moodT: ReturnType<typeof setTimeout> | undefined
watch(
  () => t.busy.value,
  (busy, was) => {
    clearTimeout(moodT)
    if (busy) mood.value = 'think'
    else if (was) {
      mood.value = 'happy'
      moodT = setTimeout(() => (mood.value = 'idle'), 1400)
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => clearTimeout(moodT))

const iconBtn =
  'grid size-8 cursor-pointer place-items-center rounded-[9px] text-text-muted transition-colors hover:bg-surface-sunken hover:text-text focus-visible:bg-surface-sunken disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent max-lg:size-10'
</script>

<template>
  <div
    ref="root"
    class="relative shrink-0"
    @keydown="onKeydown"
  >
    <div class="flex h-[50px] items-center gap-1 border-b border-border pr-2 pl-3">
      <CompanionAiBilim
        :size="26"
        :mood="mood"
      />
      <div class="ml-1.5 min-w-0 flex-1 leading-[1.2]">
        <h2 class="truncate text-[13.5px] font-bold text-text">
          Bili
        </h2>
        <p class="truncate text-[12px] text-text-muted">
          {{ t.title.value || 'New chat' }}
        </p>
      </div>

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
        aria-label="Close Bili"
        @click="ai.hide()"
      >
        <UiIcon
          :name="mode === 'sheet' ? 'chevron-down' : 'x'"
          :size="mode === 'sheet' ? 18 : 15"
          :stroke="2"
        />
      </button>
    </div>

    <!-- History -->
    <div
      v-if="menu === 'history'"
      class="pop-in absolute top-[46px] right-2 z-30 flex max-h-[min(440px,70vh)] w-[312px] max-w-[calc(100%-16px)] flex-col rounded-[15px] bg-surface p-1.5 shadow-pop"
    >
      <div class="flex items-center justify-between px-2 pt-1 pb-2">
        <span class="text-[13px] font-semibold text-text">Past chats</span>
        <NuxtLink
          :to="chatPath(t.threadId.value)"
          class="text-[12px] font-semibold text-brand underline-offset-4 hover:underline"
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
