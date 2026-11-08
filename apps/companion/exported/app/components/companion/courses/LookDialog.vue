<script setup lang="ts">
import type { Subject } from '~/companion/types'
import { useCompanion } from '~/companion/store'

/**
 * "Icon and colour…" from a course's "⋯", or a click on its cover: the
 * course's look, saved as it is picked, the way the swatches always were.
 */
const props = defineProps<{
  subject: Subject
}>()

const open = defineModel<boolean>('open', { default: false })

const c = useCompanion()

function save(patch: Partial<Subject>): void {
  void c.upsert<Subject>('subjects', { id: props.subject.id, ...patch }).catch(() => undefined)
}

const icon = computed({
  get: () => props.subject.icon ?? null,
  set: (value: string | null) => save({ icon: value }),
})

const color = computed({
  get: () => props.subject.color,
  set: (value: string) => save({ color: value }),
})
</script>

<template>
  <UiModal
    v-model:open="open"
    size="compact"
    title="Icon and colour"
  >
    <CompanionCoursesLookFields
      v-model:icon="icon"
      v-model:color="color"
      :title="subject.title"
      :subject-id="subject.id"
    />
    <div class="mt-6 flex justify-end">
      <UiBtn
        variant="primary"
        size="md"
        @click="open = false"
      >
        Done
      </UiBtn>
    </div>
  </UiModal>
</template>
