<script setup lang="ts">
/**
 * Nothing here yet — said kindly. A white card with a round lime well for the
 * icon, or, where a page has room for it, one of cobalt's glossy objects
 * (`object="book"` → `/img/cobalt/obj-book.webp`) standing in for the icon.
 */
withDefaults(
  defineProps<{
    icon?: string
    title: string
    description?: string
    /** `page` centres in a tall panel; `inline` stays compact inside a card. */
    size?: 'page' | 'inline'
    tone?: 'neutral' | 'danger'
    /** One of the cobalt 3D objects, drawn instead of the icon well. */
    object?: 'book' | 'calendar' | 'cap' | 'check' | 'docs' | 'globe' | 'mic' | 'rocket' | 'trophy'
  }>(),
  { icon: 'sparkles', size: 'page', tone: 'neutral', description: undefined, object: undefined },
)
</script>

<template>
  <div
    :class="[
      'flex flex-col items-center rounded-[22px] text-center',
      tone === 'danger'
        ? 'bg-danger-soft shadow-[inset_0_0_0_1px_var(--danger-line)]'
        : 'bg-surface shadow-[inset_0_0_0_1px_var(--border)]',
      size === 'page' ? 'px-6 py-14' : 'px-4 py-8',
    ]"
  >
    <img
      v-if="object && tone !== 'danger'"
      :src="`/img/cobalt/obj-${object}.webp`"
      alt=""
      aria-hidden="true"
      :class="[
        'mb-3 object-contain drop-shadow-[0_18px_22px_rgb(11_13_16/0.16)]',
        size === 'page' ? 'size-24' : 'size-16',
      ]"
    >
    <span
      v-else
      :class="[
        'mb-4 grid place-items-center rounded-full',
        tone === 'danger' ? 'bg-danger-bright text-white' : 'bg-accent text-on-accent',
        size === 'page' ? 'size-12' : 'size-10',
      ]"
    >
      <UiIcon
        :name="icon"
        :size="size === 'page' ? 20 : 17"
      />
    </span>

    <h3 :class="['t-head', size === 'page' ? 'text-[19px]' : 'text-[15px]']">
      {{ title }}
    </h3>

    <p
      v-if="description"
      class="mt-1.5 max-w-sm text-[14px] leading-relaxed text-text-soft"
    >
      {{ description }}
    </p>

    <div
      v-if="$slots.default"
      class="mt-5 flex flex-wrap items-center justify-center gap-2"
    >
      <slot />
    </div>
  </div>
</template>
