<script lang="ts">
/**
 * Render ids must be unique across the whole document, not per instance.
 * Mermaid builds each diagram inside a temporary element it finds again by
 * that id; the workspace mounts every lesson twice (desktop and phone layouts,
 * one hidden by CSS), and two instances counting from 1 each asked for
 * `bilimind-diagram-417-1`. The second render drew into the first: every box
 * doubled, offset, its label clipped.
 */
let renders = 0
</script>

<script setup lang="ts">
import type { DiagramBlock } from '~/types/api'
import BlockShell from './BlockShell.vue'

/**
 * EXPAND §2/§6 — a Mermaid diagram, rendered client-side.
 *
 * Three things this has to get right:
 *  - Mermaid is ~500 KB, so it is imported dynamically and only on a page that
 *    actually has a diagram on it.
 *  - Mermaid throws on malformed source. The backend rejects the obvious breakage
 *    before persisting, but it cannot run the real parser, so a render failure has
 *    to degrade to the alt text rather than take the lesson down with it.
 *  - `securityLevel: 'strict'` disables click handlers and inline HTML in labels.
 *    The source is model-authored, and a diagram is not a place to trust it.
 */
const props = defineProps<{ block: DiagramBlock }>()

const container = ref<HTMLElement | null>(null)
const svg = ref<string>('')
const failed = ref(false)
const rendering = ref(true)


async function render(): Promise<void> {
  const source = props.block.payload?.source?.trim()

  if (!source) {
    failed.value = true
    rendering.value = false

    return
  }

  rendering.value = true
  failed.value = false

  try {
    const mermaid = (await import('mermaid')).default

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      // Mermaid's own palettes read as a foreign object dropped into the lesson.
      // Hex, not `var()`: Mermaid computes shades from these in JS. They are
      // cobalt's tokens, drawn the way the course player draws a diagram:
      // white boxes ruled in ink on the dotted canvas, grey connectors, a
      // cobalt-soft fill for the second kind of shape and lime-soft for the
      // third. (Cream and Instrument Sans until the cobalt remake.)
      themeVariables: {
        background: '#f6f7fa',
        primaryColor: '#ffffff',
        primaryBorderColor: '#2a2e37',
        primaryTextColor: '#0b0d10',
        secondaryColor: '#eef1fe',
        secondaryBorderColor: '#2340e6',
        tertiaryColor: '#eef9cf',
        tertiaryBorderColor: '#b4e03a',
        lineColor: '#9da2ae',
        textColor: '#2a2e37',
        fontSize: '13px',
      },
      fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
      flowchart: { htmlLabels: false, curve: 'basis' },
    })

    renders += 1
    const { svg: rendered } = await mermaid.render(`bilimind-diagram-${props.block.id}-${renders}`, source)

    svg.value = rendered
  } catch (error) {
    failed.value = true

    if (import.meta.dev) console.warn('[DiagramBlock] mermaid failed to render', error)
  } finally {
    rendering.value = false
  }
}

onMounted(render)
watch(() => props.block.payload?.source, render)
</script>

<template>
  <BlockShell
    :type="block.type"
    :source-material-ids="block.source_material_ids"
  >
    <div
      v-if="rendering"
      class="cb-dots h-32 animate-pulse rounded-[14px]"
      aria-hidden="true"
    />

    <!--
      `overflow-x-auto` matters: a wide flowchart must scroll inside its own box
      rather than making the whole lesson scroll sideways on a phone.
    -->
    <div
      v-else-if="!failed"
      ref="container"
      class="diagram cb-dots overflow-x-auto rounded-[14px] px-4 py-5 shadow-[inset_0_0_0_1px_var(--border)]"
      role="img"
      :aria-label="block.payload?.alt_text ?? block.payload?.caption ?? 'Diagram'"
      v-html="svg"
    />

    <p
      v-if="failed && block.payload?.alt_text"
      class="rounded-[14px] bg-surface-mute p-3.5 text-[13.5px] leading-relaxed text-text-soft"
    >
      {{ block.payload.alt_text }}
    </p>

    <p
      v-else-if="failed"
      class="text-[13px] text-text-faint italic"
    >
      This diagram could not be drawn.
    </p>

    <p
      v-if="block.payload?.caption && !failed"
      class="mt-3 text-[13px] leading-relaxed text-text-soft"
    >
      {{ block.payload.caption }}
    </p>
  </BlockShell>
</template>

<style scoped>
/* The player's diagram boxes are softly rounded; Mermaid draws square ones. */
.diagram :deep(.node rect),
.diagram :deep(.node .label-container) {
  rx: 9px;
  ry: 9px;
}

.diagram :deep(svg) {
  max-width: 100%;
  height: auto;
  display: block;
  margin-inline: auto;
}

/**
 * On a phone the diagram keeps its type size and scrolls instead of shrinking.
 *
 * Fitting a wide flowchart to a 350px column scales the whole drawing down, and
 * that takes Mermaid's 13px labels with it — a diagram nobody can read is worse
 * than one that needs a swipe, and the container is already `overflow-x-auto`
 * so the swipe stays inside the block.
 *
 * `!important` because the cap being fought here is Mermaid's own inline
 * `style="max-width: …"`, which no selector can outrank. `min-width: 100%` is
 * the floor: if `max-content` cannot resolve for a particular SVG, the diagram
 * simply fills the column exactly as it does today.
 */
@media (width < 40rem) {
  .diagram :deep(svg) {
    max-width: none !important;
    width: max-content;
    min-width: 100%;
  }
}
</style>
