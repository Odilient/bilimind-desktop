<script setup lang="ts">
/**
 * How much AI is left, always in sight in the sidebar, so a limit is never a surprise.
 * The tighter of the two windows draws the bar. On the rail it is the bar alone.
 *
 * Free has no AI of its own, so there is no limit to watch: a full red "No AI
 * credits left" bar nagged on every screen (user, 7 Nov 2026). Free gets one
 * friendly entry instead, "Get Pro" beside Bili, with any credits beside it;
 * the rail leaves it out (a second Bili there read as a second logo).
 */
import { MORE_AI, resetsIn, sessionName, useUsage } from '~/companion/usage'
import { useOrg } from '~/institution/org'

defineProps<{ wide?: boolean }>()
const emit = defineEmits<{ open: [] }>()

const { t } = useI18n()
const route = useRoute()
const { usage, load } = useUsage()

// A centre's people have their AI paid for by the centre: "Get Pro" would sell them what they have.
const org = useOrg()
const inCentre = ref(false)
onMounted(() => void org.list().then((list) => (inCentre.value = list.length > 0)).catch(() => undefined))

// Lessons and checks spend it too, and those aren't asked from here: read it again on
// the way to a new screen, and when the learner comes back to the tab, at most once a minute.
let readAt = 0
function refresh(): void {
  if (Date.now() - readAt < 60_000) return
  readAt = Date.now()
  void load()
}
onMounted(() => {
  refresh()
  window.addEventListener('focus', refresh)
})
onBeforeUnmount(() => window.removeEventListener('focus', refresh))
watch(() => route.path, refresh)

// Free has no session or week of its own.
const windows = computed(() => usage.value?.plan_ai !== false)
const week = computed(() => (usage.value?.week.percent ?? 0) > (usage.value?.session.percent ?? 0))
const percent = computed(() => (week.value ? usage.value?.week.percent : usage.value?.session.percent) ?? 0)
const line = computed(() => {
  const u = usage.value
  if (!u) return ''
  if (percent.value >= 100) return u.credits > 0 ? t('shell.limitCredits', { n: fmtNumber(u.credits) }) : t('shell.limitResets', { when: resetsIn(week.value ? u.week.resets_at : u.session.resets_at) })
  return week.value ? t('shell.percentWeek', { n: percent.value }) : t('shell.percentOf', { n: percent.value, name: sessionName(u) })
})
const title = computed(() => {
  const u = usage.value
  return u ? t('shell.usageTitle', { session: u.session.percent, name: sessionName(u), week: u.week.percent, credits: fmtNumber(u.credits) }) : t('shell.usage')
})
</script>

<template>
  <NuxtLink
    v-if="usage && !usage.own_key && !windows && wide && !inCentre"
    :to="MORE_AI.pro"
    :title="usage.credits > 0 ? t('shell.getProCredits', { n: fmtNumber(usage.credits) }) : t('shell.getProHint')"
    class="mx-[11px] mb-2 flex h-9 shrink-0 items-center gap-2.5 rounded-[9px] pr-2.5 pl-[7px] text-[13.5px] font-semibold text-text transition-colors duration-150 hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
    @click="emit('open')"
  >
    <!-- Bili, pleased, not a second yellow button beside New chat. -->
    <CompanionAiBilim
      :size="22"
      mood="happy"
      still
      class="shrink-0"
    />
    <span class="whitespace-nowrap">{{ t('shell.getPro') }}</span>
    <span
      v-if="usage.credits > 0"
      class="num ml-auto truncate text-[12px] font-medium text-text-faint"
    >{{ t('shell.credits', usage.credits) }}</span>
  </NuxtLink>
  <NuxtLink
    v-else-if="usage && !usage.own_key && windows"
    to="/app/settings?section=usage"
    :title="title"
    :aria-label="title"
    :class="['group mx-[11px] mb-2 grid shrink-0 gap-1.5 rounded-[9px] py-1.5 transition-colors hover:bg-[rgb(var(--wash-rgb)/0.05)]', wide ? 'px-2' : 'w-9 px-1.5']"
    @click="emit('open')"
  >
    <span
      v-if="wide"
      class="flex items-baseline justify-between gap-2 text-[12px] whitespace-nowrap text-text-muted group-hover:text-text-soft"
    >
      <span class="truncate">{{ line }}</span>
    </span>
    <span class="block h-1.5 overflow-hidden rounded-[2px] bg-[rgb(var(--wash-rgb)/0.065)]">
      <span
        class="block h-full rounded-[2px] transition-[width] duration-300"
        :class="percent >= 100 ? 'bg-rose' : percent >= 80 ? 'bg-warn-bright' : 'bg-leaf'"
        :style="{ width: `${Math.max(percent, 2)}%` }"
      />
    </span>
  </NuxtLink>
</template>
