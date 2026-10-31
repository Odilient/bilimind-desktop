<script setup lang="ts">
/**
 * A bottom sheet. The phone's answer to a dialog: it arrives from the thumb's
 * end of the screen and can be dismissed by tapping away from it.
 */
withDefaults(defineProps<{ title?: string; description?: string }>(), {})

const open = defineModel<boolean>('open', { default: false })

function close(): void {
  open.value = false
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close()
}

watch(open, (isOpen) => {
  if (import.meta.client) document.body.style.overflow = isOpen ? 'hidden' : ''
})

onBeforeUnmount(() => {
  if (import.meta.client) document.body.style.overflow = ''
})
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <Transition
        enter-active-class="duration-200 ease-out"
        enter-from-class="opacity-0"
        leave-active-class="duration-150 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-if="open"
          class="fixed inset-0 z-100"
          role="dialog"
          aria-modal="true"
          @keydown="onKeydown"
        >
          <div
            class="absolute inset-0 bg-[rgb(6_9_30/0.5)] backdrop-blur-[6px]"
            @click="close"
          />

          <div
            class="animate-sheet absolute inset-x-0 bottom-0 max-h-[78%] overflow-y-auto rounded-t-[28px] bg-surface px-5 pt-2.5 pb-7 shadow-sheet"
          >
            <div class="mx-auto mb-4 h-[5px] w-10 rounded-full bg-surface-track" />

            <h2
              v-if="title"
              class="t-head text-[21px]"
            >
              {{ title }}
            </h2>
            <p
              v-if="description"
              class="mt-1 text-[13.5px] leading-relaxed text-text-muted"
            >
              {{ description }}
            </p>

            <slot />
          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>
