<script setup lang="ts">
/**
 * "Get set up": the four things that make BiliMind the learner's own, one
 * button each. They tick themselves from what has really happened, never
 * from the press, so a step done somewhere else is done here too:
 *
 *   Ask your first question     a chat exists
 *   Make your own course        a course that isn't the sample
 *   Add your notes or files     a note or file that isn't a sample
 *   Connect your school         a Moodle or timetable connection
 *
 * Drawn as the plan's card (numbered circles that turn lime), so a new
 * learner meets the shape their days will have. It folds away for good once
 * all four are done, or when dismissed (per device, `bm:setup-hidden`).
 * Quiet AI leaves out the first step: asking is the AI. The page shows it
 * only to a starter account (samples, or nothing of its own yet).
 */
import { useCompanion } from '~/companion/store'
import { useAiThread } from '~/companion/ai/thread'
import { newChatLink } from '~/companion/ai/routes'
import { useQuietAi } from '~/companion/quiet-ai'
import { isSample } from '~/companion/samples'

const emit = defineEmits<{ ask: [] }>()

const { t } = useI18n()

const c = useCompanion()
const thread = useAiThread()
const { quiet } = useQuietAi()

onMounted(() => {
  if (!thread.threadsState.loaded) void thread.refreshThreads()
})

const steps = computed(() =>
  [
    {
      key: 'ask',
      title: t('today.setup.askTitle'),
      body: t('today.setup.askBody'),
      done: thread.threads.value.length > 0,
      cta: t('today.setup.askCta'),
      to: null,
    },
    {
      key: 'course',
      title: t('today.setup.courseTitle'),
      body: t('today.setup.courseBody'),
      done: c.subjects.value.some((s) => !s.sample),
      cta: t('today.setup.courseCta'),
      to: newChatLink({ intent: 'course' }),
    },
    {
      key: 'notes',
      title: t('today.setup.notesTitle'),
      body: t('today.setup.notesBody'),
      done: c.items.value.some((i) => !isSample(i)),
      cta: t('today.setup.notesCta'),
      to: '/app/notes',
    },
  ].filter((s) => !(quiet.value && s.key === 'ask')),
)

const done = computed(() => steps.value.filter((s) => s.done).length)

const KEY = 'bm:setup-hidden'
const hidden = ref(false)
onMounted(() => {
  try {
    hidden.value = localStorage.getItem(KEY) === '1'
  } catch {
    // Private mode: it shows until it's done, which is harmless.
  }
})

function hide(): void {
  hidden.value = true
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // Hidden for this visit only.
  }
}
</script>

<template>
  <section
    v-if="!hidden && done < steps.length"
    aria-labelledby="today-setup"
  >
    <div class="flex items-center justify-between gap-3 px-0.5">
      <h2
        id="today-setup"
        class="font-display text-[18px] font-semibold tracking-[-0.02em]"
      >
        {{ t('today.setup.title') }}
      </h2>
      <div class="flex items-center gap-1">
        <span class="text-[12.5px] text-text-faint">{{ t('today.setup.progress', { done, total: steps.length }) }}</span>
        <button
          type="button"
          class="-mr-2 grid size-11 cursor-pointer place-items-center rounded-full text-text-faint transition-colors hover:bg-surface-sunken hover:text-text focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                    :aria-label="t('today.setup.hideLabel')"
          :title="t('today.setup.hide')"
          @click="hide"
        >
          <UiIcon
            name="x"
            :size="16"
          />
        </button>
      </div>
    </div>

    <ol class="mt-2 overflow-hidden rounded-[18px] bg-surface shadow-[0_0_0_1px_var(--border),var(--shadow-raised)]">
      <li
        v-for="(s, index) in steps"
        :key="s.key"
        :class="['flex items-center gap-3.5 py-3.5 pr-3 pl-4', index > 0 && 'border-t border-border-rule']"
      >
        <span
          :class="[
            // The plan's own tick square (Plan.vue), so a step and a task read alike.
            'grid size-[26px] shrink-0 place-items-center rounded-[8px] text-[12px] font-bold transition-colors duration-200',
            s.done ? 'bg-leaf text-white' : 'text-text-faint shadow-[inset_0_0_0_1.5px_var(--border-dashed)]',
          ]"
          aria-hidden="true"
        >
          <UiIcon
            v-if="s.done"
            name="check"
            :size="15"
            :stroke="2.6"
          />
          <template v-else>{{ index + 1 }}</template>
        </span>
        <span class="min-w-0 flex-1">
          <span
            :class="[
              'block font-display text-[15px] leading-snug font-semibold tracking-[-0.015em]',
              s.done ? 'text-text-faint line-through decoration-text-ghost' : 'text-text',
            ]"
          >
            {{ s.title }}<span class="sr-only">{{ s.done ? t('today.setup.doneSr') : '' }}</span>
          </span>
          <span
            v-if="!s.done"
            class="mt-0.5 block text-[12.5px] leading-snug text-text-faint"
          >{{ s.body }}</span>
        </span>
        <template v-if="!s.done">
          <UiBtn
            v-if="s.to"
            :to="s.to"
            variant="secondary"
            size="md"
            class="shrink-0 max-sm:h-11"
          >
            {{ s.cta }}
          </UiBtn>
          <UiBtn
            v-else
            variant="secondary"
            size="md"
            class="shrink-0 max-sm:h-11"
            @click="emit('ask')"
          >
            {{ s.cta }}
          </UiBtn>
        </template>
      </li>
    </ol>
  </section>
</template>
