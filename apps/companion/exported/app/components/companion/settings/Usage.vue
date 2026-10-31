<script setup lang="ts">
/**
 * Usage: the session, the week, and the credits behind them. Packs are always on
 * show here, because this is the page someone comes to when they want more.
 */
import { resetsIn, useUsage, type UsageWindow } from '~/companion/usage'

const { usage, load } = useUsage()
const allowance = useAllowance()
const toast = useToast()
const buying = ref<string | null>(null)

onMounted(load)

const windows = computed(() => {
  const u = usage.value
  if (!u) return []
  return [
    { label: 'Current session', sub: 'Five hours from your first question.', ...u.session },
    { label: 'This week', sub: 'Seven days from your first question.', ...u.week },
  ]
})

/** A stage is our word for a piece of work. These are the learner's. */
const ON: Record<string, string> = {
  companion_ask: 'Chat',
  expand_node: 'Lessons',
  regenerate: 'Lessons',
  rewrite_block: 'Lessons',
  clarify: 'Building courses',
  outline: 'Building courses',
  companion_propose: 'Building courses',
  companion_check_write: 'Checks',
  companion_check_grade: 'Checks',
  companion_check_follow_up: 'Checks',
  grade: 'Checks',
  companion_signals: 'Reading your material',
  companion_exam_pdf: 'Reading your material',
  companion_goal: 'Building courses',
  companion_gaps: 'Maps',
  companion_map: 'Maps',
  illustrate: 'Pictures',
  companion_draw: 'Drawings',
}

const spentOn = computed(() => {
  const shares = new Map<string, number>()
  for (const row of usage.value?.on ?? []) {
    const name = ON[row.stage] ?? 'Other'
    shares.set(name, (shares.get(name) ?? 0) + row.percent)
  }
  return [...shares].sort((a, b) => b[1] - a[1]).filter(([, percent]) => percent > 0)
})

function resets(window: UsageWindow): string {
  return window.resets_at ? `Resets in ${resetsIn(window.resets_at)}` : 'Not started'
}

function expires(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : ''
}

async function buy(id: string): Promise<void> {
  buying.value = id
  try {
    await allowance.buy(id)
  } catch (raw) {
    const status = (raw as { status?: number } | null)?.status
    toast.error(
      status === 503
        ? 'Credits aren\'t on sale yet. Nothing has been charged.'
        : status === 403
          ? 'Only the owner of this account can buy credits.'
          : 'Could not open checkout. Try again in a moment.',
    )
  } finally {
    buying.value = null
  }
}
</script>

<template>
  <section class="grid gap-8">
    <p
      v-if="usage?.own_key"
      class="text-[15px] leading-relaxed text-text-soft"
    >
      You're on your own model key, so what it writes isn't counted here. Web search and pictures still are.
    </p>

    <div>
      <h2 class="t-head text-[19px]">
        Plan limits
      </h2>
      <ul class="mt-2 divide-y divide-border-rule border-y border-border-rule">
        <li
          v-for="row in windows"
          :key="row.label"
          class="grid gap-2 py-4"
        >
          <div class="flex items-baseline justify-between gap-4">
            <p class="text-[15.5px] font-semibold">
              {{ row.label }}
            </p>
            <p class="text-[14px] font-medium tabular-nums">
              {{ row.percent }}% used
            </p>
          </div>
          <div
            class="h-1.5 overflow-hidden rounded-full bg-surface-track"
            role="progressbar"
            :aria-label="row.label"
            :aria-valuenow="row.percent"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div
              class="h-full rounded-full transition-[width] duration-300"
              :class="row.percent >= 100 ? 'bg-danger-text' : 'bg-inverse'"
              :style="{ width: `${row.percent}%` }"
            />
          </div>
          <p class="text-[13.5px] text-text-muted">
            {{ resets(row) }} · {{ row.sub }}
          </p>
        </li>
      </ul>
      <ul
        v-if="spentOn.length"
        class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-text-muted"
        aria-label="What this week went on"
      >
        <li
          v-for="[name, percent] in spentOn"
          :key="name"
        >
          {{ name }} {{ percent }}%
        </li>
      </ul>
    </div>

    <NuxtLink
      v-if="usage?.plan === 'free'"
      to="/app/settings?section=plan"
      class="group -mx-2 flex items-center justify-between gap-3 rounded-[12px] px-2 py-3 transition-colors hover:bg-surface-mute"
    >
      <span class="grid gap-0.5">
        <span class="text-[15.5px] font-semibold">Pro has 8× the AI every session and 12× every week</span>
        <span class="text-[13.5px] text-text-muted">$15 a month. It's the cheapest way to study a lot: credits cost about twice as much for the same AI.</span>
      </span>
      <CompanionIcon
        name="chevron-right"
        :size="18"
        class="shrink-0 text-text-faint transition-colors group-hover:text-text-soft"
      />
    </NuxtLink>

    <div>
      <div class="flex items-baseline justify-between gap-4">
        <h2 class="t-head text-[19px]">
          Credits
        </h2>
        <p class="text-[15.5px] font-semibold tabular-nums">
          {{ (usage?.credits ?? 0).toLocaleString() }}
        </p>
      </div>
      <p class="mt-1.5 text-[14px] leading-relaxed text-text-muted">
        Credits keep you going when a limit runs out, and aren't touched before then. A lesson is about 9 credits, a chat answer well under one.
        <template v-if="usage?.credits_expire_at">
          Your earliest expire on {{ expires(usage.credits_expire_at) }}.
        </template>
      </p>
      <ul
        v-if="usage?.packs.length"
        class="mt-2 divide-y divide-border-rule border-y border-border-rule"
      >
        <li
          v-for="pack in usage.packs"
          :key="pack.id"
          class="flex items-center justify-between gap-4 py-3.5"
        >
          <span class="grid min-w-0 gap-0.5">
            <span class="text-[15.5px] font-semibold">{{ pack.name }}</span>
            <span class="text-[13.5px] text-text-muted">{{ pack.description }} One-off, valid for a year.</span>
          </span>
          <UiBtn
            variant="secondary"
            :loading="buying === pack.id"
            :disabled="buying !== null"
            @click="buy(pack.id)"
          >
            {{ topupPrice(pack) }}
          </UiBtn>
        </li>
      </ul>
    </div>
  </section>
</template>
