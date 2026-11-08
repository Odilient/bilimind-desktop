<script setup lang="ts">
/**
 * Out of AI, said where the learner pressed: one short, quiet line and one
 * link. The same component in the chat (and so the assistant panel and a
 * course being drafted there), on a check that couldn't be written, and above
 * the composer when it is known beforehand. Never a dead button, never a modal
 * wall, and never a paragraph of links: on Free this sits on every composer,
 * so it has to be easy to live with (user, 7 Nov 2026). Every way forward
 * (Pro, credits, an own key, BiliMind inside ChatGPT or Claude) is on Usage.
 *
 * `reason` is the server's (`outOfAi(error)` in companion/usage.ts); without one it
 * is worked out from the usage.
 */
import { MORE_AI, useUsage } from '~/companion/usage'

const props = defineProps<{ reason?: string | null }>()

const { t } = useI18n()
const { usage, ensure } = useUsage()
onMounted(ensure)

const said = computed(() => {
  if (props.reason) return props.reason
  return t(usage.value?.plan_ai === false ? 'today.outOfAi.needsPro' : 'today.outOfAi.out')
})
</script>

<template>
  <p
    class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] leading-[1.45]"
    role="status"
  >
    <span>{{ said }}</span>
    <NuxtLink
      :to="MORE_AI.credits"
      class="inline-flex items-center gap-0.5 font-semibold underline-offset-4 hover:underline"
    >
      {{ t('today.outOfAi.options') }}
      <UiIcon
        name="chevron-right"
        :size="13"
        :stroke="2.2"
      />
    </NuxtLink>
  </p>
</template>
