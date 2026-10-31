<script setup lang="ts">
/** The chat's "connect your school" door: a calendar and a PDF work here, what needs a server says so. */
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
    :title="kind === 'ics' ? 'Timetable link' : kind === 'photo' ? 'Exam timetable PDF' : 'Needs an account on bilimind.com'"
    size="md"
  >
    <CompanionCreateIcsForm v-if="kind === 'ics'" />
    <CompanionCreatePhotoImport v-else-if="kind === 'photo'" />
    <p
      v-else
      class="text-[15px] leading-relaxed text-text-body"
    >
      Connecting Moodle or forwarding email runs on a server, so it's part of bilimind.com. A calendar link and an exam
      timetable PDF both work here.
    </p>
  </UiModal>
</template>
