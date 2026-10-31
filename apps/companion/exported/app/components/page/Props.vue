<script setup lang="ts">
import type { Item } from '~/companion/types'
import type { PageContext } from '~/companion/doc/context'
import { clock, dayKey, dayLabel, durationLabel, timecode } from '~/companion/time'

/**
 * The line under the title that says which class this page is from: the
 * class and when it was (a link to that day in the calendar), what it was
 * about, and its recording. One muted line of words, not a row of chips, so
 * the two things you can press (the date and the recording) are the only
 * cobalt ones. Filled in from the page's session and topic before anyone
 * types; nothing here is entered by hand. A page in the Notebook has no
 * class, so the line isn't there (the bar above already says "Notebook").
 */
const props = defineProps<{ page: Item; ctx: PageContext }>()
const emit = defineEmits<{ seek: [itemId: string, seconds: number] }>()

const recording = computed(() => {
  const rec = props.ctx.recording
  if (!rec) return null
  const s = props.ctx.session
  const live = s && Date.now() >= Date.parse(s.starts_at) && Date.now() <= Date.parse(s.ends_at)
  const seconds = live ? Math.floor((Date.now() - Date.parse(s!.starts_at)) / 1000) : Number(rec.meta.duration_s ?? 0)
  // Still recording: a running clock, as the recorder shows it. Done: its length.
  const length = live ? timecode(seconds) : durationLabel(seconds)
  if (live) return { id: rec.id, live, label: seconds ? `Recording now, ${length}` : 'Recording now' }
  return { id: rec.id, live, label: seconds ? `Recording, ${length}` : 'Recording' }
})

const when = computed(() => {
  const s = props.ctx.session
  if (!s) return null
  const at = `${dayLabel(dayKey(s.starts_at))}, ${clock(s.starts_at)}`
  return { label: s.title ? `${s.title}, ${at}` : at, to: `/app/calendar?date=${dayKey(s.starts_at)}` }
})

const topic = computed(() => props.ctx.topic?.title ?? null)
</script>

<template>
  <p
    v-if="recording || when || topic"
    class="pg-props"
  >
    <NuxtLink
      v-if="when"
      :to="when.to"
      class="pg-prop is-link"
      title="Open this day in the calendar"
    >
      {{ when.label }}
    </NuxtLink>
    <span
      v-if="topic"
      class="pg-prop"
    >{{ topic }}</span>
    <button
      v-if="recording"
      type="button"
      class="pg-prop is-link"
      title="Go to the start of the recording"
      @click="emit('seek', recording.id, 0)"
    >
      <i
        v-if="recording.live"
        class="pg-live"
        aria-hidden="true"
      />
      <UiIcon
        v-else
        name="mic"
        :size="14"
      />
      {{ recording.label }}
    </button>
  </p>
</template>
