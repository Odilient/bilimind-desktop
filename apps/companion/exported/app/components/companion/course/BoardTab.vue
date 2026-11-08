<script setup lang="ts">
/**
 * A board, open: the one code path for a board in Notes (`/app/notes/<id>`)
 * and for a board's tab in the course workspace. It finds the item and its
 * course, opens the board's Y.Doc (this device's copy first, then the
 * server's), and hands them to `BoardCanvas`. A board opened once opens again
 * without a connection: its doc, title and course colour all live in the doc
 * itself. A board that isn't there says so in a sentence.
 *
 * `embedded` (the default: this is a tab) fills whatever box it is put in,
 * even on a phone, and leaves the way back and the browser title to its
 * workspace; a note opened from the board comes back as `open` for the
 * workspace to open beside it. Not embedded, it is Notes' doc view: Notes'
 * 48px bar on top (the path, its name, saved, "…", Ask) and the board under
 * it without its own name pill, filling the rest, on a phone too.
 *
 * Where it's filed is the row's to say: moved to another course (or to My
 * notes) in Notes, the board's doc follows the next time it opens, so its
 * colour and its templates' context follow too.
 *
 * `active` (default true): a tab hidden behind another stays mounted, and
 * only the one in front tells the companion what's on screen.
 */
import type { BoardSync } from '~/companion/board/persistence'
import { openBoard } from '~/companion/board/persistence'
import { createLocalPresence, type BoardPresence } from '~/companion/board/presence'
import { readMeta, writeMeta, type BoardMeta } from '~/companion/board/model'
import { boardContext } from '~/companion/board/context'
import * as Y from 'yjs'
import { boardPreview } from '~/companion/board/ops'
import { buildStarter } from '~/companion/board/templates'
import { courseHex } from '~/companion/board/palette'
import { useAiContext } from '~/companion/ai/state'
import { noteTo } from '~/companion/notes/actions'
import { imageSource } from '~/companion/board/image'
import { useCompanion } from '~/companion/store'
import { openCompanionTab, renameCompanionTab } from '~/companion/tabs'
import type { Item } from '~/companion/types'
const { t } = useI18n()

const props = withDefaults(defineProps<{ itemId: string; embedded?: boolean; active?: boolean }>(), {
  embedded: true,
  active: true,
})
const emit = defineEmits<{ open: [item: { id: string; kind: 'page' | 'board' }] }>()

const store = useCompanion()
const id = computed(() => props.itemId)
/** The board whose doc is open right now; it lags `id` while the next one opens. */
const openId = ref<string | null>(null)
const sync = shallowRef<BoardSync | null>(null)
const presence = shallowRef<BoardPresence | null>(null)
const meta = ref<BoardMeta>({})
const missing = ref(false)
const canvas = ref<{ ctl: { contentBounds(): { x: number; y: number; w: number; h: number } | null } | null } | null>(null)

const item = computed(() => store.get('items', id.value))
// The row says where it's filed (null is My notes); the doc's copy is for
// before the rows have loaded, or offline.
const subjectId = computed(() => (item.value ? item.value.subject_id : (meta.value.subject_id ?? null)))
const subject = computed(() => (subjectId.value ? store.get('subjects', subjectId.value) : null))
const title = computed(() => item.value?.title || meta.value.title || t('course.tab.untitledBoard'))
const me = computed(() => store.userName.value || t('course.tab.you'))
const deadlineId = computed(() => meta.value.deadline_id ?? (item.value?.meta.props?.deadline_id as string | undefined) ?? null)

if (!props.embedded) useHead({ title: computed(() => `${title.value} · BiliMind`) })

/* What the companion sees: this board, read as its words (stickies, labels,
   the mind map's branches) only when a question is sent. */
useAiContext(() =>
  props.active && !missing.value
    ? {
        kind: 'board',
        label: title.value,
        itemId: id.value,
        subjectId: subjectId.value,
        excerpt: () => (sync.value ? boardPreview(sync.value.parts, 8000) : (item.value?.preview ?? '')),
      }
    : null,
)

/** This course's pages first, then My notes and the rest. */
const pages = computed<Item[]>(() => {
  const all = store.items.value.filter((i) => i.kind === 'page')
  return [...all.filter((i) => i.subject_id === subjectId.value), ...all.filter((i) => i.subject_id !== subjectId.value)]
})

const context = () => boardContext(store, subjectId.value, deadlineId.value)

let tabKey = ''
let lastPreview = ''
let previewTimer: ReturnType<typeof setInterval> | null = null
let stopMeta: (() => void) | null = null
let generation = 0

function savePreview() {
  const s = sync.value
  const at = openId.value
  const row = at ? store.get('items', at) : null
  if (!s || !row) return
  const text = boardPreview(s.parts)
  if (text && text !== lastPreview && text !== row.preview) {
    lastPreview = text
    void store.upsert<Item>('items', { id: row.id, preview: text })
  }
}

function close() {
  if (previewTimer) clearInterval(previewTimer)
  previewTimer = null
  savePreview()
  stopMeta?.()
  stopMeta = null
  presence.value?.destroy()
  presence.value = null
  sync.value?.destroy()
  sync.value = null
  openId.value = null
  missing.value = false
  meta.value = {}
  lastPreview = ''
}

async function open(boardId: string) {
  const mine = ++generation
  close()
  if (!boardId) return
  const s = openBoard(boardId, store.repo())
  await s.local
  if (mine !== generation) return s.destroy()
  const readMetaNow = () => (meta.value = readMeta(s.parts))
  readMetaNow()
  s.parts.meta.observe(readMetaNow)
  stopMeta = () => s.parts.meta.unobserve(readMetaNow)
  presence.value = createLocalPresence({ id: 'me', name: me.value, color: '#2340e6' })
  openId.value = boardId
  sync.value = s
  await s.ready
  await store.load()
  if (mine !== generation) return
  if (s.complete.value) setOut(s)
  // A short load (offline, or a board this device never synced) proves
  // nothing: the board opens and takes ink, and is set out, if it still needs
  // it, on the first complete load.
  else void s.whenComplete.then(() => {
    if (sync.value === s) setOut(s)
  })
  previewTimer = setInterval(savePreview, 10_000)
}

onMounted(() => {
  watch(id, (next) => void open(next), { immediate: true })
})

onBeforeUnmount(() => {
  generation += 1
  close()
})

/* The desktop tab strip shows this board, under its current name; a tab in
   the course workspace is already one, so it doesn't add a second. */
function registerTab() {
  if (props.embedded || !sync.value || missing.value) return
  tabKey = openCompanionTab({ kind: 'board', id: id.value, title: title.value, to: noteTo(id.value), color: subject.value?.color ?? null })
  renameCompanionTab(tabKey, title.value)
}

watch([title, subject, sync], registerTab)

/**
 * The doc follows its row when the board was moved to another course (or to
 * My notes): the colour it falls back to, and its templates' context. Only
 * on a move: the colour is read off the theme, so comparing it would rewrite
 * the doc every time a dark-mode device opened it.
 */
watch([sync, () => item.value?.subject_id, subject], () => {
  const s = sync.value
  const row = item.value
  if (!s || !row || (row.subject_id && !subject.value)) return
  if ((readMeta(s.parts).subject_id ?? null) === row.subject_id) return
  writeMeta(s.parts, { subject_id: row.subject_id, color: courseHex(subject.value?.color) })
})

/**
 * The first time a board is opened with the server's whole copy in hand: if
 * neither the server nor this device has anything on it, it's either unknown
 * (no item either) or an item never opened, which gets its template once.
 */
function setOut(s: BoardSync) {
  const untouched = !s.parts.objects.size && !s.parts.strokes.length && !readMeta(s.parts).title
  if (!untouched) return
  if (!item.value) missing.value = true
  else Y.applyUpdate(s.doc, Y.encodeStateAsUpdate(buildStarter(item.value, context())))
}

function rename(t: string) {
  if (sync.value) writeMeta(sync.value.parts, { title: t })
  if (item.value) void store.upsert<Item>('items', { id: id.value, title: t })
}

function openPage(pageId: string) {
  if (props.embedded) emit('open', { id: pageId, kind: 'page' })
  else void navigateTo(noteTo(pageId))
}

async function upload(file: File, done: (src: string | null, itemId?: string) => void) {
  let uploaded: Item | null = null
  try {
    uploaded = await store.repo().upload(file, { subject_id: subjectId.value ?? undefined })
  } catch {
    // Offline: the image still goes on the board from this device's copy.
  }
  try {
    done(await imageSource(file, uploaded), uploaded?.id)
  } catch {
    done(null)
  }
}
</script>

<template>
  <div
    class="relative flex min-h-0 flex-1 flex-col"
    :class="{ 'h-full': embedded }"
  >
    <CompanionNotesDocHeader
      v-if="!embedded && item && !missing"
      :item="item"
      :title="title"
      :status="sync?.state.value ?? 'loading'"
      @rename="rename"
    />
    <div
      v-if="missing"
      class="mx-auto grid max-w-[420px] content-center gap-3 px-6 py-24 text-center"
    >
      <h1 class="t-head text-[28px]">
        {{ t('course.tab.noBoard') }}
      </h1>
      <p class="text-[15px] text-text-muted">
        {{ t('course.tab.noBoardBody') }}
      </p>
      <div v-if="!embedded">
        <UiBtn
          variant="primary"
          to="/app/notes"
        >
          {{ t('course.tab.back') }}
        </UiBtn>
      </div>
    </div>
    <div
      v-else
      class="relative flex min-h-0 flex-1 flex-col"
    >
      <BoardCanvas
        v-if="sync && presence && openId"
        ref="canvas"
        :key="openId"
        :sync="sync"
        :item-id="openId"
        :title="title"
        :subject="subject ? { id: subject.id, title: subject.title, color: subject.color } : null"
        :fallback-color="meta.color ?? null"
        :me="me"
        :presence="presence"
        :context="context"
        :pages="pages"
        embedded
        :bare="!embedded"
        @rename="rename"
        @upload="upload"
        @open-page="openPage"
      />
      <div
        v-else
        class="absolute inset-0 grid place-items-center bg-surface-canvas"
        aria-busy="true"
        :aria-label="t('course.tab.openingBoard')"
      >
        <span class="cp-skel h-10 w-56 rounded-[12px]" />
      </div>
    </div>
  </div>
</template>
