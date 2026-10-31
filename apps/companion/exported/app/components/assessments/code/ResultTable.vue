<script setup lang="ts">
/**
 * The SQL result grid.
 *
 * This lives here rather than inside `CodeSandbox.vue` because the sandbox tab
 * and the inline `query` exercise show the same thing and must keep showing the
 * same thing — two copies of a data grid drift within a month, and the one the
 * learner sees would depend on which surface they opened.
 */
defineProps<{
  table: { columns: string[]; rows: unknown[][] } | null
}>()
</script>

<template>
  <div class="p-2.5">
    <div
      v-if="table"
      class="overflow-auto rounded-lg border border-code-line"
    >
      <table class="sql-grid">
        <thead>
          <tr>
            <th class="sql-idx" />
            <th
              v-for="col in table.columns"
              :key="col"
            >
              {{ col }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, r) in table.rows"
            :key="r"
          >
            <td class="sql-idx">{{ r + 1 }}</td>
            <td
              v-for="(cell, c) in row"
              :key="c"
              :class="cell === null ? 'is-null' : ''"
            >
              {{ cell === null ? 'NULL' : String(cell) }}
            </td>
          </tr>
          <tr v-if="table.rows.length === 0">
            <td
              :colspan="(table.columns.length || 1) + 1"
              class="py-4 text-center text-code-meta"
            >
              No rows returned.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p
      v-else
      class="px-1 py-3 text-[12px] text-code-meta"
    >
      That statement returned no result set.
    </p>
  </div>
</template>

<style scoped>
.sql-grid {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-mono);
  font-size: 12px;
}
.sql-grid th {
  position: sticky;
  top: 0;
  text-align: left;
  font-weight: 600;
  color: var(--color-code-dim);
  background: var(--color-code-bar);
  padding: 7px 12px;
  border-bottom: 1px solid var(--color-code-line);
  white-space: nowrap;
}
.sql-grid td {
  padding: 6px 12px;
  color: var(--color-code-text);
  border-bottom: 1px solid color-mix(in oklab, var(--color-code-line) 60%, transparent);
}
.sql-grid tbody tr:nth-child(odd) td {
  background: color-mix(in oklab, var(--color-code-line) 22%, transparent);
}
.sql-grid td.is-null {
  color: var(--color-code-meta);
  font-style: italic;
}
.sql-idx {
  width: 1%;
  color: var(--color-code-meta) !important;
  background: color-mix(in oklab, var(--color-code-line) 30%, transparent) !important;
  text-align: right;
  user-select: none;
}
</style>
