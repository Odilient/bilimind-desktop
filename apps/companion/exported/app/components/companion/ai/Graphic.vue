<script lang="ts">
/**
 * Which drawing is enlarged. Module-level and keyed by what was asked for, because the
 * live card and the finished one are different components, and the enlarged view has
 * to survive the handover.
 */
const big = ref<string | null>(null)
</script>

<script setup lang="ts">
/**
 * A drawing in the chat. It fills in as it is written, and in the narrow assistant
 * panel it opens large over the page by itself: a picture you squint at explains
 * nothing. Esc or the backdrop puts it back in the chat.
 */
import { svgUrl, type AiGraphic } from '~/companion/ai/graphic'

const props = defineProps<{
  graphic: AiGraphic
  /** Stable across the live card and the finished one. */
  drawKey: string
  title?: string
  caption?: string
  live?: boolean
}>()

const root = ref<HTMLElement | null>(null)
const scene = ref<{ snapshot: () => { src: string; w: number; h: number } | null } | null>(null)
const enlarged = computed(() => big.value === props.drawKey)

onMounted(() => {
  if (props.live && !big.value && root.value && root.value.clientWidth < 480) big.value = props.drawKey
})

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape' && enlarged.value) big.value = null
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

/**
 * Swap the picture only once the next one has decoded, or it would blink at every
 * tag. A half-written SVG that doesn't parse just keeps the last good one on screen.
 */
const shown = ref<string | null>(null)
watch(
  () => (props.graphic.mode === '2d' ? props.graphic.svg : null),
  (svg) => {
    if (!svg) return
    const url = svgUrl(svg)
    const next = new Image()
    next.src = url
    next.decode().then(() => {
      shown.value = url
    }).catch(() => {})
  },
  { immediate: true },
)

const words = computed(() => props.caption || (props.graphic.mode === '3d' ? props.graphic.caption : '') || '')

/** The drawing as an image, for keeping it. */
function image(): { src: string; w: number; h: number } | null {
  if (props.graphic.mode === '3d') return scene.value?.snapshot() ?? null
  return shown.value ? { src: shown.value, w: 800, h: 500 } : null
}

defineExpose({ image, words })
</script>

<template>
  <div
    ref="root"
    class="aspect-[8/5] w-full"
  >
    <Teleport
      to="body"
      :disabled="!enlarged"
    >
      <div
        :class="enlarged
          ? 'animate-fade fixed inset-0 z-[80] grid place-items-center bg-[rgb(30_24_14/0.32)] p-4 backdrop-blur-[2px] min-[900px]:p-10'
          : 'size-full'"
        @click.self="big = null"
      >
        <figure
          :class="[
            'relative flex flex-col overflow-hidden',
            enlarged ? 'aspect-[8/5] max-h-full w-full max-w-[1120px] rounded-[20px] bg-surface shadow-sheet' : 'size-full rounded-t-[16px]',
          ]"
        >
          <div class="relative min-h-0 flex-1">
            <CompanionAiScene
              v-if="graphic.mode === '3d'"
              ref="scene"
              :parts="graphic.parts"
              :live="live"
              :view-key="drawKey"
              :zoom="enlarged"
              :title="title"
            />
            <img
              v-else-if="shown"
              :src="shown"
              :alt="title || 'A drawing'"
              class="size-full object-contain"
            >
            <p
              v-else
              class="grid size-full place-items-center text-[14px] text-text-muted"
            >
              Drawing…
            </p>
            <button
              type="button"
              class="absolute top-2 right-2 grid size-9 cursor-pointer place-items-center rounded-full bg-surface/90 text-text-soft shadow-[inset_0_0_0_1px_var(--border)] transition-colors hover:text-text focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              :aria-label="enlarged ? 'Put it back in the chat' : 'Enlarge the drawing'"
              @click="big = enlarged ? null : drawKey"
            >
              <UiIcon
                :name="enlarged ? 'x' : 'external'"
                :size="16"
              />
            </button>
          </div>
          <figcaption
            v-if="enlarged && (title || words)"
            class="border-t border-border-rule px-5 py-3"
          >
            <p
              v-if="title"
              class="text-[15px] font-semibold"
            >
              {{ title }}
            </p>
            <p
              v-if="words"
              class="mt-0.5 text-[14px] text-text-muted"
            >
              {{ words }}
            </p>
          </figcaption>
        </figure>
      </div>
    </Teleport>
  </div>
</template>
