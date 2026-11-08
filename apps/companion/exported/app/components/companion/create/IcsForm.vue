<script setup lang="ts">
/**
 * The timetable's calendar link, imported whole: every class, room and
 * time in it, for every course, kept current when the timetable changes.
 * Lifted out of the old /app/start unchanged in what it does; it now sits
 * in a modal over the chat and anywhere else that wants it.
 */
import { useCompanion } from '~/companion/store'
import { untilLabel } from '~/companion/time'

const c = useCompanion()
const toast = useToast()

const url = ref('')
const busy = ref(false)
const done = ref<string | null>(null)

/** The calendar link already added, if there is one, said under the field. */
const note = computed(() => {
  const conn = c.connections.value.find((x) => x.kind === 'ics')
  if (!conn) return ''
  const where = (conn.url ?? '').replace(/^(https?|webcal):\/\//, '').slice(0, 48)
  const checked = conn.last_synced_at ? `, checked ${untilLabel(conn.last_synced_at)}` : ''
  return `You added one already${where ? `: ${where}` : ''}${checked}.`
})

async function add(): Promise<void> {
  if (!/^(https?|webcal):\/\//i.test(url.value.trim())) {
    toast.error('That doesn\'t look like a calendar link. It starts with https:// or webcal://')
    return
  }
  busy.value = true
  try {
    const r = await c.repo().ingestIcs({ url: url.value.trim() })
    c.rows.connections[r.connection.id] = r.connection
    await c.sync()
    const made = r.created.slots + r.created.sessions + r.created.deadlines
    done.value = made
      ? `${r.created.slots} weekly classes, ${r.created.deadlines} deadlines`
      : `Already up to date: ${r.updated} classes checked`
    url.value = ''
  } catch {
    toast.error('That link didn\'t open. Check it in a browser, then paste it again.')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <form
    class="grid gap-4"
    @submit.prevent="add"
  >
    <div class="grid gap-2">
      <label
        for="cp-ics"
        class="text-[15px] font-semibold"
      >Calendar link</label>
      <input
        id="cp-ics"
        v-model="url"
        type="url"
        inputmode="url"
        autocomplete="off"
        autofocus
        placeholder="https://… .ics"
        class="h-12 w-full min-w-0 rounded-full border border-border-field bg-surface px-5 text-[16px] outline-none placeholder:text-text-faint focus:border-brand focus:ring-3 focus:ring-brand-line"
      >
      <p
        v-if="note && !done"
        class="text-[14px] text-text-muted [font-feature-settings:'calt'_0]"
      >
        {{ note }}
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-x-5 gap-y-3">
      <UiBtn
        type="submit"
        variant="primary"
        size="lg"
        :loading="busy"
        :disabled="!url.trim()"
      >
        Add my timetable
      </UiBtn>
      <p
        v-if="done"
        class="text-[15px] font-medium text-success-text"
        role="status"
      >
        Done: {{ done }}.
        <NuxtLink
          to="/app/calendar"
          class="ml-1 font-semibold text-brand hover:underline"
        >See your week</NuxtLink>
      </p>
    </div>
  </form>
</template>
