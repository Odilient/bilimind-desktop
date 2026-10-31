<script setup lang="ts">
/**
 * The proposed path as an outline the learner edits like a Notion list:
 * units, each with its topics, every title a field. Enter on a topic makes
 * the next one and puts the cursor in it; Backspace on an empty one removes
 * it and goes back up. Topics drag between units on a computer, and every
 * row also moves with up and down (in a menu on a phone, where drag isn't
 * a thing a thumb does), so nothing depends on dragging.
 *
 * The units are the course's parent topics once it is made; the numbering
 * ("2.3") is only for reading and isn't stored.
 */
import type { MenuAction } from '~/components/ui/Menu.vue'
import type { ProposalUnit } from '~/companion/create'

defineProps<{ disabled?: boolean }>()
const units = defineModel<ProposalUnit[]>({ required: true })

const root = ref<HTMLElement | null>(null)

/* Rows keep their DOM (and the cursor) through a move: a key per object, not per index. */
const keys = new WeakMap<object, number>()
let nextKey = 0
function keyOf(row: object): number {
  if (!keys.has(row)) keys.set(row, nextKey++)
  return keys.get(row)!
}

function focusTopic(u: number, t: number): void {
  void nextTick(() => {
    root.value?.querySelector<HTMLInputElement>(`[data-topic="${u}-${t}"]`)?.focus()
  })
}

function focusUnit(u: number): void {
  void nextTick(() => {
    root.value?.querySelector<HTMLInputElement>(`[data-unit="${u}"]`)?.focus()
  })
}

/* -- Topics ----------------------------------------------------------------- */

function addTopic(u: number, at?: number): void {
  const list = units.value[u]!.topics
  const i = at ?? list.length
  list.splice(i, 0, { title: '' })
  focusTopic(u, i)
}

function removeTopic(u: number, t: number): void {
  units.value[u]!.topics.splice(t, 1)
}

function moveTopic(u: number, t: number, by: -1 | 1): void {
  const list = units.value[u]!.topics
  const to = t + by
  if (to >= 0 && to < list.length) {
    const [it] = list.splice(t, 1)
    list.splice(to, 0, it!)
    focusTopic(u, to)
    return
  }
  // Off the end of a unit: into the next one's top, or the previous one's bottom.
  const next = units.value[u + by]
  if (!next) return
  const [it] = list.splice(t, 1)
  if (by === 1) {
    next.topics.unshift(it!)
    focusTopic(u + 1, 0)
  } else {
    next.topics.push(it!)
    focusTopic(u - 1, next.topics.length - 1)
  }
}

function onTopicKey(event: KeyboardEvent, u: number, t: number): void {
  const topic = units.value[u]!.topics[t]!
  if (event.key === 'Enter' && !event.isComposing && !event.metaKey && !event.ctrlKey) {
    event.preventDefault()
    addTopic(u, t + 1)
  } else if (event.key === 'Backspace' && !topic.title) {
    event.preventDefault()
    removeTopic(u, t)
    if (t > 0) focusTopic(u, t - 1)
    else focusUnit(u)
  } else if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault()
    moveTopic(u, t, event.key === 'ArrowUp' ? -1 : 1)
  }
}

function topicActions(u: number, t: number): MenuAction[] {
  const last = units.value.length - 1
  const count = units.value[u]!.topics.length
  return [
    { label: 'Move up', icon: 'chevron-up', disabled: u === 0 && t === 0, run: () => moveTopic(u, t, -1) },
    { label: 'Move down', icon: 'chevron-down', disabled: u === last && t === count - 1, run: () => moveTopic(u, t, 1) },
    { label: 'Remove', icon: 'trash', destructive: true, run: () => removeTopic(u, t) },
  ]
}

/* -- Units ------------------------------------------------------------------ */

function addUnit(): void {
  units.value.push({ title: '', topics: [{ title: '' }] })
  focusUnit(units.value.length - 1)
}

function removeUnit(u: number): void {
  units.value.splice(u, 1)
}

function moveUnit(u: number, by: -1 | 1): void {
  const to = u + by
  if (to < 0 || to >= units.value.length) return
  const [it] = units.value.splice(u, 1)
  units.value.splice(to, 0, it!)
  focusUnit(to)
}

function onUnitKey(event: KeyboardEvent, u: number): void {
  if (event.key === 'Enter' && !event.isComposing && !event.metaKey && !event.ctrlKey) {
    event.preventDefault()
    addTopic(u, 0)
  }
}

function unitActions(u: number): MenuAction[] {
  return [
    { label: 'Move up', icon: 'chevron-up', disabled: u === 0, run: () => moveUnit(u, -1) },
    { label: 'Move down', icon: 'chevron-down', disabled: u === units.value.length - 1, run: () => moveUnit(u, 1) },
    { label: 'Add a topic', icon: 'plus', run: () => addTopic(u) },
    { label: 'Remove unit', icon: 'trash', destructive: true, run: () => removeUnit(u) },
  ]
}

/* -- Dragging topics -------------------------------------------------------- */

const dragging = ref<{ u: number; t: number } | null>(null)
/** Where the dragged topic would land: before topic `t` of unit `u` (t = length: at the end). */
const over = ref<{ u: number; t: number } | null>(null)

function onDragStart(event: DragEvent, u: number, t: number): void {
  dragging.value = { u, t }
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    // Firefox won't start a drag without data; the page's file drop ignores non-file drags.
    event.dataTransfer.setData('text/plain', units.value[u]!.topics[t]!.title)
  }
}

function onDragOver(event: DragEvent, u: number, t: number): void {
  if (!dragging.value) return
  event.preventDefault()
  const row = event.currentTarget as HTMLElement
  const below = event.offsetY > row.offsetHeight / 2
  over.value = { u, t: below ? t + 1 : t }
}

function onDragOverUnit(event: DragEvent, u: number): void {
  if (!dragging.value) return
  event.preventDefault()
  if (!over.value || over.value.u !== u) over.value = { u, t: units.value[u]!.topics.length }
}

function onDrop(event: DragEvent): void {
  const from = dragging.value
  const to = over.value
  dragging.value = null
  over.value = null
  if (!from || !to) return
  event.preventDefault()
  const source = units.value[from.u]!.topics
  const [it] = source.splice(from.t, 1)
  let index = to.t
  if (from.u === to.u && from.t < to.t) index -= 1
  units.value[to.u]!.topics.splice(index, 0, it!)
}

function onDragEnd(): void {
  dragging.value = null
  over.value = null
}

const ICON_BTN =
  'grid size-8 cursor-pointer place-items-center rounded-full text-text-faint transition-colors duration-150 outline-none hover:bg-[rgb(11_13_16/0.06)] hover:text-text focus-visible:ring-2 focus-visible:ring-brand-line disabled:pointer-events-none disabled:opacity-30'
</script>

<template>
  <div
    ref="root"
    class="grid gap-3"
  >
    <ol class="grid gap-3">
      <li
        v-for="(unit, u) in units"
        :key="keyOf(unit)"
        class="rounded-[18px] border border-border bg-surface transition-shadow duration-150"
        :class="over?.u === u && dragging && dragging.u !== u && 'ring-2 ring-brand-line'"
        @dragover="onDragOverUnit($event, u)"
        @drop="onDrop"
      >
        <!-- The unit. -->
        <div class="group/unit flex items-center gap-2 py-2 pr-1.5 pl-3">
          <span class="grid size-7 shrink-0 place-items-center rounded-full bg-surface-track text-[12.5px] font-semibold text-text-soft tabular-nums">
            {{ u + 1 }}
          </span>
          <label
            :for="`cp-unit-${u}`"
            class="sr-only"
          >Unit {{ u + 1 }} name</label>
          <input
            :id="`cp-unit-${u}`"
            v-model="unit.title"
            :data-unit="u"
            :disabled="disabled"
            type="text"
            placeholder="Name this unit"
            class="h-10 min-w-0 flex-1 rounded-[8px] bg-transparent px-1.5 font-display text-[16.5px] font-semibold tracking-[-0.01em] text-text outline-none placeholder:font-sans placeholder:font-normal placeholder:text-text-faint hover:bg-surface-mute focus:bg-surface-mute"
            @keydown="onUnitKey($event, u)"
          >
          <span class="text-[12.5px] text-text-faint tabular-nums max-[599px]:hidden">
            {{ unit.topics.length }} topic{{ unit.topics.length === 1 ? '' : 's' }}
          </span>
          <span class="hidden items-center opacity-0 transition-opacity duration-150 group-focus-within/unit:opacity-100 group-hover/unit:opacity-100 min-[900px]:flex">
            <button
              type="button"
              :class="ICON_BTN"
              :disabled="disabled || u === 0"
              title="Move unit up"
              aria-label="Move unit up"
              @click="moveUnit(u, -1)"
            >
              <UiIcon
                name="chevron-up"
                :size="15"
              />
            </button>
            <button
              type="button"
              :class="ICON_BTN"
              :disabled="disabled || u === units.length - 1"
              title="Move unit down"
              aria-label="Move unit down"
              @click="moveUnit(u, 1)"
            >
              <UiIcon
                name="chevron-down"
                :size="15"
              />
            </button>
            <button
              type="button"
              :class="ICON_BTN"
              :disabled="disabled"
              title="Remove unit"
              aria-label="Remove unit"
              @click="removeUnit(u)"
            >
              <UiIcon
                name="trash"
                :size="14"
              />
            </button>
          </span>
          <UiMenu
            class="min-[900px]:hidden"
            :actions="unitActions(u)"
            :title="unit.title || `Unit ${u + 1}`"
            label="Unit actions"
          />
        </div>

        <!-- Its topics. -->
        <ol class="grid gap-px px-1.5 pb-1.5">
          <li
            v-for="(topic, t) in unit.topics"
            :key="keyOf(topic)"
            class="group/topic relative flex items-center gap-1 rounded-[10px] pr-1 transition-colors duration-100 hover:bg-surface-mute focus-within:bg-surface-mute"
            :class="dragging?.u === u && dragging.t === t && 'opacity-40'"
            :draggable="!disabled"
            @dragstart="onDragStart($event, u, t)"
            @dragover.stop="onDragOver($event, u, t)"
            @drop.stop="onDrop"
            @dragend="onDragEnd"
          >
            <span
              v-if="over?.u === u && over.t === t && dragging"
              class="pointer-events-none absolute inset-x-2 -top-px h-0.5 rounded-full bg-cobalt"
              aria-hidden="true"
            />
            <span
              v-if="over?.u === u && over.t === t + 1 && t === unit.topics.length - 1 && dragging"
              class="pointer-events-none absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-cobalt"
              aria-hidden="true"
            />
            <span
              class="hidden h-10 w-5 shrink-0 cursor-grab place-items-center text-text-ghost opacity-0 transition-opacity group-hover/topic:opacity-100 active:cursor-grabbing min-[900px]:grid"
              aria-hidden="true"
              title="Drag to move"
            >
              <svg
                viewBox="0 0 10 16"
                width="8"
                height="13"
                fill="currentColor"
              >
                <circle cx="2.5" cy="3" r="1.4" /><circle cx="7.5" cy="3" r="1.4" />
                <circle cx="2.5" cy="8" r="1.4" /><circle cx="7.5" cy="8" r="1.4" />
                <circle cx="2.5" cy="13" r="1.4" /><circle cx="7.5" cy="13" r="1.4" />
              </svg>
            </span>
            <span class="w-8 shrink-0 text-right text-[12.5px] text-text-faint tabular-nums max-[899px]:w-9 max-[899px]:pl-1 max-[899px]:text-left">
              {{ u + 1 }}.{{ t + 1 }}
            </span>
            <label
              :for="`cp-topic-${u}-${t}`"
              class="sr-only"
            >Topic {{ u + 1 }}.{{ t + 1 }}</label>
            <input
              :id="`cp-topic-${u}-${t}`"
              v-model="topic.title"
              :data-topic="`${u}-${t}`"
              :disabled="disabled"
              type="text"
              placeholder="Name this topic"
              class="h-11 min-w-0 flex-1 bg-transparent px-1.5 text-[15px] text-text outline-none placeholder:text-text-faint min-[900px]:h-10"
              @keydown="onTopicKey($event, u, t)"
            >
            <span class="hidden items-center opacity-0 transition-opacity duration-150 group-focus-within/topic:opacity-100 group-hover/topic:opacity-100 min-[900px]:flex">
              <button
                type="button"
                :class="ICON_BTN"
                :disabled="disabled || (u === 0 && t === 0)"
                title="Move up (⌥↑)"
                aria-label="Move topic up"
                @click="moveTopic(u, t, -1)"
              >
                <UiIcon
                  name="chevron-up"
                  :size="15"
                />
              </button>
              <button
                type="button"
                :class="ICON_BTN"
                :disabled="disabled || (u === units.length - 1 && t === unit.topics.length - 1)"
                title="Move down (⌥↓)"
                aria-label="Move topic down"
                @click="moveTopic(u, t, 1)"
              >
                <UiIcon
                  name="chevron-down"
                  :size="15"
                />
              </button>
              <button
                type="button"
                :class="ICON_BTN"
                :disabled="disabled"
                title="Remove topic"
                aria-label="Remove topic"
                @click="removeTopic(u, t)"
              >
                <UiIcon
                  name="x"
                  :size="14"
                />
              </button>
            </span>
            <UiMenu
              class="min-[900px]:hidden"
              :actions="topicActions(u, t)"
              :title="topic.title || 'Topic'"
              label="Topic actions"
            />
          </li>
          <li>
            <button
              type="button"
              class="flex h-10 w-full cursor-pointer items-center gap-2 rounded-[10px] pl-2.5 text-[14px] font-medium text-text-faint transition-colors duration-150 outline-none hover:bg-surface-mute hover:text-text-soft focus-visible:ring-2 focus-visible:ring-brand-line disabled:pointer-events-none min-[900px]:pl-[34px]"
              :disabled="disabled"
              @click="addTopic(u)"
            >
              <UiIcon
                name="plus"
                :size="15"
              />
              Add a topic
            </button>
          </li>
        </ol>
      </li>
    </ol>

    <button
      type="button"
      class="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[18px] border border-dashed border-border-dashed text-[14.5px] font-semibold text-text-soft transition-colors duration-150 outline-none hover:border-cobalt hover:bg-cobalt-soft hover:text-cobalt focus-visible:ring-2 focus-visible:ring-brand-line disabled:pointer-events-none disabled:opacity-50"
      :disabled="disabled"
      @click="addUnit"
    >
      <UiIcon
        name="plus"
        :size="16"
      />
      Add a unit
    </button>
  </div>
</template>
