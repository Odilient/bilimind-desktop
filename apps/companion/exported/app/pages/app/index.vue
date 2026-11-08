<script setup lang="ts">
/**
 * Today: the old app's Today (`pages/today.vue`) again, with the companion
 * in it. It answers one question, what should I do right now. Drawn as
 * Daylight 2's Today (docs/design/daylight2/sections/07-today.html): the
 * question centred on top, then on a desk the pick and the rest of today on
 * the right, the week, classes, what's due and grades on the left (one
 * column on a phone, the pick first):
 *
 *  - The greeting and the day ("Wednesday 28 October · week 8").
 *  - The question: the chat's box, with the chat's "Choose what to make"
 *    tiles as a row under it (Ask). Whatever is asked opens in the chat.
 *  - One cobalt card with one button (Hero): the class to take notes in,
 *    the lesson to pick up, the cards to review, or for a new account
 *    "Start here", the sample course's first lesson.
 *  - Then the quiet day: anything waiting for your OK, your plan (numbered,
 *    ticked off here), today's classes and what's due in two weeks. A list
 *    with nothing in it draws nothing, so a quiet day is a short page.
 *
 * A starter account (it still has the samples, or nothing of its own yet)
 * also gets "Get set up", four steps that tick themselves from real data,
 * and "Look around", the sample course and notes with one Remove samples.
 * With the samples gone and nothing made yet, the card asks what they want
 * to learn, so the page still welcomes.
 *
 * Everything reads the live store and the shared clock (`useNow`), so a
 * class that starts while the page is open becomes the card, and past
 * midnight the page asks for the new day's plan by itself.
 */
import { useCompanion } from '~/companion/store'
import { useQuietAi } from '~/companion/quiet-ai'
import { useAiContext } from '~/companion/ai/state'
import { hasSamples, isSample } from '~/companion/samples'
import { dayKey, greeting, longDayLabel } from '~/companion/time'
import { useNow } from '~/companion/today-layout'
import { useOrg } from '~/institution/org'

definePageMeta({ layout: 'companion' })
const { t } = useI18n()
useHead({ title: () => `${t('today.page.title')} · BiliMind` })

const c = useCompanion()
const now = useNow()
const { quiet } = useQuietAi()
const ask = ref<{ focus: () => void } | null>(null)

// What the companion sees from here: the day, across every course.
useAiContext(() => ({ kind: 'today', label: t('today.page.title') }))

onMounted(() => {
  void c.load().then(() => c.loadToday())
})

const date = computed(() => dayKey(now.value))
// Past midnight with the page open: the new day's plan.
watch(date, (next, prev) => {
  if (prev && next !== prev) void c.loadToday()
})

const hello = computed(() =>
  c.userName.value ? `${greeting(now.value)}, ${c.userName.value}` : greeting(now.value),
)
const failed = computed(() => Boolean(c.status.error) && !c.status.ready)
const loading = computed(() => !failed.value && (!c.today.value || !c.status.ready))

const dayLine = computed(() => {
  const n = c.currentWeek.value
  return [longDayLabel(date.value), n && n >= 1 && n <= 16 ? t('today.page.week', { n }) : ''].filter(Boolean).join(' · ')
})

/** Still on the starter kit, or nothing of their own yet: the page also shows how to begin. */
// A centre's people are set up by the centre: the student "Get set up" checklist isn't theirs.
const org = useOrg()
const inCentre = ref(false)
onMounted(() => void org.list().then((list) => (inCentre.value = list.length > 0)).catch(() => undefined))

const starter = computed(
  () =>
    !inCentre.value &&
    (hasSamples(c) ||
      (!c.subjects.value.some((s) => !s.sample) && !c.items.value.some((i) => !isSample(i)))),
)

/** Get set up's "Ask": the box at the top, or with Quiet AI on, a new chat. */
function focusAsk(): void {
  if (ask.value) ask.value.focus()
  else void navigateTo('/app/chat')
}
</script>

<template>
  <div class="pb-20">
    <ShellPageHead
      :title="t('today.page.title')"
      bar-only
    />

    <div class="mx-auto grid w-full max-w-[1120px] grid-cols-1 gap-7 px-4 pt-6 sm:px-6 lg:gap-8 lg:px-8 lg:pt-[7vh]">
      <!-- The greeting and the question, there before anything has loaded. -->
      <!-- One column that never grows past the window: the tiles scroll inside their row. -->
      <div class="mx-auto grid w-full max-w-[760px] grid-cols-1 gap-5">
        <header class="grid justify-items-center gap-1 text-center">
          <p class="text-[13.5px] font-medium text-text-faint">
            {{ dayLine }}
          </p>
          <h1 class="font-display text-[30px] leading-[1.05] font-semibold tracking-[-0.04em] sm:text-[40px]">
            {{ hello }}
          </h1>
        </header>
        <CompanionTodayAsk
          v-if="!quiet"
          ref="ask"
        />
      </div>

      <!-- Offline: one line and no alarm, in the old "from earlier" strip. -->
      <div
        v-if="c.outbox.value.length"
        class="flex items-center gap-3 rounded-[14px] bg-butter-soft px-4 py-3 shadow-[inset_0_0_0_1px_var(--warn-line)]"
      >
        <span class="grid size-8 shrink-0 place-items-center rounded-[9px] bg-surface text-butter-ink">
          <UiIcon
            name="refresh"
            :size="15"
          />
        </span>
        <p class="min-w-0 flex-1 text-[13.5px] text-warn-text">
          <span class="font-semibold">{{ t('today.page.offline') }}</span>
          {{ t('today.page.willSave', c.outbox.value.length) }}
        </p>
      </div>

      <!-- Failure -->
      <UiEmptyState
        v-if="failed"
        icon="alert"
        tone="danger"
        :title="t('today.page.cantLoad')"
        :description="c.status.error ?? undefined"
        class="py-10"
      >
        <UiBtn
          variant="secondary"
          icon="refresh"
          @click="c.load(true).then(() => c.loadToday())"
        >
          {{ t('common.retry') }}
        </UiBtn>
      </UiEmptyState>

      <!-- Loading: the shapes of the page, no spinner. -->
      <div
        v-else-if="loading"
        class="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]"
        aria-busy="true"
        :aria-label="t('today.page.loading')"
      >
        <UiSkeleton
          h="17rem"
          rounded="xl"
        />
        <UiSkeleton
          h="17rem"
          rounded="xl"
        />
      </div>

      <!-- The day: what to do now and the rest of today on the right, the
           week and what's coming on the left; one column on a phone, the
           pick first. -->
      <div
        v-else
        class="animate-rise grid grid-cols-1 gap-7 lg:gap-8"
      >
        <template v-if="starter">
          <CompanionTodaySetup @ask="focusAsk" />
          <CompanionTodaySamples />
        </template>
        <CompanionTodayChanges />

        <div class="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-6">
          <div class="grid grid-cols-1 gap-7 lg:col-start-2 lg:row-start-1">
            <CompanionTodayHero />
            <CompanionTodayPlan />
          </div>
          <div class="grid grid-cols-1 gap-7 lg:col-start-1 lg:row-start-1">
            <CompanionTodayWeek />
            <CompanionTodayClasses />
            <CompanionTodayDue />
            <CompanionTodayGrades />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
