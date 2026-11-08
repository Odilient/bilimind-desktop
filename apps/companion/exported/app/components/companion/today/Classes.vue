<script setup lang="ts">
/**
 * Classes today, in the side column: one white card, a row per class in
 * order, its start and end on the left where the eye runs down them, the
 * course's dot, name and room under the title. The one on now is marked
 * (a lime "Now" with a live dot); the ones over fade.
 *
 * A row opens the class in its course. On a computer, resting on a row shows its two
 * actions: Take notes (the lecture page filed under that class, or the one
 * already started) and Record. A phone has no hover, so there they always
 * show, as two small round buttons.
 *
 * No classes today draws nothing: a quiet day says so by being short. The
 * one exception is a school connected whose LMS doesn't send rooms and
 * times: then the card asks for the calendar link, the one thing missing.
 * Connecting a school at all is Get set up's step, not this card's.
 */
import type { Session } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { useCapture } from '~/companion/capture'
import { courseColor } from '~/companion/colors'
import { clock, dayKey } from '~/companion/time'
import { classHref, isStudy, notesOf, takeNotes, useNow } from '~/companion/today-layout'

const { t } = useI18n()
const c = useCompanion()
const capture = useCapture()
const now = useNow()

const classes = computed(() => {
  const today = dayKey(now.value)
  return c.sessions.value.filter((s) => !s.cancelled && dayKey(s.starts_at) === today)
})

function state(s: Session): 'over' | 'now' | 'later' {
  if (Date.parse(s.ends_at) < now.value) return 'over'
  if (Date.parse(s.starts_at) <= now.value) return 'now'
  return 'later'
}

/** A school connected, but no timetable has come in: its LMS doesn't send rooms and times. */
const missing = computed(() => {
  if (c.sessions.value.length || c.slots.value.length) return null
  if (c.connections.value.some((x) => x.kind === 'ics')) return null
  const school = c.connections.value.find((x) => x.kind === 'moodle' || x.kind === 'teams')
  return school
    ? t('today.classes.missing', { school: school.kind === 'moodle' ? 'Moodle' : 'Teams' })
    : null
})
</script>

<template>
  <section
    v-if="classes.length || missing"
    aria-labelledby="today-classes"
  >
    <div class="mb-2.5 flex items-baseline justify-between px-0.5">
      <h2
        id="today-classes"
        class="font-display text-[18px] font-semibold tracking-[-0.02em]"
      >
        {{ t('today.classes.title') }}
      </h2>
      <NuxtLink
        to="/app/calendar"
        class="-my-[13px] inline-block py-[13px] text-[12.5px] font-semibold text-brand transition-colors hover:underline"
      >
        {{ t('today.classes.week') }}
      </NuxtLink>
    </div>

    <ul
      v-if="classes.length"
      class="overflow-hidden rounded-[18px] bg-surface shadow-[0_0_0_1px_var(--border),var(--shadow-raised)]"
    >
      <li
        v-for="(s, index) in classes"
        :key="s.id"
        :class="['group relative', index > 0 && 'border-t border-border-rule', state(s) === 'over' && 'opacity-55']"
      >
        <NuxtLink
          :to="classHref(s)"
          class="flex items-center gap-3 py-3 pr-3 pl-3.5 transition-colors hover:bg-surface-mute focus-visible:bg-surface-mute focus-visible:outline-none"
        >
          <span class="grid w-[42px] shrink-0 leading-tight">
            <span class="font-display text-[13.5px] font-semibold">{{ clock(s.starts_at) }}</span>
            <span class="text-[12px] text-text-faint">{{ clock(s.ends_at) }}</span>
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex min-w-0 items-center gap-2">
              <span class="truncate text-[13.5px] font-semibold">{{ s.title }}</span>
              <span
                v-if="state(s) === 'now'"
                class="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11.5px] font-semibold text-accent-strong"
              >
                <span class="size-1.5 animate-pulse-dot rounded-full bg-leaf motion-reduce:animate-none" />
                {{ t('today.classes.now') }}
              </span>
            </span>
            <span class="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-text-faint">
              <span
                class="size-2 shrink-0 rounded-full"
                :style="{ background: courseColor(c.subjectOf(s)?.color) }"
              />
              <span class="truncate">{{ [c.subjectOf(s)?.title, s.location].filter(Boolean).join(' · ') }}</span>
            </span>
          </span>
          <!-- Room for the two actions, which sit over this end of the row. -->
          <span
            v-if="!isStudy(c, s) && state(s) !== 'over'"
            class="w-[76px] shrink-0 [@media(hover:hover)]:w-0"
            aria-hidden="true"
          />
        </NuxtLink>

        <!-- Take notes and Record: always on a phone, on hover or focus on a computer. -->
        <span
          v-if="!isStudy(c, s) && state(s) !== 'over'"
          class="absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-1 transition-opacity duration-150 [@media(hover:hover)]:bg-[linear-gradient(to_left,var(--surface-mute)_72%,transparent)] [@media(hover:hover)]:py-1 [@media(hover:hover)]:pl-7 [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:pointer-events-auto [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:pointer-events-auto [@media(hover:hover)]:group-hover:opacity-100"
        >
          <button
            type="button"
            class="grid size-9 cursor-pointer place-items-center rounded-full bg-surface text-text-soft shadow-[inset_0_0_0_1px_var(--border-strong)] transition-colors hover:bg-brand-soft hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            :title="t(notesOf(c, s) ? 'today.classes.openNotes' : 'today.classes.takeNotes')"
            :aria-label="t(notesOf(c, s) ? 'today.classes.openNotesFor' : 'today.classes.takeNotesIn', { title: s.title })"
            @click="takeNotes(c, s)"
          >
            <UiIcon
              name="pencil"
              :size="15"
            />
          </button>
          <button
            v-if="false"
            type="button"
            class="grid size-9 cursor-pointer place-items-center rounded-full bg-surface text-text-soft shadow-[inset_0_0_0_1px_var(--border-strong)] transition-colors hover:bg-danger-soft hover:text-danger focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            :title="t('today.classes.record')"
            :aria-label="t('today.classes.recordTitle', { title: s.title })"
            @click="capture.show('record', s.subject_id, s.id)"
          >
            <UiIcon
              name="mic"
              :size="15"
            />
          </button>
        </span>
      </li>
    </ul>

    <div
      v-else
      class="rounded-[18px] bg-surface p-4 shadow-[inset_0_0_0_1px_var(--border)]"
    >
      <p class="text-[13.5px] leading-relaxed text-text-soft">
        {{ missing }}
      </p>
      <UiBtn
        to="/app/settings?section=integrations"
        variant="secondary"
        size="md"
        class="mt-3 max-sm:h-11"
        icon="calendar"
      >
        {{ t('today.classes.addTimetable') }}
      </UiBtn>
    </div>
  </section>
</template>
