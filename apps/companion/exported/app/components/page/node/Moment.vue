<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { usePageEnv } from '~/companion/doc/editor/env'
import { transcriptAt } from '~/companion/doc/transcript'
import { timecode } from '~/companion/time'
import { autosize } from '~/companion/doc/editor/viewport'

/**
 * A moment: one second of a recording and what was said there. The chip moves
 * the app's player to that second; it never starts playback on its own. The
 * time can be corrected by hand, and the quote is the learner's to edit.
 */
const props = defineProps(nodeViewProps)
const env = usePageEnv()

const seconds = computed(() => Number(props.node.attrs.at_seconds ?? 0))
const quote = ref(String(props.node.attrs.quote ?? ''))
const editingTime = ref(false)
const timeDraft = ref('')
const quoteEl = ref<HTMLTextAreaElement | null>(null)

const recordingTitle = computed(() => {
  const rec = env.ctx.value.recording
  return rec && rec.id === props.node.attrs.item_id ? rec.title : 'Recording'
})

watch(
  () => props.node.attrs.quote,
  (value) => {
    if (document.activeElement !== quoteEl.value) quote.value = String(value ?? '')
  },
)

function seek(): void {
  env.seek(props.node.attrs.item_id ?? null, seconds.value)
}

function editTime(): void {
  timeDraft.value = timecode(seconds.value)
  editingTime.value = true
}

/** "41:20", "1:02:30", or plain seconds. */
function parseTime(value: string): number | null {
  const parts = value.trim().split(':').map((p) => Number(p))
  if (!parts.length || parts.some((p) => !Number.isFinite(p) || p < 0)) return null
  return parts.reduce((total, p) => total * 60 + p, 0)
}

function commitTime(): void {
  const next = parseTime(timeDraft.value)
  editingTime.value = false
  if (next == null || next === seconds.value) return
  const attrs: Record<string, unknown> = { at_seconds: next }
  // An untouched quote follows the time to what was said there.
  if (!quote.value.trim()) {
    const said = transcriptAt(env.ctx.value, next)
    if (said) {
      attrs.quote = said
      quote.value = said
    }
  }
  props.updateAttributes(attrs)
}

function writeQuote(value: string): void {
  quote.value = value
  props.updateAttributes({ quote: value })
  autosize(quoteEl.value)
}

onMounted(() => autosize(quoteEl.value))
</script>

<template>
  <NodeViewWrapper class="pg-moment">
    <div
      class="pg-moment-time"
      contenteditable="false"
    >
      <input
        v-if="editingTime"
        v-model="timeDraft"
        class="pg-moment-input"
        aria-label="Second of the recording"
        @keydown.enter.prevent="commitTime"
        @keydown.esc.prevent="editingTime = false"
        @blur="commitTime"
      >
      <button
        v-else
        type="button"
        class="pg-cite pg-moment-chip"
        :aria-label="`Go to ${timecode(seconds)} in the recording`"
        @click="seek"
        @dblclick="editor.isEditable && editTime()"
      >
        <UiIcon
          name="play"
          :size="9"
          :stroke="2.4"
        />{{ timecode(seconds) }}
      </button>
      <button
        v-if="editor.isEditable && !editingTime"
        type="button"
        class="pg-moment-edit"
        aria-label="Change the time"
        @click="editTime"
      >
        <UiIcon
          name="pencil"
          :size="11"
        />
      </button>
    </div>
    <div class="pg-moment-main">
      <textarea
        ref="quoteEl"
        :value="quote"
        class="pg-moment-quote"
        rows="1"
        placeholder="What was said here"
        aria-label="What was said at this moment"
        :readonly="!editor.isEditable"
        @input="writeQuote(($event.target as HTMLTextAreaElement).value)"
      />
      <span
        class="pg-moment-src"
        contenteditable="false"
      >{{ recordingTitle }}</span>
    </div>
  </NodeViewWrapper>
</template>
