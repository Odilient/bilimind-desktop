<script setup lang="ts">
/**
 * Where a check's question came from, as a chip that opens it: the slides,
 * the recording at the minute, the note, the lesson. It opens the way the
 * chat's citation chips do (`ai/links.ts`), so a source looks and behaves the
 * same wherever BiliMind cites one. Shown only once the question is marked;
 * before that it would give the answer away.
 *
 * With no source the question was general knowledge, and that's said
 * plainly: it can't be traced to their material.
 */
import type { CheckSource } from '~/companion/types'
import type { AiCitation } from '~/companion/ai/types'
import { citationIcon, citationTarget } from '~/companion/ai/links'
import { useCompanion } from '~/companion/store'
import { fetchFileUrl } from '~/companion/files'

const props = defineProps<{ source: CheckSource | null; subjectId: string | null }>()

const store = useCompanion()
const toast = useToast()

const cite = computed<AiCitation | null>(() => {
  const s = props.source
  if (!s) return null
  if (s.item_id) return { kind: 'item', id: s.item_id, label: s.label, quote: s.quote, at_seconds: s.at_seconds }
  if (s.node_id) return { kind: 'lesson', id: String(s.node_id), label: s.label, quote: s.quote, subject_id: props.subjectId }
  return null
})

async function open(c: AiCitation): Promise<void> {
  const target = citationTarget(store, c)
  if (!target) {
    toast.info({ title: c.label, body: c.quote ? `“${c.quote}”` : 'That source isn\'t on this device yet.' })
    return
  }
  if ('href' in target) {
    window.open(target.href, '_blank', 'noopener')
    return
  }
  if ('item' in target) {
    const item = target.item
    if (item.kind === 'link' && item.meta.url) {
      window.open(item.meta.url, '_blank', 'noopener')
      return
    }
    // The window opens inside the click, so no popup blocker objects.
    const tab = window.open('', '_blank')
    const url = await fetchFileUrl(item)
    if (url && tab) tab.location.href = url
    else {
      tab?.close()
      toast.info({ title: item.title, body: 'It can\'t be opened right now. Try again when you\'re online.' })
    }
    return
  }
  await navigateTo(target.to)
}
</script>

<template>
  <button
    v-if="cite"
    type="button"
    class="inline-flex h-7 max-w-full cursor-pointer items-center gap-1.5 self-start rounded-full bg-surface-sunken pr-2.5 pl-2 text-[12.5px] text-text-body transition-colors hover:bg-surface-track focus-visible:bg-surface-track"
    :title="cite.quote ? `${cite.label}: “${cite.quote}”` : cite.label"
    @click="open(cite)"
  >
    <CompanionIcon
      :name="citationIcon(store, cite)"
      :size="13"
      class="shrink-0 text-text-faint"
    />
    <span class="truncate">{{ cite.label }}</span>
  </button>
  <p
    v-else
    class="text-[13px] text-text-faint"
  >
    General knowledge, not from your material
  </p>
</template>
