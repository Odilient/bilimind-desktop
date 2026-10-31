<script setup lang="ts">
/**
 * The course workspace layout: frame and rail only.
 *
 * Everything else — the top bar, the three panels, the tab strip — belongs to
 * the page, because all of it is course state. A layout that tried to own the
 * top bar would need the course passed up to it, and that road ends in a
 * provide/inject tangle for no gain.
 *
 * The page fills the remaining box exactly and manages its own scrolling: at no
 * point does the workspace as a whole scroll.
 */
</script>

<template>
  <ShellFrame>
    <ShellRail>
      <template #footer>
        <ShellActivity />
      </template>
    </ShellRail>

    <div class="flex min-w-0 flex-1 flex-col">
      <slot />
    </div>
  </ShellFrame>
</template>
