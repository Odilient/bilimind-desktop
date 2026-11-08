<script setup lang="ts">
/**
 * One change waiting for the learner's OK, in the same pale-amber card as
 * Today's "Waiting for your OK", with more room: the course and the thing
 * it's about, the question, then before → after on one line (the old date
 * struck through), the words it came from and who said them ("Javohir, in a
 * shared message, 21:05"), one line on what saying yes does, and two
 * buttons: the change itself ("Move it (not confirmed yet)") and Ignore.
 *
 * It used to put before and after in two grey and lime boxes inside the
 * card, the quote in a third, and a coloured "Shared" pill in the corner
 * that looked pressable; the words now carry all of it.
 *
 * Used in the Inbox and in the capture sheet (a paste or a share, read).
 *
 * A proposed deadline that names none of the learner's courses (a Notion
 * table with no class column, a course ChatGPT named that they don't have)
 * can't go in as it is, so its button is "Add to a course": the learner's
 * courses, and the one picked is the course for every such deadline in it
 *.
 */
import type { Signal } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import type { NoteMenuItem } from '~/companion/notes/actions'
import { describeSignal, uncoursedFacts } from '~/companion/signals'
import { courseColor } from '~/companion/colors'

const props = defineProps<{ signal: Signal }>()
const emit = defineEmits<{ done: [result: 'applied' | 'dismissed'] }>()

const { t } = useI18n()
const c = useCompanion()
const view = computed(() => describeSignal(props.signal, c))
const busy = ref<'apply' | 'dismiss' | null>(null)
const toast = useToast()

/** "Javohir, in a shared message, 21:05", or just where it came from. */
const who = computed(() => {
  const v = view.value
  if (!v.quoteBy) return v.source
  const [name, time] = v.quoteBy.split(/\s*·\s*/)
  return [name, v.sourceIn, time].filter(Boolean).join(', ')
})

const uncoursed = computed(() => uncoursedFacts(c, props.signal))
const courses = computed<NoteMenuItem[]>(() =>
  c.shelf.value.map((s) => ({ label: s.title, icon: 'workspace', color: courseColor(s.color), run: () => void apply(s.id) })),
)

async function apply(subjectId?: string): Promise<void> {
  busy.value = 'apply'
  try {
    const picked = subjectId ? Object.fromEntries(uncoursed.value.map((i) => [i, subjectId])) : undefined
    await c.applySignal(props.signal.id, undefined, picked)
    const course = subjectId ? c.get('subjects', subjectId)?.title : null
    toast.success(course ? t('today.signal.addedTo', { course }) : view.value.before && view.value.after ? `${view.value.subjectLine}: ${view.value.after}` : t('common.done'))
    emit('done', 'applied')
  } catch {
    toast.error(t('today.signal.failed'))
  } finally {
    busy.value = null
  }
}

async function dismiss(): Promise<void> {
  busy.value = 'dismiss'
  try {
    await c.dismissSignal(props.signal.id)
    emit('done', 'dismissed')
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <article class="grid gap-4 rounded-[18px] bg-surface p-5 shadow-[0_0_0_1px_var(--border),var(--shadow-raised)]">
    <div class="grid gap-1.5">
      <p class="flex min-w-0 items-center gap-2 text-[14px] text-text-soft">
        <span
          class="size-2 shrink-0 rounded-full"
          :style="{ background: courseColor(view.subject?.color) }"
        />
        <span class="truncate">{{ view.subjectLine }}</span>
      </p>
      <h3 class="font-display text-[21px] leading-snug font-semibold tracking-[-0.025em]">
        {{ view.headline }}
      </h3>
      <p
        v-if="view.after"
        class="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[17px] leading-snug"
      >
        <span
          class="text-text-muted"
          :class="view.before ? 'line-through' : ''"
        >{{ view.before ?? t('today.signal.notOnCalendar') }}</span>
        <CompanionIcon
          name="arrow-right"
          :size="17"
          class="text-text-muted"
        />
        <span class="sr-only">{{ t('today.signal.to') }}</span>
        <b class="font-semibold text-text">{{ view.after }}</b>
      </p>
    </div>

    <figure class="grid gap-1 rounded-[12px] bg-accent-soft px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--accent-line)]">
      <blockquote class="text-[15px] leading-relaxed text-text-body">
        “{{ view.quote }}”
      </blockquote>
      <figcaption class="text-[14px] text-text-muted">
        {{ who }}
      </figcaption>
    </figure>

    <p class="text-[14px] leading-relaxed text-text-muted">
      {{ view.consequence }}
    </p>

    <div class="flex flex-wrap items-center gap-2">
      <CompanionNotesMenu
        v-if="uncoursed.length && courses.length"
        :items="courses"
        :label="t('today.signal.addToCourse')"
        :title="t('today.signal.addToWhich')"
      >
        <template #default="{ toggle, open }">
          <UiBtn
            variant="primary"
            size="lg"
            aria-haspopup="menu"
            :aria-expanded="open"
            :loading="busy === 'apply'"
            :disabled="busy !== null"
            @click="toggle"
          >
            {{ t('today.signal.addToCourse') }}
            <UiIcon
              name="chevron-down"
              :size="16"
            />
          </UiBtn>
        </template>
      </CompanionNotesMenu>
      <UiBtn
        v-else
        variant="primary"
        size="lg"
        :loading="busy === 'apply'"
        :disabled="!view.canApply || busy !== null"
        @click="apply()"
      >
        {{ view.applyLabel }}
      </UiBtn>
      <UiBtn
        variant="ghost"
        size="lg"
        :loading="busy === 'dismiss'"
        :disabled="busy !== null"
        @click="dismiss"
      >
        {{ t('today.signal.ignore') }}
      </UiBtn>
    </div>
  </article>
</template>
