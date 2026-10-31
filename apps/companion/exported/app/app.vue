<script setup lang="ts">
/**
 * Two things are installed here rather than in a layout, and both for the same
 * reason: they have to behave identically on `/today`, `/library`, `/materials`
 * and inside the course workspace, and those are three different layouts that
 * otherwise share nothing.
 *
 *  - The search palette and its ⌘K. Mounted unconditionally, because it is
 *    wrapped in `<ClientOnly>` and renders nothing until something opens it —
 *    gating it on the session instead would make the server and the client
 *    disagree about how many nodes are here. The hotkey does the signed-out
 *    check itself, so a visitor on the marketing pages cannot summon it.
 *  - The `#block-{id}` anchor, so a link into one paragraph of one lesson lands
 *    on that paragraph however it was arrived at.
 */
useSearchHotkey()
useBlockAnchor()
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <UiToast />
    <ShellSearchPalette />
  </div>
</template>
