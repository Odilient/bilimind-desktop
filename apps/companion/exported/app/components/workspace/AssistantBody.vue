<script setup lang="ts">
import type { AssistantArtifactRef, AssistantOpener, AssistantScope } from '~/composables/useAssistant'
import type { AssistantMessage } from '~/composables/useAssistant'
import Markdown from '~/components/blocks/Markdown.vue'

/**
 * The assistant's contents, shared by the docked and floating shells.
 *
 * The scope control is the important part, and it is a control rather than a
 * label because the right grounding changes question by question: "what does
 * this term mean" wants the node, "where did we cover this" wants the course,
 * "does my lecturer agree" wants the materials.
 */
defineProps<{
  messages: AssistantMessage[]
  openers: AssistantOpener[]
  busy: boolean
  empty: boolean
  pinnedBlockId: number | null
}>()

const emit = defineEmits<{
  send: [text?: string]
  unpin: []
  openArtifact: [artifact: AssistantArtifactRef]
}>()

const scope = defineModel<AssistantScope>('scope', { required: true })
const draft = defineModel<string>('draft', { required: true })

const options = [
  { value: 'node', label: 'This lesson' },
  { value: 'course', label: 'Course' },
  { value: 'materials', label: 'Materials' },
]

const scopeProxy = computed({
  get: () => scope.value as string,
  set: (value: string) => {
    scope.value = value as AssistantScope
  },
})

const thread = ref<HTMLElement | null>(null)

/** Follow the conversation down as it grows. */
function scrollToEnd(): void {
  nextTick(() => {
    if (thread.value) thread.value.scrollTop = thread.value.scrollHeight
  })
}

defineExpose({ scrollToEnd })
</script>

<template>
  <div class="px-3.5 pb-3">
    <UiSegmented
      v-model="scopeProxy"
      :options="options"
      size="xs"
      block
      label="What the assistant is grounded in"
    />
  </div>

  <div
    ref="thread"
    class="om-scroll min-h-0 flex-1 overflow-y-auto px-3.5 pt-0.5 pb-3.5"
  >
    <template v-if="empty">
      <p class="mb-3 text-[12.5px] leading-relaxed text-text-faint">
        Grounded in <strong class="font-semibold text-text-body">{{ scopeLabel(scope) }}</strong
        >. Tap a starting point:
      </p>

      <div class="flex flex-col gap-2">
        <button
          v-for="opener in openers"
          :key="opener.q"
          type="button"
          class="cursor-pointer rounded-[12px] bg-surface px-3 py-2.5 text-left text-[12.5px] leading-[1.4] text-text-body shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.1)] transition-colors hover:bg-brand-soft hover:text-brand hover:shadow-[inset_0_0_0_1.5px_var(--brand)]"
          @click="emit('send', opener.q)"
        >
          {{ opener.q }}
        </button>
      </div>
    </template>

    <div class="flex flex-col gap-2.5">
      <template
        v-for="message in messages"
        :key="message.id"
      >
        <div
          :class="[
            'max-w-[90%] px-3 py-2.5 text-[13.5px] leading-relaxed',
            message.role === 'user'
              ? 'self-end rounded-[16px] rounded-br-[5px] bg-inverse whitespace-pre-wrap text-on-inverse'
              : 'assistant-md self-start rounded-[16px] rounded-bl-[5px] bg-surface-sunken text-text-body',
          ]"
        >
          <template v-if="message.role === 'user'">{{ message.text }}</template>
          <Markdown
            v-else
            :source="message.text"
            size="sm"
          />
        </div>

        <!-- Something the assistant made for you, ready to open in its own panel. -->
        <button
          v-if="message.artifact"
          type="button"
          class="group flex max-w-[90%] cursor-pointer items-center gap-2.5 self-start rounded-[16px] rounded-bl-[5px] bg-brand-soft px-3 py-2.5 text-left shadow-[inset_0_0_0_1px_var(--brand-line)] transition-colors hover:bg-[#e3e8fd]"
          @click="emit('openArtifact', message.artifact)"
        >
          <span class="grid size-8 shrink-0 place-items-center rounded-[10px] bg-brand text-white">
            <UiIcon
              :name="message.artifact.kind === 'pdf' ? 'file' : 'sparkles'"
              :size="16"
            />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[13px] font-semibold text-text">{{
              message.artifact.title
            }}</span>
            <span class="block text-[11.5px] text-brand">Made for you · tap to open</span>
          </span>
          <UiIcon
            name="arrow-right"
            :size="15"
            class="shrink-0 text-brand transition-transform group-hover:translate-x-0.5"
          />
        </button>
      </template>

      <div
        v-if="busy"
        class="flex gap-1 self-start rounded-[16px] rounded-bl-[5px] bg-surface-sunken px-3.5 py-3"
      >
        <span class="size-1.5 animate-blink rounded-full bg-text-faint" />
        <span class="size-1.5 animate-blink rounded-full bg-text-faint [animation-delay:0.2s]" />
        <span class="size-1.5 animate-blink rounded-full bg-text-faint [animation-delay:0.4s]" />
      </div>
    </div>
  </div>

  <div class="px-3.5 pt-2 pb-3.5">
    <div
      v-if="pinnedBlockId"
      class="mb-2 flex items-center gap-2 rounded-[10px] bg-brand-soft px-2.5 py-1.5 text-[11.5px] font-medium text-brand"
    >
      <UiIcon
        name="target"
        :size="12"
      />
      <span class="flex-1">Asking about the block you pointed at</span>
      <button
        type="button"
        class="cursor-pointer"
        aria-label="Stop asking about that block"
        @click="emit('unpin')"
      >
        <UiIcon
          name="x"
          :size="12"
        />
      </button>
    </div>

    <div class="flex items-center gap-2">
      <input
        v-model="draft"
        placeholder="Ask, or point at a block…"
        class="h-10 min-w-0 flex-1 rounded-[12px] bg-surface px-3 text-[13px] shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.12)] outline-none placeholder:text-[#9da2ae] dark:placeholder:text-text-faint focus:shadow-[inset_0_0_0_1.5px_var(--hi-2),0_0_0_4px_rgb(255_212_71/0.35)]"
        @keydown.enter="emit('send')"
      />
      <!-- Grey until there is something to send, then the ink "do it". -->
      <button
        type="button"
        class="grid size-[38px] shrink-0 cursor-pointer place-items-center rounded-[11px] bg-chip text-accent transition-colors hover:bg-inverse-hover disabled:cursor-default disabled:bg-[#9da2ae] disabled:text-white dark:hover:brightness-125 dark:disabled:bg-surface-track dark:disabled:text-text-ghost"
        aria-label="Send"
        :disabled="busy || draft.trim() === ''"
        @click="emit('send')"
      >
        <UiIcon
          name="arrow-right"
          :size="15"
          :stroke="2"
          class="-rotate-90"
        />
      </button>
    </div>
  </div>
</template>
