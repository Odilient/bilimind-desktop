<script setup lang="ts">
import type { ReflectionBlock } from '~/types/api'
import BlockShell from './BlockShell.vue'

/**
 * Ungraded by design (SPEC §3). The note stays in this browser — saying so is
 * the whole point of the block.
 */
const props = defineProps<{
  block: ReflectionBlock
  readonly?: boolean
}>()

const prompt = computed(() => String(props.block.payload?.prompt ?? '').trim())

const storageKey = computed(() => `bilimind:reflection:${props.block.id}`)
const note = ref('')
const saved = ref(false)

let timer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  try {
    note.value = window.localStorage.getItem(storageKey.value) ?? ''
  } catch {
    /* private mode — the note simply does not persist */
  }
})

watch(note, (value) => {
  if (props.readonly) return
  if (timer) clearTimeout(timer)

  timer = setTimeout(() => {
    try {
      if (value.trim() === '') window.localStorage.removeItem(storageKey.value)
      else window.localStorage.setItem(storageKey.value, value)
      saved.value = true
      setTimeout(() => (saved.value = false), 1500)
    } catch {
      /* nothing to do */
    }
  }, 500)
})

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <BlockShell
    :type="block.type"
    :source-material-ids="block.source_material_ids"
  >
    <p class="font-display text-[19px] leading-snug font-semibold tracking-[-0.02em]">
      {{ prompt || 'Take a moment on this.' }}
    </p>

    <div
      v-if="!readonly"
      class="mt-3"
    >
      <UiTextField
        v-model="note"
        multiline
        :rows="3"
        placeholder="Answer it for yourself — nobody grades this."
        aria-label="Your reflection"
      />
      <p class="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-text-faint">
        <UiIcon
          :name="saved ? 'check' : 'lock'"
          :size="12"
        />
        {{ saved ? 'Saved in this browser' : 'Kept in this browser only — never sent anywhere' }}
      </p>
    </div>
  </BlockShell>
</template>
