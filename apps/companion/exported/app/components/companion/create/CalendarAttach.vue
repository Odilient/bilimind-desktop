<script setup lang="ts">
/**
 * The composer's Calendar button: one calendar link that belongs to THIS
 * course (a class's own feed, an exam timetable), read for its dates when
 * the course is built. Importing the whole timetable, for every course, is
 * a different thing and lives under "Connect your school"; the link at the
 * bottom goes there for the learner who meant that.
 */
import { normaliseUrl } from '~/companion/create'

const emit = defineEmits<{ add: [url: string]; connect: [] }>()
const open = defineModel<boolean>('open', { default: false })

const url = ref('')
const problem = ref<string | null>(null)

watch(open, (now) => {
  if (now) {
    url.value = ''
    problem.value = null
  }
})

function add(): void {
  const clean = normaliseUrl(url.value)
  if (!clean) {
    problem.value = 'That isn\'t a link. It starts with https:// or webcal://'
    return
  }
  emit('add', clean)
  open.value = false
}
</script>

<template>
  <UiModal
    v-model:open="open"
    title="Add a calendar link"
    description="A calendar for this course's classes or exams, an .ics or webcal:// link. Its dates become the course's deadlines."
    size="md"
  >
    <form
      class="grid gap-3"
      @submit.prevent="add"
    >
      <label
        for="cp-create-cal"
        class="sr-only"
      >Calendar link</label>
      <input
        id="cp-create-cal"
        v-model="url"
        type="url"
        inputmode="url"
        autocomplete="off"
        autofocus
        placeholder="webcal://… or https://… .ics"
        class="h-12 w-full min-w-0 rounded-full border border-border-field bg-surface px-5 text-[16px] outline-none placeholder:text-text-faint focus:border-brand focus:ring-3 focus:ring-brand-line"
        @input="problem = null"
      >
      <p
        v-if="problem"
        class="text-[14px] font-medium text-danger-text"
        role="alert"
      >
        {{ problem }}
      </p>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          class="inline-flex min-h-11 cursor-pointer items-center rounded-full text-left text-[14px] font-semibold text-brand outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand-line"
          @click="emit('connect')"
        >
          Import my whole timetable instead
        </button>
        <UiBtn
          type="submit"
          variant="primary"
          size="lg"
          :disabled="!url.trim()"
        >
          Add link
        </UiBtn>
      </div>
    </form>
  </UiModal>
</template>
