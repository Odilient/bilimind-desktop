<script setup lang="ts">
import type { LessonSection } from '~/composables/useLessonSections'

/**
 * Where am I, and how much is left.
 *
 * This replaces the two things the lesson header used to say about position and
 * neither of which answered that question: the string "12 sections", counting a
 * thing that was never named or numbered anywhere on the page, and a progress
 * bar reporting assessments passed — which reads 0% for roughly the first four
 * fifths of a lesson and, on a lesson with nothing graded, means nothing at all.
 *
 * Closed, it names the section being read. Open, it is the lesson's contents,
 * and every entry is a place to jump to. Format words like "Diagram" are fine
 * in here and were never fine on the page itself: a contents list is a map, and
 * a map is allowed to name terrain.
 */
const props = defineProps<{
  /** Outline entries only — one per section, in reading order. */
  sections: LessonSection[]
  /** Ordinal of the section being read. 1-based, matching `LessonSection`. */
  active: number
}>()

const emit = defineEmits<{ jump: [blockId: number] }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

const current = computed(
  () => props.sections.find((section) => section.ordinal === props.active) ?? props.sections[0],
)

function choose(section: LessonSection): void {
  open.value = false
  emit('jump', section.blockId)
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (!root.value?.contains(event.target as Node)) open.value = false
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') open.value = false
}

watch(open, (isOpen) => {
  if (!import.meta.client) return
  const method = isOpen ? 'addEventListener' : 'removeEventListener'
  document[method]('pointerdown', onDocumentPointerDown as EventListener)
  document[method]('keydown', onKeydown as EventListener)
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.removeEventListener('pointerdown', onDocumentPointerDown as EventListener)
  document.removeEventListener('keydown', onKeydown as EventListener)
})
</script>

<template>
  <div
    v-if="sections.length > 1"
    ref="root"
    class="relative min-w-0"
  >
    <!--
      The count and the current heading are both server-rendered. Only the
      highlighted entry is client-derived, so the one screen this product is read
      on for forty-five minutes does not first paint with a blank spine.
    -->
    <button
      type="button"
      class="flex h-[34px] max-w-full cursor-pointer items-center gap-2 rounded-full px-2 text-[13px] text-text-soft transition-colors hover:bg-surface-rail hover:text-text"
      :aria-expanded="open"
      aria-label="Lesson contents"
      @click="open = !open"
    >
      <span class="num shrink-0 font-medium text-text-faint">{{ active }}/{{ sections.length }}</span>
      <span class="min-w-0 truncate font-medium">{{ current?.heading }}</span>
      <UiIcon
        :name="open ? 'chevron-up' : 'chevron-down'"
        :size="12"
        :stroke="2.2"
        class="shrink-0 text-text-faint"
      />
    </button>

    <!-- Open, it is the course player's spine: one line down the left, a dot
         per part — ink on the one being read, ringed lime where the part asks
         something of you — and the current part lifted onto a white card. -->
    <div
      v-if="open"
      class="om-scroll pop-in absolute top-full left-0 z-20 mt-2 max-h-[min(60vh,28rem)] w-[18.5rem] overflow-y-auto rounded-[18px] bg-surface-chrome p-2 shadow-pop ring-1 ring-border"
    >
      <div class="relative">
        <span
          class="absolute top-4 bottom-4 left-[15px] w-px bg-border-strong"
          aria-hidden="true"
        />
        <button
          v-for="section in sections"
          :key="section.blockId"
          type="button"
          :class="[
            'relative flex w-full cursor-pointer items-center gap-3 rounded-[12px] py-2 pr-2.5 pl-2 text-left text-[13px] transition-colors',
            section.ordinal === active
              ? 'bg-surface font-semibold text-text shadow-[0_1px_2px_rgb(11_13_16/0.06),0_0_0_1px_var(--border)]'
              : 'text-text-dim hover:bg-surface',
          ]"
          @click="choose(section)"
        >
          <span
            :class="[
              'relative z-1 grid size-[15px] shrink-0 place-items-center rounded-full',
              section.ordinal === active
                ? 'bg-chip'
                : section.voice === 'task'
                  ? 'bg-surface ring-[2px] ring-lime-2'
                  : 'bg-surface ring-[1.5px] ring-[#cdd0d8] dark:ring-text-ghost',
            ]"
          >
            <span
              v-if="section.ordinal === active"
              class="size-[5px] rounded-full bg-lime"
            />
          </span>
          <span class="min-w-0 flex-1 truncate">{{ section.heading }}</span>
          <span class="num shrink-0 text-[11px] font-medium text-text-faint">{{ section.ordinal }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
