<script setup lang="ts">
import type { Subject, Topic } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { useUsage } from '~/companion/usage'

/**
 * "+ New → Lesson on a topic…": name what a lesson should teach, then write it
 * yourself, have it written for this course, or only add the topic to the
 * roadmap for later. A topic the course already has (typed, or picked from the
 * chips of the ones not written yet) is used as it is; a new one is added to
 * the course first, at the end of the unit being worked on, so it lands on the
 * roadmap where it belongs.
 *
 * Writing it yourself (`compose`) opens the empty lesson in the editor: no
 * model, nothing spent, so on Free with no AI it is the way offered first.
 * Having it written (`write`) is the course page's, the same path as the
 * roadmap's "Write this lesson", so the allowance, the queue and the progress
 * strip behave the same.
 */
const props = defineProps<{ subject: Subject }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ write: [topic: Topic, instruction: string]; compose: [topic: Topic] }>()

const c = useCompanion()
const toast = useToast()
const { limited: noAi, ensure } = useUsage()
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
  if (!isOpen) return
  title.value = ''
  how.value = ''
  void ensure()
})

/** The course's topic of that name, or a new one placed on the path. */
async function topicNamed(name: string): Promise<Topic> {
  const known = topics.value.find((t) => t.title.trim().toLowerCase() === name.toLowerCase())
  if (known) return known
  // At the end of the unit being worked on (or the last one), so it sits
  // on the path after what the learner is doing now.
  const now = c.pathOf(props.subject.id).find((s) => s.state === 'now')?.topic
  const unit = units.value.length
    ? (units.value.find((u) => u.id === now?.parent_id) ?? units.value.at(-1)!)
    : null
  const siblings = topics.value.filter((t) => t.parent_id === (unit?.id ?? null))
  return c.upsert<Topic>('topics', {
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

async function submit(way: 'write' | 'compose' | 'topic'): Promise<void> {
  const name = title.value.trim()
  if (!name || busy.value) return
  busy.value = true
  try {
    const topic = await topicNamed(name)
    open.value = false
    if (way === 'write') emit('write', topic, how.value)
    else if (way === 'compose') emit('compose', topic)
    else toast.success({ title: `Added “${topic.title}”`, body: 'It is on the roadmap, ready to write when you are.' })
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
    description="Name what it should teach. Write it yourself, or have it written from this course's own material."
  >
    <form
      class="grid gap-4"
      @submit.prevent="submit(noAi ? 'compose' : 'write')"
    >
      <UiTextField
        v-model="title"
        placeholder="e.g. Why we forget"
        aria-label="What the lesson should teach"
        autofocus
      />

      <WorkspaceLessonSteer
        v-if="!noAi"
        v-model="how"
        @submit="submit('write')"
      />

      <div
        v-if="unwritten.length"
        class="grid gap-2"
      >
        <p class="text-[13px] font-medium text-text-muted">
          Not written yet in this course
        </p>
        <div class="flex flex-wrap gap-1.5">
          <!-- A pick fills the name; the buttons below say how it gets written. -->
          <button
            v-for="t in unwritten"
            :key="t.id"
            type="button"
            :aria-pressed="title.trim() === t.title"
            :class="[
              'h-8 cursor-pointer rounded-full px-3 text-[13px] font-medium transition-colors disabled:opacity-50',
              title.trim() === t.title
                ? 'bg-inverse text-on-inverse'
                : 'bg-surface-sunken text-text-body hover:bg-surface-track hover:text-text',
            ]"
            :disabled="busy"
            @click="title = t.title"
          >
            {{ t.title }}
          </button>
        </div>
      </div>

      <div class="grid gap-1.5 pt-1">
        <div class="grid grid-cols-2 gap-2">
          <UiBtn
            :type="noAi ? 'submit' : 'button'"
            :variant="noAi ? 'primary' : 'secondary'"
            size="md"
            icon="pencil"
            :disabled="!title.trim() || busy"
            @click="noAi || submit('compose')"
          >
            Write it yourself
          </UiBtn>
          <UiBtn
            :type="noAi ? 'button' : 'submit'"
            :variant="noAi ? 'secondary' : 'primary'"
            size="md"
            icon="wand"
            :disabled="!title.trim() || busy"
            @click="noAi && submit('write')"
          >
            Write the lesson
          </UiBtn>
        </div>
        <UiBtn
          variant="ghost"
          size="md"
          class="justify-self-center"
          :disabled="!title.trim() || busy"
          @click="submit('topic')"
        >
          Only add the topic
        </UiBtn>
      </div>
    </form>
  </UiModal>
</template>
