<script setup lang="ts">
/**
 * The BiliMind mark: Bili, still (Daylight 2: the mark IS the mascot, as in
 * the landing's nav and course.html's rail). Drawn at any size by the class on
 * the root (`size-8`, `size-[34px]`…), as the old cobalt disc was, so every
 * page that used that keeps its markup: the still Bili fills the box and
 * keeps its own proportions inside it.
 */
</script>

<template>
  <!-- Without a size class it fills its box, as the old svg did. -->
  <span
    :class="['grid shrink-0 place-items-center [&_.bilim]:block [&_.bilim]:size-full [&_svg]:size-full!', !$attrs.class && 'size-full']"
    aria-hidden="true"
  >
    <CompanionAiBilim
      :size="32"
      still
    />
  </span>
</template>
