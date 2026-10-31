<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { usePageEnv } from '~/companion/doc/editor/env'
import { dayLabel, whenLabel } from '~/companion/time'

/**
 * An @mention chip. A deadline chip reads the deadline as it is now (renamed,
 * moved, still tentative), and opens it; a date opens the calendar on that day.
 */
const props = defineProps(nodeViewProps)
const env = usePageEnv()

const kind = computed(() => String(props.node.attrs.kind))
const id = computed(() => String(props.node.attrs.id ?? ''))

const deadline = computed(() =>
  kind.value === 'deadline' ? env.ctx.value.deadlines.find((d) => d.id === id.value) ?? null : null,
)
const topic = computed(() =>
  kind.value === 'topic' ? env.ctx.value.topics.find((t) => t.id === id.value) ?? null : null,
)

const label = computed(() => deadline.value?.title ?? topic.value?.title ?? String(props.node.attrs.label))

const title = computed(() => {
  if (deadline.value?.due_at) {
    return `${whenLabel(deadline.value.due_at, deadline.value.all_day)}${deadline.value.tentative ? ', not confirmed yet' : ''}`
  }
  if (kind.value === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(id.value)) return dayLabel(id.value)
  return undefined
})

const to = computed(() => {
  if (kind.value === 'deadline' && id.value) return `/app/d/${id.value}`
  if (kind.value === 'date' && id.value) return `/app/calendar?date=${id.value}`
  if (kind.value === 'topic' && topic.value) return `/app/courses/${topic.value.subject_id}?tab=topics`
  return null
})

const icon = computed(() => (kind.value === 'date' ? 'calendar' : kind.value === 'deadline' ? 'flag' : 'book'))
</script>

<template>
  <NodeViewWrapper
    as="span"
    class="pg-mention-wrap"
  >
    <NuxtLink
      v-if="to"
      :to="to"
      class="pg-mention"
      :class="{ 'is-tentative': deadline?.tentative }"
      :title="title"
      contenteditable="false"
    >
      <PageIcon
        :name="icon"
        :size="11"
      />{{ label }}
    </NuxtLink>
    <span
      v-else
      class="pg-mention"
      contenteditable="false"
    >
      <PageIcon
        :name="icon"
        :size="11"
      />{{ label }}
    </span>
  </NodeViewWrapper>
</template>
