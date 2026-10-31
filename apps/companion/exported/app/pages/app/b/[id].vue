<script setup lang="ts">
/**
 * `/app/b/<id>`, the address a whiteboard had before Notes: a board is a
 * note like a page, so it opens in Notes (`/app/notes/<id>`), the query kept.
 * The redirect replaces the address, so Back never bounces through it; a
 * board's Share link still copies this one, and it keeps working.
 */
definePageMeta({
  layout: 'companion',
  redirect: (to) => ({ path: `/app/notes/${String(to.params.id ?? '')}`, query: to.query }),
})
</script>

<template>
  <div />
</template>
