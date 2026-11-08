<script setup lang="ts">
import type { Subject } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { courseColor } from '~/companion/colors'
import { cleanGroupName, groupNames, setGroup } from '~/companion/shelf'

/**
 * "Move to group…" from a course's "⋯": the learner's groups as one list,
 * the one it's in marked, then a field to start a new group with it, and,
 * for a course in a group, the way back out (under School or On your own,
 * whichever it is). A choice moves it at once and closes; the toast has
 * Undo. Notes' own "Move to…" (`CompanionNotesMoveDialog`) is the model.
 *
 * Typing a name that is already a group's, in any case, joins that group,
 * and the button says so.
 */
const props = defineProps<{
  /** The course being moved; null keeps the dialog shut. */
  subject: Subject | null
}>()

const emit = defineEmits<{ close: [] }>()

const c = useCompanion()
const toast = useToast()

const open = computed({
  get: () => props.subject !== null,
  set: (value: boolean) => {
    if (!value) emit('close')
  },
})

const fresh = ref('')
watch(open, (isOpen) => {
  if (isOpen) fresh.value = ''
})

const groups = computed(() => groupNames(c))
const here = computed(() => props.subject?.group_name?.trim() || null)
const home = computed(() => (props.subject?.format === 'path' ? 'On your own' : 'School'))

/** What the field's name would join: an existing group, or a new one. */
const typed = computed(() => {
  const name = cleanGroupName(fresh.value)
  if (!name) return null
  const existing = groups.value.find((g) => g.toLocaleLowerCase() === name.toLocaleLowerCase())
  return { name: existing ?? name, existing: Boolean(existing) }
})

async function choose(name: string | null): Promise<void> {
  const s = props.subject
  if (!s) return
  const before = s.group_name ?? null
  emit('close')
  try {
    const now = await setGroup(c, [s], name)
    if ((before?.trim() || null) === now) return
    toast.success({
      title: now ? `Moved ${s.title} to ${now}` : `${s.title} is back under ${home.value}`,
      action: { label: 'Undo', handler: () => void setGroup(c, [s], before).catch(() => undefined) },
    })
  } catch {
    // The store has said what went wrong and put the course back.
  }
}

function create(): void {
  if (typed.value) void choose(typed.value.name)
}
</script>

<template>
  <UiModal
    v-model:open="open"
    size="compact"
    :title="subject ? `Move “${subject.title}” to…` : ''"
    description="Groups are yours to name: a year, a term, a subject area. A course sits in one at a time."
  >
    <ul
      v-if="groups.length || here"
      class="-mx-2 mb-3 grid max-h-[46vh] gap-0.5 overflow-y-auto"
    >
      <li
        v-for="name in groups"
        :key="name"
      >
        <button
          type="button"
          :disabled="name === here"
          class="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[12px] px-2.5 text-left text-[14.5px] font-medium text-text transition-colors outline-none hover:bg-surface-mute focus-visible:bg-surface-mute focus-visible:shadow-[inset_0_0_0_2px_var(--brand)] disabled:cursor-default disabled:hover:bg-transparent"
          @click="choose(name)"
        >
          <UiIcon
            name="layers"
            :size="17"
            class="shrink-0 text-text-faint"
          />
          <span class="min-w-0 flex-1 truncate">{{ name }}</span>
          <span
            v-if="name === here"
            class="shrink-0 text-[12.5px] font-normal text-text-faint"
          >Here now</span>
        </button>
      </li>
      <li v-if="here">
        <button
          type="button"
          class="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[12px] px-2.5 text-left text-[14.5px] font-medium text-text transition-colors outline-none hover:bg-surface-mute focus-visible:bg-surface-mute focus-visible:shadow-[inset_0_0_0_2px_var(--brand)]"
          @click="choose(null)"
        >
          <span
            class="ml-1 size-2.5 shrink-0 rounded-full"
            :style="{ background: courseColor(subject?.color) }"
          />
          <span class="min-w-0 flex-1 truncate">No group</span>
          <span class="shrink-0 text-[12.5px] font-normal text-text-faint">Back under {{ home }}</span>
        </button>
      </li>
    </ul>

    <form
      class="grid gap-2"
      @submit.prevent="create"
    >
      <label
        for="course-new-group"
        class="text-[13px] font-semibold text-text-soft"
      >
        {{ groups.length ? 'Or a new group' : 'A new group' }}
      </label>
      <div class="flex gap-2">
        <input
          id="course-new-group"
          v-model="fresh"
          type="text"
          :maxlength="60"
          placeholder="Year 2 · Autumn"
          class="h-10 min-w-0 flex-1 rounded-[12px] bg-surface-sunken px-3 text-[14px] text-text outline-none placeholder:text-text-faint focus:shadow-[inset_0_0_0_2px_var(--brand)]"
          autofocus
        >
        <UiBtn
          type="submit"
          variant="primary"
          :disabled="!typed"
          class="shrink-0"
        >
          {{ typed?.existing ? `Move to ${typed.name}` : 'Create and move' }}
        </UiBtn>
      </div>
    </form>
  </UiModal>
</template>
