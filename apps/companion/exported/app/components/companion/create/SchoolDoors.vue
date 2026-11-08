<script setup lang="ts">
/**
 * "Connect your school", under the composer: the four ways a school's
 * courses come in by themselves, each one tile that opens its flow in a
 * modal (ConnectModal) without leaving the page. A way already connected
 * says so on its tile, in green, or in red when it stopped working, so the
 * learner sees at a glance what is already flowing in.
 */
import type { ConnectKind } from '~/companion/create'
import { useCompanion } from '~/companion/store'

const emit = defineEmits<{ open: [kind: ConnectKind] }>()

const c = useCompanion()

const DOORS: { kind: ConnectKind; icon: string; title: string; body: string }[] = [
  { kind: 'moodle', icon: 'cap', title: 'Moodle', body: 'Every course, its files by week and its deadlines, at once' },
  { kind: 'ics', icon: 'calendar', title: 'Timetable link', body: 'Your classes and rooms, from the student portal' },
  // shortcut: hidden until the inbound worker is live (docs/inbound-worker.md); restore this row then.
  { kind: 'photo', icon: 'camera', title: 'Exam timetable PDF', body: 'The rows about your courses. You check them first.' },
]

function state(kind: ConnectKind): { word: string; tone: string } | null {
  if (kind !== 'moodle' && kind !== 'ics') return null
  const conn = c.connections.value.find((x) => x.kind === kind)
  if (!conn) return null
  return conn.status === 'error'
    ? { word: 'Stopped working', tone: 'text-danger-text' }
    : { word: 'Connected', tone: 'text-success-text' }
}
</script>

<template>
  <section
    class="grid gap-3"
    aria-labelledby="cp-create-school"
  >
    <div class="grid gap-0.5">
      <h2
        id="cp-create-school"
        class="t-head text-[17px]"
      >
        Connect your school
      </h2>
      <p class="text-[14px] text-text-muted">
        Your courses, classes and deadlines come in by themselves, and stay up to date.
      </p>
    </div>
    <ul class="grid gap-2 min-[600px]:grid-cols-2">
      <li
        v-for="d in DOORS"
        :key="d.kind"
      >
        <button
          type="button"
          class="group flex h-full min-h-[72px] w-full cursor-pointer items-center gap-3.5 rounded-[16px] border border-border bg-surface px-4 py-3 text-left transition-[border-color,box-shadow,background-color] duration-150 outline-none hover:border-border-strong hover:shadow-raised focus-visible:ring-2 focus-visible:ring-brand-line"
          @click="emit('open', d.kind)"
        >
          <span class="grid size-10 shrink-0 place-items-center rounded-[12px] bg-surface-track text-text-soft transition-colors duration-150 group-hover:bg-brand-soft group-hover:text-brand">
            <CompanionIcon
              :name="d.icon"
              :size="19"
            />
          </span>
          <span class="grid min-w-0 flex-1 gap-0.5">
            <span class="flex items-center gap-2 text-[15px] font-semibold text-text">
              {{ d.title }}
              <span
                v-if="state(d.kind)"
                class="text-[12.5px] font-semibold"
                :class="state(d.kind)!.tone"
              >{{ state(d.kind)!.word }}</span>
            </span>
            <span class="text-[13px] leading-snug text-text-muted">{{ d.body }}</span>
          </span>
          <CompanionIcon
            name="chevron-right"
            :size="17"
            class="shrink-0 text-text-faint transition-[color,transform] duration-150 group-hover:translate-x-0.5 group-hover:text-text-soft"
          />
        </button>
      </li>
    </ul>
  </section>
</template>
