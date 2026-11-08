<script setup lang="ts">
import type { ComparisonBlock } from '~/types/api'
import BlockShell from './BlockShell.vue'
import Markdown from './Markdown.vue'

/**
 * EXPAND §2/§6 — X versus Y, and when to reach for which.
 *
 * Two layouts, because a comparison table is the single worst thing to read on a
 * phone: a real table on wide screens, and one card per item below `sm`, where a
 * four-column table would either overflow or shrink to unreadable.
 */
const props = defineProps<{ block: ComparisonBlock }>()

const { renderInline } = useMarkdown()

const axes = computed(() => props.block.payload?.axes ?? [])
const items = computed(() => props.block.payload?.items ?? [])

/** Rows are padded server-side, but a missing cell must never shift the columns. */
function cell(values: string[], index: number): string {
  return renderInline(values[index] ?? '—')
}
</script>

<template>
  <BlockShell
    :type="block.type"
    :source-material-ids="block.source_material_ids"
  >
    <Markdown
      v-if="block.payload?.intro"
      :source="block.payload.intro"
      size="sm"
      class="mb-4 text-text-muted"
    />

    <template v-if="items.length && axes.length">
      <!-- Wide: a real table. Scrolls inside its own box, never the page. -->
      <div class="-mx-1 hidden overflow-x-auto px-1 sm:block">
        <table class="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr>
              <th class="px-3 pb-2.5 text-[12px] font-semibold text-text-faint">
                &nbsp;
              </th>
              <th
                v-for="(axis, index) in axes"
                :key="index"
                class="px-3 pb-2.5 align-bottom text-[12px] font-semibold text-text-faint"
              >
                {{ axis }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, row) in items"
              :key="row"
              class="align-top odd:[&>*]:bg-transparent even:[&>*]:bg-surface-mute [&>*:first-child]:rounded-l-[10px] [&>*:last-child]:rounded-r-[10px]"
            >
              <th
                scope="row"
                class="border-t border-border px-3 py-3 font-display text-[14px] font-semibold whitespace-nowrap text-text"
              >
                {{ item.name }}
              </th>
              <td
                v-for="(_, column) in axes"
                :key="column"
                class="md border-t border-border px-3 py-3 leading-relaxed text-text-body"
                v-html="cell(item.values, column)"
              />
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Narrow: one card per item, so no column ever gets squeezed. -->
      <div class="flex flex-col gap-2.5 sm:hidden">
        <div
          v-for="(item, row) in items"
          :key="row"
          class="rounded-[14px] bg-surface-mute p-3.5 shadow-[inset_0_0_0_1px_var(--border)]"
        >
          <p class="font-display text-[15px] font-semibold">{{ item.name }}</p>
          <dl class="mt-2 flex flex-col gap-1.5">
            <div
              v-for="(axis, column) in axes"
              :key="column"
              class="flex flex-col gap-0.5"
            >
              <dt class="text-[12px] font-semibold text-text-faint">
                {{ axis }}
              </dt>
              <dd
                class="md text-[13px] leading-relaxed text-text-muted"
                v-html="cell(item.values, column)"
              />
            </div>
          </dl>
          <p
            v-if="item.best_for"
            class="mt-2.5 flex items-start gap-1.5 border-t border-border pt-2 text-[12.5px] leading-relaxed"
          >
            <span class="mt-[5px] size-[7px] shrink-0 rounded-full bg-brand" />
            <span><span class="text-text-faint">Best for</span> {{ item.best_for }}</span>
          </p>
        </div>
      </div>

      <ul
        v-if="items.some((item) => item.best_for)"
        class="mt-4 hidden flex-col gap-2 pt-1 sm:flex"
      >
        <li
          v-for="(item, row) in items.filter((candidate) => candidate.best_for)"
          :key="row"
          class="flex items-start gap-2.5 text-[13px] leading-relaxed text-text-soft"
        >
          <span class="mt-[5px] grid size-3 shrink-0 place-items-center rounded-full bg-brand-soft">
            <span class="size-[6px] rounded-full bg-brand" />
          </span>
          <span
            ><strong class="font-semibold text-text">{{ item.name }}</strong> —
            {{ item.best_for }}</span
          >
        </li>
      </ul>
    </template>

    <p
      v-else
      class="text-[13px] text-text-faint italic"
    >
      No comparison was generated for this lesson.
    </p>
  </BlockShell>
</template>

<style scoped>
.md :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.88em;
  padding: 0.12em 0.36em;
  border-radius: var(--radius-xs);
  background: var(--surface-sunken);
}

.md :deep(strong) {
  color: var(--text);
  font-weight: 600;
}
</style>
