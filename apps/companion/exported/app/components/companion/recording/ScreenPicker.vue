<script setup lang="ts">
/**
 * Which screen or window to record: the desktop's own picker, a grid of
 * small pictures with their names (desktop/src/main/audio.ts lists them).
 * Drawn on the dark recording sheet and on the light check page, so it takes
 * its tone from where it sits. A source with no picture (Wayland's portal,
 * a minimised window) shows a plain screen glyph instead.
 */
import type { ScreenSource } from '~/companion/platform'

defineProps<{
  sources: ScreenSource[]
  /** The recording sheet is ink; the check page is paper. */
  dark?: boolean
}>()

const emit = defineEmits<{ pick: [id: string] }>()
</script>

<template>
  <div
    class="grid max-h-[46dvh] grid-cols-2 gap-2.5 overflow-y-auto"
    role="list"
  >
    <button
      v-for="s in sources"
      :key="s.id"
      type="button"
      role="listitem"
      :class="[
        'grid min-w-0 gap-2 rounded-[14px] p-2 text-left transition-colors',
        dark ? 'bg-[rgb(238_240_246/0.08)] hover:bg-[rgb(238_240_246/0.16)]' : 'border border-border hover:bg-surface-mute',
      ]"
      @click="emit('pick', s.id)"
    >
      <span
        :class="['grid aspect-video place-items-center overflow-hidden rounded-[9px]', dark ? 'bg-[rgb(6_9_30/0.5)]' : 'bg-surface-sunken']"
      >
        <img
          v-if="s.thumbnail"
          :src="s.thumbnail"
          alt=""
          class="size-full object-cover"
        >
        <UiIcon
          v-else
          name="monitor"
          :size="22"
          :class="dark ? 'text-[#a9aebd]' : 'text-text-faint'"
        />
      </span>
      <span :class="['truncate px-0.5 text-[13px] font-medium', dark ? 'text-[#eef0f6]' : 'text-text']">
        {{ s.name || (s.kind === 'screen' ? 'Whole screen' : 'A window') }}
      </span>
    </button>
  </div>
</template>
