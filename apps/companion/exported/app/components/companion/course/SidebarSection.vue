<script setup lang="ts">
/**
 * One part of the course sidebar (Lessons, Notes & whiteboards, Materials):
 * a heading that folds what is under it, how many things are in it, and the
 * part's own "+" (a new note, a lesson on a topic, an upload), which only
 * shows while the pointer is on the heading or the button has focus, so three
 * idle headings don't read as three toolbars.
 *
 * Folded or not is the parent's, so it can be remembered per course.
 *
 * A part whose "+" opens a list of kinds (Notes: page or whiteboard;
 * Materials: files, a link, a recording) passes its own button in the `add`
 * slot; it keeps the same place and the same quiet, and stays showing while
 * its list is open.
 */
defineProps<{
  title: string
  count?: number | null
  open: boolean
  /** The "+" button's tooltip; no label, no button. */
  addLabel?: string
}>()

const emit = defineEmits<{ toggle: []; add: [] }>()
</script>

<template>
  <section class="pt-2">
    <div class="group/section flex h-7 items-center gap-1 rounded-[8px] pr-1 pl-0.5 transition-colors hover:bg-[rgb(var(--wash-rgb)/0.035)]">
      <button
        type="button"
        class="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-[10px] text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
        :aria-expanded="open"
        @click="emit('toggle')"
      >
        <span class="grid size-5 shrink-0 place-items-center text-text-faint transition-colors group-hover/section:text-text-soft">
          <UiIcon
            name="chevron-down"
            :size="12"
            :stroke="2.2"
            :class="['transition-transform duration-150', !open && '-rotate-90']"
          />
        </span>
        <span class="min-w-0 truncate text-[12px] font-semibold text-text-muted">{{ title }}</span>
        <span
          v-if="count"
          class="num ml-auto shrink-0 pr-1 text-[12px] font-semibold text-text-muted"
        >{{ count }}</span>
      </button>
      <div
        v-if="$slots.add"
        class="flex shrink-0 opacity-0 transition-opacity duration-150 group-hover/section:opacity-100 focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100 max-lg:opacity-100"
      >
        <slot name="add" />
      </div>
      <button
        v-else-if="addLabel"
        type="button"
        :title="addLabel"
        :aria-label="addLabel"
        class="grid size-6 shrink-0 cursor-pointer place-items-center rounded-[7px] text-text-faint opacity-0 transition-[opacity,background-color,color] duration-150 group-hover/section:opacity-100 hover:bg-surface-track hover:text-text focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-brand max-lg:opacity-100"
        @click="emit('add')"
      >
        <UiIcon
          name="plus"
          :size="14"
          :stroke="2.1"
        />
      </button>
    </div>
    <div
      v-if="open"
      class="pb-2"
    >
      <slot />
    </div>
  </section>
</template>
