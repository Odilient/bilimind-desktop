<script setup lang="ts">
const { t } = useI18n()
/**
 * The overflow menu behind a row's secondary actions.
 *
 * It exists to fix a specific problem: a list row that carries three visible
 * buttons reads as an admin table, and the learner has to choose between them
 * before they can do the obvious thing. One primary action stays on the row and
 * everything else moves in here, so the row can go back to being a lesson.
 *
 * A popover on desktop and a bottom sheet on a phone, because a 32px popover
 * anchored to a 32px button is unhittable with a thumb.
 */
export interface MenuAction {
  label: string
  icon?: string
  /** Renders in red and sits under a divider. */
  destructive?: boolean
  disabled?: boolean
  run: () => void
}

const props = withDefaults(
  defineProps<{
    actions: MenuAction[]
    label?: string
    /** Heading for the phone sheet only — a popover does not need one. */
    title?: string
    align?: 'left' | 'right'
    /**
     * Draw the popover at the body with fixed coordinates, for a menu that
     * lives in a scrolling list (a chat history, a sidebar): positioned
     * inside it, the list's own overflow would cut the menu off. Opens
     * upwards when there is no room below. Closes on scroll.
     */
    float?: boolean
    /** The trigger's glyph: "⋯" unless the menu is one kind of thing (a paperclip: attach). */
    icon?: string
  }>(),
  { label: undefined, align: 'right', float: false, icon: 'dots' },
)

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const pop = ref<HTMLElement | null>(null)
const trigger = ref<HTMLElement | null>(null)
const place = ref<Record<string, string>>({})

/** Where a floating popover goes: under its button, or over it when the window ends first. */
function measure(): void {
  const rect = trigger.value?.getBoundingClientRect()
  if (!rect) return
  // Rows are 36px; the padding and dividers add a little.
  const height = props.actions.length * 36 + 24
  const below = window.innerHeight - rect.bottom
  const side: Record<string, string> = props.align === 'right'
    ? { right: `${Math.max(8, window.innerWidth - rect.right)}px` }
    : { left: `${Math.max(8, rect.left)}px` }
  place.value = below < height + 12 && rect.top > below
    ? { ...side, bottom: `${window.innerHeight - rect.top + 6}px` }
    : { ...side, top: `${rect.bottom + 6}px` }
}

function onScroll(event: Event): void {
  if (pop.value && pop.value.contains(event.target as Node)) return
  open.value = false
}

/* The sheet teleports to `body`, so which of the two shows cannot be a
   responsive class on this element. Safe here: both are closed at hydration. */
const isPhone = useIsPhone()
const sheetOpen = computed({
  get: () => open.value && isPhone.value,
  set: (value) => {
    open.value = value
  },
})

function choose(action: MenuAction): void {
  if (action.disabled) return
  open.value = false
  action.run()
}

function onDocumentPointerDown(event: PointerEvent): void {
  const target = event.target as Node
  if (!root.value?.contains(target) && !pop.value?.contains(target)) open.value = false
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') open.value = false
}

watch(open, (isOpen) => {
  if (!import.meta.client) return
  const method = isOpen ? 'addEventListener' : 'removeEventListener'
  document[method]('pointerdown', onDocumentPointerDown as EventListener)
  document[method]('keydown', onKeydown as EventListener)
  if (!props.float) return
  if (isOpen) measure()
  window[method]('scroll', onScroll, true)
  window[method]('resize', onScroll)
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.removeEventListener('pointerdown', onDocumentPointerDown as EventListener)
  document.removeEventListener('keydown', onKeydown as EventListener)
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', onScroll)
})
</script>

<template>
  <div
    ref="root"
    class="relative shrink-0"
  >
    <button
      ref="trigger"
      type="button"
      :aria-label="label ?? t('ui.moreActions')"
      :aria-expanded="open"
      aria-haspopup="menu"
      :class="[
        'grid size-9 cursor-pointer place-items-center rounded-full transition-colors lg:size-8',
        open
          ? 'bg-[rgb(var(--wash-rgb)/0.06)] text-text'
          : 'text-text-faint hover:bg-[rgb(var(--wash-rgb)/0.06)] hover:text-text-soft',
      ]"
      @click="open = !open"
    >
      <UiIcon
        :name="icon"
        :size="18"
      />
    </button>

    <!-- Desktop popover -->
    <Teleport
      to="body"
      :disabled="!float"
    >
      <Transition
        enter-active-class="duration-120 ease-out"
        enter-from-class="opacity-0 scale-95"
        leave-active-class="duration-100 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-if="open && !isPhone"
          ref="pop"
          role="menu"
          :class="[
            'min-w-[196px] rounded-[12px] bg-surface-pop p-1.5 shadow-[var(--shadow-pop)]',
            float
              ? 'fixed z-[98] origin-top'
              : ['absolute top-full z-50 mt-1.5 origin-top', align === 'right' ? 'right-0' : 'left-0'],
          ]"
          :style="float ? place : undefined"
        >
          <template
            v-for="(action, index) in actions"
            :key="action.label"
          >
            <div
              v-if="action.destructive && index > 0"
              class="my-1 border-t border-border-rule"
            />
            <button
              type="button"
              role="menuitem"
              :disabled="action.disabled"
              :class="[
                'flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                action.destructive
                  ? 'text-danger hover:bg-danger-soft'
                  : 'text-text-dim hover:bg-surface-sunken hover:text-text',
              ]"
              @click="choose(action)"
            >
              <UiIcon
                v-if="action.icon"
                :name="action.icon"
                :size="15"
                class="shrink-0"
              />
              {{ action.label }}
            </button>
          </template>
        </div>
      </Transition>
    </Teleport>

    <!-- Phone sheet -->
    <UiSheet
      v-model:open="sheetOpen"
      :title="title"
    >
      <div class="mt-2 flex flex-col gap-1">
        <button
          v-for="action in actions"
          :key="action.label"
          type="button"
          :disabled="action.disabled"
          :class="[
            'flex w-full items-center gap-3 rounded-[16px] px-3.5 py-3.5 text-left text-[15px] font-medium transition-colors disabled:opacity-40',
            action.destructive ? 'text-danger active:bg-danger-soft' : 'text-text-dim active:bg-surface-sunken',
          ]"
          @click="choose(action)"
        >
          <UiIcon
            v-if="action.icon"
            :name="action.icon"
            :size="19"
            class="shrink-0 text-text-faint"
          />
          {{ action.label }}
        </button>
      </div>
    </UiSheet>
  </div>
</template>
