<script setup lang="ts">
/**
 * A drafted course's path, read in the chat: one line, as the course page
 * draws it ("a course is a path"), with a bead per unit and a small dot per
 * topic along the same rail. Units fold, so a 25-topic path is five rows in
 * a 380px panel and opens one unit at a time; the first is open, because
 * where you start is the part people check.
 *
 * Read-only on purpose. Editing is Edit's outline (create/PathEditor), or a
 * sentence in the chat ("drop joins"); a third way to change it here would
 * be one too many.
 */
import type { ProposalUnit } from '~/companion/create'
import { courseColor } from '~/companion/colors'

const props = defineProps<{
  units: ProposalUnit[]
  color: string | null
  /** Still being written: every unit stays open, so the topics can be seen arriving. */
  live?: boolean
}>()

/* Which units are open: the first, or all of them when there are only two. */
const open = ref<Set<number>>(new Set(props.units.length <= 2 ? props.units.map((_, i) => i) : [0]))

const isOpen = (i: number) => props.live || open.value.has(i)

function toggle(i: number): void {
  const next = new Set(open.value)
  if (next.has(i)) next.delete(i)
  else next.add(i)
  open.value = next
}

const allOpen = computed(() => props.units.length > 0 && props.units.every((_, i) => open.value.has(i)))

function toggleAll(): void {
  open.value = allOpen.value ? new Set() : new Set(props.units.map((_, i) => i))
}

const total = computed(() => props.units.reduce((n, u) => n + u.topics.length, 0))

const ink = computed(() => courseColor(props.color))
const bead = computed(() => `color-mix(in srgb, ${ink.value} 16%, var(--surface))`)
</script>

<template>
  <div class="grid gap-1">
    <div class="flex min-h-7 items-center justify-between gap-2">
      <h4 class="text-[12.5px] font-semibold text-text-soft">
        The path
        <span
          v-if="units.length"
          class="font-normal text-text-faint"
        >· {{ units.length }} {{ units.length === 1 ? 'unit' : 'units' }}, {{ total }} {{ total === 1 ? 'topic' : 'topics' }}</span>
      </h4>
      <button
        v-if="units.length > 2 && !live"
        type="button"
        class="-mr-1.5 inline-flex h-7 cursor-pointer items-center rounded-full px-2 text-[12px] font-semibold text-text-muted transition-colors duration-150 outline-none hover:bg-surface-sunken hover:text-text focus-visible:ring-2 focus-visible:ring-brand-line max-lg:h-11"
        @click="toggleAll"
      >
        {{ allOpen ? 'Fold all' : 'Open all' }}
      </button>
    </div>

    <ol
      v-if="units.length"
      class="relative grid"
    >
      <!-- The rail the beads sit on. -->
      <span
        class="pointer-events-none absolute top-5 bottom-5 left-[9.5px] w-px bg-border-strong"
        aria-hidden="true"
      />
      <li
        v-for="(u, i) in units"
        :key="i"
        class="relative"
      >
        <button
          type="button"
          class="group/unit -ml-1 flex min-h-10 w-[calc(100%+4px)] cursor-pointer items-center gap-2.5 rounded-[10px] py-1 pr-1.5 pl-1 text-left transition-colors duration-150 outline-none hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-brand-line max-lg:min-h-11"
          :aria-expanded="isOpen(i)"
          @click="toggle(i)"
        >
          <span
            class="num relative z-[1] grid size-[19px] shrink-0 place-items-center rounded-full text-[10.5px] font-semibold text-text-soft"
            :style="{ background: bead, boxShadow: `inset 0 0 0 1.5px ${ink}, 0 0 0 3px var(--surface)` }"
          >{{ i + 1 }}</span>
          <span class="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-text">{{ u.title || `Unit ${i + 1}` }}</span>
          <span class="shrink-0 text-[12px] text-text-faint tabular-nums">{{ u.topics.length }} {{ u.topics.length === 1 ? 'topic' : 'topics' }}</span>
          <UiIcon
            name="chevron-down"
            :size="14"
            class="shrink-0 text-text-faint transition-transform duration-150 group-hover/unit:text-text-soft"
            :class="isOpen(i) && 'rotate-180'"
          />
        </button>
        <ul
          v-if="isOpen(i) && u.topics.length"
          class="animate-fade grid pb-1.5 pl-[27px]"
        >
          <li
            v-for="(t, j) in u.topics"
            :key="j"
            class="relative flex min-h-7 items-center text-[13px] leading-snug text-text-body"
          >
            <span
              class="absolute top-1/2 -left-[20px] size-[5px] -translate-y-1/2 rounded-full bg-text-ghost shadow-[0_0_0_2.5px_var(--surface)]"
              aria-hidden="true"
            />
            <span class="min-w-0 truncate">{{ t.title }}</span>
          </li>
        </ul>
      </li>
    </ol>
    <p
      v-else
      class="text-[13px] text-text-muted"
    >
      No topics yet. Add them with Edit, or ask for them here.
    </p>
  </div>
</template>
