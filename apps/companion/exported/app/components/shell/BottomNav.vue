<script setup lang="ts">
const { t } = useI18n()
/**
 * The phone's navigation.
 *
 * A bottom bar rather than the top strip this used to have, for the reason
 * every phone app puts it there: the top of a 6" screen is out of thumb reach,
 * and the top is where the *content's* title belongs. It also matches the
 * course workspace, which already navigated from the bottom — so the two halves
 * of the product stop feeling like different applications.
 *
 * Four destinations, because five is where a bar starts reading as a menu, and
 * "New" is a filled accent button rather than a fifth icon: creating a course is
 * the one thing here that is an action and not a place.
 *
 * Under `/app` the four are the companion's places, Today, Courses, Notes
 * and the Calendar, the same four as the sidebar, and the middle is the
 * companion itself: the ink disc with the lime spark. It opens the assistant
 * as a sheet, grounded in the screen it was pressed on, so "explain this"
 * needs no saying what "this" is. New chat, the chats and the rest of the
 * sidebar are behind the bar's menu button, in the left drawer. On the chat
 * page, which is the assistant, and with Quiet AI on, the middle is New
 * chat instead: the chat is a place the learner chose to go, not a button
 * in their way.
 */
import { useCompanion } from '~/companion/store'
import { useAi } from '~/companion/ai/state'
import { onChatPage } from '~/companion/ai/routes'
import { onCheckPage } from '~/companion/checks'
import { useQuietAi } from '~/companion/quiet-ai'
import { startNewChat } from '~/companion/sidebar'

const route = useRoute()

const onApp = (path: string) => path === '/app' || path.startsWith('/app/')
const inApp = computed(() => onApp(route.path))

// Asking for the companion's store loads it, so only its own screens ask.
const c = onApp(route.path) ? useCompanion() : null
const ai = useAi()
const { quiet } = useQuietAi()

/** The middle is New chat where the assistant has no place: on the chat page, a check, or Quiet AI. */
const plain = computed(() => quiet.value || onChatPage(route.path) || onCheckPage(route.path))

function centre(): void {
  if (plain.value) void startNewChat()
  else ai.toggle()
}

interface Place {
  to: string
  label: string
  icon: string
  /** Waiting for a yes: a dot on the icon. */
  count?: number
  active: (path: string) => boolean
}

const OLD = computed<Place[]>(() => [
  { to: '/today', label: t('shell.today'), icon: 'home', active: (p) => p.startsWith('/today') },
  {
    to: '/library',
    label: t('shell.courses'),
    icon: 'workspace',
    active: (p) => p.startsWith('/library') || p.startsWith('/courses'),
  },
  { to: '/materials', label: t('shell.files'), icon: 'file', active: (p) => p.startsWith('/materials') },
])

const left = computed<Place[]>(() =>
  inApp.value
    ? [
        {
          to: '/app',
          label: t('shell.today'),
          icon: 'home',
          count: c?.pendingSignals.value.length ?? 0,
          active: (p) => p === '/app' || p === '/app/' || /^\/app\/(d\/|practice)/.test(p),
        },
        {
          to: '/app/courses',
          label: t('shell.courses'),
          icon: 'workspace',
          active: (p) => p.startsWith('/app/courses') && !p.startsWith('/app/courses/notebook'),
        },
      ]
    : OLD.value,
)

const right = computed<Place[]>(() =>
  inApp.value
    ? [
        {
          to: '/app/notes',
          label: t('shell.notes'),
          icon: 'notebook',
          active: (p) =>
            p.startsWith('/app/notes') ||
            p.startsWith('/app/courses/notebook') ||
            p.startsWith('/app/p/') ||
            p.startsWith('/app/b/'),
        },
        { to: '/app/calendar', label: t('shell.calendar'), icon: 'calendar', active: (p) => p.startsWith('/app/calendar') },
      ]
    : [],
)

const TAB =
  // 56px of height is the smallest that still feels like a tab bar and not
  // a toolbar, and it keeps every target well past the 44px minimum.
  'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] rounded-[12px] py-1.5 transition-colors'
</script>

<template>
  <nav
    class="flex shrink-0 items-stretch justify-around gap-1 border-t border-border bg-surface/94 px-2 pt-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom))] backdrop-blur-[14px] lg:hidden"
    :aria-label="t('shell.mainNav')"
  >
    <NuxtLink
      v-for="item in left"
      :key="item.to"
      :to="item.to"
      :aria-current="item.active(route.path) ? 'page' : undefined"
      :aria-label="item.count ? t('shell.waiting', { label: item.label, n: item.count }) : undefined"
      :class="[TAB, item.active(route.path) ? 'text-text' : 'text-text-faint']"
    >
      <!-- Cobalt's current place: a lime-soft tile behind the icon, the same
           tile the desktop rail lights. -->
      <span
        :class="[
          'relative grid h-[26px] w-[44px] place-items-center rounded-full transition-colors',
          item.active(route.path) ? 'bg-accent-soft text-accent-strong' : '',
        ]"
      >
        <CompanionIcon
          :name="item.icon"
          :size="21"
          :stroke="item.active(route.path) ? 2.1 : 1.8"
        />
        <span
          v-if="item.count"
          class="absolute top-0 right-2 size-2 rounded-full bg-rose ring-2 ring-surface"
          aria-hidden="true"
        />
      </span>
      <span
        :class="[
          'text-[10.5px] tracking-[-0.01em]',
          item.active(route.path) ? 'font-semibold' : 'font-medium',
        ]"
        >{{ item.label }}</span
      >
    </NuxtLink>

    <!-- The companion's middle: the assistant, not a page, so it lights while
         its sheet is open. Ink with the lime spark, the AI's mark everywhere. -->
    <button
      v-if="inApp"
      type="button"
      :aria-expanded="plain ? undefined : ai.visible.value"
      :aria-label="plain ? t('shell.newChat') : t('shell.askAboutScreen')"
      class="flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-[3px] py-1.5 text-text-soft transition-colors focus-visible:outline-none [&:focus-visible>span:first-child]:ring-2 [&:focus-visible>span:first-child]:ring-brand"
      @click="centre"
    >
      <span
        :class="[
          'grid h-[26px] w-[44px] place-items-center rounded-full transition-[background-color,transform] duration-150 active:scale-95',
          plain || ai.visible.value ? 'bg-accent text-on-accent' : 'bg-chip text-accent',
        ]"
      >
        <UiIcon
          :name="plain ? 'plus' : 'spark'"
          :size="plain ? 18 : 15"
          :stroke="plain ? 2.4 : 1.9"
        />
      </span>
      <span class="text-[10.5px] font-medium tracking-[-0.01em]">{{ plain ? t('shell.newChat') : t('shell.ask') }}</span>
    </button>

    <NuxtLink
      v-for="item in right"
      :key="item.to"
      :to="item.to"
      :aria-current="item.active(route.path) ? 'page' : undefined"
      :class="[TAB, item.active(route.path) ? 'text-text' : 'text-text-faint']"
    >
      <span
        :class="[
          'grid h-[26px] w-[44px] place-items-center rounded-full transition-colors',
          item.active(route.path) ? 'bg-accent-soft text-accent-strong' : '',
        ]"
      >
        <CompanionIcon
          :name="item.icon"
          :size="21"
          :stroke="item.active(route.path) ? 2.1 : 1.8"
        />
      </span>
      <span
        :class="[
          'text-[10.5px] tracking-[-0.01em]',
          item.active(route.path) ? 'font-semibold' : 'font-medium',
        ]"
        >{{ item.label }}</span
      >
    </NuxtLink>

    <NuxtLink
      v-if="!inApp"
      to="/create"
      :aria-current="route.path.startsWith('/create') ? 'page' : undefined"
      class="flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] py-1.5 text-text-faint transition-colors"
    >
      <span
        :class="[
          // Always lime. Starting a course is the app's one loud action and the
          // same ask the public page makes; making it ink until you are already
          // on /create meant the button only looked important once you no
          // longer needed it.
          'grid h-[26px] w-[44px] place-items-center rounded-full bg-accent text-on-accent transition-colors',
          route.path.startsWith('/create') && 'bg-chip text-accent',
        ]"
      >
        <UiIcon
          name="plus"
          :size="18"
          :stroke="2.4"
        />
      </span>
      <span class="text-[10.5px] font-medium tracking-[-0.01em]">{{ t('shell.new') }}</span>
    </NuxtLink>
  </nav>
</template>
