<script setup lang="ts">
/** The chat's "connect your school" door. On this computer it can only say why it isn't open. */
import type { ConnectKind } from '~/companion/create'

const props = defineProps<{ kind: ConnectKind | null }>()
const emit = defineEmits<{ close: [] }>()

const open = computed({
  get: () => props.kind !== null,
  set: (value) => {
    if (!value) emit('close')
  },
})
</script>

<template>
  <UiModal
    v-model:open="open"
    title="Not in the desktop app yet"
    size="md"
  >
    <p class="text-[15px] leading-relaxed text-text-body">
      Calendar links are coming to the desktop app. Connecting Moodle or forwarding email needs an account on
      bilimind.com, because they run on a server.
    </p>
  </UiModal>
</template>
