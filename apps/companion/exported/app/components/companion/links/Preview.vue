<script setup lang="ts">
import type { Item } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { embedOf, openWords, previewInto } from '~/companion/imports/links'

/**
 * A link, open in Notes: the thing itself where the service lets it be shown
 * here (a YouTube or Vimeo player, a public Figma file or Canva design, a
 * Google doc shared with anyone), else its picture; under it, who it's from,
 * the address, and one button that opens it there ("Open in Canva").
 *
 * A private design has no player and no picture, only its name (the page's
 * heading above) and that button, which is the honest card: the frame would
 * only show the service's sign-in.
 *
 * Nothing plays by itself: a player is the service's own, framed without
 * autoplay, with the referrer YouTube requires for its embeds and no overlay
 * on it. Frames are lazy, so a card scrolled past costs nothing.
 *
 * A link with no preview yet (saved before previews existed, or added by
 * ChatGPT) is read once, the first time it's shown here.
 *
 * The desktop app frames the same players: its page policy lists
 * `EMBED_HOSTS` in `frame-src` (desktop/src/main/protocol.ts).
 */
const props = defineProps<{ item: Item }>()

const store = useCompanion()

const url = computed(() => props.item.meta.url ?? null)
const link = computed(() => props.item.meta.link ?? null)
const embed = computed(() => embedOf(link.value))
const broken = ref(false)
const picture = computed(() => (!embed.value && !broken.value ? link.value?.thumbnail ?? null : null))

const host = computed(() => {
  try {
    return url.value ? new URL(url.value).hostname.replace(/^www\./, '') : ''
  } catch {
    return ''
  }
})

watch(
  () => props.item.id,
  () => {
    broken.value = false
    void previewInto(store, props.item)
  },
  { immediate: true },
)
</script>

<template>
  <div class="grid gap-4 rounded-[18px] p-5 shadow-[inset_0_0_0_1px_var(--border)]">
    <div
      v-if="embed"
      class="relative aspect-video min-h-[200px] w-full overflow-hidden rounded-[12px] bg-surface-sunken"
    >
      <iframe
        :src="embed"
        :title="item.title || 'Linked page'"
        class="absolute inset-0 size-full border-0"
        loading="lazy"
        allow="fullscreen; picture-in-picture; encrypted-media; clipboard-write"
        allowfullscreen
        referrerpolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation allow-forms"
      />
    </div>
    <img
      v-else-if="picture"
      :src="picture"
      alt=""
      loading="lazy"
      referrerpolicy="no-referrer"
      class="aspect-video max-h-[420px] w-full rounded-[12px] bg-surface-sunken object-cover"
      @error="broken = true"
    >

    <div class="flex min-w-0 items-center gap-3">
      <span class="grid size-11 shrink-0 place-items-center rounded-full bg-cobalt-soft text-cobalt">
        <UiIcon
          name="link"
          :size="19"
        />
      </span>
      <span class="grid min-w-0">
        <span class="truncate text-[15px] font-semibold text-text">{{ link?.provider || host || 'A link' }}</span>
        <span class="text-[13px] break-all text-text-muted">{{ url }}</span>
      </span>
    </div>
    <div class="flex flex-wrap gap-2">
      <UiBtn
        v-if="url"
        variant="primary"
        :href="url"
        trailing-icon="arrow-up-right"
      >
        {{ openWords(link) }}
      </UiBtn>
    </div>
  </div>
</template>
