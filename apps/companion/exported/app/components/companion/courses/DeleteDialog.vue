<script setup lang="ts">
import type { Subject } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { closeCompanionTab } from '~/companion/tabs'
import { deleteCourse } from '~/companion/course-home'

/**
 * "Delete course…": what goes with the course and what stays, said before
 * anything happens. Its path or weeks, deadlines and flashcards go (and the
 * school's files, for a school course); the learner's own notes, boards and
 * uploads move to My notes first, and the dialog counts them. A card and a
 * list row open the same one, so the promise reads the same from both.
 *
 * Archive is the gentler way to get a course out of sight; this is for a
 * course the learner never wants back.
 */
const props = defineProps<{
  subject: Subject
}>()

const open = defineModel<boolean>('open', { default: false })

const c = useCompanion()
const toast = useToast()

const isPath = computed(() => props.subject.format === 'path')
const deleting = ref(false)

/** The learner's own things in this course: they move to My notes, and the dialog says how many. */
const ownCount = computed(
  () =>
    c.items.value.filter(
      (i) => i.subject_id === props.subject.id && ['made', 'share', 'email', 'import'].includes(i.source),
    ).length,
)

async function remove(): Promise<void> {
  if (deleting.value) return
  deleting.value = true
  const title = props.subject.title
  try {
    const kept = await deleteCourse(c, props.subject)
    closeCompanionTab(`course:${props.subject.id}`)
    open.value = false
    toast.success({
      title: `Deleted ${title}`,
      body: kept ? `${kept === 1 ? 'One note' : `${kept} notes`} moved to My notes.` : undefined,
      duration: 5200,
    })
  } catch {
    toast.error({ title: `Couldn't delete ${title}`, body: 'Check the connection and try again.' })
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <UiModal
    v-model:open="open"
    :title="`Delete ${subject.title}?`"
    size="compact"
  >
    <div class="grid gap-3 text-[14.5px] leading-relaxed text-text-body">
      <p>
        Its {{ isPath ? 'path, lessons' : 'weeks, topics' }}, deadlines and flashcards go with it<template v-if="!isPath">, and so do the school's files</template>.
      </p>
      <p v-if="ownCount">
        Your own {{ ownCount === 1 ? 'note stays' : `${ownCount} notes, whiteboards and uploads stay` }}: {{ ownCount === 1 ? 'it moves' : 'they move' }} to My notes.
      </p>
      <p
        v-if="subject.source === 'moodle'"
        class="text-text-muted"
      >
        The course itself stays in Moodle.
      </p>
      <p
        v-if="!subject.archived_at"
        class="text-text-muted"
      >
        To only put it out of the way, archive it instead: it keeps everything and comes back with one click.
      </p>
    </div>
    <template #footer>
      <UiBtn
        variant="ghost"
        @click="open = false"
      >
        Keep it
      </UiBtn>
      <UiBtn
        variant="danger"
        icon="trash"
        :loading="deleting"
        @click="remove"
      >
        Delete course
      </UiBtn>
    </template>
  </UiModal>
</template>
