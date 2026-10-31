<script setup lang="ts">
/**
 * `/app/p/<id>`, the address a page had before Notes: every old link, the
 * Markdown export's links and anything bookmarked land on the same page in
 * Notes (`/app/notes/<id>`), with the query kept (`?demo=1`). The redirect
 * replaces the address, so Back never bounces through it.
 *
 * Inside a course these links are caught first and open as a tab there
 * (the course page's `onBeforeRouteLeave`); this is everywhere else.
 */
definePageMeta({
  layout: 'companion',
  redirect: (to) => ({ path: `/app/notes/${String(to.params.id ?? '')}`, query: to.query }),
})
</script>

<template>
  <div />
</template>
