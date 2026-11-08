<script setup lang="ts">
/**
 * "Reads ▾ / This lesson": what the docked assistant answers from, as a chip
 * in the composer's row (the chat page's "Answers from" chip, `SourcePick`,
 * for the narrower choice a screen offers: this lesson, page or board · the
 * course · everything). It shows only where there is a choice; elsewhere the
 * answer reads everything and finds what the question needs.
 *
 *   <CompanionAiScopePick placement="up" />
 */
import { useAi } from '~/companion/ai/state'
import { useAiThread } from '~/companion/ai/thread'
import type { AiScope } from '~/companion/ai/types'
import { useCompanion } from '~/companion/store'
import { courseColor } from '~/companion/colors'
import { wash } from '~/companion/ai/make'

withDefaults(defineProps<{ placement?: 'up' | 'down' }>(), { placement: 'up' })

const ai = useAi()
const t = useAiThread()
const store = useCompanion()
const open = ref(false)
const root = ref<HTMLElement | null>(null)

const ctx = computed(() => ai.context.value)
const subject = computed(() => (ctx.value.subjectId ? store.get('subjects', ctx.value.subjectId) : null))

const KIND: Record<string, { word: string; icon: string }> = {
  lesson: { word: 'lesson', icon: 'book' },
  page: { word: 'page', icon: 'page' },
  board: { word: 'whiteboard', icon: 'board' },
  deadline: { word: 'deadline', icon: 'flag' },
}

interface ScopeRow {
  value: AiScope
  title: string
  sub: string
  icon: string
  color: string | null
}

const rows = computed<ScopeRow[]>(() =>
  t.scopes.value.map((value) => {
    if (value === 'here') {
      const k = KIND[ctx.value.kind] ?? { word: 'screen', icon: 'file' }
      return { value, title: `This ${k.word}`, sub: ctx.value.label, icon: k.icon, color: null }
    }
    if (value === 'course') {
      return {
        value,
        title: subject.value?.title ?? 'This course',
        sub: 'The whole course: classes, slides, notes, cards',
        icon: 'notebook',
        color: subject.value ? courseColor(subject.value.color) : null,
      }
    }
    return { value, title: 'Everything', sub: 'All your courses, notes and deadlines', icon: 'layers', color: null }
  }),
)

const picked = computed(() => rows.value.find((r) => r.value === t.scope.value) ?? rows.value.at(-1)!)

function choose(value: AiScope): void {
  t.scope.value = value
  open.value = false
}

function onPointerDown(event: PointerEvent): void {
  if (open.value && !root.value?.contains(event.target as Node)) open.value = false
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) {
    // The menu closes; the drawer around it stays.
    event.stopPropagation()
    event.preventDefault()
    open.value = false
  }
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown, true))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown, true))

const row =
  'flex w-full cursor-pointer items-center gap-2.5 rounded-[11px] px-2 py-2 text-left transition-colors duration-150 outline-none hover:bg-surface-sunken focus-visible:bg-surface-sunken max-lg:min-h-12'
</script>

<template>
  <div
    v-if="rows.length > 1"
    ref="root"
    class="relative min-w-0"
    @keydown="onKeydown"
  >
    <button
      type="button"
      :class="[
        'flex h-10 max-w-[200px] min-w-0 cursor-pointer items-center gap-2 rounded-full pr-3 pl-1 text-left shadow-[inset_0_0_0_1px_var(--border-strong)] transition-[background-color,box-shadow] duration-150 outline-none hover:bg-surface-sunken focus-visible:shadow-[inset_0_0_0_1.5px_var(--brand-line)] max-lg:h-11',
        open && 'bg-surface-sunken',
      ]"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :title="`Reads ${picked.title}: ${picked.sub}`"
      @click="open = !open"
    >
      <span
        class="grid size-8 shrink-0 place-items-center rounded-full"
        :style="picked.color ? { background: wash(picked.color, 22) } : undefined"
        :class="!picked.color && 'bg-surface-sunken text-text-soft'"
        aria-hidden="true"
      >
        <i
          v-if="picked.color"
          class="size-2.5 rounded-full"
          :style="{ background: picked.color }"
        />
        <CompanionIcon
          v-else
          :name="picked.icon"
          :size="14"
        />
      </span>
      <span class="grid min-w-0 leading-tight">
        <span class="flex items-center gap-0.5 text-[11px] text-text-muted">
          Reads
          <UiIcon
            name="chevron-down"
            :size="11"
            :stroke="2"
            :class="['transition-transform duration-150', open && 'rotate-180']"
          />
        </span>
        <span class="truncate text-[13px] font-semibold text-text">{{ picked.title }}</span>
      </span>
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      :enter-from-class="placement === 'up' ? 'opacity-0 translate-y-1' : 'opacity-0 -translate-y-1'"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        :class="[
          'absolute left-0 z-40 w-[280px] max-w-[calc(100vw-48px)] rounded-[15px] bg-surface p-1.5 shadow-pop',
          placement === 'up' ? 'bottom-full mb-2' : 'top-full mt-2',
        ]"
        role="listbox"
        aria-label="What it answers from"
      >
        <button
          v-for="r in rows"
          :key="r.value"
          type="button"
          role="option"
          :aria-selected="picked.value === r.value"
          :class="row"
          @click="choose(r.value)"
        >
          <span
            class="grid size-8 shrink-0 place-items-center rounded-[9px]"
            :style="r.color ? { background: wash(r.color, 22) } : undefined"
            :class="!r.color && 'bg-surface-sunken text-text-soft'"
          >
            <i
              v-if="r.color"
              class="size-2.5 rounded-full"
              :style="{ background: r.color }"
            />
            <CompanionIcon
              v-else
              :name="r.icon"
              :size="15"
            />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[13px] font-semibold text-text">{{ r.title }}</span>
            <span class="block truncate text-[12px] text-text-muted">{{ r.sub }}</span>
          </span>
          <UiIcon
            v-if="picked.value === r.value"
            name="check"
            :size="15"
            :stroke="2"
            class="shrink-0 text-brand"
          />
        </button>
      </div>
    </Transition>
  </div>
</template>
