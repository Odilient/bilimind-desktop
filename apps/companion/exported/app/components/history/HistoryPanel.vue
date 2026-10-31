<script setup lang="ts">
import type { Revision, RevisionDetail } from '~/types/api'
import { agoLabel } from '~/utils/words'

/**
 * EDIT — a lesson's history, docked on the right where the assistant lives.
 *
 * Entries are grouped by day and each carries the three things a person asks
 * of a history: when, who, and what — the "what" being the sentence the server
 * composed at write time ("Edited the explainer", "Regenerated: simpler").
 * Choosing an entry previews that version in the lesson pane; the panel itself
 * never shows content, because a 400px column is not where a lesson is read.
 */
const props = defineProps<{
  nodeTitle: string
  revisions: Revision[]
  loading: boolean
  failed: string | null
  /** The revision being previewed, if any. */
  previewing: RevisionDetail | null
  opening: number | null
  restoring: boolean
}>()

const emit = defineEmits<{
  close: []
  preview: [revisionId: number]
  backToLatest: []
  restore: [revisionId: number]
}>()

interface DayGroup {
  key: string
  label: string
  items: Revision[]
}

const CAUSE_ICON: Record<Revision['cause'], string> = {
  generated: 'sparkles',
  edited: 'pencil',
  rewritten: 'sparkles',
  regenerated: 'refresh',
  restored: 'clock',
}

function dayLabel(iso: string): { key: string; label: string } {
  const date = new Date(iso)
  const key = date.toDateString()
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (key === today.toDateString()) return { key, label: 'Today' }
  if (key === yesterday.toDateString()) return { key, label: 'Yesterday' }

  return {
    key,
    label: date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
    }),
  }
}

const groups = computed<DayGroup[]>(() => {
  const out: DayGroup[] = []

  for (const revision of props.revisions) {
    const day = dayLabel(revision.created_at)
    const last = out[out.length - 1]
    if (last && last.key === day.key) last.items.push(revision)
    else out.push({ key: day.key, label: day.label, items: [revision] })
  }

  return out
})

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function who(revision: Revision): string {
  if (revision.cause === 'generated') return 'the generator'
  if (revision.cause === 'regenerated' || revision.cause === 'rewritten') return revision.user ? revision.user.name : 'the model'
  return revision.user?.name ?? 'someone'
}
</script>

<template>
  <aside
    class="flex w-[360px] shrink-0 flex-col border-l border-border bg-surface"
    aria-label="History"
  >
    <div class="flex h-[54px] shrink-0 items-center gap-2 border-b border-border pr-2.5 pl-4">
      <UiIcon
        name="clock"
        :size="15"
        class="text-text-faint"
      />
      <span class="min-w-0 flex-1">
        <span class="block truncate font-display text-[15px] leading-tight font-semibold tracking-[-0.01em]"
          >History</span
        >
        <span class="block truncate text-[11px] leading-tight text-text-faint">{{ nodeTitle }}</span>
      </span>
      <button
        type="button"
        title="Close"
        aria-label="Close"
        class="grid size-7 cursor-pointer place-items-center rounded-[8px] text-text-faint transition-colors hover:bg-surface-rail hover:text-text"
        @click="emit('close')"
      >
        <UiIcon
          name="x"
          :size="14"
          :stroke="2"
        />
      </button>
    </div>

    <div
      v-if="previewing"
      class="border-b border-brand-line bg-brand-soft px-4 py-2.5"
    >
      <p class="text-[12.5px] leading-snug font-medium text-brand">
        Viewing the version from {{ timeOf(previewing.created_at) }},
        {{ dayLabel(previewing.created_at).label.toLowerCase() }}.
      </p>
      <div class="mt-2 flex gap-2">
        <UiBtn
          variant="primary"
          size="sm"
          :loading="restoring"
          :disabled="previewing.is_current"
          @click="emit('restore', previewing.id)"
          >{{ previewing.is_current ? 'This is the latest' : 'Restore this version' }}</UiBtn
        >
        <UiBtn
          variant="secondary"
          size="sm"
          @click="emit('backToLatest')"
          >Back to latest</UiBtn
        >
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-2 py-2">
      <p
        v-if="failed"
        class="px-2 py-3 text-[13px] text-danger"
      >
        {{ failed }}
      </p>

      <p
        v-else-if="!loading && revisions.length === 0"
        class="px-2 py-6 text-center text-[13px] leading-relaxed text-text-faint"
      >
        No versions yet. Every edit, rewrite and regeneration will appear here.
      </p>

      <div
        v-for="group in groups"
        :key="group.key"
        class="mb-3"
      >
        <p class="eyebrow px-2 pt-2 pb-1">{{ group.label }}</p>

        <button
          v-for="revision in group.items"
          :key="revision.id"
          type="button"
          :class="[
            'flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors',
            previewing?.id === revision.id ? 'bg-accent-soft' : 'hover:bg-surface-mute',
          ]"
          :aria-current="previewing?.id === revision.id ? 'true' : undefined"
          @click="emit('preview', revision.id)"
        >
          <span
            :class="[
              'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full',
              revision.cause === 'edited' ? 'bg-surface-track text-text-soft' : 'bg-brand-soft text-brand',
            ]"
          >
            <UiIcon
              v-if="opening !== revision.id"
              :name="CAUSE_ICON[revision.cause]"
              :size="12"
            />
            <UiIcon
              v-else
              name="loader"
              :size="12"
              class="animate-spin-slow"
            />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-[13px] leading-snug text-text-dim">
              {{ revision.summary }}
              <span
                v-if="revision.is_current"
                class="ml-1 rounded-full bg-lime px-1.5 py-px text-[10px] font-semibold text-ink"
                >Latest</span
              >
            </span>
            <span class="block text-[11.5px] text-text-faint">
              {{ timeOf(revision.created_at) }} · {{ who(revision) }} · {{ agoLabel(revision.created_at) }}
            </span>
          </span>
        </button>
      </div>
    </div>
  </aside>
</template>
