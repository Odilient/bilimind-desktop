<script setup lang="ts">
import type { Item, Uuid } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { addLink, namedTarget, normaliseUrl } from '~/companion/capture'
import { noteTo } from '~/companion/notes/actions'

/**
 * The links that belong to one thing: an assessment (the brief on Google
 * Docs, the Figma file it's built in), a lesson ("this lesson has something
 * on Canva"), a page. Each is a hairline row with its picture and where
 * it's from, opening the link's own page (with the player or design shown
 * there when the service allows it, `CompanionLinksPreview`). Under them,
 * "Add a link", which turns into one field; the link is read for its title
 * and picture as it's saved (`addLink` → `previewInto`).
 *
 * What it's on (`on`), and how the row says so:
 *   deadlineId  `meta.deadline_id`, filed in the deadline's course
 *   topicId     `topic_id`, the lesson's topic, in its course
 *   parentId    `parent_id`, inside the page, in the page's course (or My
 *               notes), so the Notes tree shows it under the page as well
 *
 * With no links yet it's one quiet "Add a link" button, so nothing grows a
 * heading for nothing; `quiet` draws not even that (a page, whose "…" offers
 * "Add a link" and calls `open()`).
 */
const props = withDefaults(
  defineProps<{
    on: { deadlineId?: Uuid; topicId?: Uuid; parentId?: Uuid }
    /** The course it's filed in; null is My notes. */
    subjectId: Uuid | null
    quiet?: boolean
  }>(),
  { quiet: false },
)

const store = useCompanion()
const toast = useToast()

function belongs(i: Item): boolean {
  if (i.kind !== 'link' || i.deleted_at) return false
  if (props.on.deadlineId) return i.meta.deadline_id === props.on.deadlineId
  if (props.on.topicId) return i.topic_id === props.on.topicId
  if (props.on.parentId) return i.parent_id === props.on.parentId
  return false
}

const links = computed<Item[]>(() =>
  store.items.value.filter(belongs).sort((a, b) => Date.parse(a.created_at ?? '') - Date.parse(b.created_at ?? '')),
)

const root = ref<HTMLElement | null>(null)
const adding = ref(false)
const url = ref('')
const tried = ref(false)
const saving = ref(false)
const field = ref<HTMLInputElement | null>(null)
const parsed = computed(() => normaliseUrl(url.value))

function open(): void {
  adding.value = true
  void nextTick(() => {
    root.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    field.value?.focus()
  })
}

defineExpose({ open })

function close(): void {
  adding.value = false
  url.value = ''
  tried.value = false
}

async function add(): Promise<void> {
  tried.value = true
  if (!parsed.value || saving.value) return
  saving.value = true
  try {
    await addLink(store, parsed.value, namedTarget(store, props.subjectId), {
      deadlineId: props.on.deadlineId ?? null,
      topicId: props.on.topicId ?? null,
      parentId: props.on.parentId ?? null,
      quiet: true,
    })
    close()
  } catch {
    toast.error({ title: 'Couldn’t save the link', body: 'Check the connection and try again.' })
  } finally {
    saving.value = false
  }
}

function where(item: Item): string {
  if (item.meta.link?.provider) return item.meta.link.provider
  try {
    return new URL(item.meta.url ?? '').hostname.replace(/^www\./, '')
  } catch {
    return 'Link'
  }
}
</script>

<template>
  <div
    v-if="!quiet || links.length || adding"
    ref="root"
    class="print:hidden"
  >
    <CompanionBox :label="links.length ? 'Links' : undefined">
      <ul
        v-if="links.length"
        class="divide-y divide-border-rule border-y border-border-rule"
      >
        <li
          v-for="l in links"
          :key="l.id"
        >
          <NuxtLink
            :to="noteTo(l.id)"
            class="flex items-center gap-3 py-3 outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--cobalt)]"
          >
            <img
              v-if="l.meta.link?.thumbnail"
              :src="l.meta.link.thumbnail"
              alt=""
              loading="lazy"
              referrerpolicy="no-referrer"
              class="h-9 w-16 shrink-0 rounded-[6px] bg-surface-sunken object-cover"
            >
            <span
              v-else
              class="grid h-9 w-16 shrink-0 place-items-center rounded-[6px] bg-cobalt-soft text-cobalt"
            >
              <UiIcon
                name="link"
                :size="16"
              />
            </span>
            <span class="grid min-w-0 flex-1 gap-0.5">
              <span class="truncate text-[16px] leading-snug font-medium text-text">{{ l.title || 'A link' }}</span>
              <span class="truncate text-[13.5px] text-text-muted">{{ where(l) }}</span>
            </span>
            <UiIcon
              name="chevron-right"
              :size="16"
              class="shrink-0 text-text-faint"
            />
          </NuxtLink>
        </li>
      </ul>

      <form
        v-if="adding"
        class="flex flex-wrap items-center gap-2"
        @submit.prevent="add"
        @keydown.esc="close"
      >
        <label
          :class="[
            'flex h-11 min-w-0 flex-1 basis-[240px] items-center gap-2 rounded-[12px] bg-surface-sunken px-3 text-text-faint transition-shadow focus-within:bg-surface focus-within:shadow-[inset_0_0_0_2px_var(--cobalt)]',
            tried && !parsed && 'shadow-[inset_0_0_0_2px_var(--danger)]',
          ]"
        >
          <UiIcon
            name="link"
            :size="15"
            class="shrink-0"
          />
          <input
            ref="field"
            v-model="url"
            type="url"
            inputmode="url"
            autocomplete="off"
            spellcheck="false"
            placeholder="Paste a Canva or Figma link, a doc, a video"
            aria-label="The link"
            class="min-w-0 flex-1 bg-transparent text-[15px] text-text outline-none placeholder:text-text-faint"
          >
        </label>
        <UiBtn
          type="submit"
          variant="primary"
          :disabled="!url.trim()"
          :loading="saving"
        >
          Add link
        </UiBtn>
        <UiBtn
          type="button"
          variant="ghost"
          @click="close"
        >
          Cancel
        </UiBtn>
        <p
          v-if="tried && !parsed"
          class="basis-full text-[13px] text-danger"
          role="alert"
        >
          That doesn’t look like a link. Try one that starts with https://
        </p>
      </form>
      <div v-else>
        <UiBtn
          variant="secondary"
          size="sm"
          @click="open"
        >
          <UiIcon
            name="link"
            :size="14"
          />
          Add a link
        </UiBtn>
      </div>
    </CompanionBox>
  </div>
</template>
