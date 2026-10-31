<script setup lang="ts">
import { NOTES_LIST } from '~/companion/notes/ui'
import { isExpanded, setExpanded } from '~/companion/notes/actions'

/**
 * One fold of Notes' sidebar: a heading that opens and closes what's under
 * it, remembered per device.
 *
 * Two looks. `label` is a section's quiet heading (Recent, Pinned), the
 * chevron showing on hover the way Notion's do. `folder` is a place notes
 * are filed in (My notes, a course), drawn as a row: the course's dot and
 * name, a chevron, and on hover "+" for a new page right there. A folder
 * also takes a dragged note (or a dragged selection), which moves it to that
 * course's top level: while anything is being dragged every folder shows a
 * faint ring, the one under the pointer fills and says "Move here", and a
 * folded one opens after a moment, so a note can be dropped between pages.
 */
const props = withDefaults(
  defineProps<{
    label: string
    /** The remembered fold: `s:recent`, `f:<course id>`… */
    foldKey: string
    defaultOpen?: boolean
    look?: 'label' | 'folder'
    /** A course's colour (the dot), or none for My notes. */
    color?: string | null
    /** Offer "+" (a new page here). */
    addable?: boolean
    addLabel?: string
    /** Takes a dragged note. */
    droppable?: boolean
  }>(),
  { defaultOpen: false, look: 'label', color: null, addable: false, addLabel: 'New page here', droppable: false },
)

const emit = defineEmits<{ add: []; drop: [noteIds: string[]] }>()

const list = inject(NOTES_LIST)!
const open = computed(() => isExpanded(props.foldKey, props.defaultOpen))
const over = ref(false)

function toggle(): void {
  setExpanded(props.foldKey, !open.value)
}

const dragging = computed(() => props.droppable && Boolean(list.drag?.id))

/** A folded folder held over for a moment opens, so the drop can go between its pages. */
let opener: ReturnType<typeof setTimeout> | undefined

function onDragOver(event: DragEvent): void {
  if (!props.droppable || !list.drag?.id) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  if (!over.value && !open.value) opener = setTimeout(() => setExpanded(props.foldKey, true), 650)
  over.value = true
}

function onDragLeave(event: DragEvent): void {
  if ((event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) return
  over.value = false
  clearTimeout(opener)
}

function onDrop(event: DragEvent): void {
  over.value = false
  clearTimeout(opener)
  const id = list.drag?.id
  if (!props.droppable || !id || !list.drag) return
  event.preventDefault()
  const ids = list.drag.ids?.length ? [...list.drag.ids] : [id]
  list.drag.id = null
  list.drag.ids = null
  list.drag.over = null
  list.drag.zone = null
  emit('drop', ids)
}

onBeforeUnmount(() => clearTimeout(opener))
</script>

<template>
  <section :class="look === 'label' ? 'mt-3 first:mt-1' : 'mt-px'">
    <div
      :class="[
        'group/head relative flex items-center rounded-[8px] transition-colors duration-150',
        list.roomy ? 'min-h-11' : look === 'folder' ? 'min-h-[30px]' : 'min-h-[26px]',
        over
          ? 'bg-brand-soft shadow-[inset_0_0_0_1.5px_var(--brand)]'
          : dragging
            ? 'shadow-[inset_0_0_0_1px_var(--border-dashed)]'
            : look === 'folder' && 'hover:bg-surface-mute',
      ]"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <button
        type="button"
        data-note-link
        :aria-expanded="open"
        :class="[
          'flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 self-stretch rounded-[8px] pl-1.5 text-left outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--cobalt)]',
          look === 'label'
            ? 'text-[12px] font-semibold text-text-faint hover:text-text-soft'
            : ['font-medium text-text-soft hover:text-text', list.roomy ? 'text-[15px]' : 'text-[13px]'],
        ]"
        @click="toggle"
      >
        <template v-if="look === 'folder'">
          <span
            :class="[
              'grid shrink-0 place-items-center text-text-faint',
              list.roomy ? 'size-8' : 'size-[20px]',
            ]"
          >
            <UiIcon
              name="chevron-right"
              :size="list.roomy ? 16 : 13"
              :stroke="2.2"
              :class="['transition-transform duration-150', open && 'rotate-90']"
            />
          </span>
          <span
            v-if="color"
            class="ml-1 size-2 shrink-0 rounded-full"
            :style="{ background: color }"
          />
          <CompanionIcon
            v-else
            name="notebook"
            :size="list.roomy ? 17 : 15"
            class="ml-0.5 shrink-0 text-text-faint"
          />
          <span class="ml-1 min-w-0 truncate">{{ label }}</span>
        </template>
        <template v-else>
          <span class="truncate">{{ label }}</span>
          <UiIcon
            name="chevron-down"
            :size="12"
            :stroke="2.2"
            :class="[
              'shrink-0 transition duration-150',
              open ? '' : '-rotate-90',
              list.roomy ? 'opacity-100' : 'opacity-0 group-hover/head:opacity-100 group-focus-within/head:opacity-100',
            ]"
          />
        </template>
      </button>

      <span
        v-if="over"
        class="mr-2 shrink-0 text-[11.5px] font-semibold text-brand"
        aria-hidden="true"
      >Move here</span>
      <slot
        v-else
        name="extra"
      />

      <button
        v-if="addable"
        type="button"
        tabindex="-1"
        :aria-label="addLabel"
        :title="addLabel"
        :class="[
          'mr-1 grid shrink-0 cursor-pointer place-items-center rounded-[6px] text-text-faint transition hover:bg-surface-track hover:text-text-soft',
          list.roomy ? 'size-10 opacity-100' : 'size-[22px] opacity-0 group-hover/head:opacity-100 group-focus-within/head:opacity-100',
        ]"
        @click.stop="emit('add')"
      >
        <UiIcon
          name="plus"
          :size="list.roomy ? 18 : 14"
          :stroke="2"
        />
      </button>
    </div>

    <div
      class="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
      :style="{ gridTemplateRows: open ? '1fr' : '0fr' }"
      :inert="!open"
    >
      <div
        class="min-h-0 overflow-hidden"
        :class="look === 'folder' && !list.roomy ? 'pl-2' : ''"
      >
        <slot />
      </div>
    </div>
  </section>
</template>
