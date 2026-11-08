<script setup lang="ts">
/**
 * Usage: the session, the week, and the credits behind them. Packs are always on
 * show here, because this is the page someone comes to when they want more.
 *
 * On Free there is no session or week since 7 Nov 2026 (`plan_ai: false`), so the
 * plan's limits give way to the ways to AI: credits, an own key or OpenRouter, or
 * BiliMind inside ChatGPT or Claude. Every "out of AI" line in the app sends here.
 */
import { MORE_AI, resetsIn, sessionName, useUsage, type UsageWindow } from '~/companion/usage'

const { usage, load } = useUsage()
const allowance = useAllowance()
const toast = useToast()
const { t } = useI18n()
const buying = ref<string | null>(null)

const PRO = computed(() => [t('settings.usage.pro1'), t('settings.usage.pro2'), t('settings.usage.pro3')])

onMounted(load)

const windows = computed(() => {
  const u = usage.value
  if (!u || u.plan_ai === false) return []
  return [
    // Free's session is a day (gaps, Daylight 2: "a little each day").
    sessionName(u) === 'today'
      ? { label: t('settings.usage.today'), sub: t('settings.usage.todaySub'), ...u.session }
      : { label: t('settings.usage.session'), sub: t('settings.usage.sessionSub'), ...u.session },
    { label: t('settings.usage.week'), sub: t('settings.usage.weekSub'), ...u.week },
  ]
})

/** A stage is our word for a piece of work. These are the learner's. */
const ON: Record<string, string> = {
  companion_ask: 'chat',
  expand_node: 'lessons',
  regenerate: 'lessons',
  rewrite_block: 'lessons',
  clarify: 'courses',
  outline: 'courses',
  companion_propose: 'courses',
  companion_check_write: 'checks',
  companion_check_grade: 'checks',
  companion_check_follow_up: 'checks',
  grade: 'checks',
  companion_signals: 'material',
  companion_exam_pdf: 'material',
  companion_goal: 'courses',
  companion_gaps: 'maps',
  companion_map: 'maps',
  illustrate: 'pictures',
  companion_draw: 'drawings',
}

const spentOn = computed(() => {
  const shares = new Map<string, number>()
  for (const row of usage.value?.on ?? []) {
    const name = t(`settings.usage.on.${ON[row.stage] ?? 'other'}`)
    shares.set(name, (shares.get(name) ?? 0) + row.percent)
  }
  return [...shares].sort((a, b) => b[1] - a[1]).filter(([, percent]) => percent > 0)
})

function resets(window: UsageWindow): string {
  return window.resets_at ? t('settings.usage.resets', { when: resetsIn(window.resets_at) }) : t('settings.usage.notStarted')
}

function expires(iso: string | null): string {
  return iso ? fmtDate(iso, { day: 'numeric', month: 'long', year: 'numeric' }) : ''
}

async function buy(id: string): Promise<void> {
  buying.value = id
  try {
    await allowance.buy(id)
  } catch (raw) {
    const status = (raw as { status?: number } | null)?.status
    toast.error(
      status === 503
        ? t('settings.usage.errNoSale')
        : status === 403
          ? t('settings.usage.errOwner')
          : t('settings.usage.errCheckout'),
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
      {{ t('settings.usage.ownKey') }}
    </p>

    <!-- Pro: the one offer here, drawn as something worth pressing. Only what
         Pro really gives (config/plans.php): AI each session and week, about
         65 lessons' worth a week, 20 GB synced. -->
    <NuxtLink
      v-if="usage?.plan === 'free'"
      to="/app/settings?section=plan"
      class="group grid gap-5 rounded-[18px] bg-accent-soft p-5 shadow-[inset_0_0_0_1px_var(--accent-line),var(--shadow-card)] transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-px hover:shadow-[inset_0_0_0_1px_var(--accent-line),var(--shadow-raised)] focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none motion-reduce:transition-none min-[640px]:grid-cols-[minmax(0,1fr)_auto] min-[640px]:items-end min-[640px]:p-6"
    >
      <span class="grid gap-3.5">
        <span class="flex items-center gap-3">
          <CompanionAiBilim
            :size="36"
            mood="happy"
            still
            class="shrink-0"
          />
          <span class="grid">
            <span class="font-display text-[21px] font-semibold tracking-[-0.02em] text-text">{{ t('settings.usage.proTitle') }}</span>
            <span class="text-[13.5px] text-text-muted">{{ t('settings.usage.proBrand') }}</span>
          </span>
        </span>
        <span class="grid gap-1.5 text-[14.5px] text-text-body">
          <span
            v-for="line in PRO"
            :key="line"
            class="flex items-start gap-2"
          >
            <UiIcon
              name="check"
              :size="16"
              :stroke="2.4"
              class="mt-[3px] shrink-0 text-accent-strong"
            />
            {{ line }}
          </span>
        </span>
      </span>
      <span class="inline-flex h-11 items-center justify-center gap-1.5 justify-self-start rounded-full bg-inverse px-5 text-[14.5px] font-semibold whitespace-nowrap text-on-inverse transition-colors group-hover:bg-inverse-hover min-[640px]:justify-self-end">
        {{ t('settings.usage.upgrade') }}
        <UiIcon
          name="arrow-right"
          :size="16"
          :stroke="2.2"
          class="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      </span>
    </NuxtLink>

    <!-- Free: no plan limits to show, so the ways to AI instead. -->
    <div v-if="usage?.plan_ai === false && !usage.own_key">
      <h2 class="t-head text-[19px]">
        {{ t('settings.usage.otherTitle') }}
      </h2>
      <i18n-t
        keypath="settings.usage.otherText"
        tag="p"
        class="mt-1.5 text-[14px] leading-relaxed text-text-muted"
      >
        <template #key>
          <NuxtLink
            :to="MORE_AI.key"
            class="font-semibold text-text underline underline-offset-4 hover:no-underline"
          >
            {{ t('settings.usage.otherKey') }}
          </NuxtLink>
        </template>
        <template #apps>
          <NuxtLink
            :to="MORE_AI.apps"
            class="font-semibold text-text underline underline-offset-4 hover:no-underline"
          >
            {{ t('settings.usage.otherApps') }}
          </NuxtLink>
        </template>
      </i18n-t>
    </div>

    <div v-if="windows.length">
      <h2 class="t-head text-[19px]">
        {{ t('settings.usage.limits') }}
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
              {{ t('settings.usage.used', { n: row.percent }) }}
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
        :aria-label="t('settings.usage.spentAria')"
      >
        <li
          v-for="[name, percent] in spentOn"
          :key="name"
        >
          {{ name }} {{ percent }}%
        </li>
      </ul>
    </div>

    <div>
      <div class="flex items-baseline justify-between gap-4">
        <h2 class="t-head text-[19px]">
          {{ t('settings.usage.credits') }}
        </h2>
        <p class="text-[15.5px] font-semibold tabular-nums">
          {{ (usage?.credits ?? 0).toLocaleString() }}
        </p>
      </div>
      <p class="mt-1.5 text-[14px] leading-relaxed text-text-muted">
        <template v-if="usage?.plan_ai === false">
          {{ t('settings.usage.creditsFree') }}
        </template>
        <template v-else>
          {{ t('settings.usage.creditsPro') }}
        </template>
        {{ t('settings.usage.creditsCost') }}
        <template v-if="usage?.credits_expire_at">
          {{ t('settings.usage.creditsExpire', { date: expires(usage.credits_expire_at) }) }}
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
            <span class="text-[13.5px] text-text-muted">{{ pack.description }} {{ t('settings.usage.packNote') }}</span>
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
