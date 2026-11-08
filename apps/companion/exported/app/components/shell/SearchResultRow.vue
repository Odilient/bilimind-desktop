<script setup lang="ts">
import type { SearchHit } from '~/types/api'

/**
 * One search hit, in the shape it will always have.
 *
 * Split out of the palette because a hit has to look identical wherever it is
 * listed, and there is already a second place waiting for it — the "see all
 * results" page the API's `in=` mode exists for.
 *
 * Fully controlled: hover is a prop, not a CSS state. The keyboard and the
 * mouse are moving the same cursor, and a row that lit up on `:hover` as well
 * would show two selections whenever the pointer happened to rest over the list
 * while somebody was arrowing through it.
 */
const props = defineProps<{
  hit: SearchHit
  active: boolean
}>()

/**
 * The snippet arrives as plain text with private-use marks around each match.
 * `splitHighlights` turns it into runs so the marks become real elements — the
 * snippet is model-authored prose and must never reach `v-html`.
 */
const parts = computed(() => splitHighlights(props.hit.snippet))

const ICONS: Record<SearchHit['kind'], string> = {
  course: 'book',
  node: 'layers',
  // A part *inside* a lesson: the same spine the mobile roadmap uses for the
  // line a lesson is made of.
  block: 'spine',
  material: 'file',
}

/**
 * The right-hand chip carries the one fact the title and breadcrumb cannot.
 *
 * For a hit inside a lesson that is which format matched, because "Walkthrough"
 * tells you what you are about to land in. For a lesson it is its status, and
 * only when that status is not `ready` — a lesson nobody has written yet is a
 * result worth showing and a disappointment worth warning about.
 */
const chip = computed<string | null>(() => {
  if (props.hit.kind === 'block') return props.hit.block?.type_label ?? null

  if (props.hit.kind === 'node' && props.hit.node && props.hit.node.status !== 'ready') {
    return nodeStatusStyle(props.hit.node.status).label
  }

  return null
})
</script>

<template>
  <div
    :class="[
      'flex items-start gap-3 rounded-[12px] px-2.5 py-2 transition-colors duration-100',
      active ? 'bg-surface-mute shadow-[inset_0_0_0_1px_var(--border)]' : 'bg-transparent',
    ]"
  >
    <span
      :class="[
        // The block-kind tile: sky-soft, lit in the highlighter when it is the one.
        'mt-px grid size-7 shrink-0 place-items-center rounded-[9px]',
        active ? 'bg-accent text-on-accent' : 'bg-brand-soft text-brand',
      ]"
    >
      <UiIcon
        :name="ICONS[hit.kind]"
        :size="15"
      />
    </span>

    <div class="min-w-0 flex-1">
      <div class="flex items-baseline gap-2">
        <p
          :class="[
            'min-w-0 flex-1 truncate text-[13.5px]',
            active ? 'font-semibold text-text' : 'font-medium text-text',
          ]"
        >
          {{ hit.title }}
        </p>

        <span
          v-if="chip"
          class="shrink-0 text-[11px] whitespace-nowrap text-text-faint"
        >
          {{ chip }}
        </span>
      </div>

      <p
        v-if="hit.snippet"
        class="mt-0.5 line-clamp-2 text-[12.5px] leading-[1.45] text-text-muted"
      >
        <template
          v-for="(part, index) in parts"
          :key="index"
        >
          <mark
            v-if="part.hit"
            class="rounded-[3px] bg-accent-soft px-px font-medium text-text"
            >{{ part.text }}</mark
          >
          <template v-else>{{ part.text }}</template>
        </template>
      </p>

      <p
        v-if="hit.context"
        class="mt-0.5 truncate text-[11.5px] text-text-faint"
      >
        {{ hit.context }}
      </p>
    </div>
  </div>
</template>
