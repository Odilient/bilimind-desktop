<script setup lang="ts">
/**
 * A drafted course's path, read in the chat: one line, in the roadmap's own
 * grammar (`cp-node`, docs/design/daylight2/css/04-cycler.css): a spine
 * down the middle, each unit a pill on it, each topic a small card with its
 * status mark. Nothing is learned yet, so every mark is the dashed "to do"
 * and the spine is dotted, the way the course page draws what's ahead; the
 * first topic is the highlighter's, because it is where you start. Units
 * fold, so a 25-topic path is five pills in a 380px panel and opens one
 * unit at a time; the first is open, because where you start is the part
 * people check.
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

/** The topic's running number along the whole path, the way the course page counts. */
const firstOf = computed(() => {
  const starts: number[] = []
  let n = 1
  for (const u of props.units) {
    starts.push(n)
    n += u.topics.length
  }
  return starts
})
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
      class="pp-path relative mx-auto grid w-full max-w-[380px] justify-items-center gap-2.5 py-1"
    >
      <!-- The spine: dotted, because all of it is still ahead. -->
      <span
        class="pp-spine"
        aria-hidden="true"
      />
      <li
        v-for="(u, i) in units"
        :key="i"
        class="relative z-[1] grid w-full justify-items-center gap-2"
      >
        <button
          type="button"
          class="pp-part group/unit max-lg:min-h-11"
          :aria-expanded="isOpen(i)"
          @click="toggle(i)"
        >
          <i
            class="size-2 shrink-0 rounded-[3px]"
            :style="{ background: ink }"
            aria-hidden="true"
          />
          <span class="min-w-0 truncate">
            <b class="font-bold text-text">Unit {{ i + 1 }}</b>
            <template v-if="u.title"> · {{ u.title }}</template>
          </span>
          <span class="shrink-0 font-medium text-text-faint tabular-nums">{{ u.topics.length }}</span>
          <UiIcon
            name="chevron-down"
            :size="13"
            :stroke="2"
            class="shrink-0 text-text-faint transition-transform duration-200 group-hover/unit:text-text-soft"
            :class="isOpen(i) && 'rotate-180'"
          />
        </button>
        <ul
          v-if="isOpen(i) && u.topics.length"
          class="animate-fade grid w-full gap-2.5"
        >
          <li
            v-for="(t, j) in u.topics"
            :key="j"
            :class="['pp-node', i === 0 && j === 0 && !live && 'is-cur']"
          >
            <svg
              class="size-[15px] shrink-0 overflow-visible"
              viewBox="0 0 15 15"
              aria-hidden="true"
            >
              <circle
                cx="7.5"
                cy="7.5"
                r="6.3"
                fill="none"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-dasharray="2.2 2.2"
                class="pp-mk"
              />
            </svg>
            <span class="min-w-0 flex-1 truncate">{{ t.title }}</span>
            <span class="pp-nn">{{ (firstOf[i] ?? 1) + j }}</span>
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

<style scoped>
.pp-spine {
  position: absolute;
  top: 18px;
  bottom: 18px;
  left: 50%;
  width: 2px;
  margin-left: -1px;
  background: repeating-linear-gradient(var(--text-ghost) 0 2px, transparent 2px 8px);
}

/* A unit: the roadmap's `cp-part`, a pill sitting on the spine. */
.pp-part {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  max-width: 100%;
  min-height: 30px;
  padding: 4px 10px 4px 11px;
  border-radius: 999px;
  background: var(--surface);
  box-shadow: 0 0 0 1px var(--border-strong);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  transition: background-color 0.2s, box-shadow 0.2s;
}

.pp-part:hover {
  background: var(--surface-chrome);
  box-shadow: 0 0 0 1px var(--border-field);
}

.pp-part:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--brand-line);
}

/* A topic: the roadmap's `cp-node`. */
.pp-node {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 38px;
  padding: 8px 10px 8px 12px;
  border-radius: 10px;
  background: var(--surface);
  box-shadow: 0 0 0 1px var(--border-strong), var(--shadow-card);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text);
  animation: pp-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.pp-mk {
  color: var(--text-faint);
}

.pp-nn {
  flex: none;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}

/* Where you start: the highlighter, once. */
.pp-node.is-cur {
  background: var(--accent);
  color: var(--on-accent);
  box-shadow:
    0 0 0 1px color-mix(in oklab, var(--hi-2) 80%, var(--accent-strong)),
    0 10px 24px -10px color-mix(in oklab, var(--accent-strong) 55%, transparent);
}

.pp-node.is-cur .pp-mk,
.pp-node.is-cur .pp-nn {
  color: color-mix(in oklab, var(--on-accent) 55%, transparent);
}

.pp-node.is-cur::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  animation: pp-pulse 1.4s ease-out 0.8s 3;
}

/* Each topic settles onto the spine as it arrives, so a draft visibly writes itself. */
@keyframes pp-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}

@keyframes pp-pulse {
  from {
    box-shadow: 0 0 0 0 color-mix(in oklab, var(--accent) 90%, transparent);
  }
  to {
    box-shadow: 0 0 0 11px transparent;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pp-node,
  .pp-node.is-cur::after {
    animation: none;
  }
}
</style>
