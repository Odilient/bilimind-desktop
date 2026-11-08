<script setup lang="ts">
const { t } = useI18n()
import { usePalette } from '~/companion/palette'
import { useSidebar } from '~/companion/sidebar'

/**
 * The top of every non-workspace page.
 *
 * Two different things depending on width, on purpose. On desktop it is a
 * static masthead that scrolls away — the page has room, and a pinned bar there
 * only eats it. On a phone it is a sticky 52px bar, because scrolling a long
 * list on a phone is how you lose track of which screen you are on, and because
 * that bar is where a phone app puts its one contextual action — and, on
 * top-level screens, the avatar that leads to settings and sign-out.
 */
const props = withDefaults(
  defineProps<{
    title: string
    /** Small line above the title. Desktop only — a phone bar has no room. */
    eyebrow?: string
    /** One line under the title, for counts or a plain-language summary. */
    subtitle?: string
    /** Set on secondary screens: shows a back chevron on the phone bar. */
    back?: string
    /** Must match the body's container, or the masthead sits off its own page. */
    width?: '3xl' | '4xl' | '6xl'
    /**
     * Drop the desktop masthead. For pages that already carry their own big
     * heading as content — the course composer asks its question in 34px type,
     * and a "New course" masthead above it would just be a second title.
     */
    barOnly?: boolean
  }>(),
  { width: '6xl' },
)

/**
 * A phone has no rail, so the only place search can live is this bar. It is on
 * every screen that uses this component on purpose — search is the one action
 * that is never about the screen you are looking at. Under `/app` it opens
 * the companion's own palette (app/companion/palette.ts), which searches what
 * the companion keeps; the old one knows only the old courses.
 */
const { openPalette } = useSearch()
const companionPalette = usePalette()
const route = useRoute()
const inApp = computed(() => route.path === '/app' || route.path.startsWith('/app/'))
/** Under `/app` the bar opens the companion's sidebar as a drawer (its places, chats, New chat). */
const sidebar = useSidebar()

/*
 * The companion's layout draws a phone bar for screens that have none of
 * their own; a mounted head is how it knows to stand down, so a phone never
 * shows two. Counted, because on the way between two pages both are mounted.
 */
const heads = useState('shell:page-heads', () => 0)
onMounted(() => {
  heads.value += 1
})
onBeforeUnmount(() => {
  heads.value -= 1
})

const container = computed(
  () =>
    ({
      '3xl': 'max-w-3xl',
      '4xl': 'max-w-4xl',
      '6xl': 'max-w-6xl',
    })[props.width],
)
</script>

<template>
  <!-- Phone: sticky bar -->
  <div
    class="sticky top-0 z-20 flex h-[52px] shrink-0 items-center gap-2 border-b border-border bg-surface/94 px-3 backdrop-blur-[14px] lg:hidden"
  >
    <button
      v-if="inApp && !back"
      type="button"
      class="-ml-1.5 grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-text-soft active:bg-surface-sunken"
      :aria-label="t('shell.menu')"
      aria-haspopup="dialog"
      :aria-expanded="sidebar.drawer.value"
      @click="sidebar.drawer.value = true"
    >
      <UiIcon
        name="menu"
        :size="21"
        :stroke="1.9"
      />
    </button>
    <NuxtLink
      v-if="back"
      :to="back"
      class="-ml-1.5 grid size-9 shrink-0 place-items-center rounded-full text-text-soft active:bg-surface-sunken"
      :aria-label="t('shell.back')"
    >
      <UiIcon
        name="chevron-left"
        :size="21"
        :stroke="2"
      />
    </NuxtLink>

    <h1
      class="min-w-0 flex-1 truncate font-display text-[18px] font-semibold tracking-[-0.025em]"
    >
      {{ title }}
    </h1>

    <button
      type="button"
      class="grid size-9 shrink-0 place-items-center rounded-full text-text-soft active:bg-surface-sunken"
      :aria-label="t('shell.search')"
      @click="inApp ? companionPalette.show() : openPalette()"
    >
      <UiIcon
        name="search"
        :size="20"
        :stroke="1.9"
      />
    </button>

    <slot name="bar-actions">
      <slot name="actions" />
    </slot>

    <!-- A phone has no rail, so this bar carries the account entrance (under
         `/app`, the companion's settings sheet). Only on top-level screens: a
         screen with a back chevron is somewhere you are passing through, not
         somewhere you sign out from. -->
    <ShellAccountMenu
      v-if="!back"
      size="md"
    />
  </div>

  <!-- Desktop: masthead -->
  <div
    v-if="!barOnly"
    :class="['mx-auto hidden w-full px-8 pt-10 lg:block', container]"
  >
    <div class="flex items-start gap-4">
      <div class="min-w-0 flex-1">
        <!-- Daylight 2: a quiet sentence over the title, never small capitals. -->
        <p
          v-if="eyebrow"
          class="text-[13.5px] font-semibold text-text-faint"
        >
          {{ eyebrow }}
        </p>
        <h1 class="mt-1 font-display text-[34px] leading-[1.04] font-semibold tracking-[-0.04em]">
          {{ title }}
        </h1>
        <p
          v-if="subtitle"
          class="mt-2 text-[14.5px] text-text-soft"
        >
          {{ subtitle }}
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-2 pt-1.5">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
