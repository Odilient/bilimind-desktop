<script setup lang="ts">
/**
 * Settings → Calendar: the learner's classes, deadlines and plan in the
 * calendar they already use, as a link that calendar subscribes to
 * (`GET /api/companion/feed/{token}.ics`, routes/api/companion-google.php). One
 * way: what they do in their calendar doesn't come back.
 *
 * The link is the only key to it, so it is made on a press, not on sight, and
 * "Make a new link" is how a learner who shared it by mistake takes it back: the
 * old one stops working at once, which also stops every calendar using it, so
 * that is said before it happens.
 *
 * The body of the Google Calendar sheet in Settings → Integrations, and of the
 * calendar page's "Show in your calendar".
 */
import { useCompanion } from '~/companion/store'

const c = useCompanion()
const toast = useToast()
const { t } = useI18n()

const url = ref<string | null>(null)
const loaded = ref(false)
const busy = ref(false)
const confirming = ref(false)

onMounted(async () => {
  try {
    url.value = (await c.repo().calendarFeed()).url
  } catch {
    // Offline: the row offers to make one, which says so if it fails too.
  } finally {
    loaded.value = true
  }
})

async function make(): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    const replacing = url.value !== null
    url.value = (await c.repo().newCalendarFeed()).url
    confirming.value = false
    toast.success(replacing ? t('settings.calendar.madeNew') : t('settings.calendar.ready'))
  } catch {
    toast.error(t('settings.calendar.errMake'))
  } finally {
    busy.value = false
  }
}

function selectAll(event: FocusEvent): void {
  const input = event.target as HTMLInputElement
  input.select()
}

async function copy(): Promise<void> {
  if (!url.value) return
  try {
    await navigator.clipboard.writeText(url.value)
    toast.success(t('settings.assistants.copied'))
  } catch {
    toast.error(t('settings.assistants.errCopy'))
  }
}
</script>

<template>
  <div class="grid gap-3">
    <p class="text-[14px] leading-relaxed text-text-muted">
      {{ t('settings.calendar.intro') }}
    </p>

    <template v-if="loaded">
      <div
        v-if="url"
        class="flex min-w-0 items-center gap-2"
      >
        <input
          :value="url"
          readonly
          :aria-label="t('settings.calendar.linkAria')"
          class="h-9 min-w-0 flex-1 truncate rounded-[10px] bg-surface-sunken px-3 text-[13.5px] text-text-soft outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--brand)]"
          @focus="selectAll"
        >
        <UiBtn
          variant="secondary"
          size="md"
          icon="link"
          @click="copy"
        >
          {{ t('settings.assistants.copyLink') }}
        </UiBtn>
      </div>
      <UiBtn
        v-else
        class="justify-self-start"
        variant="secondary"
        size="md"
        icon="calendar"
        :loading="busy"
        @click="make"
      >
        {{ t('settings.calendar.make') }}
      </UiBtn>

      <template v-if="url">
        <p
          v-if="confirming"
          class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-text-muted"
        >
          <span>{{ t('settings.calendar.oldStops') }}</span>
          <button
            type="button"
            class="cursor-pointer font-semibold text-danger-text hover:underline disabled:cursor-wait"
            :disabled="busy"
            @click="make"
          >
            {{ t('settings.calendar.makeNew') }}
          </button>
          <button
            type="button"
            class="cursor-pointer font-medium text-text-soft hover:underline"
            @click="confirming = false"
          >
            {{ t('settings.calendar.keep') }}
          </button>
        </p>
        <button
          v-else
          type="button"
          class="cursor-pointer justify-self-start text-[13.5px] font-medium text-text-muted hover:text-text hover:underline"
          @click="confirming = true"
        >
          {{ t('settings.calendar.mistake') }}
        </button>
      </template>
    </template>
  </div>
</template>
