<script setup lang="ts">
/**
 * "Answers from ▾ / All your courses": the chat's course picker, a chip in
 * the composer's row of controls (Claude Design's "Design system ▾" chip).
 * A small thumbnail on the left in the picked course's colour, the label
 * above, the choice below. Pressed, it lists all your courses and each
 * course with what it holds; picking one narrows every answer to it (the
 * chat page makes it the screen's context, so the scope follows).
 *
 *   <CompanionAiSourcePick v-model="answersFrom" placement="down" />
 *
 * A popover on a desktop, a sheet on a phone. The sources column shows
 * the same choice as a list; both write the same `answersFrom`.
 */
import { useCompanion } from '~/companion/store'
import { courseColor } from '~/companion/colors'
import { wash } from '~/companion/ai/make'

withDefaults(defineProps<{ placement?: 'up' | 'down' }>(), { placement: 'up' })

const model = defineModel<string | null>({ default: null })

const store = useCompanion()
const isPhone = useIsPhone()
const open = ref(false)
const root = ref<HTMLElement | null>(null)

const picked = computed(() => (model.value ? store.get('subjects', model.value) : null))

const rows = computed(() =>
  store.subjects.value.map((s) => {
    const notes = store.items.value.filter((i) => i.subject_id === s.id && (i.kind === 'page' || i.kind === 'board')).length
    const files = store.items.value.filter((i) => i.subject_id === s.id && ['file', 'recording', 'photo'].includes(i.kind)).length
    const parts = [notes ? `${notes} ${notes === 1 ? 'note' : 'notes'}` : '', files ? `${files} ${files === 1 ? 'file' : 'files'}` : '']
    return { subject: s, sub: parts.filter(Boolean).join(' · ') || 'Its classes and deadlines' }
  }),
)

const totals = computed(() => {
  const n = store.subjects.value.length
  const notes = store.items.value.filter((i) => i.kind === 'page' || i.kind === 'board').length
  return `${n} ${n === 1 ? 'course' : 'courses'} · ${notes} ${notes === 1 ? 'note' : 'notes'}`
})

function choose(id: string | null): void {
  model.value = id
  open.value = false
}

function onPointerDown(event: PointerEvent): void {
  if (open.value && !isPhone.value && !root.value?.contains(event.target as Node)) open.value = false
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) {
    event.stopPropagation()
    event.preventDefault()
    open.value = false
  }
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown, true))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown, true))

const sheetOpen = computed({
  get: () => open.value && isPhone.value,
  set: (value) => {
    open.value = value
  },
})

const row =
  'flex w-full cursor-pointer items-center gap-2.5 rounded-[11px] px-2 py-2 text-left transition-colors duration-150 outline-none hover:bg-surface-sunken focus-visible:bg-surface-sunken max-lg:min-h-12'
</script>

<template>
  <div
    ref="root"
    class="relative min-w-0"
    @keydown="onKeydown"
  >
    <button
      type="button"
      :class="[
        'flex h-11 max-w-[240px] min-w-0 cursor-pointer items-center gap-2 rounded-[12px] pr-2.5 pl-1.5 text-left shadow-[inset_0_0_0_1px_var(--border)] transition-[background-color,box-shadow] duration-150 outline-none hover:bg-surface-sunken hover:shadow-[inset_0_0_0_1px_var(--border-field)] focus-visible:shadow-[inset_0_0_0_1.5px_var(--brand-line)] max-sm:max-w-[180px]',
        open && 'bg-surface-sunken',
      ]"
      aria-haspopup="listbox"
      :aria-expanded="open"
      title="What the answers come from"
      @click="open = !open"
    >
      <span
        class="grid size-8 shrink-0 place-items-center rounded-[9px]"
        :style="picked ? { background: wash(courseColor(picked.color), 22), color: courseColor(picked.color) } : undefined"
        :class="!picked && 'bg-surface-sunken text-text-soft'"
        aria-hidden="true"
      >
        <i
          v-if="picked"
          class="size-2.5 rounded-full"
          :style="{ background: courseColor(picked.color) }"
        />
        <UiIcon
          v-else
          name="layers"
          :size="15"
        />
      </span>
      <span class="grid min-w-0 leading-tight">
        <span class="flex items-center gap-0.5 text-[11px] text-text-muted">
          Answers from
          <UiIcon
            name="chevron-down"
            :size="11"
            :stroke="2"
            :class="['transition-transform duration-150', open && 'rotate-180']"
          />
        </span>
        <span class="truncate text-[13px] font-semibold text-text">{{ picked?.title ?? 'All your courses' }}</span>
      </span>
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      :enter-from-class="placement === 'up' ? 'opacity-0 translate-y-1' : 'opacity-0 -translate-y-1'"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open && !isPhone"
        :class="[
          'om-scroll absolute left-0 z-40 max-h-[min(380px,60vh)] w-[300px] overflow-y-auto rounded-[16px] bg-surface p-1.5 shadow-pop ring-1 ring-border',
          placement === 'up' ? 'bottom-full mb-2' : 'top-full mt-2',
        ]"
        role="listbox"
        aria-label="What the answers come from"
      >
        <button
          type="button"
          role="option"
          :aria-selected="!picked"
          :class="row"
          @click="choose(null)"
        >
          <span class="grid size-8 shrink-0 place-items-center rounded-[9px] bg-surface-sunken text-text-soft">
            <UiIcon
              name="layers"
              :size="15"
            />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[13px] font-semibold text-text">All your courses</span>
            <span class="block truncate text-[12px] text-text-muted">{{ totals }}</span>
          </span>
          <UiIcon
            v-if="!picked"
            name="check"
            :size="15"
            :stroke="2"
            class="shrink-0 text-cobalt"
          />
        </button>
        <div
          v-if="rows.length"
          class="mx-2 my-1 border-t border-border-rule"
        />
        <button
          v-for="r in rows"
          :key="r.subject.id"
          type="button"
          role="option"
          :aria-selected="picked?.id === r.subject.id"
          :class="row"
          @click="choose(r.subject.id)"
        >
          <span
            class="grid size-8 shrink-0 place-items-center rounded-[9px]"
            :style="{ background: wash(courseColor(r.subject.color), 22) }"
          >
            <i
              class="size-2.5 rounded-full"
              :style="{ background: courseColor(r.subject.color) }"
            />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[13px] font-semibold text-text">{{ r.subject.title }}</span>
            <span class="block truncate text-[12px] text-text-muted">{{ r.sub }}</span>
          </span>
          <UiIcon
            v-if="picked?.id === r.subject.id"
            name="check"
            :size="15"
            :stroke="2"
            class="shrink-0 text-cobalt"
          />
        </button>
      </div>
    </Transition>

    <UiSheet
      v-model:open="sheetOpen"
      title="Answers from"
      description="Everything, or one course: its classes, slides, recordings, notes and cards."
    >
      <div class="mt-3 grid gap-0.5">
        <button
          type="button"
          :class="row"
          @click="choose(null)"
        >
          <span class="grid size-10 shrink-0 place-items-center rounded-[11px] bg-surface-sunken text-text-soft">
            <UiIcon
              name="layers"
              :size="17"
            />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[15px] font-semibold text-text">All your courses</span>
            <span class="block truncate text-[13px] text-text-muted">{{ totals }}</span>
          </span>
          <UiIcon
            v-if="!picked"
            name="check"
            :size="17"
            :stroke="2"
            class="shrink-0 text-cobalt"
          />
        </button>
        <button
          v-for="r in rows"
          :key="r.subject.id"
          type="button"
          :class="row"
          @click="choose(r.subject.id)"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-[11px]"
            :style="{ background: wash(courseColor(r.subject.color), 22) }"
          >
            <i
              class="size-3 rounded-full"
              :style="{ background: courseColor(r.subject.color) }"
            />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[15px] font-semibold text-text">{{ r.subject.title }}</span>
            <span class="block truncate text-[13px] text-text-muted">{{ r.sub }}</span>
          </span>
          <UiIcon
            v-if="picked?.id === r.subject.id"
            name="check"
            :size="17"
            :stroke="2"
            class="shrink-0 text-cobalt"
          />
        </button>
      </div>
    </UiSheet>
  </div>
</template>
