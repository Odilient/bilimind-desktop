<script setup lang="ts">
/**
 * `/app/b/new?subject_id=&session_id=&parent_id=&template=&deadline_id=`
 * makes a board and replaces itself with it, open in Notes
 * (`/app/notes/<id>`). The board is built whole by `makeBoard` (its template
 * set out once, written to the device and the server before it opens), the
 * same way Notes' New and a note's "Whiteboard" button make one. Without a
 * course in the address it goes to My notes (the class on now is only its
 * "Add to …?" suggestion). `template=mindmap` starts it as one root, ready
 * to branch.
 *
 * On screen it's a moment: one line while the board is set out, or, if it
 * couldn't be, what went wrong in a sentence and one button to try again.
 */
import { makeBoard } from '~/companion/notes/make'

definePageMeta({ layout: 'companion' })
useHead({ title: 'New board' })

const route = useRoute()
const router = useRouter()
const failed = ref<string | null>(null)

// A dev reload can mount this twice; one board per visit.
let started = false

async function make() {
  if (started) return
  started = true
  failed.value = null
  try {
    const q = route.query
    const one = (name: string): string | null => (q[name] ? String(q[name]) : null)
    const id = await makeBoard({
      subjectId: one('subject_id') ?? undefined,
      sessionId: one('session_id'),
      parentId: one('parent_id'),
      deadlineId: one('deadline_id'),
      template: one('template'),
    })
    await router.replace({ path: `/app/notes/${id}`, query: q.demo ? { demo: String(q.demo) } : {} })
  } catch (e) {
    started = false
    failed.value = (e as Error).message || 'The board could not be made.'
  }
}

onMounted(make)
</script>

<template>
  <div class="grid flex-1 place-items-center px-6 py-24 text-center">
    <div
      v-if="failed"
      class="grid max-w-[380px] gap-3"
    >
      <h1 class="t-head text-[24px]">
        Couldn't make the board
      </h1>
      <p class="text-[15px] text-text-muted">
        {{ failed }}
      </p>
      <div>
        <UiBtn
          variant="primary"
          @click="make"
        >
          Try again
        </UiBtn>
      </div>
    </div>
    <p
      v-else
      class="text-[15px] text-text-muted"
      role="status"
    >
      Setting out the board…
    </p>
  </div>
</template>
