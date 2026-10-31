<script setup lang="ts">
/**
 * The header's "Ask": the old assistant's ink pill with its lime spark, at
 * the right end of every workspace and page top bar. It opens and closes
 * the companion (the dock where there is one, the drawer or the phone's
 * sheet where there isn't), and says so: pressed while it's open, when it
 * also goes quiet, because a loud button for a panel already on screen is
 * noise.
 *
 *   <CompanionAiToggle />            // the labelled pill
 *   <CompanionAiToggle compact />    // the 34px disc, for tight bars and phones
 *
 * A screen that shows the labelled pill has its way to the companion in its
 * header already, so it is counted while mounted (`ai:header-toggles`) and
 * the Host's floating button stands down there: one Ask per screen, never
 * two. On the chat page, which is the companion, it isn't drawn at all.
 *
 * The tooltip names the shortcut in the keyboard's own words (⌘J on a Mac,
 * Ctrl+J elsewhere). With Quiet AI on it isn't drawn at all.
 */
import { useAi } from '~/companion/ai/state'
import { onChatPage } from '~/companion/ai/routes'
import { onCheckPage } from '~/companion/checks'
import { useQuietAi } from '~/companion/quiet-ai'

const props = defineProps<{ compact?: boolean }>()

const ai = useAi()
const route = useRoute()
const { quiet } = useQuietAi()

const keys = ref('Ctrl+J')
/** Both states below live in this device's storage; the server can't know them. */
const mounted = ref(false)
const headerToggles = useState('ai:header-toggles', () => 0)
onMounted(() => {
  mounted.value = true
  if (!props.compact) headerToggles.value += 1
  if (/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)) keys.value = '⌘J'
})
onBeforeUnmount(() => {
  if (!props.compact) headerToggles.value = Math.max(0, headerToggles.value - 1)
})

const pressed = computed(() => mounted.value && ai.visible.value)
const hidden = computed(() => mounted.value && (quiet.value || onChatPage(route.path) || onCheckPage(route.path)))
</script>

<template>
  <!-- `before:` widens the hit area to 44px for a thumb, whatever the drawing. -->
  <button
    v-if="!hidden"
    type="button"
    :aria-pressed="pressed"
    :aria-label="compact ? 'Ask BiliMind' : undefined"
    :title="`${pressed ? 'Close' : 'Ask'} BiliMind (${keys})`"
    :class="[
      'relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full font-semibold transition-[background-color,color,box-shadow,transform] duration-150 select-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none active:scale-[0.97]',
      'before:absolute before:-inset-[5px]',
      compact ? 'size-[34px]' : 'h-[34px] gap-2 pr-3.5 pl-1 text-[13.5px]',
      pressed
        ? 'bg-surface-sunken text-text shadow-[inset_0_0_0_1px_var(--border)] hover:bg-surface-track'
        : 'bg-ink text-paper hover:bg-ink-2',
    ]"
    @click="ai.toggle()"
  >
    <span
      v-if="!compact"
      :class="[
        'grid size-[26px] place-items-center rounded-full transition-colors duration-150',
        pressed ? 'bg-ink text-lime' : 'bg-accent text-on-accent',
      ]"
    >
      <UiIcon
        name="spark"
        :size="13"
      />
    </span>
    <UiIcon
      v-else
      name="spark"
      :size="15"
      :class="pressed ? 'text-text' : 'text-lime'"
    />
    <span v-if="!compact">Ask</span>
  </button>
</template>
