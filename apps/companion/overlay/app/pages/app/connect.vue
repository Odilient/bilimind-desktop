<script setup lang="ts">
/** Links to "Connect your school" live on several screens; here they land on what this computer can connect. */
definePageMeta({ layout: 'companion' })
useSeoMeta({ title: 'Connected apps · BiliMind' })
</script>

<template>
  <div class="mx-auto grid w-full max-w-[720px] gap-8 px-5 py-8 min-[900px]:py-10">
    <h1 class="t-head text-[28px] min-[900px]:text-[36px]">
      Connected apps
    </h1>
    <section class="grid gap-3">
      <h2 class="font-display text-[17px] font-semibold text-text">Exam timetable PDF</h2>
      <CompanionCreatePhotoImport />
    </section>
    <p class="max-w-[60ch] text-[15px] leading-relaxed text-text-muted">
      Timetable links, Moodle and forwarded email are part of bilimind.com.
    </p>
  </div>
</template>
