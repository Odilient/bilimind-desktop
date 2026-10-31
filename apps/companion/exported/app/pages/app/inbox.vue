<script setup lang="ts">
/**
 * Waiting for your OK (the route is still /app/inbox). One question: what
 * needs my yes? Only the changes that aren't official wait here: a date said
 * in a lecture, a deadline moved in a group chat. So it is usually 0 to 3
 * cards and never a feed.
 *
 * Each change is one pale-amber card with before → after, who said it, and
 * the change itself as the button, with Ignore beside it. What already went
 * in is listed quietly underneath, one plain line each, so a change can
 * always be traced. With nothing waiting, the page says what would show up
 * and gives the one button that makes it happen: paste a message.
 *
 * Headed by the companion's masthead, as Today and the Calendar are, with
 * the count as its eyebrow so the answer comes before the explanation.
 */
import { useCompanion } from '~/companion/store'
import { useCapture } from '~/companion/capture'
import { describeSignal } from '~/companion/signals'
import { courseColor } from '~/companion/colors'
import { untilLabel } from '~/companion/time'

definePageMeta({ layout: 'companion' })

const c = useCompanion()
const capture = useCapture()

const pending = computed(() => c.pendingSignals.value)
const recent = computed(() =>
  c.signals.value
    .filter((s) => s.status !== 'pending')
    .slice(0, 8)
    .map((s) => ({ s, v: describeSignal(s, c) })),
)

function lower(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

const count = computed(() =>
  pending.value.length === 0
    ? 'Nothing to check'
    : pending.value.length === 1
      ? '1 change to check'
      : `${pending.value.length} changes to check`,
)

const STATUS: Record<string, string> = {
  applied: 'You said yes',
  auto: 'Went straight in',
  dismissed: 'You ignored it',
}
</script>

<template>
  <div class="pb-20">
    <CompanionShellMasthead
      title="Waiting for your OK"
      :eyebrow="c.status.ready ? count : undefined"
      subtitle="Changes BiliMind heard about but won't make without you. Anything from Moodle goes straight in."
      width="max-w-[760px]"
      back="/app"
    />

    <div class="mx-auto grid w-full max-w-[760px] content-start gap-10 px-4 pt-6 sm:px-6 lg:gap-12 lg:px-8 lg:pt-8">
      <div
        v-if="!c.status.ready"
        class="cp-skel h-[300px] rounded-[20px]"
        aria-busy="true"
      />

      <template v-else>
        <section
          v-if="pending.length"
          class="grid gap-3"
          aria-label="Changes to check"
        >
          <TransitionGroup
            tag="div"
            class="grid gap-3"
            enter-active-class="duration-200 ease-out"
            enter-from-class="translate-y-2 opacity-0"
            leave-active-class="duration-200 ease-in"
            leave-to-class="opacity-0"
          >
            <CompanionSignalCard
              v-for="s in pending"
              :key="s.id"
              :signal="s"
            />
          </TransitionGroup>
          <button
            type="button"
            class="inline-flex h-11 items-center gap-2 justify-self-start rounded-full pr-4 pl-2.5 text-[15px] font-semibold text-cobalt transition-colors hover:bg-cobalt-soft"
            @click="capture.show('paste')"
          >
            <CompanionIcon
              name="plus"
              :size="18"
            />
            Paste another message
          </button>
        </section>

        <section
          v-else
          class="flex flex-col items-start gap-4 rounded-[22px] bg-surface p-5 shadow-[inset_0_0_0_1px_var(--border),0_24px_48px_-36px_rgb(11_13_16/0.3)] sm:flex-row sm:items-center sm:p-6"
        >
          <span class="grid size-12 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-strong">
            <UiIcon
              name="check"
              :size="22"
              :stroke="2.2"
            />
          </span>
          <p class="min-w-0 flex-1 text-[15px] leading-relaxed text-text-body">
            <b class="font-semibold text-text">Nothing waiting.</b>
            When a classmate writes "the deadline moved to Monday", paste it here: the change waits
            with its before and after until you say yes.
          </p>
          <UiBtn
            variant="primary"
            size="lg"
            class="shrink-0"
            @click="capture.show('paste')"
          >
            <CompanionIcon
              name="paste"
              :size="17"
            />
            Paste a message
          </UiBtn>
        </section>

        <section
          v-if="recent.length"
          aria-labelledby="inbox-done"
        >
          <h2
            id="inbox-done"
            class="t-head mb-2 text-[19px]"
          >
            Already done
          </h2>
          <ul class="divide-y divide-border-rule border-y border-border-rule">
            <li
              v-for="{ s, v } in recent"
              :key="s.id"
              class="flex items-center gap-3 py-3"
            >
              <span class="grid min-w-0 flex-1 gap-0.5">
                <span class="flex min-w-0 items-center gap-2 text-[15px] font-medium text-text">
                  <span
                    class="size-2 shrink-0 rounded-full"
                    :style="{ background: courseColor(v.subject?.color) }"
                  />
                  <span class="truncate">{{ v.subjectLine }}</span>
                </span>
                <span class="text-[14px] text-text-muted">{{ STATUS[s.status] }} · {{ lower(v.source) }}</span>
              </span>
              <span class="shrink-0 text-[14px] whitespace-nowrap text-text-faint">{{ untilLabel(s.applied_at ?? s.updated_at ?? s.created_at ?? '') }}</span>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </div>
</template>
