<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    size?: 'sm' | 'compact' | 'md' | 'lg'
    /** Disable backdrop / Escape dismissal for destructive flows. */
    persistent?: boolean
  }>(),
  { size: 'md' },
)

const open = defineModel<boolean>('open', { default: false })

const widths = { sm: 'max-w-sm', compact: 'max-w-[440px]', md: 'max-w-lg', lg: 'max-w-2xl' } as const

const panel = useTemplateRef<HTMLElement>('panel')
const uid = useId()

function close(): void {
  if (props.persistent) return
  open.value = false
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close()
  if (event.key !== 'Tab' || !panel.value) return

  const focusables = panel.value.querySelectorAll<HTMLElement>(
    'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])',
  )
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

watch(open, async (isOpen) => {
  if (!import.meta.client) return
  document.body.style.overflow = isOpen ? 'hidden' : ''
  if (isOpen) {
    await nextTick()
    const preferred = panel.value?.querySelector<HTMLElement>('[autofocus]')
    if (preferred) preferred.focus()
    else panel.value?.focus()
  }
})

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
          v-if="open"
          class="fixed inset-0 z-100 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title ? `${uid}-title` : undefined"
          @keydown="onKeydown"
        >
          <div
            class="fixed inset-0 bg-[rgb(6_9_30/0.62)] backdrop-blur-[10px]"
            @click="close"
          />

          <div
            ref="panel"
            tabindex="-1"
            :class="[
              'pop-in relative w-full rounded-t-[26px] bg-surface shadow-[0_0_0_1px_rgb(var(--wash-rgb)/0.06),0_40px_80px_-20px_rgb(0_0_0/0.6)] outline-none sm:rounded-[26px]',
              widths[size],
            ]"
          >
            <header
              v-if="title || $slots.header"
              class="flex items-start justify-between gap-4 border-b border-border px-6 pt-5 pb-4"
            >
              <div class="min-w-0">
                <slot name="header">
                  <h2
                    :id="`${uid}-title`"
                    class="t-head text-[19px]"
                  >
                    {{ title }}
                  </h2>
                  <p
                    v-if="description"
                    class="mt-1 text-[13px] leading-relaxed text-text-muted"
                  >
                    {{ description }}
                  </p>
                </slot>
              </div>
              <UiBtn
                variant="ghost"
                size="sm"
                square
                icon="x"
                label="Close"
                class="-mt-1 -mr-1.5"
                @click="close"
              />
            </header>

            <div class="px-6 py-5">
              <slot />
            </div>

            <footer
              v-if="$slots.footer"
              class="flex items-center justify-end gap-2 border-t border-border bg-surface-mute px-6 py-4 sm:rounded-b-[26px]"
            >
              <slot name="footer" />
            </footer>
          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>
