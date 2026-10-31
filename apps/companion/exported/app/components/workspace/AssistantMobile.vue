<script setup lang="ts">
/**
 * The assistant as a full mobile tab rather than a panel — there is no room to
 * dock or float anything at 390px, so it simply becomes one of the five places
 * you can be.
 */
const props = defineProps<{
  courseId: number
  nodeId: number | null
  nodeTitle: string
}>()

const assistant = useAssistant(
  () => props.courseId,
  () => props.nodeId,
)

const artifacts = useArtifacts()

/**
 * A phone has no room for a side-by-side artifact panel, so a made-for-you
 * result opens full-screen in its own tab rather than fighting the lesson for
 * the column.
 */
function openArtifact(artifact: { id: number; url?: string }): void {
  if (!import.meta.client) return
  window.open(artifact.url ?? artifacts.rawUrl(artifact.id), '_blank', 'noopener')
}

const { scope, messages, draft, busy, empty, pinnedBlockId } = assistant

const body = ref<{ scrollToEnd: () => void } | null>(null)

/**
 * No blocks are loaded on this tab (the node lives on another one), so the
 * openers fall back to the generic entry point rather than pretending to know
 * what is on the page.
 */
const openers = computed(() => deriveOpeners([], props.nodeTitle))

function send(text?: string): void {
  void assistant.send(text).then(() => body.value?.scrollToEnd())
  body.value?.scrollToEnd()
}

watch(
  () => props.nodeId,
  () => assistant.reset(),
)
</script>

<template>
  <WorkspaceAssistantBody
    ref="body"
    v-model:scope="scope"
    v-model:draft="draft"
    :messages="messages"
    :openers="openers"
    :busy="busy"
    :empty="empty"
    :pinned-block-id="pinnedBlockId"
    @send="send"
    @unpin="assistant.pin(null)"
    @open-artifact="openArtifact"
  />
</template>
