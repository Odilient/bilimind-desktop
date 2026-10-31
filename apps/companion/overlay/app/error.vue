<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const heading = computed(() => (props.error?.statusCode === 404 ? 'Nothing here.' : 'That did not load.'))
</script>

<template>
  <div class="t-body flex min-h-dvh flex-col items-center justify-center gap-4 bg-page p-8 text-center text-ink">
    <h1 class="t-head text-[36px]">
      {{ heading }}
    </h1>
    <p class="max-w-[50ch] text-[15px] text-text-body">
      Nothing you were working on is lost: it is all in the database on this computer.
    </p>
    <UiBtn @click="clearError({ redirect: '/app' })">
      Back to Today
    </UiBtn>
  </div>
</template>
