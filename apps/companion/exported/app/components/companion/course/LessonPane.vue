<script setup lang="ts">
import type { BoardAnnotation, RevisionDetail } from '~/types/api'
import { useAiContext } from '~/companion/ai/state'
import { checkHref } from '~/companion/checks'

/**
 * One open lesson in a course: the old lesson view (`WorkspaceNodeView`) as
 * it is, blocks, pen and highlighter, its history, the sandbox and lesson
 * boards it opens itself, and "Comes next" at its end, plus the one thing it
 * didn't know about: the companion beside it.
 *
 * While this lesson is the tab in front it tells the AI what's on screen (its
 * title, its lesson and course ids, its topic), and hands over the text the
 * learner is looking at only when a question is actually sent. Hidden tabs
 * stay mounted (they keep their scroll and unsent answers) and step aside, so
 * only the lesson in front is ever the one being asked about.
 *
 * A lesson on a topic is set up for teach-back. Under its
 * title, one quiet line says it will be explained back at the end: knowing
 * that while reading is the active ingredient, so it has to be there from
 * the start, not only at the finish. Beside "Mark complete", "Explain it
 * back · about 4 min" opens it: the topic explained to a listener who asks
 * one question back, marked against the learner's own material. Done today
 * it is practice; done in a few days it counts as a check. Both go into
 * NodeView's `under-title` and `finish` slots. A preview of an old version
 * gets neither, since it is not the lesson being studied.
 *
 * `NodeView` resolves its content before it renders, so it needs a Suspense
 * boundary; the fallback is the lesson's shape while a new tab's first fetch
 * runs.
 */
const props = defineProps<{
  nodeId: number
  title: string
  active: boolean
  subjectId: string
  courseId: number | null
  topicId: string | null
  language?: string
  level?: string
  editable: boolean
  author: boolean
  allowsCode: boolean
  preview: RevisionDetail | null
  refreshToken: number
}>()

const emit = defineEmits<{
  changed: []
  history: [nodeId: number]
  board: [nodeId: number, board: BoardAnnotation]
  open: [nodeId: number]
  next: [nodeId: number]
  close: []
}>()

const root = ref<HTMLElement | null>(null)
const route = useRoute()

/** Teach-back on this lesson's topic; Done on the check comes back to this tab. */
const teachTo = computed(() =>
  props.topicId ? checkHref({ purpose: 'teach', topicIds: [props.topicId], from: route.fullPath }) : null,
)

/** The words on screen, a generous slice; the server trims what it can't use. */
function excerpt(): string {
  return (root.value?.innerText ?? '').replace(/\n{3,}/g, '\n\n').slice(0, 24_000)
}

useAiContext(() =>
  props.active
    ? {
        kind: 'lesson',
        label: props.title,
        subjectId: props.subjectId,
        nodeId: props.nodeId,
        courseId: props.courseId,
        topicId: props.topicId,
        excerpt,
      }
    : null,
)
</script>

<template>
  <div ref="root">
    <Suspense timeout="0">
      <WorkspaceNodeView
        :node-id="nodeId"
        :language="language"
        :level="level"
        :active="active"
        :editable="editable"
        :author="author"
        :allows-code="allowsCode"
        :preview="preview"
        :refresh-token="refreshToken"
        @changed="emit('changed')"
        @history="emit('history', $event)"
        @board="(id, board) => emit('board', id, board)"
        @open="emit('open', $event)"
        @next="emit('next', $event)"
        @close="emit('close')"
      >
        <template
          v-if="teachTo && !preview"
          #under-title
        >
          <p class="mt-2 text-[14px] text-text-muted">
            When you finish, you'll explain this back in your own words.
          </p>
        </template>
        <template
          v-if="teachTo && !preview"
          #finish
        >
          <div class="mt-4 border-t border-border pt-3.5">
            <NuxtLink
              :to="teachTo"
              class="group -mx-2 flex min-h-11 items-center gap-3 rounded-[12px] px-2 transition-colors hover:bg-surface-mute"
            >
              <span class="min-w-0 flex-1 text-[15px] font-medium text-text">
                Explain it back<span class="font-normal text-text-muted"> · about 4 min</span>
              </span>
              <CompanionIcon
                name="chevron-right"
                :size="18"
                class="shrink-0 text-text-faint transition-colors group-hover:text-text-soft"
              />
            </NuxtLink>
          </div>
        </template>
      </WorkspaceNodeView>

      <template #fallback>
        <div
          class="mx-auto max-w-[760px] px-8 py-8"
          aria-busy="true"
          aria-label="Opening the lesson"
        >
          <UiSkeleton
            w="14rem"
            h="0.7rem"
          />
          <UiSkeleton
            w="70%"
            h="1.7rem"
            class="mt-3"
          />
          <UiSkeleton
            h="1rem"
            class="mt-8"
          />
          <UiSkeleton
            w="92%"
            h="1rem"
            class="mt-2.5"
          />
          <UiSkeleton
            w="84%"
            h="1rem"
            class="mt-2.5"
          />
          <UiSkeleton
            h="14rem"
            rounded="lg"
            class="mt-8"
          />
        </div>
      </template>
    </Suspense>
  </div>
</template>
