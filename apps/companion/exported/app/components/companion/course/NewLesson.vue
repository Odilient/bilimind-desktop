<script setup lang="ts">
import type { Subject, Topic } from '~/companion/types'
import { useCompanion } from '~/companion/store'

/**
 * "+ New → Lesson on a topic…": name what a lesson should teach and it is
 * written for this course and opened beside it. A topic the course already
 * has (typed, or picked from the chips of the ones not written yet) is used
 * as it is; a new one is added to the course first, at the end of the unit
 * being worked on, so it lands on the roadmap where it belongs.
 *
 * The writing itself is the course page's (`write`), the same path as the
 * roadmap's "Write this lesson", so the allowance, the queue and the progress
 * strip behave the same.
 */
const props = defineProps<{ subject: Subject }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ write: [topic: Topic, instruction: string] }>()

const c = useCompanion()
const title = ref('')
const how = ref('')
const busy = ref(false)

const topics = computed(() => c.topics.value.filter((t) => t.subject_id === props.subject.id))
const units = computed(() => topics.value.filter((t) => !t.parent_id && topics.value.some((x) => x.parent_id === t.id)))

/** The topics still waiting for a lesson, the path's next ones first. */
const unwritten = computed(() => {
  const order = c.pathOf(props.subject.id)
  return order
    .filter((step) => !step.topic.node_id && step.state !== 'done')
    .map((step) => step.topic)
    .slice(0, 6)
})

watch(open, (isOpen) => {
  if (isOpen) {
    title.value = ''
    how.value = ''
  }
})

async function submit(picked?: Topic): Promise<void> {
  const name = (picked?.title ?? title.value).trim()
  if (!name || busy.value) return
  busy.value = true
  try {
    let topic = picked ?? topics.value.find((t) => t.title.trim().toLowerCase() === name.toLowerCase()) ?? null
    if (!topic) {
      // At the end of the unit being worked on (or the last one), so it sits
      // on the path after what the learner is doing now.
      const now = c.pathOf(props.subject.id).find((s) => s.state === 'now')?.topic
      const unit = units.value.length
        ? (units.value.find((u) => u.id === now?.parent_id) ?? units.value.at(-1)!)
        : null
      const siblings = topics.value.filter((t) => t.parent_id === (unit?.id ?? null))
      topic = await c.upsert<Topic>('topics', {
        id: crypto.randomUUID(),
        subject_id: props.subject.id,
        parent_id: unit?.id ?? null,
        title: name,
        position: Math.max(0, ...siblings.map((t) => t.position)) + 1,
        summary: null,
        source: 'manual',
        weight: null,
        node_id: null,
      })
    }
    open.value = false
    emit('write', topic, how.value)
  } catch {
    // `upsert` has said what went wrong.
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UiModal
    v-model:open="open"
    size="compact"
    title="A lesson on a topic"
    description="Name what it should teach. It's written for this course, from its own material, and opens here."
  >
    <form
      class="grid gap-4"
      @submit.prevent="submit()"
    >
      <UiTextField
        v-model="title"
        placeholder="e.g. Window functions in SQL"
        aria-label="What the lesson should teach"
        autofocus
      />

      <WorkspaceLessonSteer
        v-model="how"
        @submit="submit()"
      />

      <div
        v-if="unwritten.length"
        class="grid gap-2"
      >
        <p class="text-[13px] font-medium text-text-muted">
          Not written yet in this course
        </p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="t in unwritten"
            :key="t.id"
            type="button"
            class="h-8 cursor-pointer rounded-full bg-surface-sunken px-3 text-[13px] font-medium text-text-body transition-colors hover:bg-surface-track hover:text-text disabled:opacity-50"
            :disabled="busy"
            @click="submit(t)"
          >
            {{ t.title }}
          </button>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 pt-1">
        <UiBtn
          variant="ghost"
          size="md"
          @click="open = false"
        >
          Cancel
        </UiBtn>
        <UiBtn
          type="submit"
          variant="primary"
          size="md"
          icon="wand"
          :disabled="!title.trim()"
          :loading="busy"
        >
          Write the lesson
        </UiBtn>
      </div>
    </form>
  </UiModal>
</template>
