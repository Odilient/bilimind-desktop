<script setup lang="ts">
import type { ExplainerBlock } from '~/types/api'
import BlockShell from './BlockShell.vue'
import Markdown from './Markdown.vue'
import { leadingHeading } from '~/composables/useLessonSections'

/**
 * The prose, and the page's default voice.
 *
 * It carries no eyebrow. It used to, on the argument that an unlabelled block
 * in a sequence of twenty formats reads as a rendering failure — but that put a
 * caption on the majority case to protect the minority one, and the majority
 * case is most of the lesson. A label is information only while it is rare.
 *
 * A leading `# Heading` is promoted to the block's own title so the section has
 * a headline in the same position as every other block's, rather than a heading
 * floating inside the body at a different size. The split lives in
 * `leadingHeading()` because the lesson outline has to resolve the same string.
 */
const props = defineProps<{ block: ExplainerBlock }>()

const split = computed(() => leadingHeading(String(props.block.payload?.markdown ?? '')))

const heading = computed(() => split.value.heading)
const markdown = computed(() => split.value.body)
</script>

<template>
  <BlockShell
    :type="block.type"
    :title="heading ?? undefined"
    :source-material-ids="block.source_material_ids"
  >
    <Markdown
      v-if="markdown"
      :source="markdown"
    />
    <p
      v-else-if="!heading"
      class="text-[13px] text-text-faint italic"
    >
      This explainer came back empty. Regenerate the lesson to fill it in.
    </p>
  </BlockShell>
</template>
