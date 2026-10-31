<script setup lang="ts">
/** The chat's "connect your school" door: a PDF works here, what needs a server says so. */
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
    :title="kind === 'photo' ? 'Exam timetable PDF' : 'Needs an account on bilimind.com'"
    size="md"
  >
    <CompanionCreatePhotoImport v-if="kind === 'photo'" />
    <p
      v-else
      class="text-[15px] leading-relaxed text-text-body"
    >
      Timetable links, Moodle and forwarded email are part of bilimind.com. An exam
      timetable PDF works here.
    </p>
  </UiModal>
</template>
