<script setup lang="ts">
import type { Subject } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { courseColor } from '~/companion/colors'
import {
  cleanGroupName,
  findCourses,
  groupMembers,
  groupNames,
  renameGroup,
  setGroup,
  ungroup,
} from '~/companion/shelf'

/**
 * A group, made or changed in one go: its name and the courses in it, ticked
 * from the whole shelf. "New group" on the Courses page opens it empty;
 * "Choose courses…" in a group's "⋯" opens it on that group. Moving courses
 * one at a time from their own menus is the other way, and suits one course;
 * this suits sorting a term's worth.
 *
 * Each course shows the group it's in now, so ticking it reads as the move it
 * is. A long shelf gets a filter. A group is the courses in it, so a new one
 * needs at least one; unticking every course of an existing group and saving
 * ungroups them all, which the button then says.
 */
const props = defineProps<{
  /** The group being changed, or null for a new one. */
  group: string | null
}>()

const open = defineModel<boolean>('open', { default: false })

const c = useCompanion()
const toast = useToast()

const name = ref('')
const picked = ref<Set<string>>(new Set())
const query = ref('')
const saving = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = props.group ?? ''
  query.value = ''
  picked.value = new Set(
    props.group ? groupMembers(c, props.group).filter((s) => !s.archived_at).map((s) => s.id) : [],
  )
})

const courses = computed<Subject[]>(() =>
  query.value.trim() ? findCourses(c, query.value).filter((s) => !s.archived_at) : c.shelf.value,
)

function toggle(id: string): void {
  const next = new Set(picked.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  picked.value = next
}

const clean = computed(() => cleanGroupName(name.value))
/** Another group this name is already, whatever the case: saving joins them. */
const joins = computed(
  () =>
    groupNames(c).find((g) => g !== props.group && g.toLocaleLowerCase() === clean.value.toLocaleLowerCase()) ??
    null,
)

const ready = computed(() => Boolean(clean.value) && (props.group !== null || picked.value.size > 0))

const label = computed(() => {
  if (props.group === null) return picked.value.size ? `Make group of ${picked.value.size}` : 'Make group'
  if (!picked.value.size) return 'Ungroup them all'
  return joins.value ? `Join ${joins.value}` : 'Save'
})

async function save(): Promise<void> {
  if (!ready.value || saving.value) return
  saving.value = true
  try {
    const chosen = c.shelf.value.filter((s) => picked.value.has(s.id))
    let final: string | null
    if (props.group === null) {
      final = await setGroup(c, chosen, clean.value)
    } else if (!chosen.length) {
      await ungroup(c, props.group)
      final = null
    } else {
      // Out first, so a course leaving isn't renamed on its way out.
      const leaving = groupMembers(c, props.group).filter((s) => !s.archived_at && !picked.value.has(s.id))
      await setGroup(c, leaving, null)
      final = await setGroup(c, chosen, await renameGroup(c, props.group, clean.value))
    }
    open.value = false
    if (props.group === null && final) {
      toast.success({
        title: `Made ${final}`,
        body: `${chosen.length === 1 ? 'One course' : `${chosen.length} courses`} in it.`,
      })
    }
  } catch {
    // The store has said what went wrong and put the rows back.
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UiModal
    v-model:open="open"
    size="compact"
    :title="group === null ? 'New group' : `Courses in ${group}`"
    :description="group === null ? 'A year, a term, a subject area: whatever you want to find them by. Then tick what goes in it.' : undefined"
  >
    <form
      class="grid gap-4"
      @submit.prevent="save"
    >
      <div class="grid gap-1.5">
        <label
          for="course-group-name"
          class="text-[13px] font-semibold text-text-soft"
        >Name</label>
        <input
          id="course-group-name"
          v-model="name"
          type="text"
          :maxlength="60"
          placeholder="Year 2 · Autumn"
          class="h-10 rounded-[12px] bg-surface-sunken px-3 text-[14.5px] text-text outline-none placeholder:text-text-faint focus:shadow-[inset_0_0_0_2px_var(--cobalt)]"
          :autofocus="group === null"
        >
        <p
          v-if="joins"
          class="text-[12.5px] text-text-muted"
        >
          There's a group called {{ joins }} already; these courses join it.
        </p>
      </div>

      <div class="grid gap-1.5">
        <div class="flex items-baseline justify-between gap-3">
          <span class="text-[13px] font-semibold text-text-soft">Courses</span>
          <span class="num text-[12.5px] text-text-faint">{{ picked.size }} ticked</span>
        </div>
        <label
          v-if="c.shelf.value.length > 8"
          class="flex h-9 items-center gap-2 rounded-[10px] bg-surface px-2.5 text-text-faint shadow-[inset_0_0_0_1px_var(--border)] focus-within:shadow-[inset_0_0_0_1.5px_var(--cobalt)]"
        >
          <UiIcon
            name="search"
            :size="14"
            class="shrink-0"
          />
          <input
            v-model="query"
            type="search"
            placeholder="Find a course"
            aria-label="Find a course"
            class="min-w-0 flex-1 bg-transparent text-[13.5px] text-text outline-none placeholder:text-text-faint [&::-webkit-search-cancel-button]:hidden"
            @keydown.enter.prevent
          >
        </label>
        <ul class="-mx-2 grid max-h-[40vh] gap-0.5 overflow-y-auto">
          <li
            v-for="s in courses"
            :key="s.id"
          >
            <label class="flex min-h-10 cursor-pointer items-center gap-3 rounded-[12px] px-2.5 transition-colors hover:bg-surface-mute has-[:focus-visible]:shadow-[inset_0_0_0_2px_var(--cobalt)]">
              <input
                type="checkbox"
                :checked="picked.has(s.id)"
                class="size-4 shrink-0 cursor-pointer accent-[var(--cobalt)]"
                @change="toggle(s.id)"
              >
              <span
                class="size-2.5 shrink-0 rounded-full"
                :style="{ background: courseColor(s.color) }"
                aria-hidden="true"
              />
              <span class="min-w-0 flex-1 truncate text-[14px] font-medium text-text">{{ s.title }}</span>
              <span
                v-if="s.group_name && s.group_name !== group"
                class="max-w-[40%] shrink-0 truncate text-[12.5px] text-text-faint"
              >{{ s.group_name }}</span>
            </label>
          </li>
          <li
            v-if="!courses.length"
            class="px-2.5 py-3 text-[14px] text-text-muted"
          >
            No course by that name.
          </li>
        </ul>
      </div>
    </form>
    <template #footer>
      <UiBtn
        variant="ghost"
        @click="open = false"
      >
        Cancel
      </UiBtn>
      <UiBtn
        variant="primary"
        :disabled="!ready"
        :loading="saving"
        @click="save"
      >
        {{ label }}
      </UiBtn>
    </template>
  </UiModal>
</template>
