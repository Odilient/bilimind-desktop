<script setup lang="ts">
import type { ArtifactContent, ArtifactKind } from '~/composables/useArtifacts'
import Markdown from '~/components/blocks/Markdown.vue'
import type { MenuAction } from '~/components/ui/Menu.vue'

/**
 * The made-for-you panel — the right-hand twin of the assistant.
 *
 * It renders whatever the assistant produced. An HTML page is dressed in a small
 * browser window (and can be flipped to its source), a PDF sits in a document
 * frame, Markdown renders inline. Its dock / float geometry mirrors the assistant
 * so the two feel like one pair of tools, and it shares the single right dock — a
 * switch in the header hops back to the assistant rather than stacking two
 * columns onto the reading area.
 */
const props = defineProps<{
  artifact: { id: number; kind: ArtifactKind; title: string; url?: string }
  /** Whether the assistant exists to switch back to. */
  hasAssistant?: boolean
}>()

const mode = defineModel<'docked' | 'float'>('mode', { required: true })

const emit = defineEmits<{
  close: []
  showAssistant: []
}>()

const artifacts = useArtifacts()
const toast = useToast()

const content = ref<ArtifactContent | null>(null)
const loading = ref(false)
const failed = ref<string | null>(null)
const view = ref<'preview' | 'code'>('preview')

/** Sandboxed HTML never gets same-origin, so it cannot reach app storage. */
const SANDBOX = 'allow-scripts allow-popups allow-forms allow-modals'

const KIND_META: Record<ArtifactKind, { label: string; glyph: string; color: string }> = {
  html: { label: 'Web page', glyph: '</>', color: '#e8703a' },
  pdf: { label: 'PDF', glyph: 'PDF', color: '#e5484d' },
  markdown: { label: 'Note', glyph: 'MD', color: '#5b9bd1' },
}
const meta = computed(() => KIND_META[props.artifact.kind])

/** photosynthesis.html — a filename that makes the made thing feel tangible. */
const fileName = computed(() => {
  const slug = (props.artifact.title || 'artifact')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'artifact'
  const ext = props.artifact.kind === 'pdf' ? 'pdf' : props.artifact.kind === 'markdown' ? 'md' : 'html'
  return `${slug}.${ext}`
})

async function load(): Promise<void> {
  release()
  loading.value = true
  failed.value = null
  view.value = 'preview'

  try {
    content.value = await artifacts.load(props.artifact.id, props.artifact.kind)
  } catch (error) {
    failed.value = error instanceof Error ? error.message : 'That could not be opened.'
  } finally {
    loading.value = false
  }
}

function release(): void {
  content.value?.revoke()
  content.value = null
}

watch(() => props.artifact.id, load, { immediate: true })
onBeforeUnmount(release)

function absoluteUrl(): string {
  return props.artifact.url ?? artifacts.rawUrl(props.artifact.id)
}

function openInNewTab(): void {
  if (!import.meta.client) return
  window.open(absoluteUrl(), '_blank', 'noopener')
}

function download(): void {
  if (!import.meta.client) return
  const a = document.createElement('a')
  a.href = absoluteUrl()
  a.download = fileName.value
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

async function copySource(): Promise<void> {
  if (!import.meta.client || !content.value?.text) return
  try {
    await navigator.clipboard.writeText(content.value.text)
    toast.push({ title: 'Copied the source', tone: 'success' })
  } catch {
    toast.push({ title: "Couldn't copy — try opening it in a new tab", tone: 'danger' })
  }
}

const canFlip = computed(() => props.artifact.kind === 'html' || props.artifact.kind === 'markdown')

const overflow = computed<MenuAction[]>(() => {
  const actions: MenuAction[] = [{ label: 'Open in a new tab', icon: 'external', run: openInNewTab }]
  if (content.value?.text) actions.push({ label: 'Copy source', run: copySource })
  actions.push({ label: 'Download', icon: 'file', run: download })
  return actions
})
</script>

<template>
  <aside
    :class="[
      'flex flex-col bg-surface',
      mode === 'docked'
        ? 'w-[400px] shrink-0 border-l border-border'
        : 'animate-rise absolute top-4.5 right-4.5 bottom-4.5 z-20 w-[560px] max-w-[calc(100%-40px)] overflow-hidden rounded-[22px] shadow-pop ring-1 ring-border',
    ]"
    aria-label="Made for you"
  >
    <!-- Header -->
    <div class="flex items-center gap-2 border-b border-border py-2.5 pr-2.5 pl-3.5">
      <span
        class="kind-chip"
        :style="{ '--kc': meta.color }"
        aria-hidden="true"
        >{{ meta.glyph }}</span
      >
      <span class="min-w-0 flex-1">
        <span class="block truncate font-display text-[14.5px] leading-tight font-semibold tracking-[-0.01em]">{{
          artifact.title
        }}</span>
        <span class="block text-[11px] leading-tight text-text-faint">Made by the assistant · {{ meta.label }}</span>
      </span>

      <!-- Preview / Code flip for text artifacts -->
      <div
        v-if="canFlip && !failed"
        class="mr-0.5 hidden items-center rounded-[11px] bg-surface-track p-[3px] sm:flex"
        role="tablist"
      >
        <button
          v-for="v in (['preview', 'code'] as const)"
          :key="v"
          type="button"
          role="tab"
          :aria-selected="view === v"
          class="flip-tab"
          :class="view === v ? 'is-active' : ''"
          @click="view = v"
        >
          {{ v === 'preview' ? 'Preview' : 'Code' }}
        </button>
      </div>

      <button
        v-if="hasAssistant && mode === 'docked'"
        type="button"
        title="Show the assistant instead"
        aria-label="Show the assistant instead"
        class="flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[12px] text-text-faint transition-colors hover:bg-surface-sunken hover:text-text-soft"
        @click="emit('showAssistant')"
      >
        <UiIcon
          name="spark"
          :size="13"
        />
        <span class="hidden lg:inline">Assistant</span>
      </button>

      <UiMenu
        :actions="overflow"
        label="More for this"
        title="This result"
      />

      <button
        type="button"
        :title="mode === 'docked' ? 'Pop out to float' : 'Dock to the right side'"
        :aria-label="mode === 'docked' ? 'Pop out to float' : 'Dock to the right side'"
        class="grid size-7 cursor-pointer place-items-center rounded-md text-text-faint transition-colors hover:bg-surface-sunken hover:text-text-soft"
        @click="mode = mode === 'docked' ? 'float' : 'docked'"
      >
        <UiIcon
          :name="mode === 'docked' ? 'pop-out' : 'dock'"
          :size="15"
          :stroke="1.8"
        />
      </button>

      <button
        type="button"
        title="Close"
        aria-label="Close"
        class="grid size-7 cursor-pointer place-items-center rounded-md text-text-faint transition-colors hover:bg-surface-sunken hover:text-text-soft"
        @click="emit('close')"
      >
        <UiIcon
          name="x"
          :size="14"
          :stroke="2"
        />
      </button>
    </div>

    <!-- Body -->
    <div class="relative min-h-0 flex-1 bg-surface-sunken">
      <!-- Loading -->
      <div
        v-if="loading"
        class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
      >
        <span class="art-spinner" />
        <p class="text-[12.5px] text-text-muted">Rendering your {{ meta.label.toLowerCase() }}…</p>
      </div>

      <UiEmptyState
        v-else-if="failed"
        icon="alert"
        tone="danger"
        title="This can't be opened"
        :description="failed"
        class="m-auto max-w-[360px] px-6 py-16"
      >
        <UiBtn
          variant="secondary"
          icon="refresh"
          @click="load"
          >Try again</UiBtn
        >
        <UiBtn
          variant="ghost"
          icon="external"
          @click="openInNewTab"
          >Open in a new tab</UiBtn
        >
      </UiEmptyState>

      <template v-else>
        <!-- HTML: a little browser window, or its source -->
        <div
          v-if="artifact.kind === 'html'"
          class="flex h-full flex-col"
        >
          <template v-if="view === 'preview'">
            <div class="art-browser-bar">
              <span class="art-dots"><i style="background: #ff5f57" /><i style="background: #febc2e" /><i style="background: #28c840" /></span>
              <span class="art-url">
                <UiIcon
                  name="globe"
                  :size="10"
                />
                {{ fileName }}
              </span>
              <button
                type="button"
                class="art-open"
                title="Open in a new tab"
                aria-label="Open in a new tab"
                @click="openInNewTab"
              >
                <UiIcon
                  name="external"
                  :size="12"
                />
              </button>
            </div>
            <iframe
              :srcdoc="content?.text"
              :sandbox="SANDBOX"
              :title="artifact.title"
              class="min-h-0 w-full flex-1 border-0 bg-white"
            />
          </template>
          <pre
            v-else
            class="art-source om-scroll"
          >{{ content?.text }}</pre>
        </div>

        <!-- PDF -->
        <iframe
          v-else-if="artifact.kind === 'pdf'"
          :src="content?.objectUrl"
          :title="artifact.title"
          class="h-full w-full border-0 bg-surface-sunken"
        />

        <!-- Markdown -->
        <div
          v-else
          class="om-scroll absolute inset-0 overflow-y-auto"
        >
          <pre
            v-if="view === 'code'"
            class="art-source"
          >{{ content?.text }}</pre>
          <div
            v-else
            class="mx-auto max-w-[640px] px-6 py-6"
          >
            <Markdown
              :source="content?.text ?? ''"
              size="sm"
            />
          </div>
        </div>
      </template>
    </div>
  </aside>
</template>

<style scoped>
.kind-chip {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 10px;
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--kc);
  background: color-mix(in oklab, var(--kc) 14%, transparent);
  border: 1px solid color-mix(in oklab, var(--kc) 30%, transparent);
}

.flip-tab {
  padding: 4px 11px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background-color 0.14s ease, color 0.14s ease;
}
.flip-tab.is-active {
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: var(--shadow-segment);
}

.art-browser-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-chrome);
}
.art-dots {
  display: inline-flex;
  gap: 5px;
}
.art-dots i {
  width: 9px;
  height: 9px;
  border-radius: 999px;
}
.art-url {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  min-width: 0;
  padding: 3px 9px;
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--color-text-muted);
  background: var(--color-surface-sunken);
}
.art-open {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: var(--color-text-faint);
  cursor: pointer;
}
.art-open:hover {
  color: var(--color-text-soft);
  background: var(--color-surface-sunken);
}

.art-source {
  height: 100%;
  margin: 0;
  padding: 16px 18px;
  overflow: auto;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--color-code-text);
  background: var(--color-code-bg);
}

.art-spinner {
  width: 26px;
  height: 26px;
  border-radius: 999px;
  border: 2.5px solid var(--color-border-strong);
  border-top-color: var(--cobalt);
  animation: art-spin 0.7s linear infinite;
}
@keyframes art-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .art-spinner {
    animation-duration: 2s;
  }
}
</style>
