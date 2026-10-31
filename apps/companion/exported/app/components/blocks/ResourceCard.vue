<script setup lang="ts">
import type { ResearchedResource, ResourceKind } from '~/types/api'
import { RESOURCE_KIND_LABEL, layoutOf, resourceKind } from '~/utils/resourceLayout'

/**
 * One verified, off-platform thing, drawn the way the web already draws links to
 * itself.
 *
 * A YouTube video is a player — always. The old poster-and-play-button was a
 * bandwidth argument that lost to a simpler fact: a learner who sees a still
 * with a triangle on it assumes it is a picture, and `loading="lazy"` on the
 * iframe keeps the player bundle out of the critical path anyway.
 *
 * Everything else is an unfurl: the page's own banner (`og:image`), the site's
 * own mark, the site's name, the title, and one line on why it is here. An
 * article is a LINE — thumbnail beside the words, one row per link, because a
 * reading list is scanned top to bottom and three posters are not a list. Docs,
 * a book, a tool have a cover and get a tall card with one. When a page
 * published no banner, its mark sits on a quiet ground instead — a card with a
 * hole in it reads as broken; a card with a logo reads as a place.
 *
 * Both `<img>`s can fail (a banner behind a hotlink rule, a mark that moved).
 * Failure hides the image and falls back to the placeholder; it never shows a
 * blank box or the browser's broken-image glyph. The lesson is server-rendered,
 * so an image can fail BEFORE Vue is listening — `@error` alone misses those.
 * `settle()` asks every already-complete image to `decode()` on mount, which
 * rejects for anything the browser could not draw, whenever that happened.
 */
const props = withDefaults(
  defineProps<{
    item: ResearchedResource
    /** Seconds into the video to open at. Only meaningful for an embeddable video. */
    start?: number | null
  }>(),
  { start: null },
)

const KIND_LABEL = RESOURCE_KIND_LABEL

const KIND_ICON: Record<ResourceKind, string> = {
  video: 'play',
  article: 'file',
  docs: 'book',
  book: 'book',
  tool: 'layers',
  image: 'search',
}

const kind = computed<ResourceKind>(() => resourceKind(props.item))
const layout = computed(() => layoutOf(props.item))
const isPlayer = computed(() => layout.value === 'player')
const isLine = computed(() => layout.value === 'line')

/**
 * Read defensively: a block written before `start_seconds` existed has no such
 * field, and one that arrives as a string or a negative number must degrade to
 * "start at the beginning", not to a broken embed URL.
 */
const startSeconds = computed(() => {
  const value = typeof props.start === 'number' ? props.start : Number.NaN
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null
})

const embedUrl = computed(() => {
  const params = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' })
  if (startSeconds.value !== null) params.set('start', String(startSeconds.value))
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(props.item.provider_id ?? '')}?${params}`
})

/** The same offset for the "Open" link, which leaves our player entirely. */
const externalUrl = computed(() => {
  if (startSeconds.value === null) return props.item.url
  try {
    const url = new URL(props.item.url)
    url.searchParams.set('t', `${startSeconds.value}s`)
    return url.toString()
  } catch {
    return props.item.url
  }
})

const banner = computed(() => props.item.image ?? props.item.thumbnail ?? null)
const favicon = computed(() => props.item.favicon ?? null)

const bannerFailed = ref(false)
const iconFailed = ref(false)

type ImageRole = 'banner' | 'icon'

function fail(role: ImageRole): void {
  if (role === 'banner') bannerFailed.value = true
  else iconFailed.value = true
}

/** Only one of the two root branches renders, so both may share the ref. */
const root = ref<HTMLElement | null>(null)

/**
 * Catch what `@error` could not: an image that settled before hydration. Only
 * images already `complete` are asked — `decode()` on a lazy image would start
 * loading it, and the ones still loading will report through `@error` anyway.
 */
function settle(): void {
  const images = root.value?.querySelectorAll<HTMLImageElement>('img[data-role]') ?? []
  for (const img of images) {
    if (!img.complete) continue
    const role = img.dataset.role as ImageRole
    img.decode().catch(() => fail(role))
  }
}

onMounted(settle)

/* A recycled card for a different resource starts with a clean slate. */
watch(
  () => props.item.resource_id,
  () => {
    bannerFailed.value = false
    iconFailed.value = false
    void nextTick(settle)
  },
)

const showBanner = computed(() => Boolean(banner.value) && !bannerFailed.value)
const showIcon = computed(() => Boolean(favicon.value) && !iconFailed.value)

const siteLabel = computed(() => props.item.site_name ?? props.item.domain ?? null)

function clockLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

/** The quiet line under the title: kind, who made it, how long, which language. */
const facts = computed(() => {
  const out: string[] = []
  if (!isPlayer.value) out.push(KIND_LABEL[kind.value])
  if (isPlayer.value && props.item.author) out.push(props.item.author)
  if (props.item.duration_label) out.push(props.item.duration_label)
  if (startSeconds.value !== null) out.push(`from ${clockLabel(startSeconds.value)}`)
  if (props.item.language) out.push(props.item.language)
  return out
})
</script>

<template>
  <!-- A player. -->
  <article
    v-if="isPlayer"
    ref="root"
    class="overflow-hidden rounded-[16px] bg-surface-mute shadow-[inset_0_0_0_1px_var(--border)]"
  >
    <div class="relative aspect-video w-full bg-ink">
      <iframe
        :src="embedUrl"
        :title="item.title"
        loading="lazy"
        class="absolute inset-0 size-full"
        frameborder="0"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen
      />
    </div>

    <div class="flex items-start gap-3 p-3">
      <span
        class="mt-0.5 grid size-8 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-surface shadow-[inset_0_0_0_1px_var(--border)]"
      >
        <img
          v-if="showIcon"
          :src="favicon!"
          alt=""
          loading="lazy"
          referrerpolicy="no-referrer"
          class="size-4"
          data-role="icon"
          @error="fail('icon')"
        />
        <UiIcon
          v-else
          name="play"
          :size="13"
          class="text-brand"
        />
      </span>

      <div class="min-w-0 flex-1">
        <p class="truncate text-[11.5px] text-text-faint">{{ siteLabel ?? 'YouTube' }}</p>
        <p class="mt-0.5 font-display text-[15px] leading-snug font-semibold tracking-[-0.01em]">
          {{ item.title }}
        </p>
        <p
          v-if="item.why"
          class="mt-1 text-[12.5px] leading-relaxed text-text-muted"
        >
          {{ item.why }}
        </p>
        <p
          v-if="facts.length"
          class="num mt-1.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-text-faint"
        >
          <template
            v-for="(fact, index) in facts"
            :key="fact"
          >
            <span v-if="index > 0">·</span>
            <span>{{ fact }}</span>
          </template>
        </p>
      </div>

      <UiBtn
        :href="externalUrl"
        variant="ghost"
        size="xs"
        trailing-icon="external"
        class="shrink-0"
      >
        Open
      </UiBtn>
    </div>
  </article>

  <!-- An unfurl: a line for an article, a card for anything with a cover. -->
  <a
    v-else
    ref="root"
    :href="item.url"
    target="_blank"
    rel="noopener noreferrer"
    :class="[
      'group flex overflow-hidden rounded-[16px] bg-surface-mute shadow-[inset_0_0_0_1px_var(--border)] transition hover:bg-surface hover:shadow-[inset_0_0_0_1px_var(--border-strong),0_14px_30px_-20px_rgb(11_13_16/0.3)]',
      isLine ? 'items-start gap-3.5 p-2.5' : 'h-full flex-col',
    ]"
  >
    <div
      :class="[
        'relative shrink-0 overflow-hidden bg-surface',
        isLine
          ? 'aspect-[3/2] w-28 rounded-[11px] shadow-[inset_0_0_0_1px_var(--border)] sm:w-32'
          : 'aspect-[2/1] w-full border-b border-border',
      ]"
    >
      <img
        v-if="showBanner"
        :src="banner!"
        alt=""
        loading="lazy"
        referrerpolicy="no-referrer"
        class="size-full object-cover transition duration-300 group-hover:scale-[1.02]"
        data-role="banner"
        @error="fail('banner')"
      />
      <div
        v-else
        class="grid size-full place-items-center"
        aria-hidden="true"
      >
        <span
          :class="[
            'grid place-items-center overflow-hidden rounded-[14px] bg-brand-soft',
            isLine ? 'size-10 rounded-[11px]' : 'size-14',
          ]"
        >
          <img
            v-if="showIcon"
            :src="favicon!"
            alt=""
            loading="lazy"
            referrerpolicy="no-referrer"
            :class="isLine ? 'size-5' : 'size-8'"
            data-role="icon"
          @error="fail('icon')"
          />
          <UiIcon
            v-else
            :name="KIND_ICON[kind]"
            :size="isLine ? 16 : 20"
            class="text-brand"
          />
        </span>
      </div>

      <span
        v-if="!isLine"
        class="absolute top-2.5 left-2.5 rounded-full bg-ink/80 px-2.5 py-1 text-[10.5px] font-semibold text-white backdrop-blur-sm"
      >
        {{ KIND_LABEL[kind] }}
      </span>
    </div>

    <span :class="['flex min-w-0 flex-1 items-start gap-3', isLine ? 'py-0.5' : 'p-3']">
      <!-- The mark: a tile beside the words on a card, inline with the site name on a line. -->
      <span
        v-if="!isLine"
        class="mt-0.5 grid size-8 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-surface shadow-[inset_0_0_0_1px_var(--border)]"
      >
        <img
          v-if="showIcon"
          :src="favicon!"
          alt=""
          loading="lazy"
          referrerpolicy="no-referrer"
          class="size-4"
          data-role="icon"
          @error="fail('icon')"
        />
        <UiIcon
          v-else
          name="globe"
          :size="13"
          class="text-brand"
        />
      </span>

      <span class="min-w-0 flex-1">
        <span
          v-if="siteLabel || isLine"
          class="flex min-w-0 items-center gap-1.5 text-[11.5px] text-text-faint"
        >
          <template v-if="isLine">
            <img
              v-if="showIcon"
              :src="favicon!"
              alt=""
              loading="lazy"
              referrerpolicy="no-referrer"
              class="size-3.5 shrink-0 rounded-[3px]"
              data-role="icon"
          @error="fail('icon')"
            />
            <UiIcon
              v-else
              name="globe"
              :size="12"
              class="shrink-0"
            />
          </template>
          <span class="truncate">{{ siteLabel ?? item.domain ?? 'Link' }}</span>
        </span>
        <span
          class="mt-0.5 line-clamp-2 block font-display text-[14.5px] leading-snug font-semibold tracking-[-0.01em]"
          >{{ item.title }}</span
        >
        <span
          v-if="item.why"
          class="mt-1 line-clamp-2 block text-[12.5px] leading-relaxed text-text-muted"
        >
          {{ item.why }}
        </span>
        <span
          v-if="facts.length"
          class="num mt-1.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-text-faint"
        >
          <template
            v-for="(fact, index) in facts"
            :key="fact"
          >
            <span v-if="index > 0">·</span>
            <span>{{ fact }}</span>
          </template>
        </span>
      </span>

      <UiIcon
        name="external"
        :size="13"
        class="mt-1 shrink-0 text-text-faint transition group-hover:text-brand"
      />
    </span>
  </a>
</template>
