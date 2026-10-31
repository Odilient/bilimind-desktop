<script setup lang="ts">
/**
 * A photo (or PDF) of a timetable or an exam schedule, from any school.
 * BiliMind reads the classes and dates and puts what it found in the Inbox;
 * nothing is added until the learner says yes. Lifted out of the old
 * /app/start.
 */
import { useCompanion } from '~/companion/store'

const c = useCompanion()
const toast = useToast()

const input = ref<HTMLInputElement | null>(null)
const busy = ref(false)
const found = ref<number | null>(null)

async function onPick(event: Event): Promise<void> {
  const el = event.target as HTMLInputElement
  const file = el.files?.[0]
  el.value = ''
  if (!file) return
  busy.value = true
  try {
    found.value = (await c.ingestFile(file)).length
  } catch {
    toast.error('Couldn\'t read that PDF. If it is a scan with no text in it, type the dates in instead.')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="grid gap-4">
    <div>
      <UiBtn
        variant="primary"
        size="lg"
        :loading="busy"
        @click="input?.click()"
      >
        <CompanionIcon
          name="camera"
          :size="17"
        />
        Choose a PDF
      </UiBtn>
    </div>
    <p
      v-if="busy"
      class="text-[15px] text-text-muted"
      role="status"
    >
      Reading the PDF…
    </p>
    <p
      v-else-if="found !== null"
      class="text-[15px] font-medium"
      role="status"
    >
      {{ found ? `Found ${found} thing${found === 1 ? '' : 's'} to check.` : 'Nothing new in that PDoto.' }}
      <NuxtLink
        v-if="found"
        to="/app/inbox"
        class="ml-1 font-semibold text-cobalt hover:underline"
      >Look at what it found</NuxtLink>
    </p>
    <input
      ref="input"
      type="file"
      accept="application/pdf"
      class="hidden"
      @change="onPick"
    >
  </section>
</template>
