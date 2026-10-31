<script setup lang="ts">
/** Links to "Connect your school" live on several screens; here they land on the plain answer. */
definePageMeta({ layout: 'companion' })
useSeoMeta({ title: 'Connected apps · BiliMind' })
</script>

<template>
  <div class="mx-auto w-full max-w-[720px] px-5 py-8 min-[900px]:py-10">
    <h1 class="t-head text-[28px] min-[900px]:text-[36px]">
      Connected apps
    </h1>
    <p class="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-text-body">
      Calendar links aren't in the desktop app yet. Connecting Moodle or forwarding email needs an account on
      bilimind.com, because they run on a server.
    </p>
  </div>
</template>
