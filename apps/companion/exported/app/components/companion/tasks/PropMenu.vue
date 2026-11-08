<script setup lang="ts">
/**
 * One property picker, the way trackers do it (adgen-new's to-do): the
 * value is a button; the button opens a short menu with a glyph per option
 * and a check on the current one. Used in a task's sidebar (`side`), as a
 * row of pills under its title on a phone and in New task (`chip`), and on
 * a list row (`icon`). A long list (courses, times) gets a search box, and
 * Enter takes the first match, so "16" Enter is 16:00.
 *
 * Fixed to the window and teleported to the body: the board's lanes and the
 * sidebar scroll, and a menu placed inside either is cut off at its edge. It
 * sits over UiModal's layer (100), because New task opens these inside one.
 * Arrow keys walk the options; Escape closes this menu and nothing else.
 */
import type { Priority } from '~/companion/types'
import type { PropOption, TaskColumn } from '~/companion/tasks'

const props = withDefaults(
  defineProps<{
    label: string
    options: PropOption[]
    value?: string | null
    kind?: 'status' | 'priority' | 'course' | 'plain'
    variant?: 'side' | 'chip' | 'icon'
    align?: 'left' | 'right'
    /** A search box above the options; on by itself past eight of them. */
    search?: boolean
    disabled?: boolean
  }>(),
  { value: null, kind: 'plain', variant: 'side', align: 'left', search: undefined, disabled: false },
)

const emit = defineEmits<{ pick: [key: string] }>()

const { t } = useI18n()

const open = ref(false)
const query = ref('')
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const pop = ref<HTMLElement | null>(null)
const place = ref<Record<string, string>>({})

const searching = computed(() => props.search ?? props.options.length > 8)
const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? props.options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(q)) : props.options
})

const WIDTH = 232
const HEIGHT = 340

/** Under the button when it fits, over it when the window ends first; never past an edge. */
function position(): void {
  const rect = trigger.value?.getBoundingClientRect()
  if (!rect) return
  const width = Math.max(WIDTH, props.variant === 'side' ? rect.width : 0)
  const left = Math.max(8, Math.min(props.align === 'right' ? rect.right - width : rect.left, window.innerWidth - width - 8))
  const below = window.innerHeight - rect.bottom
  place.value = below < Math.min(HEIGHT, 240) && rect.top > below
    ? { left: `${left}px`, bottom: `${window.innerHeight - rect.top + 4}px`, minWidth: `${width}px` }
    : { left: `${left}px`, top: `${rect.bottom + 4}px`, minWidth: `${width}px` }
}

function outside(event: Event): void {
  const target = event.target as Node | null
  if (target && !root.value?.contains(target) && !pop.value?.contains(target)) close()
}

/** A scroll inside the menu (a long course list) isn't a reason to close it. */
function onScroll(event: Event): void {
  if (pop.value && event.target instanceof Node && pop.value.contains(event.target)) return
  close()
}

function listen(on: boolean): void {
  const method = on ? 'addEventListener' : 'removeEventListener'
  document[method]('pointerdown', outside, true)
  window[method]('resize', close)
  window[method]('scroll', onScroll, true)
}

function toggle(): void {
  if (props.disabled) return
  if (open.value) return close()
  query.value = ''
  position()
  open.value = true
  listen(true)
  void nextTick(() => {
    const first = pop.value?.querySelector<HTMLElement>('input')
      ?? pop.value?.querySelector<HTMLElement>('[aria-checked="true"]')
      ?? pop.value?.querySelector<HTMLElement>('[role^="menuitem"]')
    first?.focus()
  })
}

function close(): void {
  if (!open.value) return
  open.value = false
  listen(false)
}
onBeforeUnmount(() => listen(false))

/** Focus goes back to the button, so a form's shortcuts (Ctrl+Enter in New task) still reach it. */
function pick(key: string): void {
  emit('pick', key)
  close()
  trigger.value?.focus()
}

function onSearchEnter(): void {
  const first = shown.value[0]
  if (first) pick(first.key)
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.stopPropagation()
    close()
    trigger.value?.focus()
    return
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  event.preventDefault()
  const items = [...(pop.value?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])]
  const at = items.indexOf(document.activeElement as HTMLElement)
  items[event.key === 'ArrowDown' ? Math.min(items.length - 1, at + 1) : Math.max(0, at - 1)]?.focus()
}

defineExpose({ close })
</script>

<template>
  <span
    ref="root"
    :class="['relative inline-flex min-w-0', variant === 'side' && 'w-full']"
  >
    <button
      ref="trigger"
      type="button"
      :aria-label="label"
      :title="variant === 'icon' ? label : undefined"
      aria-haspopup="menu"
      :aria-expanded="open"
      :disabled="disabled"
      :class="[
        'inline-flex min-w-0 cursor-pointer items-center text-left text-text transition-colors disabled:cursor-default',
        variant === 'side' && 'min-h-8 w-full gap-2 rounded-[8px] px-2 py-1 text-[13.5px] hover:bg-[rgb(var(--wash-rgb)/0.05)] aria-expanded:bg-[rgb(var(--wash-rgb)/0.06)]',
        variant === 'chip' && 'h-8 gap-1.5 rounded-[9px] bg-surface px-2.5 text-[13px] font-medium whitespace-nowrap shadow-[inset_0_0_0_1px_var(--border)] hover:shadow-[inset_0_0_0_1px_var(--border-strong)] aria-expanded:shadow-[inset_0_0_0_1px_var(--border-strong)]',
        variant === 'icon' && 'size-8 justify-center rounded-[8px] hover:bg-[rgb(var(--wash-rgb)/0.06)] aria-expanded:bg-[rgb(var(--wash-rgb)/0.06)]',
      ]"
      @click.stop="toggle"
    >
      <slot />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="pop"
        role="menu"
        :aria-label="label"
        class="fixed z-[110] max-h-[340px] max-w-[min(320px,calc(100vw-16px))] overflow-y-auto rounded-[12px] bg-surface-pop p-1.5 text-left shadow-[var(--shadow-pop)]"
        :style="place"
        @keydown="onKey"
        @click.stop
      >
        <div
          v-if="searching"
          class="mb-1 border-b border-border-rule"
        >
          <input
            v-model="query"
            type="text"
            :placeholder="t('tasks.menu.find', { what: label.toLowerCase() })"
            :aria-label="t('tasks.menu.findAria', { what: label.toLowerCase() })"
            class="h-9 w-full bg-transparent px-2 text-[14px] text-text outline-none placeholder:text-text-faint"
            @keydown.enter.prevent="onSearchEnter"
          >
        </div>
        <p
          v-else-if="kind !== 'plain'"
          class="px-2 pt-1 pb-1.5 text-[12px] font-semibold text-text-faint"
        >
          {{ label }}
        </p>
        <button
          v-for="option in shown"
          :key="option.key"
          type="button"
          :role="kind === 'plain' ? 'menuitem' : 'menuitemradio'"
          :aria-checked="kind === 'plain' ? undefined : value === option.key"
          class="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-[8px] px-2 text-left text-[13.5px] text-text-dim outline-none hover:bg-surface-sunken hover:text-text focus-visible:bg-surface-sunken focus-visible:text-text"
          @click="pick(option.key)"
        >
          <span class="grid w-4 shrink-0 place-items-center">
            <CompanionTasksStatusIcon
              v-if="kind === 'status'"
              :s="option.key as TaskColumn"
            />
            <CompanionTasksPriorityIcon
              v-else-if="kind === 'priority'"
              :p="Number(option.key) as Priority"
            />
            <CompanionCourseCover
              v-else-if="kind === 'course' && option.key"
              :subject="option.key"
              size="sm"
              :px="16"
            />
            <UiIcon
              v-else-if="kind === 'course'"
              name="x"
              :size="13"
              class="text-text-faint"
            />
          </span>
          <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
          <span
            v-if="option.hint"
            class="num shrink-0 text-[12px] text-text-faint"
          >{{ option.hint }}</span>
          <UiIcon
            v-if="kind !== 'plain' && value === option.key"
            name="check"
            :size="14"
            class="shrink-0 text-text"
          />
        </button>
        <p
          v-if="!shown.length"
          class="px-2 py-2 text-[13px] text-text-muted"
        >
          {{ t('tasks.menu.nothing') }}
        </p>
        <slot
          name="extra"
          :close="close"
        />
      </div>
    </Teleport>
  </span>
</template>
