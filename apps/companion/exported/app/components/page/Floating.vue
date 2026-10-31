<script setup lang="ts">
import { autoUpdate, computePosition, flip, offset, shift, size } from '@floating-ui/dom'

/**
 * A panel pinned to a point in the text (the "/" or "@" just typed). It
 * follows the caret through scrolling and resizing, flips above when there's
 * no room below, and reports a click anywhere else so the menu can close.
 */
const props = defineProps<{ rect: (() => DOMRect | null) | null; label: string }>()
const emit = defineEmits<{ outside: [] }>()

const el = ref<HTMLElement | null>(null)
const style = ref<Record<string, string>>({ left: '0px', top: '0px', visibility: 'hidden' })
let stop: (() => void) | null = null

function reference() {
  return {
    getBoundingClientRect: () => props.rect?.() ?? new DOMRect(),
  }
}

function place(): void {
  if (!el.value) return
  void computePosition(reference(), el.value, {
    placement: 'bottom-start',
    strategy: 'fixed',
    middleware: [
      offset(6),
      flip({ padding: 12 }),
      shift({ padding: 12 }),
      size({
        padding: 12,
        apply({ availableHeight, elements }) {
          elements.floating.style.maxHeight = `${Math.min(360, Math.max(160, availableHeight))}px`
        },
      }),
    ],
  }).then(({ x, y }) => {
    style.value = { left: `${x}px`, top: `${y}px`, visibility: 'visible' }
  })
}

function onPointerDown(event: PointerEvent): void {
  if (el.value && !el.value.contains(event.target as Node)) emit('outside')
}

onMounted(() => {
  if (el.value) stop = autoUpdate(reference(), el.value, place)
  document.addEventListener('pointerdown', onPointerDown, true)
})

watch(() => props.rect, place)

onBeforeUnmount(() => {
  stop?.()
  document.removeEventListener('pointerdown', onPointerDown, true)
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="el"
      class="pg-float"
      role="listbox"
      :aria-label="label"
      :style="style"
      @mousedown.prevent
    >
      <slot />
    </div>
  </Teleport>
</template>
