<script setup lang="ts">
/**
 * A "Choose what to make" tile's picture: a tiny drawing of the thing it
 * makes, in the app's own ink. A course is a row of beads on a path (some
 * walked, one current), flashcards a small stack, a mind map a node with
 * branches, a study plan a week of cells, "Check my attempt" a page of
 * scribbled working with a tick, and "Just ask" an empty page with a caret. No images: strokes in the faint ink, the one accent in cobalt,
 * or in the course's colour on a tile made for one of the learner's own
 * courses, so it reads as theirs at a glance. Light and dark both, because
 * it is only tokens and `currentColor`.
 */
import type { MakeThumb } from '~/companion/ai/make'

withDefaults(
  defineProps<{
    kind: MakeThumb
    /** A CSS colour for the accent (a course's); cobalt when left out. */
    accent?: string | null
  }>(),
  { accent: null },
)
</script>

<template>
  <svg
    viewBox="0 0 80 56"
    class="block size-full text-text-faint"
    :style="{ '--thumb': accent ?? 'var(--cobalt)' }"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- Just ask: an empty page and a caret. -->
    <g v-if="kind === 'blank'">
      <rect
        x="20"
        y="9"
        width="40"
        height="38"
        rx="4"
        opacity="0.55"
      />
      <path
        d="M28 19v9"
        stroke="var(--thumb)"
        stroke-width="2"
      />
    </g>

    <!-- A course: the path, two topics walked, one current, the rest ahead. -->
    <g v-else-if="kind === 'course'">
      <path
        d="M10 30h60"
        opacity="0.5"
      />
      <path
        d="M10 30h30"
        stroke="var(--thumb)"
        stroke-width="2"
      />
      <circle
        cx="12"
        cy="30"
        r="4"
        fill="var(--thumb)"
        stroke="var(--thumb)"
      />
      <circle
        cx="26"
        cy="30"
        r="4"
        fill="var(--thumb)"
        stroke="var(--thumb)"
      />
      <circle
        cx="40"
        cy="30"
        r="5"
        fill="var(--surface)"
        stroke="var(--thumb)"
        stroke-width="2.2"
      />
      <circle
        cx="54"
        cy="30"
        r="4"
        fill="var(--surface)"
      />
      <circle
        cx="68"
        cy="30"
        r="4"
        fill="var(--surface)"
      />
      <path
        d="M30 42h20"
        opacity="0.45"
      />
    </g>

    <!-- Lecture notes: a page with a title and lines. -->
    <g v-else-if="kind === 'notes'">
      <rect
        x="20"
        y="7"
        width="40"
        height="42"
        rx="4"
        fill="var(--surface)"
      />
      <path
        d="M27 16h18"
        stroke="var(--thumb)"
        stroke-width="2.4"
      />
      <path
        d="M27 24h26M27 30h26M27 36h20M27 42h23"
        opacity="0.55"
      />
    </g>

    <!-- Flashcards: a stack, the front one with its question. -->
    <g v-else-if="kind === 'cards'">
      <rect
        x="24"
        y="8"
        width="36"
        height="26"
        rx="4"
        opacity="0.4"
        transform="rotate(-8 42 21)"
      />
      <rect
        x="17"
        y="18"
        width="40"
        height="28"
        rx="4"
        fill="var(--surface)"
      />
      <path
        d="M25 28h20"
        stroke="var(--thumb)"
        stroke-width="2.2"
      />
      <path
        d="M25 36h14"
        opacity="0.5"
      />
    </g>

    <!-- A quiz: three questions, one answered. -->
    <g v-else-if="kind === 'quiz'">
      <circle
        cx="20"
        cy="15"
        r="4"
        opacity="0.6"
      />
      <path
        d="M29 15h32"
        opacity="0.5"
      />
      <circle
        cx="20"
        cy="28"
        r="4.5"
        fill="var(--thumb)"
        stroke="var(--thumb)"
      />
      <path
        d="m18 28 1.6 1.6 3-3.2"
        stroke="var(--surface)"
        stroke-width="1.6"
      />
      <path
        d="M29 28h26"
        stroke="var(--thumb)"
        stroke-width="2"
      />
      <circle
        cx="20"
        cy="41"
        r="4"
        opacity="0.6"
      />
      <path
        d="M29 41h30"
        opacity="0.5"
      />
    </g>

    <!-- A mind map: one idea and its branches. -->
    <g v-else-if="kind === 'map'">
      <path
        d="M40 28 18 13M40 28 18 43M40 28l22-15M40 28l22 15"
        opacity="0.5"
      />
      <rect
        x="9"
        y="9"
        width="14"
        height="8"
        rx="3"
        fill="var(--surface)"
      />
      <rect
        x="9"
        y="39"
        width="14"
        height="8"
        rx="3"
        fill="var(--surface)"
      />
      <rect
        x="57"
        y="9"
        width="14"
        height="8"
        rx="3"
        fill="var(--surface)"
      />
      <rect
        x="57"
        y="39"
        width="14"
        height="8"
        rx="3"
        fill="var(--surface)"
      />
      <rect
        x="30"
        y="22"
        width="20"
        height="12"
        rx="4"
        fill="var(--thumb)"
        stroke="var(--thumb)"
      />
    </g>

    <!-- A study plan: a week of cells, some planned. -->
    <g v-else-if="kind === 'plan'">
      <rect
        v-for="i in 21"
        :key="i"
        :x="12 + ((i - 1) % 7) * 8.4"
        :y="13 + Math.floor((i - 1) / 7) * 10"
        width="6.4"
        height="7"
        rx="1.6"
        :fill="[2, 4, 9, 12, 13, 18].includes(i) ? 'var(--thumb)' : 'none'"
        :stroke="[2, 4, 9, 12, 13, 18].includes(i) ? 'var(--thumb)' : 'currentColor'"
        :opacity="[2, 4, 9, 12, 13, 18].includes(i) ? 1 : 0.45"
        stroke-width="1.2"
      />
    </g>

    <!-- Check my attempt: a page of their own working, ticked in the margin. -->
    <g v-else-if="kind === 'attempt'">
      <rect
        x="20"
        y="7"
        width="40"
        height="42"
        rx="4"
        fill="var(--surface)"
      />
      <path
        d="M27 17c3-3 5 3 8 0s5 3 8 0 4 2 6 0M27 27c3-3 5 3 8 0s4 2 7 0M27 37h9m4 0h9"
        opacity="0.6"
      />
      <path
        d="m47 25 3 3 5-6"
        stroke="var(--thumb)"
        stroke-width="2.2"
      />
    </g>

    <!-- A summary: a strong first line, then fewer words. -->
    <g v-else-if="kind === 'summary'">
      <path
        d="M16 15h38"
        stroke="var(--thumb)"
        stroke-width="2.6"
      />
      <circle
        cx="18"
        cy="26"
        r="1.4"
        fill="currentColor"
      />
      <circle
        cx="18"
        cy="34"
        r="1.4"
        fill="currentColor"
      />
      <circle
        cx="18"
        cy="42"
        r="1.4"
        fill="currentColor"
      />
      <path
        d="M24 26h36M24 34h28M24 42h32"
        opacity="0.55"
      />
    </g>

    <!-- Exam revision: the date, flagged. -->
    <g v-else>
      <rect
        x="19"
        y="9"
        width="42"
        height="38"
        rx="4"
        fill="var(--surface)"
      />
      <path
        d="M19 13a4 4 0 0 1 4-4h34a4 4 0 0 1 4 4v5H19Z"
        fill="var(--thumb)"
        stroke="var(--thumb)"
      />
      <path
        d="M28 6v6M52 6v6"
        opacity="0.6"
      />
      <path
        d="M37 41V25h10l-2.5 4 2.5 4H37"
        stroke="var(--thumb)"
        stroke-width="1.8"
      />
    </g>
  </svg>
</template>
