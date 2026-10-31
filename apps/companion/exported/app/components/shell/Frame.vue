<script setup lang="ts">
/**
 * The app frame: a white window floating on cobalt's grey page.
 *
 * This is the single most character-defining decision in the design. The gap
 * around the edge is what makes the product read as a tool you have open
 * rather than a document you have loaded, and it costs 14px.
 *
 * It is drawn exactly as the landing draws the app in its story — a 24px
 * window, a hairline ring and a long low ink shadow — on the same #ECEEF2 the
 * marketing slabs sit on, which is what makes signing in feel continuous.
 *
 * On phones the desk disappears — a 14px margin on a 390px screen is 7% of the
 * reading width given away for an effect nobody can see at that size.
 *
 * Mounting the frame is also what puts a page in the person's theme: every
 * app surface has one, and no public page does. See `useAppTheme`.
 */
useAppTheme()
</script>

<template>
  <div class="h-dvh bg-bg text-text lg:p-3.5">
    <div
      class="flex h-full overflow-hidden bg-surface lg:rounded-[24px] lg:shadow-frame"
    >
      <slot />
    </div>
  </div>
</template>
