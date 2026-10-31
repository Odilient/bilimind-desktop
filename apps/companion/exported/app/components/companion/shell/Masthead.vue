<script setup lang="ts">
/**
 * The head of a companion screen that isn't a workspace: Today, the
 * Calendar, Waiting for your OK. The old pages' `ShellPageHead`, kept for
 * its phone bar (sticky, the title, the search and the avatar), with the
 * desktop masthead drawn here so it can follow the companion's own rules:
 * the eyebrow is a sentence ("Good morning, Kamila"), never small capitals.
 *
 *   <CompanionShellMasthead eyebrow="Good morning" title="Today" subtitle="…">
 *     <template #actions>…</template>       desktop, right of the title
 *     <template #bar-actions>…</template>   phone bar, before the avatar
 *   </CompanionShellMasthead>
 *
 * On a phone the bar already says the title, so the page itself only says
 * the eyebrow and the subtitle, on one quiet line.
 */
withDefaults(
  defineProps<{
    title: string
    eyebrow?: string
    subtitle?: string
    /** A screen passed through (the Inbox, from Today): a back chevron on the phone bar. */
    back?: string
    /** The page's own column, so the head lines up with what's under it. */
    width?: string
  }>(),
  { width: 'max-w-[1120px]' },
)
</script>

<template>
  <ShellPageHead
    :title="title"
    :back="back"
    bar-only
  >
    <template #bar-actions>
      <slot name="bar-actions" />
    </template>
  </ShellPageHead>

  <header :class="['mx-auto w-full px-4 pt-4 sm:px-6 lg:px-8 lg:pt-10', width]">
    <div class="hidden items-end gap-4 lg:flex">
      <div class="min-w-0 flex-1">
        <p
          v-if="eyebrow"
          class="text-[14px] font-medium text-brand"
        >
          {{ eyebrow }}
        </p>
        <h1 class="t-head mt-1 text-[36px] leading-[1.06] tracking-[-0.03em]">
          {{ title }}
        </h1>
        <p
          v-if="subtitle"
          class="mt-2 text-[14.5px] text-text-soft"
        >
          {{ subtitle }}
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2 pb-0.5">
        <slot name="actions" />
      </div>
    </div>

    <p
      v-if="eyebrow || subtitle"
      class="px-0.5 text-[13px] leading-snug text-text-faint lg:hidden"
    >
      <span
        v-if="eyebrow"
        class="font-medium text-text-soft"
      >{{ eyebrow }}</span><template v-if="eyebrow && subtitle">
        ·
      </template>{{ subtitle }}
    </p>
  </header>
</template>
