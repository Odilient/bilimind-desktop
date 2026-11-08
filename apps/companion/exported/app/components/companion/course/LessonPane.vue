<script setup lang="ts">
import type { BoardAnnotation, RevisionDetail } from '~/types/api'
import { useAiContext } from '~/companion/ai/state'
import { checkHref } from '~/companion/checks'
const { t } = useI18n()

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
 * gets neither, since it is not the lesson being studied. The links on the
 * lesson's topic sit with its
 * files at the end, only once there is one; "A link" is under the strip's
 * paperclip beside "A file".
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
  /** Open straight into writing it by hand (NodeView's `compose`). */
  compose?: boolean
}>()

const emit = defineEmits<{
  changed: []
  history: [nodeId: number]
  board: [nodeId: number, board: BoardAnnotation]
  open: [nodeId: number]
  next: [nodeId: number]
  close: []
  composed: []
}>()

const root = ref<HTMLElement | null>(null)
const route = useRoute()

/** Teach-back on this lesson's topic; Done on the check comes back to this tab. */
const teachTo = computed(() =>
  props.topicId ? checkHref({ purpose: 'teach', topicIds: [props.topicId], from: route.fullPath }) : null,
)

/** "A link" under the lesson strip's paperclip, opening the links' field at the end. */
const links = ref<{ open: () => void } | null>(null)
const attachActions = computed(() =>
  props.topicId ? [{ label: t('course.lesson.attachLink'), icon: 'link', run: () => links.value?.open() }] : [],
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
        :compose="compose"
        :attach-actions="attachActions"
        @composed="emit('composed')"
        @changed="emit('changed')"
        @history="emit('history', $event)"
        @board="(id, board) => emit('board', id, board)"
        @open="emit('open', $event)"
        @next="emit('next', $event)"
        @close="emit('close')"
      >
        <!-- Text size, typeface, background and width, as the old lesson page had. -->
        <template #strip>
          <ReadingSettings
            size="md"
            class="shrink-0"
          />
        </template>
        <template
          v-if="teachTo && !preview"
          #under-title
        >
          <p class="mt-2 text-[14px] text-text-muted">
            {{ t('course.lesson.explainNote') }}
          </p>
        </template>
        <!-- Beside "Mark complete": the other way to finish, explaining it back. -->
        <template
          v-if="teachTo && !preview"
          #finish
        >
          <UiBtn
            :to="teachTo"
            variant="secondary"
            size="md"
          >
            {{ t('course.lesson.explain') }}<span class="font-normal text-text-muted">{{ t('course.lesson.about') }}</span>
          </UiBtn>
        </template>
        <!-- Imports and links: "this lesson has something on Canva", on its topic.
             Drawn only once there is one; the strip's paperclip adds it. -->
        <template
          v-if="topicId"
          #attached
        >
          <CompanionLinksAttached
            ref="links"
            :on="{ topicId }"
            :subject-id="subjectId"
            quiet
          />
        </template>
      </WorkspaceNodeView>

      <template #fallback>
        <div
          class="mx-auto max-w-[var(--reading-measure,960px)] px-8 py-8"
          aria-busy="true"
          :aria-label="t('course.lesson.opening')"
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
