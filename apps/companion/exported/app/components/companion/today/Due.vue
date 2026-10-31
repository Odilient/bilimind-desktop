<script setup lang="ts">
/**
 * Coming up: what is due in the next two weeks, in the old Today's card
 * list (one white card, a hairline between rows). The day and time stand on
 * the left where the eye runs down them; the title, then the course's dot
 * and name and how we know the date ("heard in class, Moodle agrees", "from
 * the group chat, not confirmed yet"); readiness in words on the right
 * ("45% ready", "not checked yet"), green once ready. Readiness here is the
 * checks', so a deadline nobody has checked says so rather
 * than "not started". The whole row opens the deadline.
 *
 * Read from the store rather than Today's server answer, so a deadline
 * moved from "Waiting for your OK" moves here at once. Nothing due in two
 * weeks draws nothing: a quiet day says so by being short.
 */
import { useCompanion } from '~/companion/store'
import { courseColor } from '~/companion/colors'
import { dueParts, knownBy, readyWords } from '~/companion/words'
import { deadlinesWithin, useNow } from '~/companion/today-layout'

const c = useCompanion()
const now = useNow()

const rows = computed(() =>
  deadlinesWithin(c, now.value, 14)
    .slice(0, 6)
    .map((d) => {
      const r = c.readinessOf(d)
      return {
        d,
        // No topics in scope (a course with none yet): nothing to be ready for.
        words: r.total ? readyWords(r.checked ? r.percent : null) : null,
        ready: r.checked > 0 && r.percent >= 85,
        known: knownBy(d),
      }
    }),
)
</script>

<template>
  <section
    v-if="rows.length"
    aria-labelledby="today-due"
  >
    <div class="mb-2.5 flex items-baseline justify-between px-0.5">
      <h2
        id="today-due"
        class="t-head text-[19px]"
      >
        Coming up
      </h2>
      <NuxtLink
        to="/app/calendar?view=agenda"
        class="-my-[13px] inline-block py-[13px] text-[12.5px] font-semibold text-brand transition-colors hover:underline"
      >
        All deadlines
      </NuxtLink>
    </div>

    <ul
      class="overflow-hidden rounded-[20px] bg-surface shadow-[inset_0_0_0_1px_var(--border),0_24px_48px_-36px_rgb(11_13_16/0.3)]"
    >
      <li
        v-for="({ d, words, ready, known }, index) in rows"
        :key="d.id"
        :class="index > 0 && 'border-t border-border-rule'"
      >
        <NuxtLink
          :to="`/app/d/${d.id}`"
          class="flex items-center gap-3 py-3 pr-3 pl-3.5 transition-colors hover:bg-surface-mute focus-visible:bg-surface-mute focus-visible:outline-none"
        >
          <span class="grid w-[52px] shrink-0 leading-tight">
            <span class="font-display text-[13.5px] font-semibold tracking-[-0.01em]">{{ dueParts(d)[0] }}</span>
            <span class="text-[12px] text-text-faint">{{ dueParts(d)[1] || ' ' }}</span>
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[13.5px] font-semibold">{{ d.title }}</span>
            <span class="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-text-faint">
              <span
                class="size-2 shrink-0 rounded-full"
                :style="{ background: courseColor(c.subjectOf(d)?.color) }"
              />
              <span class="truncate">
                {{ c.subjectOf(d)?.title }}<template v-if="known">
                  · <span :class="d.tentative && 'text-warn-text'">{{ known }}</span>
                </template>
              </span>
            </span>
          </span>
          <span
            v-if="words"
            class="shrink-0 text-[12px] font-semibold"
            :class="ready ? 'text-success-text' : 'text-text-soft'"
          >{{ words }}</span>
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>
