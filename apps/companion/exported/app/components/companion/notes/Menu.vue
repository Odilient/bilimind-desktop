<script setup lang="ts">
const { t } = useI18n()
import type { NoteMenuItem } from '~/companion/notes/actions'

/**
 * A small menu for Notes: a row's "…", a doc's "…", the note's course picker
 * (a course's dot in place of the icon, a check on the one it's in).
 *
 * Why not `UiMenu`: a sidebar row is 30px tall and scrolls inside a clipped
 * panel. `UiMenu`'s 32px trigger would set the row's height, and its popover,
 * drawn inside the row, would be cut off by the panel's edge at the bottom of
 * a long list. This one takes any trigger (the slot) and draws its popover on
 * the body, placed from the trigger's box and turned upwards when there's no
 * room below. On a phone it is the same bottom sheet `UiMenu` uses, because a
 * popover under a thumb is unhittable.
 *
 * Keyboard: the first item takes focus on open, ↑/↓ walk the list, Escape
 * closes and gives focus back to the trigger.
 */
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    items: NoteMenuItem[]
    /** The trigger's accessible name. */
    label?: string
    /** The phone sheet's heading. */
    title?: string
    /** Which edge of the trigger the popover lines up with. */
    align?: 'start' | 'end'
    width?: number
  }>(),
  { label: undefined, title: undefined, align: 'start', width: 232 },
)

const open = defineModel<boolean>('open', { default: false })

const trigger = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const pos = ref({ top: 0, left: 0 })
const isPhone = useIsPhone()

const sheetOpen = computed({
  get: () => open.value && isPhone.value,
  set: (value: boolean) => {
    open.value = value
  },
})

function toggle(): void {
  open.value = !open.value
}

function place(): void {
  const box = trigger.value?.getBoundingClientRect()
  if (!box) return
  const left = props.align === 'end' ? box.right - props.width : box.left
  const top = box.bottom + 6
  pos.value = {
    top,
    left: Math.min(Math.max(8, left), window.innerWidth - props.width - 8),
  }
  // Measured once drawn: no room below turns it upwards.
  nextTick(() => {
    const height = panel.value?.offsetHeight ?? 0
    if (top + height > window.innerHeight - 8) pos.value = { ...pos.value, top: Math.max(8, box.top - height - 6) }
    panel.value?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  })
}

function close(refocus = false): void {
  open.value = false
  if (refocus) trigger.value?.querySelector<HTMLElement>('button, a')?.focus()
}

function choose(item: NoteMenuItem): void {
  if (item.disabled) return
  close()
  item.run()
}

function onPointerDown(event: PointerEvent): void {
  const target = event.target as Node
  if (panel.value?.contains(target) || trigger.value?.contains(target)) return
  close()
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.stopPropagation()
    close(true)
    return
  }
  if (!panel.value || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const list = [...panel.value.querySelectorAll<HTMLElement>('[role="menuitem"]')]
  const at = list.indexOf(document.activeElement as HTMLElement)
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? list.length - 1
        : (at + (event.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length
  list[next]?.focus()
}

/** The page moving under a fixed popover would leave it pointing at nothing. */
function onScroll(event: Event): void {
  if (panel.value?.contains(event.target as Node)) return
  close()
}

watch(open, (isOpen) => {
  if (!import.meta.client) return
  const method = isOpen ? 'addEventListener' : 'removeEventListener'
  document[method]('pointerdown', onPointerDown as EventListener, true)
  document[method]('keydown', onKey as EventListener)
  window[method]('scroll', onScroll, true)
  window[method]('resize', onScroll)
  if (isOpen && !isPhone.value) place()
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.removeEventListener('pointerdown', onPointerDown as EventListener, true)
  document.removeEventListener('keydown', onKey as EventListener)
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', onScroll)
})
</script>

<template>
  <span
    ref="trigger"
    v-bind="$attrs"
    class="inline-flex shrink-0"
  >
    <slot
      :open="open"
      :toggle="toggle"
    >
      <button
        type="button"
        :aria-label="label ?? t('notes.moreActions')"
        :title="label ?? t('notes.moreActions')"
        aria-haspopup="menu"
        :aria-expanded="open"
        :class="[
          'grid size-[22px] cursor-pointer place-items-center rounded-[6px] transition-colors focus-visible:outline-2 focus-visible:outline-brand',
          open ? 'bg-surface-track text-text' : 'text-text-faint hover:bg-surface-track hover:text-text-soft',
        ]"
        @click.stop.prevent="toggle"
      >
        <UiIcon
          name="dots"
          :size="15"
        />
      </button>
    </slot>
  </span>

  <ClientOnly>
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-120 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        leave-active-class="transition duration-100 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-if="open && !isPhone"
          ref="panel"
          role="menu"
          :aria-label="label ?? t('notes.moreActions')"
          class="om-scroll fixed z-[95] max-h-[min(440px,calc(100dvh-16px))] overflow-y-auto rounded-[14px] bg-surface-pop p-1.5 shadow-[var(--shadow-pop)]"
          :style="{ top: `${pos.top}px`, left: `${pos.left}px`, width: `${width}px` }"
        >
          <template
            v-for="(item, index) in items"
            :key="item.label"
          >
            <div
              v-if="(item.destructive || item.divider) && index > 0"
              class="my-1 border-t border-border-rule"
            />
            <button
              type="button"
              role="menuitem"
              :disabled="item.disabled"
              :aria-checked="item.checked === undefined ? undefined : item.checked"
              :class="[
                'flex w-full cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 text-left text-[13.5px] font-medium transition-colors outline-none disabled:cursor-default disabled:opacity-50',
                item.caption ? 'min-h-[46px] py-1.5' : 'h-[34px]',
                item.destructive
                  ? 'text-danger hover:bg-danger-soft focus-visible:bg-danger-soft'
                  : 'text-text-dim hover:bg-surface-sunken hover:text-text focus-visible:bg-surface-sunken focus-visible:text-text disabled:hover:bg-transparent',
              ]"
              @click="choose(item)"
            >
              <span
                v-if="item.color"
                class="grid size-[15px] shrink-0 place-items-center"
                aria-hidden="true"
              >
                <span
                  class="size-2 rounded-full"
                  :style="{ background: item.color }"
                />
              </span>
              <CompanionNotesGlyph
                v-else
                :name="item.icon"
                :size="15"
                class="shrink-0"
                :class="item.destructive ? '' : 'text-text-faint'"
              />
              <span class="grid min-w-0 flex-1">
                <span class="truncate">{{ item.label }}</span>
                <span
                  v-if="item.caption"
                  class="truncate text-[12px] font-normal text-text-muted"
                >{{ item.caption }}</span>
              </span>
              <UiIcon
                v-if="item.checked"
                name="check"
                :size="15"
                :stroke="2.2"
                class="shrink-0 text-brand"
              />
              <kbd
                v-if="item.hint"
                class="shrink-0 font-sans text-[11.5px] font-medium text-text-faint"
              >{{ item.hint }}</kbd>
            </button>
          </template>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>

  <UiSheet
    v-if="isPhone"
    v-model:open="sheetOpen"
    :title="title"
  >
    <div class="mt-2 flex flex-col gap-1">
      <template
        v-for="(item, index) in items"
        :key="item.label"
      >
        <div
          v-if="item.divider && index > 0"
          class="mx-3.5 my-1 border-t border-border-rule"
        />
        <button
          type="button"
          :disabled="item.disabled"
          :class="[
            'flex min-h-[52px] w-full items-center gap-3 rounded-[16px] px-3.5 text-left text-[15px] font-medium transition-colors disabled:opacity-50',
            item.destructive ? 'text-danger active:bg-danger-soft' : 'text-text-dim active:bg-surface-sunken',
          ]"
          @click="choose(item)"
        >
          <span
            v-if="item.color"
            class="grid size-[19px] shrink-0 place-items-center"
            aria-hidden="true"
          >
            <span
              class="size-2.5 rounded-full"
              :style="{ background: item.color }"
            />
          </span>
          <CompanionNotesGlyph
            v-else
            :name="item.icon"
            :size="19"
            class="shrink-0"
            :class="item.destructive ? '' : 'text-text-faint'"
          />
          <span class="grid min-w-0 flex-1">
            <span class="truncate">{{ item.label }}</span>
            <span
              v-if="item.caption"
              class="truncate text-[13px] font-normal text-text-muted"
            >{{ item.caption }}</span>
          </span>
          <UiIcon
            v-if="item.checked"
            name="check"
            :size="18"
            :stroke="2.2"
            class="shrink-0 text-brand"
          />
        </button>
      </template>
    </div>
  </UiSheet>
</template>
