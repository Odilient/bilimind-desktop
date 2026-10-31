<script setup lang="ts">
/**
 * The composer's Moodle button, once Moodle is connected: pick one of the
 * courses it brought in, and its outline (weeks, topics, deadlines, file
 * names) goes into the new course's material. Typical use: "exam prep for
 * Databases" built from the Databases course on Moodle. The Moodle course
 * itself is left as it is, files and all.
 *
 * Nothing connected yet, the button opens the connect flow instead (the
 * page decides), so this list is never empty for want of a connection.
 */
import type { Subject } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { courseColor } from '~/companion/colors'

const props = defineProps<{ picked: string[] }>()
const emit = defineEmits<{ pick: [subject: Subject]; connect: [] }>()
const open = defineModel<boolean>('open', { default: false })

const c = useCompanion()

const courses = computed(() => c.subjects.value.filter((s) => s.source === 'moodle'))

function detail(s: Subject): string {
  const files = c.items.value.filter((i) => i.subject_id === s.id && i.kind === 'file').length
  return [s.code, s.lecturer, files ? `${files} files` : ''].filter(Boolean).join(' · ')
}

function pick(s: Subject): void {
  if (props.picked.includes(s.id)) return
  emit('pick', s)
  open.value = false
}
</script>

<template>
  <UiModal
    v-model:open="open"
    title="Build from a Moodle course"
    description="BiliMind reads its weeks, topics and deadlines. The course on Moodle stays as it is."
    size="md"
  >
    <ul
      v-if="courses.length"
      class="-mx-2 grid gap-0.5"
      aria-label="Your Moodle courses"
    >
      <li
        v-for="s in courses"
        :key="s.id"
      >
        <button
          type="button"
          class="group flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[12px] px-2 py-2.5 text-left transition-colors duration-150 outline-none hover:bg-surface-mute focus-visible:ring-2 focus-visible:ring-brand-line disabled:cursor-default disabled:hover:bg-transparent"
          :disabled="picked.includes(s.id)"
          @click="pick(s)"
        >
          <span
            class="size-2.5 shrink-0 rounded-full"
            :style="{ background: courseColor(s.color) }"
          />
          <span class="grid min-w-0 flex-1 gap-0.5">
            <span class="truncate text-[15px] font-semibold text-text">{{ s.title }}</span>
            <span
              v-if="detail(s)"
              class="truncate text-[13px] text-text-muted"
            >{{ detail(s) }}</span>
          </span>
          <span
            v-if="picked.includes(s.id)"
            class="inline-flex items-center gap-1 text-[13px] font-semibold text-success-text"
          >
            <UiIcon
              name="check"
              :size="14"
            />
            Added
          </span>
          <span
            v-else
            class="text-[13px] font-semibold text-cobalt opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 max-[899px]:opacity-100"
          >Add</span>
        </button>
      </li>
    </ul>
    <p
      v-else
      class="text-[15px] text-text-body"
    >
      Moodle is connected, but no courses have come in yet. Sync it and they will.
    </p>
    <template #footer>
      <UiBtn
        variant="ghost"
        class="mr-auto"
        @click="emit('connect')"
      >
        Sync Moodle or add another
      </UiBtn>
      <UiBtn
        variant="secondary"
        @click="open = false"
      >
        Close
      </UiBtn>
    </template>
  </UiModal>
</template>
