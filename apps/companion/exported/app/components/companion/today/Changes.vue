<script setup lang="ts">
/**
 * Changes BiliMind heard about (a chat, an email, the lecture) and won't
 * make without a yes. The few that exist sit on Today, where they get seen;
 * the section draws nothing when there are none.
 *
 * Compact on purpose: one row each in one warm card, never a wall of amber.
 * A row says what it is about and where it came from, the change itself
 * (before → after), and offers exactly two answers: the change, as a verb
 * ("Move it"), and Not this. The quoted words sit under the change, so where
 * it came from is never a page away (the Inbox is gone; this is where they
 * wait, every one of them). A message to read is one link away: Paste.
 *
 * Adding a new deadline whose course has topics ends with a quiet
 * "See what it needs" on the toast: three questions on its scope whose
 * misses go into the plan. The app prepares the learner
 * for new work; it never starts the work for them.
 */
import type { Signal } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { describeSignal, type SignalView } from '~/companion/signals'
import { courseColor } from '~/companion/colors'
import { checkHref } from '~/companion/checks'
import { useCapture } from '~/companion/capture'

const { t } = useI18n()
const c = useCompanion()
const toast = useToast()
const capture = useCapture()
const shown = computed(() => c.pendingSignals.value.map((s) => ({ s, v: describeSignal(s, c) })))
const busy = ref<string | null>(null)

/** "Move it (not confirmed yet)" reads as a sentence; a button wants the verb. */
function verb(v: SignalView): string {
  return v.applyLabel.replace(/\s*\(.*\)$/, '')
}

async function apply(s: Signal, view: SignalView): Promise<void> {
  busy.value = s.id
  const known = new Set(c.deadlines.value.map((d) => d.id))
  try {
    await c.applySignal(s.id)
    const title = view.after ? `${view.subjectLine}: ${view.after}` : t('common.done')
    // The deadline the yes just made: new since the press, upcoming, with
    // topics to ask about (no `topic_ids` means the whole course's).
    const made = s.facts.some((f) => f.type === 'deadline.create')
      ? c.deadlines.value.find((d) => !known.has(d.id) && d.status === 'upcoming' && c.readinessOf(d).total > 0)
      : undefined
    if (made) {
      toast.success({
        title,
        action: { label: t('today.changes.seeNeeds'), handler: () => void navigateTo(checkHref({ purpose: 'prepare', deadlineId: made.id })) },
      })
    } else toast.success(title)
  } catch {
    toast.error(t('today.signal.failed'))
  } finally {
    busy.value = null
  }
}

async function dismiss(s: Signal): Promise<void> {
  busy.value = s.id
  try {
    await c.dismissSignal(s.id)
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <section
    v-if="shown.length"
    aria-labelledby="today-changes"
  >
    <div class="flex items-baseline justify-between gap-3 px-0.5">
      <h2
        id="today-changes"
        class="flex items-center gap-2 font-display text-[18px] font-semibold tracking-[-0.02em]"
      >
        {{ t('today.changes.title') }}
        <span class="grid h-6 min-w-6 place-items-center rounded-full bg-warn-soft px-1.5 font-sans text-[12px] font-semibold text-warn-text">
          {{ c.pendingSignals.value.length }}
        </span>
      </h2>
      <button
        type="button"
        class="-my-[13px] inline-flex cursor-pointer items-center gap-1 py-[13px] text-[12.5px] font-semibold text-text-muted transition-colors hover:text-text"
        @click="capture.show('paste')"
      >
        <CompanionIcon
          name="paste"
          :size="14"
        />
        {{ t('today.changes.paste') }}
      </button>
    </div>

    <TransitionGroup
      tag="ul"
      class="mt-3 overflow-hidden rounded-[18px] bg-surface shadow-[0_0_0_1px_var(--warn-line),var(--shadow-raised)]"
      enter-active-class="duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="duration-200 ease-in"
      leave-to-class="opacity-0"
    >
      <li
        v-for="({ s, v }, index) in shown"
        :key="s.id"
        :class="['flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap', index > 0 && 'border-t border-border-rule']"
      >
        <span class="grid size-8 shrink-0 place-items-center self-start rounded-full bg-warn-soft text-warn-text sm:self-center">
          <UiIcon
            name="bell"
            :size="15"
          />
        </span>
        <span class="grid min-w-0 flex-1 gap-0.5">
          <span class="flex min-w-0 items-center gap-1.5 text-[12px] text-text-faint">
            <span
              class="size-2 shrink-0 rounded-full"
              :style="{ background: courseColor(v.subject?.color) }"
            />
            <span class="truncate">{{ v.subjectLine }} · {{ v.source }}</span>
          </span>
          <span class="text-[14.5px] leading-snug font-semibold text-text">{{ v.headline }}</span>
          <span
            v-if="v.after"
            class="text-[13px] text-text-soft"
          >
            <span
              v-if="v.before"
              class="line-through opacity-70"
            >{{ v.before }}</span>
            <span
              v-if="v.before"
              aria-hidden="true"
            > → </span>
            <b class="font-semibold text-text">{{ v.after }}</b>
          </span>
          <span
            v-if="v.quote"
            class="truncate text-[12.5px] text-text-faint"
            :title="v.quote"
          >“{{ v.quote }}”<template v-if="v.quoteBy"> · {{ v.quoteBy }}</template></span>
        </span>
        <span class="flex shrink-0 items-center gap-1 max-sm:w-full max-sm:pl-11">
          <UiBtn
            variant="secondary"
            size="md"
            class="max-sm:h-11"
            :loading="busy === s.id"
            :disabled="!v.canApply || busy !== null"
            :title="v.consequence"
            @click="apply(s, v)"
          >
            {{ verb(v) }}
          </UiBtn>
          <UiBtn
            variant="ghost"
            size="md"
            class="max-sm:h-11"
            :disabled="busy !== null"
            @click="dismiss(s)"
          >
            {{ t('today.changes.notThis') }}
          </UiBtn>
        </span>
      </li>
    </TransitionGroup>
  </section>
</template>
