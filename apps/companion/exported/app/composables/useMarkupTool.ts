import type { MarkupTool } from '~/types/api'
import { INK_COLORS, type MarkupSize } from '~/utils/markup'

/**
 * MARKUP — what the reader's pointer does right now, for one pane.
 *
 * One tool at a time, and `null` is a tool too: it means "reading", and it is
 * the state everything returns to. That matters more than it sounds. While a
 * pen is armed the pictures stop scrolling under a finger and the prose stops
 * opening its selection menu, so the way *out* has to be everywhere — Escape,
 * the Done button, picking the same tool again — or the lesson feels stuck.
 *
 * Colour and size outlive the tool: pick amber for a highlight, switch to the
 * pen, and the pen is amber. That is how a real desk works.
 *
 * Per pane rather than app-wide, because two lessons open side by side should
 * not share a pen: arming it in one and drawing in the other is how a stroke
 * lands on the wrong lesson.
 */
export function useMarkupTool() {
  const tool = ref<MarkupTool | null>(null)
  const color = ref<string>(INK_COLORS[0].value)
  const size = ref<MarkupSize>('thin')

  const armed = computed(() => tool.value !== null)

  /** The tools that own the pointer over a picture and need `touch-action: none`. */
  const drawing = computed(
    () =>
      tool.value === 'pen' ||
      tool.value === 'marker' ||
      tool.value === 'arrow' ||
      tool.value === 'eraser',
  )

  /** The Text tool: the pointer places and drags labels instead of drawing. */
  const placing = computed(() => tool.value === 'text')

  function arm(next: MarkupTool): void {
    tool.value = next
  }

  function disarm(): void {
    tool.value = null
  }

  /** Picking the armed tool again puts it down. */
  function toggle(next: MarkupTool): void {
    tool.value = tool.value === next ? null : next
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented) return
    disarm()
  }

  /* Bound only while armed, so a reader who never picks up a pen never pays
     for a listener — and so Escape keeps its ordinary meaning the rest of the
     time. */
  watch(armed, (on) => {
    if (!import.meta.client) return
    if (on) window.addEventListener('keydown', onKeydown)
    else window.removeEventListener('keydown', onKeydown)
  })

  onScopeDispose(() => {
    if (import.meta.client) window.removeEventListener('keydown', onKeydown)
  })

  return { tool, color, size, armed, drawing, placing, arm, disarm, toggle }
}

/**
 * Which open lesson has its pen tray out, if any — one at a time across the
 * workspace.
 *
 * The button that opens the tray lives in the workspace's top bar (and the
 * phone's), not on the lesson: a disc in the corner of the reading pane sat on
 * top of the words it was meant to mark. The bar knows which lesson is in front
 * and the lesson owns the pen, so this is the one fact they share. Holding a
 * lesson id rather than a flag is what keeps a background tab from opening its
 * tray when the foreground one does.
 */
export function useMarkupMode() {
  const nodeId = useState<number | null>('workspace:markup', () => null)

  function toggle(id: number): void {
    nodeId.value = nodeId.value === id ? null : id
  }

  function close(): void {
    nodeId.value = null
  }

  return { nodeId, toggle, close }
}
