import type { Block, PlaygroundPayload, WorkedExamplePayload } from '~/types/api'

/**
 * The assistant conversation, wired to `POST /assistant/chat`.
 *
 * A turn carries the message plus whatever the learner is looking at — the
 * course, the open lesson, and any block they pointed at — so the answer is
 * grounded in the page rather than in a vacuum. The reply may bring back a
 * made-for-you artifact (a rendered page, a PDF, a note); that rides along on
 * the assistant's message so the thread can offer to open it.
 */

export type AssistantScope = 'node' | 'course' | 'materials'

/** A made-for-you result the assistant produced alongside its answer. */
export interface AssistantArtifactRef {
  id: number
  kind: 'html' | 'pdf' | 'markdown'
  title: string
  url?: string
}

export interface AssistantMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
  /** Present when this reply produced something to open. */
  artifact?: AssistantArtifactRef
}

export interface AssistantOpener {
  q: string
  /** Block this opener came from, so the answer can be grounded in it. */
  blockId?: number
}

interface AssistantReply {
  message: string
  conversation_id?: number | string | null
  artifact?: AssistantArtifactRef | null
}

const SCOPE_LABEL: Record<AssistantScope, string> = {
  node: 'this lesson',
  course: 'the whole course',
  materials: 'your materials',
}

export function scopeLabel(scope: AssistantScope): string {
  return SCOPE_LABEL[scope]
}

/**
 * Openers derived from what is actually on screen. The brief asks for
 * "a small set of concrete openers ... derived from the current node rather
 * than generic", and the block payloads are the only honest source for that —
 * a question about step 4 of a worked example is only useful if step 4 exists.
 */
export function deriveOpeners(blocks: Block[], nodeTitle: string): AssistantOpener[] {
  const openers: AssistantOpener[] = []

  for (const block of blocks) {
    if (openers.length >= 4) break

    switch (block.type) {
      case 'analogy':
        openers.push({ q: 'Where exactly does this analogy stop working?', blockId: block.id })
        break

      case 'worked_example': {
        const steps = (block.payload as WorkedExamplePayload)?.steps ?? []
        if (steps.length > 1) {
          const n = Math.min(steps.length, Math.ceil(steps.length / 2) + 1)
          openers.push({ q: `Walk me through step ${n} of the worked example`, blockId: block.id })
        }
        break
      }

      case 'playground': {
        const input = (block.payload as PlaygroundPayload)?.inputs?.[0]
        if (input) {
          openers.push({ q: `What actually happens when I raise ${input.label}?`, blockId: block.id })
        }
        break
      }

      case 'code':
        openers.push({ q: "I'm stuck on the code exercise — give me a hint, not the answer", blockId: block.id })
        break

      case 'diagram':
        openers.push({ q: 'Talk me through this diagram one arrow at a time', blockId: block.id })
        break

      case 'comparison':
        openers.push({ q: 'Which of these would you actually pick, and why?', blockId: block.id })
        break

      case 'scenario':
        openers.push({ q: 'I picked wrong in the scenario — what was I missing?', blockId: block.id })
        break
    }
  }

  // Always leave one way in that does not depend on any particular block.
  if (openers.length < 4) {
    openers.push({ q: `Explain “${nodeTitle}” to me like I have five minutes` })
  }

  return openers.slice(0, 4)
}

export function useAssistant(
  courseId: MaybeRefOrGetter<number>,
  nodeId: MaybeRefOrGetter<number | null>,
) {
  const api = useApi()

  const scope = ref<AssistantScope>('node')
  const messages = ref<AssistantMessage[]>([])
  const draft = ref('')
  const busy = ref(false)
  /** Set when the endpoint is missing, so the panel can say so once. */
  const unavailable = ref(false)
  /** The server thread this conversation belongs to, so turns stay connected. */
  const conversationId = ref<number | string | null>(null)

  const empty = computed(() => messages.value.length === 0)

  let sequence = 0

  /** A block the learner pointed at, carried with the next question. */
  const pinnedBlockId = ref<number | null>(null)

  function pin(blockId: number | null): void {
    pinnedBlockId.value = blockId
  }

  async function send(text?: string): Promise<void> {
    const question = (text ?? draft.value).trim()
    if (question === '' || busy.value) return

    messages.value = [...messages.value, { id: ++sequence, role: 'user', text: question }]
    draft.value = ''
    busy.value = true

    try {
      const response = await api.post<AssistantReply>('/assistant/chat', {
        message: question,
        course_id: toValue(courseId),
        node_id: scope.value === 'node' ? toValue(nodeId) : null,
        block_id: pinnedBlockId.value,
        conversation_id: conversationId.value,
      })

      if (response.conversation_id != null) conversationId.value = response.conversation_id

      messages.value = [
        ...messages.value,
        {
          id: ++sequence,
          role: 'assistant',
          text: response.message,
          artifact: response.artifact ?? undefined,
        },
      ]
      pinnedBlockId.value = null
    } catch (error) {
      const status = (error as { status?: number })?.status

      if (status === 404 || status === 405 || status === 501) {
        unavailable.value = true
        messages.value = [
          ...messages.value,
          {
            id: ++sequence,
            role: 'assistant',
            text: 'The assistant is not wired up on this server yet, so I cannot answer that. Everything else on this page works.',
          },
        ]
      } else {
        messages.value = [
          ...messages.value,
          {
            id: ++sequence,
            role: 'assistant',
            text: error instanceof Error ? error.message : 'That question did not go through.',
          },
        ]
      }
    } finally {
      busy.value = false
    }
  }

  function reset(): void {
    messages.value = []
    pinnedBlockId.value = null
    conversationId.value = null
    unavailable.value = false
  }

  return {
    scope,
    messages,
    draft,
    busy,
    empty,
    unavailable,
    conversationId,
    pinnedBlockId,
    pin,
    send,
    reset,
  }
}
