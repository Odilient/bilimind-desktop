<script setup lang="ts">
import type { ReferenceTableBlock } from '~/types/api'
import BlockShell from './BlockShell.vue'

/**
 * EXPAND §2/§6 — the table the learner comes back to in six months.
 *
 * Filterable, because that is what a reference is for: nobody reads a 12-row
 * specification table top to bottom, they look one thing up in it. The filter is
 * hidden below four rows, where scanning is faster than typing.
 */
const props = defineProps<{ block: ReferenceTableBlock }>()

const { renderInline } = useMarkdown()

const columns = computed(() => props.block.payload?.columns ?? [])
const allRows = computed(() => props.block.payload?.rows ?? [])

const query = ref('')

const rows = computed(() => {
  const needle = query.value.trim().toLowerCase()

  if (!needle) return allRows.value

  return allRows.value.filter((row) =>
    row.some((cell) => String(cell ?? '').toLowerCase().includes(needle)),
  )
})

const filterable = computed(() => allRows.value.length > 4)
</script>

<template>
  <BlockShell
    :type="block.type"
    :title="block.payload?.title || undefined"
    :source-material-ids="block.source_material_ids"
  >
    <template
      v-if="filterable"
      #actions
    >
      <UiTextField
        v-model="query"
        placeholder="Filter…"
        size="sm"
        icon="search"
        class="w-40"
        aria-label="Filter the table"
      />
    </template>

    <!--
      Wide: a real table, scrolling inside its own box rather than taking the
      page sideways with it.
    -->
    <div
      v-if="columns.length && allRows.length"
      class="-mx-1 hidden overflow-x-auto px-1 sm:block"
    >
      <table class="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr>
            <th
              v-for="(column, index) in columns"
              :key="index"
              class="px-3 pb-2.5 text-[12px] font-semibold whitespace-nowrap text-text-faint"
            >
              {{ column }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, rowIndex) in rows"
            :key="rowIndex"
            class="align-top even:[&>*]:bg-surface-mute [&>*:first-child]:rounded-l-[10px] [&>*:last-child]:rounded-r-[10px]"
          >
            <td
              v-for="(cell, cellIndex) in row"
              :key="cellIndex"
              class="md border-t border-border px-3 py-2.5 leading-relaxed"
              :class="
                cellIndex === 0
                  ? 'font-semibold whitespace-nowrap text-text'
                  : cellIndex === 1
                    ? 'font-medium text-brand'
                    : 'text-text-soft'
              "
              v-html="renderInline(String(cell ?? ''))"
            />
          </tr>
        </tbody>
      </table>
    </div>

    <!--
      Narrow: one card per row. A four-column reference in a `whitespace-nowrap`
      table leaves about 300px of visible table on a 390px phone, and this is
      the block a learner is most likely to be opening on one — it is the thing
      they came back to look something up in.
    -->
    <div
      v-if="columns.length && rows.length"
      class="flex flex-col gap-2.5 sm:hidden"
    >
      <div
        v-for="(row, rowIndex) in rows"
        :key="rowIndex"
        class="rounded-[14px] bg-surface-mute p-3.5 shadow-[inset_0_0_0_1px_var(--border)]"
      >
        <p
          class="md font-display text-[15px] font-semibold"
          v-html="renderInline(String(row[0] ?? ''))"
        />
        <dl class="mt-2 flex flex-col gap-1.5">
          <div
            v-for="(column, columnIndex) in columns.slice(1)"
            :key="columnIndex"
            class="flex flex-col gap-0.5"
          >
            <dt class="text-[12px] font-semibold text-text-faint">
              {{ column }}
            </dt>
            <dd
              class="md text-[13px] leading-relaxed text-text-muted"
              v-html="renderInline(String(row[columnIndex + 1] ?? ''))"
            />
          </div>
        </dl>
      </div>
    </div>

    <p
      v-if="allRows.length && !rows.length"
      class="py-2 text-[13px] text-text-faint italic"
    >
      Nothing matches “{{ query }}”.
    </p>

    <p
      v-if="!allRows.length"
      class="text-[13px] text-text-faint italic"
    >
      No reference table was generated for this lesson.
    </p>

    <p
      v-if="block.payload?.note"
      class="mt-3.5 flex items-start gap-2.5 rounded-[12px] bg-surface-mute px-3.5 py-2.5 text-[13px] leading-relaxed text-text-soft"
    >
      <UiIcon
        name="bulb"
        :size="14"
        class="mt-0.5 shrink-0 text-brand"
      />
      {{ block.payload.note }}
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
