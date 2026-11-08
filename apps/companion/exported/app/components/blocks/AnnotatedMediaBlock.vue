<script setup lang="ts">
import type { AnnotatedMediaBlock } from '~/types/api'
import BlockShell from './BlockShell.vue'

/**
 * EXPAND §2/§6 — a labelled image the learner explores.
 *
 * The image is always a Wikimedia Commons file, because it is the only large image
 * source that states a licence per file — hence the attribution line, which is not
 * decoration but the condition on which we are allowed to show it at all.
 *
 * Hotspots are buttons, not hover targets: hover does not exist on a phone, and a
 * diagram the learner cannot explore on their phone is a diagram they will not
 * explore.
 */
const props = defineProps<{ block: AnnotatedMediaBlock }>()

const media = computed(() => props.block.payload?.media ?? null)
const hotspots = computed(() => props.block.payload?.hotspots ?? [])

const active = ref<number | null>(null)
const failed = ref(false)

watch(
  () => props.block.id,
  () => {
    active.value = null
    failed.value = false
  },
)

function toggle(index: number): void {
  active.value = active.value === index ? null : index
}
</script>

<template>
  <BlockShell
    :type="block.type"
    :source-material-ids="block.source_material_ids"
  >
    <figure
      v-if="media && !failed"
      class="m-0"
    >
      <div class="relative overflow-hidden rounded-[14px] bg-surface-track">
        <img
          :src="media.url"
          :alt="block.payload?.alt_text ?? media.title"
          loading="lazy"
          class="block h-auto w-full"
          @error="failed = true"
        />

        <button
          v-for="(hotspot, index) in hotspots"
          :key="index"
          type="button"
          class="absolute grid size-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full font-display text-[11.5px] font-semibold transition"
          :class="
            active === index
              ? 'z-20 scale-110 bg-accent text-on-accent shadow-[0_0_0_3px_rgb(var(--wash-rgb)/0.85)]'
              : 'z-10 bg-ink/85 text-white shadow-[0_0_0_2px_rgb(255_255_255/0.7)] hover:scale-110'
          "
          :style="{ left: `${hotspot.x_pct}%`, top: `${hotspot.y_pct}%` }"
          :aria-pressed="active === index"
          :aria-label="hotspot.label"
          @click="toggle(index)"
        >
          <span class="num tabular-nums">{{ index + 1 }}</span>
        </button>
      </div>

      <figcaption class="mt-2 flex flex-wrap items-center gap-x-2 text-[11.5px] text-text-faint">
        <span v-if="media.license">{{ media.license }}</span>
        <span v-if="media.attribution">· {{ media.attribution }}</span>
        <a
          :href="media.url"
          target="_blank"
          rel="noopener noreferrer"
          class="font-medium text-brand underline underline-offset-2"
        >
          source
        </a>
      </figcaption>
    </figure>

    <p
      v-else-if="failed"
      class="rounded-[14px] bg-surface-mute p-3.5 text-[13.5px] leading-relaxed text-text-soft"
    >
      {{ block.payload?.alt_text ?? 'The image for this lesson could not be loaded.' }}
    </p>

    <ol
      v-if="hotspots.length"
      class="mt-3 flex flex-col gap-1"
    >
      <li
        v-for="(hotspot, index) in hotspots"
        :key="index"
      >
        <button
          type="button"
          class="flex w-full cursor-pointer items-start gap-2.5 rounded-[12px] px-2.5 py-2 text-left transition"
          :class="active === index ? 'bg-accent-soft' : 'hover:bg-surface-mute'"
          @click="toggle(index)"
        >
          <span
            class="num mt-0.5 grid size-5 shrink-0 place-items-center rounded-full font-display text-[10.5px] font-semibold tabular-nums"
            :class="active === index ? 'bg-accent text-on-accent' : 'bg-inverse text-on-inverse'"
            >{{ index + 1 }}</span
          >
          <span class="min-w-0 flex-1">
            <span class="block text-[13.5px] leading-snug font-medium">{{ hotspot.label }}</span>
            <span
              v-if="hotspot.detail && active === index"
              class="mt-0.5 block text-[12.5px] leading-relaxed text-text-muted"
            >
              {{ hotspot.detail }}
            </span>
          </span>
        </button>
      </li>
    </ol>

    <p
      v-if="!media"
      class="text-[13px] text-text-faint italic"
    >
      No image was found for this lesson.
    </p>
  </BlockShell>
</template>
