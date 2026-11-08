<script setup lang="ts">
import type { Assessment, AttemptResponse } from '~/types/api'

/**
 * EXPAND §1 — put the steps in order. Submits `{order: [id, ...]}`.
 *
 * Reordered with buttons rather than drag-and-drop, deliberately. Native HTML5
 * drag does not work on touch at all, and a drag implementation that does work on
 * touch is a large amount of code and a keyboard-accessibility problem. Up/down
 * buttons work everywhere, on every input device, first try.
 *
 * The options arrive scrambled from the generator and the correct sequence lives
 * only in the answer key, so nothing here can reveal it.
 */
const { t } = useI18n()
const props = defineProps<{
  assessment: Assessment
  disabled?: boolean
}>()

const model = defineModel<AttemptResponse | null>({ default: null })

/** Working order, seeded from the options as the API returned them. */
const order = ref<string[]>([])

watch(
  () => props.assessment.options,
  (options) => {
    order.value = (options ?? []).map((option) => option.id)
  },
  { immediate: true },
)

const byId = computed(() =>
  Object.fromEntries((props.assessment.options ?? []).map((option) => [option.id, option.text])),
)

function publish(): void {
  model.value = { order: [...order.value] }
}

/**
 * The starting order counts as an answer, so this has to publish itself. It
 * waits for mount rather than doing it in the watcher above: writing the parent's
 * model during setup changes the submit button's `disabled` between the server
 * render and hydration, which is a mismatch Vue will not rectify.
 */
onMounted(publish)
watch(order, publish)

function move(index: number, delta: number): void {
  if (props.disabled) return

  const target = index + delta

  if (target < 0 || target >= order.value.length) return

  const next = [...order.value]
  const [item] = next.splice(index, 1)

  next.splice(target, 0, item!)
  order.value = next
  publish()
}
</script>

<template>
  <ol
    class="flex flex-col gap-1.5"
    :aria-label="assessment.prompt"
  >
    <li
      v-for="(id, index) in order"
      :key="id"
      class="flex min-h-[46px] items-center gap-3 rounded-[12px] bg-surface py-1.5 pr-1.5 pl-3 shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.12)]"
      :class="disabled && 'opacity-60'"
    >
      <span
        class="num grid size-[22px] shrink-0 place-items-center rounded-full bg-chip font-display text-[11px] font-semibold text-accent tabular-nums"
        aria-hidden="true"
      >
        {{ index + 1 }}
      </span>

      <span class="min-w-0 flex-1 text-[14px] leading-snug text-text-body">{{ byId[id] }}</span>

      <span class="flex shrink-0 flex-col">
        <button
          type="button"
          class="grid h-[17px] w-7 cursor-pointer place-items-center rounded-t-[7px] text-text-faint transition hover:bg-surface-sunken hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
          :disabled="disabled || index === 0"
          :aria-label="t('check.assess.moveEarlier', { item: byId[id] })"
          @click="move(index, -1)"
        >
          <svg
            width="9"
            height="9"
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1 6.5 5 2.5l4 4"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          class="grid h-[17px] w-7 cursor-pointer place-items-center rounded-b-[7px] text-text-faint transition hover:bg-surface-sunken hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
          :disabled="disabled || index === order.length - 1"
          :aria-label="t('check.assess.moveLater', { item: byId[id] })"
          @click="move(index, 1)"
        >
          <svg
            width="9"
            height="9"
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1 3.5 5 7.5l4-4"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </span>
    </li>
  </ol>
</template>
