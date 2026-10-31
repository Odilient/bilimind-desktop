<script setup lang="ts">
import type { Block } from '~/types/api'
import type { LessonDraftState } from '~/composables/useNodePlayer'
import BlockRenderer from '~/components/blocks/BlockRenderer.vue'
import { presentationOf } from '~/composables/useBlockPresentation'

/**
 * A lesson being written, on the page it will be read on.
 *
 * First the model's reasoning rolls by; then the lesson's parts arrive through
 * the same renderer the finished lesson uses, in the same column, so nothing
 * jumps when it is saved. The part being written types itself out. A quiz or an
 * exercise is only named until then: its answers are in the same reply, and the
 * server does not send them (Services\Course\LessonDraft).
 */
const props = defineProps<{
  nodeId: number
  draft: LessonDraftState
  /** How long it has been writing; null while it is still in line. */
  seconds: number | null
  /** The usual time, for the bar. */
  progress: number
  language?: string
}>()

const blocks = computed(() => props.draft.blocks ?? [])
const writing = computed(() => props.draft.writing ?? null)
const thinking = computed(() => props.draft.thinking ?? '')

function asBlock(block: { type: string; payload: unknown }, index: number): Block {
  return { id: -(index + 1), node_id: props.nodeId, position: index, type: block.type, payload: block.payload } as unknown as Block
}

/** "Quiz", "Key points": what the part is called on the finished lesson. */
function named(type: string): string {
  const label = presentationOf(type).label ?? type.replace(/_/g, ' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

const typed = useTypedText(() => writing.value?.text ?? '')

/* Follows the writing down, until the learner scrolls up to read. */
const root = ref<HTMLElement | null>(null)

watch([typed, () => blocks.value.length], async () => {
  const scroller = root.value?.closest<HTMLElement>('.om-scroll')
  if (!scroller || scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight > 200) return
  await nextTick()
  scroller.scrollTop = scroller.scrollHeight
})
</script>

<template>
  <div
    ref="root"
    class="lesson gap-y-10 px-5 pt-7 pb-24 sm:px-8 sm:pt-8 sm:pb-30"
  >
    <div class="grid gap-3">
      <p
        class="flex items-center gap-2.5 text-[14px] font-medium text-text-soft"
        role="status"
      >
        <span
          class="animate-pulse-dot grid size-6 shrink-0 place-items-center rounded-full bg-ink text-lime"
          aria-hidden="true"
        >
          <UiIcon
            name="spark"
            :size="12"
          />
        </span>
        <span class="min-w-0 flex-1 truncate">{{ draft.note }}</span>
        <span
          v-if="seconds !== null"
          class="num shrink-0 text-[12.5px] font-normal text-text-muted"
        >{{ clockLabel(seconds) }}</span>
      </p>
      <div
        v-if="seconds !== null"
        class="h-1 overflow-hidden rounded-full bg-surface-track"
      >
        <div
          class="h-full rounded-full bg-brand transition-[width] duration-1000 ease-linear"
          :style="{ width: `${Math.round(progress * 100)}%` }"
        />
      </div>
      <CompanionThinking
        v-if="thinking"
        :text="thinking"
        :length="draft.thinking_length ?? 0"
      />
    </div>

    <template
      v-for="(block, index) in blocks"
      :key="index"
    >
      <div
        v-if="block.payload"
        :class="['rise', presentationOf(block.type).measure === 'wide' && 'is-wide']"
      >
        <BlockRenderer
          :block="asBlock(block, index)"
          readonly
          :language="language"
        />
      </div>
      <p
        v-else
        class="rise rounded-[14px] bg-surface-mute px-4 py-3 text-[14px] text-text-soft shadow-[inset_0_0_0_1px_var(--border)]"
      >
        <strong class="font-semibold text-text">{{ named(block.type) }}</strong> written. It opens when the lesson is ready.
      </p>
    </template>

    <div
      v-if="writing"
      :key="`writing-${blocks.length}`"
    >
      <BlocksMarkdown
        v-if="typed"
        :source="typed"
      />
      <p
        v-else
        class="text-[14px] text-text-muted"
      >
        Writing: {{ named(writing.type) }}…
      </p>
      <span
        class="animate-pulse-dot mt-2 inline-block h-[1.05em] w-[7px] rounded-[2px] bg-text-soft"
        aria-hidden="true"
      />
    </div>
  </div>
</template>
