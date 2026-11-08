<script setup lang="ts">
/**
 * The small bar over a selection: what can be done to exactly these things.
 * Colours for notes, the outline for shapes, a branch or a sibling for a
 * mind node (the phone's Tab and Enter), open for a page card, and always
 * duplicate and delete. One row, no menus. Actions that aren't obvious from
 * a glyph say their name ("Edit", "Branch", "Open"); colours and shapes name
 * themselves on hover.
 */
import type { BoardController } from '~/companion/board/controller'
// Swatches show the colour as the board paints it now (`sticky()`, `fills()` follow the theme).
import { SHAPE_FILL, STICKY, fills as fillHex, sticky, type ShapeFill, type StickyColor } from '~/companion/board/palette'
import type { BoardObject, ObjKind, ShapeKind } from '~/companion/board/model'
import { useAi } from '~/companion/ai/state'
import { useQuietAi } from '~/companion/quiet-ai'

const props = defineProps<{ ctl: BoardController; phone: boolean }>()

const ui = computed(() => props.ctl.ui)
const objs = computed(() => {
  void ui.value.version
  return ui.value.selection.map((id) => props.ctl.get(id)).filter((o) => !!o)
})
const kinds = computed(() => new Set(objs.value.map((o) => o!.kind)))
const only = (k: ObjKind) => kinds.value.size === 1 && kinds.value.has(k)
const one = computed(() => (objs.value.length === 1 && !ui.value.strokeSelection.length ? objs.value[0]! : null))

const rect = computed(() => {
  void ui.value.version
  if (ui.value.editing || ui.value.box || ui.value.present) return null
  return props.ctl.selectionRect()
})

const bar = ref<HTMLElement>()
const barW = ref(240)
onUpdated(() => {
  if (bar.value && bar.value.offsetWidth !== barW.value) barW.value = bar.value.offsetWidth
})

const pos = computed(() => {
  const r = rect.value
  if (!r) return null
  const { w, h } = ui.value.size
  const above = r.y - 54
  const y = above > 60 ? above : Math.min(r.y + r.h + 12, h - (props.phone ? 130 : 60))
  // Centred over the selection, but never off either edge of the board.
  const half = Math.min(barW.value, w - 16) / 2
  const x = Math.max(8 + half, Math.min(w - 8 - half, r.x + r.w / 2))
  return { x, y }
})

/*
 * "Ask about this": the words on the selected things (notes, shapes, a
 * map's branches, a frame's title, a page card) go to the companion as one
 * quote, a line each. Off under Quiet AI, and when nothing selected has words.
 */
const { quiet } = useQuietAi()

function wordsOf(o: BoardObject): string {
  switch (o.kind) {
    case 'sticky':
    case 'shape':
    case 'text':
      return o.text
    case 'mind':
      return [o.text, o.source ? `(${o.source})` : ''].filter(Boolean).join(' ')
    case 'frame':
      return o.title
    case 'page':
      return [o.title, o.preview].filter(Boolean).join(': ')
    case 'connector':
      return o.label ?? ''
    default:
      return ''
  }
}

const askText = computed(() =>
  objs.value
    .map((o) => wordsOf(o!).trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 2000),
)

function ask(): void {
  if (askText.value) useAi().show({ quote: askText.value })
}

const stickyColors = Object.keys(STICKY) as StickyColor[]
const fills = Object.keys(SHAPE_FILL) as ShapeFill[]
const shapes: ShapeKind[] = ['rect', 'ellipse', 'diamond']
const SHAPE_NAME: Record<ShapeKind, string> = { rect: 'Box', ellipse: 'Circle', diamond: 'Diamond' }
</script>

<template>
  <div
    v-if="pos && (objs.length || ui.strokeSelection.length)"
    ref="bar"
    class="bsel"
    :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
    @pointerdown.stop
  >
    <template v-if="only('sticky')">
      <button
        v-for="c in stickyColors"
        :key="c"
        type="button"
        class="sw"
        :style="{ background: sticky()[c] }"
        :aria-label="`Make ${c}`"
        :title="`Make ${c}`"
        @click="ctl.setStickyColor(c)"
      />
      <span class="sep" />
    </template>
    <template v-else-if="only('shape')">
      <button
        v-for="s in shapes"
        :key="s"
        type="button"
        class="ic"
        :aria-label="`Make a ${SHAPE_NAME[s].toLowerCase()}`"
        :title="SHAPE_NAME[s]"
        @click="ctl.setShapeKind(s)"
      >
        <BoardIcon
          :name="s"
          :size="15"
        />
      </button>
      <button
        v-for="f in fills"
        :key="f"
        type="button"
        class="sw sw--round"
        :style="{ background: fillHex()[f] }"
        :aria-label="`Fill ${f}`"
        :title="`Fill ${f}`"
        @click="ctl.setShapeFill(f)"
      />
      <span class="sep" />
    </template>
    <template v-if="one?.kind === 'mind'">
      <button
        type="button"
        class="act"
        title="Add a branch (Tab)"
        data-act="child"
        @click="ctl.addChild(one.id)"
      >
        <BoardIcon
          name="child"
          :size="15"
        />
        Branch
      </button>
      <button
        type="button"
        class="act"
        title="Add a sibling (Enter)"
        data-act="sibling"
        @click="ctl.addSibling(one.id)"
      >
        <BoardIcon
          name="sibling"
          :size="15"
        />
        Sibling
      </button>
      <span class="sep" />
    </template>
    <NuxtLink
      v-if="one?.kind === 'page'"
      :to="`/app/p/${one.item_id}`"
      class="act"
    >
      <BoardIcon
        name="open"
        :size="15"
      />
      Open
    </NuxtLink>
    <button
      v-if="one && ['sticky', 'shape', 'text', 'mind', 'frame'].includes(one.kind)"
      type="button"
      class="act"
      title="Edit the text (Enter)"
      @click="ctl.startEdit(one.id)"
    >
      <BoardIcon
        name="pen"
        :size="14"
      />
      Edit
    </button>
    <template v-if="!quiet && askText">
      <button
        type="button"
        class="act"
        title="Ask Bili about this"
        @click="ask"
      >
        <UiIcon
          name="spark"
          :size="13"
          class="text-accent-strong"
        />
        Ask about this
      </button>
      <span class="sep" />
    </template>
    <button
      type="button"
      class="ic"
      title="Duplicate (Ctrl+D)"
      aria-label="Duplicate"
      @click="ctl.duplicate()"
    >
      <BoardIcon
        name="copy"
        :size="15"
      />
    </button>
    <button
      type="button"
      class="ic ic--danger"
      title="Delete"
      aria-label="Delete"
      @click="ctl.deleteSelection()"
    >
      <BoardIcon
        name="trash"
        :size="15"
      />
    </button>
  </div>
</template>

<style scoped>
.bsel {
  position: absolute; z-index: 6; transform: translateX(-50%);
  display: flex; align-items: center; gap: 3px; padding: 4px 5px; white-space: nowrap;
  background: var(--surface); border: 1px solid var(--border); border-radius: 11px;
  box-shadow: 0 0 0 1px var(--border-strong), var(--shadow-raised);
}
.sw { width: 20px; height: 20px; border-radius: 5px; box-shadow: inset 0 0 0 1px rgb(11 13 16 / 0.14); }
.sw--round { border-radius: 50%; }
.ic { width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; color: var(--text-soft); }
.ic:hover { background: var(--surface-sunken); color: var(--text); }
.ic--danger:hover { color: var(--danger); background: var(--danger-soft); }
.act {
  display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; border-radius: 8px;
  font-size: 13.5px; font-weight: 600; color: var(--text);
}
.act:hover { background: var(--surface-sunken); }
.sep { width: 1px; height: 18px; background: var(--border-strong); margin: 0 2px; }
@media (pointer: coarse) {
  .ic { width: 40px; height: 40px; }
  .act { height: 40px; }
  .sw { width: 28px; height: 28px; }
}
</style>
