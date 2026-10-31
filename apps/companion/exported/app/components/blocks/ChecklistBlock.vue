<script setup lang="ts">
import type { ChecklistBlock } from '~/types/api'
import BlockShell from './BlockShell.vue'

/**
 * EXPAND §2/§6 — the document the learner keeps open while they work.
 *
 * Ticks are local and unsaved on purpose. A checklist is used once per job, not
 * once per course, so persisting it would mean showing someone their last job's
 * ticks on this job's list — which is exactly the failure mode checklists exist to
 * prevent.
 */
const props = defineProps<{ block: ChecklistBlock }>()

const items = computed(() => props.block.payload?.items ?? [])
const checked = ref<Set<number>>(new Set())

const allDone = computed(() => items.value.length > 0 && checked.value.size === items.value.length)

function toggle(index: number): void {
  const next = new Set(checked.value)

  next.has(index) ? next.delete(index) : next.add(index)
  checked.value = next
}

function clear(): void {
  checked.value = new Set()
}
</script>

<template>
  <BlockShell
    :type="block.type"
    :title="block.payload?.title || undefined"
    :tone="allDone ? 'success' : 'default'"
    :source-material-ids="block.source_material_ids"
  >
    <template #actions>
      <span
        class="num inline-flex h-6 items-center rounded-full px-2.5 text-[11.5px] font-semibold tabular-nums"
        :class="allDone ? 'bg-accent text-on-accent' : 'bg-surface-sunken text-text-soft'"
      >
        {{ checked.size }}/{{ items.length }}
      </span>
      <UiBtn
        v-if="checked.size"
        variant="ghost"
        size="xs"
        icon="refresh"
        @click="clear"
      >
        Clear
      </UiBtn>
    </template>

    <ul
      v-if="items.length"
      class="flex flex-col gap-0.5"
    >
      <li
        v-for="(item, index) in items"
        :key="index"
      >
        <button
          type="button"
          class="flex w-full cursor-pointer items-start gap-3 rounded-[12px] px-2.5 py-2.5 text-left transition hover:bg-surface-mute"
          :aria-pressed="checked.has(index)"
          @click="toggle(index)"
        >
          <span
            class="mt-px grid size-5 shrink-0 place-items-center rounded-[6px] transition"
            :class="
              checked.has(index)
                ? 'bg-accent text-on-accent'
                : 'bg-surface shadow-[inset_0_0_0_1.5px_rgb(var(--wash-rgb)/0.18)]'
            "
          >
            <UiIcon
              v-if="checked.has(index)"
              name="check"
              :size="12"
              :stroke="2.6"
            />
          </span>

          <span class="min-w-0 flex-1">
            <span
              class="block text-[14.5px] leading-snug text-text-body"
              :class="checked.has(index) && 'text-text-faint line-through'"
            >
              {{ item.text }}
            </span>
            <span
              v-if="item.why"
              class="mt-1 block text-[12.5px] leading-relaxed text-text-faint"
            >
              {{ item.why }}
            </span>
          </span>
        </button>
      </li>
    </ul>

    <p
      v-else
      class="text-[13px] text-text-faint italic"
    >
      No checklist items were generated.
    </p>

    <p
      v-if="block.payload?.note"
      class="mt-3 border-t border-dashed border-border-strong pt-3 text-[13px] leading-relaxed text-text-soft"
    >
      {{ block.payload.note }}
    </p>
  </BlockShell>
</template>
