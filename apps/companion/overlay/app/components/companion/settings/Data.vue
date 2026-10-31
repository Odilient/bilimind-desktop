<script setup lang="ts">
/** Everything lives on this computer, so keeping a copy is theirs to do, and so is taking a course with them. */
import { useCompanion } from '~/companion/store'

const api = useApi()
const toast = useToast()
const c = useCompanion()
const busy = ref<string | null>(null)

const courses = computed(() => c.subjects.value.filter((s) => s.generated_course_id))

async function run(name: string, work: () => Promise<void>): Promise<void> {
  busy.value = name
  try {
    await work()
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'That could not be done.')
  } finally {
    busy.value = null
  }
}

const backup = () => run('backup', async () => {
  const done = await api.post<{ path: string } | null>('/companion/data/backup')
  if (done) toast.success(`Saved to ${done.path}`)
})

const restore = () => run('restore', async () => {
  if (!window.confirm('Restoring replaces what is on this computer with the backup. What is here now is kept in a folder beside it. The app restarts.')) return
  await api.post('/companion/data/restore')
})

const exportCourse = (id: number) => run(`course-${id}`, async () => {
  const done = await api.post<{ path: string } | null>(`/courses/${id}/export`)
  if (done) toast.success(`Saved to ${done.path}`)
})
</script>

<template>
  <div class="grid gap-7 text-[14px] text-text-body">
    <section class="grid gap-2">
      <h2 class="font-display text-[16px] font-semibold text-text">Backup</h2>
      <p class="max-w-[60ch]">
        A copy of your courses, notes, files and plan in a folder you choose. Your AI keys stay out of it: add them again
        on another computer.
      </p>
      <div class="flex flex-wrap gap-2">
        <UiBtn
          size="sm"
          :loading="busy === 'backup'"
          @click="backup"
        >
          Back up
        </UiBtn>
        <UiBtn
          size="sm"
          variant="ghost"
          :loading="busy === 'restore'"
          @click="restore"
        >
          Restore a backup
        </UiBtn>
      </div>
    </section>

    <section
      v-if="courses.length"
      class="grid gap-2"
    >
      <h2 class="font-display text-[16px] font-semibold text-text">A course as one page</h2>
      <p class="max-w-[60ch]">
        One HTML file with its written lessons and questions, for opening anywhere with no app and no network.
      </p>
      <ul class="grid gap-1.5">
        <li
          v-for="subject in courses"
          :key="subject.id"
          class="flex items-center justify-between gap-4"
        >
          <span>{{ subject.title }}</span>
          <UiBtn
            size="sm"
            variant="ghost"
            :loading="busy === `course-${subject.generated_course_id}`"
            @click="exportCourse(subject.generated_course_id!)"
          >
            Save as a page
          </UiBtn>
        </li>
      </ul>
    </section>
  </div>
</template>
