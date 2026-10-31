<script setup lang="ts">
import type { MenuAction } from '~/components/ui/Menu.vue'
import type { DraftBlock } from '~/composables/useLessonEditor'
import { presentationOf } from '~/composables/useBlockPresentation'
import { hasEditor } from './schema'

/**
 * The chrome around one block while the lesson is being edited: a rail on the
 * left with a drag handle and a menu, a click-to-edit surface, and the
 * "rewriting" veil. The content is the caller's — the rendered block, or its
 * editor when selected — because the frame should not know which is which.
 *
 * One primary action (click to edit) and everything else behind the menu, per
 * the not-an-admin-panel rule: a lesson in edit mode has to still look like a
 * lesson, not like a form builder.
 *
 * An open editor closes two ways, and both are on screen: Done keeps what was
 * typed, Cancel puts the part back the way it was opened. Autosave is why the
 * second one has to be a button — there is no unsaved state to walk away from.
 */
const props = defineProps<{
  block: DraftBlock
  index: number
  count: number
  selected: boolean
  rewriting: boolean
  rewriteError: string | null
}>()

const emit = defineEmits<{
  select: []
  done: []
  cancel: []
  rewrite: []
  remove: []
  duplicate: []
  moveUp: []
  moveDown: []
  dragStart: [event: DragEvent]
}>()

const editable = computed(() => hasEditor(props.block.type))

const label = computed(() => presentationOf(props.block.type).label ?? '')

const actions = computed<MenuAction[]>(() => [
  ...(editable.value && !props.selected
    ? [{ label: 'Edit', icon: 'pencil', run: () => emit('select') }]
    : []),
  { label: 'Rewrite with AI…', icon: 'sparkles', run: () => emit('rewrite') },
  { label: 'Move up', icon: 'chevron-up', disabled: props.index === 0, run: () => emit('moveUp') },
  {
    label: 'Move down',
    icon: 'chevron-down',
    disabled: props.index >= props.count - 1,
    run: () => emit('moveDown'),
  },
  { label: 'Duplicate', run: () => emit('duplicate') },
  { label: 'Remove', icon: 'trash', destructive: true, run: () => emit('remove') },
])

function onSurfaceClick(event: MouseEvent): void {
  if (props.selected || !editable.value || props.rewriting) return
  // A click on a link or a control inside the rendered block is its own thing.
  const target = event.target as HTMLElement | null
  if (target?.closest('a, button, input, textarea, select, [contenteditable]')) return
  emit('select')
}
</script>

<template>
  <div
    class="group relative"
    :data-block-key="block.key"
  >
    <!-- The rail -->
    <div
      :class="[
        'absolute top-0 -left-9 hidden flex-col items-center gap-0.5 sm:flex',
        selected ? 'opacity-100' : 'opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100',
      ]"
    >
      <button
        type="button"
        class="grid size-7 cursor-grab place-items-center rounded-[8px] text-text-faint transition-colors hover:bg-surface-mute hover:text-text active:cursor-grabbing"
        title="Drag to reorder"
        aria-label="Drag to reorder"
        draggable="true"
        @dragstart="emit('dragStart', $event)"
      >
        <UiIcon
          name="dots"
          :size="14"
        />
      </button>
      <UiMenu
        :actions="actions"
        :label="`More for this ${label || 'part'}`"
        :title="label || 'This part'"
      />
    </div>

    <!-- The surface -->
    <div
      :class="[
        'relative -mx-3 rounded-[18px] px-3 transition-shadow',
        selected
          ? 'py-3 ring-[1.5px] ring-lime-2 shadow-[0_0_0_5px_rgb(198_242_78/0.3)]'
          : editable && !rewriting
            ? 'cursor-text hover:ring-1 hover:ring-border-strong'
            : '',
      ]"
      @click="onSurfaceClick"
    >
      <slot />

      <div
        v-if="rewriting"
        class="absolute inset-0 grid place-items-center rounded-[18px] bg-surface/75 backdrop-blur-[2px]"
        aria-live="polite"
      >
        <span class="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-[12.5px] text-text-soft shadow-card">
          <UiIcon
            name="loader"
            :size="13"
            class="animate-spin-slow text-brand"
          />
          Rewriting this part…
        </span>
      </div>
    </div>

    <p
      v-if="rewriteError"
      class="mt-2 flex items-start gap-1.5 text-[12.5px] leading-snug text-danger"
    >
      <UiIcon
        name="alert"
        :size="13"
        class="mt-0.5 shrink-0"
      />
      {{ rewriteError }}
    </p>

    <div
      v-if="selected"
      class="mt-3 flex items-center justify-end gap-2"
    >
      <UiBtn
        variant="secondary"
        size="sm"
        icon="sparkles"
        @click="emit('rewrite')"
        >Rewrite with AI</UiBtn
      >
      <UiBtn
        variant="ghost"
        size="sm"
        title="Close this editor and undo what you typed into it"
        @click="emit('cancel')"
        >Cancel</UiBtn
      >
      <UiBtn
        variant="primary"
        size="sm"
        icon="check"
        @click="emit('done')"
        >Done</UiBtn
      >
    </div>
  </div>
</template>
