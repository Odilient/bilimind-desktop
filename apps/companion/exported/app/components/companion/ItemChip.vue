<script setup lang="ts">
/**
 * One thing filed under a class: a Moodle file, your page, a board, a
 * recording, photos. It is a link and looks like one (cobalt, semibold, the
 * kind's glyph before it), so a class's materials read as a line of things
 * to open rather than a row of grey tags. Pages and boards open; the rest
 * say what opening them will do, because the viewers for them land with the
 * recorder (Phase 1). A recording says "Recording" before its length, since
 * "1 h 48 m" alone doesn't say what it is.
 */
import type { Item } from '~/companion/types'
import { itemIcon, itemLabel } from '~/companion/words'
import { fetchFileUrl, knownFileUrl } from '~/companion/files'
import { useCompanion } from '~/companion/store'

const props = defineProps<{ item: Item; count?: number }>()
const { t } = useI18n()
const toast = useToast()
const c = useCompanion()

const to = computed(() => {
  if (props.item.kind === 'page') return `/app/p/${props.item.id}`
  if (props.item.kind === 'board') return `/app/b/${props.item.id}`
  return null
})
const href = computed(() => (props.item.kind === 'link' ? (props.item.meta.url ?? null) : knownFileUrl(props.item)))

/** Bytes that live on the server but came without a link (PowerSync drops the signed ones). */
const askable = computed(() => ['file', 'photo', 'recording'].includes(props.item.kind))

const label = computed(() => {
  if (props.count && props.count > 1) return t(props.item.kind === 'photo' ? 'today.chip.photos' : 'today.chip.files', props.count)
  if (props.item.kind === 'recording' && props.item.meta.duration_s) return t('today.chip.recording', { label: itemLabel(props.item) })
  return itemLabel(props.item)
})

async function open(): Promise<void> {
  // The window opens inside the click, so no popup blocker objects; the
  // signed link follows once the API has answered.
  const tab = window.open('', '_blank')
  const url = await fetchFileUrl(props.item)
  if (url && tab) tab.location.href = url
  else if (url) {
    // The browser held the window back: hand over a button, which it allows.
    toast.info({
      title: props.item.title,
      body: t('today.chip.ready'),
      action: { label: t('common.open'), handler: () => window.open(url, '_blank', 'noopener') },
    })
  } else {
    tab?.close()
    toast.error({ title: props.item.title, body: t('today.chip.cantOpen') })
  }
}

function explain(): void {
  const what =
    props.item.kind === 'recording'
      ? t('today.chip.explainRecording')
      : props.item.kind === 'photo'
        ? t('today.chip.explainPhoto')
        : props.item.source === 'moodle'
          ? t('today.chip.explainMoodle')
          : t('today.chip.explainFile')
  toast.info({ title: props.item.title, body: what })
}

// 44px tall on the phone for the thumb, 32px on the desktop where the
// pointer is precise and the lines can sit closer.
const cls =
  'group/chip inline-flex h-11 max-w-full items-center gap-1.5 text-[14px] font-semibold text-cobalt min-[900px]:h-8'
</script>

<template>
  <NuxtLink
    v-if="to"
    :to="to"
    :class="cls"
  >
    <CompanionIcon
      :name="itemIcon(item)"
      :size="15"
      class="shrink-0"
    />
    <span class="truncate group-hover/chip:underline">{{ label }}</span>
  </NuxtLink>
  <a
    v-else-if="href"
    :href="href"
    target="_blank"
    rel="noopener"
    :class="cls"
  >
    <CompanionIcon
      :name="itemIcon(item)"
      :size="15"
      class="shrink-0"
    />
    <span class="truncate group-hover/chip:underline">{{ label }}</span>
  </a>
  <button
    v-else
    type="button"
    :class="cls"
    @click="askable ? open() : explain()"
  >
    <CompanionIcon
      :name="itemIcon(item)"
      :size="15"
      class="shrink-0"
    />
    <span class="truncate group-hover/chip:underline">{{ label }}</span>
  </button>
</template>
