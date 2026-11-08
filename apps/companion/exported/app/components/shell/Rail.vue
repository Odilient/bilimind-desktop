<script setup lang="ts">
const { t } = useI18n()
/**
 * The rail: 62px of icons, or 208px of icons with their names.
 *
 * Deliberately the only global navigation in the product — a workspace earns
 * its "keep this open" character by never making the frame itself something you
 * have to read. Which is exactly why the icon rail is the default and the
 * expanded state is a choice: four icons in a strip cost nothing to ignore,
 * while a labelled sidebar is a column of words in your eye line all day.
 *
 * It is a choice worth offering, though. Icons alone are a memory test for
 * anyone who has not been here in a fortnight, and "Materials" and "Courses"
 * are not obvious from a file and a stack of layers. So: expandable, sticky per
 * browser, and animated in a way that never reflows the page underneath — the
 * rail is a flex item with a width transition, so the content next to it slides
 * rather than reflows.
 *
 * Under `/app` it hands over to the companion's own sidebar
 * (`CompanionShellSidebar`: New chat, Search, the places, the chats and you,
 * 260px or the 60px rail, floating over a workspace). Everything else here
 * is the old product's rail, exactly as it was before the companion.
 *
 * Hidden below `lg` — mobile navigates from the bottom bar instead.
 */
const route = useRoute()

const { openPalette } = useSearch()
const { expanded, toggle } = useRail()

const inApp = computed(() => route.path === '/app' || route.path.startsWith('/app/'))

const items = computed(() => [
  { to: '/today', label: t('shell.today'), icon: 'home' },
  { to: '/library', label: t('shell.courses'), icon: 'workspace' },
  { to: '/materials', label: t('shell.materials'), icon: 'file' },
  { to: '/create', label: t('shell.newCourse'), icon: 'plus' },
])

function isActive(to: string): boolean {
  if (to === '/library') return route.path.startsWith('/library') || route.path.startsWith('/courses')
  return route.path.startsWith(to)
}
</script>

<template>
  <CompanionShellSidebar v-if="inApp" />
  <nav
    v-else
    :class="[
      'hidden shrink-0 flex-col bg-bg py-3.5 transition-[width] duration-200 ease-out lg:flex',
      expanded ? 'w-[208px] items-stretch px-3' : 'w-[60px] items-center',
    ]"
    :aria-label="t('shell.mainNav')"
  >
    <!-- Wordmark. In the rail it is a mark; expanded it earns its name back. -->
    <NuxtLink
      to="/today"
      :class="[
        'mb-2.5 flex items-center gap-2.5 rounded-full',
        expanded ? 'px-1' : 'justify-center',
      ]"
      :aria-label="t('shell.homeAria')"
    >
      <!-- The same mark as the public nav and footer: cobalt's disc. -->
      <UiBrandMark class="size-[34px]" />
      <span
        v-if="expanded"
        class="truncate font-display text-[17px] font-semibold tracking-[-0.02em]"
        >BiliMind</span
      >
    </NuxtLink>

    <!-- Search is an action, not a destination, so it is not in `items`: it
         never lights up as the current page and it goes nowhere on its own. It
         sits above them because it reaches all four. -->
    <button
      type="button"
      :class="[
        'flex h-[38px] cursor-pointer items-center rounded-[12px] text-text-faint transition-colors duration-150 hover:bg-[rgb(var(--wash-rgb)/0.065)] hover:text-text',
        expanded ? 'gap-3 px-2.5' : 'w-[38px] justify-center self-center',
      ]"
      :title="t('shell.searchRailHint')"
      :aria-label="expanded ? undefined : t('shell.search')"
      @click="openPalette()"
    >
      <UiIcon
        name="search"
        :size="18"
        :stroke="1.9"
        class="shrink-0"
      />
      <span
        v-if="expanded"
        class="flex min-w-0 flex-1 items-center justify-between gap-2 text-[13.5px]"
      >
        <span class="truncate">{{ t('shell.search') }}</span>
        <!-- The shortcut, shown where there is room for it. Nobody discovers
             ⌘K from a tooltip they have to hover to see. -->
        <kbd
          class="num rounded border border-border-field px-1 py-px text-[10.5px] text-text-faint"
          >⌘K</kbd
        >
      </span>
    </button>

    <div :class="expanded ? 'mt-[5px] flex flex-col gap-[3px]' : 'mt-[5px] flex flex-col gap-[5px]'">
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        :title="expanded ? undefined : item.label"
        :aria-label="expanded ? undefined : item.label"
        :aria-current="isActive(item.to) ? 'page' : undefined"
        :class="[
          'relative flex h-[38px] items-center rounded-[12px] transition-colors duration-150',
          expanded ? 'gap-3 px-2.5' : 'w-[38px] justify-center self-center',
          isActive(item.to)
            ? 'bg-accent-soft text-accent-strong'
            : 'text-text-faint hover:bg-[rgb(var(--wash-rgb)/0.065)] hover:text-text',
        ]"
      >
        <!-- Cobalt marks the current place with a lime-soft tile and the lime
             that is legible as ink — no gutter marker; the tile is enough. -->
        <UiIcon
          :name="item.icon"
          :size="18"
          :stroke="1.9"
          class="shrink-0"
        />
        <span
          v-if="expanded"
          :class="['truncate text-[13.5px]', isActive(item.to) ? 'font-semibold' : 'font-medium']"
          >{{ item.label }}</span
        >
      </NuxtLink>
    </div>

    <div class="flex-1" />

    <div :class="expanded ? 'flex items-center gap-1' : 'flex flex-col items-center gap-[5px]'">
      <slot name="footer" />

      <!-- The handle. Last in the column so it never sits between the learner
           and something they came here to press. -->
      <button
        type="button"
        :class="[
          'grid size-[38px] cursor-pointer place-items-center rounded-[12px] text-text-faint transition-colors duration-150 hover:bg-[rgb(var(--wash-rgb)/0.065)] hover:text-text',
          expanded ? 'order-last ml-auto' : '',
        ]"
        :title="expanded ? t('shell.collapseSidebar') : t('shell.expandSidebar')"
        :aria-label="expanded ? t('shell.collapseSidebar') : t('shell.expandSidebar')"
        :aria-expanded="expanded"
        @click="toggle()"
      >
        <UiIcon
          name="chevron-down"
          :size="18"
          :stroke="1.9"
          :class="expanded ? 'rotate-90' : '-rotate-90'"
        />
      </button>
    </div>

    <ShellAccountMenu :class="expanded ? 'mt-2 self-start' : 'mt-1'" />
  </nav>
</template>
