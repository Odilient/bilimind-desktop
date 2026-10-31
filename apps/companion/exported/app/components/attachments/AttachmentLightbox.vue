<script setup lang="ts">
import type { Attachment } from '~/types/api'

/**
 * ATTACH — one picture, as large as the screen allows.
 *
 * Not a `<UiModal>`: that is a white panel with a header, built for a decision,
 * and a photo of somebody's wiring wants the opposite — a dark room, the
 * picture, its caption, and nothing else with an edge. So this is its own
 * overlay, with the same manners as `ui/Modal.vue`: teleported to `body`,
 * scroll locked behind it, Escape and a click on the dark close it, Tab stays
 * inside, and the button that opened it gets its focus back when it closes.
 *
 * Arrow keys step through the lesson's pictures; so does a swipe, done with
 * pointer events rather than touch events so a stylus counts too. The counter
 * is the only figure on screen and it is set in tabular figures, not mono —
 * "2 of 5" is not code.
 */
const props = defineProps<{
  /** The lesson's pictures only, in reading order. */
  images: Attachment[]
}>()

const open = defineModel<boolean>('open', { default: false })
const index = defineModel<number>('index', { default: 0 })

const current = computed(() => props.images[index.value] ?? null)
const many = computed(() => props.images.length > 1)

const panel = useTemplateRef<HTMLElement>('panel')
let opener: HTMLElement | null = null

function close(): void {
  open.value = false
}

function step(direction: -1 | 1): void {
  const count = props.images.length
  if (count < 2) return
  index.value = (index.value + direction + count) % count
}

function onKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'Escape':
      close()
      return
    case 'ArrowLeft':
      event.preventDefault()
      step(-1)
      return
    case 'ArrowRight':
      event.preventDefault()
      step(1)
      return
    case 'Tab':
      break
    default:
      return
  }

  if (!panel.value) return

  const focusables = panel.value.querySelectorAll<HTMLElement>('button:not([disabled])')
  if (focusables.length === 0) return

  const first = focusables[0]!
  const last = focusables[focusables.length - 1]!
  const active = document.activeElement

  if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

/* -- Swipe ----------------------------------------------------------------- */

let swipeStart: { x: number; y: number; id: number } | null = null

/** A swipe that stepped is followed by a `click` on whatever it ended over; that click is not a dismissal. */
let swiped = false

function onPointerDown(event: PointerEvent): void {
  if (!event.isPrimary) return
  swipeStart = { x: event.clientX, y: event.clientY, id: event.pointerId }
}

function cancelSwipe(): void {
  swipeStart = null
}

/**
 * A sideways drag of a finger's width steps; a shorter or mostly vertical one
 * is a tap or a scroll and is left alone. No preventDefault on the way, so
 * pinch-zoom on the picture keeps working.
 */
function onPointerUp(event: PointerEvent): void {
  if (!swipeStart || swipeStart.id !== event.pointerId) return

  const dx = event.clientX - swipeStart.x
  const dy = event.clientY - swipeStart.y
  swipeStart = null

  if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return
  swiped = true
  step(dx < 0 ? 1 : -1)
}

/**
 * The dark is the close target. It is not one element underneath the others —
 * the three bands cover the whole screen — so each band closes on a click
 * that landed on the band itself and not on the picture or a button in it.
 */
function onBackdropClick(): void {
  if (swiped) {
    swiped = false
    return
  }
  close()
}

/* -- Lifecycle ------------------------------------------------------------- */

watch(open, async (isOpen) => {
  if (!import.meta.client) return

  document.body.style.overflow = isOpen ? 'hidden' : ''

  if (isOpen) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    panel.value?.focus()
  } else {
    opener?.focus()
    opener = null
  }
})

/* A picture removed while it is on screen: fall back rather than show nothing. */
watch(
  () => props.images.length,
  (count) => {
    if (count === 0) close()
    else if (index.value >= count) index.value = count - 1
  },
)

onBeforeUnmount(() => {
  if (import.meta.client) document.body.style.overflow = ''
})
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <Transition
        enter-active-class="duration-150 ease-out"
        enter-from-class="opacity-0"
        leave-active-class="duration-120 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-if="open && current"
          ref="panel"
          tabindex="-1"
          role="dialog"
          aria-modal="true"
          :aria-label="current.caption || current.name"
          class="fixed inset-0 z-100 flex flex-col bg-black/92 text-white outline-none select-none"
          @keydown="onKeydown"
          @pointerdown="onPointerDown"
          @pointerup="onPointerUp"
          @pointercancel="cancelSwipe"
        >
          <header
            class="relative z-10 flex items-center gap-3 px-4 py-3 sm:px-5"
            @click.self="onBackdropClick"
          >
            <span
              v-if="many"
              class="num text-[12.5px] text-white/60"
            >
              {{ index + 1 }} of {{ images.length }}
            </span>
            <span class="flex-1" />
            <button
              type="button"
              aria-label="Close"
              class="grid size-9 cursor-pointer place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              @click="close"
            >
              <UiIcon
                name="x"
                :size="18"
              />
            </button>
          </header>

          <div
            class="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4 sm:px-16"
            @click.self="onBackdropClick"
          >
            <button
              v-if="many"
              type="button"
              aria-label="Previous picture"
              class="absolute top-1/2 left-2 hidden size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:grid sm:left-4"
              @click="step(-1)"
            >
              <UiIcon
                name="chevron-left"
                :size="22"
              />
            </button>

            <img
              :key="current.uuid"
              :src="current.url"
              :alt="current.caption || current.name"
              decoding="async"
              class="pop-in max-h-full max-w-full rounded-md object-contain shadow-pop"
              draggable="false"
            />

            <button
              v-if="many"
              type="button"
              aria-label="Next picture"
              class="absolute top-1/2 right-2 hidden size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:grid sm:right-4"
              @click="step(1)"
            >
              <UiIcon
                name="chevron-right"
                :size="22"
              />
            </button>
          </div>

          <footer
            class="relative z-10 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-center"
            @click.self="onBackdropClick"
          >
            <p
              v-if="current.caption"
              class="mx-auto max-w-2xl text-[14px] leading-relaxed text-white/85"
            >
              {{ current.caption }}
            </p>
            <p class="mt-1 truncate text-[11.5px] text-white/45">{{ current.name }}</p>
          </footer>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>
