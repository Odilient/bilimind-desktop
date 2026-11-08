<script setup lang="ts">
/**
 * One thing in the composer's tray: a file, a link, pasted text, a Moodle
 * course or a calendar link. Every kind is the same chip — a small tile
 * that says what it is, a name, one line of detail, and the ×. A file
 * carries its upload on the chip itself: a hairline of sky ink along the
 * bottom that fills, and "Uploading · 64%" in the detail line, so the
 * learner watches their slides go up where they put them.
 *
 * A file that can't go (too big, a format nothing reads) stays in the tray
 * in red with the reason, rather than vanishing, so the learner knows why
 * their 80 MB recording isn't part of the course. One that failed on the
 * way up (the connection dropped) says "Tap to try again", and does.
 *
 * The chat's composer draws its tray with this same chip, so it also knows
 * a note picked from Notes (`NoteAttachment`, ~/companion/ai/attach).
 */
import type { TrayAttachment } from '~/companion/ai/attach'
import { NOTE_ICON } from '~/companion/ai/attach'
import { FILE_LOOK, fileKind } from '~/companion/create'
import { sizeLabel } from '~/companion/words'

const props = defineProps<{
  attachment: TrayAttachment
  /** While the course is building: no ×, nothing to edit. */
  locked?: boolean
}>()

const emit = defineEmits<{
  remove: []
  /** Pasted text opens again to be edited. */
  open: []
  /** A file that failed on the way up, sent again. */
  retry: []
}>()

const look = computed<{ icon: string; tone: string; name: string; detail: string }>(() => {
  const a = props.attachment
  switch (a.kind) {
    case 'file': {
      const kind = FILE_LOOK[fileKind(a.name, a.mime)]
      const detail =
        a.state === 'error'
          ? (a.error ?? 'Didn\'t upload')
          : a.state === 'uploading'
            ? `Uploading · ${a.progress}%`
            : [kind.word, sizeLabel(a.size)].filter(Boolean).join(' · ')
      return { icon: kind.icon, tone: kind.tone, name: a.name, detail }
    }
    case 'link':
      return {
        icon: a.moodle ? 'cap' : 'link',
        tone: 'text-sky-ink',
        name: a.title ?? a.domain,
        detail: a.moodle ? `Moodle · ${a.domain}` : a.domain,
      }
    case 'text':
      return {
        icon: 'paste',
        tone: 'text-text-soft',
        name: a.title,
        detail: `${a.words.toLocaleString('en')} word${a.words === 1 ? '' : 's'}`,
      }
    case 'moodle':
      return { icon: 'cap', tone: 'text-sky-ink', name: a.title, detail: `Moodle · ${a.detail}` }
    case 'note':
      return { icon: NOTE_ICON[a.itemKind], tone: 'text-text-soft', name: a.title, detail: a.detail }
    default:
      return { icon: 'calendar', tone: 'text-sky-ink', name: 'Calendar link', detail: a.domain }
  }
})

const failed = computed(() => props.attachment.kind === 'file' && props.attachment.state === 'error')
const uploading = computed(() => props.attachment.kind === 'file' && props.attachment.state === 'uploading')
const uploaded = computed(() => props.attachment.kind === 'file' && props.attachment.state === 'done' && props.locked)
const progress = computed(() => (props.attachment.kind === 'file' ? props.attachment.progress : 0))
/** Failed on the way up, not refused: worth another go. */
const retryable = computed(() => props.attachment.kind === 'file' && props.attachment.state === 'error' && !props.attachment.refused && !props.locked)
const editable = computed(() => (props.attachment.kind === 'text' || retryable.value) && !props.locked)

function press(): void {
  if (retryable.value) emit('retry')
  else if (editable.value) emit('open')
}
</script>

<template>
  <div
    class="ac-pop relative flex h-12 max-w-full min-w-0 items-center gap-2.5 overflow-hidden rounded-[12px] pr-1 pl-1.5 transition-colors duration-150 min-[600px]:max-w-[300px]"
    :class="failed ? 'bg-danger-soft shadow-[inset_0_0_0_1px_var(--danger-line)]' : 'bg-surface-chrome shadow-[inset_0_0_0_1px_var(--border-strong)]'"
    :title="attachment.kind === 'link' || attachment.kind === 'calendar' ? attachment.url : look.name"
  >
    <span
      class="grid size-9 shrink-0 place-items-center rounded-[9px] bg-surface shadow-[0_0_0_1px_var(--border),var(--shadow-card)]"
      :class="failed ? 'text-danger' : look.tone"
    >
      <UiIcon
        v-if="uploading"
        name="loader"
        :size="16"
        class="animate-spin-slow text-brand"
      />
      <UiIcon
        v-else-if="uploaded"
        name="check"
        :size="16"
        class="text-success"
      />
      <CompanionIcon
        v-else
        :name="look.icon"
        :size="17"
      />
    </span>

    <component
      :is="editable ? 'button' : 'span'"
      :type="editable ? 'button' : undefined"
      class="grid min-w-0 flex-1 text-left leading-tight"
      :class="editable && 'cursor-pointer rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-brand-line'"
      :aria-label="retryable ? `Upload ${look.name} again` : editable ? `Edit ${look.name}` : undefined"
      @click="press"
    >
      <span class="truncate text-[13.5px] font-semibold text-text">{{ look.name }}</span>
      <span
        class="truncate text-[12px] [font-feature-settings:'calt'_0]"
        :class="failed ? 'font-medium text-danger-text' : 'text-text-muted'"
      >{{ retryable ? `${look.detail} · Tap to try again` : look.detail }}</span>
    </component>

    <button
      v-if="!locked"
      type="button"
      class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-text-faint transition-colors duration-150 outline-none hover:bg-surface-sunken hover:text-text focus-visible:ring-2 focus-visible:ring-brand-line max-[599px]:size-10"
      :aria-label="`Remove ${look.name}`"
      :title="`Remove ${look.name}`"
      @click="emit('remove')"
    >
      <UiIcon
        name="x"
        :size="14"
      />
    </button>
    <span
      v-else
      class="w-1.5 shrink-0"
    />

    <span
      v-if="uploading"
      class="absolute inset-x-0 bottom-0 h-[2px] bg-brand-line"
      aria-hidden="true"
    >
      <span
        class="block h-full bg-brand transition-[width] duration-200 ease-out"
        :style="{ width: `${progress}%` }"
      />
    </span>
  </div>
</template>

<style scoped>
/* The landing's attachment pop: in with a small spring. */
.ac-pop {
  animation: ac-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes ac-pop {
  from {
    opacity: 0;
    transform: scale(0.85);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ac-pop {
    animation: none;
  }
}
</style>
