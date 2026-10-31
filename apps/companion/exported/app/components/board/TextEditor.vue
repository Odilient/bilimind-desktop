<script setup lang="ts">
/**
 * Typing on the board. A real textarea, laid over the object it edits, so
 * the phone's keyboard, IME, spellcheck and autocorrect all just work.
 *
 * It is laid out in board units and scaled by the camera, so the type sits
 * exactly where the canvas will draw it once the edit commits; the canvas
 * hides that object meanwhile.
 *
 * Keys: Escape or a click elsewhere finishes. On a mind node, Enter finishes
 * and Tab finishes and adds a child (then Enter on the selected node adds a
 * sibling). On notes, Enter is a new line and Cmd/Ctrl+Enter finishes.
 */
import type { BoardController } from '~/companion/board/controller'
import { mindSize, mindStyle, shapeTextWidth } from '~/companion/board/draw'
import { depthOf } from '~/companion/board/mindmap'
import { mindNodes } from '~/companion/board/ops'
import { FONT, INK, PEN, SHAPE_FILL, STICKY } from '~/companion/board/palette'

const props = defineProps<{ ctl: BoardController }>()
const area = ref<HTMLTextAreaElement>()

const ed = computed(() => props.ctl.ui.editing)
const obj = computed(() => (ed.value ? props.ctl.get(ed.value.id) : undefined))

const placeholder = computed(() => {
  const k = obj.value?.kind
  return k === 'mind' ? 'Type an idea' : k === 'frame' ? 'Frame title' : k === 'text' ? 'Type something' : 'Type here'
})

/** The editor's box and type, in board units, for the object being edited. */
const look = computed(() => {
  const o = obj.value
  const text = ed.value?.text ?? ''
  if (!o) return null
  const base = { x: o.x, y: o.y, w: o.w, h: o.h, font: `400 14px/19px ${FONT.body}`, pad: '10px 12px', bg: 'transparent', border: 'none', radius: '3px', align: 'left' as 'left' | 'center', color: INK.text, clip: '' }
  switch (o.kind) {
    case 'sticky':
      return { ...base, bg: STICKY[o.color] ?? STICKY.yellow }
    case 'shape': {
      const tw = shapeTextWidth(o)
      return {
        ...base, font: `500 14px/19px ${FONT.body}`, align: 'center' as const, pad: `0 ${(o.w - tw) / 2}px`,
        bg: SHAPE_FILL[o.fill] ?? '#fff', border: `1.5px solid ${PEN[o.stroke] ?? PEN.ink}`,
        radius: o.shape === 'ellipse' ? '50%' : o.shape === 'diamond' ? '0' : '6px',
        clip: o.shape === 'diamond' ? 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)' : '',
      }
    }
    case 'text':
      return { ...base, font: `500 ${o.size}px/${Math.round(o.size * 1.3)}px ${FONT.body}`, pad: '0', h: Math.max(o.h, Math.round(o.size * 1.3)) }
    case 'frame':
      return { ...base, y: o.y - 22, h: 20, w: Math.max(200, o.w * 0.6), font: `600 12.5px/16px ${FONT.body}`, pad: '2px', color: INK.dim, bg: '#fff', radius: '4px' }
    case 'mind': {
      const depth = depthOf(mindNodes(props.ctl.parts), o.id)
      const st = mindStyle(depth)
      const size = mindSize({ text: text || ' ', source: o.source, hint: o.hint }, depth)
      const w = Math.max(size.w, 96)
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2
      return {
        ...base, x: cx - w / 2, y: cy - size.h / 2, w, h: size.h,
        font: `${st.weight} ${st.size}px/${Math.round(st.size * 1.3)}px ${st.family}`,
        pad: `${st.padY}px ${st.padX}px`, align: 'center' as const, radius: `${st.r}px`,
        bg: depth === 0 ? o.color : '#fff', color: depth === 0 ? '#fff' : depth === 1 ? INK.text : INK.dim,
        border: depth === 0 ? 'none' : `${depth === 1 ? 1.5 : 1}px solid ${depth === 1 ? o.color : INK.lineStrong}`,
      }
    }
    default:
      return base
  }
})

const style = computed(() => {
  const l = look.value
  if (!l) return {}
  void props.ctl.ui.version
  const cam = props.ctl.ui.camera
  return {
    transform: `translate(${l.x * cam.scale + cam.x}px, ${l.y * cam.scale + cam.y}px) scale(${cam.scale})`,
    width: `${l.w}px`,
    minHeight: `${l.h}px`,
    background: l.bg,
    border: l.border,
    borderRadius: l.radius,
    clipPath: l.clip || undefined,
    alignItems: obj.value?.kind === 'shape' || obj.value?.kind === 'mind' ? 'center' : 'flex-start',
  }
})

function grow() {
  const a = area.value
  if (!a) return
  a.style.height = 'auto'
  a.style.height = `${a.scrollHeight}px`
}

function onInput(e: Event) {
  props.ctl.editText((e.target as HTMLTextAreaElement).value)
  nextTick(grow)
}

function onKey(e: KeyboardEvent) {
  const kind = obj.value?.kind
  e.stopPropagation()
  if (e.key === 'Escape') {
    e.preventDefault()
    props.ctl.commitEdit()
  } else if (e.key === 'Tab') {
    e.preventDefault()
    props.ctl.commitEdit(kind === 'mind' ? 'child' : undefined)
  } else if (e.key === 'Enter' && (kind === 'mind' || kind === 'frame') && !e.shiftKey) {
    e.preventDefault()
    props.ctl.commitEdit()
  } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    props.ctl.commitEdit()
  }
}

// A new edit (Tab adds a child and opens it) re-focuses the same textarea.
watch(() => ed.value?.id, async () => {
  await nextTick()
  const a = area.value
  if (!a) return
  a.focus({ preventScroll: true })
  // A new frame's "Frame 2" is a placeholder: selected, so typing replaces it.
  if (ed.value?.fresh && ed.value.kind === 'frame') a.select()
  else a.setSelectionRange(a.value.length, a.value.length)
  grow()
}, { immediate: true })

function onBlur() {
  // Let a click on the toolbar run first; it commits through setTool anyway.
  setTimeout(() => {
    if (document.activeElement !== area.value) props.ctl.commitEdit()
  }, 0)
}
</script>

<template>
  <div
    v-if="look"
    class="bedit"
    :style="style"
    @pointerdown.stop
    @dblclick.stop
    @wheel.stop
  >
    <textarea
      ref="area"
      :value="ed?.text ?? ''"
      :placeholder="placeholder"
      :style="{ font: look.font, padding: look.pad, textAlign: look.align, color: look.color }"
      rows="1"
      spellcheck="true"
      @input="onInput"
      @keydown="onKey"
      @blur="onBlur"
    />
  </div>
</template>

<style scoped>
.bedit {
  position: absolute; left: 0; top: 0; z-index: 4; transform-origin: 0 0;
  display: flex; align-items: center; overflow: hidden;
  box-shadow: 0 0 0 1.5px var(--cobalt);
  user-select: text; -webkit-user-select: text;
}
textarea {
  display: block; width: 100%; border: 0; outline: 0; resize: none; overflow: hidden;
  background: transparent; letter-spacing: normal; word-break: break-word;
}
textarea::placeholder { color: rgb(11 13 16 / 0.35); }
</style>
