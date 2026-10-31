<script setup lang="ts">
import type { BlockType } from '~/types/api'
import { INSERT_GROUPS, type InsertChoice } from './schema'
import { INPUT } from './fields/classes'

/**
 * The seam between two blocks. A hairline with a `+` that appears on hover;
 * choosing a format inserts it here. An optional line of intent ("about the
 * bees' winter cluster") turns any choice into "let the model write it", and
 * is the only way to add the formats a form cannot hold.
 */
const props = defineProps<{
  /** Course allows code exercises (they are hidden otherwise). */
  allowsCode?: boolean
  /** Always visible — for the end of the lesson, where there is no next block to hover between. */
  standalone?: boolean
}>()

const emit = defineEmits<{
  insert: [type: BlockType, instruction: string | null]
}>()

const open = ref(false)
const intent = ref('')
const root = ref<HTMLElement | null>(null)

const groups = computed(() =>
  INSERT_GROUPS.map((group) => ({
    ...group,
    choices: group.choices.filter((choice) => !choice.needsCode || props.allowsCode),
  })),
)

function choose(choice: InsertChoice): void {
  const text = intent.value.trim()
  emit('insert', choice.type, choice.ai || text !== '' ? text || null : null)
  open.value = false
  intent.value = ''
}

function onDocumentClick(event: MouseEvent): void {
  if (!open.value) return
  if (root.value && !root.value.contains(event.target as Node)) open.value = false
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') open.value = false
}

watch(open, (isOpen) => {
  if (!import.meta.client) return
  if (isOpen) {
    document.addEventListener('mousedown', onDocumentClick)
    document.addEventListener('keydown', onKeydown)
  } else {
    document.removeEventListener('mousedown', onDocumentClick)
    document.removeEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    ref="root"
    :class="['relative', standalone ? 'py-1' : 'group/seam h-5']"
  >
    <div
      :class="[
        'flex items-center gap-2',
        standalone
          ? ''
          : 'absolute inset-x-0 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover/seam:opacity-100 focus-within:opacity-100',
        open && 'opacity-100',
      ]"
    >
      <span
        v-if="!standalone"
        class="h-px flex-1 bg-border-dashed"
      />
      <button
        type="button"
        :class="[
          'flex cursor-pointer items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3 py-1 text-[12px] font-semibold text-text-soft transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand',
          open && 'border-brand bg-brand-soft text-brand',
        ]"
        :aria-expanded="open"
        @click="open = !open"
      >
        <UiIcon
          name="plus"
          :size="12"
          :stroke="2.2"
        />
        {{ standalone ? 'Add a part' : 'Add' }}
      </button>
      <span
        v-if="!standalone"
        class="h-px flex-1 bg-border-dashed"
      />
    </div>

    <div
      v-if="open"
      class="pop-in absolute left-1/2 z-30 mt-3 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 rounded-[18px] bg-surface p-4 shadow-pop ring-1 ring-border"
      :class="standalone ? 'top-full' : 'top-full'"
      role="dialog"
      aria-label="Add a part"
    >
      <input
        v-model="intent"
        type="text"
        :class="[INPUT, 'mb-3']"
        placeholder="What should it be about? Leave empty to write it yourself."
        @keydown.enter.prevent
      />

      <div class="grid gap-3 sm:grid-cols-2">
        <div
          v-for="group in groups"
          :key="group.title"
        >
          <p class="eyebrow mb-1.5">{{ group.title }}</p>
          <div class="flex flex-col">
            <button
              v-for="choice in group.choices"
              :key="choice.type"
              type="button"
              class="flex cursor-pointer items-baseline gap-2 rounded-[10px] px-2 py-1.5 text-left transition-colors hover:bg-surface-mute"
              @click="choose(choice)"
            >
              <span class="text-[13px] font-medium text-text-dim">{{ choice.label }}</span>
              <span class="min-w-0 flex-1 truncate text-[11.5px] text-text-faint">{{ choice.blurb }}</span>
              <UiIcon
                v-if="choice.ai"
                name="sparkles"
                :size="11"
                class="shrink-0 text-brand"
                title="Written by the model"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
