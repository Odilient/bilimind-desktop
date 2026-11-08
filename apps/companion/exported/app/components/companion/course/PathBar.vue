<script setup lang="ts">
import type { Subject } from '~/companion/types'
import type { CourseView } from '~/companion/course-home'
import { useCompanion } from '~/companion/store'
import { useCapture } from '~/companion/capture'
import { dayKey, shortDate, weekdayShort } from '~/companion/time'
import { readyWords } from '~/companion/words'

/**
 * The Path tab's own controls, in the corner of the course's home: how to
 * look at the course (the map of its topics, or the same topics as a list by
 * week, or by step on a path of one's own), and its dates.
 *
 * Map, Weeks and Deadlines used to be three tabs beside Grades, Notes and
 * Materials. They are one thing seen three ways, so they are one tab now:
 * two views of the path, and the dates as a small table that drops from the
 * corner, with the full list (and what's behind, with its marks) one link
 * further. `?tab=deadlines` still lands on that list.
 */
const props = defineProps<{ subject: Subject }>()
const view = defineModel<CourseView>('view', { required: true })
const { t } = useI18n()
const c = useCompanion()
const capture = useCapture()

const isPath = computed(() => props.subject.format === 'path')
const listView = computed<CourseView>(() => (isPath.value ? 'path' : 'weeks'))

const VIEWS = computed(() => [
  { view: 'map' as CourseView, label: t('course.home.roadmap'), icon: 'map' },
  { view: listView.value, label: isPath.value ? t('course.home.list') : t('course.home.week'), icon: isPath.value ? 'list' : 'calendar' },
])

const upcoming = computed(() => {
  const now = Date.now()
  return c.deadlines.value
    .filter((d) => d.subject_id === props.subject.id && d.status === 'upcoming' && (!d.due_at || Date.parse(d.due_at) > now))
    .sort((a, b) => (a.due_at ? Date.parse(a.due_at) : Infinity) - (b.due_at ? Date.parse(b.due_at) : Infinity))
})

/** The table's rows: when, what, and how ready, the way the deadline page says it. */
const rows = computed(() =>
  upcoming.value.slice(0, 6).map((d) => {
    const scope = c.readinessOf(d)
    return {
      id: d.id,
      title: d.title,
      day: d.due_at ? weekdayShort(dayKey(d.due_at)) : '',
      date: d.due_at ? shortDate(dayKey(d.due_at)) : t('course.dates.noDate'),
      ready: scope.total ? readyWords(scope.checked ? scope.percent : null) : '',
    }
  }),
)

const open = ref(false)
const root = ref<HTMLElement | null>(null)
/* The table opens leftwards from the button at the row's right end; when the
   row has wrapped and the button sits at the left, rightwards, or the pane
   would clip it. */
const toLeft = ref(true)
function toggle(): void {
  const r = root.value?.getBoundingClientRect()
  const edge = root.value?.closest('main')?.getBoundingClientRect().left ?? 0
  toLeft.value = !r || r.right - 340 >= edge + 8
  open.value = !open.value
}

function onDocumentClick(event: MouseEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false
}
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') open.value = false
}
watch(open, (isOpen) => {
  if (!import.meta.client) return
  if (isOpen) {
    document.addEventListener('mousedown', onDocumentClick)
    document.addEventListener('keydown', onKeydown)
  } else {
    document.removeEventListener('mousedown', onDocumentClick)
    document.removeEventListener('keydown', onKeydown)
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})

function all(): void {
  open.value = false
  view.value = 'deadlines'
}
</script>

<template>
  <div class="flex items-center gap-2">
    <div
      class="inline-flex items-center gap-0.5 rounded-[9px] bg-[rgb(var(--wash-rgb)/0.065)] p-[3px]"
      role="group"
      :aria-label="t('course.dates.lookAs')"
    >
      <button
        v-for="v in VIEWS"
        :key="v.view"
        type="button"
        :aria-pressed="view === v.view"
        :class="[
          'flex h-[26px] cursor-pointer items-center gap-1.5 rounded-[7px] px-2.5 text-[12.5px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand',
          view === v.view ? 'bg-surface text-text shadow-[var(--shadow-card),0_0_0_1px_var(--border)]' : 'text-text-muted hover:text-text',
        ]"
        @click="view = v.view"
      >
        <UiIcon
          :name="v.icon"
          :size="13"
        />
        {{ v.label }}
      </button>
    </div>

    <div
      ref="root"
      class="relative"
    >
      <button
        type="button"
        :aria-expanded="open"
        aria-haspopup="dialog"
        :class="[
          'flex h-8 cursor-pointer items-center gap-1.5 rounded-[9px] px-2.5 text-[12.5px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand',
          open || view === 'deadlines'
            ? 'bg-rose-soft text-rose-ink'
            : 'text-text-soft shadow-[inset_0_0_0_1px_var(--border)] hover:bg-surface-mute hover:text-text',
        ]"
        @click="toggle"
      >
        <CompanionIcon
          name="flag"
          :size="13"
          :stroke="2"
        />
        {{ t('course.dates.button') }}
        <span
          v-if="upcoming.length"
          class="num text-[11.5px] opacity-70"
        >{{ upcoming.length }}</span>
        <UiIcon
          name="chevron-down"
          :size="13"
          class="opacity-60"
        />
      </button>

      <div
        v-if="open"
        :class="[
          'pop-in absolute top-full z-50 mt-2 w-[min(340px,calc(100vw-32px))] rounded-[16px] bg-surface p-2 shadow-pop ring-1 ring-border',
          toLeft ? 'right-0' : 'left-0',
        ]"
        role="dialog"
        :aria-label="t('course.dates.title')"
      >
        <p class="px-2 pt-1 pb-1.5 text-[12px] font-semibold text-text-muted">
          {{ t('course.dates.title') }}
        </p>
        <table
          v-if="rows.length"
          class="w-full border-collapse text-[13px]"
        >
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.id"
              class="cursor-pointer transition-colors hover:bg-surface-mute"
              @click="open = false; navigateTo(`/app/d/${row.id}`)"
            >
              <td class="rounded-l-[9px] py-2 pr-2 pl-2 align-top whitespace-nowrap text-text-muted">
                <span class="font-semibold text-text-soft">{{ row.day }}</span> {{ row.date }}
              </td>
              <td class="py-2 pr-2 align-top">
                <NuxtLink
                  :to="`/app/d/${row.id}`"
                  class="font-semibold text-text [overflow-wrap:anywhere]"
                  @click.stop="open = false"
                >
                  {{ row.title }}
                </NuxtLink>
              </td>
              <td class="rounded-r-[9px] py-2 pr-2 text-right align-top text-[12px] whitespace-nowrap text-text-muted">
                {{ row.ready }}
              </td>
            </tr>
          </tbody>
        </table>
        <div
          v-else
          class="grid justify-items-start gap-2 px-2 pb-2"
        >
          <p class="text-[13.5px] text-text-body">
            {{ t('course.dates.none') }}
          </p>
          <UiBtn
            variant="secondary"
            size="sm"
            @click="open = false; capture.show('paste', subject.id)"
          >
            {{ t('course.dates.paste') }}
          </UiBtn>
        </div>
        <button
          type="button"
          class="mt-1 flex w-full cursor-pointer items-center justify-between rounded-[9px] border-t border-border-rule px-2 pt-2.5 pb-1.5 text-[13px] font-semibold text-text-soft hover:text-text"
          @click="all"
        >
          {{ t('course.dates.all') }}
          <UiIcon
            name="arrow-right"
            :size="14"
          />
        </button>
      </div>
    </div>
  </div>
</template>
