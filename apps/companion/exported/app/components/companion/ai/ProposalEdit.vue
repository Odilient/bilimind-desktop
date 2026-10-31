<script setup lang="ts">
/**
 * Edit, for a course drafted in the chat: the create screen's own editor
 * (create/Review, with PathEditor and DeadlineEditor inside) over the
 * thread, in a modal on a computer and a sheet on a phone.
 *
 * It edits a copy. Done writes the copy into the draft in place, so the
 * card behind (and the same card in the dock, which draws the same message)
 * shows the change; Cancel, Esc or a tap outside leave the draft as it was.
 * Create course saves and makes it in one press, because the learner who
 * opened Edit to rename one topic shouldn't need two more clicks after.
 */
import type { CourseProposal } from '~/companion/create'
import { cleanProposal, topicCount } from '~/companion/ai/proposal'

const props = defineProps<{
  proposal: CourseProposal
  creating?: boolean
}>()

const emit = defineEmits<{ save: [proposal: CourseProposal]; create: [proposal: CourseProposal] }>()

const open = defineModel<boolean>('open', { default: false })

const isPhone = useIsPhone()
const mod = ref('Ctrl')

/* A plain copy: the draft lives inside the thread's reactive state, and a proxy doesn't clone. */
function copy(): CourseProposal {
  return JSON.parse(JSON.stringify(props.proposal)) as CourseProposal
}

const local = ref<CourseProposal>(copy())

/* Each opening starts from the draft as it is now (a chat revision may have replaced it). */
watch(open, (now) => {
  if (now) local.value = copy()
})

const canCreate = computed(() => local.value.title.trim().length > 0)

const summary = computed(() => {
  const units = local.value.units.length
  const topics = topicCount(local.value)
  const deadlines = local.value.deadlines.length
  return [
    `${units} unit${units === 1 ? '' : 's'}`,
    `${topics} topic${topics === 1 ? '' : 's'}`,
    `${deadlines} deadline${deadlines === 1 ? '' : 's'}`,
  ].join(' · ')
})

function done(): void {
  emit('save', cleanProposal(local.value))
  open.value = false
}

function create(): void {
  if (!canCreate.value || props.creating) return
  const p = cleanProposal(local.value)
  emit('save', p)
  emit('create', p)
  open.value = false
}

function onKey(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey) || event.isComposing) return
  event.preventDefault()
  create()
}

onMounted(() => {
  if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) mod.value = '⌘'
})
</script>

<template>
  <!-- A phone: from the thumb's end, the actions pinned under the thumb. -->
  <UiSheet
    v-if="isPhone"
    v-model:open="open"
    title="Edit the course"
    description="Nothing is made until you press Create course."
  >
    <div
      class="mt-5"
      @keydown="onKey"
    >
      <CompanionCreateReview
        v-model="local"
        :attachments="[]"
        :creating="creating"
        :mod="mod"
        variant="sheet"
      />
      <div class="sticky bottom-0 z-10 -mx-5 mt-6 -mb-7 flex gap-2 border-t border-border bg-surface px-5 pt-3 pb-[max(28px,env(safe-area-inset-bottom))]">
        <UiBtn
          variant="secondary"
          size="lg"
          class="flex-1"
          @click="done"
        >
          Done
        </UiBtn>
        <UiBtn
          variant="primary"
          size="lg"
          class="flex-[2]"
          :loading="creating"
          :disabled="!canCreate"
          @click="create"
        >
          Create course
        </UiBtn>
      </div>
    </div>
  </UiSheet>

  <!-- A computer: a modal whose middle scrolls, its header and actions still. -->
  <UiModal
    v-else
    v-model:open="open"
    size="lg"
    title="Edit the course"
    description="Nothing is made until you press Create course. Lessons are written as you reach them."
  >
    <div
      class="-mx-6 -my-5 max-h-[min(64vh,680px)] overflow-y-auto overscroll-contain px-6 py-5"
      @keydown="onKey"
    >
      <CompanionCreateReview
        v-model="local"
        :attachments="[]"
        :creating="creating"
        :mod="mod"
        variant="sheet"
      />
    </div>
    <template #footer>
      <p class="mr-auto min-w-0 truncate text-[13px] text-text-muted">
        {{ summary }}
      </p>
      <UiBtn
        variant="ghost"
        @click="open = false"
      >
        Cancel
      </UiBtn>
      <UiBtn
        variant="secondary"
        @click="done"
      >
        Done
      </UiBtn>
      <UiBtn
        variant="primary"
        :loading="creating"
        :disabled="!canCreate"
        :title="`Create course (${mod}Enter)`"
        @click="create"
      >
        Create course
        <span
          class="ml-1 text-[12px] font-medium opacity-55"
          aria-hidden="true"
        >{{ mod }}↵</span>
      </UiBtn>
    </template>
  </UiModal>
</template>
