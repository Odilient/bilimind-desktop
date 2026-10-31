<script setup lang="ts">
/**
 * The strip on a panel's edge that drags its width. Its parent must share the
 * panel's fixed side, because the width is measured from there; the parent
 * also places it, by class. `edge` says which side of the panel it is on.
 *
 * Arrow keys move it too, and a double click puts the default back.
 */
import { usePanelWidth, type PanelName } from '~/companion/panel-width'

const props = defineProps<{ panel: PanelName, edge: 'left' | 'right', label: string }>()

const p = usePanelWidth(props.panel)
const dragging = ref(false)

function setDragging(on: boolean): void {
  dragging.value = on
  document.body.classList.toggle('panel-resizing', on)
}

function onDown(event: PointerEvent): void {
  if (event.button !== 0) return
  // Captured, so the drag survives crossing an iframe (a PDF, the sandbox).
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  setDragging(true)
}

function onMove(event: PointerEvent): void {
  if (!dragging.value) return
  const box = (event.currentTarget as HTMLElement).parentElement!.getBoundingClientRect()
  p.set(props.edge === 'right' ? event.clientX - box.left : box.right - event.clientX)
}

function onEnd(): void {
  if (!dragging.value) return
  setDragging(false)
  p.save()
}

function onKey(event: KeyboardEvent): void {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  event.preventDefault()
  const outward = event.key === (props.edge === 'right' ? 'ArrowRight' : 'ArrowLeft')
  p.set(p.width.value + (outward ? 16 : -16))
  p.save()
}

function onReset(): void {
  p.reset()
  p.save()
}

// Unmounted mid-drag (Esc closes a floating sidebar): the page must get its
// transitions back.
onBeforeUnmount(() => {
  if (dragging.value) setDragging(false)
})
</script>

<template>
  <div
    role="separator"
    aria-orientation="vertical"
    :aria-label="label"
    :aria-valuenow="p.width.value"
    :aria-valuemin="p.spec.min"
    :aria-valuemax="p.spec.max"
    tabindex="0"
    class="group/resize absolute inset-y-0 z-30 w-2 cursor-col-resize touch-none outline-none max-lg:hidden"
    @pointerdown="onDown"
    @pointermove="onMove"
    @lostpointercapture="onEnd"
    @dblclick="onReset"
    @keydown="onKey"
  >
    <span
      :class="[
        'absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-cobalt transition-opacity duration-150 group-hover/resize:opacity-100 group-hover/resize:delay-150 group-focus-visible/resize:opacity-100',
        dragging ? 'opacity-100' : 'opacity-0',
      ]"
    />
  </div>
</template>

<style>
/* The panels animate their width when they open; a drag must follow the hand. */
body.panel-resizing,
body.panel-resizing * {
  transition: none !important;
  user-select: none;
}
</style>
