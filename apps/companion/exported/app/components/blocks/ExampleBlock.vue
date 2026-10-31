<script setup lang="ts">
import type { ExampleBlock } from '~/types/api'
import BlockShell from './BlockShell.vue'
import Markdown from './Markdown.vue'

const props = defineProps<{ block: ExampleBlock }>()

const title = computed(() => String(props.block.payload?.title ?? '').trim())
const markdown = computed(() => String(props.block.payload?.markdown ?? '').trim())
</script>

<template>
  <BlockShell
    :type="block.type"
    :title="title || undefined"
    :source-material-ids="block.source_material_ids"
  >
    <!-- A worked case, set off by a rule like a quotation from practice. -->
    <div
      v-if="markdown"
      class="border-l-2 border-brand-line pl-4"
    >
      <Markdown :source="markdown" />
    </div>
    <p
      v-else
      class="text-[13px] text-text-faint italic"
    >
      This example came back empty.
    </p>
  </BlockShell>
</template>
