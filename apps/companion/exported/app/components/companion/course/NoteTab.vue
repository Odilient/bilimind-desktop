<script setup lang="ts">
import type { Item } from '~/companion/types'
import { usePagesRepo } from '~/companion/doc/repo'
import { findItem } from '~/companion/doc/context'
import { useDoc } from '~/companion/doc/useDoc'
import { useAiContext } from '~/companion/ai/state'
import { registerLiveDoc } from '~/companion/notes/actions'
import { useCompanion } from '~/companion/store'
import '~/components/page/page.css'
const { t } = useI18n()

/**
 * A note, open: the one code path for a page in Notes (`/app/notes/<id>`) and
 * for a note's tab in the course workspace. It finds the item and its
 * document, then hands both to `PageWorkspace`, which reads where the note
 * lives from the store and lays it out. The document is the note's own Y.Doc
 * (text, ink and labels alike), loaded from the server and from this device's
 * copy, so a note opened once opens again without a connection. While it
 * loads, the shapes of the note stand in for it; one that isn't there, or
 * didn't load, says so in a sentence with one button.
 *
 * `embedded` (the default: this is a tab) fills whatever box it is put in and
 * scrolls on its own; the course workspace's tab already names the note, so
 * the path and the browser title are left to Notes. Links out of the note (a
 * sub-page, a whiteboard) come back as `open` for the workspace to open
 * beside it; in Notes the page follows them itself. An id that turns out to
 * be a board is shown as the board it is, either way.
 *
 * `active` (default true): a tab hidden behind another stays mounted, and
 * only the one in front tells the companion what's on screen. What it hands
 * over is the page's title and, when a question is sent, its text as read
 * off the page.
 */
const props = withDefaults(defineProps<{ itemId: string; embedded?: boolean; active?: boolean }>(), {
  embedded: true,
  active: true,
})
const emit = defineEmits<{ open: [item: { id: string; kind: 'page' | 'board' }] }>()

const repo = usePagesRepo()
const store = useCompanion()

const page = ref<Item | null>(null)
const state = ref<'loading' | 'ready' | 'board' | 'missing' | 'error'>('loading')
const root = ref<HTMLElement | null>(null)

async function load(): Promise<void> {
  state.value = 'loading'
  try {
    const item = await findItem(repo, props.itemId)
    if (!item || item.deleted_at) {
      state.value = 'missing'
      return
    }
    if (item.kind === 'board') {
      // A board's id in a note's place: shown as the board it is.
      state.value = 'board'
      return
    }
    page.value = item
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}

onMounted(() => {
  watch(() => props.itemId, () => void load(), { immediate: true })
})

const { ydoc, status, reachedServer } = useDoc(
  () => (state.value === 'ready' ? props.itemId : null),
  repo,
)

// The open doc, so renaming the page from Notes' sidebar lands in the editor.
watch(ydoc, (doc, _, onCleanup) => {
  if (doc) onCleanup(registerLiveDoc(props.itemId, doc))
})

/** The row as the store has it now (renamed elsewhere), else as it was found. */
const live = computed(() => store.get('items', props.itemId) ?? page.value)

useAiContext(() =>
  props.active && state.value === 'ready' && live.value
    ? {
        kind: 'page',
        label: live.value.title || t('course.tab.untitledPage'),
        itemId: props.itemId,
        subjectId: live.value.subject_id,
        topicId: live.value.topic_id,
        excerpt: () => {
          const prose = root.value?.querySelector<HTMLElement>('.ProseMirror')
          const body = prose?.innerText ?? live.value?.preview ?? ''
          return `${live.value?.title ?? ''}\n\n${body}`.trim()
        },
      }
    : null,
)

if (!props.embedded) {
  useHead({ title: computed(() => (live.value?.title ? `${live.value.title} · BiliMind` : t('course.tab.pageHead'))) })
}
</script>

<template>
  <div
    ref="root"
    class="pg-route"
    :class="{ 'is-embedded': embedded }"
  >
    <ClientOnly>
      <PageWorkspace
        v-if="state === 'ready' && page && ydoc"
        :key="page.id"
        :page="page"
        :ydoc="ydoc"
        :status="status"
        :reached-server="reachedServer"
        :embedded="embedded"
        @open="emit('open', $event)"
      />
      <CompanionCourseBoardTab
        v-else-if="state === 'board'"
        :item-id="itemId"
        :embedded="embedded"
        :active="active"
        @open="emit('open', $event)"
      />
      <div
        v-else-if="state === 'missing'"
        class="pg-route-empty"
      >
        <h1 class="t-head">
          {{ t('course.tab.noPage') }}
        </h1>
        <p>{{ t('course.tab.noPageBody') }}</p>
        <UiBtn
          v-if="!embedded"
          variant="primary"
          to="/app/notes"
        >
          {{ t('course.tab.back') }}
        </UiBtn>
      </div>
      <div
        v-else-if="state === 'error'"
        class="pg-route-empty"
      >
        <h1 class="t-head">
          {{ t('course.tab.pageErr') }}
        </h1>
        <p>{{ t('course.tab.pageErrBody') }}</p>
        <UiBtn
          variant="primary"
          @click="load"
        >
          {{ t('course.tab.retry') }}
        </UiBtn>
      </div>
      <div
        v-else
        class="pg-route-skeleton"
        aria-busy="true"
        :aria-label="t('course.tab.openingPage')"
      >
        <span class="pg-skel is-crumbs" />
        <span class="pg-skel is-title" />
        <span class="pg-skel is-props" />
        <span class="pg-skel" />
        <span class="pg-skel is-short" />
        <span class="pg-skel" />
      </div>
    </ClientOnly>
  </div>
</template>
