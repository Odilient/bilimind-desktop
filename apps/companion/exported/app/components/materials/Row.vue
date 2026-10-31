<script setup lang="ts">
import type { Material, MaterialStatus } from '~/types/api'
import { formatIcon } from '~/components/materials/presentation'

/**
 * One material, as a row in the library.
 *
 * Ingest is asynchronous, so the status IS the feature: this row's job is to
 * make "what is happening to my file" answerable at a glance, and to make every
 * unhappy ending end in a button rather than a red sentence. A failure with no
 * next move is where people conclude the product is broken and stop uploading.
 */

const props = defineProps<{
  material: Material
  /** An action on this row is in flight; the buttons go quiet rather than away. */
  busy?: boolean
}>()

const emit = defineEmits<{
  open: [material: Material]
  retry: [material: Material]
  supply: [material: Material]
  remove: [material: Material]
}>()

const TONE: Record<MaterialStatus, string> = {
  pending: 'border-transparent bg-surface-sunken text-text-faint',
  processing: 'border-transparent bg-brand-soft text-brand',
  ready: 'border-transparent bg-brand-soft text-brand',
  failed: 'border-transparent bg-danger-soft text-danger',
  needs_input: 'border-transparent bg-warn-soft text-warn',
}

const BADGE: Record<MaterialStatus, 'neutral' | 'accent' | 'success' | 'warn' | 'danger'> = {
  pending: 'neutral',
  processing: 'accent',
  ready: 'success',
  failed: 'danger',
  needs_input: 'warn',
}

const settling = computed(
  () => props.material.status === 'pending' || props.material.status === 'processing',
)

/**
 * How long it has been sitting in this state. No timer: the library polls while
 * anything is settling and hands this component a fresh object every time, so
 * the number moves on its own for exactly as long as it is worth watching.
 *
 * `mounted` keeps `Date.now()` out of the hydration render. The server and the
 * browser evaluate it milliseconds apart, and a row that happens to sit on the
 * 90-second line would otherwise render two different sentences and warn.
 */
const mounted = ref(false)

onMounted(() => {
  mounted.value = true
})

const stalled = computed(() => {
  if (!mounted.value || !settling.value) return false
  const since = new Date(props.material.updated_at).getTime()
  return Number.isFinite(since) && Date.now() - since > 90_000
})

const stage = computed(() => {
  const base =
    props.material.status === 'pending' ? 'Queued — waiting its turn' : 'Reading it now'

  return stalled.value
    ? `${base} · still going. Long PDFs and slide decks can take a few minutes.`
    : base
})

/** The exact ask, in the words of the thing that is missing. */
const askLabel = computed(() =>
  props.material.wants === 'transcript' ? 'Paste the transcript' : 'Type out the text',
)

function bytes(value: number | null): string {
  if (!value || value <= 0) return ''
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * How long the file is, in something a person recognises. The API counts
 * characters and index chunks; both are true and neither answers "is this the
 * right file?". Reading minutes at ~1000 characters a minute does.
 */
const lengthLabel = computed(() => {
  const count = props.material.char_count ?? 0
  if (count <= 0) return ''
  const minutes = Math.max(1, Math.round(count / 1000))
  return minutes < 60 ? `about ${minutes} min to read` : `about ${hoursLabel(minutes)} hrs to read`
})

const emptyish = computed(
  () => props.material.status === 'ready' && (props.material.chunk_count ?? 0) === 0,
)
</script>

<template>
  <UiCard pad="md">
    <div class="flex items-start gap-3.5">
      <span
        :class="[
          'mt-0.5 grid size-10 shrink-0 place-items-center rounded-[12px] border',
          TONE[material.status],
        ]"
      >
        <UiIcon
          :name="formatIcon(material.format)"
          :size="15"
        />
      </span>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <!--
            The title opens the material rather than a chevron somewhere else:
            the name of the thing is what people aim at.
          -->
          <button
            type="button"
            class="t-head min-w-0 cursor-pointer truncate text-left text-[15.5px] hover:text-brand"
            @click="emit('open', material)"
          >
            {{ material.title }}
          </button>
          <UiBadge
            tone="outline"
            size="xs"
            >{{ material.format_label }}</UiBadge
          >
          <UiBadge
            :tone="BADGE[material.status]"
            size="xs"
            :dot="material.status !== 'processing'"
            :icon="material.status === 'processing' ? 'loader' : undefined"
          >
            {{ material.status_label }}
          </UiBadge>
        </div>

        <a
          v-if="material.url"
          :href="material.url"
          target="_blank"
          rel="noopener noreferrer nofollow"
          class="num mt-1 block truncate text-[11.5px] text-text-faint hover:text-brand"
        >
          {{ material.url }}
        </a>

        <!--
          Reading time and size, not chunks, characters and MIME type. The
          question about a file in a list is "is this the one I meant, and is it
          big?" — index internals answer neither, and four of them in a row is
          what made this page a file manager.
        -->
        <dl
          v-if="!settling"
          class="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-text-faint"
        >
          <div v-if="lengthLabel">
            <dt class="sr-only">Length</dt>
            <dd>{{ lengthLabel }}</dd>
          </div>
          <div v-if="bytes(material.bytes)">
            <dt class="sr-only">File size</dt>
            <dd>{{ bytes(material.bytes) }}</dd>
          </div>
          <div
            v-if="material.course_id"
            class="flex items-center gap-1.5"
          >
            <UiIcon
              name="book"
              :size="12"
            />
            <dd>Used by a course</dd>
          </div>
        </dl>

        <!--
          A named stage and a moving line, because an asynchronous job with no
          visible progress is indistinguishable from one that has died. The bar
          is honestly indeterminate: the server reports no page count, so a
          determinate one would be a number we made up.
        -->
        <div
          v-if="settling"
          class="mt-2"
        >
          <div class="h-[3px] overflow-hidden rounded-full bg-surface-track">
            <div class="animate-shimmer h-full w-full bg-brand" />
          </div>
          <p class="mt-1.5 text-[12px] leading-relaxed text-text-faint">{{ stage }}</p>
        </div>

        <!--
          Terminal and unhappy. `needs_input` is deliberately not the danger
          colour: nothing went wrong, the file is intact, and the one person who
          can finish it is reading this sentence.
        -->
        <div
          v-else-if="material.status === 'needs_input'"
          class="mt-2.5 rounded-[12px] bg-warn-soft px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--warn-line)]"
        >
          <p class="text-[12px] leading-relaxed text-warn-text">
            {{ material.failure_reason ?? 'This one needs something only you have.' }}
          </p>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <UiBtn
              variant="secondary"
              size="xs"
              icon="pencil"
              :disabled="busy"
              @click="emit('supply', material)"
            >
              {{ askLabel }}
            </UiBtn>
            <UiBtn
              v-if="material.preview_url"
              variant="ghost"
              size="xs"
              icon="external"
              :href="material.preview_url"
            >
              Open the video
            </UiBtn>
          </div>
        </div>

        <div
          v-else-if="material.status === 'failed'"
          class="mt-2.5 rounded-[12px] bg-danger-soft px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--danger-line)]"
        >
          <p class="text-[12px] leading-relaxed text-danger">
            {{ material.failure_reason ?? 'BiliMind could not read this one.' }}
          </p>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <UiBtn
              variant="secondary"
              size="xs"
              icon="refresh"
              :loading="busy"
              @click="emit('retry', material)"
            >
              Try again
            </UiBtn>
            <UiBtn
              variant="ghost"
              size="xs"
              icon="pencil"
              :disabled="busy"
              @click="emit('supply', material)"
            >
              Paste the text instead
            </UiBtn>
          </div>
        </div>

        <p
          v-else-if="emptyish"
          class="mt-2 text-[12px] leading-relaxed text-warn-text"
        >
          BiliMind opened this but found nothing to learn from. It will not be much use as a source.
        </p>
      </div>

      <UiBtn
        variant="ghost"
        size="sm"
        square
        icon="trash"
        label="Delete this file"
        class="shrink-0"
        :disabled="busy"
        @click="emit('remove', material)"
      />
    </div>
  </UiCard>
</template>
