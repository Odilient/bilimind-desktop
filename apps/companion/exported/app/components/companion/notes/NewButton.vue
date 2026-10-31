<script setup lang="ts">
import type { NewKind } from '~/companion/notes/new'
import { useCompanion } from '~/companion/store'

/**
 * The "+" that makes a note: a page, a whiteboard, an upload, a link, a
 * recording, a photo, or a draft from the AI (`CompanionNotesNewList`).
 * Mounted by the app sidebar's Notes row, Notes' own sidebar and the phone's
 * Notes screen, so the note types and their words are the same everywhere.
 *
 * What's made goes to My notes unless `subjectId` says otherwise, and that
 * is only passed by a button that names its course (Databases' folder in
 * Notes). It is made and opened at `/app/notes/<id>`, and `made(id)` fires.
 *
 * On a computer the list is a popover under the button (above it when
 * there's no room below), drawn on the body so a clipped sidebar can't cut it
 * off; on a phone it is a bottom sheet with 56px rows. Escape, a click
 * outside or scrolling the page closes it, and the focus goes back to the
 * button.
 *
 * Props: `size` (`sm`, the 24px square of a sidebar row; `md`, 30px, 44px
 * on a phone), `align` (which edge of the button the popover lines up
 * with), `label` (a text button, "+ New", instead of the bare "+"), and
 * `kinds`, `here` and `name` for a course's sidebar headings, passed on to
 * the list (see `CompanionNotesNewList`).
 */
const props = withDefaults(
  defineProps<{
    subjectId?: string | null
    size?: 'sm' | 'md'
    align?: 'start' | 'end'
    label?: string | null
    kinds?: NewKind[] | null
    here?: boolean
    /** The button's name and the sheet's title, when "New note in …" isn't it. */
    name?: string | null
  }>(),
  { subjectId: null, size: 'sm', align: 'start', label: null, kinds: null, here: false, name: null },
)

const emit = defineEmits<{
  made: [id: string]
  pick: [kind: NewKind, template: string | null]
  link: [url: string]
}>()

const store = useCompanion()
const isPhone = useIsPhone()
const open = ref(false)
const trigger = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const pos = ref({ top: 0, left: 0 })
const WIDTH = 340

const course = computed(() => store.get('subjects', props.subjectId))
const name = computed(
  () => props.name ?? (course.value ? `New note in ${course.value.title}` : 'New note'),
)
const hint = computed(() =>
  props.kinds ? props.name ?? name.value : `${name.value}: a page, a whiteboard, a file, a link…`,
)

const sheetOpen = computed({
  get: () => open.value && isPhone.value,
  set: (value: boolean) => {
    open.value = value
  },
})

function toggle(): void {
  open.value = !open.value
}

function close(refocus = false): void {
  open.value = false
  if (refocus) trigger.value?.querySelector<HTMLElement>('button')?.focus()
}

function place(): void {
  const box = trigger.value?.getBoundingClientRect()
  if (!box) return
  const left = props.align === 'end' ? box.right - WIDTH : box.left
  const top = box.bottom + 6
  pos.value = { top, left: Math.min(Math.max(8, left), window.innerWidth - WIDTH - 8) }
  // Measured once drawn: no room below turns it upwards.
  nextTick(() => {
    const height = panel.value?.offsetHeight ?? 0
    if (top + height > window.innerHeight - 8) pos.value = { ...pos.value, top: Math.max(8, box.top - height - 6) }
  })
}

function onPointerDown(event: PointerEvent): void {
  const target = event.target as Node
  if (panel.value?.contains(target) || trigger.value?.contains(target)) return
  close()
}

function onKey(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  event.stopPropagation()
  close(true)
}

/** The page moving under a fixed popover would leave it pointing at nothing. */
function onScroll(event: Event): void {
  if (panel.value?.contains(event.target as Node)) return
  close()
}

function listen(on: boolean): void {
  if (!import.meta.client) return
  const method = on ? 'addEventListener' : 'removeEventListener'
  document[method]('pointerdown', onPointerDown as EventListener, true)
  document[method]('keydown', onKey as EventListener)
  window[method]('scroll', onScroll, true)
  window[method]('resize', onScroll)
}

watch(open, (isOpen) => {
  listen(isOpen && !isPhone.value)
  if (isOpen && !isPhone.value) place()
})

onBeforeUnmount(() => listen(false))

// Going somewhere else (the note it just made, a link in the sidebar) closes it.
const route = useRoute()
watch(
  () => route.fullPath,
  () => {
    open.value = false
  },
)

function onMade(id: string): void {
  emit('made', id)
}
</script>

<template>
  <span
    ref="trigger"
    class="inline-flex shrink-0"
  >
    <button
      v-if="label"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-label="name"
      :title="hint"
      :class="[
        'flex cursor-pointer items-center gap-1.5 rounded-[10px] font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-cobalt',
        size === 'md' ? 'h-[30px] px-3 text-[12.5px] max-lg:h-11 max-lg:rounded-full max-lg:px-3.5 max-lg:text-[14.5px]' : 'h-[28px] px-2.5 text-[12.5px]',
        open
          ? 'bg-ink text-white'
          : 'bg-surface text-text shadow-[inset_0_0_0_1px_rgb(11_13_16/0.1)] hover:bg-surface-mute max-lg:shadow-none max-lg:active:bg-surface-sunken',
      ]"
      @click.stop.prevent="toggle"
    >
      <UiIcon
        name="plus"
        :size="size === 'md' ? 14 : 13"
        :stroke="2.1"
      />
      {{ label }}
    </button>
    <button
      v-else
      type="button"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-label="name"
      :title="hint"
      :class="[
        'grid cursor-pointer place-items-center transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-cobalt',
        size === 'md' ? 'size-[30px] rounded-[9px] max-lg:size-11 max-lg:rounded-full' : 'size-6 rounded-md max-lg:size-11 max-lg:rounded-full',
        open ? 'bg-surface-track text-text' : 'text-text-faint hover:bg-surface-track hover:text-text',
      ]"
      @click.stop.prevent="toggle"
    >
      <UiIcon
        name="plus"
        :size="size === 'md' ? 17 : 15"
        :stroke="2"
      />
    </button>
  </span>

  <ClientOnly>
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        leave-active-class="transition duration-100 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-if="open && !isPhone"
          ref="panel"
          class="om-scroll fixed z-[95] max-h-[calc(100dvh-16px)] overflow-y-auto rounded-[16px] bg-surface p-1.5 shadow-[0_0_0_1px_rgb(11_13_16/0.08),0_24px_48px_-16px_rgb(11_13_16/0.32)]"
          :style="{ top: `${pos.top}px`, left: `${pos.left}px`, width: `${WIDTH}px` }"
        >
          <CompanionNotesNewList
            :subject-id="subjectId"
            :kinds="kinds"
            :here="here"
            @made="onMade"
            @pick="(kind, template) => emit('pick', kind, template)"
            @link="emit('link', $event)"
            @done="close()"
          />
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>

  <UiSheet
    v-if="isPhone"
    v-model:open="sheetOpen"
    :title="name"
  >
    <CompanionNotesNewList
      class="-mx-2 mt-2"
      :subject-id="subjectId"
      :kinds="kinds"
      :here="here"
      roomy
      :autofocus="false"
      @made="onMade"
      @pick="(kind, template) => emit('pick', kind, template)"
      @link="emit('link', $event)"
      @done="close()"
    />
  </UiSheet>
</template>
