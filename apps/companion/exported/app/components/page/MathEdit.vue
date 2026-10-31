<script setup lang="ts">
import katex from 'katex'
import type { Editor } from '@tiptap/vue-3'
import type { MathEdit } from '~/companion/doc/editor/usePageEditor'

/**
 * Editing a formula: the LaTeX on top, how it will look underneath, drawn as
 * you type. Opens beside the formula that was clicked; emptying it and saving
 * removes the formula.
 */
const props = defineProps<{ math: MathEdit; editor: Editor }>()
const emit = defineEmits<{ save: [latex: string]; close: [] }>()

const draft = ref(props.math.latex)
const field = ref<HTMLTextAreaElement | null>(null)
const style = ref<Record<string, string>>({})

const preview = computed(() => {
  try {
    return katex.renderToString(draft.value || '\\;', {
      throwOnError: true,
      displayMode: props.math.kind === 'block',
    })
  } catch {
    return ''
  }
})

function place(): void {
  const dom = props.editor.view.nodeDOM(props.math.pos) as HTMLElement | null
  const rect = dom?.getBoundingClientRect()
  if (!rect) return
  const width = Math.min(420, window.innerWidth - 24)
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
  const below = rect.bottom + 8
  const top = below + 240 > window.innerHeight ? Math.max(12, rect.top - 248) : below
  style.value = { left: `${left}px`, top: `${top}px`, width: `${width}px` }
}

onMounted(() => {
  place()
  field.value?.focus()
  field.value?.select()
})
</script>

<template>
  <Teleport to="body">
    <div
      class="pg-mathedit"
      :style="style"
      role="dialog"
      aria-label="Edit formula"
      @keydown.esc.prevent="emit('close')"
    >
      <textarea
        ref="field"
        v-model="draft"
        class="pg-field pg-mathedit-src"
        rows="2"
        spellcheck="false"
        aria-label="Formula in LaTeX"
        @keydown.enter.exact.prevent="emit('save', draft)"
      />
      <div
        class="pg-mathedit-preview"
        :class="{ 'is-bad': !preview }"
      >
        <span
          v-if="preview"
          v-html="preview"
        />
        <span v-else>Not quite valid yet</span>
      </div>
      <div class="pg-mathedit-actions">
        <button
          type="button"
          class="pg-link-btn"
          @click="emit('save', '')"
        >
          Remove
        </button>
        <span class="grow" />
        <button
          type="button"
          class="pg-btn is-quiet"
          @click="emit('close')"
        >
          Cancel
        </button>
        <button
          type="button"
          class="pg-btn"
          @click="emit('save', draft)"
        >
          Save
        </button>
      </div>
    </div>
  </Teleport>
</template>
