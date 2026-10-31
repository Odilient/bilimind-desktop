<script setup lang="ts">
/**
 * How much AI is left, always in sight in the sidebar, so a limit is never a surprise.
 * The tighter of the two windows draws the bar. On the rail it is the bar alone.
 */
import { resetsIn, useUsage } from '~/companion/usage'

defineProps<{ wide?: boolean }>()
const emit = defineEmits<{ open: [] }>()

const route = useRoute()
const { usage, load } = useUsage()

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

const week = computed(() => (usage.value?.week.percent ?? 0) > (usage.value?.session.percent ?? 0))
const percent = computed(() => (week.value ? usage.value?.week.percent : usage.value?.session.percent) ?? 0)
const line = computed(() => {
  const u = usage.value
  if (!u) return ''
  if (percent.value >= 100) return u.credits > 0 ? `Limit reached · ${u.credits.toLocaleString()} credits` : `Limit reached · resets in ${resetsIn(week.value ? u.week.resets_at : u.session.resets_at)}`
  return week.value ? `${percent.value}% of this week` : `${percent.value}% of this session`
})
const title = computed(() => {
  const u = usage.value
  return u ? `Usage: ${u.session.percent}% of this session, ${u.week.percent}% of this week, ${u.credits.toLocaleString()} credits` : 'Usage'
})
</script>

<template>
  <NuxtLink
    v-if="usage && !usage.own_key"
    to="/app/settings?section=usage"
    :title="title"
    :aria-label="title"
    :class="['group mx-[11px] mb-2 grid shrink-0 gap-1.5 rounded-[10px] py-1.5 transition-colors hover:bg-surface-sunken', wide ? 'px-2' : 'w-[38px] px-1.5']"
    @click="emit('open')"
  >
    <span
      v-if="wide"
      class="flex items-baseline justify-between gap-2 text-[12px] whitespace-nowrap text-text-muted group-hover:text-text-soft"
    >
      <span class="truncate">{{ line }}</span>
    </span>
    <span class="block h-1 overflow-hidden rounded-full bg-surface-track">
      <span
        class="block h-full rounded-full transition-[width] duration-300"
        :class="percent >= 100 ? 'bg-danger-text' : percent >= 80 ? 'bg-amber-500' : 'bg-inverse'"
        :style="{ width: `${Math.max(percent, 2)}%` }"
      />
    </span>
  </NuxtLink>
</template>
