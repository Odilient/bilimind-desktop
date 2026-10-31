<script setup lang="ts">
/**
 * "Paste text": the syllabus from an email, a teacher's announcement, notes
 * copied out of a PDF that won't upload. One big field, a running word
 * count, and Add. Opened again from its chip, it edits the same text.
 */
import { wordsIn } from '~/companion/create'

const props = defineProps<{
  /** The text being edited, when the chip was clicked; empty for a new paste. */
  initial?: string
}>()

const emit = defineEmits<{ save: [text: string] }>()

const open = defineModel<boolean>('open', { default: false })
const text = ref('')

watch(open, (now) => {
  if (now) text.value = props.initial ?? ''
})

const words = computed(() => wordsIn(text.value))

function save(): void {
  if (!text.value.trim()) return
  emit('save', text.value)
  open.value = false
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    save()
  }
}
</script>

<template>
  <UiModal
    v-model:open="open"
    :title="initial ? 'Edit pasted text' : 'Paste text'"
    description="A syllabus, an announcement, notes: anything with the course in it. Dates in it become deadlines."
    size="lg"
  >
    <label
      for="cp-create-paste"
      class="sr-only"
    >Text to add</label>
    <textarea
      id="cp-create-paste"
      v-model="text"
      autofocus
      rows="12"
      placeholder="Paste here…"
      class="block max-h-[52vh] min-h-[220px] w-full resize-y rounded-[16px] border border-border-field bg-surface px-4 py-3 text-[15px] leading-relaxed text-text outline-none placeholder:text-text-faint focus:border-cobalt focus:ring-3 focus:ring-brand-line"
      @keydown="onKeydown"
    />
    <template #footer>
      <span class="mr-auto text-[13px] text-text-muted">
        {{ words ? `${words.toLocaleString('en')} word${words === 1 ? '' : 's'}` : 'Nothing yet' }}
      </span>
      <UiBtn
        variant="ghost"
        @click="open = false"
      >
        Cancel
      </UiBtn>
      <UiBtn
        variant="primary"
        :disabled="!text.trim()"
        title="Add (⌘Enter)"
        @click="save"
      >
        {{ initial ? 'Save' : 'Add text' }}
      </UiBtn>
    </template>
  </UiModal>
</template>
