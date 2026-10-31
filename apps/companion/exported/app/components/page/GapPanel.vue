<script setup lang="ts">
import type { Editor, JSONContent } from '@tiptap/vue-3'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { Card, Item } from '~/companion/types'
import type { CompanionStore } from '~/companion/store'
import type { PageContext } from '~/companion/doc/context'
import type { Gap, GapResult } from '~/companion/doc/gap'
import { whenLabel } from '~/companion/time'

/**
 * "What did I miss?": what the slides and the recording cover that these
 * notes don't, each with where it came from, and one press to add it.
 *
 * Laid out like any other screen in the app, only narrower: a heading with
 * the class under it and a close button, one sentence on what it does, then
 * the gaps as rows between hairlines, each with its own "Add". The lime
 * button is the panel's one "go" (compare, or add them all). Under that,
 * "Linked to this page" lists what's linked as rows: pages and boards made
 * from it and deadlines whose scope includes its topic open on press (and
 * show a chevron); the count of cards made from it is just a line.
 *
 * It only exists once asked for. The comparison itself is the workspace's,
 * so closing and reopening the panel (or turning the phone) shows the same
 * answer instead of asking the model again; "Compare again" asks anew. An
 * added gap lands as a callout carrying its source chips and the gap's id,
 * so the panel knows it's there and doesn't offer it twice.
 */
const props = defineProps<{
  editor: Editor
  page: Item
  ctx: PageContext
  store: CompanionStore
  state: { result: GapResult | null; loading: boolean }
  sheet?: boolean
}>()
const emit = defineEmits<{ close: []; open: [item: Item]; compare: [] }>()

const result = computed(() => props.state.result)
const loading = computed(() => props.state.loading)

/** Gap ids already on the page, read from the callouts that carry them. */
const added = computed(() => {
  const ids = new Set<string>()
  props.editor.state.doc.descendants((node: PMNode) => {
    if (node.type.name === 'callout' && node.attrs.gap_id) ids.add(String(node.attrs.gap_id))
    return node.type.name !== 'callout'
  })
  return ids
})

const gaps = computed(() => (result.value?.state === 'ready' ? result.value.gaps : []))
const remaining = computed(() => gaps.value.filter((g) => !added.value.has(g.id)))

const pill = computed(() => props.ctx.session?.title ?? props.ctx.topic?.title ?? null)

const NUMBERS = ['', 'one', 'two', 'three', 'four', 'five', 'six']
const addAllLabel = computed(() => {
  const n = remaining.value.length
  if (n === gaps.value.length && n > 1) return `Add all ${NUMBERS[n] ?? n}, with sources`
  return n === 1 ? 'Add it, with its source' : `Add the other ${NUMBERS[n] ?? n}, with sources`
})

function calloutFor(gap: Gap): JSONContent {
  const inline: JSONContent[] = [
    { type: 'text', text: `${gap.title}.`, marks: [{ type: 'bold' }] },
    { type: 'text', text: ` ${gap.body} ` },
  ]
  gap.sources.forEach((source, i) => {
    if (i) inline.push({ type: 'text', text: ' ' })
    inline.push({
      type: 'cite',
      attrs: { label: source.label, item_id: source.item_id ?? null, at_seconds: source.at_seconds ?? null },
    })
  })
  return { type: 'callout', attrs: { icon: 'sparkles', gap_id: gap.id }, content: [{ type: 'paragraph', content: inline }] }
}

/**
 * Where added gaps go: after the notes, but above a closing "Coming up"
 * block if the page ends with one, so the live list stays last (and above
 * the "Coming up" heading pages made before the block titled itself).
 */
function insertPosition(): number {
  const doc = props.editor.state.doc
  const blocks: { node: PMNode; pos: number }[] = []
  doc.forEach((node, pos) => blocks.push({ node, pos }))
  let end = blocks.length
  // A trailing empty paragraph is just the cursor's landing spot.
  if (end && blocks[end - 1]!.node.type.name === 'paragraph' && !blocks[end - 1]!.node.content.size) end--
  const last = blocks[end - 1]
  const before = blocks[end - 2]
  if (last?.node.type.name === 'objectView') {
    return before?.node.type.name === 'heading' && before.node.textContent.trim() === 'Coming up' ? before.pos : last.pos
  }
  return last ? last.pos + last.node.nodeSize : doc.content.size
}

function add(list: Gap[]): void {
  if (!list.length) return
  const at = insertPosition()
  props.editor.chain().insertContentAt(at, list.map(calloutFor)).run()
  nextTick(() => {
    const dom = props.editor.view.nodeDOM(at) as HTMLElement | null
    dom?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  })
}

const children = computed(() =>
  props.store.items.value.filter((i) => i.parent_id === props.page.id && (i.kind === 'page' || i.kind === 'board')),
)

/**
 * Cards made from this page. The store holds the due ones and those made
 * since it loaded; the rest are asked for once, and the two are counted
 * together so a new card shows up straight away.
 */
const fetchedCards = ref<string[]>([])
const cardCount = computed(() => {
  const ids = new Set(fetchedCards.value)
  for (const card of props.store.cards.value) if (card.item_id === props.page.id) ids.add(card.id)
  return ids.size
})

const scoped = computed(() =>
  props.page.topic_id
    ? props.ctx.deadlines.filter((d) => d.topic_ids?.includes(props.page.topic_id!) && d.status === 'upcoming')
    : [],
)

onMounted(async () => {
  const cards = await props.store.repo().list<Card>('cards', { item_id: props.page.id }).catch(() => [] as Card[])
  fetchedCards.value = cards.filter((c) => !c.deleted_at && c.item_id === props.page.id).map((c) => c.id)
})
</script>

<template>
  <section
    class="pg-gaps"
    :class="{ 'is-sheet': sheet }"
    aria-labelledby="pg-gaps-title"
  >
    <header
      v-if="!sheet"
      class="pg-gaps-head"
    >
      <div class="min-w-0 flex-1">
        <h2
          id="pg-gaps-title"
          class="t-head text-[19px]"
        >
          What did I miss?
        </h2>
        <p
          v-if="pill"
          class="pg-gaps-sub"
        >
          {{ pill }}
        </p>
      </div>
      <button
        type="button"
        class="pg-gaps-x"
        aria-label="Close this panel"
        title="Close"
        @click="emit('close')"
      >
        <UiIcon
          name="x"
          :size="18"
        />
      </button>
    </header>
    <h2
      v-else
      id="pg-gaps-title"
      class="sr-only"
    >
      What did I miss?
    </h2>

    <!-- Comparing -->
    <div
      v-if="loading"
      class="pg-gaps-loading"
      role="status"
    >
      <p class="pg-gaps-note">
        Comparing your notes with the slides and the recording…
      </p>
      <span
        v-for="n in 3"
        :key="n"
        class="pg-skel"
      />
    </div>

    <!-- Not asked yet (a real comparison costs a model call) -->
    <div
      v-else-if="!result"
      class="pg-gaps-idle"
    >
      <p class="pg-gaps-note">
        Compares your notes with this class's slides and recording, and lists what isn't here yet, each with
        where it came from.
      </p>
      <UiBtn
        variant="accent"
        block
        @click="emit('compare')"
      >
        Compare my notes
      </UiBtn>
    </div>

    <template v-else-if="result.state === 'ready'">
      <p class="pg-gaps-note">
        {{ result.compared }}
      </p>
      <p
        v-if="!gaps.length"
        class="pg-gaps-done"
      >
        Nothing missing that we can see.
      </p>
      <ul
        v-else
        class="pg-gaps-list"
      >
        <li
          v-for="gap in gaps"
          :key="gap.id"
          class="pg-gap"
        >
          <span class="pg-gap-title">{{ gap.title }}</span>
          <UiBtn
            v-if="!added.has(gap.id)"
            size="sm"
            class="pg-gap-add"
            :label="`Add ${gap.title}`"
            @click="add([gap])"
          >
            Add
          </UiBtn>
          <span
            v-else
            class="pg-gap-added"
          ><UiIcon
            name="check"
            :size="14"
            :stroke="2.2"
          />Added</span>
          <span class="pg-gap-meta">
            <template
              v-for="(source, i) in gap.sources"
              :key="i"
            >
              <span v-if="i"> · </span>
              <span
                v-if="source.at_seconds != null"
                class="pg-cite is-static"
              ><UiIcon
                name="play"
                :size="9"
                :stroke="2.4"
              />{{ source.label }}</span>
              <span v-else>{{ source.label }}</span>
            </template>
            <span v-if="gap.note"> · {{ gap.note }}</span>
          </span>
        </li>
      </ul>
      <UiBtn
        v-if="remaining.length"
        variant="accent"
        block
        @click="add(remaining)"
      >
        {{ addAllLabel }}
      </UiBtn>
      <p
        v-else-if="gaps.length"
        class="pg-gaps-done"
      >
        All of it is in your notes now.
      </p>
      <button
        type="button"
        class="pg-link-btn pg-gaps-again"
        @click="emit('compare')"
      >
        Compare again
      </button>
    </template>

    <p
      v-else-if="result.state === 'no-material'"
      class="pg-gaps-note"
    >
      There's nothing from this class to compare against yet. Once its slides, reading or recording are here, this lists what your notes don't cover.
    </p>
    <p
      v-else-if="result.state === 'coming-soon'"
      class="pg-gaps-note"
    >
      Coming soon. This will compare your notes with the slides and the recording, and list what isn't here, each with where it came from.
    </p>
    <div
      v-else
      class="pg-gaps-idle"
    >
      <p class="pg-gaps-note">
        {{ result.message }}
      </p>
      <UiBtn
        size="sm"
        @click="emit('compare')"
      >
        Try again
      </UiBtn>
    </div>

    <template v-if="children.length || scoped.length || cardCount">
      <h3 class="pg-gaps-linked">
        Linked to this page
      </h3>
      <ul class="pg-blinks">
        <li
          v-for="item in children"
          :key="item.id"
        >
          <button
            type="button"
            class="pg-blink"
            @click="emit('open', item)"
          >
            <PageIcon
              :name="item.kind === 'board' ? 'board' : 'page'"
              :size="16"
            />
            <span class="pg-blink-text">{{ item.title || 'Untitled' }}{{ item.kind === 'board' ? ' board' : '' }}</span>
            <UiIcon
              name="chevron-right"
              :size="16"
              class="pg-blink-go"
            />
          </button>
        </li>
        <li
          v-for="d in scoped"
          :key="d.id"
        >
          <NuxtLink
            :to="`/app/d/${d.id}`"
            class="pg-blink"
            :title="d.scope_note ? `Covers: ${d.scope_note}` : 'Covers this page’s topic'"
          >
            <PageIcon
              name="flag"
              :size="16"
            />
            <span class="pg-blink-text">{{ d.title }}{{ d.due_at ? ` · ${whenLabel(d.due_at, d.all_day)}` : '' }}</span>
            <UiIcon
              name="chevron-right"
              :size="16"
              class="pg-blink-go"
            />
          </NuxtLink>
        </li>
        <li v-if="cardCount">
          <span class="pg-blink is-static">
            <UiIcon
              name="cards"
              :size="16"
            />
            <span class="pg-blink-text">{{ cardCount }} {{ cardCount === 1 ? 'card' : 'cards' }} made from this page</span>
          </span>
        </li>
      </ul>
    </template>
  </section>
</template>
