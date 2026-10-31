<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'

/**
 * The phone's toolbar, resting on the keyboard: text styles, a list, a to-do,
 * "/" for every block, the camera for the whiteboard, and the mic for a
 * moment of the class that's being recorded. Each button carries its name
 * under the glyph, the way the app's tab bar does, so "/" and the mic say
 * what they're for; the one that's on is ink.
 */
const props = defineProps<{ editor: Editor; bottom: number; slashOpen: boolean; canMoment: boolean }>()
const emit = defineEmits<{ camera: []; moment: [] }>()

const styles = ref(false)

function slash(): void {
  const { state } = props.editor
  const { $from } = state.selection
  const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 1), $from.parentOffset, ' ')
  // The menu opens on a "/" at the start of a line or after a space.
  props.editor.chain().focus().insertContent(before && before !== ' ' ? ' /' : '/').run()
}

const STYLES = [
  { id: 'p', label: 'Text', run: (e: Editor) => e.chain().focus().setParagraph().run(), on: (e: Editor) => e.isActive('paragraph') },
  { id: 'h1', label: 'H1', run: (e: Editor) => e.chain().focus().toggleHeading({ level: 1 }).run(), on: (e: Editor) => e.isActive('heading', { level: 1 }) },
  { id: 'h2', label: 'H2', run: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run(), on: (e: Editor) => e.isActive('heading', { level: 2 }) },
  { id: 'h3', label: 'H3', run: (e: Editor) => e.chain().focus().toggleHeading({ level: 3 }).run(), on: (e: Editor) => e.isActive('heading', { level: 3 }) },
  { id: 'b', label: 'B', run: (e: Editor) => e.chain().focus().toggleBold().run(), on: (e: Editor) => e.isActive('bold') },
  { id: 'i', label: 'I', run: (e: Editor) => e.chain().focus().toggleItalic().run(), on: (e: Editor) => e.isActive('italic') },
  { id: 'mark', label: 'Mark', run: (e: Editor) => e.chain().focus().toggleHighlight().run(), on: (e: Editor) => e.isActive('highlight') },
  { id: 'quote', label: 'Quote', run: (e: Editor) => e.chain().focus().toggleBlockquote().run(), on: (e: Editor) => e.isActive('blockquote') },
]
</script>

<template>
  <div
    class="pg-phonebar"
    :style="{ bottom: `${bottom}px` }"
    @mousedown.prevent
  >
    <div
      v-if="styles"
      class="pg-phonebar-styles"
      role="toolbar"
      aria-label="Text style"
    >
      <button
        v-for="s in STYLES"
        :key="s.id"
        type="button"
        :class="[{ on: s.on(editor) }, `is-${s.id}`]"
        :aria-pressed="s.on(editor)"
        @click="s.run(editor)"
      >
        {{ s.label }}
      </button>
    </div>
    <div
      class="pg-kbar"
      role="toolbar"
      aria-label="Editing"
    >
      <button
        type="button"
        class="is-aa"
        :class="{ on: styles }"
        :aria-expanded="styles"
        @click="styles = !styles"
      >
        <span
          class="pg-kbar-glyph"
          aria-hidden="true"
        >Aa</span>
        <span class="pg-kbar-label">Style</span>
      </button>
      <button
        type="button"
        :class="{ on: editor.isActive('bulletList') }"
        :aria-pressed="editor.isActive('bulletList')"
        @click="editor.chain().focus().toggleBulletList().run()"
      >
        <PageIcon
          name="bullets"
          :size="18"
        />
        <span class="pg-kbar-label">List</span>
      </button>
      <button
        type="button"
        :class="{ on: editor.isActive('taskList') }"
        :aria-pressed="editor.isActive('taskList')"
        @click="editor.chain().focus().toggleTaskList().run()"
      >
        <PageIcon
          name="todo"
          :size="18"
        />
        <span class="pg-kbar-label">To-do</span>
      </button>
      <button
        type="button"
        class="is-slash"
        :class="{ on: slashOpen }"
        @click="slash"
      >
        <span
          class="pg-kbar-glyph"
          aria-hidden="true"
        >/</span>
        <span class="pg-kbar-label">Insert</span>
      </button>
      <button
        type="button"
        @click="emit('camera')"
      >
        <PageIcon
          name="camera"
          :size="18"
        />
        <span class="pg-kbar-label">Photo</span>
      </button>
      <button
        type="button"
        :title="canMoment ? 'Quote this moment of the recording' : 'No recording for this class'"
        :disabled="!canMoment"
        @click="emit('moment')"
      >
        <UiIcon
          name="mic"
          :size="18"
        />
        <span class="pg-kbar-label">Moment</span>
      </button>
    </div>
  </div>
</template>
