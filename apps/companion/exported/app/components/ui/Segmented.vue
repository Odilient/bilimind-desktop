<script setup lang="ts">
interface SegmentedOption {
  value: string
  label: string
  icon?: string
  /** Small trailing count, e.g. number of matching rows. */
  count?: number
}

/**
 * Cobalt's switch (`story.css` `.a-seg`): a #EEF0F4 track with soft corners
 * and a white raised item with a hairline ring on the selected one — a
 * rounded rectangle, not a pill, so it reads as a control and not a button.
 * In the dark both steps move up one fill, so the selected item is still the
 * lighter, raised one rather than a dark hole in a light track.
 * `block` stretches it edge to edge, which is how the sidebar and the
 * assistant scope control both use it.
 */
withDefaults(
  defineProps<{
    options: SegmentedOption[]
    size?: 'xs' | 'sm' | 'md'
    label?: string
    block?: boolean
  }>(),
  { size: 'sm', block: false },
)

const model = defineModel<string>({ required: true })
</script>

<template>
  <div
    :class="[
      'items-center gap-[3px] rounded-[14px] bg-surface-track p-1 dark:bg-surface-sunken',
      block ? 'flex' : 'inline-flex',
    ]"
    role="tablist"
    :aria-label="label"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="tab"
      :aria-selected="model === option.value"
      :class="[
        'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[10px] font-semibold transition-colors duration-150',
        block && 'flex-1',
        size === 'xs'
          ? 'h-[28px] px-2.5 text-[12px]'
          : size === 'sm'
            ? 'h-[30px] px-3 text-[12.5px]'
            : 'h-[34px] px-4 text-[13px]',
        model === option.value
          ? 'bg-surface text-text shadow-segment dark:bg-surface-track'
          : 'text-text-faint hover:text-text-dim',
      ]"
      @click="model = option.value"
    >
      <UiIcon
        v-if="option.icon"
        :name="option.icon"
        :size="14"
      />
      {{ option.label }}
      <span
        v-if="typeof option.count === 'number'"
        class="num text-[10.5px] text-text-faint"
        >{{ option.count }}</span
      >
    </button>
  </div>
</template>
