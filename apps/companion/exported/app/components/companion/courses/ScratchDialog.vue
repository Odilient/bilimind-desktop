<script setup lang="ts">
import { useCompanion } from '~/companion/store'
import { createLocally, freeColor, settleCourse } from '~/companion/create'
import { parseTopics, scratchProposal } from '~/companion/scratch-course'

/**
 * "Start from scratch": a course made by hand, with no AI, so it works on
 * Free and offline. A name, its look, the topics one per line (a line ending
 * with ":" starts a unit) and, if there is one, the date it should be done by.
 * It is made the way a drafted course is (`createLocally`), opened, and its
 * lessons are written from its path, by hand or by BiliMind.
 */
const open = defineModel<boolean>('open', { default: false })

const c = useCompanion()
const toast = useToast()

const title = ref('')
const topics = ref('')
const finish = ref('')
const icon = ref<string | null>(null)
const color = ref('c8')
const busy = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  title.value = ''
  topics.value = ''
  finish.value = ''
  icon.value = null
  color.value = freeColor(c.subjects.value.map((s) => s.color))
})

const counted = computed(() => {
  const units = parseTopics(topics.value)
  const n = units.reduce((sum, u) => sum + u.topics.length, 0)
  const named = units.filter((u) => u.title).length
  if (!n && !named) return 'You can add topics later, from the course.'
  return [`${n} ${n === 1 ? 'topic' : 'topics'}`, named ? `${named} ${named === 1 ? 'unit' : 'units'}` : null]
    .filter(Boolean)
    .join(', ')
})

async function create(): Promise<void> {
  if (!title.value.trim() || busy.value) return
  busy.value = true
  try {
    const proposal = scratchProposal({
      title: title.value,
      topics: topics.value,
      color: color.value,
      icon: icon.value,
      finish: finish.value,
    })
    const { subjectId } = await createLocally(c, proposal, { itemIds: [], links: [] })
    await settleCourse(c, subjectId, proposal, [])
    void c.loadToday()
    open.value = false
    await navigateTo(`/app/courses/${subjectId}`)
  } catch {
    toast.error({ title: "Couldn't make the course", body: 'Check the connection and try again.' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UiModal
    v-model:open="open"
    size="lg"
    title="Start a course from scratch"
    description="Name it and list what it covers. Write the lessons yourself, or have BiliMind write them later."
  >
    <form
      class="grid gap-6"
      @submit.prevent="create"
    >
      <!-- What it covers on the left, how it looks on the right; one column on a phone. -->
      <div class="grid gap-6 min-[720px]:grid-cols-[minmax(0,1fr)_248px] min-[720px]:gap-8">
        <div class="grid content-start gap-5">
          <UiTextField
            v-model="title"
            label="Name"
            placeholder="e.g. Beekeeping basics"
            autofocus
            :maxlength="200"
          />

          <div class="grid gap-1.5">
            <UiTextField
              v-model="topics"
              label="Topics, one per line"
              multiline
              :rows="6"
              :placeholder="'Getting started:\nWhat a hive needs\nThe bees in it\nThrough the year:\nSpring checks'"
            />
            <p class="text-[13px] text-text-muted">
              A line ending with “:” starts a unit. {{ counted }}
            </p>
          </div>

          <label class="grid gap-1.5">
            <span class="text-[14px] font-semibold text-text">Done by <span class="font-normal text-text-muted">(optional)</span></span>
            <input
              v-model="finish"
              type="date"
              class="h-11 w-[200px] rounded-[12px] bg-surface-sunken px-3.5 text-[15px] text-text outline-none focus:shadow-[inset_0_0_0_2px_var(--brand)]"
            >
          </label>
        </div>

        <CompanionCoursesLookFields
          v-model:icon="icon"
          v-model:color="color"
          :title="title"
          compact
        />
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
          :disabled="!title.trim()"
          :loading="busy"
        >
          Make the course
        </UiBtn>
      </div>
    </form>
  </UiModal>
</template>
