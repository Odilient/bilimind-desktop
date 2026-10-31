<script setup lang="ts">
import type { Material, MaterialSourceMeta } from '~/types/api'
import { ApiError } from '~/composables/useApi'

/**
 * Opening a material.
 *
 * Until this existed a material was a filename with a status chip: you could
 * add one and delete one, and nothing in between. This is the in-between — what
 * the thing actually is, what BiliMind made of it, and the one action that moves
 * it forward from wherever it got stuck.
 *
 * The two asks live here rather than only on the row because they need room:
 * "paste the transcript" is a paragraph of typing, and a 24px inline control is
 * an invitation to give up.
 */

const props = defineProps<{
  material: Material | null
  /** Open straight into the paste box, for a row whose button said so. */
  ask?: boolean
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  updated: [material: Material]
  remove: [material: Material]
}>()

const api = useApi()
const toast = useToast()

const supplied = ref('')
const asking = ref(false)
const working = ref(false)
const actionError = ref<string | null>(null)

/** A different material behind the same panel is a different conversation. */
watch(
  [() => props.material?.id, () => props.ask],
  () => {
    supplied.value = ''
    asking.value = props.ask === true || props.material?.status === 'needs_input'
    actionError.value = null
  },
  { immediate: true },
)

const meta = computed<MaterialSourceMeta>(() => props.material?.source_meta ?? {})

const provider = computed(() =>
  typeof meta.value.provider === 'string' ? meta.value.provider : null,
)
const videoId = computed(() =>
  typeof meta.value.video_id === 'string' ? meta.value.video_id : null,
)
const author = computed(() =>
  typeof meta.value.author_name === 'string' ? meta.value.author_name : null,
)

/** `hqdefault` exists for every YouTube video; `maxresdefault` 404s on old uploads. */
const poster = computed(() => {
  if (typeof meta.value.thumbnail_url === 'string') return meta.value.thumbnail_url
  if (provider.value === 'youtube' && videoId.value) {
    return `https://i.ytimg.com/vi/${encodeURIComponent(videoId.value)}/hqdefault.jpg`
  }
  return null
})

/**
 * Only YouTube, and only through the no-cookie host — the same conservatism
 * ResourceCard applies in a lesson. The player is always there rather than
 * behind a poster: a still with a play glyph reads as a picture, and a lazy
 * iframe costs nothing until it scrolls into view. Anything else keeps its
 * poster and opens in its own tab, which always works and never embeds a
 * tracker.
 */
const embedUrl = computed(() => {
  if (provider.value !== 'youtube' || !videoId.value) return null
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
  })
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId.value)}?${params}`
})

/**
 * The name of the file as it was uploaded. Once an owner answers a
 * `needs_input` ask, `path` points at their typed-out text — but `source_meta`
 * remembers where the original went, and "which file was this?" is the first
 * question the panel has to answer.
 */
const originalName = computed(() => {
  const path = typeof meta.value.original_path === 'string' ? meta.value.original_path : null
  return path ? (path.split('/').pop() ?? null) : null
})

const readingLength = computed(() => {
  const count = props.material?.char_count ?? 0
  if (count <= 0) return ''
  const minutes = Math.max(1, Math.round(count / 1000))
  return minutes < 60
    ? `about ${minutes} minutes of reading`
    : `about ${hoursLabel(minutes)} hours of reading`
})

const askLabel = computed(() =>
  props.material?.wants === 'transcript' ? 'the transcript' : 'the text',
)

const statusTone = computed(() => {
  switch (props.material?.status) {
    case 'ready':
      return 'success'
    case 'failed':
      return 'danger'
    case 'needs_input':
      return 'warn'
    default:
      return 'accent'
  }
})

function messageFor(cause: unknown, fallback: string): string {
  if (cause instanceof ApiError) return cause.allMessages[0] ?? cause.message
  return cause instanceof Error ? cause.message : fallback
}

async function submitSupplied(): Promise<void> {
  const material = props.material
  if (!material || working.value || supplied.value.trim() === '') return

  working.value = true
  actionError.value = null

  try {
    const updated = await api.post<Material>(`/materials/${material.id}/text`, {
      text: supplied.value,
    })
    emit('updated', updated)
    supplied.value = ''
    asking.value = false
    toast.success({ title: 'Got it', body: `Reading “${updated.title}” now.` })
  } catch (cause) {
    actionError.value = messageFor(cause, 'That could not be saved.')
  } finally {
    working.value = false
  }
}

async function retry(): Promise<void> {
  const material = props.material
  if (!material || working.value) return

  working.value = true
  actionError.value = null

  try {
    const updated = await api.post<Material>(`/materials/${material.id}/retry`)
    emit('updated', updated)
    toast.success('Reading it again')
  } catch (cause) {
    actionError.value = messageFor(cause, 'That could not be retried.')
  } finally {
    working.value = false
  }
}
</script>

<template>
  <UiModal
    v-model:open="open"
    size="lg"
  >
    <template #header>
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <UiBadge
            tone="outline"
            size="xs"
            >{{ material?.format_label }}</UiBadge
          >
          <UiBadge
            :tone="statusTone"
            size="xs"
            dot
          >
            {{ material?.status_label }}
          </UiBadge>
        </div>
        <h2 class="mt-1.5 text-[17px] leading-snug font-semibold tracking-[-0.015em]">
          {{ material?.title }}
        </h2>
      </div>
    </template>

    <div
      v-if="material"
      class="flex flex-col gap-4"
    >
      <!-- The thing itself, when there is something to look at. -->
      <div
        v-if="embedUrl || (material.preview_url && poster)"
        class="overflow-hidden rounded-[16px] bg-ink"
      >
        <div class="relative aspect-video w-full">
          <iframe
            v-if="embedUrl"
            :src="embedUrl"
            :title="material.title"
            loading="lazy"
            class="absolute inset-0 size-full"
            frameborder="0"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen
          />
          <a
            v-else-if="material.url"
            :href="material.url"
            target="_blank"
            rel="noopener noreferrer nofollow"
            class="absolute inset-0 block size-full"
            :aria-label="`Open ${material.title}`"
          >
            <img
              :src="poster!"
              alt=""
              class="size-full object-cover"
            >
          </a>
          <img
            v-else
            :src="poster!"
            alt=""
            class="absolute inset-0 size-full object-cover"
          >
        </div>
      </div>

      <!-- Where it came from. A link is the one material you can genuinely reopen. -->
      <div
        v-if="material.url"
        class="rounded-[14px] bg-surface-mute px-4 py-3 shadow-[inset_0_0_0_1px_var(--border)]"
      >
        <p class="eyebrow">Source</p>
        <a
          :href="material.url"
          target="_blank"
          rel="noopener noreferrer nofollow"
          class="num mt-1 flex items-start gap-1.5 text-[12.5px] leading-relaxed break-all text-accent-strong hover:underline"
        >
          {{ material.url }}
          <UiIcon
            name="arrow-up-right"
            :size="13"
            class="mt-0.5 shrink-0"
          />
        </a>
        <p
          v-if="author"
          class="mt-1 text-[12px] text-text-faint"
        >
          {{ author }}
        </p>
        <p
          v-else-if="material.kind === 'url'"
          class="mt-1 text-[12px] leading-relaxed text-text-faint"
        >
          We fetched this page once and kept its text. Lessons quote what we read, not what is
          there now.
        </p>
      </div>

      <div
        v-else-if="originalName"
        class="rounded-[14px] bg-surface-mute px-4 py-3 shadow-[inset_0_0_0_1px_var(--border)]"
      >
        <p class="eyebrow">Uploaded as</p>
        <p class="num mt-1 text-[12.5px] break-all text-text-muted">{{ originalName }}</p>
      </div>

      <!-- Where it got to, and the one thing that moves it on. -->
      <div
        v-if="material.status === 'needs_input' || material.status === 'failed'"
        :class="[
          'rounded-[14px] px-4 py-3',
          material.status === 'failed'
            ? 'bg-danger-soft shadow-[inset_0_0_0_1px_var(--danger-line)]'
            : 'bg-warn-soft shadow-[inset_0_0_0_1px_var(--warn-line)]',
        ]"
      >
        <p
          :class="[
            'text-[13px] leading-relaxed',
            material.status === 'failed' ? 'text-danger' : 'text-warn-text',
          ]"
        >
          {{ material.failure_reason ?? 'BiliMind got as far as it could on its own.' }}
        </p>

        <div
          v-if="!asking"
          class="mt-2.5 flex flex-wrap gap-2"
        >
          <UiBtn
            variant="secondary"
            size="sm"
            icon="pencil"
            @click="asking = true"
          >
            Paste {{ askLabel }} in
          </UiBtn>
          <UiBtn
            variant="ghost"
            size="sm"
            icon="refresh"
            :loading="working"
            @click="retry"
          >
            Try reading it again
          </UiBtn>
        </div>

        <!--
          Answering the ask re-ingests the SAME material. Two rows for one
          source is the worst outcome available: nobody can tell which half a
          lesson used, and deleting the wrong one silently un-grounds it.
        -->
        <div
          v-else
          class="mt-2.5"
        >
          <UiTextField
            v-model="supplied"
            multiline
            :rows="8"
            autofocus
            :maxlength="2000000"
            :placeholder="
              material.wants === 'transcript'
                ? 'Paste the captions or transcript here…'
                : 'Type or paste what it says here…'
            "
            :aria-label="`Paste ${askLabel}`"
          />
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <UiBtn
              variant="primary"
              size="sm"
              icon="check"
              :loading="working"
              :disabled="supplied.trim() === ''"
              @click="submitSupplied"
            >
              Save and read it
            </UiBtn>
            <UiBtn
              variant="ghost"
              size="sm"
              @click="asking = false"
            >
              Not now
            </UiBtn>
            <span
              v-if="supplied.length"
              class="num text-[11.5px] text-text-faint"
            >
              {{ supplied.length.toLocaleString('en-US') }} characters
            </span>
          </div>
        </div>
      </div>

      <p
        v-else-if="material.status === 'ready'"
        class="text-[13px] leading-relaxed text-text-muted"
      >
        <template v-if="readingLength">
          BiliMind has read this — {{ readingLength }} — and lessons can quote it back to you
          directly.
        </template>
        <template v-else>
          BiliMind opened this but found nothing to learn from. It will not be much use as a source.
        </template>
      </p>

      <p
        v-else
        class="flex items-center gap-2 text-[13px] text-text-muted"
      >
        <UiIcon
          name="loader"
          :size="14"
          class="animate-spin-slow text-brand"
        />
        Being read now. This panel updates itself when it lands.
      </p>

      <p
        v-if="actionError"
        class="flex items-start gap-1.5 text-[12.5px] leading-relaxed text-danger"
      >
        <UiIcon
          name="alert"
          :size="13"
          class="mt-0.5 shrink-0"
        />
        {{ actionError }}
      </p>

      <dl class="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-border pt-3 text-[12px]">
        <div class="flex gap-1.5">
          <dt class="text-text-faint">Added</dt>
          <dd class="text-text-muted">{{ agoLabel(material.created_at) }}</dd>
        </div>
        <div
          v-if="material.bytes"
          class="flex gap-1.5"
        >
          <dt class="text-text-faint">Size</dt>
          <dd class="num text-text-muted">{{ materialBytes(material.bytes) }}</dd>
        </div>
        <div class="flex gap-1.5">
          <dt class="text-text-faint">Added as</dt>
          <dd class="text-text-muted">{{ material.kind_label }}</dd>
        </div>
        <div
          v-if="material.course_id"
          class="flex gap-1.5"
        >
          <dt class="text-text-faint">Attached to</dt>
          <dd class="text-text-muted">one course</dd>
        </div>
      </dl>
    </div>

    <template #footer>
      <UiBtn
        variant="danger"
        size="sm"
        icon="trash"
        class="mr-auto"
        :disabled="!material"
        @click="material && emit('remove', material)"
      >
        Delete
      </UiBtn>
      <UiBtn
        variant="ghost"
        size="sm"
        @click="open = false"
      >
        Close
      </UiBtn>
    </template>
  </UiModal>
</template>
