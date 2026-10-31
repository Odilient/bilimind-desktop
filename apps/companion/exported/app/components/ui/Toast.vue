<script setup lang="ts">
import type { Toast, ToastTone } from '~/composables/useToast'

const { toasts, dismiss } = useToast()

function runAction(toast: Toast): void {
  toast.action?.handler()
  dismiss(toast.id)
}

/**
 * Cobalt's toast is an ink card: it floats over whatever the learner is
 * reading without borrowing that surface's colour, and the round icon well
 * carries the tone the way the landing's tags carry theirs.
 */
const accents: Record<ToastTone, string> = {
  neutral: 'bg-lime text-ink',
  success: 'bg-lime text-ink',
  warn: 'bg-amber text-ink',
  danger: 'bg-coral text-white',
}

const icons: Record<ToastTone, string> = {
  neutral: 'sparkles',
  success: 'check-circle',
  warn: 'alert',
  danger: 'alert',
}
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <div
        class="pointer-events-none fixed inset-x-0 bottom-0 z-200 flex flex-col items-center gap-2 p-4 sm:right-0 sm:bottom-0 sm:left-auto sm:items-end"
        role="status"
        aria-live="polite"
      >
        <TransitionGroup
          enter-active-class="duration-200 ease-out"
          enter-from-class="opacity-0 translate-y-2"
          leave-active-class="duration-150 ease-in absolute"
          leave-to-class="opacity-0 translate-y-1"
          move-class="duration-200"
        >
          <div
            v-for="toast in toasts"
            :key="toast.id"
            class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[20px] bg-chip px-3.5 py-3 text-white shadow-[0_20px_40px_-12px_rgb(11_13_16/0.5)]"
          >
            <span
              :class="[
                'grid size-7 shrink-0 place-items-center rounded-full',
                accents[toast.tone],
              ]"
            >
              <UiIcon
                :name="icons[toast.tone]"
                :size="14"
              />
            </span>
            <div class="min-w-0 flex-1">
              <p class="pt-1 text-[13.5px] leading-snug font-semibold">{{ toast.title }}</p>
              <p
                v-if="toast.body"
                class="mt-0.5 text-[12.5px] leading-relaxed text-white/65"
              >
                {{ toast.body }}
              </p>
              <button
                v-if="toast.action"
                type="button"
                class="mt-2 text-[12.5px] font-semibold text-lime hover:underline"
                @click="runAction(toast)"
              >
                {{ toast.action.label }}
              </button>
            </div>
            <button
              type="button"
              class="mt-0.5 -mr-1 rounded-full p-1 text-white/45 transition-colors hover:text-white"
              aria-label="Dismiss"
              @click="dismiss(toast.id)"
            >
              <UiIcon
                name="x"
                :size="14"
              />
            </button>
          </div>
        </TransitionGroup>
      </div>
    </Teleport>
  </ClientOnly>
</template>
