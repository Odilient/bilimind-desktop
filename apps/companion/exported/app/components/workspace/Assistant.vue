<script setup lang="ts">
import type { Block } from '~/types/api'
import type { AssistantMode } from '~/composables/useWorkspace'
import type { AssistantArtifactRef } from '~/composables/useAssistant'

/**
 * The assistant in its three homes.
 *
 * Docked and floating both exist because the two are not the same tool. Docked,
 * it is a reading companion and the content narrows to make room for it.
 * Floating, it is a thing you summoned for one question and will dismiss — so
 * it overlays rather than reflows, and nothing you were reading moves.
 */
const props = defineProps<{
  courseId: number
  nodeId: number | null
  nodeTitle: string
  blocks: Block[]
}>()

const mode = defineModel<AssistantMode>('mode', { required: true })

const emit = defineEmits<{
  openArtifact: [artifact: AssistantArtifactRef]
}>()

const assistant = useAssistant(
  () => props.courseId,
  () => props.nodeId,
)

const { scope, messages, draft, busy, empty, pinnedBlockId } = assistant

const body = ref<{ scrollToEnd: () => void } | null>(null)

const openers = computed(() => deriveOpeners(props.blocks, props.nodeTitle))

function send(text?: string): void {
  void assistant.send(text).then(() => body.value?.scrollToEnd())
  body.value?.scrollToEnd()
}

/* A new node means new grounding; carrying the old thread over would silently
   answer the next question from the wrong context. */
watch(
  () => props.nodeId,
  () => assistant.reset(),
)
</script>

<template>
  <!-- ------------------------------------------------------------------ -->
  <!-- Docked                                                              -->
  <!-- ------------------------------------------------------------------ -->
  <aside
    v-if="mode === 'docked'"
    class="flex w-[312px] shrink-0 flex-col border-l border-border bg-surface"
    aria-label="Assistant"
  >
    <div class="flex h-[54px] shrink-0 items-center gap-2 pr-3 pl-4">
      <UiIcon
        name="spark"
        :size="15"
        class="text-brand"
      />
      <span class="font-display text-[15px] font-semibold tracking-[-0.01em]">Assistant</span>
      <span class="flex-1" />
      <button
        type="button"
        title="Pop out to float"
        aria-label="Pop out to float"
        class="grid size-7 cursor-pointer place-items-center rounded-[8px] text-text-faint transition-colors hover:bg-surface-rail hover:text-text"
        @click="mode = 'float'"
      >
        <UiIcon
          name="pop-out"
          :size="15"
          :stroke="1.8"
        />
      </button>
      <button
        type="button"
        title="Close assistant"
        aria-label="Close assistant"
        class="grid size-7 cursor-pointer place-items-center rounded-[8px] text-text-faint transition-colors hover:bg-surface-rail hover:text-text"
        @click="mode = 'closed'"
      >
        <UiIcon
          name="x"
          :size="14"
          :stroke="2"
        />
      </button>
    </div>

    <WorkspaceAssistantBody
      ref="body"
      v-model:scope="scope"
      v-model:draft="draft"
      :messages="messages"
      :openers="openers"
      :busy="busy"
      :empty="empty"
      :pinned-block-id="pinnedBlockId"
      @send="send"
      @unpin="assistant.pin(null)"
      @open-artifact="emit('openArtifact', $event)"
    />
  </aside>

  <!-- ------------------------------------------------------------------ -->
  <!-- Floating                                                            -->
  <!-- ------------------------------------------------------------------ -->
  <aside
    v-else-if="mode === 'float'"
    class="animate-rise absolute right-4.5 bottom-4.5 z-30 flex h-[564px] max-h-[calc(100%-24px)] w-[372px] max-w-[calc(100%-40px)] flex-col overflow-hidden rounded-[22px] bg-surface shadow-pop ring-1 ring-border"
    aria-label="Assistant"
  >
    <div class="flex h-[54px] shrink-0 items-center gap-2 pr-3 pl-4">
      <UiIcon
        name="spark"
        :size="15"
        class="text-brand"
      />
      <span class="font-display text-[15px] font-semibold tracking-[-0.01em]">Assistant</span>
      <span
        class="rounded-full bg-brand-soft px-2 py-0.5 text-[10.5px] font-semibold tracking-[0.04em] text-brand uppercase"
        >Floating</span
      >
      <span class="flex-1" />
      <button
        type="button"
        title="Dock to the right side"
        aria-label="Dock to the right side"
        class="grid size-7 cursor-pointer place-items-center rounded-[8px] text-text-faint transition-colors hover:bg-surface-rail hover:text-text"
        @click="mode = 'docked'"
      >
        <UiIcon
          name="dock"
          :size="15"
          :stroke="1.8"
        />
      </button>
      <button
        type="button"
        title="Close assistant"
        aria-label="Close assistant"
        class="grid size-7 cursor-pointer place-items-center rounded-[8px] text-text-faint transition-colors hover:bg-surface-rail hover:text-text"
        @click="mode = 'closed'"
      >
        <UiIcon
          name="x"
          :size="14"
          :stroke="2"
        />
      </button>
    </div>

    <WorkspaceAssistantBody
      ref="body"
      v-model:scope="scope"
      v-model:draft="draft"
      :messages="messages"
      :openers="openers"
      :busy="busy"
      :empty="empty"
      :pinned-block-id="pinnedBlockId"
      @send="send"
      @unpin="assistant.pin(null)"
      @open-artifact="emit('openArtifact', $event)"
    />
  </aside>

  <!-- Closed: nothing here. The way back is the Assistant button in the
       workspace's top bar — a pill in the corner of the reading pane sat on
       top of the lesson, so it went up there with the pen. -->
</template>
