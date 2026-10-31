<script setup lang="ts">
/**
 * One change waiting for the learner's OK, in the same pale-amber card as
 * Today's "Waiting for your OK", with more room: the course and the thing
 * it's about, the question, then before → after on one line (the old date
 * struck through), the words it came from and who said them ("Javohir, in a
 * shared message, 21:05"), one line on what saying yes does, and two
 * buttons: the change itself ("Move it (not confirmed yet)") and Ignore.
 *
 * It used to put before and after in two grey and lime boxes inside the
 * card, the quote in a third, and a coloured "Shared" pill in the corner
 * that looked pressable; the words now carry all of it.
 *
 * Used in the Inbox and in the capture sheet (a paste or a share, read).
 */
import type { Signal } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { describeSignal } from '~/companion/signals'
import { courseColor } from '~/companion/colors'

const props = defineProps<{ signal: Signal }>()
const emit = defineEmits<{ done: [result: 'applied' | 'dismissed'] }>()

const c = useCompanion()
const view = computed(() => describeSignal(props.signal, c))
const busy = ref<'apply' | 'dismiss' | null>(null)
const toast = useToast()

/** "Javohir, in a shared message, 21:05", or just where it came from. */
const who = computed(() => {
  const v = view.value
  if (!v.quoteBy) return v.source
  const [name, time] = v.quoteBy.split(/\s*·\s*/)
  const where = v.source.startsWith('From ') ? `in ${v.source.slice(5)}` : v.source[0]!.toLowerCase() + v.source.slice(1)
  return [name, where, time].filter(Boolean).join(', ')
})

async function apply(): Promise<void> {
  busy.value = 'apply'
  try {
    await c.applySignal(props.signal.id)
    toast.success(view.value.before && view.value.after ? `${view.value.subjectLine}: ${view.value.after}` : 'Done')
    emit('done', 'applied')
  } catch {
    toast.error('That didn\'t go through. Try again in a moment.')
  } finally {
    busy.value = null
  }
}

async function dismiss(): Promise<void> {
  busy.value = 'dismiss'
  try {
    await c.dismissSignal(props.signal.id)
    emit('done', 'dismissed')
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <article class="grid gap-4 rounded-[20px] border border-warn-line bg-warn-soft p-5">
    <div class="grid gap-1.5">
      <p class="flex min-w-0 items-center gap-2 text-[14px] text-text-soft">
        <span
          class="size-2 shrink-0 rounded-full"
          :style="{ background: courseColor(view.subject?.color) }"
        />
        <span class="truncate">{{ view.subjectLine }}</span>
      </p>
      <h3 class="t-head text-[21px] leading-snug">
        {{ view.headline }}
      </h3>
      <p
        v-if="view.after"
        class="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[17px] leading-snug"
      >
        <span
          class="text-text-muted"
          :class="view.before ? 'line-through' : ''"
        >{{ view.before ?? 'Not on your calendar' }}</span>
        <CompanionIcon
          name="arrow-right"
          :size="17"
          class="text-text-muted"
        />
        <span class="sr-only">to</span>
        <b class="font-semibold text-text">{{ view.after }}</b>
      </p>
    </div>

    <figure class="grid gap-1">
      <blockquote class="text-[15px] leading-relaxed text-text-body">
        “{{ view.quote }}”
      </blockquote>
      <figcaption class="text-[14px] text-text-muted">
        {{ who }}
      </figcaption>
    </figure>

    <p class="text-[14px] leading-relaxed text-text-muted">
      {{ view.consequence }}
    </p>

    <div class="flex flex-wrap items-center gap-2">
      <UiBtn
        variant="primary"
        size="lg"
        :loading="busy === 'apply'"
        :disabled="!view.canApply || busy !== null"
        @click="apply"
      >
        {{ view.applyLabel }}
      </UiBtn>
      <UiBtn
        variant="ghost"
        size="lg"
        :loading="busy === 'dismiss'"
        :disabled="busy !== null"
        @click="dismiss"
      >
        Ignore
      </UiBtn>
    </div>
  </article>
</template>
