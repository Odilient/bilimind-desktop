<script setup lang="ts">
import { GHOST, ICON_BTN, INPUT } from './classes'

/**
 * Rows of cells under a sibling field's columns. A row always has exactly as
 * many cells as there are columns, padded or trimmed on the way out, so the
 * table renderer never meets a ragged row.
 */
const props = defineProps<{
  columns: string[]
  modelValue: unknown[]
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string[][]] }>()

const width = computed(() => Math.max(1, props.columns.length))

const rows = computed<string[][]>(() =>
  props.modelValue.map((row) => {
    const cells = Array.isArray(row) ? row.map((cell) => (cell === null || cell === undefined ? '' : String(cell))) : []
    return Array.from({ length: width.value }, (_, i) => cells[i] ?? '')
  }),
)

function setCell(rowIndex: number, cellIndex: number, value: string): void {
  const next = rows.value.map((row) => [...row])
  const row = next[rowIndex]
  if (!row) return
  row[cellIndex] = value
  emit('update:modelValue', next)
}

function addRow(): void {
  emit('update:modelValue', [...rows.value, Array.from({ length: width.value }, () => '')])
}

function removeRow(index: number): void {
  emit(
    'update:modelValue',
    rows.value.filter((_, i) => i !== index),
  )
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="overflow-x-auto">
      <table class="w-full border-separate border-spacing-1">
        <thead>
          <tr>
            <th
              v-for="(column, index) in columns"
              :key="index"
              class="px-1 text-left text-[11px] font-medium text-text-faint"
            >
              {{ column || `Column ${index + 1}` }}
            </th>
            <th class="w-7" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, rowIndex) in rows"
            :key="rowIndex"
          >
            <td
              v-for="(cell, cellIndex) in row"
              :key="cellIndex"
              class="min-w-[8rem]"
            >
              <input
                type="text"
                :class="INPUT"
                :value="cell"
                @input="setCell(rowIndex, cellIndex, ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td>
              <button
                type="button"
                :class="ICON_BTN"
                title="Remove row"
                aria-label="Remove row"
                @click="removeRow(rowIndex)"
              >
                <UiIcon
                  name="x"
                  :size="13"
                />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <button
      type="button"
      :class="[GHOST, 'self-start']"
      @click="addRow"
    >
      <UiIcon
        name="plus"
        :size="12"
      />
      Add a row
    </button>
  </div>
</template>
