<script setup lang="ts">
/**
 * The board's tools. Down the left on a desktop or tablet, in the mockup's
 * order; along the bottom on a phone, where only the six a thumb reaches for
 * in class sit on the bar (select, sticky, pen, text, mind map, topics) and
 * the rest live behind "More".
 *
 * No tool is a mystery icon. On a desktop, pointing at one opens its name,
 * its key and one line on how it's used, at once (not the browser's slow
 * title); on a phone every button carries its name under the glyph, the way
 * the app's tab bar does.
 *
 * It wears the old app's ink tray (`MarkupToolbar`, the pen over a lesson and
 * its whiteboard): a dark pill, quiet white glyphs, and the tool in hand the
 * one lime thing on it. The options that open beside a tool are white, like
 * the tray's own menus, with the chosen one in ink.
 *
 * The active tool's options (sticky colour, shape, pen colour and width)
 * open beside it, so choosing a colour is one tap from the tool.
 */
import type { BoardController, Tool } from '~/companion/board/controller'
import { PEN, STICKY, type PenColor, type StickyColor } from '~/companion/board/palette'
import type { ShapeKind } from '~/companion/board/model'

const props = defineProps<{ ctl: BoardController; phone: boolean; aiOpen: boolean }>()
const emit = defineEmits<{ ai: []; present: [] }>()

const ui = computed(() => props.ctl.ui)
const more = ref(false)

interface ToolDef { tool: Tool; icon: string; label: string; short: string; key: string }
const ALL: ToolDef[] = [
  { tool: 'select', icon: 'cursor', label: 'Select', short: 'Select', key: 'V' },
  { tool: 'sticky', icon: 'sticky', label: 'Sticky note', short: 'Sticky', key: 'S' },
  { tool: 'shape', icon: 'shape', label: 'Shape', short: 'Shape', key: 'R' },
  { tool: 'connector', icon: 'arrow', label: 'Arrow', short: 'Arrow', key: 'L' },
  { tool: 'pen', icon: 'pen', label: 'Pen', short: 'Pen', key: 'P' },
  { tool: 'text', icon: 'T', label: 'Text', short: 'Text', key: 'T' },
  { tool: 'frame', icon: 'frame', label: 'Frame', short: 'Frame', key: 'F' },
  { tool: 'page', icon: 'doc', label: 'Page', short: 'Page', key: '' },
  { tool: 'mind', icon: 'mind', label: 'Mind map', short: 'Mind map', key: 'M' },
  { tool: 'image', icon: 'image', label: 'Image', short: 'Image', key: 'I' },
]

/** How each tool is used, in a line: what the desktop tooltip says under its name. */
const HINT: Partial<Record<Tool, string>> = {
  select: 'Move, resize and edit what’s on the board',
  sticky: 'Click the board to stick one',
  shape: 'Click or drag to draw a box, circle or diamond',
  connector: 'Drag from one thing to another to join them',
  pen: 'Draw by hand',
  text: 'Click anywhere and type',
  frame: 'Holds things together; each frame is a slide when you present',
  page: 'Put one of your pages on the board',
  mind: 'Click to start one, then add branches',
  image: 'Add a picture from this device',
}
const PHONE_BAR: Tool[] = ['select', 'sticky', 'pen', 'text', 'mind']
const bar = computed(() => (props.phone ? ALL.filter((t) => PHONE_BAR.includes(t.tool)) : ALL))
const extra = computed(() => ALL.filter((t) => !PHONE_BAR.includes(t.tool)))

function pick(t: Tool) {
  more.value = false
  props.ctl.setTool(t)
  // Image and page cards have nothing to drag out: on a phone, drop them mid-screen.
  if (props.phone && (t === 'image' || t === 'page')) {
    if (t === 'image') props.ctl.requestImage()
    else props.ctl.requestPage()
  }
}

const options = computed(() => {
  const t = ui.value.tool
  return t === 'sticky' || t === 'shape' || t === 'pen' ? t : null
})

const stickyColors = Object.keys(STICKY) as StickyColor[]
const penColors = Object.keys(PEN) as PenColor[]
const shapes: ShapeKind[] = ['rect', 'ellipse', 'diamond']
const SHAPE_NAME: Record<ShapeKind, string> = { rect: 'Box', ellipse: 'Circle', diamond: 'Diamond' }
const sizes = [{ v: 2, label: 'Fine' }, { v: 3, label: 'Medium' }, { v: 7, label: 'Marker' }]

/** Where the options panel opens: level with the active tool on a desktop. */
const optionsTop = computed(() => {
  const i = ALL.findIndex((t) => t.tool === ui.value.tool)
  return 64 + 5 + i * 35
})
</script>

<template>
  <!-- Desktop and tablet: a column of tools down the left, each naming itself on hover. -->
  <template v-if="!phone">
    <div
      class="btool"
      role="toolbar"
      aria-label="Tools"
      aria-orientation="vertical"
    >
      <button
        v-for="t in bar"
        :key="t.tool"
        type="button"
        :class="{ on: ui.tool === t.tool }"
        :aria-label="t.key ? `${t.label} (${t.key})` : t.label"
        :aria-pressed="ui.tool === t.tool"
        :data-tool="t.tool"
        @click="pick(t.tool)"
      >
        <span
          v-if="t.icon === 'T'"
          class="text-[14px] font-bold"
        >T</span>
        <BoardIcon
          v-else
          :name="t.icon"
        />
        <span
          class="tip"
          aria-hidden="true"
        >
          <b>{{ t.label }}<kbd v-if="t.key">{{ t.key }}</kbd></b>
          <small v-if="HINT[t.tool]">{{ HINT[t.tool] }}</small>
        </span>
      </button>
      <span
        class="btool-sep"
        aria-hidden="true"
      />
      <button
        type="button"
        class="ai"
        :class="{ on: aiOpen }"
        aria-label="Map the topics"
        :aria-pressed="aiOpen"
        data-tool="ai"
        @click="emit('ai')"
      >
        <BoardIcon name="spark" />
        <span
          class="tip"
          aria-hidden="true"
        >
          <b>Map the topics</b>
          <small>Lays out what the course has covered so far</small>
        </span>
      </button>
    </div>
    <div class="btool btool--undo">
      <button
        type="button"
        aria-label="Undo (Ctrl+Z)"
        :disabled="!ui.canUndo"
        @click="ctl.undo()"
      >
        <BoardIcon name="undo" />
        <span
          class="tip tip--up"
          aria-hidden="true"
        ><b>Undo<kbd>Ctrl Z</kbd></b></span>
      </button>
      <button
        type="button"
        aria-label="Redo (Ctrl+Shift+Z)"
        :disabled="!ui.canRedo"
        @click="ctl.redo()"
      >
        <BoardIcon name="redo" />
        <span
          class="tip tip--up"
          aria-hidden="true"
        ><b>Redo<kbd>Ctrl Shift Z</kbd></b></span>
      </button>
    </div>
  </template>

  <!-- Phone: a bottom bar like the app's tab bar, every tool named, plus "More". -->
  <div
    v-else
    class="kbar"
    role="toolbar"
    aria-label="Tools"
  >
    <button
      v-for="t in bar"
      :key="t.tool"
      type="button"
      :class="{ on: ui.tool === t.tool }"
      :aria-pressed="ui.tool === t.tool"
      :data-tool="t.tool"
      @click="pick(t.tool)"
    >
      <span
        v-if="t.icon === 'T'"
        class="glyph text-[16px] font-bold"
        aria-hidden="true"
      >T</span>
      <BoardIcon
        v-else
        :name="t.icon"
        :size="18"
      />
      <span class="name">{{ t.short }}</span>
    </button>
    <button
      type="button"
      class="ai"
      :class="{ on: aiOpen }"
      :aria-pressed="aiOpen"
      data-tool="ai"
      @click="emit('ai')"
    >
      <BoardIcon
        name="spark"
        :size="18"
      />
      <span class="name">Topics</span>
    </button>
    <button
      type="button"
      :class="{ on: more || extra.some((t) => t.tool === ui.tool) }"
      :aria-expanded="more"
      data-tool="more"
      @click="more = !more"
    >
      <BoardIcon
        name="more"
        :size="18"
      />
      <span class="name">More</span>
    </button>
  </div>

  <!-- The phone's "more" sheet. -->
  <div
    v-if="phone && more"
    class="sheet"
  >
    <button
      v-for="t in extra"
      :key="t.tool"
      type="button"
      class="sheet-item"
      :class="{ on: ui.tool === t.tool }"
      @click="pick(t.tool)"
    >
      <BoardIcon
        :name="t.icon"
        :size="18"
      />
      {{ t.label }}
    </button>
    <button
      type="button"
      class="sheet-item"
      :disabled="!ui.canUndo"
      @click="ctl.undo()"
    >
      <BoardIcon
        name="undo"
        :size="18"
      />
      Undo
    </button>
    <button
      type="button"
      class="sheet-item"
      :disabled="!ui.canRedo"
      @click="ctl.redo()"
    >
      <BoardIcon
        name="redo"
        :size="18"
      />
      Redo
    </button>
    <button
      type="button"
      class="sheet-item"
      @click="more = false; emit('present')"
    >
      <BoardIcon
        name="play"
        :size="18"
      />
      Present
    </button>
  </div>

  <!-- The active tool's options. -->
  <div
    v-if="options"
    class="bopts"
    :class="{ 'bopts--phone': phone }"
    :style="phone ? undefined : { top: `${optionsTop}px` }"
  >
    <template v-if="options === 'sticky'">
      <button
        v-for="c in stickyColors"
        :key="c"
        type="button"
        class="swatch"
        :class="{ on: ui.stickyColor === c }"
        :style="{ background: STICKY[c] }"
        :aria-label="`${c} sticky`"
        :title="`${c[0]!.toUpperCase()}${c.slice(1)}`"
        @click="ctl.setStickyColor(c)"
      />
    </template>
    <template v-else-if="options === 'shape'">
      <button
        v-for="s in shapes"
        :key="s"
        type="button"
        class="opt"
        :class="{ on: ui.shape === s }"
        :aria-label="SHAPE_NAME[s]"
        :title="SHAPE_NAME[s]"
        @click="ctl.setShapeKind(s)"
      >
        <BoardIcon :name="s" />
      </button>
    </template>
    <template v-else-if="options === 'pen'">
      <button
        v-for="c in penColors"
        :key="c"
        type="button"
        class="swatch swatch--ink"
        :class="{ on: ui.penColor === c && !ui.eraser }"
        :style="{ background: PEN[c] }"
        :aria-label="`${c} ink`"
        :title="`${c[0]!.toUpperCase()}${c.slice(1)} ink`"
        @click="ui.penColor = c; ui.eraser = false"
      />
      <span class="sep" />
      <button
        v-for="s in sizes"
        :key="s.v"
        type="button"
        class="opt"
        :class="{ on: ui.penSize === s.v && !ui.eraser }"
        :aria-label="s.label"
        :title="s.label"
        @click="ui.penSize = s.v; ui.eraser = false"
      >
        <i
          class="dotsize"
          :style="{ width: `${s.v + 3}px`, height: `${s.v + 3}px` }"
        />
      </button>
      <span class="sep" />
      <button
        type="button"
        class="opt"
        :class="{ on: ui.eraser }"
        aria-label="Eraser"
        title="Eraser (E)"
        @click="ui.eraser = !ui.eraser"
      >
        <BoardIcon name="eraser" />
      </button>
      <span
        v-if="ui.penSeen && !phone"
        class="hint"
      >Pen draws, fingers pan</span>
    </template>
  </div>
</template>

<style scoped>
.btool {
  position: absolute; left: 14px; top: 64px; z-index: 6;
  display: grid; gap: 3px; padding: 5px;
  background: var(--ink); color: #fff; border-radius: 999px;
  box-shadow: 0 20px 40px -14px rgb(11 13 16 / 0.55);
}
.btool button {
  position: relative;
  width: 32px; height: 32px; border-radius: 999px; display: grid; place-items: center;
  color: rgb(255 255 255 / 0.6); transition: background-color 120ms, color 120ms;
}
.btool button:hover:not(.on):not(:disabled) { background: rgb(255 255 255 / 0.1); color: #fff; }
.btool button.on { background: var(--lime); color: var(--ink); }
.btool button:disabled { opacity: 0.35; }
.btool--undo { top: auto; bottom: 14px; grid-auto-flow: column; }
.btool-sep { height: 1px; margin: 2px 6px; background: rgb(255 255 255 / 0.15); }

/* The tool's name, key and how it's used, beside it the moment it's pointed at. */
.tip {
  position: absolute; left: calc(100% + 12px); top: 50%; z-index: 9;
  display: none; gap: 2px; width: max-content; max-width: 260px; padding: 7px 11px 8px;
  background: var(--ink); color: #fff; border-radius: 10px; text-align: left;
  transform: translateY(-50%); pointer-events: none; box-shadow: var(--shadow-pop);
}
.tip b { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 600; }
.tip kbd {
  font: inherit; font-size: 11.5px; font-weight: 600; color: rgb(255 255 255 / 0.7);
  padding: 0 5px; border-radius: 5px; background: rgb(255 255 255 / 0.14);
}
.tip small { font-size: 12.5px; line-height: 1.4; color: rgb(255 255 255 / 0.72); }
.tip--up { left: 50%; top: auto; bottom: calc(100% + 10px); transform: translateX(-30%); }
@media (hover: hover) {
  .btool button:hover .tip { display: grid; }
}
.btool button:focus-visible .tip { display: grid; }

/* The phone's bar: a glyph with its name under it, as in the app's tab bar. */
.kbar {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 7;
  height: calc(62px + env(safe-area-inset-bottom)); padding: 0 4px env(safe-area-inset-bottom);
  display: flex; justify-content: space-around; align-items: center;
  background: var(--ink); color: rgb(255 255 255 / 0.6);
}
.kbar button {
  flex: 1; min-width: 44px; max-width: 64px; height: 52px; border-radius: 12px;
  display: grid; justify-items: center; align-content: center; gap: 3px;
}
.kbar .glyph { display: grid; place-items: center; height: 18px; line-height: 1; }
.kbar .name { font-size: 11.5px; font-weight: 500; line-height: 1.2; white-space: nowrap; }
.kbar button.on { background: var(--lime); color: var(--ink); }

.sheet {
  position: absolute; left: 8px; right: 8px; bottom: calc(70px + env(safe-area-inset-bottom)); z-index: 8;
  display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 8px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 16px; box-shadow: var(--shadow-sheet);
}
.sheet-item {
  display: flex; align-items: center; gap: 10px; height: 48px; padding: 0 12px; border-radius: 10px;
  font-size: 15px; font-weight: 600; color: var(--text); text-align: left;
}
.sheet-item svg { color: var(--text-soft); }
.sheet-item.on { background: var(--ink); color: var(--lime); }
.sheet-item.on svg { color: inherit; }
.sheet-item:active:not(.on) { background: var(--surface-sunken); }
.sheet-item:disabled { opacity: 0.4; }

.bopts {
  position: absolute; left: 66px; z-index: 6;
  display: flex; align-items: center; gap: 4px; padding: 5px 6px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  box-shadow: 0 10px 24px -14px rgb(13 22 96 / 0.35);
}
/* On a phone the options sit above "Show all" (bottom right), not across it. */
.bopts--phone {
  left: 50%; transform: translateX(-50%); bottom: calc(130px + env(safe-area-inset-bottom)); top: auto;
  max-width: calc(100% - 16px); padding: 6px 8px; gap: 6px;
}
.swatch { width: 24px; height: 24px; border-radius: 6px; box-shadow: inset 0 0 0 1px rgb(11 13 16 / 0.12); }
.swatch--ink { border-radius: 50%; width: 22px; height: 22px; }
.swatch.on { box-shadow: 0 0 0 2px var(--surface), 0 0 0 3.5px var(--ink); }
.opt { width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; color: var(--text-soft); }
.opt.on { background: var(--ink); color: var(--lime); }
.dotsize { display: block; border-radius: 50%; background: currentColor; }
.sep { width: 1px; height: 20px; background: var(--border-strong); margin: 0 3px; }
.hint { font-size: 13px; color: var(--text-muted); padding: 0 6px; white-space: nowrap; }
.bopts--phone .swatch { width: 32px; height: 32px; }
.bopts--phone .swatch--ink { width: 30px; height: 30px; }
.bopts--phone .opt { width: 40px; height: 40px; }
</style>
